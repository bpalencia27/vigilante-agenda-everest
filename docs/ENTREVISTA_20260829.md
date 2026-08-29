# Entrevista del 29-ago-2026 — doce decisiones

Origen: seis auditorías corridas ese día (arquitectura, código muerto, rendimiento,
seguridad adversarial, CSS, flujo de datos hacia la IA, promptware, persistencia,
telemetría). Cada hallazgo se le presentó al médico con su medición, y él decidió.

Este documento es el contrato. **Ninguna de estas doce es interpretación mía**: donde hay
comillas, son sus palabras.

---

## Bloque 1 — Integridad de datos

### D1. El JSON que va a la IA se recalcula al pulsar Generar
**Decisión: "Recalcular al pulsar Generar".**

Hoy `mtrAbrirPanelRedaccion` calcula la hoja de hechos **una sola vez, al abrir el panel**,
y el botón Generar reutiliza esa foto. Si el médico deja el panel abierto mientras completa
la historia —uso normal y ya documentado en el código— la nota se redacta con TFG, LDL,
categoría de riesgo y metas de hasta **13 minutos antes** (3 min de TTL de caché + el rato
que el panel lleve abierto). El texto libre sí se relee en cada clic (`libreAhora()`,
arreglo de la v17.6.22); el resto no.

Se recalcula desde la caché vigente antes de armar el JSON. Es extender a los datos
numéricos lo que ya se hace con el texto.

### D2. Cédulas con ceros a la izquierda: unificar y migrar
**Decisión: "Sí, unificar y migrar lo ya guardado".**

`normalizeKey` quita los ceros iniciales; `extractDoc` **no**. Un documento que Everest
renderiza como `0005150076` en un sitio y `5150076` en otro genera **dos entradas distintas**
en la memoria del paciente, y consume dos de los 80 cupos. Se unifica la clave y, al
arrancar, se fusionan los duplicados que ya existan en el equipo, quedándose con lo más
reciente de cada campo.

### D3. Respaldo de la memoria local: exportar e importar
**Decisión: "Sí, exportar e importar con advertencia".**

Hoy no existe ninguna forma de respaldar lo que el script sabe de los pacientes. Un borrado
de datos del navegador lo destruye sin recuperación.

**Condición innegociable que el propio médico aceptó al elegir:** el archivo contiene
**cédulas y datos clínicos reales** y no puede sanitizarse (la cédula *es* la clave). Lleva
advertencia explícita antes de descargar: solo en equipo institucional cifrado, nunca por
correo ni WhatsApp, y se borra cuando ya no se necesite. Al importar, fusión por marca de
tiempo campo a campo — nunca pisar un dato más nuevo con uno más viejo.

---

## Bloque 2 — Telemetría

### D4. La evidencia no se da por entregada sin acuse
**Decisión: "Reintentar la evidencia al abrir".**

Al cerrar la pestaña, el script despacha la cola por `sendBeacon`, que **por diseño del
navegador no puede leer acuse** y devuelve `true` siempre. Las filas se borran igual. Para
métricas de uso da lo mismo; para **fraude, error y resumen**, que el propio código protege
como evidencia, no. Esas tres dejan de borrarse por esa vía y se reintentan al arrancar por
el camino que sí confirma entrega. El servidor ya deduplica por lote.

---

## Bloque 3 — El prompt de la IA

### D5. Recuperar la regla de exhaustividad y retirar el bloque muerto
**Decisión: "Sí, recuperarla y retirar el bloque muerto".**

`MTR_REDACCION_SYS` está confirmado muerto (cero referencias). Pero contenía una regla que
el prompt vivo perdió: *"No omitas hallazgos clínicamente relevantes que sí estén en los
HECHOS"*. Hoy el prompt **prohíbe mucho** (no inventes) y **casi no exige** (no omitas). Se
recupera esa regla en el prompt vivo y se retiran las 15 líneas muertas.

### D6. Blindar el prompt de casillas cortas, con ejemplo
**Decisión: "Sí, y además añadir un mini-ejemplo".**

`MTR_BASE_CASILLA_SYS` es el *fallback* cuando no se reconoce el modo, y es el único de los
cuatro que **no lleva** la distinción entre "documentado como NO" y "no se preguntó" — que
es la regla número uno de este proyecto — ni la prohibición de juicios de valor. Se añaden
ambas. Y un mini-ejemplo entrada→salida en los modos que hoy no tienen ninguno: los modelos
pequeños copian patrones mucho mejor de lo que siguen instrucciones abstractas, y la
rotación de modelos incluye variantes *flash-lite* desde el primer intento.

**Condición técnica:** el ejemplo **no puede llevar cifras**, o `mtrVerificarCifrasIA` las
marcaría como inventadas por no estar en la hoja.

---

## Bloque 4 — Clínico

### D7. La albuminuria entra como eje: A2 sube a ALTO
**Decisión: "A2 (30-300) sube a ALTO por sí sola".**

Hoy el RAC solo existe como tres umbrales sueltos y el paso 2 no lo mira. Un no-diabético
con TFG 80 y RAC 100 sale *moderado*; pasará a *alto*.

**Coste conocido y aceptado:** mueve los **36 vectores dorados con `rac:45`** del corpus de
991. Exige una tercera excepción declarada en `suite_45`, en el estilo de las dos que ya
existen. **El corpus no se regenera nunca**: viene del Copiloto Python y su `sha256_origen`
es el contrato.

### D8. Sin RAC: se busca la última reportada en Athenea
**Decisión, verbatim: "se debe determinar la última RAC reportada en athenea".**

**Hallazgo posterior que reduce el trabajo:** eso **ya funciona**. `fetchAtheneaLabs` busca
el año en curso y los dos anteriores, y `_ultimaFechaPorAnalito` se queda con el más
reciente por analito guardando `{fecha, valor}`. Lo que falta es más estrecho: `val()`
**tira la fecha**, así que la clasificación no puede decir "esta RAC es de hace dos años"
ni distinguir "no hay RAC" de "hay RAC". Se hace viajar la fecha y se declara el faltante.

### D9. Umbrales estrictos en los tres ejes
**Decisión: "quítelo: estricto en los tres" — LDL, HbA1c y glicemia.**

Se retira el margen del +15 %. Franjas que hoy se callan y pasarán a marcarse: LDL
55,1–63,2 / 70,1–80,5 / 100,1–115 / 116,1–133,4 según categoría; **HbA1c 7,1–8,05 %**;
**glicemia 131–149**.

### D10. Gravedad: sin el +30 %, pero la regla renal se queda
**Decisión: "Sin +30%, pero la regla renal se queda".**

Desaparece el escalón por porcentaje. Sobrevive la regla clínica: riesgo alto o muy alto,
**TFG < 45 por CKD-EPI 2021** y menor de 75 años → grave. El médico añadió: *"solo ckd epi
2021 para este paso"* — verificado, ya recibe `erc.egfr`, que es CKD-EPI 2021.

### D11. Regla KDIGO: sin repetir perfil lipídico con TFG < 60
**Decisión, verbatim: "en pacientes con ckd epi 2021 menor a 60 tfg no repitamos perfil
lipídico al 50% por falla terapéutica como lo dicen las guías kdigo"**, y *"cockcroft gault
solo aplica a nivel administrativo por lo que todo el script se debe alinear a estas
reglas"*.

Fundamento: **KDIGO recomienda explícitamente no usar el LDL como objetivo ni repetir el
perfil de rutina en ERC** ("fire and forget"). El resto de lo lipídico sigue rigiéndose por
el **Consenso Colombiano de Dislipidemias 2024**, que es de donde salen las metas
55/70/100/116 — decisión suya: *"el resto será regido según el consenso colombiano de
dislipidemias [por el momento]"*.

**Choque que hay que medir antes de entregar:** la jerarquía del proyecto dice que CERO
VENCIDOS manda sobre la logística. Si esta guarda hiciera vencer un examen, **manda la
medición** y se vuelve a preguntar. Y se declara: un examen que no se pide sin explicación
es indistinguible de un olvido del script.

**Verificado:** `erc.egfr` ya es CKD-EPI 2021 y `erc.crcl` es Cockcroft-Gault; las reglas de
dosificación (`mtrReglaLmwh`, `mtrReglaGabapentinoide`) usan C-G, que es correcto y **no se
toca**. Queda auditar las mezclas, p. ej. `erc.crcl != null ? erc.crcl : erc.egfr`.

---

## Bloque 5 — Diseño

### D12. El widget de exámenes se rediseña: los cuatro problemas
**Decisión: los cuatro a la vez.**

1. **Cabe muy poco antes de desplazar** — medido: 287 px de contenido contra un tope de
   260 px, con solo 6 exámenes.
2. **No se distingue de un vistazo lo urgente** — vencido y "toca pedirlo" se parecen
   demasiado.
3. **Ocupa mal el espacio / se ve apretado.**
4. **Está en mal sitio o estorba.**

**Corrección de alcance que hay que dejar escrita:** los tres rechazos de diseño anteriores
del médico eran del **módulo de Agendamiento**, no de este widget. Yo generalicé mal ese
"no" y lo usé para argumentar en contra de rediseñarlo. Él lo corrigió: *"en ningún momento
dije que era el de los exámenes"* y *"obviamente el widget de exámenes también hay que
arreglarlo ya que está muy mal diseñado"*.

La propuesta "Bento" que se midió y descartó **no vale como intento**: fallaba por
especificidad (la regla nunca se aplicaba) y, forzada, empeoraba justo el problema 1
(filas de 40 → 52 px). Ver `docs/propuesta_bento/HALLAZGO.md`.

---

## Orden de ejecución

Decidido por criterio técnico a petición del médico (*"usted decide el orden"*): primero lo
que puede dañarle datos o hacerle firmar una nota con cifras viejas; después lo clínico, que
exige medir contra los 991 vectores dorados; el widget al final, con su propio pase de
diseño.

| # | Entrega | Decisiones |
|---|---|---|
| 1 | JSON recalculado al Generar | D1 |
| 2 | Cédulas unificadas + migración | D2 |
| 3 | Evidencia de telemetría con acuse | D4 |
| 4 | Prompt: exhaustividad, casillas cortas, ejemplo, retirar muerto | D5, D6 |
| 5 | Respaldo export/import | D3 |
| 6 | La fecha de la RAC viaja | D8 |
| 7 | Albuminuria: A2 → alto | D7 |
| 8 | Umbrales estrictos + gravedad | D9, D10 |
| 9 | Regla KDIGO TFG<60 + alineación C-G | D11 |
| 10 | Rediseño del widget de exámenes | D12 |

Cada una: reproducción o medición previa, prueba nueva, mutación verificada, bump cuádruple
y fila en `tests/INFORME_MUTACIONES.md`. Línea base al cerrar la entrevista: **2.595**.
