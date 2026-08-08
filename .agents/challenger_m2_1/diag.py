import sys
import os

TARGET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "athenea_api_bridge"))
if TARGET_DIR not in sys.path:
    sys.path.insert(0, TARGET_DIR)

from main import app
from fastapi.testclient import TestClient

with TestClient(app) as client:
    print("Sending req 1...")
    r1 = client.get("/api/buscar_laboratorios?documento=00000000")
    print("Req 1 status:", r1.status_code, r1.json())

    print("Sending req 2...")
    r2 = client.get("/api/buscar_laboratorios?documento=99999999")
    print("Req 2 status:", r2.status_code, r2.json())

    print("Sending req 3...")
    r3 = client.get("/api/buscar_laboratorios?documento=11111111")
    print("Req 3 status:", r3.status_code, r3.json())
