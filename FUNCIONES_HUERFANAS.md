# Funciones Huérfanas (Sin llamadas en producción)

A continuación, se listan todas las funciones declaradas en `vigilante_agenda.user.js` que no tienen referencias en el código de producción. Solo se incluyen llamadas dentro del código fuente real, ignorando las llamadas de tests (`harness.js`) y las referencias exportadas en `__VGL__`.

| Función | Línea | Qué creo que iba a hacer (Análisis) |
| :--- | :--- | :--- |
| `_conductaBuscarYAgregarExamen` | 1241 | Iba a buscar en el DOM de la UI elementos `<li>` que coincidieran de forma exacta con un nombre de laboratorio, y les iba a hacer click para agregarlos. Su diseño intentaba evitar falsos positivos ("casilla vacía antes que clic inventado"). |
| `vigenciaPorEstadio` | 3010 | Iba a calcular la vigencia en días/meses permitida para un analito específico basándose en el estadio (ej. ERC), verificando precondiciones como el programa o si el paciente padece de diabetes tipo 2. |
| `analitoTablaDesdeClaveRcv` | 3040 | Iba a servir como un diccionario seguro (mapa de traducción) para convertir las claves nativas del sistema RCV (`CREATININA`, `UROANALISIS`) a las llaves semánticas de la tabla local en el script (`creatinina`, `parcial_orina`), devolviendo `null` si no la encontraba. |
| `_getRacGuardiaParaTest` | 3090 | Función de _helper_ diseñada exclusivamente para exponer el estado interno de la guarda `_racGuardia` al conjunto de tests (__VGL__), que controla intentos de borrado de la RAC. |
| `_setRacGuardiaParaTest` | 3091 | Función de _helper_ que iba a permitir a los tests inyectar valores manipulados dentro del estado `_racGuardia` para simular escenarios (por ejemplo en el guardado de laboratorios). |
| `debounceVgl` | 3545 | Utilidad genérica clásica de `debounce` para retrasar la ejecución de una función; útil para mitigar pulsaciones múltiples o repeticiones de flujos rápidos, limitándolo mediante temporizadores. |
| `_getUltimoRelevoParaTest` | 4002 | Función de _helper_ diseñada para que el entorno de test (__VGL__) pudiera leer la variable `_ultimoRelevoVisibilidad` usada en el sistema interno de heartbeat. |
| `_setUltimoRelevoParaTest` | 4003 | Función de _helper_ diseñada para alterar el valor de la variable de estado `_ultimoRelevoVisibilidad` durante la ejecución de simulaciones en los tests. |
| `panelActivities` | 4109 | Iba a filtrar una lista de etiquetas/actividades, removiendo ramas que no pertenecían a la visión principal del médico general (por ejemplo las de optometría u odontología) al analizar la estructura del panel de pendientes. |
| `_getFirmaPropiaParaTest` | 5068 | Función de _helper_ de tests para leer el estado del token interno `_firmaPropia`, determinando si se ha firmado que se interactuó con el marco de la página activa. |
| `_setFirmaPropiaParaTest` | 5069 | Función de _helper_ para inyectar/alterar el valor de `_firmaPropia` desde la suite de pruebas. |
| `apiDigiturnoFinalizarTicket` | 9952 | Iba a hacer un request por XHR/fetch hacia la API `ApiIntegracionEverestDigiturno` para indicar al sistema en background la conclusión del ticket del paciente (`FinalizarTicket`), codificando el ID de cita en Base64 y usando el ID de usuario activo. |
| `_signosVitalesInvalidar` | 10021 | Iba a destruir/limpiar la caché interna `_signosVitalesCache` reiniciando su TS y vaciando sus datos. Esto forzaría a que la función que obtiene los signos vitales hiciera otro fetch HTTP si se llamaba. |
| `_demograficosInvalidar` | 10071 | **[Veredicto: Acierto de J3]** Iba a limpiar la caché interna demográfica del paciente para obligar a un re-fetch. Su definición no tiene absolutamente **ningún** llamador en el código (ni siquiera dentro de los `try...catch` de invalidación). |
| `calcTargetDateRange` | 10548 | Iba a derivar un objeto de rango de fechas de agendamiento estableciendo un ±3 días hábiles a partir de un offset de meses y días indicado en los parámetros, sirviendo de soporte al calculador de rangos. |
| `extractAgrupador` | 12451 | Función recursiva que iba a localizar el nodo `agrupador` en respuestas de payload JSON (de Atheneas u otros requests de ordenamiento) lidiando con el hecho de que a veces venía en un array anidado o un string embebido. |

---

## Análisis de los 3 invalidadores (Hallazgos J3)

Como se solicitó, a continuación está el análisis explícito de los 3 invalidadores, revelando las siguientes discrepancias:

1. **`_demograficosInvalidar`**
   - **Veredicto:** ✅ Coincide con J3.
   - **Observaciones:** Realmente **no tiene** llamador en todo el archivo. Es una función completamente huérfana de producción.
2. **`_ordenesVigentesInvalidar`**
   - **Veredicto:** ⚠️ Discrepancia hallada.
   - **Observaciones:** J3 indica que no tiene llamador o está sin cubrir, sin embargo mi rastreo AST encuentra que **SÍ** está siendo llamada en la **línea 3784** dentro de un bloque blindado: `try { _ordenesVigentesInvalidar(); } catch (e) {}`. Si J3 asume que está huérfana es probablemente un falso positivo del analizador o del linter anterior al no seguir flujos dentro de `try...catch`.
3. **`_bannerPymInvalidar`**
   - **Veredicto:** ⚠️ Discrepancia hallada.
   - **Observaciones:** Al igual que la anterior, mi rastreo AST muestra que **SÍ** está siendo llamada en la **línea 3783**: `try { _bannerPymInvalidar(); } catch (e) {}`. El comentario inmediatamente superior (línea 3780) indica explícitamente: _"_bannerPymInvalidar existía desde T7 y NADIE la llamaba (salía como 'sin cubrir' en el runner)."_ pero actualmente, la llamada sí existe y está enganchada junto a `_ordenesVigentesInvalidar`.
