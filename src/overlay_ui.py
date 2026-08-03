"""
Modulo OverlayUI: Widget flotante Always-on-Top en Tkinter para mostrar el estado del
Vigilante, las citas auditadas y las actividades de PyM susceptibles por paciente.
El sonido de alerta lo dispara el monitor (una sola vez por fraude), no el repintado.
"""

import tkinter as tk
from tkinter import ttk, filedialog
import winsound
import threading
from typing import List, Dict, Callable, Optional


class VigilanteOverlayUI:
    def __init__(self, on_excel_selected: Optional[Callable[[str], None]] = None):
        self.on_excel_selected = on_excel_selected
        self.root = tk.Tk()
        self.root.title("Vigilante de Agenda — Copiloto Everest PyM")

        # Always-on-Top y ventana flotante.
        self.root.wm_attributes("-topmost", True)
        self.root.overrideredirect(False)  # conservar barra de título para mover/minimizar
        self.root.resizable(True, True)
        self.root.configure(bg="#0F172A")  # Slate dark theme

        # Posición relativa a la pantalla (esquina inferior derecha), nunca fuera de vista.
        win_w, win_h = 440, 320
        self.root.update_idletasks()
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        pos_x = max(0, screen_w - win_w - 20)
        pos_y = max(0, screen_h - win_h - 80)
        self.root.geometry(f"{win_w}x{win_h}+{pos_x}+{pos_y}")

        self.color_map = {
            "VERDE": "#10B981",
            "AMBAR": "#F59E0B",
            "ROJO": "#EF4444",
            "AZUL": "#3B82F6",
            "MORADO": "#8B5CF6",
        }

        self._last_signature = None  # para repintar solo ante cambios reales

        self._build_ui()

    def _build_ui(self):
        header_frame = tk.Frame(self.root, bg="#1E293B", pady=6, padx=10)
        header_frame.pack(fill="x", side="top")

        lbl_title = tk.Label(
            header_frame, text=" Copiloto Everest PyM v3.1",
            font=("Segoe UI", 10, "bold"), fg="#F8FAFC", bg="#1E293B",
        )
        lbl_title.pack(side="left")

        btn_excel = tk.Button(
            header_frame, text=" Cargar Excel PyM",
            font=("Segoe UI", 8, "bold"), fg="#FFFFFF", bg="#0284C7",
            activebackground="#0369A1", relief="flat", command=self._select_excel_file,
        )
        btn_excel.pack(side="right", padx=5)

        self.lbl_summary = tk.Label(
            self.root, text="● Monitoreo activo | Citas auditadas: 0",
            font=("Segoe UI", 8), fg="#94A3B8", bg="#0F172A", pady=4,
        )
        self.lbl_summary.pack(fill="x")

        container = tk.Frame(self.root, bg="#0F172A")
        container.pack(fill="both", expand=True, padx=8, pady=4)

        canvas = tk.Canvas(container, bg="#0F172A", highlightthickness=0)
        scrollbar = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        self.scrollable_frame = tk.Frame(canvas, bg="#0F172A")

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")),
        )
        canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def _select_excel_file(self):
        filepath = filedialog.askopenfilename(
            title="Seleccionar matriz diaria de PyM",
            filetypes=[("Archivos de Excel", "*.xlsx *.xlsm *.csv"), ("Todos los archivos", "*.*")],
        )
        if filepath and self.on_excel_selected:
            self.on_excel_selected(filepath)

    def trigger_red_alert(self):
        """Alerta acústica de fraude (ROJO). El monitor la invoca una sola vez por caso."""
        def _play():
            try:
                winsound.Beep(1000, 400)
                winsound.Beep(1200, 400)
            except Exception:
                pass
        threading.Thread(target=_play, daemon=True).start()

    @staticmethod
    def _signature(appointments: List[Dict]):
        return tuple(
            (a.get("key", ""), a.get("status", ""), a.get("color", ""),
             tuple(a.get("pym_activities", [])))
            for a in appointments
        )

    def update_appointments(self, appointments: List[Dict]):
        """Repinta la lista de citas y sus actividades PyM (solo si algo cambió)."""
        signature = self._signature(appointments)
        if signature == self._last_signature:
            return  # nada cambió: evitar teardown/rebuild y parpadeo
        self._last_signature = signature

        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()

        count = len(appointments)
        self.lbl_summary.config(text=f"● Monitoreo activo (5s) | {count} cita(s) auditada(s)")

        if not appointments:
            lbl_empty = tk.Label(
                self.scrollable_frame,
                text="No se detectan citas agendadas aún.\nEl vigilante reintentará automáticamente.",
                font=("Segoe UI", 9, "italic"), fg="#64748B", bg="#0F172A", pady=20,
            )
            lbl_empty.pack(fill="x")
            return

        for apt in appointments:
            color_hex = self.color_map.get(apt.get("color", "AZUL"), "#3B82F6")

            card = tk.Frame(self.scrollable_frame, bg="#1E293B", pady=6, padx=8,
                            highlightbackground=color_hex, highlightthickness=1)
            card.pack(fill="x", expand=True, pady=4)

            top_row = tk.Frame(card, bg="#1E293B")
            top_row.pack(fill="x")

            lbl_time = tk.Label(top_row, text=apt.get("time_str", ""),
                                font=("Segoe UI", 9, "bold"), fg="#F8FAFC", bg="#1E293B")
            lbl_time.pack(side="left")

            lbl_name = tk.Label(
                top_row, text=f" - {apt.get('name', '')} ({apt.get('doc_id', '')})",
                font=("Segoe UI", 9), fg="#E2E8F0", bg="#1E293B", anchor="w",
            )
            lbl_name.pack(side="left", padx=4)

            lbl_badge = tk.Label(
                top_row, text=f" {apt.get('status', '')} ",
                font=("Segoe UI", 8, "bold"), fg="#FFFFFF", bg=color_hex, padx=4, pady=1,
            )
            lbl_badge.pack(side="right")

            pym_acts = apt.get("pym_activities", [])
            pym_text = " | ".join(pym_acts) if pym_acts else "Sin actividades PyM pendientes"
            pym_fg = "#38BDF8" if pym_acts else "#64748B"

            lbl_pym = tk.Label(
                card, text=f"📋 PyM: {pym_text}",
                font=("Segoe UI", 8, "bold" if pym_acts else "italic"),
                fg=pym_fg, bg="#1E293B", anchor="w", justify="left", wraplength=400,
            )
            lbl_pym.pack(fill="x", pady=(2, 0))

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    ui = VigilanteOverlayUI()
    ui.update_appointments([
        {"time_str": "07:00 AM", "doc_id": "21448257", "name": "ROSADEL CONSUELO RESTREPO",
         "status": "En Sala", "color": "VERDE", "key": "21448257",
         "pym_activities": ["Tamización cérvix", "Tamización mama", "Cita Odontología"]},
        {"time_str": "07:20 AM", "doc_id": "1128397873", "name": "LUIS ALFONSO TAPIAS RIVERA",
         "status": "Sin presentarse", "color": "AMBAR", "key": "1128397873",
         "pym_activities": ["Tamización VIH"]},
        {"time_str": "07:40 AM", "doc_id": "7379688", "name": "JOSE LUIS DURANGO",
         "status": "En Sala", "color": "ROJO", "key": "7379688", "pym_activities": []},
    ])
    ui.run()
