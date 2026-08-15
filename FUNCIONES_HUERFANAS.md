# Funciones Huérfanas (Sin llamadas en producción)

## Método de la Auditoría

- **Base de escaneo:** Rama `claude/v14-continuacion` (commit actual, no la base congelada).
- **Herramienta utilizada:** Script en Node.js que construye un AST del código fuente utilizando la librería `acorn` y `acorn-walk`.
- **Declaraciones examinadas:** Se analizaron un total de **441** declaraciones de funciones.
- **Formas cubiertas:**
  - `function nombre() {}` (383 declaraciones)
  - `const/let nombre = () => {}` y `const/let nombre = function() {}` (50 declaraciones flecha o expresiones anónimas asignadas)
  - Declaraciones de propiedades en objetos como `nombre: function() {}` o `nombre: () => {}` (8 declaraciones)
- **Exclusiones aplicadas:**
  - Funciones genéricas del ciclo de vida y arrays que son llamadas nativamente por el navegador o librerías: `onload`, `onerror`, `ontimeout`, `constructor`, `subscribe`, `set`, `push`.
  - Exportaciones específicas usadas exclusivamente para el test harness (`__VGL__`).
  - Llamadas recursivas (la función invocándose a sí misma no cuenta como llamada de producción si nadie más la invoca).

## Tabla de Resultados

A continuación, se listan todas las funciones declaradas en `vigilante_agenda.user.js` que no tienen referencias en el código de producción.

| Función | Línea | Categoría | Qué creo que iba a hacer (Análisis) |
| :--- | :--- | :--- | :--- |
| `_conductaBuscarYAgregarExamen` | 1241 | Deuda muerta | Iba a buscar en el DOM de la UI elementos `<li>` que coincidieran de forma exacta con un nombre de laboratorio, y les iba a hacer click para agregarlos. Su diseño intentaba evitar falsos positivos. |
| `vigenciaPorEstadio` | 3286 | Deuda muerta | Iba a calcular la vigencia en días/meses permitida para un analito específico basándose en el estadio (ej. ERC), verificando precondiciones como el programa o si el paciente padece de DM2. |
| `analitoTablaDesdeClaveRcv` | 3316 | Deuda muerta | Iba a servir como un mapa de traducción seguro para convertir las claves nativas del sistema RCV (`CREATININA`) a las llaves semánticas de la tabla local en el script (`creatinina`). |
| `_getRacGuardiaParaTest` | 3366 | Costura de prueba | Función diseñada exclusivamente para exponer el estado interno de la guarda `_racGuardia` al conjunto de tests (__VGL__). |
| `_setRacGuardiaParaTest` | 3367 | Costura de prueba | Función diseñada para permitir a los tests inyectar valores manipulados dentro del estado `_racGuardia` y simular escenarios. |
| `debounceVgl` | 3823 | Deuda muerta | Utilidad genérica clásica de `debounce` para retrasar la ejecución de una función, útil para mitigar repeticiones de flujos rápidos. |
| `_getUltimoRelevoParaTest` | 4280 | Costura de prueba | Función de helper diseñada para que el entorno de test pudiera leer la variable `_ultimoRelevoVisibilidad`. |
| `_setUltimoRelevoParaTest` | 4281 | Costura de prueba | Función de helper diseñada para alterar el valor de la variable de estado `_ultimoRelevoVisibilidad` durante simulaciones en los tests. |
| `panelActivities` | 4387 | A medio enganchar | Iba a filtrar una lista de etiquetas/actividades removiendo ramas no pertinentes. Se mantiene sin llamador aquí porque los comentarios del código indican expresamente que "T5 la reconecta para el propio widget". |
| `_getFirmaPropiaParaTest` | 5346 | Costura de prueba | Función de helper de tests para leer el estado del token interno `_firmaPropia`. |
| `_setFirmaPropiaParaTest` | 5347 | Costura de prueba | Función de helper para inyectar o alterar el valor de `_firmaPropia` desde la suite de pruebas. |
| `apiDigiturnoFinalizarTicket` | 10230 | Deuda muerta | Iba a hacer un request por XHR/fetch hacia la API `ApiIntegracionEverestDigiturno` para indicar la conclusión del ticket del paciente, con capacidad de escritura. |
| `_signosVitalesInvalidar` | 10299 | Deuda muerta | Iba a destruir/limpiar la caché interna `_signosVitalesCache` reiniciando su TS y vaciando sus datos. |
| `apiHcValidacionExamenCronicos` | 10315 | Deuda muerta | Iba a hacer una petición a la API de la IPS (GetValidacionExamenCronicos). Esta es una segunda vía abandonada, ya que la tabla oficial ya llega por el interceptor `_instalarOyenteTablaOficial` que intercepta las peticiones que hace Everest nativamente. |
| `_demograficosInvalidar` | 10459 | Deuda muerta | Iba a limpiar la caché interna demográfica del paciente para obligar a un re-fetch. Su definición no tiene ningún llamador en el código. **(Acierto del analizador J3)**. |
| `calcTargetDateRange` | 10936 | A medio enganchar | Deriva un objeto de rango de fechas (±3 días hábiles). Aunque está huérfana en este hilo de ejecución principal, comentarios en el código advierten: "No se borra calcTargetDateRange: T5 la usa vía openLabSoloModal". |
| `extractAgrupador` | 12839 | Deuda muerta | Función recursiva que iba a localizar el nodo `agrupador` en respuestas de payload JSON lidiando con anidación. |

---

## Análisis de los 3 invalidadores (Hallazgos J3)

Como se solicitó en el requerimiento original, a continuación está el análisis explícito de los 3 invalidadores reportados por el linter J3, revelando discrepancias en el análisis estático de este último:

1. **`_demograficosInvalidar`**
   - **Veredicto:** ✅ Coincide con J3 (Huérfana real).
   - **Observaciones:** Realmente **no tiene** llamador en todo el archivo. Su declaración no tiene referencias y es listada en la tabla superior.
2. **`_ordenesVigentesInvalidar`**
   - **Veredicto:** ⚠️ Discrepancia hallada.
   - **Observaciones:** J3 indica que no tiene llamador o está sin cubrir. Sin embargo, en el AST consta que **SÍ** está siendo llamada en la **línea 4062** dentro de un bloque blindado: `try { _ordenesVigentesInvalidar(); } catch (e) {}`. Si J3 asume que está huérfana, es un falso positivo al no analizar o ignorar los bloques `try...catch`.
3. **`_bannerPymInvalidar`**
   - **Veredicto:** ⚠️ Discrepancia hallada.
   - **Observaciones:** Al igual que la anterior, sí existe llamador registrado en el AST en la **línea 4061**: `try { _bannerPymInvalidar(); } catch (e) {}`. Aunque el comentario superior documenta que "NADIE la llamaba (salía como 'sin cubrir')", actualmente la invocación **sí existe** y se encuentra amarrada con `_ordenesVigentesInvalidar`.
