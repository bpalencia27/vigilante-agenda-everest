# Mejoras pendientes — verificadas contra el código real, 22-ago-2026

Usted pidió "todas las demás mejoras" sin especificar cuáles, y me pidió armar esta lista
con lo que ya he visto. En vez de reciclar `PENDIENTES.md` (15-ago), `AUDITORIA_20260820.md`
o `DECISIONES_PENDIENTES_20260820.md`, volví a comprobar cada hallazgo de esos tres
documentos **contra el archivo de hoy** (v17.5.0) — porque entre el 20 y el 22 de agosto
salieron 15 versiones (v16.2.9 → v17.5.0) que ya cerraron la enorme mayoría de lo que esos
documentos dejaron abierto.

## Lo que ya no hace falta pedirle: está resuelto

De los 14 hallazgos de la auditoría del 20-ago y las 18 decisiones de esa misma entrevista,
**quedan seis genuinamente abiertos** — el resto (todo diabético como riesgo alto, el
contexto que no se perdía de pestaña en pestaña, el LDL basal, los sábados, los festivos por
Ley Emiliani, la ventana de toma 14–21, la vara única para "vencido", el aviso de red que ya
no se presenta como hecho, el uroanálisis con el vocabulario real, la caché que ya no se
mezclaba entre pacientes, el cartel rojo que ya no se consumía sin pintarse, la RAC "> 300"
que ya no perdía contra un "25" viejo, y varios más) ya está construido, probado y en el
CHANGELOG. No lo repito aquí para no hacerle releer lo que ya cerró.

## Las seis que siguen abiertas

### 1. La bandera "Educación indicada" nunca se enciende — verificado en el código

`mtrEducationFlags()` (línea 31486) devuelve un **objeto** — `{alarmas, dieta, actividad}` —
pero los dos sitios que lo leen para armar la nota con IA (líneas 28823 y 29872) preguntan
`Array.isArray(r.educationFlags)`, que para un objeto siempre es falso. Resultado: la señal
que debería recordarle reforzar dieta/actividad/signos de alarma en el paciente indicado
**nunca llega a la redacción**, desde que existe. No es una decisión suya pendiente — es un
error de tipo, listo para corregir en cuanto usted diga que sí.

**Esfuerzo:** bajo (cambiar el `Array.isArray` por leer las tres claves). **Recomiendo:** sí.

### 2. La "hoja de hechos" que lee la IA cita tres claves que no existen en ningún otro lugar del archivo

`MTR_HECHOS_FACTORES` (línea 28757) incluye `"dislipidemia"`, `"antecedenteFamiliarPrematuro"`
y `"ercPrevia"` — verificado que **ninguna de las tres se escribe en ningún otro punto de las
32.000 líneas del archivo**. Un paciente con dislipidemia documentada o antecedente familiar
de evento cardiovascular prematuro no le llega ese dato a la IA al redactar Análisis y Plan,
aunque usted lo haya marcado en Everest — la clave real que sí se calcula es
`ecvAterescleroticaEstablecida`, ya en la misma lista, y las otras tres parecen sobras de una
versión anterior del clasificador.

**Esfuerzo:** bajo-medio (mapear a las claves reales o retirarlas). **Recomiendo:** sí.

### 3. La meta de HbA1c individual: la tubería quedó lista en v16.4.0, el campo en la Ficha nunca se construyó

El propio CHANGELOG de v16.4.0 lo dice: *"El campo editable por paciente en la Ficha llega
en la próxima versión sobre este cimiento"* — y no llegó. El código ya sabe mostrar *"meta
individual de este paciente"* (línea 17250) si alguna vez `metaHba1c` trae un valor distinto
al general, pero **nada en todo el archivo escribe ese valor**: no hay casilla, ni en la
Ficha ni en Ajustes. Sigue siendo 7,0 % fijo para todos — el caso que usted mismo señaló (el
paciente de 85 años con 7,6 %) se sigue marcando como fuera de meta.

**Esfuerzo:** medio (sí es una casilla nueva, no solo lógica). **Pendiente de usted:** ¿la
quiere en la Ficha del Panel, o en Ajustes como un dato más duradero del paciente?

### 4. El código de sede del laboratorio (378) sigue escrito a mano en seis sitios

Verificado: `sedeId=378` aparece literal en las líneas 14883, 14965, 15000, 19187, 19895 y
20283 — los seis puntos donde el asistente consulta o agenda turnos de laboratorio. Es
exactamente lo que ya se había anotado el 20-ago: si algún colega de otra sede instala el
mismo script, sus pacientes quedarían agendados en el laboratorio de la suya.

**Esfuerzo:** bajo (una sola constante de instalación, con 378 de fábrica). **Recomiendo:**
sí, aunque hoy no le urja — es barato hacerlo bien antes de que alguien más lo instale.

### 5. El corte de "cosecha" de exámenes sigue en 25 %, la recomendación de subirlo a 33 % quedó sin responder

Línea 28534: `margen <= a.vigenciaDias * 0.25`. La idea (adelantar a la misma toma un examen
vigente si le queda poco por delante, para ahorrarle un viaje al paciente meses después) es
suya de antes; el corte concreto —25 % o 33 %— fue una recomendación mía en la entrevista del
20-ago que usted nunca alcanzó a responder.

**Esfuerzo:** trivial (una constante). **Pendiente de usted:** ¿25 %, 33 %, u otro número?

### 6. Entre cinco y seis relojes de frescura distintos, sin unificar

Contados en el código de hoy: medicamentos 5 min, laboratorios/órdenes/signos
vitales/demográficos 10 min (ya comparten uno solo, eso sí quedó unificado), resumen clínico
20 min, tabla oficial de la IPS 30 min, y el nuevo caché de pre-consulta de la v16.6.0 a 6
horas. La recomendación del 20-ago de bajarlos todos a un único reloj de 10 minutos sigue sin
decidirse. No es un defecto — cada plazo se eligió por algo — pero si alguna vez ve una fecha
de control apoyada en un resumen que se calculó con datos que el propio script ya consideraba
viejos, esta es la causa más probable.

**Esfuerzo:** bajo-medio, y es más una decisión de diseño que una corrección. **Pendiente de
usted:** ¿vale la pena la consistencia, o prefiere dejar cada reloj ajustado a su propio dato?

---

## Aparte, no es código: seguridad

`PENDIENTES.md` (15-ago) seguía marcando sin hacer la rotación de la credencial de Athenea
que quedó expuesta en el historial de git, y si el repositorio fue público alguna vez. Esto
no lo puedo verificar desde aquí —es una acción suya, fuera del código— así que se lo
recuerdo una sola vez por si sigue pendiente: si ya lo resolvió, ignore este párrafo.

---

**Cómo responder:** igual que con el documento del 20-ago, basta con decirme los números —
por ejemplo, *"1, 2 y 4 sí; en la 3 prefiero Ajustes; la 5 déjala en 30 %; la 6 no le veo
urgencia"* — y arranco por ahí.
