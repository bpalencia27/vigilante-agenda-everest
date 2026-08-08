# Execution Plan — Phase 2: Ordenamiento Rápido General, Clipboard Bridge & GitHub PR

## Objective
1. Implement `ordenarExamenGeneral(diagnosticoId, citaId)` in `vigilante_agenda.user.js` using Everest `GuardarJsonHC` telemetry payload with `ordenes` array in root of `json` (provisional exams: Glucosa, Hemoglobina) and integrate into patient floating menu.
2. Implement Clipboard Bridge (Option B) between Tampermonkey (`GM_setClipboard` + `GM_getClipboard`) and Python (`athenea_api_bridge/clipboard_watcher.py` + `athenea_service.py`).
3. Configure local git repo in `vigilante_agenda`, commit changes, push to GitHub remote (`https://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@github.com/bpalencia27/vigilante-agenda-everest.git`), and create a Pull Request.

## Milestones & Execution Steps

### Milestone 5: Technical Exploration & Design Specification (Active)
1. Spawn `teamwork_preview_explorer` to:
   - Analyze `everest_telemetry_*.json` files to extract exact structure of `GuardarJsonHC` payload and how `ordenes` array is formatted at root of `json`.
   - Analyze floating patient menu in `vigilante_agenda.user.js` to determine exact injection point for "Ordenamiento Examen General".
   - Investigate clipboard access APIs in Tampermonkey (`GM_setClipboard`, `GM_getClipboard`, header `@grant` requirements) and Python (`pyperclip`, `tkinter`, or `win32clipboard`).
   - Check local git repository status in `vigilante_agenda` and test GitHub token authentication.
   - Produce comprehensive design spec (`analysis_m5.md`).

### Milestone 6: Tampermonkey Script Implementation
1. Spawn `teamwork_preview_worker` to:
   - Inject `ordenarExamenGeneral(diagnosticoId, citaId)` in `vigilante_agenda.user.js`.
   - Ensure payload root `json` object contains `ordenes` array at root with provisional exams (Glucosa, Hemoglobina).
   - Integrate option in patient floating menu.
   - Refactor `getAtheneaIdSolicitudAuto` to write document ID via `GM_setClipboard` and poll clipboard via `setInterval` + `GM_getClipboard` waiting for `{"idSolicitud": ...}`.
2. Spawn `teamwork_preview_reviewer` to review script modifications and `@grant` header updates.

### Milestone 7: Python Clipboard Watcher (`clipboard_watcher.py`)
1. Spawn `teamwork_preview_worker` to:
   - Create `athenea_api_bridge/clipboard_watcher.py`.
   - Import `athenea_service.py` to reuse Playwright browser session & search logic.
   - Poll clipboard for valid patient document IDs, trigger `buscar_laboratorios`, and write JSON result `{"idSolicitud": ...}` back to clipboard.
   - Handle clipboard errors, loop prevention, and graceful shutdown.
2. Spawn `teamwork_preview_reviewer` and `teamwork_preview_challenger` to verify clipboard polling & edge cases.

### Milestone 8: End-to-End Verification & Forensic Audit
1. Spawn `teamwork_preview_worker` to run E2E test verification of `ordenarExamenGeneral` payload assembly and Clipboard Bridge roundtrip.
2. Spawn `teamwork_preview_auditor` for forensic integrity audit.

### Milestone 9: Git Configuration & GitHub Pull Request Creation
1. Spawn `teamwork_preview_worker` to:
   - Initialize/configure local git repo in `vigilante_agenda`.
   - Set remote origin `https://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@github.com/bpalencia27/vigilante-agenda-everest.git`.
   - Create feature branch (e.g. `feature/ordenamiento-puente-portapapeles`), commit all changes.
   - Push branch to GitHub remote and open Pull Request via GitHub REST API or `gh` CLI with token `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`.
2. Spawn `teamwork_preview_auditor` to verify PR existence and contents on GitHub.

