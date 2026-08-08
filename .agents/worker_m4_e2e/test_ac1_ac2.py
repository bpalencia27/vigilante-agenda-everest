import time
import json
import urllib.request
import urllib.error

def test_ping():
    print("Testing AC1: GET http://127.0.0.1:5050/ping ...")
    t0 = time.perf_counter()
    url = "http://127.0.0.1:5050/ping"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            t1 = time.perf_counter()
            status = response.status
            body = response.read().decode('utf-8')
            elapsed_ms = (t1 - t0) * 1000
            print(f"Status Code: {status}")
            print(f"Elapsed Time: {elapsed_ms:.2f} ms")
            print(f"Body: {body}")
            
            data = json.loads(body)
            assert status == 200, f"Expected 200, got {status}"
            assert data == {"status": "ok"}, f"Expected {{'status': 'ok'}}, got {data}"
            print("AC1 RESULT: PASS\n")
            return {"status": "PASS", "http_status": status, "elapsed_ms": round(elapsed_ms, 2), "response": data}
    except Exception as e:
        print(f"AC1 FAILED: {e}\n")
        return {"status": "FAIL", "error": str(e)}

def test_buscar_laboratorios():
    doc = "1017214911"
    print(f"Testing AC2: GET http://127.0.0.1:5050/api/buscar_laboratorios?documento={doc} ...")
    t0 = time.perf_counter()
    url = f"http://127.0.0.1:5050/api/buscar_laboratorios?documento={doc}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            t1 = time.perf_counter()
            status = response.status
            body = response.read().decode('utf-8')
            elapsed_sec = t1 - t0
            print(f"Status Code: {status}")
            print(f"Elapsed Time: {elapsed_sec:.3f} s ({elapsed_sec*1000:.2f} ms)")
            print(f"Body: {body}")
            
            data = json.loads(body)
            assert status in (200, 404, 400, 500), f"Unexpected status code {status}"
            assert "idSolicitud" in data or "error" in data, f"Response missing 'idSolicitud' or 'error': {data}"
            assert elapsed_sec < 10.0, f"Latency {elapsed_sec:.2f}s exceeded 10s threshold!"
            print("AC2 RESULT: PASS\n")
            return {"status": "PASS", "http_status": status, "elapsed_sec": round(elapsed_sec, 3), "response": data}
    except urllib.error.HTTPError as e:
        t1 = time.perf_counter()
        elapsed_sec = t1 - t0
        body = e.read().decode('utf-8')
        print(f"HTTPError Status Code: {e.code}")
        print(f"Elapsed Time: {elapsed_sec:.3f} s")
        print(f"Body: {body}")
        try:
            data = json.loads(body)
        except Exception:
            data = body
        assert "error" in data or "idSolicitud" in data, f"Response missing 'error' key: {data}"
        assert elapsed_sec < 10.0, f"Latency {elapsed_sec:.2f}s exceeded 10s threshold!"
        print("AC2 RESULT: PASS (HTTP Error status handled with valid JSON error in < 10s)\n")
        return {"status": "PASS", "http_status": e.code, "elapsed_sec": round(elapsed_sec, 3), "response": data}
    except Exception as e:
        t1 = time.perf_counter()
        elapsed_sec = t1 - t0
        print(f"AC2 FAILED: {e} after {elapsed_sec:.3f}s\n")
        return {"status": "FAIL", "elapsed_sec": round(elapsed_sec, 3), "error": str(e)}

if __name__ == "__main__":
    res_ac1 = test_ping()
    res_ac2 = test_buscar_laboratorios()
    print("="*50)
    print("SUMMARY AC1 & AC2:")
    print(f"AC1: {res_ac1}")
    print(f"AC2: {res_ac2}")
