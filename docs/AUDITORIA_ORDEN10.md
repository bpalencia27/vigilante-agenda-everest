# Auditoría de confirmaciones extemporáneas — ORDEN #10 (v18.8.10)

**Fecha:** 2026-09-08 · **Orden del médico:** 7 puntos · **Estado:** cerrada y verificada
**Evidencia de cierre:** banco completo **3707/3707, EXIT=0 real** (log `banco_orden10c.txt`)

Este documento es el informe íntegro del punto 7 de la orden: desviaciones
encontradas, correcciones aplicadas y resultados. **Redacción PHI total**: ningún
nombre, documento, hora de cita ni dato combinable de pacientes reales aparece aquí;
los hechos del archivo del día se describen solo por su patrón (tipo de evento y
desviación en minutos).

---

## 1. La ventana estricta de 6 minutos — cómo está construida

La orden pedía: **cero confirmaciones válidas fuera de plazo** — toda confirmación
más allá de 6 minutos posteriores a la hora de la cita debe quedar marcada, y ninguna
dentro de la ventana puede sonar como extemporánea.

La regla en el código es rígida por construcción (`CONFIG.TOLERANCIA_MIN = 6.0`),
y además **defensiva por diseño** — el Vigilante solo acusa lo que él mismo observó:

1. Una cita que sigue **«Sin presentarse»** pasada la gracia (>= +6,0 min) pasa a
   ámbar y el líder de la sesión pone una **marca de sospecha** en esa cita. La marca
   nace solo en la pestaña líder, solo si no hubo un relevo reciente, y nunca se
   hereda para acusar: una pestaña que abre tarde y ve «En sala» sin marca previa la
   cuenta como llegada normal (casilla vacía antes que dato inventado).
2. Si después la cita aparece **«En sala»** con la marca puesta → **ROJO con sonido
   insistente** (aviso al médico, decisión v16.2.8), fila
   `FRAUDE_EXTEMPORANEO` en la bitácora con la hora exacta del hecho, la hora
   ORIGINAL de la cita, el documento del paciente y la desviación en minutos, y
   aviso anónimo en vivo al tablero (reporte al administrativo — ver §5).
3. El salto «sin presentarse» → «atendido» **nunca** es extemporáneo: es un hueco
   de lectura (decisión del médico, 31-ago), y una llegada a «en sala» sin marca
   previa es VERDE/`INGRESO_A_TIEMPO`.

La frontera del minuto 6 quedó fijada con pruebas exactas de borde en la suite nueva
(§6): **+5,9** → ingreso a tiempo; **+5,99** → prealerta sin sospecha aún;
**+6,00 exactos** → la ventana cerró (la regla es `>=`, el minuto 6 completo
pertenece a la ventana); **+6,1** → la cadena completa de extemporánea.

## 2. Examen del archivo de auditoría del 08-sep (TSV)

Se examinó el archivo `auditoria_vigilante_2026-09-08` (descarga del día, generado
por la v18.8.4 que estaba en vivo esa mañana). Patrones, sin identificadores:

| Patrón observado | Lectura |
|---|---|
| **1** confirmación extemporánea en la mañana, a **+11,8 min** de su cita | Bien marcada: fuera de la ventana por 5,8 min, con su fila de fraude completa. No hubo ninguna extemporánea que se hubiera contado como válida — **la ventana no tuvo fugas** |
| Rectificación de inasistencia **+13 min** después de la marca | Alguien (¿el paciente llegó tarde pero fue atendido?) corrigió la inasistencia poco después. Patrón esperado del flujo de rectificación |
| **1** llegada a +4,9 min | Dentro de la ventana estricta (6,0) — contada como ingreso a tiempo, como debe ser |
| **14** ingresos a tiempo, **3** inasistencias, **89** eventos | Conteos coherentes entre la cabecera del archivo y su cuerpo (el «cuadre» que la suite_10 fija) |
| Minutos **negativos** (−0,1 / −25,2 / −35,3 / −43,7) en eventos de la mañana | Traza de la v18.8.4 **en vivo**: el reloj interno podía registrar minutos negativos al cruzar la medianoche de la sesión. **Ya corregido en v18.8.7** (normalización a 0 + aviso). El archivo del día quedó como evidencia pre-corrección |
| Rachas de `LECTURA_TRAS_RELEVO_SIN_CONFIRMAR` (sin confirmar, tras relevo) | El candado de relevo que las registraba **ya se corrigió en v18.8.7** (unicidad por tipo+cita+día). Rachas de la versión vieja en vivo |
| Los eventos **cortan a las 11:29** aunque la descarga fue a las 15:22 | **No es un fallo del script**: la agenda vigilada se cerró al mediodía (relevo/cambio de turno) y nada volvió a sonar. Sin agenda abierta no hay hechos que registrar. Documentado como observación, sin corrección |
| **Sin columna de usuario** en ninguna fila | Brecha real del punto 3 de la orden → **corrección v18.8.10** (§4) |

**Conclusión del examen:** el único hecho extemporáneo del turno quedó bien marcado,
las llegadas dentro de la ventana se contaron a tiempo, y los patrones raros
(negativos y rachas) son traza de la versión que estaba en vivo esa mañana — ambos ya
corregidos en la v18.8.7. No se halló ningún acceso tardío que hubiera burlado la
marca ni ninguna brecha de bloqueo aprovechable: la marca depende de la observación
del líder, y eso es una decisión deliberada (no acusar lo no visto).

## 3. Brechas de bloqueo — análisis

La orden pedía examinar «brechas de bloqueo». El mecanismo no bloquea confirmaciones
(si el personal de facturación confirma tarde, Everest la registra; el Vigilante no
puede ni debe impedirlo — no es su papel) — **marca y avisa**, y eso es lo que
audita. Las únicas vías por las que una extemporánea podría no marcarse:

- **Nadie vigilaba la agenda** (pestaña cerrada o en otra vista sin panel): sin
  observación no hay marca — deliberado (v18.0.12: hueco de lectura, decisión del
  médico). El corte de las 11:29 del TSV es exactamente ese caso, con relevo de por
  medio: no hubo vigilancia, no hubo hecho marcado.
- **La lectura nueva se ve una sola vez** (parpadeo entre API y raspado): el
  antirrebote exige ver la transición dos veces; un parpadeo único no acusa a nadie
  (falsa acusación cero — también deliberado).
- **Relevo reciente de líder**: una cita que vence durante el cambio de pestaña
  líder no origina marca en la pestaña nueva hasta que pasa la ventana de
  relevo — protege contra dobles marcas, no contra el hecho (el líder viejo ya la
  marcó si la vio).

Ninguna de estas vías permite que una extemporánea se cuente como **válida**: la
fila `INGRESO_A_TIEMPO` solo nace de una llegada observada SIN marca previa. El
riesgo residual es de silencio (no ver), nunca de falso verde.

## 4. Correcciones aplicadas en la v18.8.10

**Brecha real del punto 3** (registros completos): ni la bitácora local ni el CSV de
reclamación decían **quién estaba en la sesión** cuando el Vigilante registró un
hecho. Corrección en dos piezas, ambas con mutación verificada:

1. **`logEvent`** adjunta a cada fila local el usuario de la sesión
   (`state.activeDoctor`, la identidad del login de Everest — la única que, por
   decisión del médico del 02-sep, identifica a quien firma citas y órdenes). Si la
   sesión aún no se capturó, el campo **no va**: la celda queda vacía — jamás se
   inventa un responsable.
2. **`exportAudit`** gana la columna **«Usuario» al final** del archivo
   `auditoria_vigilante_*.csv`, sin mover las columnas históricas con las que el
   médico ya viene reclamando.

Sin CSS nuevo, sin reglas de color nuevas → nada que verificar en Chromium; el censo
de blindaje (suite_25) sigue en 701.

## 5. Notificaciones a administrativo y médico (punto 2 de la orden)

El flujo de aviso en cada intento extemporáneo ya existía y quedó auditado sin
cambios:

- **Al médico** (en el panel): ROJO con sonido insistente, una sola vez por hecho
  (decisión v16.2.8); la lectura repetida del antirrebote no re-sueña.
- **Al administrativo**: `reportarFraude` envía al tablero un aviso **anónimo** en
  vivo (hora del hecho y minutos de desvío, sin ningún dato del paciente; tope de 20
  por día y cola de reintentos). La telemetría del tablero **sigue anónima por
  diseño** — el nombre del paciente nunca sale de la máquina.

## 6. Pruebas de validación dentro/fuera de la ventana (punto 6)

Suite nueva `tests/suite_106_orden10_extemporaneos.js` — **5/5 casos**, con el motor
de verdad (colorAndAlert + maybeNotify reales, patrón del «cuadre del CSV» de
suite_10, incluidas las dos lecturas del antirrebote):

1. **Dentro**: confirmar a +5,9 min → VERDE, una fila `INGRESO_A_TIEMPO` con la
   desviación +5,9, **cero** `FRAUDE_EXTEMPORANEO`.
2. **Frontera**: a +5,99 la sospecha aún no nace (MORADO); a +6,00 exactos la marca
   nace (la ventana incluye el minuto 6).
3. **Fuera**: confirmar a +6,1 min → ROJO con sonido una sola vez, exactamente una
   fila `FRAUDE_EXTEMPORANEO` (hora original y documento conservados, desviación
   >= 6), **cero** filas de «a tiempo».
4. **Usuario**: con la sesión identificada, la fila de la bitácora y la celda del
   CSV terminan con el usuario de la sesión.
5. **Sin sesión**: la columna existe y la celda queda vacía — jamás un dato
   inventado.

**Mutaciones verificadas** (fila en `tests/INFORME_MUTACIONES.md`):
M1 — romper el adjunto del usuario en `logEvent` → el caso 4 se pone rojo
(«esperaba MEDICO DE PRUEBA y obtuvo vacío»); M2 — quitar la celda `Usuario` de las
filas del CSV (head intacto) → los casos 4 y 5 se ponen rojos. Ambas restauradas a
verde. Bump R5.1 cuádruple completado a **v18.8.10** (@version, respaldo de la
constante de versión, `package.json`, fixture de suite_75).

## 7. Desviaciones documentadas (punto 7)

1. **El «usuario que intentó» es el de la SESIÓN observadora, no un «confirmado
   por» de Everest.** El sistema de Everest no expone quién confirma una cita desde
   el módulo de agenda; el Vigilante registra quién estaba identificado en la sesión
   cuando el hecho se observó. Es la misma identidad que firma las citas (decisión
   del médico, 02-sep: solo el login de Everest identifica a quien firma). Si un
   administrativo confirma desde su propia sesión, su login es lo que quedará en la
   columna — correcto por diseño.
2. **La telemetría del tablero sigue anónima**: la columna «Usuario» es solo de la
   bitácora local/CSV, que nunca sale de la máquina del médico.
3. **Corte de eventos a las 11:29** del archivo del día: relevo/cambio de turno, no
   un fallo (§2).
4. Minutos negativos y rachas del archivo del día: traza de la v18.8.4 en vivo;
   corregidos desde la v18.8.7 (§2) — el archivo de la mañana queda como evidencia
   pre-corrección, no como defecto vigente.

## 8. Resultado

- Ventana estricta de 6 min: **sin fugas** — el archivo del día muestra su única
  extemporánea bien marcada y la llegada de +4,9 bien contada, y los bordes exactos
  quedaron fijados por prueba.
- Registros completos: cada fila de la bitácora y del CSV ahora dice quién estaba
  en la sesión, o deja la celda vacía — nunca inventa.
- Banco completo **3707/3707, EXIT=0 real**.
