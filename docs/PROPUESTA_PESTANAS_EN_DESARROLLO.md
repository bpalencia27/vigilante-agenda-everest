# Propuesta de funcionalidad — botones «Impresión Diagnóstica» y «Conducta» del dock de la HC

> **Estado:** propuesta para evaluación del médico. **No hay código de producto escrito para esto.**
> Lo único implementado en v18.14.7 es la **compuerta de visibilidad** (los dos botones solo
> existen con Modo programador encendido + perfil de desarrollo), no una funcionalidad nueva.
> **Fecha:** 10-sep-2026 · **Rama:** `alt-ide/multi-ide-workflow-2026-09-09`

---

## 1. Qué hacen HOY los dos botones (verificado contra el código)

No abren nada propio: son **gestos**. Hacen clic en el enlace real de la pestaña de Everest.

| Botón | `data-accion` | Qué ejecuta | Guarda |
|---|---|---|---|
| 🖨 Impresión Diagnóstica | `pestana-impresion` | `_vglClicablePestana("impresion diagnostica").click()` → `a#impDiagnostica` | si la pestaña no está montada → AMBAR «ábala desde el editor de la nota»; si el clic no movió la pestaña activa en 300 ms → AMBAR |
| 📋 Conducta | `pestana-conducta` | `_vglClicablePestana("conducta").click()` → `a#conducta` | ídem |

Anclas reales de `VGL_PESTANAS` (L6831): `impresion: { ids: ["impDiagnostica"] }` y
`conducta: { ids: ["conducta"] }` — el id y el texto de `a#conducta` están confirmados contra el
DOM real de Everest (`captura_ordenamiento_paquete_HTA_20260812.json`), no supuestos.

**Por qué esto importa para la propuesta:** el botón ya resuelve el problema de *llegar* a la
pestaña. El valor que falta no es navegación, es **qué poner en esas dos casillas**, que son
exactamente dos de los cuatro destinos del Redactor IA.

---

## 2. El hueco real que la propuesta viene a llenar

`MTR_CASILLAS_REDACTOR` (L50205) declara los cuatro destinos del redactor y su pestaña:

```js
motivo_consulta:   { etiqueta: "Motivo de consulta",  pestania: "Anamnesis" },
enfermedad_actual: { etiqueta: "Enfermedad actual",   pestania: "Anamnesis" },
analisis_plan:     { etiqueta: "Análisis y plan",     pestania: "Impresión Diagnóstica" },
recomendaciones:   { etiqueta: "Recomendaciones",     pestania: "Conducta" },
```

Es decir: **las dos pestañas que el dock ofrece como acceso directo son precisamente donde
aterrizan los dos modos «largos» del redactor** (`analisis_plan` y `recomendaciones`, ambos en
`MTR_MODOS_NOTA_LARGA`, L48568). Y ya existe un inyector de redacción montado *dentro* de la
pestaña de Impresión Diagnóstica (`VGL_IA_INJECTORES`, L9546: `{ id: "vgl-ia-inj-an", modo:
"analisis_plan", pestana: "impresion" }`), con la casilla resuelta por `mtrCasillaAnalisis(d)`.

Lo que hoy **no** existe:

1. No hay inyector equivalente para `recomendaciones` en la pestaña Conducta (la casilla se
   resuelve por `mtrCasillaPorNombre("RecomendacionesMedicas", d)`, L50379, pero no hay botón
   dentro de esa pestaña).
2. Ninguno de los dos botones del dock aporta **contexto clínico** a la casilla: solo navegan.

---

## 3. Propuesta A (recomendada) — «Ir y redactar»: el botón lleva a la pestaña *y* abre el borrador ya en su modo

**Qué vería el médico:** pulsa 🖨 Impresión Diagnóstica y, además de aterrizar en la pestaña,
se abre el modal de redacción **ya en modo «Análisis y plan»** (no en el modo por defecto). Igual
con 📋 Conducta y el modo «Recomendaciones». El borrador se lee y se edita **antes** de entrar a
la historia — el contrato de v17.x.x del inyector («el médico manda, el script sugiere») no cambia.

**Integración con lo que ya existe (cero módulos nuevos):**

| Pieza a reutilizar | Dónde vive | Para qué |
|---|---|---|
| `_vglIrAPestanaYEsperar(modo, doc)` | L50456 | ya hace exactamente esto: clic en la pestaña + espera activa ≤8 s (sondeo 300 ms) a que la casilla esté medible, y devuelve `{ok, el, navego, motivo}` con `motivo: "sin_pestana" \| "clic_fallo"` |
| `MTR_CASILLAS_REDACTOR[modo].pestania` | L50205 | el modo ya sabe a qué pestaña pertenece: no hay que cablear la correspondencia a mano |
| `createIaInjectorUI()` / `VGL_IA_INJECTORES` | L9546 | el modal de redacción ya está resuelto y ya se abre en un modo concreto |
| El gate `mtrEsMedicoAutorizado() && S.iaRedaccion && mtrHayClaveIA()` | L9564 | **obligatorio**: sin clave IA o sin permiso, el botón debe degradar a la navegación de hoy, nunca a un error |

**Contrato de degradación (fail-closed, como el resto del proyecto):**

- Sin permiso de redacción o sin clave IA → el botón hace **exactamente lo de hoy** (navega y ya).
  No se pinta nada nuevo ni se avisa de una función que el médico no tiene.
- Con permiso pero con la pestaña no montada → AMBAR actual, sin intentar redactar.
- Con permiso, pestaña montada y la casilla sin aparecer en 8 s → AMBAR honesto («no logré abrir
  la casilla»), **nunca** un borrador huérfano.

**Coste:** bajo. Es cablear dos botones que ya existen a dos funciones que ya existen. No hay
red nueva, no hay escritura nueva (la inserción sigue siendo el clic explícito del médico en el
modal), y la compuerta de visibilidad de v18.14.7 ya aísla todo esto de producción.

**Riesgo principal:** duplicar el gesto de redacción en dos sitios (inyector dentro de la
pestaña + botón del dock). Mitigación: el dock **no** redacta por su cuenta — llama al mismo
`createIaInjectorUI`/modal, y el inyector es idempotente por id.

---

## 4. Propuesta B (complementaria) — «Contexto a la vista»: el botón muestra el resumen del motor antes de escribir

**Qué vería el médico:** al pulsar el botón, un panel lateral de solo lectura con lo que el motor
clínico ya calculó para ese paciente y que es exactamente el insumo de esas dos casillas:

- **Para «Análisis y plan»** (`mtrTableroClinico`, L41489): programa rector y desplazados
  (`mtrProgramaRector`: ERC > DM2 > HTA, ERC rectora desde G3a), las dos funciones renales con su
  **discordancia** explícita (Cockcroft-Gault *rige vigencias* vs CKD-EPI 2021 *clasifica*),
  `sospechaIra` con el control previo (`egfrPrevio`/`egfrPrevioFecha`: «bajó de 70 a 35 desde el
  1 de febrero» es revisable; «hay sospecha de injuria» a secas, no), y los motivos de remisión a
  nefrología.
- **Para «Recomendaciones»**: los pendientes de PyM/RCV y la **fecha del control del plan** — la
  misma fuente que consume el agendador (la que se corrigió en v18.14.5), no un cálculo paralelo.

**Por qué es valioso y no decorativo:** hoy ese contenido ya existe pero vive en el Panel del
paciente / el aviso de entrada, es decir, **fuera de la pestaña donde el médico está escribiendo**.
La propuesta lo pone al lado de la casilla que lo necesita, en modo lectura, sin insertar nada.

**Integración:** es un panel de solo lectura sobre `mtrTableroClinico(resumen)` (que ya se
recalcula con `mtrCacheResumenBorrar` al perder el foco una casilla vigilada, L50240) + los
pendientes que ya arma `_pendientesUniversales(docId)`. **Cero escritura**, cero red nueva.

**Coste:** medio. Es UI nueva (un panel), con la regla del proyecto de blindaje: si cuelga de
`document.body` y su `color` es de clase, necesita `!important`, y el color computado se verifica
en Chromium contra el CSS real — no basta con que el HTML traiga la clase.

**Riesgo principal:** fatiga visual — justo lo que el médico pidió retirar en v18.14.4. Mitigación:
el panel **solo** se abre con el clic del médico (nunca automático) y se cierra con el mismo botón
o con ✕, con la guarda por paciente que ya usa el widget RCV (`_rcvpCerradoDoc`).

---

## 5. Lo que NO se propone (y por qué)

| Idea | Por qué se descarta |
|---|---|
| Insertar el texto en la casilla automáticamente al pulsar el botón | Viola «la casilla del médico es sagrada» y «el script sugiere, el médico decide». La inserción sigue siendo un clic explícito dentro del modal |
| Que el botón haga `location.reload()` o navegue por URL | El patrón ya establecido (v18.8.9) es replicar el **clic nativo** de Everest, nunca recargar |
| Inventar las anclas de pestaña si no están montadas | Regla del proyecto: casilla vacía antes que dato inventado. Si no está, AMBAR y nada más (fail-closed, ya implementado) |
| Añadir un tercer modo de redacción nuevo | Los cuatro modos de `MTR_IA_MODOS` (L51378) ya cubren las cuatro casillas del registro; uno nuevo sería superficie sin pedido |

---

## 6. Qué haría falta para implementarlo (si el médico aprueba)

1. **Decisión previa del médico**: ¿Propuesta A, B, o A+B? (A sola es la de menor coste y la que
   reutiliza más código ya probado.)
2. Extender `VGL_IA_INJECTORES` con el inyector de `recomendaciones` en la pestaña `conducta`
   (hoy solo existen `enamnesis`/`impresion`).
3. Cablear los dos handlers del dock (L8972 y L9006) a `_vglIrAPestanaYEsperar` + apertura del
   modal en su modo, **preservando** los dos AMBAR actuales como ramas de degradación.
4. Pruebas: casos hermanos en `suite_98_hc_pestanas.js` (que ya mide el gesto y la compuerta) y,
   si se implementa B, verificación de color computado en Chromium contra el CSS real.
5. Mutación verificada por cada cambio de comportamiento, con fila en `tests/INFORME_MUTACIONES.md`.

---

## 7. Verificación de este documento

Este documento no cambia el userscript. El estado del código con el que se escribió se confirma con:

```
node tests/runner.js        # 3.831 pasan, EXIT=0
node tools/compat-check.js  # COMPATIBLE — @version 18.14.7 en los 4 puntos
```
