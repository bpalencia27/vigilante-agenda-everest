# SUPERPROMPT — Rediseño visual del Vigilante: enjambre con auditores por capas, jurado y juez final

> ### ⚙️ CÓMO USAR — *esta caja NO forma parte del prompt*
>
> ```bat
> cd /d E:\Vigilante_Agenda
> git worktree add E:\VA_ui_rediseno -b ui/rediseno-v15 feat/motor-portado
> copy PROPIEDAD_ARCHIVOS.md E:\VA_ui_rediseno\
> copy SUPERPROMPT_REDISENO_UI.md E:\VA_ui_rediseno\
> ```
>
> **La base es `feat/motor-portado`, no `claude/v14-continuacion`** — y es deliberado.
> `feat/motor-portado` está estrictamente adelante (`25f2f99` → `f70dc37` → `5114c2c`) e incluye
> una superficie de interfaz **nueva** (la capa de presentación del motor, clases `vgl-mtr-*`).
> Rediseñar sobre la base vieja dejaría esa superficie sin tocar y garantizaría un conflicto de
> fusión brutal justo dentro del bloque CSS de 2.100 líneas, que es un único template literal.
>
> Abre Antigravity sobre `E:\VA_ui_rediseno`, escribe `/teamwork-preview` y pega:
>
> ```
> Lee los archivos SUPERPROMPT_REDISENO_UI.md y PROPIEDAD_ARCHIVOS.md que están en la
> raíz de este proyecto y ejecuta exactamente lo que dicen. El superprompt es tu
> ORIGINAL_REQUEST: cópialo a .agents\ORIGINAL_REQUEST.md antes de empezar.
> La FASE 1 termina en un CHECKPOINT DE PREVIEW que el médico aprueba ANTES de que
> nadie toque vigilante_agenda.user.js. No hay excepción a eso.
> ```
>
> **Modelo: Gemini 3.7 Flash** (salido el 13-ago-2026). `thinking_level` **por rol**, tabla en §4.
> El valor por defecto es `medium` — **los roles de juicio hay que subirlos a `high` a mano.**
>
> **Antes de lanzar:** este enjambre modifica `vigilante_agenda.user.js`. Por el contrato de
> propiedad de archivos, eso lo hace **solo el tronco**, y solo uno a la vez. No lo corras en
> paralelo con otra rama que toque el userscript.

---

# Rediseño visual profesional del Vigilante de Agenda

Actúa como **director de arte y desarrollador frontend senior especializado en CSS**, dirigiendo
un equipo de subagentes. El encargo: revisar el código de principio a fin y dejar la interfaz
**estéticamente moderna, profesional y agradable a la vista**, al nivel de un producto de
software serio — no de un script interno.

Y hay una condición que gobierna todo lo demás:

> ## Esta interfaz se usa durante consultas médicas reales, a contrarreloj.
> ## Que sea bonita es el encargo. Que siga siendo **legible bajo presión** es el requisito.
> ## Cuando choquen, gana la legibilidad — y lo documentas, no lo resuelves por tu cuenta.

---

## 0. Qué estás rediseñando

`vigilante_agenda.user.js` — un userscript de Tampermonkey de ~16.800 líneas en un único IIFE,
inyectado dentro de **Everest**, el EHR de una IPS colombiana. Lo usa un médico durante la
consulta, en ~20 máquinas de consultorio.

Medido, no de memoria (`git grep -o` sobre el archivo, corre los comandos tú mismo antes de
citarlos):

```
~2.100 líneas de CSS en un solo template literal   (style.textContent = ` … `, desde ~línea 7473)
246 clases .vgl-* únicas
82 ids #vgl-* únicos
2 temas completos (oscuro / claro) + modo auto
1 modo .perf que apaga efectos pesados
```

Superficies visuales, todas dentro de tu alcance:

| Superficie | Qué es |
|---|---|
| Panel principal (`#vgl-root`) | La lista de citas del día. Lo que el médico mira todo el turno. |
| Dock (`#vgl-dock`) | El botón flotante minimizado, con contador. |
| Modales de agenda / laboratorios / ordenar | Flujos de escritura clínica. |
| Toasts y alertas (`#vgl-modal`) | Avisos de fraude, inasistencia, última llamada. |
| Banner PyM | Recordatorio de actividades de promoción y prevención. |
| Ajustes | Panel de configuración, ya bastante denso. |
| **Capa de presentación del motor** (`vgl-mtr-*`) | Avisos de seguridad farmacológica. **Nace apagada** tras la bandera `S.motorPortado`; se enciende desde Ajustes. Rediséñala igual — está escrita y probada. |
| Ventana emergente y HUD (`#vgl-sp`) | Canales de aviso alternativos. `#vgl-sp` vive **fuera** de `#vgl-root`, sin tokens ni `.perf` — trátalo aparte. |

---

## 1. Lo que NO se toca — y por qué cada cosa

Esta sección es la que separa un rediseño profesional de un desastre. Léela entera antes de
proponer una sola paleta.

### 1.1 — Los cinco colores NO son una paleta. Son un código clínico.

```js
const COLORS = { VERDE:"#10B981", AMBAR:"#D97706", ROJO:"#E54D42", AZUL:"#2563EB", MORADO:"#9333EA" };
```

| Color | Significado exacto |
|---|---|
| **VERDE** | Llegó a tiempo |
| **MORADO** | Pre-alerta: ~1 minuto para confirmar o pierde la cita |
| **ÁMBAR** | "Sin presentarse" ≥ 6:00 |
| **ROJO** | Fraude: pasó de Ámbar a "En Sala" |
| **AZUL** | Normal |

Puedes **afinar** los valores (contraste, armonía, versión por tema) siempre que:

1. **Los cinco sigan siendo mutuamente distinguibles de un vistazo**, incluidos los dos temas.
2. **Rojo siga leyéndose como alarma y verde como bien.** No los "unifiques" hacia una paleta de
   marca. No conviertas el ámbar en un amarillo pastel que se confunda con el verde.
3. Sigan siendo distinguibles para **deuteranopía y protanopía** (~8% de hombres). Verde/rojo es
   justo el eje que falla. Si dos alertas solo se distinguen por color, añade una segunda señal
   —forma, icono, peso— **sin quitar el color**.

Hay pruebas que exigen paridad de tokens claro/oscuro y un token por cada color de `COLORS`
(Regla D y Regla F de la suite 25). Cambiar `COLORS` sin cambiar los tokens tumba el banco.

### 1.2 — Los dos silencios opuestos

```
.vgl-mtr-sinjuicio   → "no pude leer qué toma el paciente"
.vgl-mtr-limpio      → "leí todo y no hay hallazgos"
```

Son **clínicamente opuestos** y hay una prueba que exige que nunca coincidan. Si tu rediseño los
pinta parecido —dos grises elegantes, digamos— conviertes "no sé" en "todo bien" a los ojos del
médico. Es el fallo más peligroso que puede introducir un rediseño en este archivo, y no lo
detecta ninguna prueba de píxeles: lo tiene que ver un humano. Está en la lista del Guardián.

### 1.3 — `CRITICAL` va primero, y se ve primero

Los avisos farmacológicos se ordenan por gravedad porque **en consulta nadie lee la tercera
línea**. Tu jerarquía visual tiene que reforzar ese orden, no competir con él. Un rediseño que
le da el mismo peso visual a los seis avisos ha empeorado el producto aunque se vea mejor.

### 1.4 — El rendimiento es seguridad clínica aquí, no una métrica

Los PCs de los consultorios son lentos. La versión 6.0.0 fue **una release entera** dedicada a
que el script dejara de bloquear el navegador. Si el navegador se atasca, el médico **no recibe
la alerta** — el fallo es clínico, no cosmético.

Por eso:

- **`backdrop-filter` y `filter: blur()` son caros.** Ya hay un uso decorativo ("aurora
  ambiental") que se apaga bajo `.perf`. Cualquier efecto nuevo del mismo costo va bajo `.perf`
  igual, sin excepción.
- **Anima solo `transform` y `opacity`.** Nada que dispare *layout* o *paint* en bucle.
- **Nada de animación perpetua** (gradientes que se mueven solos, pulsos infinitos, *shimmer* de
  fondo). Un panel que anima 8 horas seguidas en un PC lento es un impuesto permanente.
- `content-visibility` y `contain` son tus amigos en la lista de citas.
- **Mide.** "Se siente fluido" no es una medición. Cuenta reglas, mide el costo de pintado, y
  entrega números con el comando que los produjo.

### 1.5 — `prefers-reduced-motion` NO puede apagar el parpadeo de alerta

Detalle que solo se entiende sabiendo el contexto: en el PC del médico **la política de la
empresa bloquea las notificaciones de Windows**. Por eso el script avisa por canales propios —
sonido, cartel, y **parpadeo de pestaña y favicon**.

Ese parpadeo es un **canal funcional de aviso**, no una decoración. `prefers-reduced-motion`
debe seguir apagando transiciones y adornos (ya lo hace, y hay prueba: suite 35, R6.5) **sin
apagar el parpadeo de alerta**. Si tu implementación de "reduce motion" lo mata, has silenciado
una alerta de fraude para cumplir una buena práctica. Deja prueba de que no pasa.

### 1.6 — El host es hostil

El script se inyecta en el DOM de Everest, que trae su propio CSS y **le gana** a lo genérico.
Ya pasó: clases `.hint/.col/.seg/.d` fueron pisadas por el CSS de Everest y hubo que renombrarlas
a `.vgl-*`. Toda clase nueva va prefijada `vgl-`, sin excepción, y con la especificidad
defendida.

### 1.7 — Escritorio, no móvil

El médico atiende **siempre en escritorio**, nunca en móvil ni tablet — está decidido y
documentado. No inviertas trabajo en *breakpoints* de móvil. Sí importa que el panel aguante
ventanas de escritorio de distinto tamaño y zoom del navegador al 110–125%, que es lo que sí
ocurre.

### 1.8 — Alcance: presentación, no comportamiento

Cambias **CSS, marcado y clases**. No cambias:

- lógica clínica, umbrales, códigos CUPS, fórmulas;
- qué se escribe en la historia clínica, ni cuándo;
- el orden en que se evalúan las reglas;
- `escapeHtml` ni ninguna ruta de escape. **Todo texto que venga de Everest sigue escapado.** Hay
  una prueba que no usa lista negra: exige que ninguna etiqueta del HTML resultante sea distinta
  de las que el bloque escribe. Si añades marcado, esa prueba es tuya de mantener.

Si al rediseñar encuentras un bug de comportamiento, **no lo arregles**: emítelo como prueba roja
en `tests/rojas/` con su consecuencia clínica, según §4 de `PROPIEDAD_ARCHIVOS.md`.

---

## 2. La reja que ya existe — tu red de seguridad, y tu examen

Este proyecto **ya tiene un sistema de diseño con pruebas**. No estás partiendo de cero, y eso
cambia tu trabajo: no puedes "limpiar el CSS" a ojo, porque hay 15 reglas con nombre que se
ejecutan en cada corrida.

`tests/suite_25_cascada_css.js` — **15 reglas, A a O.** Léelas enteras antes de escribir CSS;
cada una existe porque algo se rompió de verdad:

| | Qué exige |
|---|---|
| **A** | Clases que conviven no colisionan con especificidad idéntica |
| **B** | `!important` no pelea contra estilo inline |
| **C** | Caso dirigido: la insignia SUGERIDO no pierde color en tema claro |
| **D** | Toda `var(--X)` que se consume está declarada |
| **E** | `color` con selector de panel fuera de `#vgl-root` **lleva `!important`** |
| **F** | Paridad de tokens claro/oscuro + un token por cada color de `COLORS` |
| **G / H / I** | Escala tipográfica: cero `font-size` literales; todo cableado a `var(--t-*)` |
| **J** | `z-index` migrado a los 5 tokens de capas, con el valor exacto de la tabla |
| **K** | Caso dirigido: el contador del banner PyM no pierde su color |
| **L** | Todo contenedor colgado de `document.body` trae **fondo opaco propio**, no solo un velo |
| **M** | Los botones inyectados consumen sus tokens **con reserva** (viven fuera de las listas) |
| **N** | Ningún backtick suelto dentro del bloque CSS (cierra el template y tumba el archivo) |
| **O** | **Contraste WCAG calculado de verdad** — linealización sRGB + composición alpha del velo, en los DOS temas — y `--fg3` debe seguir **menos** contrastado que `--fg2` |

`tests/suite_35_interfaz_accesibilidad_medica.js` — escala tipográfica, alturas de línea clínicas
(1,4–1,55), anillos `:focus-visible`, `role="alertdialog"` + `aria-modal`, `aria-live`, focus trap
con Tab/Shift+Tab (incluidos los casos adversariales de 0, 1 y 100 elementos), Escape que
restaura el foco, y `prefers-reduced-motion`.

**Tres cosas que la Regla O te enseña gratis:** el contraste aquí se **calcula**, no se declara;
se comprueba en los **dos** temas; y arreglar contraste **no puede pagarse invirtiendo la
jerarquía visual** (por eso `--fg3` < `--fg2` es parte de la prueba). Diseña con eso en mente
desde el primer boceto, no al final.

### Dos trampas documentadas, que ya costaron caro

**Trampa 1 — `BASE_CONOCIDA` no es una lista donde apuntarse.** La Regla E lleva una lista de
infracciones *heredadas*. La forma correcta de cumplir es **poner el `!important`**. Añadirte a
`BASE_CONOCIDA` pone el banco en verde sin arreglar nada — es exactamente el patrón de "cosas que
parecen vivas y no lo están" que este proyecto lleva nueve casos persiguiendo. Está prohibido.

**Trampa 2 — nunca edites este CSS por `replace` de texto a ciegas.** Ya pasó: un intento de
añadir `!important` con un reemplazo de texto se lo aplicó a `.vgl-fchip.sel` —una regla **ajena**
con el mismo fragmento CSS— y dejó la regla objetivo intacta. Solo lo detectó la Regla E al
seguir contando 75 infracciones en vez de 74. En un template literal de 2.100 líneas, **edita por
posición y ancla verificada, y confirma que el archivo cambió donde creías.**

### La regla de oro del enjambre

> **Ninguna de las 15 reglas de cascada, ni una sola prueba de la suite 35, puede quedar en rojo
> ni relajarse para acomodar el rediseño.**
> Si una regla estorba de verdad, eso es un hallazgo que se escala al juez con argumento — no se
> edita la prueba.

Extender el sistema **sí** se puede y se espera: tokens nuevos, escala de espaciado, radios,
sombras, capas. Todo token nuevo nace con su prueba, igual que los que ya están.

---

## 3. Qué significa "moderno" aquí

No quiero una lista de tendencias. Quiero criterio. Cuatro puntos:

1. **Sistema antes que pantallas.** Espaciado en escala (no valores sueltos), tipografía en
   escala (ya existe: `--t-micro/body/strong/title/hero`), radios en escala, elevación en escala.
   Si el rediseño no se puede describir como reglas, es maquillaje.
2. **Densidad de herramienta profesional, no de landing page.** Esto es una herramienta de
   trabajo que se mira 8 horas. Aire generoso donde ayuda a leer; compacto donde el médico
   necesita ver muchas citas a la vez. Un dashboard médico no es una web de producto.
3. **Movimiento con propósito.** Transiciones de 120–200 ms que expliquen de dónde vino algo.
   Nada que retrase una acción. Nada perpetuo (§1.4).
4. **Lo moderno de 2026 que sí aplica** — evalúa cada uno y **justifica si lo usas o no**, con su
   costo: `:has()`, `@container` (encaja mejor que media queries en un panel redimensionable),
   `color-mix()` y espacios perceptuales `oklch()` para derivar estados hover/activo sin
   hardcodear seis variantes, `@layer` para ordenar la cascada frente al CSS de Everest, `clamp()`
   para tipografía fluida, `:focus-visible`, propiedades lógicas.

> **Aviso que te concierne a ti, el modelo:** tu corte de conocimiento es **marzo de 2026**.
> Cualquier afirmación tuya sobre soporte de navegador está, como mínimo, cinco meses vieja — y
> para una función CSS reciente eso es justo la ventana en la que cambia. **Comprueba el soporte
> contra la documentación real** (el médico usa Chrome en su equipo; está documentado) y **deja
> constancia de la comprobación**, con fuente. Una función CSS que "creías soportada" y no lo está
> no degrada elegantemente: deja la interfaz rota en el consultorio. Si no puedes verificarlo, usa
> la vía conservadora y anótalo.

**El pecado a evitar:** un rediseño que se vea espectacular en una captura y sea peor de usar. Si
al terminar el médico tarda más en encontrar al paciente en ámbar, fallaste — por muy bien que
puntúe el jurado en estética.

---

## 4. Orquestación — capas, jurado y juez

### 4.0 — Por qué el enjambre está montado así *(léelo: es la parte que no puedes deducir)*

Esta arquitectura está diseñada contra el perfil **real y documentado** de Gemini 3.7 Flash, no
contra un agente genérico. Cuatro hechos, y qué impone cada uno:

**(a) 1M de contexto, 64k de salida.** El userscript entero son ~16.800 líneas: **cabe completo
en tu contexto, con sitio de sobra.** No hay excusa para trabajar a ciegas sobre fragmentos.
*Impone:* todo agente que edite CSS **lee el bloque completo antes de tocarlo** y confirma el
ancla exacta. Es la defensa directa contra la Trampa 2 de §2 (el `replace` que golpeó la regla
equivocada). Los 64k de salida sí son un límite real: **ningún agente reescribe el bloque CSS de
2.100 líneas de una vez** — se edita por secciones, con verificación entre una y otra.

**(b) Su propia ficha de modelo dice que encadena mal.** Textual: *"the model can complete
individual coding tasks but lacks the independence to chain them into an end-to-end research
workflow without human intervention."* No es un defecto a compensar con más ánimo — es el dato
de diseño más útil que hay. *Impone:* fases **cortas**, cada una cerrada por un **artefacto
escrito** que la siguiente lee en frío. Nadie "sigue trabajando". La Fase 1 termina en
`DIRECCION_ARTE.md` y el checkpoint humano; la Fase 3 termina en veredictos escritos. Si un
agente necesita recordar lo que hizo otro, va al archivo — no a su memoria.

**(c) En ESTE repositorio ya tienes un historial, y es específico.** Está en
`tests/INFORME_MUTACIONES.md`, verificado caso por caso. Tus auditorías previas encontraron cosas
**reales y graves** que nadie más vio: `estadioKDIGO` devolviendo el estadio más grave ante un
`NaN`, la creatinina en µmol/L, el cruce de pacientes en `injectLabsIntoCronicos`. Y también
sobrestimaste tres hallazgos puntuales que resultaron falsos al verificarlos. El balance escrito
por el proyecto: *"acierta en lo estructural y tiende a sobrestimar en lo puntual — se verifica
todo antes de actuar."* *Impone:* eres fuerte en barridos amplios y en encontrar patrones →
**úsate en abanico ancho**. Eres débil en la certeza puntual → **ningún hallazgo se actúa sin
verificarlo contra el código**, y la carga de la prueba la lleva quien afirma, no quien duda.

**(d) Eres rápido y barato.** *Impone:* la forma correcta del enjambre es **muchos agentes, cada
uno con una tarea estrecha y un checklist explícito** — no pocos agentes con encargos amplios y
juicio abierto. Cada rol de abajo tiene una pregunta concreta que responder. Si un rol tuyo se
descubre "opinando en general", está mal planteado: pártelo.

**`thinking_level` por rol** — el defecto es `medium`; súbelo donde toca:

| Nivel | Roles |
|---|---|
| `low` | Cartógrafos, conteos, inventarios, capturas |
| `medium` | Implementadores, Guardián de la cascada |
| **`high`** | **Directores de arte, Sintetizador, los 7 Auditores, el Jurado, el Abogado del diablo, el Juez** |

Un juez en `low` es un juez que aprueba. El Guardián Clínico y el Juez van en `high` siempre,
aunque haya que recortar en otro lado.

### FASE 0 — Cartografía *(nadie diseña todavía)*

| Rol | Cant. | Función |
|---|---|---|
| **Cartógrafo** | 3 en paralelo | Inventario completo: las 246 clases y 82 ids, cuáles están vivos y cuáles muertos (rastrea alcanzabilidad de verdad, no "no lo veo"), qué pantalla usa qué, dónde está cada bloque de marcado. |
| **Arqueólogo del sistema** | 1 | Documenta el sistema de diseño **actual**: tokens, escalas, capas z, qué reglas de la suite 25 protege cada uno y por qué se creó. |

Entrega: `docs/ui/INVENTARIO_VISUAL.md` + `docs/ui/SISTEMA_ACTUAL.md`. **Cero cambios de código.**

### FASE 1 — Dirección de arte *(una sola dirección, elegida por jurado)*

Aquí es donde un enjambre mal montado falla: seis diseñadores en paralelo producen seis estéticas
y un Frankenstein. Por eso:

| Rol | Cant. | Función |
|---|---|---|
| **Director de arte** | 3 en paralelo | Cada uno propone **una** dirección visual completa y distinta, como página HTML estática autónoma (tokens, tipografía, color en ambos temas, componentes clave, estados). No tocan el userscript. |
| **Jurado de dirección** | 3 | Puntúan las tres con lentes distintas: *(a)* legibilidad clínica bajo presión, *(b)* calidad estética y coherencia, *(c)* costo de implementación y de rendimiento. |
| **Sintetizador** | 1 | Toma la ganadora e **injerta lo mejor de las otras dos**. Produce `docs/ui/DIRECCION_ARTE.md`: la especificación única que todos implementarán. |

> ## ⛔ CHECKPOINT DE PREVIEW — bloqueante
> Antes de que nadie toque `vigilante_agenda.user.js`, se entrega una **vista previa navegable**
> en `preview/` (HTML autónomo, con las pantallas reales pobladas de **datos sintéticos —
> inventados carácter a carácter, cero datos de pacientes**) y el médico la aprueba.
> Se muestran los **dos temas**, y los **cinco colores de alerta** en su contexto real.
> Este checkpoint no se salta ni se acorta. Es el mismo patrón que ya se usó en el proyecto
> hermano y funcionó.

### FASE 2 — Implementación por superficie

| Rol | Cant. | Función |
|---|---|---|
| **Implementador** | 4-5 en paralelo, por superficie | Panel+lista · modales de flujo · alertas/toasts/banner · Ajustes+dock · capa `vgl-mtr-*`. Cada uno se ciñe a `DIRECCION_ARTE.md`. |
| **Guardián de la cascada** | 1, continuo | Corre la suite 25 después de **cada** entrega, no al final. Una regla en rojo se arregla en el momento, no se acumula. |

**Protocolo de edición del bloque CSS** — obligatorio, sale de §4.0(a) y de la Trampa 2 de §2:

1. Lee el bloque CSS **completo** antes de editar. Cabe en tu contexto; no hay excusa.
2. Localiza el ancla exacta y **verifica que sea única** en el archivo antes de tocarla.
3. Edita por secciones acotadas — **nunca** reescribas las 2.100 líneas de una pasada (te comes
   los 64k de salida y pierdes el control de lo que cambió).
4. Después de cada edición, **confirma que el archivo cambió donde creías**: `git diff` de esa
   sección, leído, no asumido.
5. Corre la suite 25. Si una regla se puso roja, se arregla **antes** del siguiente cambio.

Commits pequeños, en español, uno por superficie: `estilo:` `feat:` `fix:`. Un commit por
superficie hace que revertir una sola pantalla sea trivial — con un commit gigante, el rechazo
del juez obliga a revertirlo todo.

### FASE 3 — Auditores por capas

Cada auditor revisa **una dimensión sobre TODO el trabajo**, no una pantalla sobre todas las
dimensiones. Es lo que hace que la auditoría sea exhaustiva de verdad.

| Auditor | Qué verifica | Veredicto |
|---|---|---|
| **Cascada** | Las 15 reglas A-O en verde, sin relajarlas, sin nadie añadido a `BASE_CONOCIDA` | Aprueba / Rechaza |
| **Contraste y accesibilidad** | WCAG AA **calculado** en los dos temas, foco visible, focus trap, aria, `prefers-reduced-motion` sin matar el parpadeo (§1.5), simulación de deuteranopía/protanopía sobre los 5 colores | Aprueba / Rechaza |
| **Rendimiento** | Costo de pintado medido, cero animación perpetua, `.perf` sigue apagando **todo** lo caro nuevo, sin regresión en equipos lentos | Aprueba / Rechaza |
| **🩺 Guardián Clínico** | **VETO.** Los 5 colores siguen significando lo mismo y distinguiéndose; `sinjuicio` ≠ `limpio` de un vistazo; `CRITICAL` sigue ganando la jerarquía; ninguna información desapareció por "limpieza visual" | **Veto absoluto** |
| **Coherencia** | Que las 8 superficies parezcan **un** producto: mismos radios, mismas sombras, mismo ritmo, mismos estados | Aprueba / Rechaza |
| **Regresión funcional** | `node tests/runner.js` completo en verde; cero cambios de comportamiento; `git diff` sin una sola línea de lógica clínica | Aprueba / Rechaza |
| **Seguridad** | `escapeHtml` intacto en toda ruta; ningún `innerHTML` nuevo con contenido de Everest sin escapar; ningún dato de paciente en capturas, fixtures o `preview/` | Aprueba / Rechaza |

**El Guardián Clínico no está en la cadena estética.** No opina de belleza. Solo responde: *¿el
médico sigue viendo y entendiendo lo mismo, igual de rápido?* Su veto no se vota ni se negocia.

**Reglas de auditoría, duras:**

- Ningún auditor firma sobre la salida de otro. Si no lo ejecutó él, no lo aprueba.
- Todo veredicto va con **comando y salida verbatim**. Cero cifras de memoria.
- Todo hallazgo va con **evidencia visual**: captura antes/después, siempre con datos sintéticos.
- **Todo hallazgo se verifica contra el código antes de reportarse**, por seguro que se sienta.
  Es la regla que sale directa de §4.0(c): tu modo de fallo documentado en este repositorio es
  afirmar de más en lo puntual. Un auditor que reporta 12 hallazgos de los cuales 4 son falsos
  vale menos que uno que reporta 8 verificados — **porque los 4 falsos cuestan revisiones y
  erosionan la confianza en los 8 buenos.** Si no lo pudiste verificar, se reporta como
  *sospecha sin verificar*, etiquetada como tal, y no bloquea nada.

### FASE 4 — Jurado

| Rol | Cant. | Función |
|---|---|---|
| **Jurado** | 4, independientes | Puntúan 1-10 con lentes distintas: *(a)* estética y modernidad, *(b)* usabilidad clínica a contrarreloj, *(c)* calidad e ingeniería del CSS, *(d)* accesibilidad y robustez. Cada uno justifica **cada** nota con evidencia concreta. |
| **Abogado del diablo** | 1 | Su único trabajo es **argumentar que el rediseño empeoró el producto**. Busca lo que el entusiasmo tapa: información que se perdió, densidad que subió, un estado que ya no se distingue, una pantalla que nadie miró. Entrega el caso más fuerte posible en contra. |

Un jurado que aprueba todo no sirve. Si los cuatro puntúan por encima de 8 sin una sola objeción
concreta, el juez debe sospechar del jurado, no celebrar el resultado.

### FASE 5 — Juez final

**Un solo juez.** Lee: los 7 veredictos de auditoría, las 4 puntuaciones, el caso del abogado del
diablo, y la evidencia visual completa. Emite `docs/ui/VEREDICTO_FINAL.md` con **uno** de tres:

| Veredicto | Cuándo |
|---|---|
| **APROBADO** | Todo auditor aprueba, el Guardián no vetó, y el caso del abogado del diablo queda refutado punto por punto con evidencia. |
| **APROBADO CON RESERVAS** | Aprobado, con una lista explícita de lo que queda pendiente y por qué no bloquea. Las reservas se escriben, no se dejan implícitas. |
| **RECHAZADO** | Cualquier veto del Guardián, cualquier auditor en rojo, o un argumento del abogado del diablo que no se pudo refutar. **Vuelve a la Fase 2 con instrucciones concretas.** |

**El juez tiene que poder decir que no, y tiene que haber creído de verdad que podía.** Un juez
que fue montado para aprobar es teatro. Si el veredicto es APROBADO, que sea porque el rediseño
lo aguantó.

**El juez falla por reglas, no por impresión general.** Esto es deliberado: el juicio abierto es
justo donde §4.0(c) dice que fallas. Aplica en este orden y para en el primero que dispare:

```
1. ¿Guardián Clínico vetó?                          → RECHAZADO. Fin. No se pondera.
2. ¿Algún auditor en rojo?                          → RECHAZADO. Fin.
3. ¿node tests/runner.js no está en verde?          → RECHAZADO. Fin.
4. ¿Algún punto del abogado del diablo quedó sin
   refutar CON evidencia (no con argumento)?        → RECHAZADO. Fin.
5. ¿Alguna nota del jurado < 6?                     → APROBADO CON RESERVAS, y la reserva
                                                      se escribe con nombre y dueño.
6. ¿Los 4 jurados > 8 sin una sola objeción
   concreta?                                        → devuelve al jurado: no auditaron,
                                                      aplaudieron. No es aprobación.
7. Todo lo demás                                    → APROBADO.
```

Nótese el punto 6: **un jurado unánime y entusiasta es una señal de alarma, no de éxito.**

---

## 5. Criterios de aceptación

- [ ] `node tests/runner.js` **completo en verde**, con la salida pegada.
- [ ] Las 15 reglas de cascada A-O en verde, **sin editar ni relajar ninguna prueba**, sin nadie
      nuevo en `BASE_CONOCIDA`.
- [ ] Suite 35 completa en verde, incluidos los casos adversariales de focus trap.
- [ ] `git diff` contra la base: **ni una línea de lógica clínica, umbrales, CUPS o fórmulas.**
- [ ] Contraste AA **calculado** (no declarado) en los dos temas, para todo texto nuevo o
      modificado, con la salida del cálculo.
- [ ] Los 5 colores de alerta verificados distinguibles entre sí y bajo simulación de daltonismo,
      con evidencia visual.
- [ ] `sinjuicio` y `limpio` verificados distinguibles de un vistazo, con captura de los dos.
- [ ] `.perf` apaga **todo** efecto pesado nuevo; `prefers-reduced-motion` **no** apaga el
      parpadeo de alerta, con prueba.
- [ ] Cero animación perpetua; costo de pintado medido y reportado con el comando.
- [ ] Cero `font-size` literales nuevos; todo token nuevo con su prueba.
- [ ] Capturas antes/después de las 8 superficies, en los 2 temas, **100% datos sintéticos**.
- [ ] 7 veredictos de auditoría + 4 puntuaciones + caso del abogado del diablo + veredicto final,
      cada uno con su evidencia propia.
- [ ] La bandera `S.motorPortado` sigue **apagada** de fábrica.

## 6. Entregables

```
docs/ui/INVENTARIO_VISUAL.md     — las 246 clases y 82 ids, vivos y muertos
docs/ui/SISTEMA_ACTUAL.md        — el sistema de diseño de partida
docs/ui/DIRECCION_ARTE.md        — la especificación única (Fase 1)
docs/ui/AUDITORIAS.md            — los 7 veredictos, cada uno con su salida
docs/ui/JURADO.md                — 4 puntuaciones + el caso del abogado del diablo
docs/ui/VEREDICTO_FINAL.md       — el fallo del juez
docs/ui/ANTES_DESPUES/           — evidencia visual, datos sintéticos
preview/                         — la vista previa navegable del checkpoint
tests/rojas/                     — los bugs de comportamiento hallados, NO arreglados
tests/suite_25_cascada_css.js    — reglas NUEVAS para los tokens nuevos (nunca relajar las viejas)
vigilante_agenda.user.js         — el rediseño
```

## 7. Escalar al médico — de inmediato, no al final

1. Cualquier cambio que altere **qué información ve** o **cómo la interpreta**.
2. Cualquier tensión real entre estética y legibilidad clínica: se presenta como opciones
   **A/B/C/D con una recomendada y por qué**, nunca como pregunta abierta.
3. Un veto del Guardián Clínico que el equipo crea injustificado — lo desempata él, no el juez.
4. Si el rediseño exigiera tocar lógica clínica para verse bien: **para.** Eso es un no.
