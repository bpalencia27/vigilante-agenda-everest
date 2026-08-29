# Funciones Huérfanas — ⚠️ DOCUMENTO HISTÓRICO, NO ES UNA LISTA DE BORRADO

> **LEA ESTO ANTES DE USAR ESTE ARCHIVO.**
>
> Este documento se generó el **15-ago-2026** sobre un archivo de **441 declaraciones**.
> Hoy (29-ago-2026, v17.41.0) el archivo tiene **853** declaraciones de nivel superior y
> **201 commits** de por medio. Al reverificarlo entero, **4 de sus 17 entradas estaban
> equivocadas o quedaron obsoletas**, y una de ellas —`_conductaBuscarYAgregarExamen`— es
> hoy el corazón del botón "Ordenar pendientes", con **16 referencias en `suite_71`**.
>
> **Borrar según la tabla original habría eliminado código clínico vivo.**
>
> El error de fondo no es la desactualización: es la **etiqueta «Deuda muerta»**, que
> confunde dos cosas distintas. Este proyecto ya se llevó ese susto —una rama que "parecía
> código muerto" tenía **44 de 242 vectores dorados** dependiendo de ella— y lo dejó
> escrito como regla:
>
> > **Muerta en producción no es lo mismo que sobrante.**
>
> Para decidir si algo se borra hacen falta **tres** estados, no dos:
> - **(A) Muerta confirmada** — cero referencias en TODO el repo (script, `tests/`,
>   `tools/`, `docs/`), ni por nombre, ni por cadena, ni por acceso dinámico. Solo esta
>   categoría es retirable.
> - **(B) Sin llamador de producción, pero viva** — la sostienen las pruebas, o el propio
>   código prohíbe borrarla por escrito. **No se toca.**
> - **(C) Sospechosa** — pocas referencias, o llamada de forma indirecta (`onclick=` dentro
>   de un `innerHTML`, delegación por `data-*`, `window[...]`). **No se toca sin
>   reverificar.**
>
> Un inventario al día se regenera con `node tools/inventario.js` (Node puro, sin
> dependencias) → `docs/MAPA_v14.md` y `docs/DEUDA_v14.md`.

---

## Reverificación del 29-ago-2026

Método: para cada entrada, localizar la definición, contar referencias **excluyendo la
línea de definición, los comentarios y las llamadas recursivas**, y contar las suites que
la ejercitan.

### Entradas que la tabla original marcó «Deuda muerta» y que HOY ESTÁN VIVAS

| Función | Línea hoy | Llamador real de producción | Veredicto |
| :--- | :--- | :--- | :--- |
| `_conductaBuscarYAgregarExamen` | `:24409` | `:24476` — `await _conductaBuscarYAgregarExamen(texto, d)` | **VIVA.** Es el gesto DOM del botón "Ordenar pendientes". 4 suites, 16 refs en `suite_71`. |
| `analitoTablaDesdeClaveRcv` | `:4334` | `:4042` — `const analito = analitoTablaDesdeClaveRcv(key)` | **VIVA.** |
| `panelActivities` | `:8217` | `:26186` — `const pymsPanel = panelActivities(a.pym)` | **VIVA.** Reconectada en v17.22.0 al devolver los chips de PyM a la tarjeta. La tabla original ya avisaba de esto ("T5 la reconecta") y aun así la etiquetó como deuda. |

### Entrada sin llamador, pero cuyo borrado el propio código PROHÍBE por escrito

| Función | Línea hoy | Evidencia | Veredicto |
| :--- | :--- | :--- | :--- |
| `vigenciaPorEstadio` | `:4304` | Comentario en `:4037`: *"`vigenciaPorEstadio` NO se borra: es la transcripcion de la Tabla 50, con filas que…"*. **104 referencias en `suite_28_vigencias_estadio.js`.** | **(B) — NO BORRAR.** Es la transcripción de la Tabla 50 oficial. Sin llamador directo hoy, pero es la fuente de verdad contra la que se contrasta el motor. |

### Entrada ya resuelta desde entonces

| Función | Estado |
| :--- | :--- |
| `calcTargetDateRange` | **Ya no existe.** Retirada en v17.6.10; queda su lápida en `:18578`. |

### Entradas que siguen sin llamador de producción — categoría (B), no (A)

Todas tienen cobertura de pruebas; ninguna es retirable sin decidir antes qué se hace con
su suite. **No son "deuda muerta".**

`debounceVgl` (`:7113`) · `apiDigiturnoFinalizarTicket` (`:17205`) ·
`_signosVitalesInvalidar` (`:17298`) · `apiHcValidacionExamenCronicos` (`:17314`, su única
mención interna es un `console.warn` dentro de sí misma) · `_demograficosInvalidar`
(`:17490`) · `extractAgrupador` (`:23453`, sus 3 referencias son **llamadas recursivas**,
que el método original ya excluía correctamente).

### Costuras de prueba — correctamente clasificadas, y son deliberadas

Las entradas `*ParaTest` de la tabla original (`_getRacGuardiaParaTest`,
`_setRacGuardiaParaTest`, `_getUltimoRelevoParaTest`, `_setUltimoRelevoParaTest`,
`_getFirmaPropiaParaTest`, `_setFirmaPropiaParaTest`) siguen siendo lo que decían: costuras
para que el banco pueda leer o inyectar estado interno. Hoy hay **25** de ellas en el
archivo. Son intencionales.

---

## Nota sobre el método original

`tests/harness.js:225-237` publica **automáticamente todas** las `function NOMBRE` en
`globalThis.__VGL__`. Por eso "solo la referencian los tests" **nunca** implica un enganche
en producción — y por eso separar (A) de (B) exige mirar el código, no solo contar
referencias.

---

## Tabla original (15-ago-2026) — conservada solo como registro

> Se conserva sin editar para que quede constancia de qué se afirmó y cuándo. **Su columna
> "Categoría" no es de fiar**: ver la reverificación de arriba.

- **Base de escaneo:** Rama `claude/v14-continuacion`.
- **Herramienta:** Script Node.js con AST vía `acorn`/`acorn-walk`.
- **Declaraciones examinadas:** 441.

| Función | Línea (de entonces) | Categoría (de entonces) | Qué creo que iba a hacer (Análisis de entonces) |
| :--- | :--- | :--- | :--- |
| `_conductaBuscarYAgregarExamen` | 1241 | Deuda muerta | Iba a buscar en el DOM de la UI elementos `<li>` que coincidieran de forma exacta con un nombre de laboratorio, y les iba a hacer click para agregarlos. |
| `vigenciaPorEstadio` | 3286 | Deuda muerta | Iba a calcular la vigencia en días/meses permitida para un analito según el estadio. |
| `analitoTablaDesdeClaveRcv` | 3316 | Deuda muerta | Iba a servir como mapa de traducción de claves RCV a llaves de la tabla local. |
| `_getRacGuardiaParaTest` | 3366 | Costura de prueba | Exponer el estado interno de `_racGuardia` al banco. |
| `_setRacGuardiaParaTest` | 3367 | Costura de prueba | Inyectar valores en `_racGuardia` para simular escenarios. |
| `debounceVgl` | 3823 | Deuda muerta | Utilidad genérica de `debounce`. |
| `_getUltimoRelevoParaTest` | 4280 | Costura de prueba | Leer `_ultimoRelevoVisibilidad`. |
| `_setUltimoRelevoParaTest` | 4281 | Costura de prueba | Alterar `_ultimoRelevoVisibilidad`. |
| `panelActivities` | 4387 | A medio enganchar | Filtrar actividades removiendo ramas no pertinentes. "T5 la reconecta". |
| `_getFirmaPropiaParaTest` | 5346 | Costura de prueba | Leer `_firmaPropia`. |
| `_setFirmaPropiaParaTest` | 5347 | Costura de prueba | Alterar `_firmaPropia`. |
| `apiDigiturnoFinalizarTicket` | 10230 | Deuda muerta | Cerrar el ticket del paciente en Digiturno. |
| `_signosVitalesInvalidar` | 10299 | Deuda muerta | Limpiar `_signosVitalesCache`. |
| `apiHcValidacionExamenCronicos` | 10315 | Deuda muerta | Segunda vía abandonada: la tabla oficial ya llega por `_instalarOyenteTablaOficial`. |
| `_demograficosInvalidar` | 10459 | Deuda muerta | Limpiar la caché demográfica. |
| `calcTargetDateRange` | 10936 | A medio enganchar | Rango de ±3 días hábiles. "T5 la usa vía openLabSoloModal". |
| `extractAgrupador` | 12839 | Deuda muerta | Localizar recursivamente el nodo `agrupador` en un payload JSON. |
