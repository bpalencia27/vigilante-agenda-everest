# Reglas de Contribución para Vigilante de Agenda

Este repositorio está sujeto a reglas estrictas aprendidas de incidentes reales en campo. Al contribuir, debe respetar las siguientes normas. Todas las PRs son evaluadas bajo estos criterios.

## 1. La regla de versión
La versión del script (`@version` en la cabecera y `const VERSION` en el código) DEBEN subir siempre juntas en cada cambio. El proceso de auto-actualización depende de esto. (Ver línea 50: `// --- AUTOACTUALIZACIÓN ---`).

## 2. Flujo de despliegue real
Hacer un merge a `main` **NO** despliega el script en los consultorios. Tampermonkey está configurado para leer de un Gist secreto.
Para desplegar una versión nueva, se debe actualizar el Gist a MANO copiando el contenido, subiendo la versión y haciendo clic en "Update secret gist". (Referencia: `// Activada (v7.4.0): Tampermonkey revisa este Gist secreto solo... Para publicar una versión nueva: editar el Gist`).

## 3. Banco de pruebas propio y DOM falso
*   Se usa un banco de pruebas sin dependencias externas: `node tests/runner.js`.
*   Las funciones del userscript (un IIFE) se exponen mágicamente para las pruebas mediante un *harness* (`tests/harness.js`) que inserta un export temporal antes de la ejecución.
*   **Trampas del DOM falso:** El DOM de pruebas es una simulación mínima. `querySelector` y `getElementById` devuelven señuelos desconectados por defecto. Las asignaciones a `innerHTML` no son observables por las pruebas (solo las asignaciones completas de nodos, si se implementan así) y se deben usar mocks explícitos u omitir pruebas profundamente acopladas al DOM real de Everest si no se inyectan elementos manuales al *harness*.

## 4. Filosofía "Evidencia o no pasó"
*   Jamás asuma que algo funciona sin una prueba en el runner (verde localmente) o evidencia real de campo.
*   **Nombres de API:** Nunca adivinar nombres de campos de APIs o URLs. Todos los payloads y endpoints se extraen de respuestas o interceptaciones reales de la red.

## 5. La regla innegociable de datos clínicos (Incidente v11.0.1)
**JAMÁS inventar valores, fechas ni resultados médicos.** Ante la falta de un dato, deje la casilla vacía, aborte la operación o avise al médico.
*   *Incidente v11.0.1 (Agendamiento sin control):* Anteriormente se cableó `"07:00:00"` como hora por defecto y un `agendaId` estático. Un turno sin datos citaba al paciente en una agenda arbitraria (líneas ~6128, ~6145).
*   *Incidente v11.0.1 (Números falsos):* Se enviaba un teléfono estático de prueba para todos los pacientes, lo que corrompía los registros (línea ~6165).
*   *Incidente v11.0.1 (Validación ignorada):* Se ignoraba el servidor en `AgdValidarAgenda`, agendando pacientes en servicios que los rechazaban (línea ~6241).
*   *Incidente v11.0.1 (Filtro por fecha)*: La respuesta de servidor mezclaba agendas de distintos días; sin filtrar la fecha, se ofrecían turnos equivocados (línea ~6858).
*   *Incidente v11.0.1 (Diagnósticos e identificadores ajenos):* Usar un respaldo por defecto (`|| items[0]`) cuando no se hallaba un código (CUPS o CIE-10) terminaba ordenando exámenes distintos a los solicitados o a pacientes erróneos. (líneas ~6879, ~7092).
*   *Incidente v11.0.1 (Éxito estricto):* Asumir que cualquier respuesta sin error explícito era un éxito (incluso con el cuerpo vacío o mensaje de advertencia) provocaba alertas persistentes y flujos rotos (línea ~7117).
