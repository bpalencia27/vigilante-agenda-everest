## 2026-08-08T18:30:48Z
You are Worker 1 working on Milestone 2 for the Athenea API Bridge project.

Your Working Directory: c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\.agents\worker_m2
Project Root: c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda
Target Module Directory: c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\athenea_api_bridge

Skill to follow: Read `C:\Users\viva1a\.gemini\config\skills\playwright_windows_automation\SKILL.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

OBJECTIVE:
Build the complete local Python FastAPI microservice `athenea_api_bridge` using Playwright in async headless mode on `http://localhost:5050`.

REQUIREMENTS:
1. Create directory `c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\athenea_api_bridge`.
2. Create `config.py`:
   - Host: `127.0.0.1` (or `0.0.0.0`), Port: `5050`
   - Athenea Base URL: `https://medicosviva1a.atheneasoluciones.com`
   - Credentials: Username `CONSULTAMED`, Password `Viva1a*md04`
   - Timeout & Headless configuration (`HEADLESS=True`).
3. Create `requirements.txt`:
   ```txt
   fastapi>=0.110.0
   uvicorn[standard]>=0.28.0
   playwright>=1.42.0
   pydantic>=2.6.0
   ```
4. Create `athenea_service.py`:
   - Class `AtheneaService` managing async Playwright browser context lifecycle (`playwright.async_api`, `headless=True`).
   - Implement `get_id_solicitud(documento: str) -> int`:
     - Navigates to `https://medicosviva1a.atheneasoluciones.com/Resultados/BuscarPaciente`.
     - Detects login page (`#Username` field visible) and auto-logins with `CONSULTAMED` / `Viva1a*md04`.
     - Fills `#NumeroIdentificacion` with `documento` and clicks search button.
     - Intercepts XHR `/Resultados/consultaDetalleSolicitud` or parses DOM for "Ver Resumen" `span.cursor-pointer`.
     - Returns integer `idSolicitud`.
     - Handles errors (patient not found, timeout) cleanly.
5. Create `main.py`:
   - FastAPI app with CORS middleware (allowing GET requests from Tampermonkey/all origins).
   - GET `/ping`: returns `{"status": "ok"}` with 200 OK status code.
   - GET `/api/buscar_laboratorios?documento={documento}`:
     - Calls `athenea_service.get_id_solicitud(documento)`.
     - Returns `{"idSolicitud": 123456}` JSON on success (200 OK).
     - Returns `{"error": "..."}` JSON on failure (404 Not Found or 500 Internal Server Error).
   - `if __name__ == '__main__': uvicorn.run(...)` entry point.
6. Create unit/integration test script `test_service.py`:
   - Tests `/ping` endpoint.
   - Tests `/api/buscar_laboratorios` request structure and error handling.
   - Runs test suite using `python test_service.py` via `run_command` and documents outputs.

ACCEPTANCE CRITERIA:
- Running `python test_service.py` or starting the microservice and calling `/ping` returns HTTP 200 `{"status": "ok"}`.
- `/api/buscar_laboratorios?documento=XXX` returns valid JSON `{"idSolicitud": ...}`.
- Response time for searches targets < 10 seconds.
- All code is clean, robust, fully functional, and genuinely implemented.

Deliverables:
- All source files in `c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\athenea_api_bridge/`
- Handoff report in `c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\.agents\worker_m2\handoff.md` with build/test execution logs.
- Send a message to parent when complete.
