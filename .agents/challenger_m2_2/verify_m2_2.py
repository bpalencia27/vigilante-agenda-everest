import asyncio
import os
import sys
import time
import traceback
from typing import List, Dict, Any

# Ensure athenea_api_bridge directory is in sys.path
BRIDGE_DIR = r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\athenea_api_bridge"
if BRIDGE_DIR not in sys.path:
    sys.path.insert(0, BRIDGE_DIR)

from config import settings
from athenea_service import AtheneaService, PatientNotFoundError, AtheneaServiceError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError


class M2ChallengerSuite:
    """Empirical verification suite for Milestone 2: AtheneaService Playwright Lifecycle, Robustness & Concurrency."""

    def __init__(self):
        self.results: List[Dict[str, Any]] = []

    def log_result(self, name: str, status: str, details: str, metrics: Dict[str, Any] = None):
        res = {
            "name": name,
            "status": status,  # "PASS" or "FAIL"
            "details": details,
            "metrics": metrics or {}
        }
        self.results.append(res)
        symbol = "[PASS]" if status == "PASS" else "[FAIL]"
        print(f"{symbol} {name}: {details}")
        if metrics:
            print(f"       Metrics: {metrics}")

    async def run_all_tests(self):
        print("=" * 70)
        print("STARTING EMPIRICAL CHALLENGE SUITE: ATHENEA SERVICE (MILESTONE 2)")
        print("=" * 70)

        await self.test_1_lifecycle_resilience()
        await self.test_2_unexpected_context_closure()
        await self.test_3_unexpected_browser_closure()
        await self.test_4_timeout_robustness()
        await self.test_5_concurrency_and_performance()

        print("=" * 70)
        print("SUMMARY OF TEST RESULTS")
        print("=" * 70)
        passed = sum(1 for r in self.results if r["status"] == "PASS")
        failed = sum(1 for r in self.results if r["status"] == "FAIL")
        print(f"Total Tests: {len(self.results)} | Passed: {passed} | Failed: {failed}")
        for r in self.results:
            print(f" - [{r['status']}] {r['name']}")
        print("=" * 70)

    async def test_1_lifecycle_resilience(self):
        """Test start, stop, restart, and idempotency."""
        print("\n--- Test 1: Service Lifecycle & Restart Resilience ---")
        service = AtheneaService()
        try:
            # 1. Start service
            t0 = time.perf_counter()
            await service.start()
            start_dur = time.perf_counter() - t0
            assert service._is_initialized is True, "service._is_initialized should be True"
            assert service._browser is not None, "service._browser should not be None"
            assert service._context is not None, "service._context should not be None"
            assert service._playwright is not None, "service._playwright should not be None"

            # 2. Idempotent start
            await service.start()
            assert service._is_initialized is True

            # 3. Stop service
            t0 = time.perf_counter()
            await service.stop()
            stop_dur = time.perf_counter() - t0
            assert service._is_initialized is False, "service._is_initialized should be False"
            assert service._browser is None, "service._browser should be None"
            assert service._context is None, "service._context should be None"
            assert service._playwright is None, "service._playwright should be None"

            # 4. Idempotent stop
            await service.stop()
            assert service._is_initialized is False

            # 5. Restart service
            await service.start()
            assert service._is_initialized is True

            # Test actual search after restart
            try:
                await service.get_id_solicitud("00000000")
            except PatientNotFoundError:
                pass  # Expected for invalid patient doc

            await service.stop()

            self.log_result(
                "Lifecycle Resilience & Restart",
                "PASS",
                "Service initialized, stopped, idempotent calls verified, restarted, and executed query successfully.",
                {"start_duration_sec": round(start_dur, 3), "stop_duration_sec": round(stop_dur, 3)}
            )
        except Exception as e:
            self.log_result(
                "Lifecycle Resilience & Restart",
                "FAIL",
                f"Exception during lifecycle test: {e}\n{traceback.format_exc()}"
            )
            try:
                await service.stop()
            except Exception:
                pass

    async def test_2_unexpected_context_closure(self):
        """Test behavior when browser context is closed unexpectedly without calling service.stop()."""
        print("\n--- Test 2: Unexpected Browser Context Closure ---")
        service = AtheneaService()
        try:
            await service.start()

            # Unexpectedly close the context directly
            print("Simulating unexpected context closure via service._context.close()...")
            await service._context.close()
            assert service._context.is_closed() is True

            # Check state before call
            print(f"State after context close: _is_initialized={service._is_initialized}, _context={service._context}")

            # Try to query get_id_solicitud
            first_attempt_failed = False
            first_err_msg = ""
            try:
                await service.get_id_solicitud("00000000")
            except Exception as e:
                first_attempt_failed = True
                first_err_msg = f"{type(e).__name__}: {e}"
                print(f"First search after context closure caught expected exception: {first_err_msg}")

            # Second query attempt: Can the service self-recover on subsequent calls?
            second_attempt_failed = False
            second_err_msg = ""
            try:
                await service.get_id_solicitud("00000000")
                print("Second search succeeded (Self-recovery occurred!).")
            except Exception as e:
                second_attempt_failed = True
                second_err_msg = f"{type(e).__name__}: {e}"
                print(f"Second search after context closure ALSO failed: {second_err_msg}")

            await service.stop()

            if first_attempt_failed and second_attempt_failed:
                # VULNERABILITY FOUND: Service does not self-recover from closed context because _is_initialized is True
                self.log_result(
                    "Unexpected Context Closure Self-Recovery",
                    "FAIL",
                    f"VULNERABILITY DETECTED: Service failed to self-recover when context was closed unexpectedly. Subsequent calls fail continuously until manual stop()/start(). First error: [{first_err_msg}], Second error: [{second_err_msg}]",
                    {"self_recovered": False, "first_error": first_err_msg, "second_error": second_err_msg}
                )
            elif first_attempt_failed and not second_attempt_failed:
                self.log_result(
                    "Unexpected Context Closure Self-Recovery",
                    "PASS",
                    "First call failed as context was closed, but service self-recovered on the second call.",
                    {"self_recovered": True}
                )
            else:
                self.log_result(
                    "Unexpected Context Closure Self-Recovery",
                    "FAIL",
                    "Unexpected: search did not fail even though context was closed.",
                )

        except Exception as e:
            self.log_result(
                "Unexpected Context Closure Test Execution",
                "FAIL",
                f"Exception running test: {e}\n{traceback.format_exc()}"
            )
            try:
                await service.stop()
            except Exception:
                pass

    async def test_3_unexpected_browser_closure(self):
        """Test behavior when browser instance is closed unexpectedly."""
        print("\n--- Test 3: Unexpected Browser Closure ---")
        service = AtheneaService()
        try:
            await service.start()

            # Unexpectedly close the browser instance
            print("Simulating unexpected browser closure via service._browser.close()...")
            await service._browser.close()

            first_attempt_failed = False
            first_err_msg = ""
            try:
                await service.get_id_solicitud("00000000")
            except Exception as e:
                first_attempt_failed = True
                first_err_msg = f"{type(e).__name__}: {e}"
                print(f"First search after browser closure caught expected exception: {first_err_msg}")

            second_attempt_failed = False
            second_err_msg = ""
            try:
                await service.get_id_solicitud("00000000")
            except Exception as e:
                second_attempt_failed = True
                second_err_msg = f"{type(e).__name__}: {e}"
                print(f"Second search after browser closure ALSO failed: {second_err_msg}")

            await service.stop()

            if first_attempt_failed and second_attempt_failed:
                self.log_result(
                    "Unexpected Browser Closure Self-Recovery",
                    "FAIL",
                    f"VULNERABILITY DETECTED: Service failed to self-recover when browser process was closed unexpectedly. First error: [{first_err_msg}], Second error: [{second_err_msg}]",
                    {"self_recovered": False, "first_error": first_err_msg, "second_error": second_err_msg}
                )
            elif first_attempt_failed and not second_attempt_failed:
                self.log_result(
                    "Unexpected Browser Closure Self-Recovery",
                    "PASS",
                    "First call failed after browser closed, but service self-recovered on second call.",
                    {"self_recovered": True}
                )
            else:
                self.log_result(
                    "Unexpected Browser Closure Self-Recovery",
                    "FAIL",
                    "Unexpected behavior during browser closure test."
                )

        except Exception as e:
            self.log_result(
                "Unexpected Browser Closure Test Execution",
                "FAIL",
                f"Exception running test: {e}\n{traceback.format_exc()}"
            )
            try:
                await service.stop()
            except Exception:
                pass

    async def test_4_timeout_robustness(self):
        """Test behavior when page navigation/search times out."""
        print("\n--- Test 4: Page Navigation & Search Timeout Robustness ---")
        service = AtheneaService()
        orig_page_timeout = settings.PAGE_TIMEOUT
        orig_search_timeout = settings.SEARCH_TIMEOUT

        try:
            await service.start()

            # Part A: Test PAGE_TIMEOUT threshold by setting extremely low timeout (1ms)
            settings.PAGE_TIMEOUT = 1
            print("Set PAGE_TIMEOUT = 1ms to trigger intentional PlaywrightTimeoutError...")

            t0 = time.perf_counter()
            timeout_caught = False
            exception_type = None
            try:
                await service.get_id_solicitud("00000000")
            except TimeoutError as e:
                timeout_caught = True
                exception_type = type(e).__name__
                print(f"Caught expected TimeoutError: {e}")
            except Exception as e:
                exception_type = type(e).__name__
                print(f"Caught unexpected exception type: {exception_type} - {e}")
            dur_ms = (time.perf_counter() - t0) * 1000

            # Restore normal PAGE_TIMEOUT
            settings.PAGE_TIMEOUT = orig_page_timeout

            # Part B: Verify service recovery after timeout
            print("Restored PAGE_TIMEOUT. Testing if service functions after timeout...")
            post_timeout_success = False
            try:
                await service.get_id_solicitud("00000000")
                post_timeout_success = True
            except PatientNotFoundError:
                post_timeout_success = True
            except Exception as e:
                print(f"Post-timeout search failed: {type(e).__name__} - {e}")

            await service.stop()

            if timeout_caught and post_timeout_success:
                self.log_result(
                    "Timeout Robustness & Post-Timeout Recovery",
                    "PASS",
                    f"Timeout correctly caught as TimeoutError (duration: {dur_ms:.1f}ms). Subsequent search succeeded, proving no resource leak or lock deadlock.",
                    {"timeout_duration_ms": round(dur_ms, 1), "post_timeout_success": True}
                )
            else:
                self.log_result(
                    "Timeout Robustness & Post-Timeout Recovery",
                    "FAIL",
                    f"Timeout handling failure. timeout_caught={timeout_caught} (expected TimeoutError, got {exception_type}), post_timeout_success={post_timeout_success}",
                    {"timeout_duration_ms": round(dur_ms, 1), "post_timeout_success": post_timeout_success}
                )

        except Exception as e:
            self.log_result(
                "Timeout Robustness Test Execution",
                "FAIL",
                f"Exception running test: {e}\n{traceback.format_exc()}"
            )
        finally:
            settings.PAGE_TIMEOUT = orig_page_timeout
            settings.SEARCH_TIMEOUT = orig_search_timeout
            try:
                await service.stop()
            except Exception:
                pass

    async def test_5_concurrency_and_performance(self):
        """Test concurrent requests to get_id_solicitud and measure performance/serialization metrics."""
        print("\n--- Test 5: Concurrency Handling & Performance Benchmark ---")
        service = AtheneaService()
        num_concurrent = 3
        test_docs = ["00000001", "00000002", "00000003"]

        try:
            await service.start()

            request_timings = []

            async def timed_request(doc_id: str, req_num: int):
                start_time = time.perf_counter()
                status = "UNKNOWN"
                err = None
                try:
                    res = await service.get_id_solicitud(doc_id)
                    status = f"SUCCESS:{res}"
                except PatientNotFoundError:
                    status = "NOT_FOUND"
                except Exception as e:
                    status = f"ERROR:{type(e).__name__}"
                    err = str(e)
                end_time = time.perf_counter()
                dur = end_time - start_time
                timing = {
                    "req_num": req_num,
                    "doc_id": doc_id,
                    "start_rel": round(start_time - total_t0, 3),
                    "end_rel": round(end_time - total_t0, 3),
                    "duration_sec": round(dur, 3),
                    "status": status,
                    "err": err
                }
                request_timings.append(timing)
                return timing

            print(f"Launching {num_concurrent} concurrent requests to get_id_solicitud...")
            total_t0 = time.perf_counter()

            tasks = [timed_request(test_docs[i], i + 1) for i in range(num_concurrent)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            total_dur = time.perf_counter() - total_t0

            await service.stop()

            # Sort timings by req_num
            request_timings.sort(key=lambda x: x["req_num"])

            print("\nConcurrent Request Timings:")
            for t in request_timings:
                print(f" Req #{t['req_num']} (Doc {t['doc_id']}): Start={t['start_rel']}s | End={t['end_rel']}s | Latency={t['duration_sec']}s | Status={t['status']}")

            # Analyze serialization
            # If strictly serialized, start of req N >= end of req N-1 (or start is after lock acquisition)
            serialized = True
            for i in range(1, len(request_timings)):
                prev_end = request_timings[i-1]["end_rel"]
                curr_start = request_timings[i]["start_rel"]
                # If current started before previous ended, there was overlap in scheduling, but lock held execution
                # Check if total_dur ~ sum of individual durations
            
            sum_durations = sum(t["duration_sec"] for t in request_timings)
            avg_duration = sum_durations / len(request_timings)

            all_passed = all(t["status"] in ("NOT_FOUND", "SUCCESS") or t["status"].startswith("SUCCESS") for t in request_timings)

            details = (
                f"Processed {num_concurrent} concurrent requests in {total_dur:.2f}s total. "
                f"Avg latency per request: {avg_duration:.2f}s. Total sum of latencies: {sum_durations:.2f}s. "
                f"Serial execution ratio: {total_dur / sum_durations:.2f} (1.0 indicates pure serialization under lock)."
            )

            metrics = {
                "num_concurrent_requests": num_concurrent,
                "total_batch_duration_sec": round(total_dur, 2),
                "avg_request_latency_sec": round(avg_duration, 2),
                "sum_request_latencies_sec": round(sum_durations, 2),
                "all_requests_succeeded_or_not_found": all_passed,
                "request_details": request_timings
            }

            if all_passed:
                self.log_result(
                    "Concurrency Handling & Performance",
                    "PASS",
                    details,
                    metrics
                )
            else:
                self.log_result(
                    "Concurrency Handling & Performance",
                    "FAIL",
                    f"Some concurrent requests failed. Details: {details}",
                    metrics
                )

        except Exception as e:
            self.log_result(
                "Concurrency Test Execution",
                "FAIL",
                f"Exception running concurrency test: {e}\n{traceback.format_exc()}"
            )
            try:
                await service.stop()
            except Exception:
                pass


if __name__ == "__main__":
    suite = M2ChallengerSuite()
    asyncio.run(suite.run_all_tests())
