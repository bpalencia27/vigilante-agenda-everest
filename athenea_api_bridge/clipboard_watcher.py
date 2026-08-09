"""
Puente por Portapapeles (Opcion B) para Athenea API Bridge.

Reemplaza la comunicacion HTTP en localhost:5050 (bloqueada por Sophos Web Protection
en el equipo de la empresa) por un canal basado en el portapapeles del sistema:

  1. vigilante_agenda.user.js copia "VGLDOC:<documento>" al portapapeles
     (GM_setClipboard). El prefijo VGLDOC: evita que este proceso confunda un numero
     cualquiera que el usuario haya copiado para otra cosa (telefono, radicado) con una
     solicitud real.
  2. Este proceso vigila el portapapeles, detecta el prefijo, consulta Athenea via
     AtheneaService (Playwright headless, mismas credenciales de config.py) y escribe
     {"idSolicitud": N} de vuelta al portapapeles.
  3. El userscript lee el resultado del portapapeles (boton manual, o lectura automatica
     si el navegador la permite) y continua el flujo normal.

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
DOC_PATTERN = re.compile(re.escape(DOC_PREFIX) + r"(\d{5,15})$")


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


async def procesar_documento(service: AtheneaService, doc: str, content_esperado: str):
    logger.info(f"Documento detectado en portapapeles: {doc}")
    try:
        id_solicitud = await service.get_id_solicitud(doc)
        respuesta = json.dumps({"idSolicitud": id_solicitud})
    except PatientNotFoundError as e:
        logger.warning(str(e))
        respuesta = json.dumps({"error": str(e)})
    except (AtheneaServiceError, TimeoutError) as e:
        logger.error(str(e))
        respuesta = json.dumps({"error": str(e)})
    except Exception as e:
        # Cualquier otra falla (Playwright no pudo lanzar Chromium, disco lleno,
        # antivirus bloqueando el proceso hijo, etc.) NO debe tumbar el watcher.
        logger.error(f"Error inesperado buscando '{doc}' en Athenea: {e}")
        respuesta = json.dumps({"error": f"Error inesperado: {e}"})

    # Si mientras esperábamos la búsqueda (varios segundos) el navegador ya copió una
    # solicitud MÁS NUEVA, no la pisamos con esta respuesta vieja — se descarta aquí y
    # la nueva solicitud sigue su propio ciclo en la siguiente vuelta del loop.
    actual = safe_paste()
    if actual is not None and actual != content_esperado:
        logger.warning("El portapapeles cambió mientras se procesaba la solicitud; se descarta la respuesta para no pisar una solicitud más nueva.")
        return actual

    if safe_copy(respuesta):
        logger.info(f"Respuesta escrita al portapapeles: {respuesta}")
    return respuesta


async def watch(service: AtheneaService):
    last_seen = None
    logger.info("Vigilando el portapapeles. Esperando 'VGLDOC:<documento>' desde Tampermonkey...")
    while True:
        try:
            content = safe_paste()
            if content is None:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                continue

            m = DOC_PATTERN.match(content) if content else None
            if content and content != last_seen and m:
                last_seen = content
                doc = m.group(1)
                last_seen = await procesar_documento(service, doc, content)
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
    await service.start()
    try:
        await watch(service)
    except KeyboardInterrupt:
        logger.info("Detenido por el usuario.")
    finally:
        await service.stop()


if __name__ == "__main__":
    asyncio.run(main())
