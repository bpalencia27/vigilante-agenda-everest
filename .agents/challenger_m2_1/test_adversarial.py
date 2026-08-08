import os
import sys
import time
import json
import traceback
from pathlib import Path

# Add target directory to sys.path
TARGET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "athenea_api_bridge"))
if TARGET_DIR not in sys.path:
    sys.path.insert(0, TARGET_DIR)

from fastapi.testclient import TestClient
from main import app

def run_adversarial_suite():
    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "test_cases": [],
        "rapid_sequential_metrics": {},
        "summary": {
            "total": 0,
            "passed": 0,
            "failed": 0
        }
    }

    print("=" * 80)
    print("ATHENEA API BRIDGE ADVERSARIAL TEST SUITE")
    print("Target Code Path:", TARGET_DIR)
    print("=" * 80)

    # Initialize TestClient within lifespan context
    with TestClient(app) as client:

        def execute_test(test_id, name, endpoint, expected_statuses, expected_error_substring=None):
            results["summary"]["total"] += 1
            print(f"\n[TEST {test_id}] {name}")
            print(f"  Endpoint: {endpoint}")
            
            start_time = time.perf_counter()
            try:
                response = client.get(endpoint)
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                status_code = response.status_code
                try:
                    response_json = response.json()
                except Exception:
                    response_json = response.text

                print(f"  Status Code: {status_code}")
                print(f"  Elapsed Time: {elapsed_ms:.2f} ms")
                print(f"  Response Body: {json.dumps(response_json, ensure_ascii=False)}")

                status_ok = status_code in expected_statuses
                error_ok = True
                if expected_error_substring and isinstance(response_json, dict):
                    error_msg = response_json.get("error", "") or str(response_json.get("detail", ""))
                    error_ok = expected_error_substring.lower() in error_msg.lower()

                passed = status_ok and error_ok
                verdict = "PASS" if passed else "FAIL"

                if passed:
                    results["summary"]["passed"] += 1
                else:
                    results["summary"]["failed"] += 1

                test_entry = {
                    "id": test_id,
                    "name": name,
                    "endpoint": endpoint,
                    "status_code": status_code,
                    "expected_statuses": expected_statuses,
                    "elapsed_ms": round(elapsed_ms, 2),
                    "response": response_json,
                    "verdict": verdict
                }
                results["test_cases"].append(test_entry)
                print(f"  Verdict: [{verdict}]")
                return test_entry
            except Exception as e:
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                print(f"  EXCEPTION: {e}")
                traceback.print_exc()
                results["summary"]["failed"] += 1
                test_entry = {
                    "id": test_id,
                    "name": name,
                    "endpoint": endpoint,
                    "status_code": None,
                    "expected_statuses": expected_statuses,
                    "elapsed_ms": round(elapsed_ms, 2),
                    "error": str(e),
                    "verdict": "FAIL"
                }
                results["test_cases"].append(test_entry)
                print(f"  Verdict: [FAIL]")
                return test_entry

        # 1. Health check endpoint
        execute_test("TC-01", "Health check endpoint", "/ping", [200])

        # 2. Missing documento parameter
        execute_test("TC-02", "Missing documento parameter", "/api/buscar_laboratorios", [422])

        # 3. Empty documento parameter
        execute_test("TC-03", "Empty documento parameter", "/api/buscar_laboratorios?documento=", [400], "requerido")

        # 4. Whitespace-only documento parameter
        execute_test("TC-04", "Whitespace-only documento parameter", "/api/buscar_laboratorios?documento=%20%20%20", [400], "requerido")

        # 5. Non-existent document ID
        execute_test("TC-05", "Non-existent document ID", "/api/buscar_laboratorios?documento=99999999", [404], "no encontrado")

        # 6. Special characters / non-numeric input
        execute_test("TC-06", "Special characters input (abc!@#)", "/api/buscar_laboratorios?documento=abc%21%40%23", [404, 400])

        # 7. SQL Injection payload
        execute_test("TC-07", "SQL Injection payload input", "/api/buscar_laboratorios?documento=%27%20OR%201%3D1%20--", [404, 400])

        # 8. Overflow input (1000 chars)
        long_doc = "9" * 1000
        execute_test("TC-08", "Overflow input (1000 chars)", f"/api/buscar_laboratorios?documento={long_doc}", [404, 400])

        # 9. Rapid Sequential Requests (Stress test)
        print("\n" + "=" * 80)
        print("[TEST TC-09] Rapid Sequential Requests (Stress Test)")
        print("=" * 80)
        
        sequential_docs = [
            ("00000000", [404]),
            ("", [400]),
            ("99999999", [404]),
            ("abc!@#", [404, 400]),
            ("11111111", [404])
        ]

        seq_results = []
        overall_start = time.perf_counter()

        for idx, (doc, expected_status) in enumerate(sequential_docs, 1):
            ep = f"/api/buscar_laboratorios?documento={doc}"
            print(f"  Sub-request {idx}/5 -> {ep}")
            req_start = time.perf_counter()
            res = client.get(ep)
            req_elapsed = (time.perf_counter() - req_start) * 1000
            print(f"    Status: {res.status_code} | Latency: {req_elapsed:.2f} ms")
            seq_results.append({
                "sub_request": idx,
                "documento": doc,
                "status_code": res.status_code,
                "expected": expected_status,
                "elapsed_ms": round(req_elapsed, 2),
                "passed": res.status_code in expected_status
            })

        total_seq_time = (time.perf_counter() - overall_start) * 1000
        avg_seq_time = total_seq_time / len(sequential_docs)
        all_passed = all(r["passed"] for r in seq_results)

        results["summary"]["total"] += 1
        if all_passed:
            results["summary"]["passed"] += 1
        else:
            results["summary"]["failed"] += 1

        results["rapid_sequential_metrics"] = {
            "total_requests": len(sequential_docs),
            "total_elapsed_ms": round(total_seq_time, 2),
            "avg_elapsed_ms": round(avg_seq_time, 2),
            "sub_requests": seq_results,
            "verdict": "PASS" if all_passed else "FAIL"
        }

        results["test_cases"].append({
            "id": "TC-09",
            "name": "Rapid Sequential Requests (5 calls)",
            "endpoint": "Multiple /api/buscar_laboratorios",
            "status_code": [r["status_code"] for r in seq_results],
            "elapsed_ms": round(total_seq_time, 2),
            "response": f"Average latency per request: {avg_seq_time:.2f} ms",
            "verdict": "PASS" if all_passed else "FAIL"
        })

        print(f"\nRapid Sequential Summary: Total Time: {total_seq_time:.2f} ms | Avg Latency: {avg_seq_time:.2f} ms | Verdict: [{'PASS' if all_passed else 'FAIL'}]")

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Test Cases: {results['summary']['total']}")
    print(f"Passed: {results['summary']['passed']}")
    print(f"Failed: {results['summary']['failed']}")
    print("=" * 80)

    # Output JSON file to workspace
    output_json_path = os.path.join(os.path.dirname(__file__), "test_results.json")
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nDetailed test results written to: {output_json_path}")

    return results

if __name__ == "__main__":
    run_adversarial_suite()
