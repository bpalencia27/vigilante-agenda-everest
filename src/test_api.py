import os
import requests
from session_manager import ChromeSessionManager

# Script de exploración (vía HTTP, reservada para el futuro). Ponga su login por variable
# de entorno EVEREST_LOGIN para no dejar credenciales en el código:
#   set EVEREST_LOGIN=su_login   (Windows)
LOGIN = os.environ.get("EVEREST_LOGIN", "TU_LOGIN_EVEREST")

sm = ChromeSessionManager(target_domain="neps.everestintelligent.com")
cookies = sm.extract_cookies()
print(f"Cookies extraídas: {cookies}")

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://neps.everestintelligent.com/viva/HCHealth/",
}

_BASE = "https://neps.everestintelligent.com/apiviva/APIMedicoHealth/api"
endpoints = [
    f"{_BASE}/Medico/ObtenerDatosLoginByLogin?login={LOGIN}",
    f"{_BASE}/Medico/ObtenerIdMedico?login={LOGIN}",
    f"{_BASE}/Medico/ObtenerCitasDelDia?login={LOGIN}",
    f"{_BASE}/Agenda/ObtenerCitasDelDia?login={LOGIN}",
    f"{_BASE}/Cita/ObtenerCitasDelDia?login={LOGIN}",
    f"{_BASE}/Agenda/ObtenerAgendaMedico?login={LOGIN}",
    f"{_BASE}/Cita/ObtenerAgendaDelDia",
]

for url in endpoints:
    try:
        r = requests.get(url, cookies=cookies, headers=headers, timeout=5)
        print(f"URL: {url} -> Status: {r.status_code}, Length: {len(r.text)}, Content: {r.text[:200]}")
    except Exception as e:
        print(f"URL: {url} -> Error: {e}")
