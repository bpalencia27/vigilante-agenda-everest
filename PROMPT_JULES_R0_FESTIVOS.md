# TAREA R0 — Festivos colombianos en el cálculo de días hábiles

> **Cómo se usa:** copia este archivo ENTERO y pégalo como única instrucción en Jules.
> Es autocontenido: no hace falta pegar nada más.

---

## 0. TU PAPEL Y EL LÍMITE DE TU TRABAJO

Eres un ingeniero que hace **una sola tarea acotada** en un repositorio ajeno de producción
clínica. No eres el arquitecto de este proyecto: las decisiones ya están tomadas y **no se
re-litigan**. Tu éxito no se mide por cuánto mejoras el repositorio, sino por **cuán exactamente
haces lo pedido y nada más**.

**Esta tarea es pequeña a propósito.** Es la primera de una serie y sirve para verificar que el
proceso funciona. Un PR que hace lo pedido y nada más vale más que uno "mejorado".

---

## 1. CONTEXTO DEL REPOSITORIO

- Repositorio: `vigilante-agenda-everest`.
- Archivo principal: **`vigilante_agenda.user.js`** — un **userscript de Tampermonkey**, **un único
  IIFE de ~11.700 líneas**, sin build, sin dependencias, sin `npm install`.
- Pruebas: `tests/`, sin frameworks. Se corren con **`node tests/runner.js`**.
- **Rama base: `claude/pym-agenda-blindaje-v12-4`**. NUNCA `main`.
- El banco parte de **690 comprobaciones**. Tu PR debe terminar con **691 o más**.
- Antes de empezar: `git fetch origin claude/pym-agenda-blindaje-v12-4` y trabaja desde ahí.
  Si tu base dice 678 u otra cifra, estás en un punto viejo — actualiza.

Este script lo usan médicos reales en consulta. Un error aquí desplaza citas de pacientes.

---

## 2. EL PROBLEMA (por qué existe esta tarea)

El script calcula fechas de citas y de toma de laboratorios saltando **solo sábados y domingos**.
**No conoce los festivos colombianos.** Resultado real: propone citas y tomas de muestras en días
en que la sede está cerrada.

---

## 3. QUÉ HAY QUE HACER, EXACTAMENTE

### 3.1 Añadir la tabla de festivos

Añade una constante con los festivos oficiales de Colombia. **Usa EXACTAMENTE estas fechas.**
No las calcules, no las deduzcas, no consultes ninguna fuente externa, no añadas ni quites
ninguna. Las entrega el médico del proyecto y son la única fuente válida:

```
2026: 01-01, 01-12, 03-23, 04-02, 04-03, 05-01, 05-18, 06-08, 06-15, 06-29,
      07-13, 07-20, 08-07, 08-17, 10-12, 11-02, 11-16, 12-08, 12-25

2027: 01-01, 01-11, 03-22, 03-25, 03-26, 05-01, 05-10, 05-31, 06-07, 07-05,
      07-12, 07-20, 08-07, 08-16, 10-18, 11-01, 11-15, 12-08, 12-25
```

Formato sugerido: un `Set` de cadenas `"AAAA-MM-DD"` para consulta en O(1). Colócala **junto a las
funciones de fecha**, no al principio del archivo.

### 3.2 Añadir una función de consulta

Una función pequeña, de nivel superior (para que el banco de pruebas la descubra sola), que
responda si una fecha es festivo. Debe recibir la fecha en un formato que ya use el archivo y
devolver booleano.

### 3.3 Usarla en los CINCO puntos donde hoy se decide "día hábil"

Estas son las líneas exactas, verificadas el 12-08-2026. Si no cuadran, busca por el patrón
`getDay() !== 0 && ... getDay() !== 6` y **avísalo en el PR**:

| Línea | Función | Qué hace hoy |
|---|---|---|
| **7982** | `calcBusinessTargetDate` (7970) | `const day = d.getDay();` — ajusta la fecha objetivo |
| **8175** | `calcBusinessDaysBefore` (8169) | cuenta días hábiles hacia atrás |
| **8598** y **8607** | `calcTargetDateRange` (8573) | ventana de días previos / siguientes |
| **8643** y **8652** | `calcDateRangeAroundIso` (8618) | ventana alrededor de una fecha ISO |

En cada uno, un día deja de ser hábil **también** si es festivo.

### 3.4 Avisar cuando la tabla se acabe

La tabla cubre 2026 y 2027. A partir de 2028 el script **no puede saber** si una fecha es festivo.

Cuando se consulte una fecha de un año **que no está en la tabla**, el script debe **registrar un
aviso en consola una sola vez** (patrón de "una vez" ya usado en el archivo, busca
`state.warnedTimes` como ejemplo) diciendo que la tabla de festivos caducó y hay que actualizarla.

**NO inventes festivos para años futuros. NO extrapoles.** Un año sin datos se trata como si no
tuviera festivos, pero **avisando**, nunca en silencio.

---

## 4. LO QUE NO DEBES HACER (leer entero antes de escribir código)

Cada punto de esta lista corresponde a algo que ya salió mal antes en este repositorio.

1. **NO cambies la regla de fin de semana.** Hoy se excluyen sábado Y domingo. Aunque veas que el
   protocolo clínico permite sábados en algunos casos, **eso es otra tarea**. R0 **solo suma
   festivos** a la regla existente. Tocar los sábados aquí invalida el PR.
2. **NO reformatees NADA.** Ni Prettier, ni ESLint `--fix`, ni reordenar funciones, ni cambiar
   comillas, ni normalizar indentación, ni "limpiar" imports. Es un IIFE de 11.700 líneas: un
   reformateo hace el diff imposible de revisar y **el PR se descarta entero aunque el cambio de
   fondo sea correcto**.
3. **NO refactorices las cuatro funciones de fecha** para unificarlas, aunque se parezcan. Se
   parecen a propósito y cada una tiene pruebas propias.
4. **NO añadas dependencias** (nada de `date-fns`, `moment`, `dayjs`), ni build, ni TypeScript.
   El archivo se copia tal cual a un Gist y Tampermonkey lo ejecuta: cualquier compilación lo rompe.
5. **NO uses `Intl`, `toLocaleDateString` ni zonas horarias** para decidir el día. El archivo ya
   tiene su forma de manejar fechas locales; sigue el patrón que encuentres allí.
6. **NO toques ningún otro archivo** salvo `vigilante_agenda.user.js`, el archivo de pruebas donde
   añadas casos, y `tests/INFORME_MUTACIONES.md`.
7. **NO borres ni debilites ninguna prueba existente.** Si una se pone roja, es un hallazgo real:
   arréglalo de verdad y explícalo. Ajustar una prueba hasta que pase es la peor forma de romper
   este script.
8. **NO hagas ninguna petición de red** a Everest, Athenea ni AppCita. No tienes credenciales y no
   debes tenerlas.
9. **NO incluyas ningún dato real de paciente** en código, pruebas, comentarios ni descripción del
   PR. Ni nombres, ni cédulas, ni fechas de nacimiento. Usa datos inventados evidentes.
10. **NO amplíes el alcance.** Si ves otro fallo, escríbelo en la descripción del PR como hallazgo
    y **no lo toques**.

---

## 5. PRUEBAS (obligatorio, no es opcional)

Añade casos en **`tests/suite_02_tiempo_fechas.js`** (es la suite de fechas; ya cubre
`calcBusinessTargetDate` y `calcBusinessDaysBefore`).

Casos mínimos:

1. Un festivo entre semana **no** es día hábil. Usa **20 de julio de 2026** (lunes festivo).
2. Un día normal entre semana **sí** es hábil. Usa **21 de julio de 2026** (martes).
3. Una fecha objetivo que cae en festivo **se desplaza** al siguiente día hábil.
4. `calcBusinessDaysBefore` **no cuenta** los festivos al contar hacia atrás.
5. Un año fuera de la tabla (p. ej. 2030) **no revienta**: devuelve un resultado y deja el aviso.
6. **Festivo pegado a fin de semana**: el 17 de agosto de 2026 es lunes festivo, así que un cálculo
   que caiga el sábado 15 debe saltar hasta el **martes 18**, no al lunes 17.

### Prueba de mutación (obligatoria, se verifica en la revisión)

Después de tener todo en verde:
1. Rompe tu propio cambio a propósito (por ejemplo, haz que la función de festivos devuelva
   siempre `false`).
2. Corre el banco y **comprueba que alguna prueba TUYA se pone roja**. Si todo sigue verde, tus
   pruebas no valen: escríbelas mejor.
3. Restaura el código y confirma que vuelve a estar verde.
4. Añade una fila a **`tests/INFORME_MUTACIONES.md`** siguiendo el formato de la tabla que ya está
   ahí (mira las últimas filas).

---

## 6. QUÉ DEBE CONTENER TU PR (formato obligatorio)

Usa **exactamente** estos seis encabezados, en este orden. Un PR sin alguno se devuelve sin leer:

```markdown
## 1. Qué cambié
(lista de funciones tocadas, con su línea)

## 2. Salida COMPLETA del runner
(pega la salida entera de `node tests/runner.js`, incluida la línea final
 "comprobaciones : N pasan". Si el runner muere sin imprimirla, eso es un fallo tuyo
 que debes arreglar ANTES de abrir el PR.)

## 3. Pruebas nuevas
(nombre de cada caso añadido y qué comprueba)

## 4. Mutación aplicada
(qué línea rompiste, qué prueba lo detectó, y confirmación de que restauraste)

## 5. Verificación de alcance
(pega la salida de `git diff --stat` contra la rama base y confirma que solo aparecen
 los archivos permitidos)

## 6. Hallazgos NO tocados
(cualquier otro problema que hayas visto y hayas dejado en paz, o "ninguno")
```

---

## 7. AUTOVERIFICACIÓN ANTES DE ABRIR EL PR

Responde estas preguntas **por escrito, para ti mismo**, y si alguna da "no", arréglalo antes:

1. ¿El banco está en **691 o más** comprobaciones, y en verde?
2. ¿`git diff --stat` muestra **solo** `vigilante_agenda.user.js`, un archivo de `tests/` y
   `tests/INFORME_MUTACIONES.md`?
3. ¿El diff del userscript son **decenas** de líneas, no cientos? (Si son cientos, reformateaste
   sin darte cuenta: revisa.)
4. ¿La regla de sábado y domingo quedó **exactamente igual** que antes?
5. ¿Rompí mi cambio y vi una prueba **mía** en rojo?
6. ¿Hay algún dato de paciente real en algún sitio? (Debe ser **no**.)
7. ¿Añadí alguna dependencia o herramienta? (Debe ser **no**.)

---

## 8. SI TE ATASCAS

- **¿Una línea no coincide con lo que dice §3.3?** Búscala por el patrón, úsala y **avísalo** en
  la sección 6 del PR. No te inventes dónde estaba.
- **¿Una prueba existente falla y no entiendes por qué?** Párate. Descríbelo en el PR y **no
  modifiques la prueba**.
- **¿Crees que la tarea exige tocar algo de la lista del §4?** Párate y explícalo en el PR sin
  tocarlo. Es una respuesta válida y correcta.

**Regla final:** ante cualquier duda, el cambio más pequeño que cumple lo pedido es el correcto.
