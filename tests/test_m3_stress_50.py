import time
from tests.test_harness import PlaywrightHarness

def test_50_iteration_modal_stress(mock_server):
    print("\n[STRESS] Iniciando prueba de estres de 50 iteraciones masivas...")
    harness = PlaywrightHarness()
    try:
        page = harness.launch()
        js_errors = []
        
        page.on("pageerror", lambda exc: js_errors.append(str(exc)))
        
        # Navegar al servidor mock local
        page.goto(mock_server.url)
        page.wait_for_selector("#vgl-root", timeout=5000)

        for i in range(50):
            # 1. Abrir modal agendamiento
            page.evaluate("""() => {
                const btn = document.querySelector('.vgl-btn-agendar') || document.querySelector("button:has-text('Agendar')");
                if (btn) btn.click();
            }""")
            time.sleep(0.02)
            
            # 2. Alternar especialidad (Psicologia 55)
            page.evaluate("""() => {
                const btn = document.querySelector("#vgl-esp-presets .vgl-agm-pbtn[data-esp='55']");
                if (btn) btn.click();
            }""")
            time.sleep(0.02)

            # 3. Alternar plazo (2 meses)
            page.evaluate("""() => {
                const btn = document.querySelector("#vgl-time-presets .vgl-agm-pbtn[data-m='2']");
                if (btn) btn.click();
            }""")
            time.sleep(0.02)

            # 4. Clic en primer chip de dia vecino de +-3 dias
            page.evaluate("""() => {
                const btn = document.querySelector("#vgl-day-chips .vgl-agm-pbtn");
                if (btn) btn.click();
            }""")
            time.sleep(0.02)

            # 5. Cerrar modal
            page.evaluate("""() => {
                const mod = document.getElementById("vgl-ordenar-modal") || document.getElementById("vgl-agendar-modal");
                if (mod) mod.remove();
            }""")
            time.sleep(0.01)

        print(f"[OK] 50 Iteraciones completadas exitosamente. Errores de consola: {len(js_errors)}")
        assert len(js_errors) == 0, f"Se detectaron errores JS no capturados: {js_errors}"
    finally:
        harness.close()

if __name__ == "__main__":
    from tests.mock_server import start_mock_server
    server, url = start_mock_server()
    try:
        class DummyMock:
            def __init__(self, u): self.url = u
        test_50_iteration_modal_stress(DummyMock(url))
    finally:
        server.shutdown()
