# Prompts para delegar a Jules — Agenda v13.0.0

> **No confundir con `JULES_TAREAS.md`** (tanda anterior, de infraestructura). Aquel prohíbe
> tocar `vigilante_agenda.user.js`; **esta tanda sí lo modifica**, que es justo el encargo.
> Nunca mezclar tareas de los dos archivos en la misma sesión de Jules.

El brief completo está **commiteado en el repo**: `SUPERPROMPT_AGENDA_V13.md`. Por eso cada
tarea de abajo es corta — se le dice a Jules qué sección ejecutar, no se le repite el brief.
Pegar 500 líneas en cada tarea es la forma más fiable de que se pierdan los detalles.

## Las tres reglas del reparto

1. **Una tarea = una rama = un PR = se FUSIONA antes de lanzar la siguiente.** T3 a T6 tocan
   todas `openAgendamientoModal` y la misma hoja de CSS. Lanzadas en paralelo son cinco ramas
   reescribiendo la misma función: el merge es imposible y lo descubres al final.
2. **El orden no es negociable.** T3 (funciones puras) antes que la UI: es lo más fácil de
   acertar y sostiene el resto. T4 (ventana de días) antes que T5 (realces): no se puede
   pintar lo que aún no existe.
3. **Cada PR se revisa contra las 6 comprobaciones del final** antes de fusionar. Si una falla,
   se devuelve — no se fusiona «para no perder el avance».

---

## PREÁMBULO — pegar SIEMPRE, antes de cada tarea

```
Trabajas en el repositorio vigilante_agenda, rama claude/pym-agenda-blindaje-v12-4.
Es un userscript de Tampermonkey (vigilante_agenda.user.js, un único IIFE, sin
build ni dependencias) que asiste a médicos de una IPS en Colombia, con banco de
pruebas propio que se corre con `node tests/runner.js`.

Lee PRIMERO el archivo SUPERPROMPT_AGENDA_V13.md en la raíz del repo: es el brief
completo de este encargo, con el contexto, las decisiones de arquitectura ya
cerradas y los criterios de aceptación. No lo contradigas.

REGLAS INNEGOCIABLES:

1. CERO PHI. Jamás un nombre, cédula, teléfono o dato de paciente real en código,
   pruebas, commits, comentarios o logs. Los datos de prueba son inventados y
   evidentemente falsos.
2. CASILLA VACÍA ANTES QUE DATO INVENTADO. Ningún selector del DOM, endpoint,
   parámetro ni regla clínica entra al código sin evidencia real. Si te falta
   evidencia, DETENTE y dilo en el PR: no rellenes con una suposición plausible
   por bien que suene.
3. EVIDENCIA O NO PASÓ. Antes de abrir el PR corre `node tests/runner.js` y pega la
   salida COMPLETA en la descripción, incluido el resumen final ("comprobaciones :
   N pasan"). El banco parte de 677: si tu PR trae MENOS comprobaciones que la
   rama base, borraste o debilitaste una prueba y eso es un fallo tuyo.
4. TEST DE MUTACIÓN OBLIGATORIO por cada cambio de comportamiento: escribe la
   prueba, rompe a propósito el código que arregla, CONFIRMA que la prueba nueva
   falla, restaura y confirma verde. Pega esa transcripción en el PR (qué línea
   rompiste, qué prueba cayó con su nombre exacto, verde al restaurar). Un PR sin
   transcripción de mutación no se revisa.
5. NO TOQUES lo que está fuera del alcance: AsignarTurno y su contrato, el flujo de
   laboratorio, mostrarPanelPostCita, el SMS, el módulo de órdenes PyM ni la
   telemetría. Si crees que tu tarea lo exige, DETENTE y explícalo en el PR.
6. Un PR pequeño por tarea. Nada de "de paso arreglé...".
7. Comentarios en español, con el estilo del repo: cada comentario explica el POR
   QUÉ (el incidente o la restricción que lo motivó), no el qué.
8. Nunca hagas peticiones reales a los sistemas de la clínica (Everest, Athenea,
   AppCita). Todo se prueba con mocks, como las suites existentes.
```

---

## T0 · Reconocimiento — SOLO LECTURA

```
Ejecuta ÚNICAMENTE los agentes A1, A2 y A4 de la Fase 0 del brief (cartógrafo del
modal, arqueólogo de evidencia, auditor de UX).

NO modifiques vigilante_agenda.user.js ni ningún archivo de tests.

Entrega un único archivo nuevo, INFORME_FASE0.md, con las tres salidas en el
formato que pide cada agente. Donde no haya evidencia, escríbelo como hueco
explícito con lo que haría falta capturar.
```

## T1 · Etiquetas del paciente + script de diagnóstico

```
Ejecuta ÚNICAMENTE el agente A3 del brief (investigador de etiquetas y perfil).

Entrega dos archivos:
1. INFORME_ETIQUETAS.md — la tabla cadena-real -> perfil y el nivel de confianza
   de cada fuente candidata.
2. DIAGNOSTICO_ETIQUETAS.js — script de una sola pieza que el médico pega en la
   consola del navegador dentro de Everest, que imprime de dónde salen las
   etiquetas del paciente y con qué cadenas EXACTAS llegan.

El diagnóstico NO puede imprimir ningún dato de paciente: solo nombres de campos,
forma de la respuesta y las cadenas de `descripcion`. Sin cédulas, sin nombres,
sin teléfonos. Revísalo tú mismo línea por línea antes de entregar.

NO modifiques el userscript en esta tarea.
```

> ⏸ **Aquí para.** El médico corre el diagnóstico y te pega las cadenas reales. T3 se puede
> construir sin ellas (tabla configurable, todo cae en `SIN_ETIQUETA`), pero solo queda
> terminado cuando lleguen.

## T2 · Diseño visual — tres maquetas para MIRAR

```
Ejecuta la Fase 1 del brief (propuestas B1, B2, B3).

Entrégalas como TRES archivos HTML autónomos:
  disenos/propuesta_1_densidad.html
  disenos/propuesta_2_linea.html
  disenos/propuesta_3_tarjetas.html

Cada uno se abre con doble clic: sin servidor, sin dependencias, sin CDN, HTML y
CSS embebidos. Datos de ejemplo INVENTADOS.

Cada maqueta debe mostrar en la misma página, claramente separados, los CUATRO
perfiles: HIPERTENSO, DIABETICO, NEFROPROTECCION y SIN_ETIQUETA. Y debe verse
bien en tema claro y en oscuro.

NO modifiques el userscript: esto es solo para que el médico elija mirando.

Añade disenos/COMPARACION.md con las decisiones visuales de cada propuesta y sus
puntos débiles reconocidos honestamente.
```

> 👁 **Aquí decides tú, no Jules.** Abre las tres, elige y anótalo en T5. Un agente escribe
> CSS; no puede saber cuál de los tres deja de parecerles confuso a tus compañeros.

## T3 · Motor de perfil (funciones puras — empezar por aquí)

```
Ejecuta el agente C4 del brief, respetando las decisiones D3 y D3-bis.

Implementa perfilPaciente(etiquetas) y recomendacionHorario(perfil, turnosDelDia)
como funciones PURAS: sin DOM, sin red, sin estado global. Todavía NO las
conectes al modal.

La tabla de "ejemplos resueltos" de D3-bis se convierte en UNA PRUEBA POR FILA,
sin excepción — incluida ["Nefroprotección","Diabetes"] -> primera mitad, que es
la que el médico corrigió expresamente.

MUTACIÓN OBLIGATORIA: haz que la nefroprotección anule la franja de la diabetes
(volver al modelo de escalera). Debe caer la prueba de
["Nefroprotección","Diabetes"]. Si sobrevive, esa prueba es falsa y hay que
rehacerla antes de entregar.
```

## T4 · Ventana de días (±7 hábiles, sábados reales, ocultar días sin agenda)

```
Ejecuta el agente C1 del brief, respetando las decisiones D1 y D2.

D1 y D2 son el corazón de esta tarea y no son negociables:
- El sábado NO se calcula con una fórmula de rotación quincenal. Se descubre
  preguntándole a BuscarCitasDisponibles por ese sábado concreto. Una fórmula
  inventada le ofrecería al médico un sábado que no trabaja.
- El sondeo de ~16 días exige concurrencia limitada (4-6 en vuelo, nunca 18),
  caché por (paciente, especialidad, fecha), render progresivo y cancelación
  respetando _cargarHorasToken y vivo().

Si al terminar el sondeo dispara más de 6 peticiones simultáneas, o deja el panel
en blanco esperando todas las respuestas, la tarea está mal hecha aunque las
pruebas pasen. Añade una prueba que verifique el tope de concurrencia.
```

## T5 · Realces visuales (día sugerido + horas)

```
Ejecuta los agentes C2 y C3 del brief, aplicando el diseño ganador que eligió el
médico: [PEGAR AQUÍ CUÁL DE LAS TRES GANÓ Y QUÉ INJERTOS LLEVA].

Los tres lenguajes visuales conviven sin pisarse: día sugerido, cupo adicional
(7:30/9:30/11:30/1:30/3:30/5:30) y franja recomendada por perfil.

Los bordes van INCLUIDOS: 09:00 dentro de la franja AM y 16:00 dentro de la PM.
Prueba de borde explícita: 09:00 dentro, 09:20 fuera, 16:00 dentro, 16:20 fuera.

La detección de horas usa normalizeHora (ya existe en el archivo, no la
reescribas). Un includes("7:30") casaría con 17:30 y con 07:30 PM: es motivo de
rechazo.

Conecta aquí el motor de T3 y la ventana de T4.
```

## T6 · CSS y tokens

```
Ejecuta el agente C5 del brief y lee la "trampa conocida (incidente v12.6.6)" de
la sección 1.

Si creas cualquier overlay nuevo que cuelgue de document.body fuera de #vgl-root,
tiene que entrar en las CUATRO listas globales de CSS (tokens oscuro, tokens
claro, prefers-reduced-motion, reset de box-sizing) o saldrá como texto desnudo
sobre la pantalla de Everest. Ya pasó una vez en producción.

Extiende la prueba estructural de tests/suite_06_interfaz.js si hace falta; NO la
debilites ni la borres.

Verifica el contraste con números, no a ojo. Claro y oscuro.
```

## T7 · Verificación adversarial

```
Ejecuta la Fase 3 del brief.

Revisa el diff acumulado desde v12.6.9 INTENTANDO REFUTARLO, no confirmarlo.
Ejecuta los seis refutadores: invenciones, PHI, mutaciones, regresión funcional,
adversario de red y completitud.

Para el refutador de mutaciones: RE-EJECUTA cada mutación declarada en los PR
anteriores y verifica que la prueba cae de verdad. Una mutación que sobrevive
significa que esa prueba es falsa: repórtala como hallazgo bloqueante.

Entrega INFORME_ADVERSARIAL.md. NO arregles nada en esta tarea: solo reporta, con
severidad y con la evidencia de cada hallazgo.
```

## T8 · Integración y entrega

```
Ejecuta la Fase 5 del brief.

Sube a v13.0.0 en @version Y en la constante VERSION de respaldo: hay una prueba
que las compara y falla si divergen.

Escribe el bloque de changelog en el encabezado con el estilo del archivo: qué se
reportó, cuál era la causa real, qué se cambió y qué queda pendiente sin
evidencia.

Pega el conteo exacto del banco en el mensaje del commit.
```

## T9 · Backlog de mejoras (puede ir en paralelo: no toca código)

```
Ejecuta la Fase 4 del brief (agente E1).

Entrega BACKLOG_MEJORAS.md: propuestas priorizadas, cada una con el problema real
que resuelve, la evidencia que ya existe, la que falta, el coste estimado y el
riesgo clínico.

Descarta explícitamente lo que suene bien pero no tenga evidencia detrás, y di por
qué lo descartas.

NO escribas código en esta tarea.
```

---

## Revisión de cada PR — 6 comprobaciones

- [ ] `node tests/runner.js` verde **y con más comprobaciones que la rama base** (parte de 677).
- [ ] Transcripción de mutación en el PR: qué se rompió, qué prueba cayó, verde al restaurar.
- [ ] Cada selector, endpoint y regla clínica del diff cita su evidencia.
- [ ] Cero PHI en código, pruebas, commits y logs.
- [ ] Nada fuera del alcance modificado (AsignarTurno, laboratorio, panel post-cita, SMS, órdenes PyM, telemetría).
- [ ] Fusionado **antes** de lanzar la tarea siguiente.

> La segunda es la que más se cae, y es la que más protege: cualquier agente dirá que las
> pruebas pasan. Lo que no puede fingir es una mutación que tumbe una prueba con nombre propio.
