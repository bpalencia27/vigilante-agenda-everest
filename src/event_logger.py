"""
Modulo EventLogger: Registro de auditoría del Vigilante de Agenda.
Guarda un log de texto diario y exporta los eventos de la sesión a CSV y JSON
al finalizar el turno, en Escritorio\\Reportes_Vigilante_Copiloto.
Es seguro para uso concurrente (el monitor lo llama desde un hilo en segundo plano).
"""

import os
import csv
import json
import threading
from datetime import datetime
from typing import Dict, List, Optional


class EventLogger:
    def __init__(self, base_dir: Optional[str] = None):
        self._lock = threading.Lock()
        self._events: List[Dict] = []
        self.session_start = datetime.now()
        self.report_dir = self._resolve_dir(base_dir)
        self.log_path = os.path.join(
            self.report_dir, f"vigilante_{self.session_start.strftime('%Y-%m-%d')}.log"
        )
        self._write_line(
            f"===== Sesión iniciada: {self.session_start.strftime('%Y-%m-%d %H:%M:%S')} ====="
        )

    def _resolve_dir(self, base_dir: Optional[str]) -> str:
        if base_dir:
            target = base_dir
        else:
            # Preferir Escritorio; si no existe (perfiles OneDrive), usar carpeta del usuario.
            desktop = os.path.join(os.path.expanduser("~"), "Desktop")
            root = desktop if os.path.isdir(desktop) else os.path.expanduser("~")
            target = os.path.join(root, "Reportes_Vigilante_Copiloto")
        try:
            os.makedirs(target, exist_ok=True)
        except Exception:
            target = os.path.expanduser("~")
        return target

    def _write_line(self, line: str):
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(f"[{stamp}] {line}\n")
        except Exception:
            # El registro nunca debe tumbar la aplicación.
            pass

    def log(self, level: str, message: str):
        """Registra una línea simple de nivel (INFO / WARN / ERROR)."""
        with self._lock:
            self._write_line(f"{level.upper():<5} | {message}")

    def log_event(self, event: Dict):
        """Registra un evento estructurado de cita (cambio de estado, alerta, etc.)."""
        with self._lock:
            enriched = dict(event)
            enriched["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self._events.append(enriched)
            desc = (
                f"{enriched.get('event', 'EVENTO')} | {enriched.get('time_str', '')} "
                f"{enriched.get('name', '')} ({enriched.get('doc_id', '')}) "
                f"estado={enriched.get('status', '')} color={enriched.get('color', '')}"
            )
            self._write_line(desc)

    def export(self) -> Optional[str]:
        """Exporta los eventos de la sesión a CSV y JSON. Devuelve el directorio de reportes."""
        with self._lock:
            self._write_line(
                f"===== Sesión finalizada: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} "
                f"| {len(self._events)} evento(s) ====="
            )
            if not self._events:
                return self.report_dir

            stamp = self.session_start.strftime("%Y-%m-%d_%H%M%S")
            csv_path = os.path.join(self.report_dir, f"eventos_{stamp}.csv")
            json_path = os.path.join(self.report_dir, f"eventos_{stamp}.json")

            # Unión ordenada de todas las claves presentes en los eventos.
            fields: List[str] = []
            for ev in self._events:
                for k in ev.keys():
                    if k not in fields:
                        fields.append(k)

            try:
                with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
                    writer = csv.DictWriter(f, fieldnames=fields)
                    writer.writeheader()
                    for ev in self._events:
                        flat = {
                            k: ("; ".join(map(str, v)) if isinstance(v, (list, tuple)) else v)
                            for k, v in ev.items()
                        }
                        writer.writerow(flat)
            except Exception as e:
                self._write_line(f"Error exportando CSV: {e}")

            try:
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(self._events, f, ensure_ascii=False, indent=2, default=str)
            except Exception as e:
                self._write_line(f"Error exportando JSON: {e}")

            self._write_line(f"Exportados {len(self._events)} eventos a:\n  {csv_path}\n  {json_path}")
            return self.report_dir


if __name__ == "__main__":
    lg = EventLogger()
    lg.log("INFO", "Prueba de EventLogger.")
    lg.log_event({"event": "PRUEBA", "time_str": "07:00 AM", "name": "PACIENTE DEMO",
                  "doc_id": "123", "status": "En Sala", "color": "ROJO"})
    print("Reportes en:", lg.export())
