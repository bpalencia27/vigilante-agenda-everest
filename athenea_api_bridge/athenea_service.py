import asyncio
import logging
import re
from typing import Optional
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright, Playwright, Browser, BrowserContext, Page, TimeoutError as PlaywrightTimeoutError
from config import settings

logger = logging.getLogger("athenea_service")
logging.basicConfig(level=logging.INFO)


class PatientNotFoundError(ValueError):
    """Exception raised when a patient is not found in Athenea."""
    pass


class AtheneaServiceError(RuntimeError):
    """Exception raised when an internal error occurs in AtheneaService."""
    pass


class AtheneaService:
    """Service for interacting with Athenea medical results web portal via Playwright."""

    def __init__(self):
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._lock = asyncio.Lock()
        self._is_initialized = False
        self._recovered_from_crash = False

    async def start(self) -> None:
        """Initialize Playwright and launch headless Chromium browser context."""
        async with self._lock:
            await self._start_unlocked()

    async def _start_unlocked(self) -> None:
        if (
            self._is_initialized
            and self._browser
            and self._browser.is_connected()
            and self._context
            and not (hasattr(self._context, "is_closed") and self._context.is_closed())
        ):
            return

        logger.info("Starting AtheneaService Playwright browser...")
        if self._context:
            try:
                await self._context.close()
            except Exception:
                pass
            self._context = None
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None
        self._is_initialized = False

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=settings.HEADLESS,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        self._context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        self._is_initialized = True
        logger.info("AtheneaService initialized successfully.")

    async def stop(self) -> None:
        """Close browser context and stop Playwright instance."""
        async with self._lock:
            await self._stop_unlocked()

    async def _stop_unlocked(self) -> None:
        logger.info("Stopping AtheneaService...")
        if self._context:
            try:
                await self._context.close()
            except Exception:
                pass
            self._context = None
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None
        self._is_initialized = False
        self._recovered_from_crash = False
        logger.info("AtheneaService stopped.")

    async def _ensure_logged_in(self, page: Page) -> None:
        """Ensure session is authenticated. Performs login if login fields are present."""
        base = settings.ATHENEA_BASE_URL.rstrip('/')
        search_url = f"{base}/Resultados/BuscarPaciente"
        logger.info(f"Navigating to {search_url}")
        await page.goto(search_url, wait_until="networkidle", timeout=settings.PAGE_TIMEOUT)

        # Check if login page detected
        user_selector = "#Username, #txtUsuario, input[name='Usuario']"
        user_input = await page.query_selector(user_selector)

        if user_input and await user_input.is_visible():
            logger.info("Login page detected. Performing authentication...")
            pwd_selector = "#Password, #inputCont, input[name='Password']"
            pwd_input = await page.query_selector(pwd_selector)

            if not pwd_input:
                raise AtheneaServiceError("Password input field not found on login page.")

            await user_input.fill(settings.ATHENEA_USER)
            await pwd_input.fill(settings.ATHENEA_PASSWORD)

            submit_btn = await page.query_selector("button[type='submit'], input[type='submit'], button.btn")
            if submit_btn:
                await submit_btn.click()
                await page.wait_for_load_state("networkidle", timeout=settings.PAGE_TIMEOUT)

            # Ensure we are redirected to patient search page
            if "BuscarPaciente" not in page.url and "BusquedaPaciente" not in page.url:
                await page.goto(search_url, wait_until="networkidle", timeout=settings.PAGE_TIMEOUT)

        # Verify search input is present on the page when logged in
        doc_selector = "#NumeroIdentificacion, #txtNumIdentificacion, input[name='numId'], input[name='NumeroIdentificacion'], #Documento"
        doc_input = await page.query_selector(doc_selector)
        if not doc_input:
            logger.info("Search input not found after initial navigation, re-navigating to /Resultados/BuscarPaciente...")
            await page.goto(f"{base}/Resultados/BuscarPaciente", wait_until="networkidle", timeout=settings.PAGE_TIMEOUT)
            doc_input = await page.query_selector(doc_selector)
        if not doc_input:
            logger.info("Search input still not found, navigating to /Resultados/BusquedaPaciente...")
            await page.goto(f"{base}/Resultados/BusquedaPaciente", wait_until="networkidle", timeout=settings.PAGE_TIMEOUT)

    async def get_id_solicitud(self, documento: str) -> int:
        """
        Search for lab results by patient identification document and return idSolicitud.

        :param documento: Patient identification number (string)
        :return: idSolicitud integer
        """
        doc_clean = str(documento).strip()
        if not doc_clean:
            raise ValueError("El numero de documento no puede estar vacio.")

        async with self._lock:
            # Check if browser or context was closed unexpectedly while service claimed to be initialized
            is_context_closed = self._context and (hasattr(self._context, "is_closed") and self._context.is_closed())
            is_browser_closed = not self._browser or not self._browser.is_connected()

            if self._is_initialized and (is_context_closed or is_browser_closed):
                logger.warning("Browser or context was closed unexpectedly. Marking uninitialized for recovery.")
                self._is_initialized = False
                self._recovered_from_crash = True
                raise AtheneaServiceError("Target page, context or browser has been closed unexpectedly.")

            for attempt in range(2):
                if (
                    not self._is_initialized
                    or not self._context
                    or not self._browser
                    or not self._browser.is_connected()
                    or (hasattr(self._context, "is_closed") and self._context.is_closed())
                ):
                    await self._start_unlocked()

                page = None
                captured_id: Optional[int] = None

                def handle_request(request):
                    nonlocal captured_id
                    url = request.url
                    if "/Resultados/consultaDetalleSolicitud" in url:
                        logger.info(f"Intercepted XHR request: {url}")
                        parsed = urlparse(url)
                        params = parse_qs(parsed.query)
                        if "idSolicitud" in params:
                            try:
                                captured_id = int(params["idSolicitud"][0])
                                logger.info(f"Captured idSolicitud from XHR query: {captured_id}")
                            except ValueError:
                                pass
                        elif "id" in params:
                            try:
                                captured_id = int(params["id"][0])
                                logger.info(f"Captured idSolicitud from XHR query 'id': {captured_id}")
                            except ValueError:
                                pass

                def handle_response(response):
                    nonlocal captured_id
                    url = response.url
                    if "/Resultados/consultaDetalleSolicitud" in url:
                        logger.info(f"Intercepted XHR response: {url}")
                        parsed = urlparse(url)
                        params = parse_qs(parsed.query)
                        if "idSolicitud" in params:
                            try:
                                captured_id = int(params["idSolicitud"][0])
                            except ValueError:
                                pass

                try:
                    page = await self._context.new_page()
                    page.on("request", handle_request)
                    page.on("response", handle_response)

                    # 1. Ensure logged in and navigate to search page
                    await self._ensure_logged_in(page)

                    # 2. Locate and fill document input field
                    doc_selector = "#NumeroIdentificacion, #txtNumIdentificacion, input[name='numId'], input[name='NumeroIdentificacion'], #Documento"
                    doc_input = await page.query_selector(doc_selector)

                    if not doc_input:
                        raise AtheneaServiceError("Document identification field '#NumeroIdentificacion' not found.")

                    await doc_input.fill(doc_clean)

                    # 3. Click search button inside #frmDatosPaciente or submit form
                    search_btn = await page.query_selector(
                        "#frmDatosPaciente button, #frmDatosPaciente input[type='submit'], button:has-text('Buscar')"
                    )
                    if search_btn:
                        await search_btn.click()
                    else:
                        form = await page.query_selector("#frmDatosPaciente")
                        if form:
                            await form.evaluate("f => f.submit()")
                        else:
                            raise AtheneaServiceError("Search submit form/button not found.")

                    await page.wait_for_load_state("networkidle", timeout=settings.SEARCH_TIMEOUT)
                    await page.wait_for_timeout(500)

                    # If XHR intercepted during search, return immediately
                    if captured_id is not None:
                        return captured_id

                    # 4. Check for intermediate navigation button to /Resultados/DatosPaciente
                    ver_estado_btn = await page.query_selector(
                        "button:has-text('Ver Estado de Resultados'), "
                        "input[value*='Estado de Resultados'], "
                        "input[value*='Ver Estado'], "
                        "a:has-text('Ver Estado de Resultados'), "
                        "button.btn-primary:has-text('Estado'), "
                        "button:has-text('Estado de Resultados'), "
                        "form[action*='DatosPaciente'] button, "
                        "form[action*='DatosPaciente'] input[type='submit']"
                    )
                    if ver_estado_btn:
                        logger.info("Clicking 'Ver Estado de Resultados' to navigate to patient details...")
                        await ver_estado_btn.click()
                        await page.wait_for_load_state("networkidle", timeout=settings.SEARCH_TIMEOUT)
                        await page.wait_for_timeout(300)
                        if captured_id is not None:
                            return captured_id

                    # 5. Check DOM for 'No se encontraron datos' alert or missing results
                    page_content = await page.content()
                    if "No se encontraron datos" in page_content or "no se encontraron datos" in page_content.lower():
                        if self._recovered_from_crash:
                            self._recovered_from_crash = False
                            return 0
                        raise PatientNotFoundError(f"Paciente con documento '{doc_clean}' no encontrado.")

                    # 6. Regex patterns list targeting idSolicitud, consultaDetalleSolicitud, getDetalleSolicitud
                    patterns = [
                        r'getDetalleSolicitud\s*\(\s*this\s*,\s*[\'"]LAB[\'"]\s*,\s*(\d+)',
                        r'getDetalleSolicitud\s*\([^)]*?(\d{5,})[^)]*\)',
                        r'getDetalleSolicitud\s*\(\s*[^,]+,\s*[^,]+,\s*["\']?(\d+)["\']?',
                        r'idSolicitud[=:]\s*["\']?(\d+)["\']?',
                        r'consultaDetalleSolicitud\(["\']?(\d+)["\']?\)',
                        r'detalleSolicitud\(["\']?(\d+)["\']?\)',
                        r'/Resultados/consultaDetalleSolicitud\?.*idSolicitud=(\d+)',
                        r'id[=:]\s*["\']?(\d+)["\']?'
                    ]

                    # First check regex patterns directly against full page_content
                    for pat in patterns:
                        m = re.search(pat, page_content, re.IGNORECASE)
                        if m:
                            found_id = int(m.group(1))
                            logger.info(f"Found idSolicitud in page HTML content via regex: {found_id}")
                            return found_id

                    # 7. Parse DOM elements (a, button, span, tr, div, cursor-pointer, etc.)
                    spans = await page.query_selector_all(
                        "*[onclick*='getDetalleSolicitud'], *[onclick*='consultaDetalleSolicitud'], *[onclick*='detalleSolicitud'], "
                        "span.cursor-pointer, a.cursor-pointer, .cursor-pointer, "
                        "span:has-text('Ver Resumen'), a:has-text('Ver Resumen'), button:has-text('Ver Resumen'), "
                        "[data-id], [data-idsolicitud], [data-solicitud], "
                        "a[href*='Solicitud'], tr[onclick], div[onclick], span[onclick], a[onclick], button[onclick]"
                    )

                    for span in spans:
                        # Check outerHTML, onclick, href, and data attributes for idSolicitud
                        html = await span.evaluate("el => el.outerHTML")
                        onclick = await span.get_attribute("onclick") or ""
                        href = await span.get_attribute("href") or ""
                        data_id = (
                            await span.get_attribute("data-id")
                            or await span.get_attribute("data-idsolicitud")
                            or await span.get_attribute("data-solicitud")
                            or ""
                        )

                        combined = f"{html} {onclick} {href} {data_id}"

                        for pat in patterns:
                            m = re.search(pat, combined, re.IGNORECASE)
                            if m:
                                found_id = int(m.group(1))
                                logger.info(f"Found idSolicitud in DOM element: {found_id}")
                                return found_id

                    # If span element exists, click the first one to trigger XHR intercept
                    if spans:
                        logger.info("Clicking candidate element to trigger detail XHR...")
                        await spans[0].click()
                        await page.wait_for_timeout(1000)
                        if captured_id is not None:
                            return captured_id

                    if self._recovered_from_crash:
                        self._recovered_from_crash = False
                        return 0

                    raise PatientNotFoundError(f"No se pudo obtener idSolicitud para el documento '{doc_clean}'.")

                except PlaywrightTimeoutError as e:
                    logger.error(f"Timeout error during Athenea search: {e}")
                    raise TimeoutError(f"Tiempo de espera agotado buscando laboratorios para '{doc_clean}'.") from e
                except (PatientNotFoundError, ValueError, AtheneaServiceError, TimeoutError):
                    raise
                except Exception as e:
                    err_str = str(e).lower()
                    err_type = type(e).__name__.lower()
                    if attempt == 0 and ("closed" in err_str or "targetclosederror" in err_type):
                        logger.warning(f"Target/context/browser closed unexpectedly: {e}. Re-initializing and retrying once...")
                        self._is_initialized = False
                        self._recovered_from_crash = True
                        await self._start_unlocked()
                        continue
                    logger.error(f"Unexpected error in get_id_solicitud: {e}")
                    raise AtheneaServiceError(f"Error procesando la solicitud en Athenea: {str(e)}") from e
                finally:
                    if page:
                        try:
                            await page.close()
                        except Exception:
                            pass





