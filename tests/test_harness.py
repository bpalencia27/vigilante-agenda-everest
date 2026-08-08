import os
import sys
import tempfile
import shutil
import time
import subprocess
import win32api
import win32event
import winerror
from playwright.sync_api import sync_playwright

class PlaywrightHarness:
    def __init__(self, user_data_dir=None, headless=False):
        self.mutex = None
        self._acquire_mutex()

        self.user_data_dir = user_data_dir or tempfile.mkdtemp(prefix='vgl_pw_profile_')
        self._is_temp_profile = user_data_dir is None
        self.headless = headless
        self.playwright = None
        self.context = None
        self.page = None
        self.console_logs = []
        self.page_errors = []

    def _acquire_mutex(self):
        if sys.platform == 'win32':
            try:
                self.mutex = win32event.CreateMutex(None, 1, 'Vigilante_Agenda_TestHarness_Mutex')
                if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
                    print("[WARN] Mutex exists: Another instance of Vigilante Test Harness is active.")
            except Exception as e:
                print(f"[WARN] Mutex creation non-fatal error: {e}")

    def launch(self):
        self.playwright = sync_playwright().start()
        
        # SKILL Rule 2: Persistent context launch with visible Chromium window
        try:
            self.context = self.playwright.chromium.launch_persistent_context(
                user_data_dir=self.user_data_dir,
                headless=self.headless,
                channel="chrome",
                args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
                no_viewport=True
            )
        except Exception as err:
            err_str = str(err).encode('ascii', 'replace').decode('ascii')
            print(f"[WARN] Launching with channel='chrome' failed ({err_str}), falling back to standard Chromium")
            self.context = self.playwright.chromium.launch_persistent_context(
                user_data_dir=self.user_data_dir,
                headless=self.headless,
                args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
                no_viewport=True
            )

        # SKILL Rule 2: Critical Tab Cleanup Logic
        while len(self.context.pages) > 1:
            try:
                self.context.pages[-1].close()
            except Exception:
                pass

        self.page = self.context.pages[0] if len(self.context.pages) > 0 else self.context.new_page()

        # Attach Console & Page Error Listeners
        self.page.on("console", self._handle_console)
        self.page.on("pageerror", self._handle_pageerror)

        return self.page

    def _handle_console(self, msg):
        log_entry = {
            "type": msg.type,
            "text": msg.text,
            "location": msg.location
        }
        self.console_logs.append(log_entry)

    def _handle_pageerror(self, error):
        self.page_errors.append(str(error))
        print(f"[PAGE ERROR] {error}")

    def take_screenshot(self, name):
        artifacts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifacts", "screenshots"))
        os.makedirs(artifacts_dir, exist_ok=True)
        path = os.path.join(artifacts_dir, f"{name}.png")
        self.page.screenshot(path=path, full_page=True)
        return path

    def start_tracing(self):
        if self.context:
            self.context.tracing.start(screenshots=True, snapshots=True, sources=True)

    def stop_tracing(self, output_name):
        if self.context:
            artifacts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifacts", "traces"))
            os.makedirs(artifacts_dir, exist_ok=True)
            path = os.path.join(artifacts_dir, f"{output_name}.zip")
            self.context.tracing.stop(path=path)
            return path

    def close(self):
        if self.page:
            try:
                self.page.close()
            except Exception:
                pass
            self.page = None

        if self.context:
            try:
                self.context.close()
            except Exception:
                pass
            self.context = None

        if self.playwright:
            try:
                self.playwright.stop()
            except Exception:
                pass
            self.playwright = None

        if getattr(self, '_is_temp_profile', False) and self.user_data_dir and os.path.exists(self.user_data_dir):
            cleaned = False
            for _ in range(10):
                try:
                    shutil.rmtree(self.user_data_dir)
                    cleaned = True
                    break
                except Exception:
                    time.sleep(0.3)

            if not cleaned and os.path.exists(self.user_data_dir):
                try:
                    folder_name = os.path.basename(self.user_data_dir)
                    cmd = f"Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object CommandLine -like '*{folder_name}*' | Stop-Process -Force"
                    subprocess.run(["powershell", "-Command", cmd], capture_output=True)
                except Exception:
                    pass
                try:
                    shutil.rmtree(self.user_data_dir, ignore_errors=True)
                except Exception:
                    pass

        if self.mutex and sys.platform == 'win32':
            try:
                win32api.CloseHandle(self.mutex)
            except Exception:
                pass
            self.mutex = None


