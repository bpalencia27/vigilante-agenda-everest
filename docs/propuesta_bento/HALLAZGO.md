# Propuesta de rediseño "Bento Box" — medida, y descartada

**Fecha:** 29-ago-2026 · **Estado: NO APLICADA.** Ninguna línea de esta propuesta llegó a
`vigilante_agenda.user.js`.

## De dónde salió

El médico había rechazado tres rondas de rediseño visual y su veredicto quedó anotado en
`docs/BACKLOG_PENDIENTE_20260828.md` (punto 10): *"no me gustan, se ve más lindo el actual
que todas esas propuestas"*. Después autorizó explícitamente correr una propuesta más:
*"no importa, correlo y me muestras el diseño antes y hacer un backup obviamente"*.

Respaldo hecho antes de nada: copia en `respaldos/` (fuera del repo) y el commit `99525bf`,
ya en el remoto. El tag `respaldo-antes-rediseno-v17.41.0` existe en local; empujarlo al
remoto lo rechazó el proxy con 403, así que el respaldo real es el commit.

## Por qué se descartó: tres medidas, no tres opiniones

Se generó una comparación **con el CSS real del script** (227 KB, con las hojas
interpoladas resueltas — nunca una copia recortada a mano) y se midió en Chromium real.

### 1. La propuesta no se aplica siquiera

La regla propuesta era `#vgl-cw-examenes .vgl-cw-panel{display:grid}` — especificidad
**(1,1,0)**. Ya existe `#vgl-cw-examenes.vgl-cw-abierto .vgl-cw-panel{display:block}`
(`vigilante_agenda.user.js:13567`), especificidad **(1,2,0)**, que le gana.

Chromium confirma que el panel se queda en `display:block` y la rejilla **nunca ocurre**.

Es **exactamente el bug #1 que `CLAUDE.md` documenta** en su sección de CSS: *"nuestra
propia regla vieja gana por especificidad a nuestra propia regla nueva"*. El proyecto ya lo
había sufrido con el botón ámbar T1 y con `#vgl-postcita-panel`/`#vgl-labsv-modal` en la
v12.10.2, y lo dejó escrito en el manual. La propuesta lo reintrodujo.

### 2. Si se forzara a aplicarse, empeoraría

Medido en Chromium, con los mismos 6 exámenes:

| | Hoy | Con Bento | |
|---|---|---|---|
| Alto de cada fila | 40 px | **52 px** | +30 % |
| Alto total del contenido | 287 px | **334 px** | +16 % |
| `max-height` del panel (`:13565`) | 260 px | 260 px | sin cambio |

El panel ya se corta hoy (287 > 260). Con Bento se corta **más**: el médico vería **menos
exámenes** de un vistazo antes de tener que desplazarse. En un widget cuyo único trabajo es
decirle qué falta pedir, eso es una regresión funcional, no un cambio estético.

### 3. Las dos columnas no caben en el ancho real

En la comparación el panel medía 548 px porque no está anclado a nada. En consulta real
cuelga del botón "Paquetes" de Everest y es estrecho. Dos columnas dejarían ~130 px por
tesela, donde "HEMOGLOBINA GLICOSILADA" se parte en tres renglones — que es justamente de
dónde salen los 52 px de alto por fila del punto 2.

## Lo que sí valía de esa auditoría, y sí se aplicó

La misma auditoría de CSS produjo hallazgos reales, independientes del rediseño:

- **Aplicado en la v17.44.0:** las seis reglas de color de `#vgl-pym-banner` (fuera de
  `#vgl-root`) se defendían solo por especificidad y perdían contra cualquier regla de
  Everest con `!important`. Una de ellas, `.vgl-pymb-aviso`, es un aviso clínico.
  Verificado en Chromium en las dos direcciones.
- **Pendiente:** el panel de fármacos se sale ~32 px de la ventana en 1366×768
  (`mtrPosicionPanelJuntoA` recibe ancho 280 pero el CSS declara `max-width:320px`).
- **Pendiente:** el pulso `.vgl-cw-atencion` anima `box-shadow` en vez de `transform`/
  `opacity`, así que repinta en CPU en lugar de componer en GPU.
- **Pendiente:** faltan 121 declaraciones de color/fondo sin `!important` fuera de
  `#vgl-root`, del mismo patrón que las seis ya corregidas.
- **Confirmado sano:** el contraste de toda la paleta cumple WCAG AA en los dos temas
  (peor caso medido 5,01 frente al 4,5 exigido). El problema nunca fue la paleta.

## Cómo reproducir esto

```
node tools/generar_comparacion_bento.js     # escribe docs/propuesta_bento/index.html
```

El HTML generado (~470 KB, porque incrusta la hoja real dos veces) **no se versiona**: está
en `.gitignore` y se regenera con el comando de arriba. Lo que sí queda como evidencia es
`vista.png`, la captura de la comparación.
