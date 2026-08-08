import os
import json
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

USERSCRIPT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "vigilante_agenda.user.js")
)

SYNTHETIC_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Everest Intelligent - Portal Clínico (Mock Server)</title>
    <style>
        body { font-family: sans-serif; background: #f4f6f9; margin: 0; padding: 20px; }
        .clinical-header { background: #0056b3; color: white; padding: 12px 20px; font-weight: bold; }
        .patient-card { background: white; border: 1px solid #ccc; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
        .labelHora { font-weight: bold; color: #333; }
        .status-label { background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        .text-muted { color: #6c757d; }
        .text-uppercase { text-transform: uppercase; }
        .fw-bold { font-weight: bold; }
        .mb-0 { margin-bottom: 0; }
        .fecha { font-size: 14px; font-weight: 500; }
    </style>
    <!-- GM Polyfills for Userscript Execution without Extension -->
    <script>
        window.GM_store = window.GM_store || {};
        window.GM_getValue = function(key, defaultValue) {
            return window.GM_store.hasOwnProperty(key) ? window.GM_store[key] : defaultValue;
        };
        window.GM_setValue = function(key, value) {
            window.GM_store[key] = value;
            try { localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value); } catch(e){}
        };
        window.GM_xmlhttpRequest = function(details) {
            var method = details.method || 'GET';
            var url = details.url;
            fetch(url, { method: method, headers: details.headers, body: details.data })
                .then(r => r.text().then(txt => {
                    if (details.onload) details.onload({ responseText: txt, status: r.status });
                }))
                .catch(err => { if (details.onerror) details.onerror(err); });
        };
        window.GM_info = { script: { version: '8.2.0', name: 'Vigilante de Agenda' } };

        var GM_getValue = window.GM_getValue;
        var GM_setValue = window.GM_setValue;
        var GM_xmlhttpRequest = window.GM_xmlhttpRequest;
        var GM_info = window.GM_info;

        // Doctor Session Mock
        window.UsuarioId = 101;
        window.UsuarioNombreCompleto = "BRANDON JESUS PALENCIA MARTINEZ";
        window.UsuarioLogin = "BPALENCIA";
    </script>
</head>
<body>
    <div class="clinical-header">
        <span>Everest Medical Portal — Doctor: BRANDON JESUS PALENCIA MARTINEZ</span>
    </div>
    <app-index id="app-index-container" style="display:block; margin-top:20px;">
        <div id="anamesis" class="card patient-card">
            <h3 class="text-uppercase fw-bold mb-0">BRANDON JESUS PALENCIA MARTINEZ</h3>
            <p class="text-muted">Cédula / Documento: 1143142498</p>
            <div class="fecha">Fecha Atencion: 2026-08-08</div>
            <div>
                <span class="labelHora">08:00 AM</span>
                <span class="status-label">EN CONSULTA</span>
            </div>
        </div>
    </app-index>

    <!-- Userscript Injection -->
    <script src="/vigilante_agenda.user.js?UsuarioId=101&UsuarioNombreCompleto=BRANDON%20JESUS%20PALENCIA%20MARTINEZ"></script>
</body>
</html>
"""

class EverestMockHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress verbose HTTP server log output in pytest runs
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html_content, status=200):
        body = html_content.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path in ['/', '/index.html']:
            self._send_html(SYNTHETIC_HTML_TEMPLATE)
            return

        if path == '/vigilante_agenda.user.js':
            if os.path.exists(USERSCRIPT_PATH):
                with open(USERSCRIPT_PATH, 'r', encoding='utf-8') as f:
                    content = f.read()
                self._send_html(content)
            else:
                self.send_error(404, "Userscript file not found")
            return

        # APIAcceso Endpoints
        if '/apiviva/APIAcceso/api/Paciente/BuscarPaciente' in path:
            doc = query.get('identificacion', ['1143142498'])[0]
            self._send_json({
                "success": True,
                "data": {
                    "Id": 98765,
                    "Identificacion": doc,
                    "NombreCompleto": "BRANDON JESUS PALENCIA MARTINEZ",
                    "TipoDocumento": "CC",
                    "Edad": 30,
                    "Sexo": "M",
                    "EpsId": 2,
                    "ProgramaEspecial": True
                }
            })
            return

        if '/apiviva/APIAcceso/api/Acceso/AgdValidarAgenda' in path:
            self._send_json({"success": True, "valido": True, "mensaje": "Agenda valida"})
            return

        if '/apiviva/APIAcceso/api/Acceso/ObtenerTurnos' in path:
            self._send_json({
                "success": True,
                "turnos": [
                    {"Hora": "07:00 AM", "Disponible": True},
                    {"Hora": "07:20 AM", "Disponible": True},
                    {"Hora": "08:00 AM", "Disponible": True},
                    {"Hora": "08:20 AM", "Disponible": True}
                ]
            })
            return

        # APIOrdenamientoHealth Endpoints
        if '/apiviva/APIOrdenamientoHealth/api/Paciente/BuscarPaciente' in path:
            self._send_json({
                "success": True,
                "data": {
                    "Id": 98765,
                    "Identificacion": "1143142498",
                    "NombreCompleto": "BRANDON JESUS PALENCIA MARTINEZ"
                }
            })
            return

        if '/apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoDiagnostico' in path:
            self._send_json([
                {"Id": 1, "Codigo": "I10X", "Nombre": "HIPERTENSION ARTERIAL PRIMARIA"},
                {"Id": 2, "Codigo": "E119", "Nombre": "DIABETES MELLITUS TIPO 2 SIN COMPLICACIONES"},
                {"Id": 3, "Codigo": "Z000", "Nombre": "EXAMEN MEDICO GENERAL"}
            ])
            return

        if '/apiviva/APIOrdenamientoHealth/api/Combo/ObtenerListadoCupsPorPaciente' in path:
            self._send_json([
                {"Id": 101, "Codigo": "890201", "Nombre": "CONSULTA DE PRIMERA VEZ POR MEDICINA GENERAL"},
                {"Id": 102, "Codigo": "902213", "Nombre": "HEMOGRAMA COMPLETO"},
                {"Id": 103, "Codigo": "890301", "Nombre": "CONSULTA DE CONTROL POR MEDICINA GENERAL"}
            ])
            return

        self._send_json({"status": "ok", "path": path})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len) if content_len > 0 else b'{}'

        if '/apiviva/APIAcceso/api/Acceso/BuscarCitasDisponibles' in path:
            esp_id = query.get('EspecialidadId', ['12'])[0]
            esp_name = "MEDICINA GENERAL" if esp_id == '12' else ("PSICOLOGIA" if esp_id == '55' else "ODONTOLOGIA")
            self._send_json({
                "success": True,
                "data": [
                    {
                        "AgendaId": 501,
                        "Fecha": "2026-08-15",
                        "Hora": "08:00 AM",
                        "EspecialidadId": int(esp_id),
                        "EspecialidadNombre": esp_name,
                        "ProfesionalNombre": "BRANDON JESUS PALENCIA MARTINEZ",
                        "PuntoAtencionId": 12
                    },
                    {
                        "AgendaId": 502,
                        "Fecha": "2026-08-15",
                        "Hora": "08:20 AM",
                        "EspecialidadId": int(esp_id),
                        "EspecialidadNombre": esp_name,
                        "ProfesionalNombre": "BRANDON JESUS PALENCIA MARTINEZ",
                        "PuntoAtencionId": 12
                    }
                ]
            })
            return

        if '/apiviva/APIAcceso/api/Acceso/AsignarTurno' in path:
            self._send_json({
                "success": True,
                "cveCita": "CITA-2026-8899",
                "mensaje": "Cita asignada exitosamente en Mock Server"
            })
            return

        if '/apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento' in path:
            self._send_json({
                "success": True,
                "ordenId": 77492,
                "mensaje": "Ordenamiento guardado exitosamente en Mock Server"
            })
            return

        self._send_json({"status": "ok", "path": path})

class MockServer:
    def __init__(self, host="127.0.0.1", port=0):
        self.host = host
        self.requested_port = port
        self.server = None
        self.thread = None
        self.port = None
        self.url = None

    def start(self):
        self.server = ThreadingHTTPServer((self.host, self.requested_port), EverestMockHandler)
        self.port = self.server.server_address[1]
        self.url = f"http://{self.host}:{self.port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
