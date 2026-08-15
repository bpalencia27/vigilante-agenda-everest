# Dónde está cada cosa — 14 de agosto de 2026, 22:30

Esta rama queda **congelada** a partir de aquí, y conviene saber por qué antes de
empujarle nada.

## Por qué

Hay un enjambre de agentes corriendo en Antigravity el superprompt de
endurecimiento a producción, y su requisito R0.0 fija la identidad del artefacto:
`@version` igual a `14.1.4`, entre 13.900 y 14.100 líneas. Mientras ese enjambre
arrancaba, esta rama avanzó a **v14.1.6** y **14.258 líneas**. Su foto de partida
dejó de coincidir con la rama.

Seguir empujando aquí les encarece el re-basado en cada compuerta, y tres de los
commits nuevos tocan justo el código que ellos auditan —`injectLabsIntoCronicos`
y el latido de liderazgo entre pestañas—, así que la reconciliación no sería
mecánica.

## Cómo queda repartido

| | Rama | Qué contiene |
|---|---|---|
| **Base estable** | `claude/pym-agenda-blindaje-v12-4` | v14.1.6, 982 comprobaciones en verde. **No recibe commits nuevos.** Es la base de los PR de Jules y el punto de re-basado del enjambre. |
| **Trabajo en curso** | `claude/v14-continuacion` | Todo lo que siga saliendo de esta línea de trabajo. |

Los PR abiertos de Jules siguen apuntando a esta rama y no hay que moverlos: que
la base deje de moverse es precisamente lo que hacía falta para poder revisarlos
y fusionarlos con calma.

## Qué hay en v14.1.6 que no había en v14.1.4

Por si alguien reconstruye la historia después. Los tres primeros son de
consecuencia clínica:

- **`916f406`** — cruce de pacientes en Auto-Labs. `injectLabsIntoCronicos`
  buscaba las casillas por id global sin ninguna referencia del paciente; entre
  pedir los laboratorios y escribirlos pasan 2-4 s de red, y si el médico abría
  otra historia en ese lapso los resultados de un paciente se escribían en la
  historia de otro. Y la guarda de la RAC, que reescribía sin descanso lo que el
  médico borraba a propósito.
- **`75eade8` / `58f55ae`** — las tres causas de los avisos tardíos: el liderazgo
  entre pestañas no miraba visibilidad y el navegador estrangula los
  temporizadores de las pestañas ocultas; la siembra vivía por pestaña y se
  tragaba avisos enteros al relevarse; y el tono y la notificación del sistema
  estaban condicionados al módulo, cuando existen justo para cuando el médico NO
  está mirando esa pantalla.
- **`e6746ab`** — el cazador de errores llevaba una semana sin cazar nada. La
  hoja `error` del tablero no existía, y el servidor la crea al primer evento: no
  había llegado ninguno en 20 equipos y 6 días.
- **`bb18d83`** — el tablero guardaba las versiones convertidas en fecha
  (`12.10.7` → `12.10.2007`), así que 14 de 20 equipos salían como «versión no
  reconocida». Requiere redesplegar el Apps Script a mano.
- **`a10d3ab`, `fe909cc`, `e6e94a2`** — el mapeador del DOM y de la red de
  Everest. No es código de producción: no se distribuye con el userscript.
