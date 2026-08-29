"""
Modulo PyMLoader: carga la matriz diaria de Promoción y Mantenimiento (PyM) e indexa,
por número de documento, las actividades SUSCEPTIBLES (pendientes) de cada paciente.

Usa openpyxl (no pandas): más liviano y portable, y evita el bloqueo de DLLs de
numpy/pandas en equipos con Windows Application Control (WDAC/Smart App Control),
frecuente en instituciones de salud.
"""

import os
import csv
import glob
import re
from datetime import datetime
from typing import Dict, List, Optional

import openpyxl


class PyMLoader:
    # Nombres legibles para las columnas de tamización/actividad conocidas.
    FRIENDLY = {
        "VALORACION_INTEGRAL": "Valoración integral",
        "TAMIZACION_CMB": "Tamización CMB",
        "CITA_PF": "Cita Planificación Familiar",
        "CITA_AV": "Cita Agudeza Visual",
        "CITA_OD": "Cita Odontología",
        "TAMIZACION_CERVIX": "Tamización cérvix",
        "TAMIZACION_PROSTATA": "Tamización próstata",
        "PRUEBA_CERVIX": "Prueba cérvix",
        "TAMIZACION_MAMA": "Tamización mama",
        "TAMIZACION_COLON": "Tamización colon",
        "TAMIZACION_HEPC": "Tamización Hepatitis C",
        "TAMIZACION_HEPB": "Tamización Hepatitis B",
        "TAMIZACION_VDRL": "Tamización VDRL (Sífilis)",
        "TAMIZACION_HB": "Tamización Hemoglobina",
        "TAMIZACION_VIH": "Tamización VIH",
        "TAMIZACION_HTO": "Tamización Hematocrito",
    }

    # Candidatas para la columna de documento (coincidencia exacta, en orden de prioridad).
    DOC_EXACT = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO",
                 "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"]

    def __init__(self, filepath: Optional[str] = None, logger=None):
        self.filepath = filepath
        self.logger = logger
        self.pym_db: Dict[str, List[str]] = {}
        if not filepath:
            filepath = self.auto_find_file()
        if filepath and os.path.exists(filepath):
            # Nunca dejar que un Excel malformado tumbe el arranque.
            try:
                count = self.load_file(filepath)
                self._log("INFO", f"PyM cargado ({count} pacientes) desde {filepath}")
            except Exception as e:
                self._log("ERROR", f"No se pudo cargar '{filepath}': {e}. Se continúa sin datos de PyM.")

    def _log(self, level: str, message: str):
        if self.logger:
            self.logger.log(level, message)
        else:
            print(f"[PyMLoader] {message}")

    def auto_find_file(self) -> Optional[str]:
        """
        Busca la matriz PyM del día con nombres del estilo 'Agenda_Dia_CMB_YYYYMMDD.xlsx'
        o '*PyM*.xlsx'. Prioriza el archivo cuyo nombre contiene la fecha de hoy.
        No usa comodines genéricos ('*.xlsx') para no cargar por error un archivo ajeno.
        """
        now = datetime.now()
        today_tokens = [now.strftime("%Y%m%d"), now.strftime("%Y-%m-%d"), now.strftime("%d%m%Y")]

        search_paths = [
            ".",
            os.path.expanduser(r"~\Desktop"),
            os.path.expanduser(r"~\Downloads"),
        ]
        patterns = ["Agenda_Dia_CMB_*.xlsx", "Agenda_Dia_*.xlsx", "*PyM*.xlsx", "*pym*.xlsx"]

        candidates: List[str] = []
        for path in search_paths:
            for pat in patterns:
                for match in glob.glob(os.path.join(path, pat)):
                    if match not in candidates:
                        candidates.append(match)

        if not candidates:
            self._log("WARN", "No se encontró ninguna matriz PyM (Agenda_Dia_CMB_*.xlsx). "
                              "Cárguela manualmente desde el botón de la interfaz.")
            return None

        # 1) Prioridad: nombre con la fecha de hoy.
        for cand in candidates:
            filename = os.path.basename(cand)
            if any(tok in filename for tok in today_tokens):
                self._log("INFO", f"Matriz PyM de HOY detectada: {cand}")
                return cand

        # 2) Fallback: la más reciente por fecha de modificación.
        candidates.sort(key=os.path.getmtime, reverse=True)
        self._log("INFO", f"Matriz PyM más reciente seleccionada: {candidates[0]}")
        return candidates[0]

    def _normalize_key(self, val) -> str:
        """Limpia una cédula/documento dejando solo dígitos (maneja floats tipo 20111222.0)."""
        if val is None:
            return ""
        val_str = str(val).strip()
        if val_str.endswith(".0"):
            val_str = val_str[:-2]
        return re.sub(r"\D", "", val_str)

    def _is_pending(self, val) -> bool:
        """True si el valor de la celda indica una actividad PyM pendiente (susceptible)."""
        if val is None:
            return False
        s = str(val).strip().lower()
        return s == "susceptible" or s == "pendiente" or s.startswith("tamizar")

    def _friendly(self, header: str) -> str:
        return self.FRIENDLY.get(header, header.replace("_", " ").strip().capitalize())

    def _activity_label(self, header: str, val) -> str:
        friendly = self._friendly(header)
        s = str(val).strip().lower()
        if s in ("susceptible", "pendiente"):
            return friendly
        # Instrucción explícita (p. ej. "Tamizar con VPH") -> adjuntarla.
        return f"{friendly} — {str(val).strip()}"

    def _find_doc_index(self, headers: List[str]) -> Optional[int]:
        for cand in self.DOC_EXACT:
            if cand in headers:
                return headers.index(cand)
        for i, h in enumerate(headers):
            if "IDENT" in h or "CEDULA" in h or ("DOCUMENTO" in h and "TIPO" not in h):
                return i
        return None

    def _read_xlsx(self, filepath: str):
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        try:
            ws = wb.active
            it = ws.iter_rows(values_only=True)
            raw_header = next(it, None)
            if raw_header is None:
                return [], []
            headers = [
                (str(h).strip().upper() if h is not None else f"COL_{i}")
                for i, h in enumerate(raw_header)
            ]
            data = [r for r in it if r is not None and any(v is not None for v in r)]
            return headers, data
        finally:
            wb.close()

    def _read_csv(self, filepath: str):
        with open(filepath, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            rows = [r for r in reader if any(str(c).strip() for c in r)]
        if not rows:
            return [], []
        headers = [str(h).strip().upper() for h in rows[0]]
        return headers, rows[1:]

    def load_file(self, filepath: str) -> int:
        """Carga la matriz PyM e indexa por documento. Devuelve la cantidad de pacientes."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"El archivo PyM no existe: {filepath}")

        ext = os.path.splitext(filepath)[1].lower()
        if ext in (".xlsx", ".xlsm"):
            headers, data = self._read_xlsx(filepath)
        elif ext == ".csv":
            headers, data = self._read_csv(filepath)
        else:
            raise ValueError("Formato no soportado. Use .xlsx, .xlsm o .csv")

        if not headers:
            raise ValueError("El archivo no tiene encabezados legibles.")

        doc_idx = self._find_doc_index(headers)
        if doc_idx is None:
            raise ValueError(f"No se encontró columna de documento/cédula. Columnas: {headers}")

        # Se escanean todas las columnas salvo la de documento; _is_pending filtra el ruido
        # (No aplica / NULL / Realizada / Tamizado / No / Si no cuentan como pendientes).
        act_indices = [i for i in range(len(headers)) if i != doc_idx]

        self.pym_db.clear()
        for row in data:
            doc_key = self._normalize_key(row[doc_idx] if doc_idx < len(row) else None)
            if not doc_key:
                continue
            bucket = self.pym_db.setdefault(doc_key, [])
            for i in act_indices:
                if i >= len(row):
                    continue
                val = row[i]
                if self._is_pending(val):
                    label = self._activity_label(headers[i], val)
                    if label not in bucket:
                        bucket.append(label)

        self.filepath = filepath
        return len(self.pym_db)

    def get_activities(self, doc_id: str) -> List[str]:
        """Actividades de PyM susceptibles para un documento (limpiado antes de buscar)."""
        return self.pym_db.get(self._normalize_key(doc_id), [])


if __name__ == "__main__":
    loader = PyMLoader()
    print(f"Pacientes con PyM indexados: {len(loader.pym_db)}")
