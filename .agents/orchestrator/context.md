# Context & Key Decisions — Athenea API Bridge Project

## User Requirements Summary
- Local Python microservice using Playwright (headless mode).
- Listens on `localhost:5050` with endpoint GET `/api/buscar_laboratorios?documento=XXX`.
- Navigates to Athenea Soluciones (`medicosviva1a.atheneasoluciones.com`), auto-logins if needed, searches patient by document, extracts latest `idSolicitud`, returns `{"idSolicitud": 123456}`.
- GET `/ping` returns `200 OK`.
- Response time < 10 seconds for `/api/buscar_laboratorios?documento=1017214911`.
- `vigilante_agenda.user.js` integrated seamlessly to query local API bridge without manual `prompt()`.

## Environmental & Technical Guidelines
- Follow `playwright_windows_automation` skill: async API (`playwright.async_api`), headless Chromium, proper error & session management.
- Follow `tampermonkey_angular_injection` skill if injecting user events or making cross-origin requests.
