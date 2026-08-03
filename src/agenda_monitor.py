"""
Modulo AgendaMonitor v3.1: Monitoreo del DOM de Everest mediante Playwright CDP.

Estrategia de pestañas (para no intervenir el flujo del médico):
  1. Se adjunta al Chrome del médico por CDP (puerto 9222).
  2. Detecta (solo lectura) la pestaña de "Citas del día".
  3. Abre su PROPIA pestaña-clon sobre esa misma URL y trabaja SIEMPRE sobre ella,
     refrescando cada N segundos. Nunca navega ni recarga la pestaña del médico,
     así el médico puede entrar a "Historias Clínicas" (lo que cierra su vista de
     citas) sin que el Vigilante pierda la agenda.

Reglas de color (5 estados):
  VERDE  = ingreso a tiempo (En Sala / Atendido dentro de la tolerancia).
  MORADO = pre-alerta: 5:00–5:59 min, o paciente con 3+ actividades PyM pendientes.
  AMBAR  = "Sin presentarse" pasada la tolerancia (>= 6:00).
  ROJO   = FRAUDE: paciente que estuvo en Ámbar ("Sin presentarse") y luego pasa a
           "En Sala" (activación extemporánea). Alerta sonora UNA sola vez.
  AZUL   = espera normal / estado general.
"""

import os
import re
import time
import threading
from datetime import datetime
from typing import Dict, List, Callable, Optional

from playwright.sync_api import sync_playwright

EVEREST_URL = "https://neps.everestintelligent.com/viva/HCHealth/"

# Script JS oficial para extracción del DOM de Everest (Vigilante 2.5.0).
JS_EXTRAER_AGENDA = r"""
(marcaBase) => {
  const limpio = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const horas = Array.from(document.querySelectorAll('.labelHora'));
  if (horas.length === 0) return { visible: false, fecha: '', citas: [] };

  const etiquetaFecha = document.querySelector('.fecha');

  const contenedorDe = (elHora) => {
    const candidatos = [];
    const directo = elHora.closest('.card-body') || elHora.closest('.card');
    if (directo) candidatos.push(directo);
    let n = elHora.parentElement, saltos = 0;
    while (n && n !== document.body && saltos < 8) {
      if (n.querySelector('.status-label')) { candidatos.push(n); break; }
      n = n.parentElement; saltos++;
    }
    for (const c of candidatos) {
      if (c.querySelectorAll('.labelHora').length === 1 && c.querySelector('.status-label')) {
        return c;
      }
    }
    return null;
  };

  const estados = Array.from(document.querySelectorAll('.status-label'));
  const emparejarPorIndice = estados.length === horas.length;

  const citas = horas.map((elHora, i) => {
    const cont = contenedorDe(elHora);
    const marca = marcaBase + '-' + i;
    let estado = '';
    let documento = '', nombre = '', modalidad = '', aislada = false;

    if (cont) {
      aislada = true;
      cont.setAttribute('data-vgl-id', marca);
      const elEstado = cont.querySelector('.status-label');
      estado = limpio(elEstado && elEstado.textContent);
      const elDoc = cont.querySelector('.text-muted');
      documento = limpio(elDoc && elDoc.textContent);
      const elNombre = cont.querySelector('.text-uppercase.fw-bold, .text-uppercase');
      nombre = limpio(elNombre && elNombre.textContent);
      const elModo = cont.querySelector('.fw-bold.mb-0');
      modalidad = limpio(elModo && elModo.textContent);
    } else if (emparejarPorIndice) {
      estado = limpio(estados[i] && estados[i].textContent);
    }

    return {
      hora_texto: limpio(elHora.textContent),
      documento_crudo: documento,
      nombre: nombre,
      modalidad: modalidad,
      estado_dom: estado,
      indice: i,
      marca_dom: aislada ? marca : '',
      aislada: aislada
    };
  });

  return {
    visible: true,
    fecha: limpio(etiquetaFecha && etiquetaFecha.textContent),
    citas: citas
  };
}
"""

# Detecta si una página es la vista de "Citas del día" (tiene .labelHora en el DOM).
JS_ES_AGENDA = "() => document.querySelectorAll('.labelHora').length > 0"


def extraer_documento(texto: Optional[str]) -> str:
    """Extrae la cédula de textos tipo '21448257, 66 años' -> '21448257'."""
    if not texto:
        return ""
    limpio = re.sub(r"[.\s]", "", texto.split(",")[0])
    m = re.match(r"^(\d{5,15})$", limpio)
    if m:
        return m.group(1)
    m = re.search(r"\b(\d{5,15})\b", re.sub(r"[.\s]", "", texto))
    return m.group(1) if m else ""


def buscar_chrome_exe() -> Optional[str]:
    rutas = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    ]
    for r in rutas:
        if os.path.exists(r):
            return r
    return None


class AgendaMonitor:
    def __init__(self,
                 pym_loader,
                 poll_interval: int = 5,
                 tolerance_minutes: float = 6.0,
                 cdp_port: int = 9222,
                 event_logger=None):
        self.pym_loader = pym_loader
        # Clamp: evita busy-loop (0) o sleep negativo que mataría el hilo.
        try:
            self.poll_interval = max(1, int(poll_interval))
        except (TypeError, ValueError):
            self.poll_interval = 5
        self.tolerance_minutes = tolerance_minutes
        self.cdp_port = cdp_port
        self.event_logger = event_logger

        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.listeners: List[Callable[[List[Dict]], None]] = []
        self.fraud_listeners: List[Callable[[Dict], None]] = []

        self.last_appointments: List[Dict] = []
        self.historical_status: Dict[str, str] = {}
        self.fraud_watch = set()      # keys que alcanzaron Ámbar (candidatas a fraude)
        self.alerted_fraud = set()    # keys ya alertadas (para sonar UNA vez)
        self._warned_times = set()    # horas cuyo formato ya se advirtió

        self._own_page = None         # nuestra pestaña-clon
        self._agenda_url: Optional[str] = None
        self._launched = False        # si nosotros abrimos Chrome
        self._connect_retries = 15    # segundos de reintento CDP antes de abrir Chrome propio
        self._clone_warned = False    # para no repetir el aviso de auto-navegación

    # ---- Suscripciones ----
    def add_listener(self, callback: Callable[[List[Dict]], None]):
        self.listeners.append(callback)

    def add_fraud_listener(self, callback: Callable[[Dict], None]):
        self.fraud_listeners.append(callback)

    def _log(self, level: str, message: str):
        if self.event_logger:
            self.event_logger.log(level, message)
        print(f"[AgendaMonitor] {message}")

    # ---- Lógica de color / alerta ----
    def _elapsed_minutes(self, time_str: str, now: datetime) -> float:
        try:
            apt_dt = datetime.strptime(
                f"{now.strftime('%Y-%m-%d')} {time_str}", "%Y-%m-%d %I:%M %p"
            )
            return (now - apt_dt).total_seconds() / 60.0
        except Exception:
            # No silenciar: si el formato de hora cambia, el escalonamiento de tiempo
            # dejaría de funcionar. Se advierte una vez por hora distinta.
            if time_str not in self._warned_times:
                self._warned_times.add(time_str)
                self._log("WARN", f"No se pudo interpretar la hora '{time_str}' "
                                  f"(se esperaba 'HH:MM AM/PM'). Escalonamiento de tiempo "
                                  f"desactivado para esa cita.")
            return 0.0

    @staticmethod
    def _appt_key(doc_id: str, time_str: str, name: str, index: int) -> str:
        """Clave estable por cita: usa el documento; si falta, un compuesto (evita colisiones)."""
        if doc_id:
            return doc_id
        return f"{time_str}|{name}|{index}"

    def _calculate_color_and_alert(self, apt: Dict) -> Dict:
        now = datetime.now()
        status_text = apt.get("status", "").strip().lower()
        doc_id = apt.get("doc_id", "")
        time_str = apt.get("time_str", "")
        key = apt["key"]

        elapsed = self._elapsed_minutes(time_str, now)
        prev_status = self.historical_status.get(key, "")
        pym_activities = self.pym_loader.get_activities(doc_id)

        grace = self.tolerance_minutes          # 6.0 -> "después de 5:59"
        prealert = self.tolerance_minutes - 1.0  # 5.0

        color = "AZUL"
        sound_alert = False

        if "en sala" in status_text:
            if key in self.fraud_watch:
                # Estuvo en Ámbar y ahora aparece "En Sala" = activación extemporánea.
                color = "ROJO"
                if key not in self.alerted_fraud:
                    sound_alert = True
                    self.alerted_fraud.add(key)
            else:
                color = "VERDE"
        elif "atendido" in status_text:
            # Si ya fue marcado como fraude, se conserva el ROJO; si no, cierre normal VERDE.
            color = "ROJO" if key in self.alerted_fraud else "VERDE"
        elif "sin presentarse" in status_text:
            if elapsed >= grace:
                color = "AMBAR"
                self.fraud_watch.add(key)
            elif elapsed >= prealert:
                color = "MORADO"
            else:
                color = "AZUL"
        else:
            if elapsed >= prealert or len(pym_activities) >= 3:
                color = "MORADO"
            else:
                color = "AZUL"

        apt["color"] = color
        apt["sound_alert"] = sound_alert
        apt["elapsed_minutes"] = round(elapsed, 1)
        apt["pym_activities"] = pym_activities

        # Auditoría: registrar cambios de estado y, en especial, el fraude.
        if self.event_logger:
            if sound_alert:
                self.event_logger.log_event({
                    "event": "FRAUDE_EXTEMPORANEO", "time_str": time_str,
                    "name": apt.get("name", ""), "doc_id": doc_id,
                    "status": apt.get("status", ""), "color": color,
                    "elapsed_min": apt["elapsed_minutes"],
                })
            elif status_text != prev_status and prev_status != "":
                self.event_logger.log_event({
                    "event": "CAMBIO_ESTADO", "time_str": time_str,
                    "name": apt.get("name", ""), "doc_id": doc_id,
                    "status": apt.get("status", ""), "color": color,
                    "estado_previo": prev_status, "elapsed_min": apt["elapsed_minutes"],
                })

        self.historical_status[key] = status_text
        return apt

    def _emit_fraud(self, apt: Dict):
        for cb in self.fraud_listeners:
            try:
                cb(apt)
            except Exception as e:
                self._log("ERROR", f"Error en fraud listener: {e}")

    def _process(self, datos: Dict) -> List[Dict]:
        appointments: List[Dict] = []
        if not (datos and datos.get("visible")):
            return appointments
        for c in datos.get("citas", []):
            doc_id = extraer_documento(c.get("documento_crudo", ""))
            name = c.get("nombre", "") or "Paciente Everest"
            time_str = c.get("hora_texto", "")
            status = c.get("estado_dom", "") or "Pendiente"
            index = c.get("indice", 0)
            apt = {
                "time_str": time_str,
                "doc_id": doc_id,
                "name": name,
                "status": status,
                "modalidad": c.get("modalidad", ""),
                "index": index,
                "key": self._appt_key(doc_id, time_str, name, index),
            }
            apt = self._calculate_color_and_alert(apt)
            if apt.get("sound_alert"):
                self._emit_fraud(apt)
            appointments.append(apt)
        return appointments

    # ---- Conexión y pestaña-clon ----
    def _connect_or_launch(self, p):
        # 1) Adjuntarse a un Chrome ya abierto en modo depuración. Se reintenta unos segundos
        #    porque el lanzador (.bat) puede estar abriendo Chrome justo en este momento;
        #    así se evita abrir un SEGUNDO Chrome con el mismo perfil (conflicto de bloqueo).
        for _ in range(self._connect_retries):
            try:
                browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{self.cdp_port}")
                self._launched = False
                self._log("INFO", f"Adjuntado al Chrome del médico (puerto {self.cdp_port}).")
                return browser.contexts[0] if browser.contexts else browser.new_context()
            except Exception:
                if not self.running:
                    return None
                time.sleep(1)

        # 2) Chrome no está en modo depuración: abrir una ventana propia con perfil persistente
        #    (para que el médico inicie sesión) y el puerto de depuración activo.
        chrome_exe = buscar_chrome_exe()
        perfil_dir = os.path.join(
            os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
            "VigilanteEverestProfile",
        )
        self._log("INFO", "Chrome no está en modo depuración; abriendo ventana propia del "
                          "Vigilante para que el médico inicie sesión en Everest...")
        kwargs = {
            "user_data_dir": perfil_dir,
            "headless": False,
            "args": [f"--remote-debugging-port={self.cdp_port}", "--start-maximized"],
        }
        if chrome_exe:
            kwargs["executable_path"] = chrome_exe
        try:
            context = p.chromium.launch_persistent_context(**kwargs)
            self._launched = True
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(EVEREST_URL)
            self._log("INFO", "Ventana abierta. Inicie sesión y entre a 'Citas del día'.")
            return context
        except Exception as e:
            self._log("ERROR", f"No se pudo iniciar Chrome: {e}")
            return None

    def _page_has_agenda(self, page) -> bool:
        """True si la pestaña muestra AHORA la vista de 'Citas del día' (tiene .labelHora)."""
        try:
            if page.is_closed():
                return False
        except Exception:
            return False
        try:
            return bool(page.evaluate(JS_ES_AGENDA))
        except Exception:
            return False

    def _self_navigate_to_agenda(self, page) -> bool:
        """
        Best-effort: llevar NUESTRA pestaña a 'Citas del día' replicando la navegación del app.
        Everest es una SPA que NO cambia de URL, así que abrir la URL no basta: hay que hacer
        clic en el menú. Los selectores por texto son tentativos y se afinarán con la captura
        real del DOM (capturar_dom.py) en el equipo de la empresa.
        """
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        if self._page_has_agenda(page):
            return True
        candidatos = [
            "text=/citas del d[ií]a/i",
            "text=/agenda del d[ií]a/i",
            "text=/^\\s*citas\\s*$/i",
            "text=/agenda/i",
        ]
        for sel in candidatos:
            try:
                loc = page.locator(sel).first
                if loc.count() > 0:
                    loc.click(timeout=3000)
                    page.wait_for_timeout(1500)
                    if self._page_has_agenda(page):
                        self._log("INFO", f"Pestaña-clon navegó a 'Citas del día' con '{sel}'.")
                        return True
            except Exception:
                continue
        if not self._clone_warned:
            self._clone_warned = True
            self._log("WARN", "La pestaña-clon aún no llega sola a 'Citas del día' "
                              "(selectores por confirmar). Mientras tanto se lee la pestaña "
                              "del médico en modo solo-lectura.")
        return False

    def _prepare_clone(self, context):
        """Crea/mantiene nuestra pestaña-clon autenticada y la intenta poner en la agenda."""
        if self._own_page is not None:
            try:
                if not self._own_page.is_closed():
                    if self._page_has_agenda(self._own_page):
                        return self._own_page
                    self._self_navigate_to_agenda(self._own_page)  # reintento suave
                    return self._own_page
            except Exception:
                pass
            self._own_page = None

        try:
            own = context.new_page()
            own.goto(EVEREST_URL)
            self._own_page = own
            self._log("INFO", "Pestaña-clon del Vigilante creada (comparte la sesión ya iniciada). "
                              "Trabajará independiente de la pestaña del médico.")
            self._self_navigate_to_agenda(own)
            return own
        except Exception as e:
            self._log("ERROR", f"No se pudo crear la pestaña-clon: {e}")
            self._own_page = None
            return None

    def _pick_page(self, context):
        """
        Elige la pestaña desde donde leer la agenda, en orden de preferencia:
          1) NUESTRA pestaña-clon si ya muestra 'Citas del día' (independiente del médico).
          2) Fallback SOLO LECTURA: cualquier pestaña que muestre la agenda ahora (incluida la
             del médico). Nunca se navega ni recarga una pestaña ajena: solo se lee el DOM.
        """
        own = self._prepare_clone(context)
        if own is not None and self._page_has_agenda(own):
            return own
        for page in list(context.pages):
            if page is own:
                continue
            if self._page_has_agenda(page):
                return page
        return None

    def _cleanup(self, context):
        # Cerrar solo NUESTRA pestaña-clon; nunca las del médico.
        if self._own_page is not None:
            try:
                if not self._own_page.is_closed():
                    self._own_page.close()
            except Exception:
                pass
            self._own_page = None
        # Si nosotros abrimos Chrome, cerrar el contexto propio.
        if self._launched:
            try:
                context.close()
            except Exception:
                pass

    def _worker_loop(self):
        with sync_playwright() as p:
            context = self._connect_or_launch(p)
            if context is None:
                self._log("ERROR", "Sin contexto de navegador; el monitor no puede iniciar.")
                return
            try:
                while self.running:
                    try:
                        page = self._pick_page(context)
                        if page is None:
                            # Aún no hay 'Citas del día' visible en ninguna pestaña.
                            self.last_appointments = []
                            for listener in self.listeners:
                                try:
                                    listener([])
                                except Exception:
                                    pass
                            time.sleep(self.poll_interval)
                            continue
                        datos = page.evaluate(JS_EXTRAER_AGENDA, "vgl-pym")
                        appointments = self._process(datos)
                        self.last_appointments = appointments
                        for listener in self.listeners:
                            try:
                                listener(appointments)
                            except Exception as le:
                                self._log("ERROR", f"Error en listener: {le}")
                    except Exception as e:
                        self._log("ERROR", f"Error leyendo DOM: {e}")
                        self._own_page = None  # forzar re-creación de la pestaña-clon
                    time.sleep(self.poll_interval)
            finally:
                self._cleanup(context)

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.thread.start()
            self._log("INFO", f"Monitoreo CDP iniciado (cada {self.poll_interval}s).")

    def stop(self):
        self.running = False


if __name__ == "__main__":
    print("Módulo AgendaMonitor v3.1 listo.")
