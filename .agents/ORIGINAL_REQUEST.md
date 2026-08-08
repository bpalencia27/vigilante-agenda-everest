# Original User Request

## 2026-08-08T18:24:38Z

# Teamwork Project Prompt — Draft

> Status: Step 1 — Eliciting project idea
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Desarrollar un microservicio local en Python que utilice Playwright (en modo headless) para automatizar la búsqueda de pacientes en Athenea Soluciones y retornar el `idSolicitud` más reciente, cerrando la brecha de automatización del script actual de Tampermonkey.

Working directory: c:/Users/viva1a/Desktop/BRANDON/vigilante_agenda/athenea_api_bridge

## Requirements

### R1. Servidor Local API
Crear un servidor web ligero (ej. FastAPI o Flask) que escuche en el puerto `localhost:5050` un endpoint GET `/api/buscar_laboratorios?documento=XXX`.

### R2. Automatización con Playwright
Al recibir el documento, el script debe:
1. Abrir Chromium en modo headless.
2. Navegar a Athenea Soluciones (`medicosviva1a.atheneasoluciones.com`).
3. Hacer auto-login si es necesario.
4. Buscar el documento del paciente.
5. Extraer el número de `idSolicitud` del laboratorio más reciente (del código fuente o de la URL del botón "Ver Resumen").
6. Devolver el `idSolicitud` en formato JSON (`{"idSolicitud": 123456}`).

### R3. Integración con el Skill
Asegurar que el script siga las directrices del skill `playwright_windows_automation` (usar `playwright.async_api`, modo headless, manejo adecuado de la sesión 0 de Windows si corre en background).

## Acceptance Criteria

### Funcionalidad API
- [ ] Iniciar el servidor local devuelve `200 OK` en la ruta `/ping`.
- [ ] Al llamar a `/api/buscar_laboratorios?documento=1017214911`, se ejecuta Chromium sin interfaz gráfica, hace la búsqueda y devuelve el `idSolicitud` en menos de 10 segundos.

### Integración Tampermonkey
- [ ] El script `vigilante_agenda.user.js` podrá usar `fetch('http://localhost:5050/api/...');` de forma transparente para conseguir el ID sin usar el `prompt()`.

## 2026-08-08T20:05:28Z

Actualizar el microservicio local y el script de Tampermonkey para implementar la ordenación rápida de exámenes generales (usando el payload `GuardarJsonHC` extraído) y reemplazar la comunicación HTTP (localhost) por un sistema basado en Portapapeles para evadir el bloqueo de Sophos Web Protection. Finalmente, subir los cambios como un Pull Request al repositorio de GitHub del usuario.

Working directory: c:/Users/viva1a/Desktop/BRANDON/vigilante_agenda

## Requirements

### R1. Ordenamiento Rápido General (Tampermonkey)
Inyectar una nueva función `ordenarExamenGeneral(diagnosticoId, citaId)` en `vigilante_agenda.user.js` que replique el payload enviado a `GuardarJsonHC` descubierto en la telemetría.
- El payload debe enviar el arreglo `ordenes` en la raíz del `json`.
- Integrarlo al menú flotante del paciente con una lista provisional (ej. Glucosa y Hemoglobina), ya que el usuario pasará la lista definitiva más tarde.

### R2. Puente vía Portapapeles (Opción B)
Modificar la comunicación entre `vigilante_agenda.user.js` y `athenea_api_bridge` para no depender de `localhost:5050`:
- **Tampermonkey**: La función `getAtheneaIdSolicitudAuto` usará `GM_setClipboard(docId)` y monitoreará el portapapeles con `setInterval` + `GM_getClipboard` esperando un JSON con `idSolicitud`.
- **Python**: Crear un script (ej. `clipboard_watcher.py`) que importe `athenea_service.py` y use `pyperclip` o `tkinter` para leer el portapapeles. Si detecta un documento válido, invoca a Playwright y devuelve el resultado escribiendo `{"idSolicitud": 123456}` al portapapeles.

### R3. Integración y PR en GitHub
Al terminar la implementación, el equipo debe:
- Configurar el repositorio local en la carpeta `vigilante_agenda`.
- Añadir el origen remoto: `https://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@github.com/bpalencia27/vigilante-agenda-everest.git`.
- Hacer commit de los cambios en una nueva rama.
- Subir la rama y crear un Pull Request mediante la API de GitHub o GitHub CLI, utilizando el token provisto (`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`).

## Acceptance Criteria

### Funcionalidad Tampermonkey
- [ ] El script contiene la función `ordenarExamenGeneral` y puede armar correctamente el payload de `GuardarJsonHC`.
- [ ] El script escribe exitosamente en el portapapeles e intercepta la respuesta.

### Funcionalidad Puente Portapapeles
- [ ] El script Python puede detectar un número de documento en el portapapeles, ejecutar Playwright (headless), y retornar el resultado escribiéndolo en el portapapeles.

### GitHub
- [ ] Se ha creado exitosamente un PR en `bpalencia27/vigilante-agenda-everest` con todo el código final, listo para que el usuario lo revise en casa.
