import asyncio
import sys
import unittest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from config import settings
from main import app, athenea_service
from athenea_service import AtheneaService, PatientNotFoundError, AtheneaServiceError


class TestAtheneaApiBridge(unittest.TestCase):
    """Test suite for Athenea API Bridge microservice."""

    def setUp(self):
        self.client = TestClient(app)

    def test_ping_endpoint(self):
        """Test GET /ping endpoint returns 200 OK with {'status': 'ok'}."""
        response = self.client.get("/ping")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_buscar_laboratorios_missing_doc(self):
        """Test GET /api/buscar_laboratorios with empty/missing documento query param."""
        response = self.client.get("/api/buscar_laboratorios?documento=")
        self.assertEqual(response.status_code, 400)
        json_data = response.json()
        self.assertIn("error", json_data)

    @patch.object(AtheneaService, "get_id_solicitud", new_callable=AsyncMock)
    def test_buscar_laboratorios_success(self, mock_get_id):
        """Test GET /api/buscar_laboratorios returns 200 OK with idSolicitud when patient found."""
        mock_get_id.return_value = 987654
        response = self.client.get("/api/buscar_laboratorios?documento=12345678")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"idSolicitud": 987654})
        mock_get_id.assert_called_once_with("12345678")

    @patch.object(AtheneaService, "get_id_solicitud", new_callable=AsyncMock)
    def test_buscar_laboratorios_not_found(self, mock_get_id):
        """Test GET /api/buscar_laboratorios returns 404 Not Found when patient not found."""
        mock_get_id.side_effect = PatientNotFoundError("Paciente con documento '99999999' no encontrado.")
        response = self.client.get("/api/buscar_laboratorios?documento=99999999")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {"error": "Paciente con documento '99999999' no encontrado."}
        )

    @patch.object(AtheneaService, "get_id_solicitud", new_callable=AsyncMock)
    def test_buscar_laboratorios_service_error(self, mock_get_id):
        """Test GET /api/buscar_laboratorios returns 500 Internal Server Error on service exception."""
        mock_get_id.side_effect = AtheneaServiceError("Error de conexion con Athenea.")
        response = self.client.get("/api/buscar_laboratorios?documento=11111111")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json(),
            {"error": "Error de conexion con Athenea."}
        )


async def run_live_integration_test():
    """Optional live integration test calling actual Athenea portal via AtheneaService."""
    print("\n--- Running Live Integration Test with AtheneaService ---")
    service = AtheneaService()
    try:
        await service.start()
        # Test document search for non-existent patient ID
        test_doc = "00000000"
        print(f"Testing search for document '{test_doc}'...")
        try:
            res = await service.get_id_solicitud(test_doc)
            print(f"Result for '{test_doc}': {res}")
        except PatientNotFoundError as e:
            print(f"Successfully caught expected PatientNotFoundError for '{test_doc}': {e}")
        except Exception as e:
            print(f"Caught exception for '{test_doc}': {type(e).__name__} - {e}")
    finally:
        await service.stop()
    print("--- Live Integration Test Completed ---\n")


def main():
    print("=" * 60)
    print("Running Athenea API Bridge Unit & Integration Test Suite")
    print("=" * 60)

    # Run unittest suite
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAtheneaApiBridge)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    if not result.wasSuccessful():
        sys.exit(1)

    # Run live integration test asynchronously
    try:
        asyncio.run(run_live_integration_test())
    except Exception as e:
        print(f"Live integration test error: {e}")

    print("ALL TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    main()
