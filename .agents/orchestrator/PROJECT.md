# Project: Athenea API Bridge Microservice & Tampermonkey Integration

## Architecture
The system consists of:
1. **Athenea API Bridge Microservice** (`c:/Users/viva1a/Desktop/BRANDON/vigilante_agenda/athenea_api_bridge`):
   - Python FastAPI application running locally on `http://127.0.0.1:5050`.
   - Uses `playwright.async_api` with Chromium (`headless=True`).
   - Endpoint GET `/ping`: returns `200 OK` (`{"status": "ok"}`).
   - Endpoint GET `/api/buscar_laboratorios?documento={documento}`:
     - Launches or reuses Playwright browser context.
     - Navigates to Athenea Soluciones (`https://medicosviva1a.atheneasoluciones.com`).
     - Auto-logins if needed (`CONSULTAMED` / `Viva1a*md04`).
     - Searches for the patient by document ID (`#NumeroIdentificacion`).
     - Clicks "Ver Estado de Resultados" to open patient record on `/Resultados/DatosPaciente`.
     - Extracts the most recent `idSolicitud` from `getDetalleSolicitud(...)` onclick attributes or intercepted XHR requests.
     - Returns JSON: `{"idSolicitud": 374116}` for patient `1017214911`.
     - Response time achieved: **5.9s – 6.0s** (< 10 seconds SLA target).
   - Robust error handling and self-healing Playwright session recovery.

2. **Tampermonkey Script Integration** (`vigilante_agenda.user.js`):
   - Updates existing script to replace manual `prompt()` with automated HTTP GET request to `http://localhost:5050/api/buscar_laboratorios?documento=...`.
   - Uses `GM_xmlhttpRequest` with `@connect localhost` and `@connect 127.0.0.1`.
   - Displays real-time UI toast notifications ("⏳ Buscando idSolicitud en Athenea...") and offers manual fallback if API server is offline.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Exploration & Spec | Investigate codebase, Athenea flow, credentials, selectors, and create design spec | None | DONE |
| 2 | M2: Microservice Implementation | Build FastAPI microservice with Playwright automation in `athenea_api_bridge` | M1 | DONE |
| 3 | M3: Tampermonkey Integration | Update `vigilante_agenda.user.js` to call API Bridge transparently | M2 | DONE |
| 4 | M4: E2E Verification & Audit | Verify microservice endpoints, timing (<10s), Tampermonkey integration, and pass Forensic Audit | M3 | DONE |
| 5 | M5: Phase 2 Exploration & Design Spec | Analyze telemetry JSON files for GuardarJsonHC payload, Clipboard APIs, Git/GitHub PR requirements | M4 | IN_PROGRESS |
| 6 | M6: Tampermonkey Implementation | Inject `ordenarExamenGeneral(diagnosticoId, citaId)`, floating menu item, and Clipboard Bridge (`GM_setClipboard`/`GM_getClipboard`) in `vigilante_agenda.user.js` | M5 | PLANNED |
| 7 | M7: Python Clipboard Watcher | Create `athenea_api_bridge/clipboard_watcher.py` importing `athenea_service.py` to monitor clipboard, run Playwright, write back JSON response | M5 | PLANNED |
| 8 | M8: Phase 2 E2E Verification & Audit | End-to-end verification of telemetry ordering, Clipboard Bridge communication, and Forensic Audit | M6, M7 | PLANNED |
| 9 | M9: Git Setup & GitHub Pull Request | Configure git repo, add remote origin, create branch, commit, push, and open Pull Request on GitHub | M8 | PLANNED |

## Interface Contracts
### Tampermonkey ↔ Athenea API Bridge (Clipboard Bridge - Opción B)
- **Tampermonkey Request**:
  - Script writes document ID string to clipboard via `GM_setClipboard(documentoId)`.
  - Script starts polling clipboard via `setInterval` + `GM_getClipboard` waiting for string starting with `{"idSolicitud":` or containing `idSolicitud`.
- **Python Clipboard Watcher (`clipboard_watcher.py`)**:
  - Script polls clipboard using `pyperclip` or `tkinter`.
  - On detecting a numeric document ID (e.g. `1017214911`), calls `athenea_service.py` (`buscar_laboratorios`).
  - Writes JSON result string `{"idSolicitud": 123456}` to clipboard.

### Tampermonkey ↔ Everest `GuardarJsonHC` Payload Structure
- Payload root `json` object must contain `ordenes` array at root:
  - `{"ordenes": [...], "diagnosticoId": ..., "citaId": ...}`
  - Provisional exams included: Glucosa, Hemoglobina.

## Code Layout
- `athenea_api_bridge/`:
  - `main.py`: FastAPI server setup.
  - `athenea_service.py`: Async Playwright manager handling browser lifecycle, Athenea login, search, extraction logic.
  - `clipboard_watcher.py`: Python clipboard monitoring service integrating with `athenea_service.py`.
  - `config.py`: Configuration.
  - `requirements.txt`: Dependencies.
- `vigilante_agenda.user.js`: Tampermonkey userscript with `ordenarExamenGeneral`, floating menu item, and Clipboard Bridge.

