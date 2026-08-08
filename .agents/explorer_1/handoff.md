# Handoff Report — Explorer 1 (UserScript Specialist)
**Milestone 1**: Athenea API Bridge & UserScript Integration Analysis
**Target File**: `c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\vigilante_agenda.user.js`

---

## 1. Observation

### File & Environment Details
- **File**: `c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\vigilante_agenda.user.js` (Size: 337,592 bytes, Total Lines: 6,023, Version: `9.6.0`).
- **UserScript Header Metadata**:
  - `@match *://medicosviva1a.atheneasoluciones.com/*` (Line 5)
  - `@connect medicosviva1a.atheneasoluciones.com` (Line 6)
  - `@grant GM_xmlhttpRequest` (Line 26)

### Key Findings by Keyword / Feature

#### A. Athenea Keyword Occurrences
1. **Athenea Portal Autologin / Autobúsqueda Module** (Lines 164–203):
   - Triggers when `location.hostname.includes("atheneasoluciones.com")`.
   - Auto-fills login form with username `CONSULTAMED` and password `Viva1a*md04`.
   - Reads document ID from URL hash/search `#doc=(\d+)` and auto-submits search in `#NumeroIdentificacion` / `#btnBuscar`.
2. **Athenea Lab Ingestion Module** (Lines 218–348, repeated at 4298–4440, 4985–5118, 5879–6020):
   - Defines `ATHENEA_MAP`: Maps Athenea analyte codes to Everest Angular model IDs (`pesHC`):
     ```javascript
     const ATHENEA_MAP = {
         "2009": "resultadoColesterolTotal",
         "2015": "resultadoColesterolHDL",
         "2014": "resultadoColesterolLDL",
         "2074": "resultadoTrigliceridos",
         "2013": "resultadoGlicemia",
         "2028": "resultadoCreatinina",
         "2080": "resultadoCreatinuria",
         "2092": "resultadoMicroAlbuminuria",
     };
     ```
   - Defines `fetchAtheneaLabs(idSolicitud, ano = new Date().getFullYear())`: Makes a POST request using `GM_xmlhttpRequest` to `https://medicosviva1a.atheneasoluciones.com/Resultados/consultaDetalleSolicitud` with body `JSON.stringify({ idSolicitud: parseInt(idSolicitud, 10), ano: ano, modulo: "LAB" })`.
   - Defines `setNgValue(inputEl, value)`: Standard Angular injection pattern:
     ```javascript
     function setNgValue(inputEl, value) {
         if (!inputEl) return;
         inputEl.value = value;
         inputEl.dispatchEvent(new Event('input', { bubbles: true }));
         inputEl.dispatchEvent(new Event('change', { bubbles: true }));
     }
     ```
   - Defines `injectLabsIntoCronicos(labsArray)`: Iterates analytes, matches code or name, locates input element via `document.getElementById(everestId)`, updates value via `setNgValue`, and populates corresponding `fechaResult` input.
3. **Modal de Laboratorios y Paraclínicos (`openLaboratoriosModal`)** (Lines 4040–4116):
   - Creates a modal dialog showing patient info (`apt.doc_id`, `apt.nombre`).
   - Contains a button `🌐 Abrir en Athenea Soluciones (Auto-Login)` linking to `https://medicosviva1a.atheneasoluciones.com/Resultados/BusquedaPaciente#doc=${apt.doc_id}`.
   - Queries Annar & Citi labs via `apiAccesoObtenerLaboratoriosAnnar` and `apiAccesoObtenerLaboratoriosCiti`.

#### B. `prompt()` Occurrences & Usage
- Located in `createLabInjectorUI()` on **Line 328** (and duplicate instances at lines 4411, 5098, 5992):
  ```javascript
  let idSolicitud = prompt("Para inyectar en Ruta Crónicos, ingresa el 'idSolicitud' de Athenea (puedes verlo en la URL o inspector de Athenea para este paciente):");
  ```
- **How the response is used**:
  1. The user manually types an `idSolicitud` string into the browser prompt dialog.
  2. If empty or cancelled (`!idSolicitud`), execution stops.
  3. `btn.innerHTML` changes to `"⏳ Buscando..."`.
  4. `fetchAtheneaLabs(idSolicitud)` is called asynchronously with the parsed `idSolicitud`.
  5. The lab array returned is passed to `injectLabsIntoCronicos(labs)`.
  6. Displays an alert with status (`✅ ¡Éxito! Se encontraron...` or `❌ Error...`).

#### C. Patient Document Handling in Everest
- **In Agenda View**: `extractAgenda()` (Lines 1886–1901) scans elements matching `CONFIG.SEL.hora`, extracts document string matching `CONFIG.SEL.documento` (`.text-muted`), and cleans it with `extractDoc(documento)`. Result stored in `apt.doc_id`.
- **In Medical History View**: `extractPacienteAbierto()` (Lines 1938–1949):
  ```javascript
  function extractPacienteAbierto() {
    try {
      if (!document.getElementById("anamesis")) return "";
      const contenedor = document.querySelector("app-index") || document;
      for (const el of contenedor.querySelectorAll(".text-muted")) {
        if (el.closest("#vgl-root")) continue;
        const doc = extractDoc(limpio(el.textContent));
        if (doc) return doc;
      }
      return "";
    } catch (e) { return ""; }
  }
  ```
- `extractDoc(t)` (Line 650) uses regex `^(\d{5,15})$` / `(\d{5,15})` to extract clean 5-15 digit document strings (cedulas/IDs).

---

## 2. Logic Chain

1. **Current Workflow Deficit**:
   - Currently, `vigilante_agenda.user.js` requires clinicians to manually find the `idSolicitud` in Athenea, copy it, and paste it into a JavaScript `prompt()` prompt in Everest.
   - Reason: `fetchAtheneaLabs` directly queries Athenea's `consultaDetalleSolicitud` endpoint which requires a numeric order ID (`idSolicitud`), NOT the patient's ID document (`documento` / `doc_id`).

2. **New Architecture (Athenea Local API Bridge)**:
   - A local API bridge running on `http://localhost:5050` exposes:
     `GET http://localhost:5050/api/buscar_laboratorios?documento=<doc_id>`
   - The bridge service takes the patient's ID document (`documento`), logs in to Athenea (or uses active session), searches orders, and returns structured JSON lab results.

3. **UserScript Integration Flow**:
   - In `vigilante_agenda.user.js`:
     1. Automatically extract the active patient's document ID using `extractPacienteAbierto()` (when in `#anamesis` history view) or `apt.doc_id` (when in agenda/modal view).
     2. Eliminate the manual `prompt("ingresa el idSolicitud...")` prompt.
     3. Initiate request to local API endpoint `http://localhost:5050/api/buscar_laboratorios?documento=${doc_id}`.
     4. Use `GM_xmlhttpRequest` per Tampermonkey best practices to bypass CORS & Mixed Content (HTTPS -> HTTP localhost) constraints.
     5. Pass returned lab results to `injectLabsIntoCronicos(labs)` to populate Angular fields via `setNgValue(inputEl, value)`.

---

## 3. Caveats

1. **Tampermonkey Header Modifications Required**:
   - Must add `@connect localhost` and `@connect 127.0.0.1` to UserScript metadata header.
   - Ensure `@grant GM_xmlhttpRequest` is declared.
2. **Duplicate Code Blocks**:
   - `vigilante_agenda.user.js` contains 4 repeated occurrences of `ATHENEA_MAP` and `fetchAtheneaLabs` / `createLabInjectorUI()` (Lines 218–348, 4298–4440, 4985–5118, 5879–6020).
   - *Note for Implementer*: Line 4441 contains a `})();` that terminates an IIFE prematurely if unhandled during cleanup.
3. **CORS & Protocol Constraints**:
   - Standard `window.fetch` from `https://neps.everestintelligent.com` to `http://localhost:5050` would be blocked by Mixed Content / CORS unless `GM_xmlhttpRequest` is used.

---

## 4. Conclusion & API Integration Specification

### Proposed API Client Function in `vigilante_agenda.user.js`:

```javascript
// Header additions required:
// @connect      localhost
// @connect      127.0.0.1
// @grant        GM_xmlhttpRequest

function fetchLabsFromLocalBridge(documento) {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:5050/api/buscar_laboratorios?documento=${encodeURIComponent(documento)}`;
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            headers: {
                "Accept": "application/json"
            },
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const json = JSON.parse(response.responseText);
                        if (json.status === "success" && Array.isArray(json.laboratorios)) {
                            resolve(json.laboratorios);
                        } else if (Array.isArray(json)) {
                            resolve(json);
                        } else {
                            reject(json.message || "Estructura de respuesta no válida");
                        }
                    } catch (e) {
                        reject("Error interpretando JSON del Bridge API local: " + e.message);
                    }
                } else {
                    reject(`El API Bridge respondió con estado HTTP ${response.status}`);
                }
            },
            onerror: function(err) {
                reject("No se pudo conectar con el API Bridge local (http://localhost:5050). Verifique que el servicio Python esté en ejecución.");
            }
        });
    });
}
```

### Proposed Button Handler (`createLabInjectorUI` update):
```javascript
btn.onclick = async () => {
    let docId = extractPacienteAbierto();
    if (!docId) {
        docId = prompt("No se detectó documento activo. Por favor ingrese la cédula/documento del paciente:");
    }
    if (!docId) return;

    btn.innerHTML = "⏳ Consultando Athenea...";
    try {
        const labs = await fetchLabsFromLocalBridge(docId);
        if (labs && labs.length > 0) {
            const injectedCount = injectLabsIntoCronicos(labs);
            alert(`✅ ¡Éxito! Se obtuvieron ${labs.length} analitos de Athenea.\nSe inyectaron ${injectedCount} valores en Everest.`);
        } else {
            alert("⚠️ No se encontraron resultados de laboratorio recientes en Athenea para este documento.");
        }
    } catch (e) {
        alert("❌ Error en Puente Athenea:\n" + e);
    }
    btn.innerHTML = "🧬 Auto-Labs (Athenea)";
};
```

---

## 5. Verification Method

To independently verify these findings:
1. **Prompt Search Verification**:
   Execute in PowerShell:
   `Select-String -Path .\vigilante_agenda.user.js -Pattern "prompt\("`
   Output confirms occurrences on lines 328, 4411, 5098, 5992.
2. **Document Extraction Code Inspection**:
   Inspect line 1938 of `vigilante_agenda.user.js` using `view_file` to confirm `#anamesis` and `.text-muted` scanning logic.
3. **Local API Connection Test**:
   Once the local Python API server is running on `http://localhost:5050`, invoke `fetchLabsFromLocalBridge("<test_doc>")` from the browser developer console while on Everest.
