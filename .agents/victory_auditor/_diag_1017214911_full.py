import asyncio
import sys

bridge_dir = r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\athenea_api_bridge"
if bridge_dir not in sys.path:
    sys.path.insert(0, bridge_dir)

from playwright.async_api import async_playwright
from config import settings

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=settings.HEADLESS)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        
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
            await page.wait_for_timeout(3000)
            
        content = await page.content()
        with open("athenea_patient_1017214911.html", "w", encoding="utf-8") as f:
            f.write(content)
            
        print("HTML saved to athenea_patient_1017214911.html (length:", len(content), ")")
        
        # Also print all text inside tables or cards or results
        text_content = await page.evaluate("() => document.body.innerText")
        print("\n--- Body Inner Text ---")
        print(text_content)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
