import asyncio
import sys
import os

bridge_dir = r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\athenea_api_bridge"
if bridge_dir not in sys.path:
    sys.path.insert(0, bridge_dir)

from playwright.async_api import async_playwright
from config import settings

async def main():
    print("Launching Playwright to inspect document 1017214911...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=settings.HEADLESS)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        
        # Intercept network requests
        requests_log = []
        page.on("request", lambda r: requests_log.append(r.url))
        
        # Navigate to Athenea
        search_url = f"{settings.ATHENEA_BASE_URL.rstrip('/')}/Resultados/BuscarPaciente"
        print(f"Navigating to {search_url}")
        await page.goto(search_url, wait_until="networkidle")
        
        # Login if needed
        user_input = await page.query_selector("#Username, #txtUsuario, input[name='Usuario']")
        if user_input and await user_input.is_visible():
            print("Logging in...")
            pwd_input = await page.query_selector("#Password, #inputCont, input[name='Password']")
            await user_input.fill(settings.ATHENEA_USER)
            await pwd_input.fill(settings.ATHENEA_PASSWORD)
            submit_btn = await page.query_selector("button[type='submit'], input[type='submit'], button.btn")
            if submit_btn:
                await submit_btn.click()
                await page.wait_for_load_state("networkidle")
                
        if "BuscarPaciente" not in page.url:
            await page.goto(search_url, wait_until="networkidle")
            
        print("Page URL:", page.url)
        
        # Search document 1017214911
        doc_input = await page.query_selector("#NumeroIdentificacion, #txtNumIdentificacion, input[name='numId'], input[name='NumeroIdentificacion'], #Documento")
        print("Doc input found:", bool(doc_input))
        if doc_input:
            await doc_input.fill("1017214911")
            search_btn = await page.query_selector("#frmDatosPaciente button, #frmDatosPaciente input[type='submit'], button:has-text('Buscar')")
            print("Search btn found:", bool(search_btn))
            if search_btn:
                await search_btn.click()
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(2000)
            
        content = await page.content()
        print("--- Page HTML snippet after search (length:", len(content), ") ---")
        print(content[:2000])
        
        # Look for buttons, links, tables, onclick, idSolicitud, consultaDetalleSolicitud
        print("\n--- Searching for spans/links/tables in DOM ---")
        spans = await page.query_selector_all("span, a, button, tr, td")
        matches = []
        for s in spans:
            h = await s.evaluate("el => el.outerHTML")
            if any(k in h.lower() for k in ["solicitud", "ver", "resumen", "detalle", "1017214911", "consulta", "lab"]):
                matches.append(h[:200])
                
        print(f"Found {len(matches)} matching DOM elements. Sample:")
        for m in matches[:10]:
            print(" -", m)
            
        print("\n--- Relevant network requests ---")
        for req in requests_log:
            if "Resultados" in req or "api" in req or "Solicitud" in req:
                print(" Req:", req)
                
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
