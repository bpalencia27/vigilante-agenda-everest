# Ecosistema de Mantenimiento Nocturno — `.deepseek/`

> Plataforma de ejecución: **DeepSeek**. Los agentes nocturnos del Vigilante de Agenda
> viven aquí, en `.deepseek/` — no en `.jules/` (precedente de agentes por prompt del
> proyecto, ahora superado para el trabajo nocturno por decisión del médico: este
> ecosistema es el suyo, en el directorio de la plataforma que lo ejecuta).
>
> Regla de oro del ecosistema: **los agentes nocturnos trabajan mientras el consultorio
> duerme y nunca tocan el checkout principal.** Ver el contrato de publicación (§7).
>
> Nota de integración: cuando este ecosistema se formalizó ya existía en `.deepseek/`
> el prompt `prompts/ui-auditor-interactivo.md` (creado por el operador el 2026-09-08
> para DeepSeek V4 Flash): un agente de auditoría funcional INTERACTIVA que se despacha
> **bajo demanda** (una sección del userscript por invocación, típicamente antes de una
> entrega). Es una pieza hermana, no nocturna: no se duplica aquí, pero este índice la
> documenta (§2) para que el ecosistema tenga un único mapa.

## 1. Qué es

El Vigilante de Agenda es un userscript de Tampermonkey que un médico usa **EN VIVO**
durante consultas reales sobre el EHR Everest Health (SPA Angular de Athenea Soluciones).
Ese contexto hace que cualquier cambio sea quirúrgico: un error desplaza citas o hace
perder tiempo de consulta real. El ecosistema nocturno concentra en la madrugada el
trabajo de mantenimiento que no puede hacerse con el médico delante: auditorías y
correcciones de **rendimiento**, **UX/accesibilidad** y **seguridad**, cada una con su
propio agente, sus criterios de éxito medibles, su disciplina de pruebas (mutación
verificada + banco completo EXIT=0) y su política de reversión a 7 días.

Las reglas no negociables del proyecto están en `CLAUDE.md` (raíz del repo) y **todo
agente las lee antes de empezar**: casilla vacía antes que dato inventado, nunca pisar
lo que el médico escribió a mano, el script sugiere pero no actúa sin clic, cero PHI en
código/tests/commits/informes, y disciplina de pruebas con mutación verificada.

## 2. Mapa del ecosistema

| Pieza | Qué hace | Para qué sirve |
|---|---|---|
| `run-nightly-checks.sh` | Chequeo nocturno completo: sintaxis del userscript, sintaxis de todos los `tests/*.js` y banco `node tests/runner.js`, con EXIT real verificado y logs fechados | Compuerta mecánica de la noche: si esto no da VERDE, ningún agente entrega nada |
| `project_config.json` | Mapa dinámico de comandos y agentes: `{comando, args}` con placeholders `{{RAIZ}}`/`{{DEEPSEEK}}`, sin rutas hardcodeadas a pnpm/npm | Fuente única para que la plataforma sepa qué correr y qué exige cada agente |
| `prompts/bolt-performance.md` | Prompt del agente **BOLT** (rendimiento): cascada de red por flujo, barridos por tick, lecturas de almacén, DOM de modales, TTL/cachés | Auditoría nocturna de rendimiento con quick wins medidos antes/después |
| `prompts/palette-ux.md` | Prompt del agente **PALETTE** (UX/accesibilidad): contraste de temas, objetivos táctiles ≥ 24 px, foco, aria-live, modales; WCAG 2.1 AA con verificación honesta de motores | Auditoría nocturna de UX/UI y accesibilidad sin regresiones de color |
| `prompts/sentinel-security.md` | Prompt del agente **SENTINEL** (seguridad): XSS, fugas de PHI, claves de IA, BroadcastChannel, integridad de dependencias, barrera cero-identificables | Auditoría nocturna de seguridad con severidad CVSS-style y protocolo CRÍTICO < 15 min |
| `prompts/*.md` (los tres anteriores) | Prompts autocontenidos: se entregan textuales a la plataforma (DeepSeek) una noche cada uno, con sus criterios de éxito en `project_config.json` | Fuente de cada sesión nocturna: rol, misiones, pasos, pruebas, reversión y contraindicaciones |
| `logs/YYYY-MM-DD/` | Resumen ejecutivo (`RESUMEN.md`) + salida completa por chequeo de cada noche | Historial y evidencia: toda métrica del informe de un agente cita su log |
| `prompts/ui-auditor-interactivo.md` (pre-existente, bajo demanda) | Agente de auditoría funcional INTERACTIVA de UNA sección del userscript (mapeo de funcionalidades, aprobación/rechazo justificado, propuestas); se despacha con la ENTRADA del operador (`SECCIÓN_AUDITAR`, `OBJETIVO`, `CONTEXTO_CLÍNICO`, `AUTORIZAR_IMPLEMENTACIÓN`) | Auditoría por sección antes de entregas de versión o tras cambios estructurales — pieza hermana del operador, NO es un agente nocturno rutinario y no se duplica |

## 3. Cómo ejecutar un chequeo manual

Desde la raíz del repo (o desde cualquier directorio; el script se ubica solo):

```bash
bash .deepseek/run-nightly-checks.sh          # chequeo nocturno completo
bash .deepseek/run-nightly-checks.sh suite_94 # solo suites que contengan 'suite_94' (diagnóstico)
```

Chequeos individuales, con la convención de EXIT real del repo:

```bash
node --check vigilante_agenda.user.js > log 2>&1; echo EXIT=$?
for f in tests/*.js; do node --check "$f" || echo "FALLA $f"; done
node tests/runner.js > log 2>&1; echo EXIT=$?   # banco completo (~3.700 comprobaciones)
```

El runner fija `TZ=America/Bogota` por sí mismo y sale distinto de cero si algo falla
(o si no llega al final: el ejecutor nace en rojo y solo el final legítimo lo pone en
verde — un banco que se cuelga NUNCA sale 0).

Para despachar un agente nocturno: entregar el prompt de `.deepseek/prompts/<agente>.md`
textualmente a la plataforma (DeepSeek), con el criterio de éxito de
`project_config.json` y la fecha/nombre de rama de la noche.

## 4. Dónde quedan los logs y cómo leer un resumen ejecutivo

Cada corrida escribe en `.deepseek/logs/YYYY-MM-DD/` (fecha **UTC**, la del cron; a las
21:17 de la víspera en Colombia):

- `RESUMEN.md` — el resumen ejecutivo de la noche.
- `01_sintaxis_userscript.log`, `02_sintaxis_suites.log`, `03_banco_*.log` — salida
  completa por chequeo.

Cómo leer `RESUMEN.md` en 3 líneas:

1. **El veredicto final** (VERDE / ROJO) y el EXIT real por chequeo — un EXIT=0 con
   resumen en rojo no existe: el resumen solo da VERDE con EXIT real 0.
2. **La línea que manda del banco** en `03_*.log`: `comprobaciones : N pasan` (sin
   fallos) y `funciones cubiertas: X / Y públicas`. Una suite caída se ve como
   `✗ <suite> … N FALLAN` con el detalle debajo.
3. **La lista de suites `✗`**, si la hay, es el punto de partida de la siguiente
   sesión: la noche termina en ROJO y nada se entrega.

Los informes de los agentes (baseline/resultado, checklist, hallazgos) se guardan
junto al resumen del mismo día y citan sus logs como origen de cada número.

## 5. Política de ramas y reversión en 7 días

- **Rama por cambio:** `<agente>/<mejora>-<YYYY-MM-DD>` (p. ej.
  `bolt/memo-tick-2026-09-08`, `sentinel/fuga-consola-2026-09-08`). Una rama dedicada
  por noche; dentro de ella, **un commit por cambio**.
- **Un cambio = una mutación verificada = una fila en `tests/INFORME_MUTACIONES.md`** =
  una línea del informe. Los commits no arrastran cambios ajenos: esa es la condición
  para que la reversión sea limpia.
- **Reversión a 7 días:** si en los 7 días siguientes a la entrega aparece una
  regresión atribuible a un cambio, se revierte **ese commit exacto** con
  `git revert` — nunca se parchea encima del cambio sospechoso. Si el revert
  conflictúa, se documenta y se devuelve al orquestador; no se resuelve a martillazos.
- **Cron sugerido:** `17 2 * * *` (02:17 UTC = 21:17 de la víspera en Colombia,
  consultorio cerrado). Minuto 17, no redondo, para no colisionar con los crons que
  corren en el minuto 0 de la hora y mantener estables los micro-bench de la suite 94;
  nunca en horario de consulta ni cerca de los refrescos de agenda (06:00/12:00
  Bogotá). La línea completa de crontab está en la cabecera de
  `run-nightly-checks.sh`.

## 6. Política de medición antes/después

Toda tarea de rendimiento (agente BOLT) deja **el baseline y el resultado**, con su
origen:

1. **Baseline primero:** antes de tocar una línea, se mide con el mismo método que se
   usará después (contadores instrumentados por flujo: peticiones por flujo, lecturas
   de almacén por tick, operaciones DOM al pintar un modal) y se corre el banco
   completo con EXIT capturado. El baseline queda en el log de la noche.
2. **Resultado después:** la misma medición, misma máquina/sesión, mismo método, tras
   el cambio.
3. **El informe publica ambos y el delta**, con el origen de cada número (archivo de
   log, fecha, corrida). Un delta sin baseline — o un número sin origen — **no se
   publica**: es una opinión, no una medición.
4. Lo no medido se declara «no medido» con su motivo. La suite 94 ya fija baselines
   automáticos (micro-bench p50/p95 con `hrtime`, conteo de red por flujo, memo por
   tick): sus aserciones se pondrán rojas a propósito cuando una optimización baje el
   número — esa es la mutación que actualiza el baseline.

Las mismas reglas de evidencia aplican a PALETTE (ratio de contraste medido, tamaños
de objetivo reales, recorrido de foco real) y a SENTINEL (prueba que se pone roja si el
defecto existe).

## 7. Contrato de publicación (no se negocia)

1. **Nunca se toca el checkout principal.** Los agentes trabajan en worktrees/ramas
   dedicadas aislados; el orquestador commitea, fusiona y publica (gist incluido).
   Ningún agente ejecuta `git add`/`commit`/`push` sobre la rama principal, ni fusiona
   su propio trabajo, ni publica versiones.
2. **Nada sale sin banco VERDE:** `node tests/runner.js` con EXIT real 0 y sin
   comprobaciones perdidas (la corrida del día, no la de ayer).
3. **Nada sale sin mutación verificada** y su fila en `tests/INFORME_MUTACIONES.md`
   para cada cambio de comportamiento, y sin bump de `@version` + `const VERSION`.
4. **Cero PHI** en commits, logs, informes y descripciones — el repo y el gist son
   públicos. Un ejemplo con un dato real es un hallazgo de la sesión contra sí misma.
5. **Los CRÍTICOS paran la entrega:** un hallazgo de PHI en tránsito o XSS ejecutable
   (protocolo SENTINEL, < 15 min) frena versiones nuevas hasta revisión del
   orquestador. Ningún agente «sigue adelante» con la entrega después de un CRÍTICO.
6. **Los hallazgos que requieren decisión del médico** (colores clínicos, disposición
   de la UI, cambios de flujo, optimizaciones que tocan semántica clínica) viajan en
   el informe como pendientes — no se resuelven en la noche por criterio del agente.
7. **El ecosistema no toca** `vigilante_agenda.user.js` fuera del worktree ni los
   archivos del proyecto fuera de lo que el orquestador indique; `tests/harness.js`
   no se edita jamás.
