import time
import urllib.request
import urllib.error
import json

def test_endpoint(doc):
    url = f"http://127.0.0.1:5050/api/buscar_laboratorios?documento={doc}"
    start = time.perf_counter()
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode('utf-8')
            elapsed = time.perf_counter() - start
            print(f"Doc '{doc}' -> Status: {resp.status} | Latency: {elapsed:.2f}s | Response: {data}")
            return resp.status, elapsed, data
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - start
        data = e.read().decode('utf-8')
        print(f"Doc '{doc}' -> HTTPError: {e.code} | Latency: {elapsed:.2f}s | Response: {data}")
        return e.code, elapsed, data
    except Exception as e:
        elapsed = time.perf_counter() - start
        print(f"Doc '{doc}' -> Exception: {e} | Latency: {elapsed:.2f}s")
        return None, elapsed, str(e)

if __name__ == "__main__":
    print("=== LIVE API BRIDGE BEHAVIORAL TEST ===")
    test_endpoint("1017214911")
    test_endpoint("00000000")
    test_endpoint("")
