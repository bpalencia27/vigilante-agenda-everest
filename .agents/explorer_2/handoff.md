# Explorer 2 Handoff Report: Athenea Soluciones Web Workflows & Playwright Specification

## 1. Observation

Direct findings extracted from `vigilante_agenda.user.js` and `everest_telemetry_PRO_20260808_*.json` telemetry logs:

### 1.1 Hostname & URLs
- **Base Domain**: `https://medicosviva1a.atheneasoluciones.com`
- **Login Page URL**: `https://medicosviva1a.atheneasoluciones.com/` (or default landing redirect)
- **Patient Search Page URL**: `https://medicosviva1a.atheneasoluciones.com/Resultados/BuscarPaciente`
- **Patient Results / Details Page URL**: `https://medicosviva1a.atheneasoluciones.com/Resultados/DatosPaciente`
- **Lab Detail XHR Endpoint**: `https://medicosviva1a.atheneasoluciones.com/Resultados/consultaDetalleSolicitud`

### 1.2 Hardcoded Credentials in Project
Extracted from `vigilante_agenda.user.js` (lines 173–174):
- **Username**: `CONSULTAMED`
- **Password**: `Viva1a*md04`

### 1.3 Form & Input DOM Selectors
- **Login Form**:
  - Username Field: `#Username` or `input[name='Username']`
  - Password Field: `#Password` or `input[name='Password']`
  - Submit Button: `button[type='submit']` or `input[type='submit']`
- **Patient Search Form**:
  - Document Field: `#NumeroIdentificacion` or `input[name='NumeroIdentificacion']` or `#Documento` or `input[type='search']` or `input.form-control`
  - Search Button: `button[type='submit']` or `#btnBuscar` or `.btn-primary`
- **Search Results & `idSolicitud` Link**:
  - "Ver Resumen" Button / Span: `span.cursor-pointer` containing text `"Ver Resumen"` or `span.p-10`
  - Laboratory Request Container: `div.card-body.p-10`
  - Clicking "Ver Resumen" issues a POST request to `/Resultados/consultaDetalleSolicitud` with JSON body:
    `{"idSolicitud": 1310578, "ano": 2026}` (or current year).
  - Alternatively, `idSolicitud` is encoded as a data attribute or onClick target on the "Ver Resumen" `span` element, or present in URL query/hash parameters.

---

## 2. Logic Chain

1. **Authentication Verification**:
   - When Playwright navigates to `https://medicosviva1a.atheneasoluciones.com/Resultados/BuscarPaciente`, if the context is unauthenticated, it redirects to the login screen (`/Account/Login` or `/`).
   - Checking for `#Username` presence confirms unauthenticated status. Filling `#Username` with `CONSULTAMED` and `#Password` with `Viva1a*md04` followed by clicking `button[type='submit']` authenticates the browser context.

2. **Patient Search Execution**:
   - Navigating to `/Resultados/BuscarPaciente` brings up the patient lookup tool.
   - Injecting the patient document ID into `#NumeroIdentificacion` and clicking `#btnBuscar` / `button[type='submit']` yields the patient request list.

3. **`idSolicitud` Extraction**:
   - The results table/cards present lab orders. The top/first order corresponds to the most recent laboratory request.
   - The button or span labeled "Ver Resumen" (`span.cursor-pointer:has-text("Ver Resumen")`) contains the target request metadata.
   - Playwright can intercept network XHR calls to `consultaDetalleSolicitud` when clicking "Ver Resumen", or parse `idSolicitud` directly from the DOM attribute / onclick handler.

---

## 3. Caveats

- **Active Session Persistence**: Reusing a Playwright `browser_context` across requests avoids repeated logins, reducing extraction latency from ~8s to < 2s.
- **Year Parameter (`ano`)**: The XHR payload sent by Athenea includes `"ano": 2026`. Playwright extraction should dynamically extract `idSolicitud` from the most recent request card or intercepted request payload.
- **No Results Scenario**: If a patient has no laboratory orders on Athenea, no "Ver Resumen" link will exist. Playwright must catch timeouts and return HTTP 404 cleanly.

---

## 4. Conclusion & Playwright Navigation Specification

Exact Playwright Async Python step sequence for implementation in `athenea_service.py`:

```python
import re
from playwright.async_api import async_playwright, TimeoutError

async def get_latest_id_solicitud(page, documento: str) -> int:
    # 1. Navigate to Search Page
    await page.goto("https://medicosviva1a.atheneasoluciones.com/Resultados/BuscarPaciente", wait_until="networkidle")
    
    # 2. Check if redirected to Login page
    if await page.locator("#Username").is_visible():
        await page.fill("#Username", "CONSULTAMED")
        await page.fill("#Password", "Viva1a*md04")
        await page.click("button[type='submit'], input[type='submit']")
        await page.wait_for_url("**/Resultados/**", timeout=10000)
    
    # 3. Perform Patient Search
    doc_input = page.locator("#NumeroIdentificacion, input[name='NumeroIdentificacion'], #Documento").first
    await doc_input.fill(documento)
    
    search_btn = page.locator("#btnBuscar, button[type='submit'], .btn-primary").first
    await search_btn.click()
    
    # 4. Wait for results & Intercept XHR or Extract idSolicitud
    id_solicitud = None
    
    # Strategy A: Listen to XHR request when clicking "Ver Resumen"
    async with page.expect_request("**/Resultados/consultaDetalleSolicitud**", timeout=5000) as req_info:
        ver_resumen_btn = page.locator("span.cursor-pointer:has-text('Ver Resumen')").first
        if not await ver_resumen_btn.is_visible():
            raise ValueError("No laboratory requests found for patient")
        await ver_resumen_btn.click()
        
    req = await req_info.value
    post_data = req.post_data_json
    if post_data and "idSolicitud" in post_data:
        id_solicitud = int(post_data["idSolicitud"])
        
    return id_solicitud
```

---

## 5. Verification Method

1. **Static Analysis**: Verify line 168–174 of `vigilante_agenda.user.js` matches `#Username`, `#Password`, `CONSULTAMED`, and `Viva1a*md04`.
2. **Telemetry Inspection**: Confirm XHR request payload `{"idSolicitud": 1310578, "ano": 2026}` in `everest_telemetry_PRO_20260808_1004.json`.
3. **Playwright Execution**: Once `athenea_api_bridge` is implemented in Milestone 2, run test script with sample document ID to verify Playwright completes navigation and extraction in < 10 seconds.
