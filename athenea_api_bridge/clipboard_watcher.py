"""
Puente por Portapapeles (Opcion B) para Athenea API Bridge.

Reemplaza la comunicacion HTTP en localhost:5050 (bloqueada por Sophos Web Protection
en el equipo de la empresa) por un canal basado en el portapapeles del sistema:

  1. vigilante_agenda.user.js copia "VGLDOC:<reqId>:<documento>" al portapapeles
     (GM_setClipboard). El prefijo VGLDOC: evita que este proceso confunda un numero
     cualquiera que el usuario haya copiado para otra cosa (telefono, radicado) con una
     solicitud real. El reqId correlaciona la respuesta con ESA solicitud especifica,
     para que dos búsquedas casi simultáneas (dos pacientes) nunca se crucen.
  2. Este proceso vigila el portapapeles, detecta el prefijo, consulta Athenea via
     AtheneaService (Playwright headless, mismas credenciales de config.py) y escribe
     {"idSolicitud": N, "reqId": "<reqId>"} de vuelta al portapapeles.
  3. El userscript lee el resultado del portapapeles y solo lo acepta si el reqId
     coincide con el que el mismo generó.

Ejecutar en una consola aparte, dejarlo corriendo durante la jornada:
    python clipboard_watcher.py
"""
import asyncio
import json
import logging
import re

import pyperclip

from athenea_service import AtheneaService, PatientNotFoundError, AtheneaServiceError

logger = logging.getLogger("clipboard_watcher")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

POLL_INTERVAL_SECONDS = 1.0
DOC_PREFIX = "VGLDOC:"
DOC_PATTERN = re.compile(re.escape(DOC_PREFIX) + r"([A-Za-z0-9]{4,20}):(\d{5,15})$")


def safe_paste():
    """pyperclip.paste() puede fallar intermitentemente en Windows corporativo
    (antivirus, gestor de portapapeles) sin que sea un error de nuestra logica."""
    try:
        return (pyperclip.paste() or "").strip()
    except Exception as e:
        logger.warning(f"No se pudo leer el portapapeles: {e}")
        return None


def safe_copy(text):
    try:
        pyperclip.copy(text)
        return True
    except Exception as e:
        logger.error(f"No se pudo escribir al portapapeles ({text[:50]}...): {e}")
        return False


async def procesar_documento(service: AtheneaService, req_id: str, doc: str, content_esperado: str):
    logger.info(f"Documento detectado en portapapeles (reqId {req_id}): {doc}")
    try:
        # get_lab_details dispara el clic real en la página de Athenea (dentro de la
        # sesión ya autenticada) en vez de reconstruir la petición de detalle a mano —
        # así trae también los analitos, no solo el idSolicitud.
        id_solicitud, analitos = await service.get_lab_details(doc)
        respuesta = json.dumps({"idSolicitud": id_solicitud, "labs": analitos, "reqId": req_id})
    except PatientNotFoundError as e:
        logger.warning(str(e))
        respuesta = json.dumps({"error": str(e), "reqId": req_id})
    except (AtheneaServiceError, TimeoutError) as e:
        logger.error(str(e))
        respuesta = json.dumps({"error": str(e), "reqId": req_id})
    except Exception as e:
        # Cualquier otra falla (Playwright no pudo lanzar Chromium, disco lleno,
        # antivirus bloqueando el proceso hijo, etc.) NO debe tumbar el watcher.
        logger.error(f"Error inesperado buscando '{doc}' en Athenea: {e}")
        respuesta = json.dumps({"error": f"Error inesperado: {e}", "reqId": req_id})

    # Si mientras esperábamos la búsqueda (varios segundos) el navegador ya copió una
    # solicitud MÁS NUEVA, no la pisamos con esta respuesta vieja. Devolvemos None para
    # indicarle a watch() que NO marque ese contenido nuevo como "ya visto" — así se
    # procesa normalmente en la siguiente vuelta del loop, en vez de perderse.
    actual = safe_paste()
    if actual is not None and actual != content_esperado:
        logger.warning("El portapapeles cambió mientras se procesaba la solicitud; se descarta la respuesta para no pisar una solicitud más nueva.")
        return None

    if safe_copy(respuesta):
        logger.info(f"Respuesta escrita al portapapeles: {respuesta}")
    return respuesta


async def watch(service: AtheneaService):
    last_seen = None
    logger.info("Vigilando el portapapeles. Esperando 'VGLDOC:<reqId>:<documento>' desde Tampermonkey...")
    while True:
        try:
            content = safe_paste()
            if content is None:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                continue

            m = DOC_PATTERN.match(content) if content else None
            if content and content != last_seen and m:
                last_seen = content
                req_id, doc = m.group(1), m.group(2)
                resultado = await procesar_documento(service, req_id, doc, content)
                # Si procesar_documento descartó la respuesta (portapapeles cambió durante
                # la búsqueda), no dejamos last_seen apuntando al contenido nuevo: eso lo
                # marcaría como "ya visto" y esa solicitud nunca se procesaría.
                last_seen = resultado if resultado is not None else None
            else:
                last_seen = content or last_seen
        except Exception as e:
            # Red de seguridad general: nada de lo anterior debería llegar aquí (ya
            # tiene sus propios try/except), pero si algo inesperado se cuela, el
            # watcher registra el error y sigue vivo en vez de morir en silencio.
            logger.error(f"Error inesperado en el loop principal: {e}")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def main():
    service = AtheneaService()
    try:
        await service.start()
    except Exception as e:
        logger.error(f"No se pudo iniciar AtheneaService (Playwright/Chromium): {e}")
        logger.error("El watcher no puede continuar sin un navegador funcional. Revisa la instalación de Playwright.")
        return
    try:
        await watch(service)
    except KeyboardInterrupt:
        logger.info("Detenido por el usuario.")
    finally:
        await service.stop()


if __name__ == "__main__":
    asyncio.run(main())
