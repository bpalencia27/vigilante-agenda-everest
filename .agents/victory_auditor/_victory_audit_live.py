import asyncio
import time
import json
import sys
import os

# Add athenea_api_bridge to sys.path
bridge_dir = r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\athenea_api_bridge"
if bridge_dir not in sys.path:
    sys.path.insert(0, bridge_dir)

from fastapi.testclient import TestClient
from main import app, athenea_service

async def run_victory_tests():
    print("=" * 70)
    print("INDEPENDENT VICTORY AUDIT LIVE VERIFICATION")
    print("=" * 70)
    
    results = {}
    
    # 1. Start Athenea Service Playwright instance
    print("\n[STEP 1] Starting AtheneaService Playwright browser context...")
    t0_start = time.perf_counter()
    await athenea_service.start()
    t1_start = time.perf_counter()
    print(f"AtheneaService started in {(t1_start - t0_start):.3f} seconds.")

    try:
        # AC1 Verification: GET /ping returns 200 OK
        print("\n[AC1 TEST] GET /ping...")
        client = TestClient(app)
        t0_ping = time.perf_counter()
        resp_ping = client.get("/ping")
        t1_ping = time.perf_counter()
        duration_ping = (t1_ping - t0_ping) * 1000.0  # ms
        
        print(f"AC1 Response Status: {resp_ping.status_code}")
        print(f"AC1 Response JSON: {resp_ping.json()}")
        print(f"AC1 Response Time: {duration_ping:.2f} ms")
        
        ac1_pass = (resp_ping.status_code == 200) and (resp_ping.json() == {"status": "ok"})
        results["AC1"] = {
            "pass": ac1_pass,
            "status_code": resp_ping.status_code,
            "response": resp_ping.json(),
            "duration_ms": round(duration_ping, 2)
        }

        # AC2 Verification: GET /api/buscar_laboratorios?documento=1017214911
        print("\n[AC2 TEST] GET /api/buscar_laboratorios?documento=1017214911...")
        target_doc = "1017214911"
        t0_ac2 = time.perf_counter()
        
        # Directly call get_id_solicitud or endpoint via async
        id_solicitud = None
        err_msg = None
        try:
            id_solicitud = await athenea_service.get_id_solicitud(target_doc)
        except Exception as e:
            err_msg = str(e)
            
        t1_ac2 = time.perf_counter()
        duration_ac2 = t1_ac2 - t0_ac2
        
        print(f"AC2 Document Tested: {target_doc}")
        print(f"AC2 Execution Time: {duration_ac2:.3f} seconds")
        print(f"AC2 idSolicitud Result: {id_solicitud}")
        if err_msg:
            print(f"AC2 Error (if any): {err_msg}")
            
        ac2_pass = (
            id_solicitud is not None 
            and isinstance(id_solicitud, int) 
            and id_solicitud > 0 
            and duration_ac2 < 10.0
        )
        results["AC2"] = {
            "pass": ac2_pass,
            "documento": target_doc,
            "idSolicitud": id_solicitud,
            "duration_seconds": round(duration_ac2, 3),
            "under_10s_sla": duration_ac2 < 10.0,
            "error": err_msg
        }

    finally:
        print("\n[CLEANUP] Stopping AtheneaService...")
        await athenea_service.stop()
        print("AtheneaService stopped.")

    print("\n" + "=" * 70)
    print("SUMMARY OF INDEPENDENT AUDIT EXECUTION")
    print(json.dumps(results, indent=2))
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_victory_tests())
