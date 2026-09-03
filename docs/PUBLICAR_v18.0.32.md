# Publicar la v18.0.32 — paso a paso, sin adivinar nada

**Estado de la flota (medido, telemetría de 74 equipos / 23 activos en 3 días):**
12 en `v17.0.2`, 10 en `v18.0.x`, 1 en `v17.28.0`. Los 12 de la v17.0.2 **no han recibido
ninguno** de los arreglos de esta jornada.

---

## EL BLOQUEO QUE HAY QUE CONOCER ANTES DE EMPEZAR

Hasta el commit `62c09c2` (31-ago), la cabecera del userscript decía:

```
// @updateURL    .../raw/gistfile2.txt      ← lo que Tampermonkey consulta
```

y desde ese commit dice `gistfile1.txt`.

**Consecuencia:** los equipos que instalaron ANTES de ese cambio —los 12 de la v17.0.2 entre
ellos— tienen Tampermonkey sondeando **gistfile2**, no gistfile1. Los que instalaron después
sondean **gistfile1**.

> **Por eso hay que publicar el MISMO contenido en LOS DOS archivos del Gist.**
> Si solo se actualiza uno, la mitad de la flota no se entera nunca. Esto no es precaución:
> es la explicación de por qué 12 equipos llevan versiones atrás.

---

## Paso 1 — Copiar el archivo bueno

Abrir, en la rama `claude/pym-activities-display-issue-cki2ew`:

```
https://raw.githubusercontent.com/bpalencia27/vigilante-agenda-everest/claude/pym-activities-display-issue-cki2ew/vigilante_agenda.user.js
```

Seleccionar todo (Ctrl+A) y copiar (Ctrl+C).

**Comprobación antes de seguir:** la línea 4 debe decir exactamente `// @version      18.0.32`.

## Paso 2 — Pegarlo en LOS DOS archivos del Gist

Gist: `https://gist.github.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91`
→ **Edit**

1. En **`gistfile1.txt`**: seleccionar todo el contenido viejo y pegar el nuevo encima.
2. En **`gistfile2.txt`**: lo mismo, **el mismo contenido**.
3. **Update secret gist**.

> Si el Gist solo tiene un archivo visible, hay que crear el segundo con el nombre exacto
> `gistfile2.txt`. Sin él, los 12 equipos de la v17.0.2 se quedan donde están.

## Paso 3 — Verificar que el CDN ya sirve la versión nueva

Abrir las dos URL en el navegador y mirar la línea 4 de cada una:

```
https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt
https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile2.txt
```

Las dos tienen que decir `18.0.32`. El CDN de GitHub tarda entre 1 y 15 minutos en propagar:
si todavía sale la vieja, recargar con **Ctrl+F5** y esperar. **No seguir al paso 4 hasta que
las dos digan 18.0.32.**

## Paso 4 — Subir el mínimo en el Apps Script (esto es lo que avisa a los compañeros)

Abrir el proyecto de Apps Script del `VersionCheck` y pegar el contenido de
`TABLERO/VersionCheck.gs` (ya está actualizado en el repo: `MIN_VERSION = "18.0.32"`).

Después — **y este paso se olvida siempre** — hay que **volver a desplegar**:

**Implementar → Gestionar implementaciones → (lápiz de editar) → Versión: Nueva versión →
Implementar.**

Guardar el archivo NO publica nada. Sin una implementación nueva, la web app sigue sirviendo
el código viejo y `MIN_VERSION` se queda en 18.0.4.

**Comprobación:** abrir la URL del `/exec` en el navegador. El JSON debe traer
`"minVersion":"18.0.32"`.

## Paso 5 — Probar en su propio equipo

Tampermonkey → **Utilidades** (o el menú del script) → **Buscar actualizaciones**.
Debe pasar a 18.0.32. Recargar Everest y confirmar que el panel arranca.

## Paso 6 — Lo que van a ver los compañeros (y qué decirles)

Con `MIN_VERSION` en 18.0.32, cualquier equipo atrasado va a ver, **en la barra del propio
Vigilante**, uno de estos dos mensajes:

- `🔄 Vigilante se actualiza a v18.0.32...` → se recarga solo. No hay que hacer nada.
- `📦 Hay una versión nueva (v18.0.32). Actualícela desde el Menú de Tampermonkey →
  «Buscar actualizaciones del complemento».` → **ahí sí hay que hacer clic**.

El segundo mensaje sale cuando Tampermonkey todavía no ha descargado el archivo nuevo. Es
importante entender por qué, para no prometer de más:

> **El endpoint de Apps Script NO descarga nada.** Solo compara versiones y recarga la
> pestaña. Quien descarga el código nuevo es Tampermonkey, con su propio sondeo contra
> `@updateURL` — y por defecto ese sondeo es **una vez al día**.

Por eso el mensaje del paso 6 es la pieza que hace que mañana estén todos: le dice a cada
compañero, en su pantalla, exactamente qué botón pulsar sin esperar el ciclo de Tampermonkey.

**Mensaje para el grupo (copiar y pegar):**

> Actualicé el asistente. Si les sale en la barra del Vigilante un aviso que dice «Hay una
> versión nueva (v18.0.32)», abran el ícono de Tampermonkey arriba a la derecha → «Buscar
> actualizaciones del complemento», y recarguen Everest. Con eso queda. Si no les sale ningún
> aviso, háganlo igual una vez, por si acaso.

## Paso 7 (opcional, pero es lo que evita repetir todo esto)

En cada equipo, una sola vez: **Tampermonkey → Ajustes → Modo de configuración: Avanzado →
Actualización → Intervalo de comprobación de scripts: Cada hora** (viene en «Cada día»).

Con eso, la próxima publicación llega sola en menos de una hora y el paso 6 deja de hacer falta.

---

## Si algo sale mal

- **Un equipo se queda en la versión vieja pese a todo:** desinstalar el script en Tampermonkey
  y volver a instalarlo abriendo la URL de `gistfile1.txt` (Tampermonkey ofrece instalar). Esto
  además le corrige el `@updateURL` a gistfile1 para siempre.
- **Hay que echar atrás la v18.0.32:** Tampermonkey **solo actualiza hacia arriba**. No sirve
  restaurar el Gist al contenido anterior: hay que publicar el código anterior con un número
  MAYOR (p. ej. `18.0.33`), y bajar `MIN_VERSION` a esa misma. Está en `docs/ROLLBACK.md`.

---

## Qué reciben con esta versión

Cerrado y blindado con mutación verificada desde la v18.0.14:

- La casilla de **hemoglobina** dejaba de recibir el HCM, el CHCM o la HbA1c según el orden en
  que el laboratorio devolviera las filas (v18.0.31).
- El **parcial de orina** cerraba el caso sin urocultivo por dos caminos distintos (v18.0.32).
- **Auto-Labs** ofrecía «Deshacer» tras escribir cero casillas y borraba el lote anterior —el
  examen físico ya aceptado— y la rama del apagado era completamente muda (v18.0.30).
- **Fuga de PHI a Gemini** por la cosecha en vivo de la pantalla (v18.0.15).
- El **CSS de Everest** secuestraba 125 declaraciones de color del asistente (v18.0.14, v18.0.16).
- El **aviso de actualización leía un archivo distinto del que se instala** (v18.0.19) — el
  defecto que dejó a 12 equipos sin recibir nada.
