"""
Puente por Portapapeles (Opcion B) para Athenea API Bridge.

Reemplaza la comunicacion HTTP en localhost:5050 (bloqueada por Sophos Web Protection
en el equipo de la empresa) por un canal basado en el portapapeles del sistema:

  1. vigilante_agenda.user.js copia el numero de documento del paciente al portapapeles
     (GM_setClipboard).
  2. Este proceso vigila el portapapeles, detecta el documento, consulta Athenea via
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
DOC_PATTERN = re.compile(r"^\d{5,15}$")


async def watch(service: AtheneaService):
    last_seen = None
    logger.info("Vigilando el portapapeles. Esperando numero de documento desde Tampermonkey...")
    while True:
        try:
            content = (pyperclip.paste() or "").strip()
        except Exception as e:
            logger.warning(f"No se pudo leer el portapapeles: {e}")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            continue

        if content and content != last_seen and DOC_PATTERN.match(content):
            last_seen = content
            logger.info(f"Documento detectado en portapapeles: {content}")
            try:
                id_solicitud = await service.get_id_solicitud(content)
                respuesta = json.dumps({"idSolicitud": id_solicitud})
                pyperclip.copy(respuesta)
                logger.info(f"Respuesta escrita al portapapeles: {respuesta}")
            except PatientNotFoundError as e:
                logger.warning(str(e))
                pyperclip.copy(json.dumps({"error": str(e)}))
            except (AtheneaServiceError, TimeoutError) as e:
                logger.error(str(e))
                pyperclip.copy(json.dumps({"error": str(e)}))
            # Sincroniza last_seen con lo que acabamos de escribir para no reprocesar
            # nuestra propia respuesta como si fuera un nuevo documento a buscar.
            last_seen = pyperclip.paste()
        else:
            last_seen = content or last_seen

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
