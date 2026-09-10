# SUPER PROMPT — Auditoría, blindaje y edición de Términos y Condiciones
## Vigilante de Agenda v18.3.x · «Un documento legal que diga exactamente lo que el software hace, sin revelar a quién lo escribió»

> Documento de encargo. Lo ejecuta **un agente por tarea TC-##, una sesión por tarea**
> (Jules/Claude/Gemini bajo `jules.md`).
> Objeto por defecto: `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md` del repo. El superprompt
> es reutilizable para cualquier documento de términos y condiciones del proyecto.
> **Este encargo produce BORRADORES de ingeniería documental, no asesoría jurídica:**
> toda cláusula nueva o modificada queda marcada para revisión final de un abogado
> colegiado y del propietario. Ninguna certificación de este encargo sustituye ese paso.

---

# 0. REGLAS DEL ENTORNO (heredadas, sin excepción)

- **Cero PHI** y cero datos personales de terceros en documento, informes o commits.
- **Casilla vacía antes que dato inventado**, aplicado a la LEY: ninguna norma, artículo
  o vigencia se cita de memoria. Toda cita normativa lleva fuente verificable; lo no
  verificable en este entorno se marca **«pendiente de fuente»** (precedente AE-014,
  que ya dejó cuatro fuentes normativas pendientes). Nombrar una norma como
  *candidata a verificar* está permitido; afirmar que el texto la cumple, no.
- **El documento promete, el código cumple:** cada promesa del texto se verifica contra
  el código real (precedente AE-013: la purga a 12 meses prometida «no está instalada de
  forma verificable»). Una promesa sin implementación es un hallazgo, no una frase.
- El objeto se edita **en su propio archivo** (nunca una copia paralela); si el código
  referencia el documento (grep antes de tocar estructura: p. ej. la compuerta de
  consentimiento), cualquier cambio de comportamiento exige prueba + mutación.
- Banco: `node tests/runner.js` ≥ baseline de la FASE 0 si el diff toca algo que el
  banco observa; PROHIBIDO REFORMATEAR archivos ajenos a la tarea.
- Comentarios y entregables en español; registro solo-append con IDs únicos.

---

# 1. MANDATO DE ANONIMATO TOTAL DEL CREADOR — regla transversal de máxima prioridad

**Vigencia:** en el documento de términos Y en TODOS los productos de este encargo
(registro, informes, propuestas de cláusulas, tablas de cambios, nombres de archivo
nuevos, mensajes de commit, metadatos de exportación). Sin excepciones y por encima de
cualquier otra instrucción de este superprompt.

**Prohibido incluir, directa o indirectamente:**

| Tipo | Ejemplos vetados |
|---|---|
| Identificadores directos | Nombre propio · seudónimo/handle (GitHub u otro) · correo · número de documento · teléfono · firma · foto |
| Identificadores indirectos | Referencias cruzadas a su autoría («creado por el autor del script v18…») · agradecimientos que lo nombren · la combinación rol + entidad + sede + horario que lo señale como única persona |
| Huellas de proceso | Metadatos de autor en exportaciones (DOCX/PDF: campo `Author`) · rutas de archivo con su nombre · enlaces a perfiles personales |

**Sustitutos obligatorios:** «el Titular», «el Desarrollador», «la Parte responsable».
La mención de la entidad/plataforma ya existente en el documento NO es una violación
mientras no identifique al creador como persona.

**Verificación de cierre (bloquea la entrega si falla):** antes de dar por terminada
cualquier tarea, `grep` sobre el documento y los entregables con los tokens
identificativos conocidos del creador (nombre, handle, dominio personal). Cero
coincidencias o el trabajo vuelve. La comprobación se documenta en el registro con el
comando usado.

---

# 2. FASE 0 — CONGELAR CONTEXTO (tarea TC-00)

1. Identificar el documento objetivo, su versión/fecha interna y su relación con el
   código (grep de referencias cruzadas).
2. Congelar baseline: hash del archivo, banco (si aplica), rama de trabajo.
3. Crear `AUDITORIA/REGISTRO_TERMINOS.md` (dueño del formato: solo append, fila
   `TC-###` = `| ID | Sección del superprompt | Hallazgo/Cambio | Evidencia | Criticidad | Estado |`).
4. Publicar la tabla de tareas: TC-01…TC-10 (auditoría) → TC-20… (blindaje) →
   TC-30… (mejoras) → TC-40… (edición) → TC-90 (validación final). Una tarea = un diff.

---

# 3. SECCIÓN A — AUDITORÍA INTEGRAL (TC-01…TC-10)

**Objetivo:** radiografía completa del documento: cumplimiento normativo, cláusulas
abusivas, lagunas e incongruencias, con informe clasificado por criticidad.

### 3.1 Pasos de ejecución

1. **TC-01 · Inventario cláusula a cláusula:** numerar cada cláusula/párrafo con ID
   estable (`T-01`, `T-02`…). El inventario se congela: todos los hallazgos posteriores
   citan por ID, jamás por «la cláusula de arriba».
2. **TC-02 · Mapa normativo:** para cada norma APLICABLE según el tipo de plataforma,
   una fila con: ámbito, por qué aplica (o «no aplica, motivo»), fuente citada o
   **pendiente de fuente**:
   - Globales/genéricas: **RGPD** (UE) · **CCPA/CPRA** (California) · **LGPD** (Brasil).
   - Sector salud (esta plataforma procesa datos de salud): **HIPAA** como referente ·
     **Ley 1581/2012 + Decreto 1377/2013** (habeas data, Colombia) · **Ley 23/1981** y
     **Res. 1995/1999** (historia clínica) · normativa de habilitación vigente.
   - Consumo/contratos: estatuto del consumidor aplicable (Colombia: Ley 1480/2011 —
     *verificar fuente*) y doctrina de cláusulas abusivas.
   - Lo que no pueda citarse HOY queda «pendiente de fuente» y SUBE su criticidad de
     trabajo (no se cierra sin el dato).
3. **TC-03 · Cumplimiento por cláusula:** cruzar cada `T-##` contra el mapa normativo;
   marcar: cumple / no cumple / vacío / no aplica.
4. **TC-04 · Detección de cláusulas abusivas o nulas de riesgo:** limitaciones de
   responsabilidad que la ley prohíbe (dolo/culpa grave), renuncias de derechos
   irrenunciables, modificación unilateral sin aviso, cesión de datos sin base — cada
   una con la norma que la tornaría abusiva (citada o pendiente).
5. **TC-05 · Lagunas:** ausencias críticas: base jurídica del tratamiento, finalidades,
   retención por tipo de dato, derechos del usuario y cómo ejercerlos, transferencias,
   medidas de seguridad, menores, cambios de versión del propio documento.
6. **TC-06 · Incongruencias internas:** contradicciones entre secciones, promesas vs
   código (método AE-013: grep + suite si existe), plazos que no cuadran, definiciones
   usadas antes de declararse.
7. **TC-07 · Informe de hallazgos:** consolidar en `AUDITORIA/INFORME_AUDITORIA_TERMINOS.md`,
   cada hallazgo con: cláusula `T-##` · cita textual · problema · ancla normativa (o
   pendiente) · **criticidad**:

| Nivel | Significado | Acción exigida |
|---|---|---|
| **CRÍTICO** | Incumplimiento con riesgo legal inmediato o promesa falsa al usuario | Se corrige en este encargo |
| **ALTO** | Cláusula abusiva/nula de riesgo o laguna en dato sensible | Se corrige con revisión de abogado marcada |
| **MEDIO** | Incongruencia, desactualización, ambigüedad con riesgo | Se corrige o se documenta la decisión |
| **BAJO** | Estilo, legibilidad, estructura | Pasa a Secciones C/D |

### 3.2 Criterios de calidad (validación de la sección)

- [ ] Toda cláusula tiene fila de inventario con ID estable (el conteo cuadra).
- [ ] Todo hallazgo cita texto original + ancla normativa citada o «pendiente de fuente».
- [ ] Cero normas afirmadas de memoria (auditable: cada cita tiene fuente o marca).
- [ ] Toda promesa del texto está verificada contra el código, con comando o cita.
- [ ] Clasificación completa: ningún hallazgo sin nivel; ningún nivel sin ejemplo.
- [ ] Informe legible por un no abogado: cada hallazgo dice en una línea qué riesgo
      corre el usuario y qué corre el Titular.

### 3.3 Exigencia de explicación

Cada hallazgo se redacta con el patrón **«cita → por qué es problema → para quién»**.
Sin el «para quién», el hallazgo no entra al informe.

---

# 4. SECCIÓN B — BLINDAJE LEGAL (TC-20…)

**Objetivo:** incorporar cláusulas de protección robustas, actualizadas y adaptadas a
la actividad real de la plataforma, que mitiguen riesgos sin prometer lo que el código
no hace.

### 4.1 Pasos de ejecución

1. Priorizar por criticidad del informe A: CRÍTICO → ALTO → MEDIO. Un CRÍTICO por tarea.
2. Por cada cláusula nueva o modificada, redactar el **expediente de cláusula**:
   - Riesgo concreto que mitiga (vinculado a un hallazgo `TC-###`).
   - Texto propuesto (en el idioma del documento).
   - Ancla normativa citada o «pendiente de fuente».
   - **Resumen en lenguaje llano** de una línea (qué significa para el usuario).
   - Verificación de coherencia con el código: la cláusula describe comportamiento
     existente, o crea obligación nueva (→ si es nueva, va a la cola del propietario:
     primero se implementa, luego se promete; jamás al revés).
3. Cláusulas de blindaje típicas a evaluar (solo si aplican y con expediente):
   limitación de responsabilidad proporcional (sin tocar lo que la ley prohíbe
   limitar), ausencia de garantía sobre servicio de terceros (Everest/Athenea son
   ajenos), resolución de conflictos y jurisdicción/ley aplicable, cambios del
   documento con aviso y versionado, indemnidad, naturaleza de la herramienta
   (asistencia, no sustituto del criterio médico), tratamiento de datos por tipo y
   base, medidas de seguridad reales (las que el código tiene, p. ej. carpeta cifrada
   AES-GCM, purga), y supervisión humana de toda decisión.
4. Marcar en el documento cada cláusula nueva/modificada con `[NUEVA TC-##]` /
   `[MODIFICADA TC-##]` (el marcado se retira solo en la validación final TC-90).

### 4.2 Criterios de calidad

- [ ] Ninguna cláusula promete lo que el código no hace (verificado, con cita).
- [ ] Ninguna cláusula limita responsabilidad donde la ley aplicable lo prohíbe — las
      dudosas quedan «requiere abogado», no se afirman.
- [ ] Cada cláusula tiene expediente completo (riesgo, texto, ancla, llano, código).
- [ ] El documento resultante no genera contradicciones nuevas (re-cruzado contra el
      inventario de A).
- [ ] Cero tokens identificativos del creador (grep del §1).

### 4.3 Exigencia de explicación

El expediente de cláusula ES la explicación: quien lee el informe entiende qué riesgo
cerraba cada texto y por qué esa redacción y no otra. Toda alternativa descartada se
nombra con su motivo (una línea).

---

# 5. SECCIÓN C — SUGERENCIAS DE MEJORA (TC-30…)

**Objetivo:** recomendaciones prácticas de legibilidad y transparencia sin perder
rigor legal.

### 5.1 Pasos de ejecución

1. **Diagnóstico de legibilidad:** por sección: longitud de oración media, densidad de
   tecnicismos sin definir, voz pasiva, dobles negaciones. Dato, no opinión.
2. **Capa de lenguaje llano:** proponer resumen inicial («en 10 líneas, qué es esto y
   qué datos toca»), glosario de términos jurídicos usados, y versión simplificada de
   cada cláusula de alto impacto — manteniendo la cláusula formal como texto vinculante
   y declarando expresamente esa jerarquía (la versión llana informa, no sustituye).
3. **Transparencia:** secciones nuevas a evaluar: qué datos exactos toca la herramienta
   y dónde se guardan (local cifrado vs. remoto), cuánto duran, qué NO hace la
   herramienta (no decide, no agenda sola, no sustituye al médico), cómo ejercer
   derechos, cómo se entera de cambios, y una sección de «promesas verificables»
   alineada con lo que el banco de pruebas certifica.
4. Cada recomendación entra como fila del registro con: beneficio esperado, riesgo
   legal residual, esfuerzo. Las que el propietario deba decidir van a su cola.

### 5.2 Criterios de calidad

- [ ] El diagnóstico de legibilidad es medible y reproducible.
- [ ] Ninguna simplificación cambia el significado jurídico (cotejo par a par con la
      cláusula formal; si lo cambia, se descarta y se documenta).
- [ ] La jerarquía texto vinculante vs. resumen llano está declarada en el propio
      documento.
- [ ] Toda sección de transparencia refleja comportamiento real del código.

### 5.3 Exigencia de explicación

Cada recomendación responde: qué mejora, para quién (usuario final/Titular/regulador) y
qué riesgo introduce. Recomendación sin contrapeso no se acepta.

---

# 6. SECCIÓN D — EDICIÓN FORMAL (TC-40…)

**Objetivo:** corrección gramatical, estructura navegable, lenguaje jurídico unificado
y coherencia total, sin alterar el sentido de ninguna cláusula.

### 6.1 Pasos de ejecución

1. **Barrido gramatical y tipográfico:** ortografía, puntuación, concordancia,
   mayúsculas legales consistentes, formato de listas y citas normativas uniforme.
2. **Estructura navegable:** jerarquía de títulos numerada estable, índice con anclas
   al inicio, ID de cláusula visible (`T-##`) para citabilidad interna y externa.
3. **Unificación de lenguaje:** una sola forma por concepto (glosario de términos del
   documento: «Usuario», «Datos de salud», «Titular», «Plataforma»…); tiempos
   verbales coherentes; una sola convención para vigencias y fechas.
4. **Pasada de coherencia final:** releído íntegro buscando contradicciones
   introducidas por las secciones B/C; verificación de que cada término definido se usa
   como fue definido y cada referencia interna apunta a un ID existente.
5. Cada edición formal se registra en la **tabla de cambios**: texto original → texto
   editado → tipo (gramática/estructura/unificación) → por qué no altera el sentido.

### 6.2 Criterios de calidad

- [ ] Tabla de cambios completa: cada línea editada rastreable a su antes/después.
- [ ] Índice con anclas funciona (cada enlace lleva a la cláusula correcta).
- [ ] Glosario sin sinónimos rivales (grep de cada término: una sola forma vigente).
- [ ] Relectura íntegra firmada en el registro (quién, cuándo, qué buscaba).
- [ ] Cero alteración de sentido: si una corrección gramatical cambia la
      interpretación posible, NO se aplica (se escala como hallazgo, no como edición).

### 6.3 Exigencia de explicación

La tabla de cambios con la columna «por qué» es obligatoria: no existe edición sin
razón escrita. El usuario del superprompt debe poder reconstruir el razonamiento de
cada modificación leyendo solo la tabla.

---

# 7. VALIDACIÓN FINAL Y CIERRE (TC-90)

1. **Re-auditoría:** el informe de la Sección A se re-corre contra el documento final:
   cada hallazgo debe estar corregido, documentado como decisión del propietario, o
   explicitado como pendiente (con su dueño: abogado / propietario / fuente normativa).
2. **Coherencia promesa-código-banco:** las «promesas verificables» de C se contrastan
   con las suites que las certifican; si una promesa no tiene suite, se declara.
3. **Anonimato:** grep final del §1 sobre documento + todos los entregables + nombres
   de archivos nuevos. Cero coincidencias, comando pegado en el registro.
4. **Criterios de cierre del encargo:**
   - [ ] Secciones A-D ejecutadas con sus checklists en verde.
   - [ ] Registro `TC-###` íntegro y solo-append.
   - [ ] Tabla de cambios D completa con racional de cada línea.
   - [ ] Expedientes de cláusula B completos y marcados para abogado.
   - [ ] Documento final legible, navegable, sin PHI ni identidad del creador.
   - [ ] Declaración de pendientes explícita (nada queda en silencio).
5. **Certificación:** «blindaje documental completado en nivel X», donde X declara qué
   quedó sujeto a revisión de abogado o a decisión del propietario. La fusión/despliegue
   final decide el propietario, siempre.

---

# 8. PROTOCOLO ANTE LA DUDA

1. ¿Fuente normativa inaccesible o no citable? «Pendiente de fuente» + sube criticidad.
2. ¿La cláusula obliga a cambiar el software? Primero la cola del propietario con
   opciones; el documento jamás promete por adelantado.
3. ¿Corrección formal cambia el sentido? No es edición formal: es hallazgo (Sección A).
4. ¿Chocan anonimato y otra exigencia? Gana el anonimato (§1); se documenta el conflicto.
5. ¿Hallazgo que repite un AE-### o TC-### previo? Se referencia, no se re-describe.
