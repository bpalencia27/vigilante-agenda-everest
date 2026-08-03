"""
Punto de Entrada Principal: Vigilante de Agenda Everest PyM v3.1
Integra el cargador de PyM, el registro de auditoría, el monitoreo invisible (pestaña-clon)
y la interfaz flotante Always-on-Top.
"""

import os
import argparse

from pym_loader import PyMLoader
from session_manager import ChromeSessionManager
from agenda_monitor import AgendaMonitor
from overlay_ui import VigilanteOverlayUI
from event_logger import EventLogger


def main():
    parser = argparse.ArgumentParser(description="Vigilante de Agenda — Copiloto Everest RCV & PyM v3.1")
    parser.add_argument("--excel", type=str, help="Ruta al archivo Excel de PyM diario", default=None)
    parser.add_argument("--refresco", type=int, help="Intervalo de refresco en segundos (defecto: 5)", default=5)
    parser.add_argument("--capturar", action="store_true",
                        help="Modo captura: vuelca el DOM de la agenda para afinar selectores y sale.")
    args = parser.parse_args()

    # Modo utilitario de captura (para el equipo de la empresa, con sesión iniciada).
    if args.capturar:
        from capturar_dom import capturar
        path = capturar()
        # Feedback visible incluso en el .exe sin consola.
        try:
            import tkinter as tk
            from tkinter import messagebox
            r = tk.Tk(); r.withdraw()
            if path:
                messagebox.showinfo("Vigilante — Captura", f"Captura guardada en:\n{path}")
            else:
                messagebox.showwarning(
                    "Vigilante — Captura",
                    "No se pudo capturar.\nAbra Chrome con 'Iniciar_Vigilante.bat', inicie "
                    "sesión en Everest y entre a 'Citas del día' antes de capturar.")
            r.destroy()
        except Exception:
            pass
        return

    # Validar intervalo (evita busy-loop en 0 o sleep negativo que mataría el hilo).
    refresco = args.refresco if args.refresco and args.refresco >= 1 else 5
    if refresco != args.refresco:
        print(f"[Vigilante] --refresco '{args.refresco}' inválido; usando {refresco}s.")

    print("===========================================================================")
    print(" VIGILANTE DE AGENDA — Copiloto Everest PyM         Versión 3.1.0")
    print(" Enterprise Medical Workflow & PyM Integration Assistant")
    print("===========================================================================")

    # 0. Registro de auditoría (logs + export CSV/JSON al cierre).
    logger = EventLogger()
    print(f"[Logs] Registrando en: {logger.report_dir}")

    # 1. Cargador PyM (nunca tumba el arranque si el Excel está malformado).
    pym_loader = PyMLoader(logger=logger)
    if args.excel:
        try:
            if os.path.exists(args.excel):
                count = pym_loader.load_file(args.excel)
                print(f"[PyM] Excel cargado: {count} pacientes con susceptibilidades de PyM.")
            else:
                print(f"[PyM] La ruta --excel no existe: {args.excel}")
        except Exception as e:
            print(f"[PyM] Error cargando '{args.excel}': {e}")
            logger.log("ERROR", f"--excel no cargó: {e}")

    # 2. Extractor de sesión de Chrome (se conserva para una futura vía HTTP directa a la API;
    #    en v3.x el monitoreo va por CDP/DOM y no consume estas cookies).
    try:
        session_manager = ChromeSessionManager(target_domain="neps.everestintelligent.com")
        cookies = session_manager.extract_cookies()
        logger.log("INFO", f"{len(cookies)} cookies de sesión capturadas (reservadas para uso futuro).")
    except Exception as e:
        logger.log("WARN", f"No se pudieron extraer cookies (no crítico en v3.x): {e}")

    # 3. Monitor de Agenda (pestaña-clon, refresco N s).
    monitor = AgendaMonitor(
        pym_loader=pym_loader,
        poll_interval=refresco,
        event_logger=logger,
    )

    # 4. UI flotante Always-on-Top.
    def handle_excel_selected(filepath: str):
        try:
            count = pym_loader.load_file(filepath)
            print(f"[PyM] Excel cargado desde UI: {filepath} ({count} pacientes).")
            logger.log("INFO", f"Excel PyM recargado desde UI: {filepath} ({count} pacientes).")
            # Refresco inmediato: re-aplicar PyM a las citas ya cacheadas (sin nuevo viaje CDP).
            for apt in monitor.last_appointments:
                apt["pym_activities"] = pym_loader.get_activities(apt.get("doc_id", ""))
            monitor.last_appointments = list(monitor.last_appointments)  # nueva ref -> fuerza repintado
            ui.update_appointments(monitor.last_appointments)
        except Exception as e:
            print(f"[PyM] Error cargando Excel: {e}")
            logger.log("ERROR", f"Error cargando Excel desde UI: {e}")

    ui = VigilanteOverlayUI(on_excel_selected=handle_excel_selected)

    # Repintado de citas -> hilo principal de Tkinter.
    def on_appointments_updated(appointments):
        ui.root.after(0, lambda: ui.update_appointments(appointments))

    # Fraude (ROJO) -> alerta sonora una sola vez (el monitor de-duplica).
    def on_fraud_alert(apt):
        ui.trigger_red_alert()

    monitor.add_listener(on_appointments_updated)
    monitor.add_fraud_listener(on_fraud_alert)

    monitor.start()

    try:
        ui.run()
    finally:
        print("[Vigilante] Deteniendo monitoreo en segundo plano...")
        monitor.stop()
        report_dir = logger.export()
        print(f"[Logs] Reportes de la sesión guardados en: {report_dir}")


if __name__ == "__main__":
    main()
