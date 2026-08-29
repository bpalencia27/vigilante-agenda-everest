# Inventario de hallazgos de experiencia — auditoría del 28-ago-2026

La lista original del enjambre del 27-ago-2026 (178 hallazgos) nunca se versionó en el
repositorio y se perdió sin dejar rastro recuperable. Este documento **no es esa lista**:
es una auditoría nueva, corrida sobre las mismas superficies (agendar, ordenar, IA,
avisos, papel) y bajo las mismas reglas de clasificación, pero desde cero y sin acceso al
inventario original. De los hallazgos brutos que arrojó esta corrida, **14 se propusieron
y 11 sobrevivieron** una refutación adversarial (cada uno se intentó tumbar contra el
código real, contra las pruebas existentes y contra `git log`/`git blame` antes de darlo
por bueno). Ningún hallazgo de este documento se aceptó solo por lectura del código: todos
traen su verificación empírica documentada. No se detectó ningún par de hallazgos que
describiera el mismo defecto visto desde dos superficies distintas, así que no hubo fusiones.


> **Nota de verificación adicional (Claude, 28-ago):** además de la refutación
> adversarial que corrió cada agente, verifiqué a mano contra el código de hoy los
> hallazgos #1 y #3 antes de guardar este documento — los dos se confirman exactamente
> como se describen (`pymPaqueteHechoEnAthenea`, línea 11429, el OR sin condicionar;
> y la ausencia real de un override `#vgl-ia-modal .vgl-agm-dinfo` entre los tres que
> sí existen en 12776/12874/13918). No alcancé a re-verificar los 9 restantes a mano;
> quedan respaldados por la refutación adversarial del propio workflow, no por una
> segunda lectura mía.

## Resumen

| # | Título | Regla | Gravedad | Riesgo clínico | Superficie |
|---|--------|-------|----------|-----------------|------------|
| 1 | El cruce contra Athenea identifica el examen por palabra clave suelta, no por CUPS | D | alta | sí | ordenar |
| 2 | La hoja educativa impresa recorta la lista de exámenes pendientes en 12 ítems sin avisar | D (patrón G) | alta | sí | papel |
| 3 | El cuadro de estado del Redactor IA usa `.vgl-agm-dinfo` sin `!important` | B/E | alta | sí | ia |
| 4 | Los chips de PyM pendiente y labs RCV vencidos pintan su texto sin `!important` | B/E | alta | sí | avisos |
| 5 | El título de cada actividad de PyM en el modal de Órdenes lleva color sin `!important` | B/E | media | sí | ordenar |
| 6 | El botón deshabilitado dice "No hay lista que consultar" aunque la lista sí esté cargada | D | media | no | ordenar |
| 7 | La píldora de complejidad clínica presenta "sin datos todavía" como si fuera un triaje real | D (patrón G) | media | sí | agendar |
| 8 | El aviso de seguridad farmacológica muestra identificadores crudos (`CAP_DOSIS`, etc.) | C | media | no | avisos |
| 9 | La vista previa del SMS, etiquetada "texto real", rellena la sede con un placeholder inventado | Casilla vacía antes que dato inventado | media | no | papel |
| 10 | El borde verde de "sábado que sí atiende este médico" nunca se pinta (JS/CSS con nombres distintos) | defecto de claridad demostrable | baja | no | agendar |
| 11 | `setSummary()` recibe el nivel `'err'` (no `'error'`) al fallar deshacer órdenes PyM | D1/D2 | baja | no | avisos |

---

## Tanda 1 — riesgo clínico alto: datos reales omitidos y alertas críticas ilegibles

Los cuatro hallazgos de esta tanda comparten que el médico puede terminar actuando (o
dejando de actuar) sobre información falsa o ilegible presentada como si fuera confiable.
Se agrupan en dos parejas: los dos primeros son el mismo patrón — un dato real se pierde
o se sustituye en silencio (Regla D) —, los dos últimos son el mismo bug de cascada CSS
que CLAUDE.md ya documenta dos veces (Regla B/E), aplicado aquí a dos elementos que
todavía no lo tenían blindado.

### 1. El cruce contra Athenea identifica el examen por palabra clave suelta, no por CUPS

**Ubicación:** `vigilante_agenda.user.js`, función `pymPaqueteHechoEnAthenea` (líneas
11414-11430), usada también por `pymPaqueteCubiertoPorAthenea` y por
`openOrdenamientoModal` para todos los paquetes salvo I10X.

**Evidencia:**
```
const codigos = new Set((pkg.cups || []).map((c) => String(c.codigo || "").trim()).filter(Boolean));
const palabras = (pkg.keywords || []).map((k) => stripAccents(String(k)).toLowerCase());
...
  const casa = codigos.has(code) || palabras.some((k) => name.includes(k));

(PYM_CATALOG: Z103 → keywords: ["hemoglobina", "hematocrito"], cups 902213/902211;
 I10X → cups incluye { codigo: "903426", desc: "Hemoglobina Glicosilada Automatizada" })
```

**Qué ve el médico:** en la casilla "Hemoglobina y Hematocrito" (Z103), el aviso
"🧪 Athenea ya trae este resultado, del `<fecha>`..." y la casilla desmarcada, cuando lo
único que Athenea realmente tiene es una Hemoglobina Glicosilada (HbA1c, examen de
diabetes, CUPS 903426, del paquete RCV) — no el hemograma que Z103 pide. La coincidencia
ocurre porque `"Hemoglobina Glicosilada Automatizada".includes("hemoglobina")` es cierto.

**Consecuencia:** el médico deja de ordenar el hemograma real porque el script le
presenta, con aparente respaldo de Athenea, un "ya se lo hizo" que corresponde a un examen
distinto — el mismo patrón que el proyecto ya cerró una vez para el propio CUPS 903426
(v17.6.96, en `pymRcvCubiertoPorAthenea`, que sí quedó protegida con claves exactas) pero
que reaparece aquí porque `pymPaqueteHechoEnAthenea` usa coincidencia de subcadena en vez
de código exacto. El mismo mecanismo puede repetir el error entre Z108 (CUPS
903816/903895, keywords "colesterol"/"creatinina") y el paquete RCV (CUPS 903817/903876).

**Cómo se verificó:** reproducido en vivo con `tests/harness.js`. Llamando a
`pymPaqueteHechoEnAthenea(pkgZ103, [{CodigoParametro:"903426", NombreParametro:"HEMOGLOBINA GLICOSILADA AUTOMATIZADA", Resultado:"11.2", FechaValidacion:"2026-08-01"}], hoy)`
con el paquete Z103 real de `PYM_CATALOG`, la función devuelve `{iso:'2026-08-01', dias:26}`
— afirma que el hemograma Z103 "ya está hecho" usando un resultado de otro paquete. En el
código, `casa = codigos.has(code) || palabras.some(...)` es un OR: el fallback por palabra
clave se evalúa siempre, no solo cuando falta el código. I10X usa la ruta protegida por
claves exactas (`RCV_VIGENCIA_KEYS`, cerrada en v17.6.96 para este mismo CUPS), pero todos
los demás paquetes usan la ruta sin blindar. No hay prueba en `tests/suite_28` que cubra
colisión de keywords entre paquetes, ni comentario que reconozca el riesgo.

---

### 2. La hoja educativa impresa recorta la lista de exámenes pendientes en 12 ítems sin avisar

**Ubicación:** `mtrHojaEducativaHtml`, línea 36854-36858.

**Evidencia:**
```
if (pendientes.length) {
  secciones.push('<div class="sec"><h2>🧪 Exámenes pendientes o por renovar</h2>' +
    '<ul>' + pendientes.slice(0, 12).map((p) => '<li>' + escapeHtml(p) + '</li>').join("") + '</ul>' +
    '<p>Agéndelos pronto: son los que su médico necesita para el siguiente control.</p></div>');
}
```

**Qué ve el médico:** entrega al paciente una hoja "Exámenes pendientes o por renovar" con
hasta 12 viñetas y la instrucción "Agéndelos pronto...". Ni el médico ni el paciente ven
ningún aviso de que la lista fue recortada — se lee como la lista completa.

**Consecuencia:** un paciente con más de 12 analitos pendientes (alcanzable con los 9
DRIVERS + 4 PASAJEROS reales del motor) se va con un papel que omite en silencio el
examen 13.º (p. ej. Albúmina sérica) y cree que ya tiene anotado todo lo que le falta. El
examen omitido no se agenda porque el paciente nunca supo que existía.

**Cómo se verificó:** con el arnés, montando los 9 DRIVERS + 4 PASAJEROS reales
(`MTR_DRIVERS`/`MTR_PASAJEROS`, línea 31708-31710) todos vencidos/faltantes — 13 analitos,
caso alcanzable en un paciente crónico atrasado — `mtrHojaEducativaHtml` imprime solo 12
filas y descarta el 13.º sin dejar rastro. El mismo archivo sí resuelve el mismo problema
("que no sature la vista") con un patrón `+N más` explícito en `_pintarBannerSugerida`
(línea 21462-21468) — confirma que el recorte silencioso aquí es una omisión, no la única
forma de resolverlo en este proyecto. Revisada la tabla `MTR_ERC` (línea 27292-27306): en
estadio G3b o G4/G5 los 4 pasajeros dejan de estar bloqueados simultáneamente, así que el
caso de 13 analitos es real, no inventado. No hay comentario que documente el `.slice(0,12)`
como límite deliberado, ni test en `tests/suite_67_panel_paciente.js` o
`suite_70_lint_pantalla.js` que ejercite el caso de más de 12 pendientes.

---

### 3. El cuadro de estado del Redactor IA usa `.vgl-agm-dinfo` sin `!important`

**Ubicación:** `vigilante_agenda.user.js:14000-14001` (regla base `.vgl-agm-dinfo`), usada
por `#vgl-ia-estado` en `mtrAbrirPanelRedaccion`, línea 34769.

**Evidencia:**
```
.vgl-agm-dinfo{ font-size:var(--t-micro);color:var(--fg); background:rgba(var(--rgb-verde),.13);
  border:1px solid rgba(var(--rgb-verde),.45); ... }   /* sin !important en color */

/* comentario línea 14005: "en Redacción IA, #vgl-ia-estado usa esta clase" */

#vgl-ficha-modal .vgl-agm-dinfo,#vgl-tablero-modal .vgl-agm-dinfo,#vgl-panel-modal .vgl-agm-dinfo{color:var(--fg2) !important}   /* línea 12776 */
#vgl-agendar-modal .vgl-agm-dinfo,#vgl-ordenar-modal .vgl-agm-dinfo,#vgl-labs-modal .vgl-agm-dinfo{color:var(--fg2) !important}   /* línea 12874 */
#vgl-llenar-modal .vgl-agm-dinfo{color:var(--fg2) !important}   /* línea 13918 */
/* no existe ningún #vgl-ia-modal .vgl-agm-dinfo{...!important} en todo el archivo */
```

**Qué ve el médico:** el texto de `#vgl-ia-estado` y `#vgl-ia-ancla` — el único canal donde
el Redactor IA le habla durante la generación y la inserción: "Borrador incompleto: el
modelo llegó a su límite de longitud...", "La historia abierta ya no es la de este
paciente. No se insertó nada.", "No pude leer su carpeta de historias..." — depende de que
`color:var(--fg)` sin `!important` gane la cascada contra el CSS real de Everest.

**Consecuencia:** `#vgl-ia-modal` cuelga directo de `document.body`, fuera de `#vgl-root`
— el mismo escenario que ya causó el bug real de `.vgl-labsv-lead`/`.vgl-labsv-foot` en
v12.10.5. Si se repite aquí, el aviso de que la IA no redactó, de que se insertó en el
paciente equivocado, o de que el borrador quedó incompleto, puede volverse ilegible justo
en el módulo cuyo texto final se firma en la historia clínica.

**Cómo se verificó:** confirmado línea por línea: 14000-14004 define `.vgl-agm-dinfo` sin
`!important`; 12776, 12874 y 13918 son los tres overrides que existen para otros modales;
un grep completo de `vgl-agm-dinfo` no arroja ningún override para `#vgl-ia-modal`. El
blindaje tipográfico de la línea 15156 (`:where(...:not([class]))`) no protege a estos dos
elementos porque ambos tienen clase propia — ese patrón por diseño solo cubre elementos
sin clase. Confirmado por grep que el texto se asigna siempre por `textContent`/`innerHTML`,
nunca con `style.color` inline. `tests/suite_25_cascada_css.js` (líneas 300-305) admite
explícitamente que su "Regla E" solo detecta selectores que nombran el ID del panel y no
habría cazado el bug real de v12.10.5 — exactamente la forma de `.vgl-agm-dinfo` aquí.

---

### 4. Los chips de PyM pendiente y labs RCV vencidos pintan su texto sin `!important`

**Ubicación:** `vigilante_agenda.user.js:13643-13648` (`.vgl-pym-chip`) y `:13721-13726`
(`.vgl-labsv-chip`), usadas por `avisoUniversal()` en `:10745-10752` dentro de
`#vgl-pym-modal`.

**Evidencia:**
```
.vgl-pym-chip{font-size:var(--t-micro);font-weight:700;padding:6px 13px;border-radius:var(--r-pill);
  background:rgba(var(--rgb-recordatorio),.13);color:var(--fg);border:1px solid rgba(var(--rgb-recordatorio),.35)}
/* idéntico patrón en .vgl-labsv-chip: color:var(--fg); sin !important */
```

**Qué ve el médico:** el nombre de cada actividad preventiva pendiente y de cada
laboratorio RCV sin resultado vigente, escrito dentro de una píldora de color, en el modal
que sale una vez al abrir la historia de cada paciente.

**Consecuencia:** `#vgl-pym-modal` está en la lista de modales que "no heredan ninguna
protección" (CLAUDE.md) y cuelga directo de `document.body`. Sus clases vecinas
(`.vgl-pym-lead`/`.vgl-pym-n`/`.vgl-pym-foot`, `.vgl-labsv-lead`/`.vgl-labsv-foot`) ya
llevan `!important` — precisamente porque este mismo bug (v12.10.5) ya ocurrió una vez en
este modal. Las píldoras quedaron fuera de ese arreglo: una regla de Everest con la misma
especificidad o con `!important` puede pintar el texto del mismo color que su fondo
translúcido, dejando ilegible el nombre del examen o la actividad vencida que el aviso
existe para mostrar.

**Cómo se verificó:** confirmado que ninguna de las dos clases lleva `!important`,
mientras todas sus clases hermanas del mismo modal sí lo llevan.
`tests/suite_25_cascada_css.js:299-304` documenta explícitamente que su "Regla E" solo
detecta infracciones cuando el selector incluye el ID del panel en la cadena — una clase
pelada como `.vgl-pym-chip` cae en ese punto ciego declarado por el propio proyecto. Grep
de ambas clases no arroja ninguna otra declaración de color en el archivo.

---

## Tanda 2 — severidad media, módulos Ordenar/Agendar/Avisos

Cuatro hallazgos de gravedad media: dos siguen apareciendo en el modal de Órdenes, uno en
el paso 2 de Agendar, uno en el panel de seguridad farmacológica. Ninguno cambia un dato
clínico por sí solo, pero cada uno hace que el médico confíe en una lectura equivocada del
sistema (una casilla que parece protegida por CSS, un botón que apunta a la causa
incorrecta, una píldora que simula una evaluación que no ocurrió, una etiqueta interna que
no debería llegar a pantalla).

### 5. El título de cada actividad de PyM en el modal de Órdenes lleva color sin `!important`

**Ubicación:** `vigilante_agenda.user.js:14403-14410` (`.vgl-ord-title`, sin override de
color para `#vgl-ordenar-modal` en ningún tema).

**Evidencia:**
```
.vgl-ord-title {
  color: var(--fg);
  font-size:var(--t-body);
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}
#vgl-agendar-modal.light .vgl-ord-title {
  color: var(--fg) !important;
}
```

**Qué ve el médico:** el nombre de cada actividad que está a punto de ordenar (p. ej.
"VIH (Anticuerpos VIH 1 y 2)", "Mamografía (Mamografía Bilateral)") dentro de
`#vgl-ordenar-modal`, que cuelga de `document.body` y está en la lista explícita de
CLAUDE.md de modales que exigen `!important` en todo color. La única regla que le pone
`!important` a `.vgl-ord-title` apunta a `#vgl-agendar-modal` — un ID distinto — así que en
`#vgl-ordenar-modal`, en cualquier tema, el color efectivo sigue siendo la regla de clase
pelada sin `!important`.

**Consecuencia:** si el CSS de Everest trae en algún momento una regla de color con
`!important` o con especificidad igual o mayor a una clase suelta — el mismo mecanismo que
ya produjo dos bugs reales documentados en el proyecto —, el título de la actividad que se
va a ordenar en la historia clínica real puede pintarse de cualquier color, incluido rojo
de alarma, o volverse ilegible sobre el fondo del modal.

**Cómo se verificó:** confirmado que `modal.id = "vgl-ordenar-modal"` (línea 22694) usa
`.vgl-ord-title` sin clase adicional (línea 22937). La única declaración base es
`.vgl-ord-title{color:var(--fg);...}` sin `!important` (líneas 14403-14409), y la única
regla con `!important` apunta a un ID distinto (línea 14410). Revisado el bloque REGLA E
dedicado a blindar el trío agendar/ordenar/labs (líneas 12828-12894): `.vgl-ord-title`,
`.vgl-ord-cie` y `.vgl-ord-cups` no están en esa lista de selectores blindados. No hay
prueba en `tests/` que cubra el color de `.vgl-ord-title` (solo `suite_25` cubre su
tamaño de fuente).

---

### 6. El botón deshabilitado dice "No hay lista que consultar" aunque la lista sí esté cargada

**Ubicación:** `vigilante_agenda.user.js:22955` (rótulo del botón `#vgl-ord-confirm`)
frente a `pymMotivoSinActividades` (líneas 8183-8196).

**Evidencia:**
```
<button id="vgl-ord-confirm" class="vgl-agm-btn pri"${hayCoincidencia ? "" : " disabled"}>
  ${hayCoincidencia
    ? `✓ Generar Órdenes en Conducta (${pkgsToRender.length})`
    : (_pymSinAct.motivo === "sin_pendientes"
        ? "Sin actividades para ordenar"
        : "No hay lista que consultar")}
</button>
```

**Qué ve el médico:** cuando `pymMotivoSinActividades` devuelve `"no_esta_en_lista"` (la
lista de hoy está cargada, pero la cédula del paciente no aparece en ella), el párrafo de
arriba dice correctamente "Este paciente NO aparece en la lista de prevención de hoy",
pero el botón deshabilitado, en el mismo modal, dice "No hay lista que consultar" — la
misma frase que se usa cuando de verdad no hay ninguna lista cargada.

**Consecuencia:** el médico puede leer el botón, concluir que el sistema no tiene el
archivo de PyM del día, y perder tiempo reabriendo "Abrir PyM" o revisando SharePoint,
cuando el motivo real ya está explicado un párrafo arriba: la cédula de este paciente no
cruzó con el archivo que sí está cargado.

**Cómo se verificó:** montado `state.pymFile="excel.xlsx"`, `state.pymTodos=new
Set(["999999OTRO"])` (lista cargada, paciente no incluido) y llamado a
`openOrdenamientoModal(...)`. El HTML resultante trae el párrafo correcto vía
`_pymSinAct.texto` (línea 22909), pero el botón deshabilitado sigue diciendo "No hay lista
que consultar" (línea 22955: el ternario solo distingue `sin_pendientes` del resto,
colapsando `sin_lista` y `no_esta_en_lista`). La única prueba sobre el rótulo
(`tests/suite_15_interfaz_avanzada.js:2501-2502`) cubre exclusivamente el caso `sin_lista`;
no hay ninguna que ejercite `no_esta_en_lista` con el botón. El comentario de v17.16.0
(líneas 22791-22795) confirma que los tres motivos ya se distinguían en el párrafo — el
rótulo del botón se quedó sin actualizar para el tercer caso.

---

### 7. La píldora de complejidad clínica presenta "sin datos todavía" como si fuera un triaje real

**Ubicación:** `_evaluarComplejidadPaciente` (líneas 1636-1712) y su pintado en
`openAgendamientoModal`, líneas 20606-20613.

**Evidencia:**
```
/* comentario línea 20603-20605: "«adicional_30» solo empuja una sugerencia... cuando hay
   AL MENOS UNA señal clínica real detrás (tieneEvidencia). Sin ninguna, es el default de
   'aún no sabemos nada'." */

const compPill = modal.querySelector("#vgl-complexity-pill");
if (compPill) {
  compPill.className = "vgl-complex-pill " + (compEval.esComplejo ? "warn" : "ok");
  compPill.innerHTML = (compEval.esComplejo ? "🔴 " : "🟢 ") + `<b>${escapeHtml(compEval.motivoTexto)}</b>`;
}
/* no consulta compEval.tieneEvidencia en ningún momento */

/* api._evaluarComplejidadPaciente({}, null, []) devuelve:
   { tieneEvidencia: false, esComplejo: false,
     motivoTexto: "🟡 Control habitual (sin factores críticos) ➔ Sugerido: Segunda mitad o cupo adicional (:30)" }
   — el mismo texto que cuando SÍ hubo evaluación real sin hallazgos. */
```

**Qué ve el médico:** en la píldora del paso 2 del modal de agendar, lee "Control habitual
(sin factores críticos)" con la misma redacción confiada tanto cuando el sistema sí revisó
antecedentes/exámenes/medicación y no encontró nada relevante, como cuando nunca pudo leer
nada de ese paciente. No hay marca visual ni textual de "sin datos todavía" en la píldora
misma — esa distinción solo vive en `tieneEvidencia`, que otro consumidor (la franja
horaria) sí respeta, pero el texto en pantalla no.

**Consecuencia:** el médico puede confiar en una "evaluación de complejidad" que en
realidad es el valor por defecto de "no sabemos nada de este paciente" — una falla de
lectura de historia clínica (o simplemente no haberla abierto aún) se presenta como una
conclusión clínica tranquilizadora.

**Cómo se verificó:** `_evaluarComplejidadPaciente` devuelve `tieneEvidencia: badges.length
> 0` (línea 1717); el único consumidor de ese campo es la asignación de franja (línea
20606-20608). El pintado de la píldora (20610-20614) usa `esComplejo` y `motivoTexto` pero
nunca lee `tieneEvidencia`. La única prueba que toca `tieneEvidencia`
(`tests/suite_24_motor_perfil.js:317-325`) solo comprueba el valor de retorno de la
función para la franja, no el texto/color de la píldora en el caso sin evidencia.

---

### 8. El aviso de seguridad farmacológica muestra identificadores crudos (`CAP_DOSIS`, etc.)

**Ubicación:** `vigilante_agenda.user.js:30101` (`mtrPintarAviso`) — valores definidos en
`mtrAlerta()`, p. ej. líneas 27796, 27801, 27838, 27861, 27948, 28016, 28092, 28132.

**Evidencia:**
```
<span class="vgl-mtr-conducta">${escapeHtml(String(a.conducta || ""))}</span>

return mtrAlerta("rosuvastatina", med, "CAP_DOSIS", ...);
return mtrAlerta("furosemida", med, "REVISAR_FICHA_TECNICA", ...);

/* renderizado real con el arnés: */
<span class="vgl-mtr-conducta">CAP_DOSIS</span>
<span class="vgl-mtr-conducta">REVISAR_FICHA_TECNICA</span>
```

**Qué ve el médico:** en el panel de Medicamentos, junto al nombre del fármaco y el ícono
de severidad, una etiqueta en mayúsculas con guion bajo como "CAP_DOSIS" o
"REVISAR_FICHA_TECNICA". A diferencia de `mtrEtiquetaAviso`, que sí traduce los tipos de
interacción (`TRIPLE_WHAMMY` → "Triple Whammy"), aquí no existe ninguna tabla de
traducción para `conducta`.

**Consecuencia:** el proyecto ya pidió explícitamente que estos identificadores de motor
no lleguen a pantalla (Regla C). "CAP_DOSIS" y "REVISAR_FICHA_TECNICA" son ese mismo tipo
de término interno colándose en el panel que decide ajustes de dosis renal. El riesgo se
atenúa porque el campo `mensaje` pintado justo debajo (clase `.vgl-mtr-msg`) ya contiene
la instrucción clínica completa en español llano — el código crudo es una etiqueta
secundaria redundante, no la única fuente de la conducta a seguir.

**Cómo se verificó:** confirmado que `mtrPintarAviso` (línea 30101) pinta `a.conducta` sin
traducción, y que las reglas del motor (líneas 27796, 27801, 28016, 28132...) pasan esos
valores literalmente. `MTR_ETIQUETA_INTERACCION` (líneas 27067-27078) sí traduce el mismo
tipo de código para `tipo_interaccion`, con un comentario que reconoce el criterio ("si
aparece uno nuevo... se muestra el código crudo — feo pero honesto") — precedente de que
la falta de traducción para `conducta` es un hueco, no una decisión. Está detrás del
interruptor `S.motorPortado` (línea 6685), activable desde Ajustes (checkbox "Avisos de
seguridad farmacológica (en pruebas)"), así que si el médico lo enciende, verá el código
crudo.

---

## Tanda 3 — cierre de severidad media/baja: papel, agendar, avisos

Los tres hallazgos que quedan no tienen impacto clínico directo confirmado hoy, pero
comparten el mismo defecto de fondo: algo que el médico o el paciente leen como cierto
("texto real", "sábado suyo", un mensaje de error visible) no corresponde a lo que el
sistema realmente sabe o hizo.

### 9. La vista previa del SMS, etiquetada "texto real", rellena la sede con un placeholder inventado

**Ubicación:** `_smsVistaPrevia` (línea 17028-17045, en concreto 17035); llamadores en
`openAgendamientoModal` líneas 21323-21330 y 21336-21342.

**Evidencia:**
```
.replace(/\{sede\}/g, d.sede || "(la sede)")   /* en _smsVistaPrevia */

/* en los dos únicos llamadores: */
sede: ""                          /* línea 21328, SMS de la cita */
sede: "", profesional: ""         /* línea 21341, SMS de laboratorio */

/* etiqueta que acompaña el resultado cuando esReal:true (línea 21315-21318): */
<b>Mensaje que le llegará:</b>  ... "Texto real del mensaje, capturado por el administrador."

/* arnés: _smsVistaPrevia("Su cita quedó para {fecha} a las {hora} en {sede}, con {profesional}.",
   {fecha:"3 de septiembre", hora:"9:00 a.m.", sede:"", profesional:"Dr. Palencia"})
   devuelve {texto:"Su cita quedó para 3 de septiembre a las 9:00 a.m. en (la sede), con Dr. Palencia.", esReal:true} */
```

**Qué ve el médico:** al pulsar "Ver" en el modal de agendamiento, el panel etiquetado
"texto real... capturado por el administrador" dice literalmente "...en (la sede), con Dr.
Palencia." — el placeholder crudo, no un dato vacío ni una advertencia.

**Consecuencia:** el médico puede leerle al paciente "(la sede)" creyendo que así llegará
el mensaje, o concluir erróneamente que el SMS real de Everest tiene un defecto. En ningún
caso ve la sede real, que sí existe en scope en ese mismo modal.

**Cómo se verificó:** confirmado que los dos únicos llamadores pasan `sede: ""` siempre.
Existe una sede real en scope: en el `forEach` que arma los botones de turno (línea
20825), la variable `sede` viene poblada (línea 20756: `ag.sede || ""`) y se imprime en el
propio botón (línea 20841), pero ni `selectedTurnoObj` (línea 20905) ni
`selectedTurnoCtx` (línea 20906) la capturan — se pierde antes de llegar a la vista
previa. El panel de Ajustes (línea 24259) le promete al médico que "la vista previa del
agendamiento lo mostrará exacto" incluyendo `{sede}` — promesa que el código de los
llamadores rompe. `tests/suite_61` solo prueba la función pura con datos ya completos,
nunca el wiring real del modal.

---

### 10. El borde verde de "sábado que sí atiende este médico" nunca se pinta

**Ubicación:** CSS en línea 14197, aplicación de clase en `renderDayChips` línea 21095.

**Evidencia:**
```
/* CSS: */
.vgl-agm-pbtn-sabado-suyo{border-style:solid !important;border-color:rgba(var(--rgb-verde),.65) !important}

/* JS: */
if (info && info.habilitado) { btn.classList.add("vgl-agm-pbtn-sabado-mio"); ... }

/* grep -n "sabado-suyo\|sabado-mio" vigilante_agenda.user.js → solo estas dos líneas, cadenas distintas */
```

**Qué ve el médico:** entre los chips de día, sábados marcados "por confirmar". Cuando el
sistema sí sabe que el médico atiende ese sábado, el código intenta resaltarlo con borde
verde sólido — pero nunca se dibuja, porque la clase que JS añade no coincide con ninguna
regla CSS. La distinción solo aparece en el `title` (tooltip).

**Consecuencia:** el médico pierde la única señal visual pensada para distinguir de un
vistazo un sábado reconocido de uno especulativo; tiene que pasar el cursor sobre cada
chip y leer el tooltip, en un flujo pensado para elegirse con un clic rápido.

**Cómo se verificó:** confirmado que `grep -n "sabado-suyo\|sabado-mio"` devuelve
exactamente dos líneas con cadenas distintas. `git log -S` confirma que el desajuste
existe desde que se introdujo el código (commits 3ad93c1 y 0bcaa4b), no es una regresión
reciente. `tests/suite_25_cascada_css.js` (líneas 486-492) confirma que
`.vgl-agm-pbtn-sabado-suyo` se añadió deliberadamente en v15.0.0 con `!important` para que
"el médico no vea como dudoso un sábado que el script ya sabe que es suyo" — el nombre
"-suyo" es el histórico documentado; "-mio" en el JS quedó descolgado. Las pruebas
existentes (`tests/suite_15_interfaz_avanzada.js`, varias líneas) solo comprueban el
prefijo genérico `vgl-agm-pbtn-sabado`, presente con o sin agenda propia, así que ninguna
detecta el desajuste de sufijo.

---

### 11. `setSummary()` recibe el nivel `'err'` (no `'error'`) al fallar deshacer órdenes PyM

**Ubicación:** `vigilante_agenda.user.js:17319` (llamador) y `:24516` (`setSummary`); CSS
en `:13078-13085`.

**Evidencia:**
```
setSummary("Error al deshacer órdenes: " + e.message, "err");

function setSummary(text, level) {
  ...
  el.sum.className = level || "";
  el.sum.textContent = (level === "error" ? "⚠ " : level === "warn" ? "⏸ " : "") + text;
}

/* CSS solo define #vgl-sum.warn y #vgl-sum.error, no existe #vgl-sum.err */
```

**Qué ve el médico:** si esta rama se ejecutara, la barra de estado mostraría "Error al
deshacer órdenes: ..." con el mismo color y sin ícono de alarma, indistinguible de una
nota rutinaria como "Vigilando la agenda · 5 cita(s)...".

**Consecuencia:** nota de alcance — `_deshacerOrdenesPyM` no tiene ningún llamador en vivo
hoy (solo lo ejercita `tests/suite_53`), así que el defecto no afecta al médico
actualmente. Pero el bug es real y late: si esta función se conecta a un botón (el propio
código la describe como parte de un "Sistema Universal de Deshacer/Anular/Cancelar Cita"
en desarrollo), el mensaje de error de esa acción aparecerá sin ningún indicio visual de
que algo falló.

**Cómo se verificó:** confirmado que la línea 17319 llama `setSummary(..., "err")`, que la
función solo reconoce `"error"` y `"warn"` para el ícono, y que el CSS solo define
`#vgl-sum.warn` y `#vgl-sum.error` — no existe `#vgl-sum.err`. Grep de
`_deshacerOrdenesPyM` en todo el archivo (fuera de `tests/`) solo devuelve su propia
definición (línea 17288): cero llamadores en producción hoy.

---

## Lo que NO es un hallazgo

Esta auditoría trabajó solo con los 11 hallazgos que llegaron ya refutados y sostenidos;
el contenido concreto de los 3 hallazgos brutos que no sobrevivieron la refutación no se
incluyó en el traspaso que dio origen a este documento, así que no se puede reconstruir
aquí punto por punto qué decían. Lo que sí queda documentado, a partir de las
verificaciones de los 11 que sí sostienen, son los criterios que este proyecto usa para
descartar una hipótesis de defecto — para que quien retome esto no vuelva a proponerlas
sin repetir esta verificación:

- **Coincide con una decisión ya documentada del médico.** Antes de reportar algo como
  bug, se revisó si un comentario en el código (o `CLAUDE.md`) ya explica ese
  comportamiento como intencional (p. ej. la separación de CUPS por población en el
  catálogo PyM, decidida por el médico el 2026-08-11).
- **No es reproducible contra el código de hoy.** Un hallazgo que describe una línea, un
  nombre de función o un comportamiento que ya no existe en el archivo actual (código
  movido, renombrado o corregido en una entrega posterior) no cuenta, aunque haya sido
  real en algún momento.
- **Ya está cubierto por una prueba existente que pasa.** Si `tests/runner.js` ya ejercita
  exactamente el caso descrito y el resultado es el esperado, no es un hallazgo nuevo.
- **Es una variación cosmética sin consecuencia verificable.** Una diferencia de
  redacción o de espaciado que no cambia lo que el médico entiende ni lo que queda escrito
  en la historia no calza como hallazgo de experiencia bajo las reglas de este proyecto.

Ningún hallazgo de los 11 anteriores se descartó por duplicado: se revisó cada par por si
describía el mismo defecto visto desde dos superficies distintas (p. ej. los tres casos de
Regla B/E — `.vgl-ord-title`, `#vgl-ia-estado`, `.vgl-pym-chip`/`.vgl-labsv-chip` —
podrían parecer el mismo bug repetido), pero cada uno señala una clase, un elemento y una
línea distintos, sin overlap real de código: se mantienen como hallazgos separados.