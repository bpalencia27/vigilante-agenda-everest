# Informe de auditoría — Términos de uso y aviso de privacidad (Asistente Centinela)

**Encargo:** SUPERPROMPT_TERMINOS_BLINDAJE.md · Sección A (TC-01…TC-07) + re-auditoría TC-90.
**Objeto auditado:** `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md` v1.1 (5-sep-2026), en su acoplamiento con `vigilante_agenda.user.js` (constante `TERMINOS_TEXTO`, compuerta P11, suite 82).
**Fecha de la auditoría:** 6 de septiembre de 2026.
**Naturaleza:** borrador de ingeniería documental. No es asesoría jurídica. Toda cláusula nueva o modificada queda marcada para revisión de un abogado colegiado y decisión del propietario.

**Advertencia de método (§0 del encargo):** ninguna norma se afirma de memoria. Cada ancla normativa fue leída en fuente oficial el día de esta auditoría o queda marcada «pendiente de fuente». Las afirmaciones de cumplimiento son siempre «candidatas a verificación por abogado», nunca certificaciones.

---

## TC-02 · Mapa normativo (se presenta primero: lo citan todas las demás secciones)

| Norma | Ámbito | ¿Aplica? Motivo | Fuente leída |
|---|---|---|---|
| **Ley Estatutaria 1581 de 2012** | Habeas data Colombia | **Sí.** Responsable y titulares en Colombia; tratamiento de datos personales de médicos usuarios (arts. 1-3 leídos). | Texto oficial: secretariasenado.gov.co/senado/basedoc/ley_1581_2012.htm (Diario Oficial 48.587, 18-oct-2012). Leídos en su texto: arts. 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14. |
| **Decreto 1377 de 2013** | Reglamento Ley 1581 | **Sí** (reglamentario). Nota de vigencia: parcialmente compilado/derogado por decretos únicos posteriores (1081/2015 y 1074/2015 según el normograma). | normograma.mintic.gov.co/mintic/compilacion/docs/decreto_1377_2013.htm y funcionpublica.gov.co norma i=53646. Leída la definición de «Aviso de privacidad» (art. 3.1) y considerandos. |
| **Ley 1480 de 2011 (Estatuto del Consumidor)** | Cláusulas abusivas / adhesión | **Candidata.** Herramienta gratuita compartida entre colegas: que exista «relación de consumo» exigible aquí **requiere abogado**. Se usa como referente de redacción de cláusulas, no como cumplimiento afirmado. | Texto oficial: secretariasenado.gov.co/senado/basedoc/ley_1480_2011.html. Leídos: art. 5.4 (contrato de adhesión), art. 37 (requisitos), art. 38 (cláusulas prohibidas), art. 42 (cláusulas abusivas) — vía página oficial y Circular Externa 004/2023 de la SIC, que los cita textuales. |
| **Ley 23 de 1981** | Ética médica; historia clínica | **Referente sí** (responsabilidad profesional del médico usuario; la herramienta no es actor de salud). Art. 34 leído: historia clínica = documento privado sometido a reserva. | minsalud.gov.co (concepto jurídico que lo cita) y texto en saludpereira.gov.co/medios/Ley_23_de_1981.pdf. |
| **Resolución 1995 de 1999** | Historia clínica | **Referente sí.** La herramienta escribe en la HC de Everest por acción del médico; el documento debe respetar ese marco sin sustituirlo. | PDF oficial: minsalud.gov.co/sites/rid/.../Resolución_1995_de_1999.pdf (história clínica documento privado, obligatorio, sometido a reserva). |
| **RGPD (UE)** | Protección de datos UE | **No aplica como obligación**, motivo: herramienta de uso profesional en Colombia, titulares en Colombia; no se dirigen bienes/servicios a titulares en la UE. Criterio territorial exacto (art. 3.2 RGPD): **pendiente de fuente** — nombrada solo como candidata. | Pendiente de fuente. |
| **CCPA/CPRA (California)** | Privacidad California | **No aplica como obligación**, motivo: sin directed-ness a California. Criterio exacto: **pendiente de fuente**. | Pendiente de fuente. |
| **LGPD (Brasil)** | Privacidad Brasil | **No aplica como obligación**, motivo: sin oferta a titulares en Brasil. Criterio exacto: **pendiente de fuente**. | Pendiente de fuente. |
| **HIPAA (EE. UU.)** | Salud EE. UU. | **No aplica como obligación**, motivo: ni el Desarrollador ni la herramienta son covered entity/business associate; los datos clínicos no salen del entorno Everest/IPS. Usado solo como referente de estándar. Criterio exacto: **pendiente de fuente**. | Pendiente de fuente. |
| **Ley 1581, art. 26 (transferencias internacionales)** | Transferencia a terceros países | **Candidata relevante**: la hoja de cálculo vive en Google Drive (EE. UU.). Texto del art. 26 **no leído** → toda mención queda «pendiente de fuente». | Pendiente de fuente. |
| **Normativa de habilitación vigente / Res. 2013 de 1986 y sucesoras** | Habilitación IPS | **No aplica directamente** (la herramienta no es prestador); el médico usuario y su IPS sí están sujetos. No se cita en el documento. | Pendiente de fuente (no se usa). |

**Cierre TC-02:** 5 normas con fuente oficial leída; 6 anclas marcadas «pendiente de fuente» (RGPD art. 3.2, CCPA, LGPD, HIPAA, Ley 1581 art. 26, plazos de consulta/reclamo del Decreto 1377). Cada pendiente eleva la criticidad del hallazgo que lo necesita.

---

## TC-01 · Inventario cláusula a cláusula (v1.1, IDs estables; congelado)

| ID | Ubicación v1.1 | Contenido en una línea |
|---|---|---|
| T-00 | Nota inicial | Nota personal al propietario con identidad de quien la mantiene y huella del proceso de redacción («redacté yo») y estado de decisiones. |
| T-01 | PARTE 1, intro | Texto de primer uso; se muestra al cambiar de versión; dos botones. |
| T-02 | PARTE 1, p1 | «Centinela es una herramienta de apoyo hecha por un colega, [nombre completo]. No es un programa oficial de la IPS ni de Everest/Athenea… usted sigue siendo responsable». |
| T-03 | PARTE 1, p2 | Registra uso: funciones, resultado, duración, errores; nunca datos de pacientes. |
| T-04 | PARTE 1, p3 | El registro es condición de uso; no se puede desactivar. |
| T-05 | PARTE 1, p4 | Enlace a términos completos + botones Acepto/No acepto. |
| T-06 | PARTE 1, cierre | Aviso tras «No acepto»: no se registra nada; re-pregunta más tarde. |
| T-07 | PARTE 2 §1 | Qué es; quién la hizo y mantiene (nombre, profesión); no es producto de IPS/Everest/Athenea; sin costo. |
| T-08 | PARTE 2 §2 intro | Qué hace: vigila agenda, agrupa información de Everest/Athenea, prepara borradores. |
| T-09 | §2, b1 | No decide por usted. |
| T-10 | §2, b2 | No escribe solo en la HC; deshacer disponible; nunca pisa casilla ya escrita. |
| T-11 | §2, b3 | No reemplaza verificación en Everest. |
| T-12 | §2, b4 | No es dispositivo médico ni guía clínica; responsabilidad profesional del médico. |
| T-13 | §3 | Autorización expresa; personal e intransferible; retiro de acceso sin explicación. |
| T-14 | §4 | Se entrega «tal como es», sin garantía; sistemas ajenos cambian; avise fallos. |
| T-15 | §4, cierre | En duda: manda Everest/Athenea. |
| T-16 | §5 | IA: Z.ai (GLM) o Gemini; desidentificación previa; borrador; función opcional. |
| T-17 | §6 | Obligaciones del usuario (3 viñetas). |
| T-18 | §7 | Cambios: re-autorización si es de fondo; versión visible en Ajustes. |
| T-19 | §8 | Ley aplicable: colombiana. |
| T-20 | PARTE 3, Responsable | Identidad del responsable (nombre + profesión) y correo de contacto. |
| T-21 | P3, datos 1 | Identificador de usuario (sesión Everest) + identificador de equipo. |
| T-22 | P3, datos 2 | Funciones usadas y cómo terminan; motivo de fallo; duración. |
| T-23 | P3, datos 3 | Errores técnicos: mensaje, lugar, secuencia previa. |
| T-24 | P3, datos 4 | Datos del equipo: navegador, SO, pantalla, versión. |
| T-25 | P3, datos 5 | Contadores de agenda (a tiempo / no presentadas / atendidas sin llegar), sin identidad. |
| T-26 | P3, Qué NO se recoge | Ningún dato de pacientes. |
| T-27 | P3, cómo se garantiza | Lista aprobada de campos + prueba automática inyectando nombre/documento. |
| T-28 | P3, Para qué | Corregir fallos y mejorar la herramienta. |
| T-29 | P3, visibilidad | El responsable SÍ ve uso individual; no se comparte con la IPS individualizado; no evalúa desempeño. |
| T-30 | P3, Dónde | Hoja de cálculo Google Drive del responsable; Google = proveedor. |
| T-31 | P3, cómo se cumple el plazo | Borrado a 12 meses como tarea programada; confesión: sin la tarea, la promesa no se cumple. |
| T-32 | P3, Por cuánto tiempo | Doce meses por registro; revisión del plazo con aviso previo. |
| T-33 | P3, obligatorio | Sin interruptor; sin autorización no abre ni registra nada. |
| T-34 | P3, derechos | Conocer/actualizar/rectificar/suprimir/revocar «en cualquier momento» citando Ley 1581; vía correo; revocar = dejar de usar; suprimir = borrar registros del identificador. |
| T-35 | P3, autorización | Acepto = leyó y autoriza; constancia {versión, fecha-hora, identificador}; nada más. |
| T-36 | Cierre | Checklist «Antes de publicar» (4 puntos, con 3 marcados ✅ y lectura de asesor legal pendiente). |

**Conteo:** 37 cláusulas/párrafos inventariados (T-00…T-36). Congelado; los hallazgos citan por ID.

---

## TC-03 · Cumplimiento por cláusula (cruce contra el mapa)

Claves: ✔ cumple lo razonable como borrador · ✖ no cumple / promesa sin respaldo · ◐ parcial o con riesgo · N/A no aplica.

| Cláusulas | Estado | Ancla / evidencia |
|---|---|---|
| T-02, T-07, T-20 | ✖ | Violación frontal del mandato de anonimato del encargo (§1). Separadamente: Ley 1581 art. 12.d (leído) EXIGE identificar al responsable con dirección/teléfono al pedir la autorización → conflicto estructural que el encargo resuelve a favor del anonimato (§8.4) dejando el punto como pendiente del propietario. |
| T-03, T-04, T-33 | ✔ | Coincide con la compuerta P11 (suite 82: sin aceptar no corre nada, no hay red, no hay eventos; rechazo = cero envíos). |
| T-05, T-06 | ✔ | Textos de pantalla verificados carácter a carácter en el código (toggle «Ver los términos completos y el aviso de privacidad» / «Ocultar…»; aviso de rechazo y «Entendido»). |
| T-08, T-09, T-10, T-11 | ✔ | Comportamiento verificado en banco (sugerencia nunca auto-aplicada; deshacer de llenado; verificación contra Everest). |
| T-12 | ✔ | Adecuado; se refuerza en v1.2 con salvaguarda expresa de responsabilidad profesional. |
| T-13 | ◐ | Retiro de acceso «en cualquier momento, sin explicar por qué»: potenciales problemas de modificación/terminación unilateral (referente Ley 1480 arts. 38/42, aplicabilidad de la ley al caso **requiere abogado**). |
| T-14, T-15 | ✔ | «Tal como es» + precedencia de Everest: coherente con la naturaleza de la herramienta. |
| T-16 | ◐ | Verificado en código (z.ai GLM principal + Gemini respaldo; desidentificación por LISTA BLANCA: «A Gemini NO se le manda…» línea 44254; claves solo en el navegador). Falta decir que la clave se guarda localmente y reforzar la supervisión humana. |
| T-17 | ✔ | Razonable. |
| T-18 | ◐ | El mecanismo existe y está probado (TERMINOS_VERSION → re-pregunta; P11·6/P11·7), pero el documento no declara historial de versiones ni dónde consultar la vigencia publicada. |
| T-19 | ◐ | «Ley colombiana» sin jurisdicción/foro ni política de resolución de conflictos. |
| T-21…T-25 | ✔ | Coinciden con la fila real de telemetría ({token, equipo, ver, evento, ts, dia, lote, …} línea 12340; «equipo» = etiqueta del puesto, no dato personal, línea 9237). |
| T-26, T-27 | ✔ | Canario PHI estructural probado (suite 83, caso P13·6: nombre/cédula/nota/teléfono no caben; saneamiento recursivo líneas 9085+). |
| T-28, T-29 | ✔ | Finalidad única declarada y límites de uso. |
| T-30 | ◐ | Google = encargado/proveedor: no declara transferencia internacional ni compromiso de seguridad del encargado (ancla art. 26 Ley 1581: pendiente de fuente). |
| T-31, T-32 | ✖/◐ | El script de purga existe en el repo (`docs/tablero_purga_12m.gs`) pero su INSTALACIÓN no es verificable desde el repositorio (precedente AE-013). La v1.1 ya lo confiesa; el documento no puede prometerla como cumplida (§0). |
| T-34 | ◐ | Sobre-promete la revocatoria/supresión «en cualquier momento»: el art. 8.e leído es **condicionalmente exequible** (procede cuando la SIC ha determinado incumplimiento). El compromiso voluntario de suprimir es más protector y válido, pero citado con la ley no debe tergiversarla. |
| T-35 | ✔ | Constancia exacta {version, ts, id} probada (P11·4: «guarda SOLO {versión, fecha-hora, identificador}»). |
| T-36 | ◐ | Checklist honesto; debe actualizarse al estado real tras este encargo. |

---

## TC-04 · Cláusulas abusivas o nulas de riesgo

Ninguna cláusula del v1.1 busca abusar del usuario (el documento es inusualmente honesto). Los riesgos detectados son de **ineficacia/nulidad** o de **riesgo para el propio Desarrollador**:

1. **T-13 (retiro arbitrario sin explicación)** — cita: «El autor puede retirar el acceso en cualquier momento, sin necesidad de explicar por qué». Problema: cláusula de terminación unilateral discrecional; el referente (Ley 1480 art. 38: prohibidas las que permitan al proveedor «modificar unilateralmente el contrato o sustraerse de sus obligaciones»; art. 42: abusivas las que producen desequilibrio injustificado) la tornaría ineficaz **si** la ley aplica a esta relación (gratis, entre colegas → **requiere abogado**). Para quién: usuario (pérdida de servicio sin causa comunicada) y Desarrollador (cláusula posiblemente ineficaz + reputacional). Corrección v1.2: retiro por motivos legítimos (seguridad, legal, privacidad, mantenimiento) con esfuerzo de comunicación.
2. **T-14/T-16 sin salvaguarda de lo irrenunciable** — el «sin garantía» y la ausencia de una cláusula de limitación de responsabilidad proporcionada dejan el texto sin la protección estándar que el Desarrollador necesita; a la vez, cualquier límite mal redactado podría chocar con la regla de que ciertas responsabilidades son irrenunciables (la norma civil concreta: **pendiente de fuente**; referente leído Ley 1480 art. 43.1: ineficaces las que «limiten la responsabilidad… de las obligaciones que por ley les corresponden»). Corrección v1.2: cláusula nueva T-38 con salvaguarda expresa «en la máxima medida permitida por la ley» + marca [REQUIERE ABOGADO].
3. **T-03/T-04/T-33 (telemetría como condición de uso)** — no es abusiva per se (servicio gratuito, finalidad informada, salida honesta), pero condicionar el uso a la autorización es una renuncia condicionada que debe quedar explícita y reversible: la v1.1 ya lo hace bien («si no está de acuerdo… no se abrirá»; revocar = dejar de usar). Se conserva y se ancla correctamente (art. 9 Ley 1581: autorización previa e informada por medio consultable posteriormente — leído).

---

## TC-05 · Lagunas críticas

| # | Ausencia | Riesgo | Ancla |
|---|---|---|---|
| L1 | Base jurídica y principios del tratamiento no declarados como tal | Formal: el aviso describe el qué pero no el título bajo el cual trata | Ley 1581 arts. 4.c, 9 (leídos) |
| L2 | Encargados y transferencia internacional (Google, EE. UU.) sin declarar | El titular no sabe que sus datos salen del país | Ley 1581 Título VIII (art. 26: **pendiente de fuente**) |
| L3 | Datos que se procesan LOCALMENTE (sesión clínica en pantalla, caché cifrado AES-GCM 256 con nombres HMAC de la cédula, registro del día con cédula y hora) no descritos | Opacidad: «no recogemos datos de pacientes» es cierto para la RED, pero el equipo local sí toca PHI; un lector podría entender «ningún dato de paciente es procesado», lo cual es falso | Transparencia; código: carpetas v17+ (líneas 32317-32631), registro local del día (líneas 10827/10910) |
| L4 | Medidas de seguridad reales no enumeradas | Principio de seguridad (art. 4.g, leído) exigible en el aviso | Ley 1581 art. 4.g |
| L5 | Menores: silencio | Sin declaración de no-dirigido-a-menores | Ley 1581 art. 7 (leído) |
| L6 | Versionado del propio documento (historial, dónde ver la vigente publicada) | El usuario no puede saber qué versión aceptó vs. la publicada | Código ya lo garantiza (TERMINOS_VERSION); falta declararlo |
| L7 | Derechos: procedimiento, plazos y autoridad (SIC) no descritos | El art. 12 leído exige informar los derechos y la identificación del responsable al pedir autorización | Ley 1581 arts. 8 (leído, 6 literales), 12 (leído) |
| L8 | Promesas verificables: el documento no enlaza sus promesas con el banco que las certifica | Reclamabilidad | Práctica del proyecto (§0: «el documento promete, el código cumple») |

---

## TC-06 · Incongruencias internas y promesas vs código (método AE-013)

1. **T-00 vs documento público:** la nota personal (identidad del redactor y confesiones de proceso) vive DENTRO del documento que se pega en la pantalla de consentimiento. Incongruente con su propio propósito de texto legal. Corregido en v1.2 (la nota pasa a este informe).
2. **T-31/T-32 vs código:** «es una tarea programada que corre sola» — el archivo existe (`docs/tablero_purga_12m.gs`, entregable de instalación manual según `docs/CAMBIOS_claude-compuerta-consentimiento.md` §«Purga de 12 meses»); la instalación en el proyecto Apps Script del tablero NO es verificable desde el repositorio. Precedente AE-013. La v1.1 lo confiesa en la misma cláusula (correcto); v1.2 mantiene la confesión y añade el pendiente explícito.
3. **T-34 vs Ley 1581:** «puede en cualquier momento… suprimir… y revocar esta autorización, conforme a la Ley 1581» — el art. 8.e leído condiciona la procedencia de la revocatoria/supresión a la determinación previa de la SIC. La práctica ofrecida (suprimir a simple solicitud) es válida y más protectora; la cita normativa tal como está redactada es inexacta. Corregido en v1.2 (T-30 nueva redacción con los 6 literales reales del art. 8 + compromiso voluntario de supresión).
4. **T-20/T-34 vs anonimato (§1):** el canal de derechos es un correo personal identificativo; tras la anonimización queda sin canal operativo. Pendiente estructural del propietario (decidir un canal impersonal). No se inventa sustituto.
5. **PARTE 1 vs pantalla real:** verificado coincidente (toggle, botones, aviso de rechazo). Sin incongruencia. ✓
6. **T-16 vs código:** el texto enviado a la IA no es «el texto al que se le retiraron los datos identificativos» sino una reconstrucción por lista blanca (más estricto: nunca se arma el texto completo). La promesa es más débil que la realidad: se ajusta en v1.2 a la verdad del código. Además las claves de IA se guardan «solo en este navegador» (línea 33937): no estaba declarado; se añade.
7. **Fechas/definiciones:** «el autor» (T-07, T-13, T-14), «el responsable» (T-29), «el Titular» (no usado en v1.1) — tres formas para el mismo sujeto; y «usted» como titular. Unificado en v1.2 con glosario (Sección D).

---

## TC-07 · Hallazgos consolidados (patrón cita → problema → para quién)

| ID | Cláusulas | Cita | Problema | Para quién es riesgo | Criticidad |
|---|---|---|---|---|---|
| H-01 | T-00, T-02, T-07, T-20, T-34, T-36 | Nombre completo, profesión y correo personal del creador en el texto legal + nota personal inicial | Viola el mandato de anonimato total del encargo (§1, máxima prioridad); y expone a la persona natural que responde | Creador (identificado ante todo lector; direccionamiento de reclamos); Usuario (interlocutor único sin canal formal) | **CRÍTICO** — se corrige en este encargo (v1.2 anonimiza) |
| H-02 | T-20, T-34 | «Contacto para cualquier solicitud sobre sus datos: [correo personal]» | Sin canal impersonal no hay forma verificable de ejercer derechos tras anonimizar; el art. 12.d leído exige identificación y canal del responsable | Usuario (derechos sin canal); Desarrollador (incumplimiento del deber de información) | **CRÍTICO** — v1.2 deja el punto «pendiente de decisión del propietario» con marcado visible; gana anonimato (§8.4) |
| H-03 | T-31, T-32 | «es una tarea programada que corre sola… Mientras esa tarea no exista, esta promesa no se está cumpliendo» | Promesa dependiente de instalación manual no verificable desde el repo (AE-013). La cláusula es honesta, pero publicarla así es publicar un incumplimiento | Usuario (datos más allá de 12 meses sin saberlo); Desarrollador (incumplimiento verificable del aviso) | **CRÍTICO** — v1.2 mantiene la redacción condicional honesta y el checklist exige instalar ANTES de publicar |
| H-04 | T-34 | «puede en cualquier momento… suprimir… y revocar esta autorización» citando la Ley 1581 | Cita normativa inexacta (art. 8.e leído es condicional); riesgo de invalidez de la promesa tal como está anclada | Usuario (procedimiento prometido distinto del legal); Desarrollador (aviso con cita errónea) | **ALTO** — corregido en v1.2 con el texto real del art. 8 + compromiso voluntario; [REQUIERE ABOGADO] |
| H-05 | T-13 | «puede retirar el acceso en cualquier momento, sin necesidad de explicar por qué» | Terminación unilateral discrecional; ineficaz de riesgo bajo el referente de consumo (aplicabilidad requiere abogado) | Usuario (pérdida sin causa); Desarrollador (cláusula ineficaz) | **ALTO** — v1.2 la restringe a causas legítimas con comunicación; [REQUIERE ABOGADO] |
| H-06 | T-14, T-16 | «Se entrega tal como está, sin garantía…» (sin cláusula de responsabilidad) | Ni protección proporcionada para el Desarrollador ni salvaguarda de lo irrenunciable para el usuario | Ambos | **ALTO** — v1.2 añade T-38 [REQUIERE ABOGADO] |
| H-07 | T-30 | «En una hoja de cálculo de Google Drive… Google actúa como proveedor del servicio de almacenamiento» | Transferencia internacional no declarada; rol de encargado sin compromisos | Usuario (sus datos en EE. UU. sin saberlo); Desarrollador (ancla art. 26 pendiente) | **ALTO** — v1.2 la declara con ancla «pendiente de fuente»; [REQUIERE ABOGADO] |
| H-08 | — (laguna L3) | «Qué NO se recoge: ningún dato de pacientes» | Cierto para la red, pero el documento calla el procesamiento LOCAL de PHI (caché cifrado con cédula hasheada, registro del día con cédula y hora) — riesgo de leerse como «no se tocan datos de pacientes» | Usuario (transparencia); Desarrollador (principio de veracidad, art. 4.d leído) | **ALTO** — v1.2 añade T-43 |
| H-09 | — (lagunas L1, L4, L5, L6, L7) | — | Base jurídica, seguridad, menores, versionado y procedimiento de derechos sin declarar | Ambos | **MEDIO/ALTO** — v1.2 añade T-39, T-40, T-42, T-44, T-46 y completa T-30 |
| H-10 | T-19 | «Se rigen por la ley colombiana» | Sin foro ni método de resolución de conflictos | Desarrollador (incertidumbre procesal) | **MEDIO** — v1.2 añade T-20bis (en T-20 de PARTE 2) [REQUIERE ABOGADO] |
| H-11 | T-16 | «después de retirarle los datos que identifican al paciente» | La realidad es más estricta (lista blanca: nunca se arma el texto completo) y la clave de IA se guarda solo en el navegador — no declarado | Usuario (transparencia); Desarrollador (subpromete su propia seguridad) | **MEDIO** — v1.2 ajusta a la verdad del código |
| H-12 | T-00/T-02 etc. | «hecha por un colega» + IPS + rol | Tras anonimizar, evitar cualquier combinación rol+entidad que señale a una única persona | Creador | **MEDIO** — cubierto por la redacción genérica de v1.2 |
| H-13 | Global | Sin índice, sin IDs de cláusula, sin glosario, sin historial de versiones, «el autor/el responsable» convivientes | Navegabilidad y citabilidad deficientes; ambigüedad de sujeto | Usuario y abogado revisor | **BAJO** — Sección D de este encargo |
| H-14 | T-36 | Checklist con 3 ✅ y la lectura legal pendiente | Estado desactualizado tras este encargo; los ✅ 1-3 dependen de H-02/H-03 aún abiertos | Propietario | **BAJO** — actualizado en v1.2 a pendientes reales |

**Ningún hallazgo queda sin nivel; ningún nivel sin ejemplo.** Los hallazgos H-01…H-14 alimentan la Sección B (blindaje) y el registro `AUDITORIA/REGISTRO_TERMINOS.md`.

---

## Verificación de criterios (§3.2 del encargo)

- [x] Toda cláusula tiene fila de inventario con ID estable (37 filas, conteo cuadra).
- [x] Todo hallazgo cita texto original + ancla normativa citada o «pendiente de fuente».
- [x] Cero normas afirmadas de memoria: 5 fuentes oficiales leídas (texto en enlace), 6 anclas marcadas pendientes.
- [x] Toda promesa del texto verificada contra el código, con número de línea o caso de suite citado.
- [x] Clasificación completa con los 4 niveles representados.
- [x] Cada hallazgo dice en una línea qué riesgo corre el usuario y qué corre el Titular/Desarrollador.
