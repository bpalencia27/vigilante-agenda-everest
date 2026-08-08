import asyncio
import sys

bridge_dir = r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\athenea_api_bridge"
if bridge_dir not in sys.path:
    sys.path.insert(0, bridge_dir)

from playwright.async_api import async_playwright
from config import settings
from urllib.parse import parse_qs, urlparse

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=settings.HEADLESS)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        
        captured_id = None
        
        def handle_request(req):
            nonlocal captured_id
            url = req.url
            if "consultaDetalleSolicitud" in url or "idSolicitud" in url:
                print(" [INTERCEPTED REQUEST]:", url)
                parsed = urlparse(url)
                params = parse_qs(parsed.query)
                if "idSolicitud" in params:
                    captured_id = params["idSolicitud"][0]
                elif "id" in params:
                    captured_id = params["id"][0]

        page.on("request", handle_request)
        
        # 1. Search page
        search_url = f"{settings.ATHENEA_BASE_URL.rstrip('/')}/Resultados/BuscarPaciente"
        await page.goto(search_url, wait_until="networkidle")
        
        user_input = await page.query_selector("#Username, #txtUsuario, input[name='Usuario']")
        if user_input and await user_input.is_visible():
            pwd_input = await page.query_selector("#Password, #inputCont, input[name='Password']")
            await user_input.fill(settings.ATHENEA_USER)
            await pwd_input.fill(settings.ATHENEA_PASSWORD)
            submit_btn = await page.query_selector("button[type='submit'], input[type='submit'], button.btn")
            if submit_btn:
                await submit_btn.click()
                await page.wait_for_load_state("networkidle")
                
        if "BuscarPaciente" not in page.url:
            await page.goto(search_url, wait_until="networkidle")
            
        doc_input = await page.query_selector("#NumeroIdentificacion, #txtNumIdentificacion, input[name='numId'], input[name='NumeroIdentificacion'], #Documento")
        if doc_input:
            await doc_input.fill("1017214911")
            search_btn = await page.query_selector("#frmDatosPaciente button, #frmDatosPaciente input[type='submit'], button:has-text('Buscar')")
            if search_btn:
                await search_btn.click()
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)
            
        # 2. Click Ver Estado de Resultados if present
        ver_estado_btn = await page.query_selector("button:has-text('Ver Estado de Resultados'), input[value='Ver Estado de Resultados']")
        if ver_estado_btn:
            print("Clicking 'Ver Estado de Resultados'...")
            await ver_estado_btn.click()
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)
            
        # 3. Find Ver Resumen or consultaDetalleSolicitud elements on DatosPaciente page
        spans = await page.query_selector_all("span.cursor-pointer, a.cursor-pointer, .cursor-pointer, span:has-text('Ver Resumen'), a:has-text('Ver Resumen'), button:has-text('Ver Resumen')")
        print(f"Found {len(spans)} 'Ver Resumen' elements on page!")
        
        for i, s in enumerate(spans):
            html = await s.evaluate("el => el.outerHTML")
            onclick = await s.get_attribute("onclick") or ""
            href = await s.get_attribute("href") or ""
            print(f" Element {i}: html={html[:100]} | onclick={onclick} | href={href}")
            
        if spans:
            print("Clicking first 'Ver Resumen' element...")
            await spans[0].click()
            await page.wait_for_timeout(2000)
            
        print("Captured idSolicitud:", captured_id)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
