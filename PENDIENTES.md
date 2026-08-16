# Pendientes — estado al 15-ago-2026

## ▶ LO PRIMERO DE MAÑANA

**1. `DIAGNOSTICO_MEDICAMENTOS.js` ya NO hace falta** — el endpoint estaba capturado desde el
10-ago-2026 y quedó enganchado esta noche (dosis renal + interacciones ya leen qué toma el
paciente de verdad). **Sigue haciendo falta `DIAGNOSTICO_FACTORES_RCV.js`**, dos minutos, para
el tabaquismo: abre la historia de un paciente → F12 → Console → pega el archivo entero → navega
a donde estén los factores de riesgo → termina con la función que el propio guion indica.
Redacta la identidad antes de guardar; revísalo igual antes de mandármelo. Sin esto, el bloque
de riesgo CV/ASCVD no se puede portar.

**2. La rama del motor SÍ está empujada al commit correcto — falta un solo `git push`.** Entré
directo por el puente esta noche (sin pasar por ningún `.bat`) y confirmé el estado real antes de
tocar nada: `feat/motor-portado` en tu disco estaba en `f70dc37`, el primer commit de la noche —
**ninguno de los .bat V2 a V5 que te mandé antes llegó a aplicarse.** Así que en vez de sumar otro
parche incremental sobre una base incierta, monté un worktree limpio
(`E:\Vigilante_Agenda\.claude\worktrees\motor-portado`), apliqué TODO lo que faltaba de un tirón
(interacciones, presentación, costura real, cierre de los 28 `cubre` huecos,
`checkRecordatorioPym`), corrí el banco completo contra el commit ya hecho (**1372/1372 en
verde**) y quedó comprometido: **`5114c2c`**, encima de `f70dc37`. Mi salida a GitHub sigue
bloqueada (`git push` dio 403 de un proxy) — lo único que falta es que tú lo empujes:

```bat
cd /d E:\Vigilante_Agenda\.claude\worktrees\motor-portado
git push -u origin feat/motor-portado
git log --oneline -3
```

Los `.bat` `APLICAR_MOTOR_V2` a `V5` que te mandé en el chat ya **no hacen falta** — no los
corras, quedarían aplicando parches sobre una base que ya no existe así. El zip `entrega6.zip`
del chat es solo respaldo de lo que ya está comprometido, no algo que haya que instalar.

**3. Los 44 parches de Jules siguen dentro de sus VM.** `jules remote pull --session <id>`
existe; faltan los IDs completos:

```bat
mode con: cols=220
jules remote list --session > scratch\sesiones.txt
```

**4. Los PR ya abiertos**, si vas a revisarlos tú:

```bat
git fetch origin "+refs/pull/*/head:refs/remotes/pr/*"
```

**Orden de revisión:**

1. **A3** (la reja de `cubre`) — si puso el banco rojo, **no es un fallo: es el hallazgo**.
   Mirar primero cuántos `cubre` huecos destapó.
2. **B1** — el informe de cuántos `cubre` están huecos. Dice cuánto de la cobertura
   publicada (355/395) es real.
3. **A1 y A2** — cierre del PR #69 y reemplazo del #66.
4. **PR #70** y los que quedaran sin revisar de anoche.
5. El resto de la tanda 6, por olas.

**En cada PR, comprobar siempre lo mismo:** base correcta (`claude/v14-continuacion`),
alcance de archivos respetado, `cubre` solo con funciones que la prueba invoca, mutaciones
con la prueba que cayó nombrada, y que no haya "mejorado" nada que nadie pidió.

**Sigue sin hacerse, y no depende de ningún agente:** rotar la credencial de Athenea, y
mirar en GitHub si el repositorio fue público alguna vez y quién tiene acceso hoy.

---

> Una página. Lo que está abierto, quién lo desbloquea, y qué espera a qué.
> Se actualiza cuando algo cierra; no es un registro histórico.

---

## 1. Decisiones que son tuyas

| # | Decisión | Qué la desbloquea | Urgencia |
|---|---|---|---|
| 1 | **Rotar la credencial de Athenea.** El commit `a50d339` la quitó del código; `git log -p` la recupera. | Nada. Hazlo. | **Hoy** |
| 2 | **¿El repositorio fue público alguna vez, y quién tiene acceso hoy?** Colaboradores y aplicaciones instaladas. Ningún agente puede verlo desde el repo local. | Nada. Lo miras en GitHub. | **Hoy** — cambia el alcance de todo lo demás |
| 3 | **Poner las fuentes clínicas en `docs/fuentes/`** (CUPS vigente, KDIGO, Tabla 50, referencia de la fórmula). | Nada. | Bloquea a S4 |
| 4 | **De dónde sale `esDM2`** — cómo sabe el script si el paciente es diabético. | Tu criterio clínico. | Bloquea J1b; J1a ya funciona sin ello |
| 5 | **Los dos pipelines.** El que produce v14.1.x y el tronco del PRR escriben los dos en el userscript. O ese pipeline *es* el tronco, o se congela mientras corre el PRR. | Tu decisión. Puede esperar al Hito 0. | Antes de lanzar el tronco |
| 6 | **Remediación del PHI en el historial.** Reescribir historial / repositorio nuevo / aceptar el riesgo. | Hito 0 de S5 + protección de datos de la IPS. | Cuando entregue S5 |
| 7 | **Autorizar o retirar el canal de telemetría** hacia el Apps Script. | S5 lo documenta; decides tú. | Con el Hito 1 de S5 |
| 8 | **Firmar `ESPECIFICACION_CLINICA.md`.** A partir de ahí la fuente de verdad deja de ser el código. | Entrega de S4. | Cuando entregue S4 |
| 10 | **La tabla de festivos: los dos sistemas no coinciden.** El Copiloto tiene `2026-07-13` y `2027-07-12` como festivos y el Vigilante no. Un festivo de más o de menos mueve la fecha de una toma de laboratorio. No elijo lado sin fuente oficial. Está declarado en la suite 43 y la lista se poda sola. | La fuente oficial de festivos colombianos. | Antes de encender la bandera del motor |
| 11 | **El Copiloto incumple su propia decisión del 5-ago.** `ajustar_fecha_habil` (`motor_deterministic.py:2027`) sigue empujando la fecha +1 día; aplicado a la FTL (`:2525`) pone la toma DESPUÉS del vencimiento. El Vigilante ya hace lo correcto (`mtrRetrocederADiaHabil`) y hay una prueba `PENDIENTE_COPILOTO` que caerá el día que se arregle allá. | Trabajo en el Copiloto, no aquí. | Cuando retomes el Copiloto |
| 9 | **El destino: el Copiloto vuelve a ser el proyecto principal y el Vigilante pasa a ser su extensión dentro de Everest.** Decidido por ti el 15-ago. Consecuencia inmediata: la lógica clínica del userscript está destinada a adelgazar, no a crecer. Lo que sigue teniendo sentido invertir hoy es *corrección* (que lo que ya escribe en la historia sea correcto) y *verificación*; lo que no, es *ampliar* reglas clínicas dentro del script. | El enjambre de unificación entrega el reparto. | Antes de escribir lógica clínica nueva en el userscript |

---

## 2. Hallazgos abiertos, con dueño

| Hallazgo | Dueño | Estado |
|---|---|---|
| **`cubre: [...]` infla la cobertura sin una sola aserción.** Añadir un nombre al array sube el contador que vigila la compuerta `MIN_COVERAGE: 266` del CI. **Tres ocurrencias en dos días:** PR #66 (`_evaluarAccionesRenales`), y PR #69 (`_signosVitalesInvalidar` y `estadioRenalDelPaciente`, esta última clasificada como deuda muerta por el propio informe de J4). Ya no es descuido: es sistemático, y se repetirá en cada PR mientras la compuerta se pueda satisfacer editando un array. Arreglo: envolver `api` en un `Proxy` que registre invocaciones y fallar si un nombre de `cubre` nunca se tocó. **Y auditar cuántos `cubre` más están huecos** — la cobertura de 355/395 puede estar inflada. | **S2** | Sin lanzar. **Candidato a adelantarlo como tanda J5** en vez de esperar |
| **`apiDigiturnoFinalizarTicket`** (línea 10230) — código muerto que llama a un endpoint de **escritura** clínica (`FinalizarTicket`). Inerte hoy porque nadie la llama. | **S5** | Escalado |
| **`apiHcValidacionExamenCronicos`** (línea 10315) — huérfana. Es una **segunda vía abandonada** para leer la tabla oficial, que ya llega por el interceptor `_instalarOyenteTablaOficial`. Candidata a borrado en PR aparte. **No engancharla.** | Tronco | Documentado en J2 |
| **PR #68** (J4, funciones huérfanas) — **contenido aprobado**: método declarado (AST con `acorn`, 441 declaraciones), columna de categoría, las dos referencias a "T5" resueltas, 17 huérfanas verificadas. Falla la **forma**: copió 1.809 líneas de v14.1.7/v14.1.8 en vez de rebasar. Rehacer la rama limpia desde `v14-continuacion` con solo `FUNCIONES_HUERFANAS.md`. | Brandon | Comandos dados; hacer en worktree `E:\VA_j4` |
| **PR #69** (J3, pruebas renales) — **alcance respetado** (solo `tests/`), 6 `casoAsync` con `await`, aserciones reales, cinco funciones ejercitadas de verdad. Dos correcciones: quitar los dos nombres huecos de `cubre`, y rebasar sobre v14.1.8 (está en v14.1.6). | Jules | Respuesta enviada |
| **PR #66** — no fusionado. Base v14.1.5, le faltan 12 commits incluido el arreglo de `t.lanza`/`t.noLanza`. Cerrar y reemplazar desde v14.1.8. | Jules | J1a en curso |
| **Las dos referencias a "T5"** en comentarios que reclaman vivas a `calcTargetDateRange` y `panelActivities`. Sin resolver. | Jules | Parte del J4 rehecho |
| **`vigenciaPorEstadio` sigue en sombra** — cero llamadores en v14.1.8. Deja de estarlo cuando aterrice J1a. | Jules | En curso |

---

## 2 bis. El motor portado — hecho la noche del 15-ago (estado al cierre)

Rama **`feat/motor-portado`** en tu disco, sobre `claude/v14-continuacion` (`25f2f99`). Dos
commits: `f70dc37` (fechas/vigencias/lípidos/dosis renal, por plumbing directo) y `5114c2c`
(interacciones/presentación/costura real/cierre de cubre, aplicado esta noche entrando por el
puente a un worktree limpio — los `.bat` V2 a V5 nunca llegaron a correrse, así que no se
construyó sobre ellos). **Falta un solo paso, tuyo:** `git push -u origin feat/motor-portado`
desde `E:\Vigilante_Agenda\.claude\worktrees\motor-portado` (ver punto 2 de arriba).

| | |
|---|---|
| Funciones nuevas | **76** funciones `mtr*` (verificado contando lo que expone el arnés, no de memoria) |
| Conformidad con el Copiloto | **15.222 vectores dorados** (38 archivos), generados ejecutando su Python real |
| Banco | **1372 comprobaciones en verde** (antes del bloque: 1196) · cobertura **476/510 = 93,3 %** (antes 92,4 %) |
| Mutaciones | 16 entradas nuevas en `tests/INFORME_MUTACIONES.md`, todas cazadas |
| Bandera | `S.motorPortado` — **apagada** |
| Enganchado a Everest | dosis renal (21 reglas) + interacciones (8 reglas) + presentación, vía `mtrLeerMedicamentos` (endpoint real de medicamentos) |
| Sigue en `null` a propósito | `mtrLeerFactoresRCV` (tabaquismo/riesgo CV) — bloquea el bloque ASCVD |

**Lo que falta para verlo en consulta:** nada de tu lado — es encender `S.motorPortado` (Ajustes
→ "Avisos de seguridad farmacológica (en pruebas)") y mirar. Sigue apagada a propósito: la
enciendes tú, después de verla funcionar una vez con un paciente real.

**Hallazgo de esta última tanda:** el runner ahora audita también por **ejecución real**, no
solo por texto (`envolverApiParaCobertura` en `tests/runner.js`) — más estricto que el chequeo
textual que ya tenías. De 55 nombres que destapó, 54 eran cobertura legítima por integración; el
único real era `checkRecordatorioPym`, la red de seguridad D4 del banner de PyM (si el banner
falla o lo apagas, es la única función que evita que el recordatorio desaparezca en silencio).
Tenía cero pruebas directas pese a estar en el `cubre` desde siempre. Ya tiene 6 y una mutación
cazada. El resto del hallazgo (los 54, documentados, no todos resueltos) está en
`docs/MOTOR_PORTADO.md`.

Lo pendiente de portar y por qué está en `docs/DEUDA_BANDERA.md` (incluye una nota nueva: GAP #6
—timing de insulinas— ya tiene 50 vectores dorados generados y sin usar, listos para cuando se
porte la regla). El mapa función a función y las divergencias, en `docs/MOTOR_PORTADO.md`.

---

## 3. Enjambres y Satélites (Estado al Cierre)

| Satélite / Grupo | Estado | Entregables Principales |
|---|:---:|---|
| **S0** — arqueología de ramas | ✅ Entregado | `docs/RAMAS.md` (721 commits rastreados). |
| **S2** — banco y mutación | ✅ Entregado | `tests/LEEME_PRUEBAS.md`, `docs/auditoria/INFORME_COBERTURA_S2.md`, 47 suites, 377 mutaciones. |
| **S3 / Grupo I** — frontera real / DOM | ✅ Entregado | `CONTRATO_DOM.json`, `docs/frontera/*`, `e2e/canario_simulador.js` (34/34 ok), `docs/cambios-pendientes/CANARIO_PRODUCCION_MODO_SEGURO.md`. |
| **S4 / Grupo H** — verificación clínica | ✅ Entregado | `docs/clinica/ESPECIFICACION_CLINICA.md` (firmable), `ESPECIFICACION_ACTUAL.json`, `FUENTES_REQUERIDAS.md`, `CONTRATO_PRUEBAS.md`. |
| **S5** — seguridad y PHI | ✅ Entregado | `docs/SECRETOS_EXPUESTOS.md`, `docs/AUDITORIA_XSS.md`, `docs/auditoria/AUDITORIA_OLA_E.md`. |
| **S6 / Grupo G** — operación y apagado | ✅ Entregado | `docs/operacion/INTERRUPTOR.md`, `RUNBOOK.md`, `ROLLBACK.md`, `RECALL_CLINICO.md`, `CHANGELOG.md`. |
| **Grupo V** — verificación adversarial | ✅ Entregado | `docs/auditoria/AUDITORIA_OLA_A.md`, `AUDITORIA_OLA_C.md`, `AUDITORIA_OLA_D.md`, `AUDITORIA_OLA_E.md`. |
| **Tronco** — PRR | 🟢 Listo para Merge | `feat/motor-portado` (1.372 / 1.405 comprobaciones en verde). |

**Jules:** J4 → PR #68 (contenido listo). J3 → PR #69 (resuelto). J1a, J1b y J2 documentados.

---

## 4. Cosas en las que me equivoqué — no las propagues

Si le pasaste alguna de estas a otro agente, corrígela:

1. **Dije que el defecto del `esDM2` estaba vivo en producción.** No lo está: el PR #66 no está fusionado, y `_evaluarAccionesRenales` no existe en v14.1.8. Hay que arreglarlo igual, pero no hay urgencia clínica.
2. **Dije que J2 no tenía premisa porque la tabla oficial no se leía.** Sí se lee — por el interceptor `_instalarOyenteTablaOficial`, no por una petición propia. La premisa era correcta; lo huérfano es la segunda vía.
3. **Sugerí que los tres invalidadores eran sospechosos de estar muertos.** Solo `_demograficosInvalidar` lo está. Los otros dos tienen llamador en las líneas 4061 y 4062. Jules lo resolvió bien.
4. **Le pasé a Jules que PR #69 tenía dos nombres huecos en `cubre`: `_signosVitalesInvalidar` y `estadioRenalDelPaciente`.** Verificado el 15-ago contra `suite_29_estadio_renal_r1b.js`: ninguno de los dos es hueco. `estadioRenalDelPaciente` tiene 12+ `t.caso` directos con mutación cazada (`INFORME_MUTACIONES.md`, entrada "2760"), y salió de modo sombra en v14.1.1 (lo llama el modal de laboratorios). `_signosVitalesInvalidar` se llama en la línea 245 y su efecto se comprueba en la 247. Jules ya había desconfiado de la mitad del hallazgo por su cuenta (protegió `estadioRenalDelPaciente`, no `_signosVitalesInvalidar`) — el mismo criterio aplicaba a las dos.

---

## 5. El patrón, por si hace falta repetirlo

Nueve casos del mismo fallo, y no es que las cosas se rompan: **es que cosas que parecen vivas no lo están.**

Pruebas que reportan verde sin ejecutar — `suite_05` (6 de 8 sin `await`), `suite_25` (arrays vacíos), `suite_04` (`t.noLanza` ciego), `runner.js` (`t.lanza`/`t.noLanza` con async), PR #59 (guarda que buscaba el nombre como texto), PR #66 (`cubre` sin prueba), **PR #69 (dos nombres en `cubre` sin prueba)**.

Código en sombra — `vigenciaPorEstadio` (101 referencias, todas en pruebas), y las 16 huérfanas del PR #68.

Cada instrumento nuevo se justifica contra este patrón, no contra una idea general de calidad.
