#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vigilante de Agenda - Modulo 3 del Copiloto Everest RCV
=======================================================

Audita, SOLO LEYENDO EL DOM, si los pacientes de la agenda del dia son
marcados "En Sala"/"Atendido" dentro de la ventana de gracia, y detecta el
registro extemporaneo (la cita que "aparece" confirmada despues del limite).

Regla de negocio (5:59)
-----------------------
  [hora_cita, hora_cita + 5:59]  -> ventana de gracia
  llega dentro de la ventana     -> EN REGLA (aviso verde "A TIEMPO")
  hora_cita + 6:00 en adelante   -> INASISTENCIA (alerta naranja)
  visto ausente tras el limite
    y confirmado despues         -> REGISTRO EXTEMPORANEO (alerta roja)

  Ojo: "confirmada despues del limite" NO basta para el rojo. Si el vigilante
  no vio la fila pendiente pasado el limite, no observo la llegada y no puede
  fechar nada: queda EN REGLA con confianza PARCIAL y sin alerta. Acusar ahi
  seria reportar como retraso del paciente lo que solo es la hora a la que se
  abrio el programa (ver test_arranque_tardio_no_acusa_a_nadie).

Principios de diseno
--------------------
1. Casi solo DOM. No se llama ninguna API de Everest. La unica escritura es
   pulsar "Consultar" cada `refresco_seg` para que la lista se repinte; sin
   eso Everest sirve el mismo DOM todo el turno y no se ve ninguna llegada.
   Se apaga con --refresco 0.
2. Nucleo puro y auditable. Toda la logica de tiempos vive en `MotorAuditoria`,
   sin navegador, y por eso es testeable (ver test_vigilante_agenda.py).
3. No se afirma lo que no se observo. Si el vigilante no estaba mirando en el
   minuto del limite, la fila queda marcada con confianza PARCIAL en vez de
   declarar "en regla". Un reporte de auditoria que miente no sirve.
4. No se toca el trabajo del medico. Jamas se cierran sus pestanas, jamas se
   navega una pestana que el abrio, y las alertas solo se pintan en Everest.
5. Persistencia en JSON local (mas un CSV que Excel abre limpio en es-CO).

Uso tipico
----------
  1) Cerrar Chrome y volver a abrirlo con el puerto de depuracion:
         chrome.exe --remote-debugging-port=9222
  2) Entrar a Everest y abrir "Citas del dia".
  3) python vigilante_agenda.py

  Sin puerto de depuracion, `--modo perfil` abre un Chrome aparte (exige
  iniciar sesion en ese perfil la primera vez).

  Ensayo en seco contra el simulador, sin tocar produccion:
         python vigilante_agenda.py --modo perfil --url file:///ruta/simulador_agenda_ips.html
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import logging
import os
import re
import signal
import sys
import tempfile
import time
import traceback
import unicodedata
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Sequence

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python < 3.9
    ZoneInfo = None  # type: ignore[assignment]

VERSION = "2.5.0"

TZ_BOGOTA = ZoneInfo("America/Bogota") if ZoneInfo else dt.timezone(dt.timedelta(hours=-5))

log = logging.getLogger("vigilante")


# ===========================================================================
# 1. CONFIGURACION
# ===========================================================================

URL_EVEREST = "https://neps.everestintelligent.com/viva/HCHealth/"
PATRON_PAGINA_EVEREST = r"everestintelligent\.com/viva/HCHealth|simulador_agenda_ips"


@dataclass
class Config:
    """Parametros del turno. Se puede sobrescribir con --config archivo.json."""

    url: str = URL_EVEREST
    patron_pagina: str = PATRON_PAGINA_EVEREST
    # "perfil" por defecto: funciona con doble clic, sin que nadie tenga que
    # abrir Chrome con --remote-debugging-port. "cdp" audita la ventana que el
    # medico ya tiene abierta, pero exige ese arranque especial.
    modo: str = "perfil"                 # "perfil" | "cdp" (Chrome del medico)
    cdp_endpoint: str = "http://127.0.0.1:9222"
    perfil_dir: str = ""                 # vacio -> se calcula en tiempo de ejecucion
    intervalo_seg: float = 5.0
    gracia_seg: int = 359                # 5 min 59 s inclusive
    fin_turno_min: int = 20              # apagado tras la ultima cita del dia
    tolerancia_ciego_seg: int = 45       # hueco de observacion que degrada a PARCIAL
    salida_dir: str = ""                 # vacio -> Escritorio/Reportes_Vigilante_Copiloto
    evidencia_visual: bool = True        # captura solo la tarjeta, no la pantalla
    # 0 = los avisos NO se cierran solos, hay que pulsar su X. Es lo que hace
    # falta en consulta: el medico atiende, y al levantar la vista tiene que
    # encontrar todavia lo que paso mientras no miraba.
    duracion_toast_ms: int = 0
    refresco_seg: int = 60               # 0 = no tocar la pagina (solo lectura)

    def con_overrides(self, ruta: str | os.PathLike[str]) -> "Config":
        datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
        validos = {c for c in self.__dataclass_fields__}
        desconocidos = set(datos) - validos
        if desconocidos:
            raise ValueError(f"Claves no reconocidas en {ruta}: {sorted(desconocidos)}")
        return Config(**{**asdict(self), **datos})


def directorio_salida_por_defecto() -> Path:
    """Escritorio del usuario en Windows/macOS/Linux, con respaldo al cwd."""
    for var in ("USERPROFILE", "HOME"):
        base = os.environ.get(var)
        if base:
            escritorio = Path(base) / "Desktop"
            if escritorio.is_dir():
                return escritorio / "Reportes_Vigilante_Copiloto"
            return Path(base) / "Reportes_Vigilante_Copiloto"
    return Path.cwd() / "Reportes_Vigilante_Copiloto"


# ===========================================================================
# 2. NUCLEO PURO - normalizacion y parseo (sin navegador)
# ===========================================================================

# Estados que significan "el paciente esta aqui". Se comparan normalizados
# (sin tildes, mayusculas, espacios colapsados) para no depender de como los
# escriba cada sede.
ESTADOS_CONFIRMADOS = frozenset({
    "EN SALA", "ATENDIDO", "ATENDIDA", "EN CONSULTA", "EN ATENCION",
    "ATENDIENDO", "FINALIZADA", "FINALIZADO", "EN ESPERA", "ADMITIDO",
    "ADMITIDA", "LLEGO", "PRESENTE",
})

# Estados que especifican que el paciente ya fue atendido.
ESTADOS_ATENDIDOS = frozenset({
    "ATENDIDO", "ATENDIDA", "EN CONSULTA", "EN ATENCION", "ATENDIENDO",
    "FINALIZADA", "FINALIZADO",
})

def es_estado_atendido(estado_dom: str | None) -> bool:
    """True si el estado del DOM indica que el paciente ya fue o está siendo atendido por el médico."""
    n = normalizar_texto(estado_dom)
    return n in ESTADOS_ATENDIDOS

# Estados en los que la cita ya no esta en juego: no generan alerta.
ESTADOS_EXCLUIDOS = frozenset({
    "CANCELADA", "CANCELADO", "ANULADA", "ANULADO", "REAGENDADA",
    "REAGENDADO", "NO ASISTIO", "INASISTENCIA", "REPROGRAMADA",
})

# Estados de "todavia no llega". Cualquier estado desconocido cae aqui, pero
# se registra en el log para poder ampliar la lista sin adivinar.
ESTADOS_PENDIENTES = frozenset({
    "SIN PRESENTARSE", "PROGRAMADA", "PROGRAMADO", "PENDIENTE",
    "ASIGNADA", "ASIGNADO", "CONFIRMADA", "CONFIRMADO",
})

MESES_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}

_estados_desconocidos_vistos: set[str] = set()


def normalizar_texto(valor: str | None) -> str:
    """Sin tildes, en mayusculas y con los espacios colapsados."""
    if not valor:
        return ""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", valor)
        if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", sin_tildes).strip().upper()


def clasificar_estado(estado_dom: str | None) -> str:
    """-> CONFIRMADO | EXCLUIDA | PENDIENTE (lo desconocido es pendiente)."""
    n = normalizar_texto(estado_dom)
    if not n:
        return "PENDIENTE"
    if n in ESTADOS_CONFIRMADOS:
        return "CONFIRMADO"
    if n in ESTADOS_EXCLUIDOS:
        return "EXCLUIDA"
    if n not in ESTADOS_PENDIENTES and n not in _estados_desconocidos_vistos:
        _estados_desconocidos_vistos.add(n)
        log.warning(
            "Estado no catalogado en la agenda: %r. Se trata como PENDIENTE "
            "(conservador: puede generar una alerta de mas, nunca una de menos).",
            estado_dom,
        )
    return "PENDIENTE"


def parsear_hora_12h(texto: str | None) -> tuple[int, int] | None:
    """'06:40 AM' / '12:05 p. m.' / '18:30' -> (hora24, minuto). None si no aplica.

    No usa strptime con %p: eso depende del locale del proceso y en Windows
    en espanol falla justo con las horas AM/PM que necesitamos.
    """
    if not texto:
        return None
    n = normalizar_texto(texto).replace(".", "")
    m = re.search(r"(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM|A M|P M)?", n)
    if not m:
        return None
    hora, minuto = int(m.group(1)), int(m.group(2))
    sufijo = (m.group(3) or "").replace(" ", "")
    if minuto > 59:
        return None
    if sufijo:
        if not 1 <= hora <= 12:
            return None
        if sufijo == "AM":
            hora = 0 if hora == 12 else hora
        else:  # PM
            hora = 12 if hora == 12 else hora + 12
    elif not 0 <= hora <= 23:
        return None
    return hora, minuto


def parsear_fecha_es(texto: str | None) -> dt.date | None:
    """'martes, 28 de julio de 2026' -> date(2026, 7, 28). Tambien 28/07/2026."""
    if not texto:
        return None
    n = normalizar_texto(texto).lower()
    m = re.search(r"(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})", n)
    if m and m.group(2) in MESES_ES:
        try:
            return dt.date(int(m.group(3)), MESES_ES[m.group(2)], int(m.group(1)))
        except ValueError:
            return None
    m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", n)
    if m:
        try:
            return dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    return None


def extraer_documento(texto: str | None) -> str:
    """' 43013650, 70 anos' -> '43013650'. Cadena vacia si no hay documento."""
    if not texto:
        return ""
    limpio = re.sub(r"[.\s]", "", texto.split(",")[0])
    m = re.match(r"^(\d{5,15})$", limpio)
    if m:
        return m.group(1)
    m = re.search(r"\b(\d{5,15})\b", re.sub(r"[.\s]", "", texto))
    return m.group(1) if m else ""


def extraer_edad(texto: str | None) -> str:
    m = re.search(r"(\d{1,3})\s*a[nñ]os", texto or "", re.IGNORECASE)
    return m.group(1) if m else ""


# ===========================================================================
# 3. NUCLEO PURO - modelo y maquina de estados
# ===========================================================================

@dataclass
class CitaObservada:
    """Una fila de la agenda tal como se leyo del DOM en un instante."""

    hora_texto: str = ""
    documento: str = ""
    nombre: str = ""
    edad: str = ""
    modalidad: str = ""
    estado_dom: str = ""
    indice: int = -1
    marca_dom: str = ""      # data-vgl-id para poder capturar solo esa tarjeta

    @property
    def hora(self) -> tuple[int, int] | None:
        return parsear_hora_12h(self.hora_texto)


# Resultados de auditoria. Los tres ultimos son terminales.
PENDIENTE = "PENDIENTE"
EN_REGLA = "EN_REGLA"
INASISTENCIA = "INASISTENCIA"
REGISTRO_EXTEMPORANEO = "REGISTRO_EXTEMPORANEO"
PREVENTIVA = "PREVENTIVA"
EXCLUIDA = "EXCLUIDA"
TERMINALES = frozenset({EN_REGLA, REGISTRO_EXTEMPORANEO, EXCLUIDA})

CONFIANZA_PLENA = "PLENA"
CONFIANZA_PARCIAL = "PARCIAL"

# Como se llama cada resultado de cara al medico. Una sola fuente para el aviso
# y para el reporte: si se separan, lo que se ve en pantalla y lo que se
# entrega por escrito dejan de coincidir y la auditoria se vuelve discutible.
# Las claves internas NO cambian, para no romper los estados ya guardados.
ETIQUETAS_RESULTADO = {
    PENDIENTE: "En seguimiento",
    EN_REGLA: "En regla",
    INASISTENCIA: "Inasistencia",
    REGISTRO_EXTEMPORANEO: "Confirmación extemporánea",
    PREVENTIVA: "Tiempo de gracia (5:00 min)",
    EXCLUIDA: "Excluida",
}

# Titulo del aviso en pantalla (en mayusculas, mas corto).
TITULOS_AVISO = {
    EN_REGLA: "INGRESO A TIEMPO",
    INASISTENCIA: "AUSENCIA EN SALA",
    REGISTRO_EXTEMPORANEO: "CONFIRMACIÓN EXTEMPORÁNEA",
    PREVENTIVA: "TIEMPO DE GRACIA (5:00 MIN)",
}

# Como se titula cada bloque del resumen del CSV.
RESUMEN_CSV = (
    ("Citas en regla (a tiempo)", EN_REGLA),
    ("Inasistencias registradas", INASISTENCIA),
    ("Confirmaciones extemporáneas", REGISTRO_EXTEMPORANEO),
    ("Canceladas o reagendadas", EXCLUIDA),
    ("En seguimiento al cierre", PENDIENTE),
)


@dataclass
class RegistroCita:
    """Lo que el vigilante sabe (y puede probar) de una cita."""

    clave: str
    fecha: str                       # ISO yyyy-mm-dd de la agenda
    hora: str                        # HH:MM 24h
    limite: str                      # ISO del instante en que vence la gracia
    documento: str = ""
    nombre: str = ""
    edad: str = ""
    modalidad: str = ""
    estado_dom: str = ""
    resultado: str = PENDIENTE
    confianza: str = CONFIANZA_PLENA
    nota: str = ""
    primer_visto: str = ""
    ultimo_visto: str = ""
    ultimo_visto_pendiente: str = ""  # ultima observacion con el paciente ausente
    confirmado_visto_en: str = ""     # primera observacion con el paciente presente
    alertas_emitidas: list[str] = field(default_factory=list)
    evidencias: list[str] = field(default_factory=list)


@dataclass
class Evento:
    """Algo que el medico deberia ver en pantalla."""

    tipo: str          # EN_REGLA | INASISTENCIA | REGISTRO_EXTEMPORANEO | PREVENTIVA
    mensaje: str       # una linea, para el log y el aviso del navegador
    registro: RegistroCita
    quien: str = ""    # "09:20 · Gabriel Jose"
    detalle: str = ""  # "Llegó dentro del margen de 5:59."
    duracion_custom_ms: int = 0


def determinar_turno(ahora: dt.datetime) -> str:
    """Devuelve 'AM' si es antes de las 13:00 (1:00 PM) o 'PM' de las 13:00 en adelante (Hora Bogotá)."""
    return "AM" if ahora.time() < dt.time(13, 0) else "PM"


class MotorAuditoria:
    """Maquina de estados de la auditoria. Soporta turnos independientes AM (Mañana) y PM (Tarde)."""

    def __init__(self, config: Config, fecha_agenda: dt.date, turno: str | None = None):
        self.config = config
        self.fecha_agenda = fecha_agenda
        self.turno = turno or determinar_turno(dt.datetime.now(TZ_BOGOTA))
        self.registros: dict[str, RegistroCita] = {}
        self.inicio_observacion: dt.datetime | None = None
        self.fin_observacion: dt.datetime | None = None
        self.segundos_observados: float = 0.0
        self._ultimo_tick: dt.datetime | None = None

    # -- utilidades internas ------------------------------------------------

    @property
    def _gracia(self) -> dt.timedelta:
        # La gracia es inclusiva: la infraccion empieza el segundo siguiente.
        return dt.timedelta(seconds=self.config.gracia_seg + 1)

    def _clave(self, cita: CitaObservada, hora24: tuple[int, int]) -> str:
        ident = cita.documento or f"POS{cita.indice:03d}"
        return f"{self.fecha_agenda.isoformat()}|{self.turno}|{hora24[0]:02d}:{hora24[1]:02d}|{ident}"

    def clave_de(self, cita: CitaObservada) -> str:
        """Clave publica de una cita observada ('' si la fila no tiene hora)."""
        hora24 = cita.hora
        return self._clave(cita, hora24) if hora24 else ""

    def _instante_cita(self, hora24: tuple[int, int]) -> dt.datetime:
        return dt.datetime.combine(
            self.fecha_agenda, dt.time(hora24[0], hora24[1]), tzinfo=TZ_BOGOTA
        )

    # -- API ----------------------------------------------------------------

    def procesar(self, citas: Sequence[CitaObservada], ahora: dt.datetime) -> list[Evento]:
        """Aplica un snapshot de la agenda y devuelve las alertas nuevas del turno activo.

        Filtra inteligentemente citas fuera de la jornada (en AM ignora citas >= 13:00, en PM ignora citas < 12:00).
        """
        if self.inicio_observacion is None:
            self.inicio_observacion = ahora
        if self._ultimo_tick is not None:
            hueco = (ahora - self._ultimo_tick).total_seconds()
            if 0 < hueco <= self.config.intervalo_seg * 4:
                self.segundos_observados += hueco
        self._ultimo_tick = ahora
        self.fin_observacion = ahora

        eventos: list[Evento] = []
        for cita in citas:
            hora24 = cita.hora
            if hora24 is None:
                log.debug("Fila sin hora legible, se ignora: %r", cita.hora_texto)
                continue
            # Filtrado por rango del turno activo para no contaminar sesiones
            if self.turno == "AM" and hora24[0] >= 13:
                continue
            if self.turno == "PM" and hora24[0] < 12:
                continue
            evento = self._procesar_una(cita, hora24, ahora)
            if evento:
                eventos.append(evento)
        return eventos

    def _procesar_una(
        self, cita: CitaObservada, hora24: tuple[int, int], ahora: dt.datetime
    ) -> Evento | None:
        clave = self._clave(cita, hora24)
        instante_cita = self._instante_cita(hora24)
        limite = instante_cita + self._gracia
        ahora_iso = ahora.isoformat()

        reg = self.registros.get(clave)
        if reg is None:
            reg = RegistroCita(
                clave=clave,
                fecha=self.fecha_agenda.isoformat(),
                hora=f"{hora24[0]:02d}:{hora24[1]:02d}",
                limite=limite.isoformat(),
                primer_visto=ahora_iso,
            )
            self.registros[clave] = reg

        # Los datos del paciente pueden llegar tarde (Angular repinta): se
        # completan sin sobrescribir con vacios.
        reg.documento = cita.documento or reg.documento
        reg.nombre = cita.nombre or reg.nombre
        reg.edad = cita.edad or reg.edad
        reg.modalidad = cita.modalidad or reg.modalidad
        reg.estado_dom = cita.estado_dom or reg.estado_dom
        reg.ultimo_visto = ahora_iso

        clase = clasificar_estado(cita.estado_dom)

        if clase == "EXCLUIDA":
            if reg.resultado not in TERMINALES:
                reg.resultado = EXCLUIDA
                reg.nota = f"Cita {cita.estado_dom.strip()}: fuera del conteo."
            return None

        if reg.resultado in TERMINALES:
            return None

        if clase == "CONFIRMADO" and not reg.confirmado_visto_en:
            reg.confirmado_visto_en = ahora_iso
        if clase != "CONFIRMADO":
            reg.ultimo_visto_pendiente = ahora_iso

        # --- Dentro de la ventana de gracia --------------------------------
        if ahora < limite:
            if clase == "CONFIRMADO":
                reg.resultado = EN_REGLA
                reg.confianza = CONFIANZA_PLENA
                reg.nota = "Paciente presente dentro de la ventana de gracia."
                # El aviso verde es para una llegada OBSERVADA. Si la fila ya
                # figuraba confirmada la primera vez que se miro, el vigilante
                # no vio llegar a nadie: esos van al recuento del arranque, no
                # a un aviso por paciente que solo seria ruido.
                if not reg.ultimo_visto_pendiente:
                    return None
                return self._emitir(
                    reg, EN_REGLA,
                    "El paciente se encuentra en sala de espera y listo para su atención.",
                    ahora=ahora,
                )

            # --- Alerta preventiva a los 5:00 minutos exactos (auto-cierre a los 5:59 min) ---
            inicio_preventiva = instante_cita + dt.timedelta(minutes=5)
            if inicio_preventiva <= ahora:
                if PREVENTIVA not in reg.alertas_emitidas:
                    reg.alertas_emitidas.append(PREVENTIVA)
                    duracion_restante_ms = max(1000, int((limite - ahora).total_seconds() * 1000))
                    quien = self._etiqueta(reg)
                    try:
                        h, m = map(int, reg.hora.split(":"))
                        hora_dt = dt.time(h, m)
                        hora_cita_str = hora_dt.strftime("%I:%M %p").lstrip("0")
                    except Exception:
                        hora_cita_str = reg.hora
                    horario_meta = f"📅 Cita programada: {hora_cita_str}\n⏱️ Transcurrido: 5:00 min (vence en 59 seg)"
                    detalle_completo = f"{horario_meta}\n\nEl paciente aún no registra ingreso en recepción."
                    return Evento(
                        tipo=PREVENTIVA,
                        mensaje=f"TIEMPO DE GRACIA · {quien} — Quedan 59 seg para el límite de tolerancia.",
                        registro=reg,
                        quien=quien,
                        detalle=detalle_completo,
                        duracion_custom_ms=duracion_restante_ms,
                    )

            return None

        # --- Vencida la ventana de gracia ----------------------------------
        if reg.resultado == PENDIENTE:
            if clase != "CONFIRMADO":
                # Evidencia directa: el limite paso y el paciente no esta.
                reg.resultado = INASISTENCIA
                reg.confianza = CONFIANZA_PLENA
                reg.nota = "Sin registro de llegada al vencer la ventana de gracia."
                return self._emitir(
                    reg, INASISTENCIA,
                    "Ha transcurrido la hora programada sin reporte de llegada en recepción.",
                    ahora=ahora,
                )

            # Aparece confirmada en la primera observacion posterior al limite.
            # Solo se puede afirmar "en regla" si el vigilante estaba mirando
            # justo antes del corte; si no, se declara la duda.
            reg.resultado = EN_REGLA
            visto_antes = (
                dt.datetime.fromisoformat(reg.ultimo_visto_pendiente)
                if reg.ultimo_visto_pendiente
                else None
            )
            hueco = None
            if visto_antes and visto_antes < limite:
                hueco = (limite - visto_antes).total_seconds()
            if hueco is not None and hueco <= self.config.tolerancia_ciego_seg:
                reg.confianza = CONFIANZA_PLENA
                reg.nota = "Confirmada en el limite de la ventana de gracia."
            else:
                reg.confianza = CONFIANZA_PARCIAL
                reg.nota = (
                    "Ya figuraba confirmada la primera vez que se observo, "
                    "despues del limite: no se puede certificar la hora de "
                    "llegada."
                )
            return None

        if reg.resultado == INASISTENCIA and clase == "CONFIRMADO":
            # El caso que importa: estaba ausente pasado el limite y despues
            # "aparecio". Aqui si hay evidencia de antes y de despues.
            reg.resultado = REGISTRO_EXTEMPORANEO
            reg.confianza = CONFIANZA_PLENA
            retraso = (ahora - instante_cita).total_seconds() / 60
            reg.nota = (
                f"Marcada como presente {retraso:.0f} min despues de la hora "
                f"de la cita, con la ventana de gracia ya vencida."
            )
            return self._emitir(
                reg, REGISTRO_EXTEMPORANEO,
                f"Se confirmó la presencia del paciente {retraso:.0f} minutos después de la hora programada.",
                ahora=ahora,
            )

        return None

    def _etiqueta(self, reg: RegistroCita) -> str:
        """Hora y nombre completo del paciente."""
        nombre = (reg.nombre or "").strip()
        if nombre:
            return f"{reg.hora} · {nombre.title()}"
        return f"{reg.hora} · Paciente sin nombre"

    def _emitir(self, reg: RegistroCita, tipo: str, detalle: str, ahora: dt.datetime | None = None) -> Evento | None:
        """Un aviso por cita y tipo. `detalle` incluye nombre completo, hora de cita y hora de detección en sala."""
        if tipo in reg.alertas_emitidas:
            return None
        reg.alertas_emitidas.append(tipo)
        quien = self._etiqueta(reg)
        titulo = TITULOS_AVISO.get(tipo, "")

        # Formateo de la hora de la cita en formato 12h (AM/PM)
        try:
            h, m = map(int, reg.hora.split(":"))
            hora_dt = dt.time(h, m)
            hora_cita_str = hora_dt.strftime("%I:%M %p").lstrip("0")
        except Exception:
            hora_cita_str = reg.hora

        # Hora exacta en que el Vigilante detectó que ya se encuentra "En Sala"
        if reg.confirmado_visto_en:
            try:
                dt_conf = dt.datetime.fromisoformat(reg.confirmado_visto_en)
                hora_detectado_str = dt_conf.strftime("%I:%M %p").lstrip("0")
            except Exception:
                hora_detectado_str = "Hora N/A"
        elif ahora:
            hora_detectado_str = ahora.strftime("%I:%M %p").lstrip("0")
        else:
            hora_detectado_str = dt.datetime.now(TZ_BOGOTA).strftime("%I:%M %p").lstrip("0")

        if tipo == EN_REGLA:
            horario_meta = f"📅 Cita programada: {hora_cita_str}\n⏱️ Detectado en sala: {hora_detectado_str}"
        elif tipo == REGISTRO_EXTEMPORANEO:
            horario_meta = f"📅 Cita programada: {hora_cita_str}\n⚠️ Detectado en sala: {hora_detectado_str}"
        else:
            horario_meta = f"📅 Cita programada: {hora_cita_str}\n⏱️ Estado: Sin ingreso reportado ({hora_detectado_str})"

        detalle_enriquecido = f"{horario_meta}\n\n{detalle}"

        return Evento(
            tipo=tipo,
            mensaje=f"{titulo} · {quien} — {detalle}",
            registro=reg,
            quien=quien,
            detalle=detalle_enriquecido,
        )

    # -- resumen y persistencia --------------------------------------------

    def resumen(self) -> dict[str, int]:
        conteo = {PENDIENTE: 0, EN_REGLA: 0, INASISTENCIA: 0,
                  REGISTRO_EXTEMPORANEO: 0, EXCLUIDA: 0}
        for reg in self.registros.values():
            conteo[reg.resultado] = conteo.get(reg.resultado, 0) + 1
        return conteo

    def ultima_hora_cita(self) -> dt.datetime | None:
        instantes = []
        for reg in self.registros.values():
            h, m = map(int, reg.hora.split(":"))
            instantes.append(self._instante_cita((h, m)))
        return max(instantes) if instantes else None

    def a_dict(self) -> dict[str, Any]:
        return {
            "version": VERSION,
            "turno": self.turno,
            "fecha_agenda": self.fecha_agenda.isoformat(),
            "inicio_observacion": self.inicio_observacion.isoformat()
            if self.inicio_observacion else "",
            "fin_observacion": self.fin_observacion.isoformat()
            if self.fin_observacion else "",
            "minutos_con_agenda_a_la_vista": round(self.segundos_observados / 60, 1),
            "resumen": self.resumen(),
            "citas": [asdict(r) for r in self._ordenadas()],
        }

    @classmethod
    def desde_dict(cls, datos: dict[str, Any], config: Config) -> "MotorAuditoria":
        fecha = dt.date.fromisoformat(datos["fecha_agenda"])
        turno = datos.get("turno", "AM")
        motor = cls(config, fecha, turno=turno)
        for crudo in datos.get("citas", []):
            campos = {k: v for k, v in crudo.items() if k in RegistroCita.__dataclass_fields__}
            reg = RegistroCita(**campos)
            motor.registros[reg.clave] = reg
        if datos.get("inicio_observacion"):
            motor.inicio_observacion = dt.datetime.fromisoformat(datos["inicio_observacion"])
        if datos.get("fin_observacion"):
            motor.fin_observacion = dt.datetime.fromisoformat(datos["fin_observacion"])
        motor.segundos_observados = float(datos.get("minutos_con_agenda_a_la_vista", 0)) * 60
        return motor

    def _ordenadas(self) -> list[RegistroCita]:
        return sorted(self.registros.values(), key=lambda r: (r.hora, r.nombre))

    # -- reporte ------------------------------------------------------------

    ENCABEZADOS = [
        "Fecha", "Hora cita", "Vence gracia", "Documento", "Paciente", "Edad",
        "Modalidad", "Estado en agenda", "Resultado auditoria", "Confianza",
        "Presente desde", "Minutos tras la hora", "Observacion", "Evidencia",
    ]

    def filas_csv(self) -> list[list[str]]:
        filas = []
        for reg in self._ordenadas():
            h, m = map(int, reg.hora.split(":"))
            instante_cita = self._instante_cita((h, m))
            presente = ""
            retraso = ""
            if reg.confirmado_visto_en:
                confirmado = dt.datetime.fromisoformat(reg.confirmado_visto_en)
                presente = confirmado.strftime("%H:%M:%S")
                retraso = f"{(confirmado - instante_cita).total_seconds() / 60:.1f}"
            filas.append([
                reg.fecha,
                reg.hora,
                dt.datetime.fromisoformat(reg.limite).strftime("%H:%M:%S"),
                reg.documento,
                reg.nombre,
                reg.edad,
                reg.modalidad,
                reg.estado_dom.strip(),
                ETIQUETAS_RESULTADO.get(reg.resultado,
                                        reg.resultado.replace("_", " ").title()),
                reg.confianza.title(),
                presente,
                retraso,
                reg.nota,
                " | ".join(reg.evidencias),
            ])
        return filas


# ===========================================================================
# 4. REPORTES (JSON + CSV que Excel es-CO abre bien)
# ===========================================================================

_PREFIJOS_FORMULA = ("=", "+", "-", "@", "\t", "\r")


def _sanear_celda(valor: Any) -> str:
    """Neutraliza la inyeccion de formulas: los nombres vienen de otro sistema."""
    texto = "" if valor is None else str(valor)
    return "'" + texto if texto.startswith(_PREFIJOS_FORMULA) else texto


def escribir_atomico(destino: Path, escritor) -> None:
    """Escribe via archivo temporal + replace: nunca deja un reporte a medias."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(destino.parent), suffix=".tmp")
    os.close(fd)
    tmp_path = Path(tmp)
    try:
        escritor(tmp_path)
        os.replace(tmp_path, destino)
    finally:
        tmp_path.unlink(missing_ok=True)


def guardar_reportes(motor: MotorAuditoria, salida: Path, turno: str | None = None) -> tuple[Path, Path]:
    """Deja el CSV para el humano y el JSON para la maquina con sufijo de turno (AM/PM). Devuelve ambas rutas."""
    sello = motor.fecha_agenda.strftime("%Y-%m-%d")
    t_nombre = turno or getattr(motor, "turno", "AM")
    ruta_csv = salida / f"auditoria_agenda_{sello}_{t_nombre}.csv"
    ruta_json = salida / f"auditoria_agenda_{sello}_{t_nombre}.json"

    def _csv(destino: Path) -> None:
        with destino.open("w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh, delimiter=";", quoting=csv.QUOTE_MINIMAL)
            w.writerow(["JORNADA / TURNO AUDITADO", f"Turno {t_nombre} ({'Mañana' if t_nombre == 'AM' else 'Tarde'})"])
            w.writerow([])
            w.writerow(MotorAuditoria.ENCABEZADOS)
            for fila in motor.filas_csv():
                w.writerow([_sanear_celda(c) for c in fila])
            w.writerow([])
            resumen = motor.resumen()
            w.writerow([f"Resumen del turno {t_nombre}"])
            for etiqueta, clave in RESUMEN_CSV:
                w.writerow([etiqueta, resumen.get(clave, 0)])
            w.writerow([
                "Minutos con la agenda a la vista",
                f"{motor.segundos_observados / 60:.1f}".replace(".", ","),
            ])

    def _json(destino: Path) -> None:
        datos = motor.a_dict()
        datos["turno"] = t_nombre
        destino.write_text(
            json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    escribir_atomico(ruta_csv, _csv)
    escribir_atomico(ruta_json, _json)
    return ruta_csv, ruta_json


def guardar_estado(motor: MotorAuditoria, salida: Path) -> Path:
    """Estado reanudable por turno (AM/PM)."""
    t_nombre = getattr(motor, "turno", "AM")
    ruta = salida / f"estado_vigilante_{motor.fecha_agenda.isoformat()}_{t_nombre}.json"
    escribir_atomico(
        ruta,
        lambda d: d.write_text(
            json.dumps(motor.a_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
        ),
    )
    return ruta


def cargar_estado(salida: Path, fecha: dt.date, config: Config, turno: str | None = None) -> MotorAuditoria | None:
    t_nombre = turno or determinar_turno(dt.datetime.now(TZ_BOGOTA))
    ruta = salida / f"estado_vigilante_{fecha.isoformat()}_{t_nombre}.json"
    if not ruta.is_file():
        ruta_legacy = salida / f"estado_vigilante_{fecha.isoformat()}.json"
        if ruta_legacy.is_file():
            ruta = ruta_legacy
        else:
            return None
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        if datos.get("fecha_agenda") != fecha.isoformat():
            return None
        motor = MotorAuditoria.desde_dict(datos, config)
        log.info("Turno %s reanudado: %d citas ya auditadas hoy.", motor.turno, len(motor.registros))
        return motor
    except (OSError, ValueError, KeyError, TypeError) as exc:
        log.warning("No se pudo reanudar el estado previo (%s). Se empieza limpio.", exc)
        return None


# ===========================================================================
# 5. CAPA NAVEGADOR - JavaScript inyectado
# ===========================================================================

# Extrae TODA la agenda en una sola evaluacion. La version anterior recorria
# document.querySelectorAll('*') una vez por cita: con Angular repintando, eso
# es O(citas x nodos) cada 5 s y ademas confunde dos pacientes a la misma hora.
JS_EXTRAER_AGENDA = r"""
(marcaBase) => {
  const limpio = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const horas = Array.from(document.querySelectorAll('.labelHora'));
  if (horas.length === 0) return { visible: false, fecha: '', citas: [] };

  const etiquetaFecha = document.querySelector('.fecha');

  // Estrategia A: la tarjeta propia de cada cita.
  // Estrategia B: subir hasta el primer ancestro que tenga un .status-label.
  // Ambas se validan con la misma regla: el contenedor debe cubrir UNA sola
  // hora. Si cubre varias es demasiado ancho y asignaria el estado equivocado.
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

  // Estrategia C (ultimo recurso): si ninguna tarjeta se pudo aislar pero hay
  // tantos estados como horas, se emparejan por posicion en el documento.
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

# Toast apilable. El mensaje viaja como ARGUMENTO, no interpolado en la
# plantilla: asi un nombre con comillas o backticks no puede romper el script
# ni inyectar HTML. Va arriba a la derecha, POR DEBAJO de la barra fija de
# Everest, y nunca en abajo-derecha (zona reservada par# Toast apilable en navegador con diseño macOS Glassmorphism.
JS_TOAST = r"""
({ mensaje, tipo, duracion }) => {
  const ID = 'vgl-toast-stack';
  let stack = document.getElementById(ID);
  if (!stack) {
    stack = document.createElement('div');
    stack.id = ID;
    Object.assign(stack.style, {
      position: 'fixed', top: '24px', right: '24px', zIndex: '2147483647',
      display: 'flex', flexDirection: 'column', gap: '12px',
      maxWidth: 'min(410px, calc(100vw - 48px))', pointerEvents: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    stack.setAttribute('aria-live', 'assertive');
    document.body.appendChild(stack);
  }

  const paleta = {
    fraude:      { acento: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.18)', texto: '#f87171', icono: '⛔', titulo: 'CONFIRMACIÓN EXTEMPORÁNEA' },
    inasistencia:{ acento: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.18)', texto: '#fbbf24', icono: '⚠', titulo: 'AUSENCIA EN SALA' },
    exito:       { acento: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.18)', texto: '#34d399', icono: '✔', titulo: 'INGRESO A TIEMPO' },
    info:        { acento: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.18)', texto: '#60a5fa', icono: 'ℹ', titulo: 'NOTIFICACIÓN OPERATIVA' }
  };
  const skin = paleta[tipo] || paleta.info;

  const card = document.createElement('div');
  card.setAttribute('role', 'alert');
  Object.assign(card.style, {
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '16px 18px', borderRadius: '14px',
    background: 'rgba(22, 22, 30, 0.94)',
    backdropFilter: 'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderLeft: `5px solid ${skin.acento}`,
    color: '#ffffff', pointerEvents: 'auto',
    boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
    transform: 'translateX(100%) scale(0.95)', opacity: '0',
    transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    userSelect: 'none'
  });

  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between' });

  const badge = document.createElement('div');
  Object.assign(badge.style, {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '3px 10px', borderRadius: '20px',
    background: skin.badgeBg, color: skin.texto,
    fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px'
  });
  badge.innerHTML = `<span>${skin.icono}</span><span>${skin.titulo}</span>`;

  const closeBtn = document.createElement('span');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    cursor: 'pointer', color: '#94a3b8', fontSize: '13px', fontWeight: 'bold',
    padding: '2px 6px', borderRadius: '50%', transition: 'color 0.2s'
  });
  closeBtn.onmouseenter = () => closeBtn.style.color = '#ffffff';
  closeBtn.onmouseleave = () => closeBtn.style.color = '#94a3b8';

  header.appendChild(badge);
  header.appendChild(closeBtn);
  card.appendChild(header);

  const body = document.createElement('div');
  body.style.fontSize = '13.5px';
  body.style.lineHeight = '1.45';
  body.style.color = '#e2e8f0';
  body.textContent = mensaje;
  card.appendChild(body);

  stack.appendChild(card);
  requestAnimationFrame(() => {
    card.style.transform = 'translateX(0) scale(1)';
    card.style.opacity = '1';
  });

  const dismiss = () => {
    card.style.transform = 'translateX(100%) scale(0.95)';
    card.style.opacity = '0';
    setTimeout(() => card.remove(), 350);
  };

  closeBtn.onclick = dismiss;
  card.onclick = (e) => { if (e.target !== closeBtn) dismiss(); };
  if (duracion > 0) setTimeout(dismiss, duracion);
}
"""

# Refresco de la agenda: Everest solo recarga la lista cuando se pulsa
# "Consultar". Es la unica escritura del vigilante sobre la pagina.
JS_REFRESCAR = r"""
() => {
  const btn = Array.from(document.querySelectorAll('button.button-medico'))
    .find(b => b.textContent.trim().toLowerCase() === 'consultar');
  if (btn && !btn.disabled) { btn.click(); return true; }
  return false;
}
"""

# Badge de latido flotante estilo macOS abajo a la izquierda.
JS_LATIDO = r"""
({ texto, activo }) => {
  const ID = 'vgl-latido';
  let pill = document.getElementById(ID);
  if (!pill) {
    pill = document.createElement('div');
    pill.id = ID;
    Object.assign(pill.style, {
      position: 'fixed', bottom: '20px', left: '20px', zIndex: '2147483646',
      minHeight: '40px', display: 'flex', alignItems: 'center', gap: '10px',
      padding: '0 16px', borderRadius: '20px',
      background: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      color: '#f8fafc', font: '500 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)', pointerEvents: 'none',
      userSelect: 'none'
    });
    const punto = document.createElement('span');
    punto.id = ID + '-punto';
    Object.assign(punto.style, {
      width: '8px', height: '8px', borderRadius: '50%', flex: '0 0 auto',
      transition: 'all 0.3s ease'
    });
    const etiqueta = document.createElement('span');
    etiqueta.id = ID + '-texto';
    pill.appendChild(punto);
    pill.appendChild(etiqueta);
    document.body.appendChild(pill);
  }
  const color = activo ? '#10b981' : '#f59e0b';
  const p = document.getElementById(ID + '-punto');
  p.style.background = color;
  p.style.boxShadow = `0 0 10px ${color}`;
  document.getElementById(ID + '-texto').textContent = texto;
}
"""


# ===========================================================================
# 6. CAPA NAVEGADOR - conexion y bucle
# ===========================================================================

class SalidaSolicitada(Exception):
    """Ctrl+C, SIGTERM o navegador cerrado."""


_detener = False


def _manejar_senal(signum, _frame):  # pragma: no cover - depende del SO
    global _detener
    _detener = True
    log.info("Senal %s recibida: cerrando el turno y escribiendo el reporte.", signum)


def instancia_unica(nombre: str = "VigilanteAgendaCopiloto") -> Any:
    """Evita dos vigilantes compitiendo por el mismo turno.

    Windows usa un mutex nombrado; el resto, un lock de archivo. Devuelve el
    recurso (hay que conservarlo vivo) o None si ya habia otra instancia.
    """
    if sys.platform.startswith("win"):  # pragma: no cover - solo Windows
        import ctypes
        from ctypes import wintypes
        ERROR_ALREADY_EXISTS = 183

        # use_last_error=True: leer el error con windll.kernel32.GetLastError()
        # no es fiable, porque ctypes puede hacer llamadas intermedias que lo
        # pisan. Asi el codigo se captura junto a la llamada.
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateMutexW.restype = wintypes.HANDLE
        kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL,
                                          wintypes.LPCWSTR]

        # "Global\" exige un privilegio que un usuario normal puede no tener;
        # si falla se usa el espacio de la sesion, que basta para un mismo PC.
        for espacio in ("Global", "Local"):
            handle = kernel32.CreateMutexW(None, False, f"{espacio}\\{nombre}_Mutex")
            error = ctypes.get_last_error()
            if handle:
                if error == ERROR_ALREADY_EXISTS:
                    return None          # ya hay otro vigilante
                return handle            # el handle debe sobrevivir
        # No se pudo crear el cerrojo. No se puede afirmar que haya otro, asi
        # que se deja continuar: el bloqueo del perfil de Chrome avisara.
        log.debug("No se pudo crear el mutex de instancia unica (%s).", error)
        return "sin-cerrojo"
    import fcntl
    ruta = Path(tempfile.gettempdir()) / f"{nombre}.lock"
    fh = ruta.open("w")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        fh.close()
        return None
    fh.write(str(os.getpid()))
    fh.flush()
    return fh


def ruta_de_chrome() -> str:
    """Google Chrome instalado en el equipo, o '' si no aparece.

    El vigilante no trae navegador propio: usa el Chrome del PC (channel=
    "chrome"). En un equipo que abre Everest, Chrome ya esta. Se comprueba
    antes de arrancar para poder decirlo con claridad en vez de reventar con
    una traza de Playwright.
    """
    candidatos = [
        Path(base) / "Google" / "Chrome" / "Application" / "chrome.exe"
        for base in filter(None, (
            os.environ.get("PROGRAMFILES"),
            os.environ.get("PROGRAMFILES(X86)"),
            os.environ.get("LOCALAPPDATA"),
        ))
    ]
    for ruta in candidatos:
        if ruta.is_file():
            return str(ruta)
    if sys.platform.startswith("win"):  # pragma: no cover - depende del equipo
        try:
            import winreg
            with winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
            ) as k:
                valor, _ = winreg.QueryValueEx(k, "")
                if valor and Path(valor).is_file():
                    return valor
        except OSError:
            pass
    return ""


def comprobar_requisitos(config: Config) -> bool:
    """Todo lo que el equipo necesita. Devuelve False si falta algo."""
    if config.modo == "perfil" and not ruta_de_chrome():
        log.error(
            "No encuentro Google Chrome en este equipo.\n"
            "  El vigilante no trae navegador propio: usa el Chrome instalado.\n"
            "  Instale Google Chrome y vuelva a abrir el programa.",
        )
        return False
    return True


def conectar(p, config: Config):
    """Devuelve (contexto, cerrar_navegador_al_salir).

    Modo `cdp`: se engancha al Chrome que el medico ya tiene abierto y logueado.
    Es el modo bueno: no duplica perfiles ni obliga a iniciar sesion otra vez.
    Modo `perfil`: abre un Chrome propio con perfil persistente.
    """
    if config.modo == "cdp":
        try:
            navegador = p.chromium.connect_over_cdp(config.cdp_endpoint)
            contextos = navegador.contexts
            if not contextos:
                raise RuntimeError("El navegador no expone ningun contexto.")
            log.info("Enganchado al Chrome del medico (%s).", config.cdp_endpoint)
            # False: al terminar NO se cierra el Chrome del usuario.
            return contextos[0], False
        except Exception as exc:
            log.error(
                "No se pudo enganchar a Chrome en %s (%s).\n"
                "  Cierre Chrome por completo y abralo asi:\n"
                "      chrome.exe --remote-debugging-port=9222\n"
                "  O use --modo perfil para abrir una ventana aparte.",
                config.cdp_endpoint, exc,
            )
            raise SalidaSolicitada from exc

    perfil = config.perfil_dir or str(
        Path(os.environ.get("LOCALAPPDATA", tempfile.gettempdir()))
        / "Google" / "Chrome" / "User Data" / "VigilanteProfile"
    )
    try:
        contexto = p.chromium.launch_persistent_context(
            user_data_dir=perfil,
            headless=False,
            channel="chrome",
            args=["--start-maximized"],
            no_viewport=True,
        )
    except Exception as exc:
        # Chrome no admite dos instancias sobre la misma carpeta de perfil. Es
        # el sintoma habitual de "ya hay un vigilante abierto".
        log.error(
            "No se pudo abrir la ventana de Chrome del vigilante.\n"
            "  Casi seguro ya hay otro vigilante abierto en este equipo: busque\n"
            "  su ventana negra de consola y cierrela antes de volver a abrirlo.\n"
            "  (perfil en uso: %s)\n"
            "  Detalle tecnico: %s",
            perfil, str(exc).splitlines()[0] if str(exc) else exc,
        )
        raise SalidaSolicitada from exc
    log.info("Chrome propio abierto con el perfil %s", perfil)
    return contexto, True


def _tiene_agenda_pintada(pagina) -> bool:
    """True si en esa pestana se ve la lista de citas ahora mismo."""
    try:
        return bool(pagina.evaluate(
            "() => document.querySelectorAll('.labelHora').length > 0"
        ))
    except Exception:
        return False


def localizar_pagina(contexto, config: Config, abrir_si_falta: bool):
    """Busca la pestana de Everest SIN tocar las demas del medico.

    Everest es un SPA: al abrir una historia clinica la agenda desaparece de
    esa pestana sin cambiar de sitio. Por eso no basta con que la URL cuadre;
    entre las pestanas candidatas se prefiere aquella en la que la lista de
    citas esta pintada de verdad. Asi el medico puede tener una pestana con la
    agenda y trabajar en otras sin dejar ciego al vigilante.
    """
    patron = re.compile(config.patron_pagina)
    candidatas = []
    for pagina in contexto.pages:
        try:
            if not pagina.is_closed() and patron.search(pagina.url or ""):
                candidatas.append(pagina)
        except Exception:
            continue

    for pagina in candidatas:
        if _tiene_agenda_pintada(pagina):
            return pagina

    # Ninguna la muestra: puede estar cargando, o el medico esta dentro de una
    # historia. Se conserva la primera candidata para reintentar sin perderla.
    if candidatas:
        return candidatas[0]

    if not abrir_si_falta:
        return None
    pagina = contexto.new_page()
    pagina.goto(config.url, wait_until="domcontentloaded")
    return pagina


def leer_agenda(pagina, marca_base: str) -> tuple[bool, str, list[CitaObservada]]:
    """Un unico evaluate por ciclo. Devuelve (agenda_visible, fecha, citas)."""
    datos = pagina.evaluate(JS_EXTRAER_AGENDA, marca_base)
    if not datos or not datos.get("visible"):
        return False, "", []
    citas = []
    sin_aislar = 0
    for crudo in datos.get("citas", []):
        if not crudo.get("aislada"):
            sin_aislar += 1
        citas.append(CitaObservada(
            hora_texto=crudo.get("hora_texto", ""),
            documento=extraer_documento(crudo.get("documento_crudo", "")),
            edad=extraer_edad(crudo.get("documento_crudo", "")),
            nombre=crudo.get("nombre", ""),
            modalidad=crudo.get("modalidad", ""),
            estado_dom=crudo.get("estado_dom", ""),
            indice=crudo.get("indice", -1),
            marca_dom=crudo.get("marca_dom", ""),
        ))
    if sin_aislar:
        log.warning(
            "%d de %d filas no se pudieron aislar en su tarjeta; se leyeron por "
            "posicion. Revise si Everest cambio la maquetacion.",
            sin_aislar, len(citas),
        )
    return True, datos.get("fecha", ""), citas


class AvisadorEscritorio:
    """Avisos del sistema operativo, por encima de cualquier ventana.

    Hace falta porque el toast se pinta dentro del Chrome del vigilante, y el
    medico normalmente esta mirando otra cosa (su propio Chrome, Edge, Word).
    Un aviso que solo se ve si miras la ventana correcta no sirve de nada.

    Un unico hilo con una sola raiz Tk y una cola. La version 2.0.0 creaba una
    raiz nueva por alerta desde hilos distintos: Tcl no es reentrante y eso
    cuelga o revienta, y ademas aquellas ventanas no se cerraban solas.
    """

    # Fondo, icono y titulo. Los iconos son glifos monocromos a proposito: Tk
    # no dibuja emoji a color, y los de color (⏰ 🚨 ✅) salen emborronados.
    # Estos se leen limpios. El rojo NO usa una equis, para no confundirse con
    # la ✕ de cerrar.
    PALETA = {
        "fraude":       {"fondo": "#16161e", "acento": "#ef4444", "icono": "⛔", "titulo": "CONFIRMACIÓN EXTEMPORÁNEA", "badge_bg": "#381b22", "badge_fg": "#f87171"},
        "inasistencia": {"fondo": "#16161e", "acento": "#f59e0b", "icono": "⚠", "titulo": "AUSENCIA EN SALA", "badge_bg": "#382916", "badge_fg": "#fbbf24"},
        "preventiva":   {"fondo": "#16161e", "acento": "#8b5cf6", "icono": "⏳", "titulo": "TIEMPO DE GRACIA (5:00 MIN)", "badge_bg": "#2e1a47", "badge_fg": "#c084fc"},
        "exito":        {"fondo": "#16161e", "acento": "#10b981", "icono": "✔", "titulo": "INGRESO A TIEMPO", "badge_bg": "#143526", "badge_fg": "#34d399"},
        "info":         {"fondo": "#16161e", "acento": "#3b82f6", "icono": "ℹ", "titulo": "NOTIFICACIÓN OPERATIVA", "badge_bg": "#162846", "badge_fg": "#60a5fa"},
    }

    def __init__(self) -> None:
        import queue
        self._cola: "queue.Queue[tuple[str, str, str, int] | None]" = queue.Queue()
        self._hilo: Any = None
        self._roto = False
        self.rojas_sin_cerrar = 0   # hallazgos que el medico aun no ha mirado

    def avisar(self, quien: str, detalle: str, tipo: str, duracion_ms: int,
               boton: tuple[str, Any] | None = None) -> None:
        """`boton` es (texto, funcion) para una accion opcional en el aviso."""
        if self._roto:
            return
        if self._hilo is None:
            import threading
            self._hilo = threading.Thread(target=self._bucle, daemon=True)
            self._hilo.start()
        self._cola.put((quien, detalle, tipo, duracion_ms, boton))

    @staticmethod
    def _sonar(tipo: str) -> None:
        """Un pitido solo en la roja: es la unica que senala a alguien.

        Si sonaran todas, en un turno normal el ruido seria constante y se
        dejaria de hacer caso justo a la que importa.
        """
        if tipo != "fraude" or not sys.platform.startswith("win"):
            return
        try:
            import winsound
            winsound.MessageBeep(winsound.MB_ICONHAND)
        except Exception as exc:  # pragma: no cover - depende del equipo
            log.debug("Sin sonido de alerta (%s).", exc)

    def cerrar(self) -> None:
        if self._hilo is not None:
            self._cola.put(None)

    def _bucle(self) -> None:  # pragma: no cover - necesita escritorio
        try:
            import tkinter as tk
        except Exception as exc:
            log.debug("Sin Tkinter, no habra avisos de escritorio (%s).", exc)
            self._roto = True
            return
        try:
            raiz = tk.Tk()
            raiz.withdraw()
        except Exception as exc:
            log.debug("No se pudo iniciar el avisador de escritorio (%s).", exc)
            self._roto = True
            return

        abiertos: list[Any] = []

        ANCHO_AVISO = 420
        MARGEN = 16
        SEPARACION = 10

        def recolocar() -> None:
            """Apila sin solaparse; si no caben, salta a otra columna."""
            vivos = [v for v in abiertos if v.winfo_exists()]
            abiertos[:] = vivos
            ancho_pantalla = raiz.winfo_screenwidth()
            alto_pantalla = raiz.winfo_screenheight()

            columna = 0
            y = MARGEN
            for v in vivos:
                v.update_idletasks()
                alto = v.winfo_reqheight()
                if y + alto > alto_pantalla - MARGEN and y > MARGEN:
                    columna += 1
                    y = MARGEN
                x = ancho_pantalla - (columna + 1) * (ANCHO_AVISO + MARGEN)
                if x < 0:
                    columna, y = 0, MARGEN
                    x = ancho_pantalla - ANCHO_AVISO - MARGEN
                v.geometry(f"{ANCHO_AVISO}x{alto}+{x}+{y}")
                y += alto + SEPARACION

        def mostrar(quien: str, detalle: str, tipo: str, duracion_ms: int,
                    boton: tuple[str, Any] | None = None) -> None:
            cfg = self.PALETA.get(tipo, self.PALETA["info"])
            fondo = cfg["fondo"]
            acento = cfg["acento"]
            self._sonar(tipo)
            v = tk.Toplevel(raiz)
            v.overrideredirect(True)
            v.attributes("-topmost", True)
            v.configure(bg=fondo)

            barra_acento = tk.Frame(v, bg=acento, width=5)
            barra_acento.pack(side="left", fill="y")

            marco = tk.Frame(v, bg=fondo, padx=16, pady=12)
            marco.pack(side="left", fill="both", expand=True)

            if tipo == "fraude":
                self.rojas_sin_cerrar += 1

            def cerrar_este(*_):
                if v.winfo_exists():
                    if tipo == "fraude":
                        self.rojas_sin_cerrar = max(0, self.rojas_sin_cerrar - 1)
                    v.destroy()
                recolocar()

            cabecera = tk.Frame(marco, bg=fondo)
            cabecera.pack(fill="x")

            badge = tk.Frame(cabecera, bg=cfg["badge_bg"], padx=8, pady=3)
            badge.pack(side="left")

            tk.Label(badge, text=cfg["icono"], bg=cfg["badge_bg"], fg=cfg["badge_fg"],
                     font=("Segoe UI Emoji", 10)).pack(side="left", padx=(0, 4))
            tk.Label(badge, text=cfg["titulo"], bg=cfg["badge_bg"], fg=cfg["badge_fg"],
                     font=("Segoe UI", 9, "bold")).pack(side="left")

            equis = tk.Label(cabecera, text="✕", bg=fondo, fg="#94a3b8",
                             font=("Segoe UI", 11, "bold"), cursor="hand2",
                             padx=4)
            equis.pack(side="right")
            equis.bind("<Button-1>", cerrar_este)
            equis.bind("<Enter>", lambda e: equis.configure(fg="#ffffff"))
            equis.bind("<Leave>", lambda e: equis.configure(fg="#94a3b8"))

            cuerpo = tk.Frame(marco, bg=fondo)
            cuerpo.pack(fill="x", pady=(8, 0))
            if quien:
                partes_q = quien.split(" · ", 1)
                nombre_p = partes_q[1] if len(partes_q) > 1 else quien
                tk.Label(cuerpo, text=nombre_p, bg=fondo, fg="#ffffff",
                         font=("Segoe UI", 12, "bold"), wraplength=360,
                         justify="left", anchor="w").pack(fill="x")
            tk.Label(cuerpo, text=detalle, bg=fondo, fg="#cbd5e1",
                     font=("Segoe UI", 10), wraplength=360, justify="left",
                     anchor="w").pack(fill="x", pady=(4, 0))

            if boton is not None:
                texto_boton, accion = boton

                def pulsar(*_):
                    try:
                        accion()
                    except Exception as exc:
                        log.debug("La accion del aviso fallo (%s).", exc)
                    cerrar_este()

                b = tk.Label(cuerpo, text=f"  {texto_boton}  ", bg="#27273a",
                             fg="#38bdf8", font=("Segoe UI", 9, "bold"),
                             cursor="hand2", pady=4, padx=6)
                b.pack(anchor="w", pady=(10, 0))
                b.bind("<Button-1>", pulsar)
                b.bind("<Enter>", lambda e: b.configure(bg="#3c3c52", fg="#7dd3fc"))
                b.bind("<Leave>", lambda e: b.configure(bg="#27273a", fg="#38bdf8"))

            abiertos.append(v)
            v.update_idletasks()
            recolocar()
            if duracion_ms > 0:
                v.after(duracion_ms, cerrar_este)

        def vaciar_cola() -> None:
            import queue as _q
            try:
                while True:
                    item = self._cola.get_nowait()
                    if item is None:
                        raiz.quit()
                        return
                    try:
                        mostrar(*item)
                    except Exception as exc:
                        log.debug("Aviso de escritorio fallido (%s).", exc)
            except _q.Empty:
                pass
            raiz.after(200, vaciar_cola)

        raiz.after(200, vaciar_cola)
        try:
            raiz.mainloop()
        except Exception as exc:
            log.debug("El avisador de escritorio se detuvo (%s).", exc)
            self._roto = True


def refrescar_agenda(pagina) -> bool:
    """Vuelve a pedir la agenda pulsando 'Consultar'.

    Everest no repinta solo: sin esto el vigilante releeria el mismo DOM todo
    el turno y no veria ni una llegada. Es la unica escritura que hace sobre la
    pagina, y se puede apagar con --sin-refresco si estorba.
    """
    try:
        return bool(pagina.evaluate(JS_REFRESCAR))
    except Exception as exc:
        log.debug("No se pudo refrescar la agenda (%s).", exc)
        return False


def mostrar_alerta(pagina, mensaje: str, tipo: str, duracion_ms: int) -> None:
    """Las notificaciones emergentes en la página web de Everest se han eliminado.
    Todas las alertas se muestran exclusivamente mediante las notificaciones flotantes de Windows.
    """
    pass


def mostrar_latido(pagina, texto: str, activo: bool) -> None:
    try:
        pagina.evaluate(JS_LATIDO, {"texto": texto, "activo": activo})
    except Exception as exc:
        log.debug("No se pudo pintar el latido (%s).", exc)


def estampar_sello_evidencia(destino: Path, reg: RegistroCita) -> None:
    """Estampa una cabecera ejecutiva con sello de fecha, hora exacta local (Bogotá) y datos del paciente."""
    try:
        from PIL import Image, ImageDraw, ImageFont

        ahora_bog = dt.datetime.now(TZ_BOGOTA)
        fecha_str = ahora_bog.strftime("%d/%m/%Y")
        hora_exacta_str = ahora_bog.strftime("%I:%M:%S %p")

        img_card = Image.open(destino).convert("RGB")
        ancho_card, alto_card = img_card.size

        alto_banner = 70
        alto_total = alto_card + alto_banner

        img_final = Image.new("RGB", (ancho_card, alto_total), color=(15, 23, 42))
        draw = ImageDraw.Draw(img_final)

        try:
            fuente_titulo = ImageFont.truetype("segoeui.ttf", 15)
            fuente_meta = ImageFont.truetype("segoeui.ttf", 13)
        except Exception:
            fuente_titulo = ImageFont.load_default()
            fuente_meta = ImageFont.load_default()

        linea1 = "SELLO DE EVIDENCIA OFICIAL - EL VIGILANTE DE AGENDA"
        linea2 = f"Capturado el {fecha_str} a las {hora_exacta_str} (Hora Bogotá)"
        nombre_p = (reg.nombre or "Paciente sin nombre").strip().title()
        linea3 = f"Paciente: {nombre_p} | Cita: {reg.hora} | Estado Everest: {reg.estado_dom.strip()}"

        draw.text((16, 8), linea1, fill=(56, 189, 248), font=fuente_titulo)
        draw.text((16, 28), linea2, fill=(255, 255, 255), font=fuente_meta)
        draw.text((16, 47), linea3, fill=(203, 213, 225), font=fuente_meta)

        img_final.paste(img_card, (0, alto_banner))
        img_final.save(destino, quality=95)
    except Exception as exc:
        log.debug("No se pudo estampar el sello de evidencia (%s).", exc)


def capturar_evidencia(pagina, reg: RegistroCita, marca: str, salida: Path) -> str:
    """Captura la PANTALLA COMPLETA DEL PC (incluyendo la barra de tareas y el reloj de Windows)."""
    carpeta = salida / "evidencias"
    carpeta.mkdir(parents=True, exist_ok=True)
    etiqueta = re.sub(r"[^\w.-]", "_", f"{reg.fecha}_{reg.hora}_{reg.resultado}")
    destino = carpeta / f"{etiqueta}.png"
    try:
        if marca and pagina:
            try:
                pagina.locator(f'[data-vgl-id="{marca}"]').first.scroll_into_view_if_needed(timeout=2000)
            except Exception:
                pass

        # Captura la pantalla completa de Windows (incluye barra de tareas y reloj del PC)
        from PIL import ImageGrab
        img_pantalla = ImageGrab.grab()
        img_pantalla.save(destino)

        # Estampar sello oficial de fecha y hora exacta
        estampar_sello_evidencia(destino, reg)
        return destino.name
    except Exception as exc:
        log.debug("Sin captura para %s (%s).", reg.clave, exc)
        return ""


def abrir_carpeta(ruta: Path) -> None:
    """Abre el Explorador en la carpeta de reportes."""
    try:
        os.startfile(str(ruta))  # type: ignore[attr-defined]
    except Exception as exc:  # pragma: no cover - depende del SO
        log.debug("No se pudo abrir la carpeta (%s).", exc)


def resumen_de_cierre(motor: MotorAuditoria) -> tuple[str, str]:
    """Balance de la jornada con métricas de eficiencia en la tarjeta flotante de cierre."""
    resumen = motor.resumen()
    en_regla = resumen.get(EN_REGLA, 0)
    inasistencia = resumen.get(INASISTENCIA, 0)
    extemporaneo = resumen.get(REGISTRO_EXTEMPORANEO, 0)
    pendientes = resumen.get(PENDIENTE, 0)
    total = sum([en_regla, inasistencia, extemporaneo, pendientes])

    t_nombre = getattr(motor, "turno", "AM")
    turno_lbl = "Mañana (AM)" if t_nombre == "AM" else "Tarde (PM)"
    porcentaje = (en_regla / total * 100) if total > 0 else 100.0
    horas_vista = motor.segundos_observados / 3600.0

    titulo = f"RESUMEN DE JORNADA — TURNO {t_nombre}"
    cuerpo = (
        f"📊 Turno {turno_lbl}: {total} cita(s) auditadas\n"
        f"✔ {en_regla} a tiempo ({porcentaje:.0f}% cumplimiento)\n"
        f"⚠️ {inasistencia} ausencias  •  ⛔ {extemporaneo} extemporáneas\n"
        f"⏱️ Monitoreo activo: {horas_vista:.1f} horas"
    )
    return titulo, cuerpo


def turno_terminado(motor: MotorAuditoria, ahora: dt.datetime, config: Config) -> bool:
    """Cierre automatico: N minutos despues de la ultima cita del dia."""
    ultima = motor.ultima_hora_cita()
    if ultima is None:
        return False
    if any(r.resultado == PENDIENTE for r in motor.registros.values()):
        return False
    return ahora >= ultima + dt.timedelta(minutes=config.fin_turno_min)


def ejecutar(config: Config, reanudar: bool = True) -> int:
    from playwright.sync_api import sync_playwright

    salida = Path(config.salida_dir) if config.salida_dir else directorio_salida_por_defecto()
    salida.mkdir(parents=True, exist_ok=True)
    log.info("Los reportes quedaran en: %s", salida)

    marca_base = f"vgl{int(time.time())}"
    motor: MotorAuditoria | None = None
    ruta_csv: Path | None = None
    avisador = AvisadorEscritorio()

    with sync_playwright() as p:
        contexto, cerrar_al_salir = conectar(p, config)
        pagina = localizar_pagina(contexto, config, abrir_si_falta=(config.modo == "perfil"))
        if pagina is None:
            log.error(
                "No hay ninguna pestana con la agenda de Everest abierta.\n"
                "  Abra %s y vuelva a lanzar el vigilante.", config.url,
            )
            return 2

        ultimo_guardado = 0.0
        ultimo_refresco = time.monotonic()
        aviso_arranque_pendiente = True
        ciego_desde: float | None = None
        try:
            while not _detener:
                ahora = dt.datetime.now(TZ_BOGOTA)

                # La pestana puede haberse cerrado o el medico haber navegado.
                if pagina.is_closed():
                    pagina = localizar_pagina(contexto, config, abrir_si_falta=False)
                    if pagina is None:
                        log.info("La agenda de Everest se cerro. Fin del turno.")
                        break
                    continue

                try:
                    visible, fecha_texto, citas = leer_agenda(pagina, marca_base)
                except Exception as exc:
                    # Angular repinta y destruye el contexto de ejecucion: es
                    # normal, se reintenta en el siguiente ciclo.
                    log.debug("Lectura fallida, se reintenta (%s).", exc)
                    visible, fecha_texto, citas = False, "", []

                if not visible:
                    # Everest es un SPA: al abrir una historia la agenda se va de
                    # la pestana. Se busca si esta en otra y, si no, se avisa: un
                    # vigilante ciego en silencio es peor que uno que se queja.
                    otra = localizar_pagina(contexto, config, abrir_si_falta=False)
                    if otra is not None and otra is not pagina:
                        pagina = otra
                        log.info("Agenda encontrada en otra pestana: se sigue ahi.")
                        continue
                    # Se pinta el aviso EN la ventana que el medico esta mirando:
                    # nadie vigila una consola durante la consulta.
                    if motor is None:
                        pill = "Vigilante en espera - abra 'Citas del dia'"
                    else:
                        pill = "Vigilante sin agenda a la vista - no se esta auditando"
                    mostrar_latido(pagina, pill, False)

                    if ciego_desde is None:
                        ciego_desde = time.monotonic()
                        if motor is None:
                            log.warning(
                                "La agenda no aparece en esta ventana. Entre a "
                                "'Citas del dia' en el Chrome que acaba de abrirse: "
                                "hasta entonces no se audita nada."
                            )
                        else:
                            log.warning(
                                "La agenda no esta a la vista (historia clinica "
                                "abierta?). Mientras tanto no se puede auditar: las "
                                "llegadas de este rato quedaran sin certificar."
                            )
                    elif time.monotonic() - ciego_desde > 300:
                        # Recordatorio cada 5 min: 38 minutos en silencio no
                        # pueden volver a pasar desapercibidos.
                        ciego_desde = time.monotonic()
                        log.warning("Sigue sin verse la agenda. No se esta auditando.")
                elif ciego_desde is not None:
                    minutos = (time.monotonic() - ciego_desde) / 60
                    log.info("Agenda de nuevo a la vista tras %.1f min sin verla.", minutos)
                    ciego_desde = None

                if visible:
                    fecha_agenda = parsear_fecha_es(fecha_texto) or ahora.date()
                    turno_actual = determinar_turno(ahora)

                    if motor is None:
                        motor = (cargar_estado(salida, fecha_agenda, config, turno=turno_actual) if reanudar else None)
                        if motor is None:
                            motor = MotorAuditoria(config, fecha_agenda, turno=turno_actual)

                    if fecha_agenda != motor.fecha_agenda:
                        # Cambio de dia (o el medico abrio otra fecha): se cierra
                        # el reporte anterior antes de empezar el nuevo.
                        ruta_csv, _ = guardar_reportes(motor, salida, motor.turno)
                        log.info("Agenda cambio de fecha. Reporte cerrado: %s", ruta_csv)
                        motor = MotorAuditoria(config, fecha_agenda, turno=turno_actual)
                        aviso_arranque_pendiente = True
                    elif turno_actual != motor.turno:
                        # Transicion automatica de turno a la 1:00 PM (13:00)
                        ruta_csv, _ = guardar_reportes(motor, salida, motor.turno)
                        log.info("Cierre automatico del turno %s a la 1:00 PM. Reporte guardado: %s", motor.turno, ruta_csv)
                        avisador.avisar(
                            "Jornada Mañana Finalizada — 1:00 PM",
                            f"Reporte del turno {motor.turno} guardado exitosamente. Sesión reiniciada y limpia para el Turno Tarde (PM).",
                            "info", 0
                        )
                        motor = MotorAuditoria(config, fecha_agenda, turno=turno_actual)
                        aviso_arranque_pendiente = True

                    if fecha_agenda != ahora.date():
                        # Agenda de otro dia a la vista: se observa, pero no se
                        # audita. Si no, cada cita pasada saldria como fraude.
                        mostrar_latido(
                            pagina,
                            f"Vigilante en pausa - agenda del {fecha_agenda.strftime('%d/%m')}",
                            False,
                        )
                    else:
                        eventos = motor.procesar(citas, ahora)

                        # Al arrancar tarde hay filas que ya estaban confirmadas:
                        # el vigilante no vio la llegada y no puede certificarla.
                        # Se avisa una vez, en azul, para que el silencio no se
                        # confunda con "no hay nadie en sala".
                        if aviso_arranque_pendiente:
                            aviso_arranque_pendiente = False
                            # Todas las que ya estaban confirmadas al abrir: el
                            # vigilante no vio ninguna de esas llegadas, asi que
                            # se resumen en un solo aviso en vez de anunciarlas
                            # una a una como si las hubiera presenciado.
                            ya_en_sala = sum(
                                1 for r in motor.registros.values()
                                if clasificar_estado(r.estado_dom) == "CONFIRMADO"
                                and not es_estado_atendido(r.estado_dom)
                                and r.resultado == EN_REGLA
                                and not r.ultimo_visto_pendiente
                            )
                            if ya_en_sala:
                                if ya_en_sala == 1:
                                    quien = "1 paciente ya se encuentra en sala de espera"
                                else:
                                    quien = f"{ya_en_sala} pacientes ya se encuentran en sala de espera"
                                detalle = (
                                    "Sus notificaciones de ingreso se recibieron antes de iniciar El Vigilante. "
                                    "A partir de este momento se notifica cada nuevo evento."
                                )
                                mostrar_alerta(pagina, f"{quien}. {detalle}", "info",
                                               config.duracion_toast_ms)
                                avisador.avisar(quien, detalle, "info",
                                                config.duracion_toast_ms)
                                log.info("%s. %s", quien, detalle)
                        # clave de auditoria -> marca DOM, para capturar la
                        # tarjeta exacta que disparo el hallazgo.
                        marcas = {
                            motor.clave_de(c): c.marca_dom
                            for c in citas if c.hora is not None
                        }
                        for ev in eventos:
                            if ev.tipo == REGISTRO_EXTEMPORANEO:
                                # El hallazgo rojo se queda hasta que el medico lo cierre.
                                tipo, duracion = "fraude", 0
                            elif ev.tipo == INASISTENCIA:
                                tipo, duracion = "inasistencia", config.duracion_toast_ms
                            elif ev.tipo == PREVENTIVA:
                                tipo, duracion = "preventiva", (ev.duracion_custom_ms or 59000)
                            else:
                                tipo, duracion = "exito", config.duracion_toast_ms
                            mostrar_alerta(pagina, ev.mensaje, tipo, duracion)
                            # Y ademas por encima de todo: el medico casi nunca
                            # esta mirando la ventana del vigilante.
                            avisador.avisar(ev.quien, ev.detalle, tipo, duracion)
                            log.log(
                                logging.INFO if ev.tipo == EN_REGLA else logging.WARNING,
                                "%s", ev.mensaje,
                            )
                            if config.evidencia_visual:
                                archivo = capturar_evidencia(
                                    pagina, ev.registro,
                                    marcas.get(ev.registro.clave, ""), salida,
                                )
                                if archivo:
                                    ev.registro.evidencias.append(archivo)

                        resumen = motor.resumen()
                        pendientes = resumen.get(PENDIENTE, 0)
                        hallazgos = resumen.get(INASISTENCIA, 0) + resumen.get(
                            REGISTRO_EXTEMPORANEO, 0
                        )
                        texto = f"Vigilante activo (Turno {motor.turno}) - {pendientes} cita(s) en seguimiento"
                        if hallazgos:
                            texto += f" - {hallazgos} hallazgo(s)"
                        mostrar_latido(pagina, texto, True)

                        if eventos or time.monotonic() - ultimo_guardado > 60:
                            guardar_estado(motor, salida)
                            ruta_csv, _ = guardar_reportes(motor, salida, motor.turno)
                            ultimo_guardado = time.monotonic()

                        if turno_terminado(motor, ahora, config):
                            log.info("Ultima cita cerrada hace %d min. Fin del turno.",
                                     config.fin_turno_min)
                            break

                # Se vuelve a consultar la agenda durante la espera, para que el
                # siguiente ciclo lea un DOM fresco y no el mismo de siempre.
                if config.refresco_seg > 0 and not pagina.is_closed():
                    if time.monotonic() - ultimo_refresco >= config.refresco_seg:
                        ultimo_refresco = time.monotonic()
                        if refrescar_agenda(pagina):
                            log.debug("Agenda refrescada ('Consultar' pulsado).")

                # Espera troceada para reaccionar rapido a Ctrl+C.
                fin = time.monotonic() + config.intervalo_seg
                while time.monotonic() < fin and not _detener:
                    time.sleep(0.25)

        except KeyboardInterrupt:
            log.info("Interrumpido por el usuario.")
        except SalidaSolicitada:
            pass
        finally:
            if motor is not None:
                guardar_estado(motor, salida)
                ruta_csv, ruta_json = guardar_reportes(motor, salida, motor.turno)
                resumen = motor.resumen()
                log.info(
                    "Turno %s cerrado | en regla: %d | inasistencias: %d | "
                    "registros extemporaneos: %d | canceladas: %d",
                    motor.turno,
                    resumen.get(EN_REGLA, 0), resumen.get(INASISTENCIA, 0),
                    resumen.get(REGISTRO_EXTEMPORANEO, 0), resumen.get(EXCLUIDA, 0),
                )
                log.info("Reporte: %s", ruta_csv)
                log.info("Datos:   %s", ruta_json)

                # Aviso final: hasta ahora el balance solo quedaba en la
                # consola, que el medico casi nunca mira antes de cerrarla.
                titulo, balance = resumen_de_cierre(motor)
                pendientes_rojas = avisador.rojas_sin_cerrar
                if pendientes_rojas == 1:
                    balance += " Queda 1 hallazgo sin revisar en pantalla."
                elif pendientes_rojas > 1:
                    balance += (
                        f" Quedan {pendientes_rojas} hallazgos sin revisar "
                        f"en pantalla."
                    )
                avisador.avisar(
                    titulo, balance, "info", 0,
                    boton=("Ver reporte", lambda: abrir_carpeta(salida)),
                )
                log.info("%s. %s", titulo, balance)
            else:
                log.info("No se llego a leer ninguna agenda: no hay reporte que escribir.")
            # No se llama a avisador.cerrar(): los avisos deben seguir en
            # pantalla mientras el proceso viva esperando el Enter de la
            # consola, para que el medico pueda leerlos y cerrarlos el mismo.
            if cerrar_al_salir:
                try:
                    contexto.close()
                except Exception:
                    pass

    return 0


# ===========================================================================
# 7. CLI
# ===========================================================================

def construir_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="vigilante_agenda",
        description="Auditor de la ventana de gracia (5:59) de la agenda de Everest.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--modo", choices=["cdp", "perfil"], default=None,
                   help="cdp: engancharse al Chrome ya abierto (recomendado). "
                        "perfil: abrir una ventana propia.")
    p.add_argument("--url", default=None, help="URL de la agenda.")
    p.add_argument("--cdp-endpoint", default=None, help="Por defecto http://127.0.0.1:9222")
    p.add_argument("--perfil-dir", default=None, help="Carpeta del perfil en modo perfil.")
    p.add_argument("--intervalo", type=float, default=None, help="Segundos entre lecturas.")
    p.add_argument("--gracia", type=int, default=None,
                   help="Segundos de gracia inclusive (359 = 5:59).")
    p.add_argument("--fin-turno", type=int, default=None,
                   help="Minutos tras la ultima cita para cerrar el turno.")
    p.add_argument("--salida", default=None, help="Carpeta de reportes.")
    p.add_argument("--sin-evidencia", action="store_true",
                   help="No guardar capturas de pantalla de las tarjetas.")
    p.add_argument("--duracion-aviso", type=int, default=None,
                   help="Milisegundos que dura cada aviso en pantalla. 0 = no se "
                        "cierran solos, hay que cerrarlos a mano. Las alertas "
                        "rojas nunca se cierran solas.")
    p.add_argument("--refresco", type=int, default=None,
                   help="Segundos entre pulsaciones de 'Consultar' (0 = no tocar "
                        "la pagina; sin refresco Everest no repinta y no se ven "
                        "las llegadas).")
    p.add_argument("--config", default=None, help="JSON con la configuracion del turno.")
    p.add_argument("--no-reanudar", action="store_true",
                   help="Ignorar el estado guardado y empezar el turno de cero.")
    p.add_argument("--verboso", action="store_true")
    p.add_argument("--version", action="version", version=f"vigilante_agenda {VERSION}")
    return p


def config_desde_args(args: argparse.Namespace) -> Config:
    cfg = Config()
    if args.config:
        cfg = cfg.con_overrides(args.config)
    for attr, valor in (
        ("modo", args.modo), ("url", args.url), ("cdp_endpoint", args.cdp_endpoint),
        ("perfil_dir", args.perfil_dir), ("intervalo_seg", args.intervalo),
        ("gracia_seg", args.gracia), ("fin_turno_min", args.fin_turno),
        ("salida_dir", args.salida), ("refresco_seg", args.refresco),
        ("duracion_toast_ms", args.duracion_aviso),
    ):
        if valor is not None:
            setattr(cfg, attr, valor)
    if args.sin_evidencia:
        cfg.evidencia_visual = False
    # Un archivo local (el simulador) no expone CDP: se fuerza el modo perfil.
    if args.url and args.url.startswith("file:") and args.modo is None:
        cfg.modo = "perfil"
    return cfg


def _consola_se_cerrara_al_salir() -> bool:
    """True si esta ventana de consola es nuestra (se abrio con doble clic).

    Al arrancar desde el Explorador, Windows crea una consola solo para este
    proceso y la destruye al terminar: el mensaje de error se ve un instante y
    desaparece. Si en cambio se lanzo desde una consola que ya existia, hay mas
    de un proceso enganchado y no hay que estorbar.
    """
    if not sys.platform.startswith("win"):  # pragma: no cover - solo Windows
        return False
    try:
        import ctypes
        lista = (ctypes.c_uint * 8)()
        enganchados = ctypes.windll.kernel32.GetConsoleProcessList(lista, 8)
        return enganchados <= 1
    except Exception:
        return False


def _esperar_antes_de_cerrar(codigo: int) -> None:
    """Deja leer el mensaje antes de que Windows se lleve la ventana."""
    if not _consola_se_cerrara_al_salir():
        return
    if codigo == 0:
        aviso = ("\nRevise los avisos que quedan en pantalla y cierrelos con su X.\n"
                 "Cuando termine, pulse Enter aqui para cerrar esta ventana...")
    else:
        aviso = "\nNo se pudo iniciar (ver el mensaje de arriba). Pulse Enter para cerrar..."
    try:
        input(aviso)
    except (EOFError, KeyboardInterrupt):
        pass


def _anadir_log_en_archivo(config: Config) -> Path | None:
    """Deja un registro en disco: la consola se cierra y se lleva la prueba.

    Sin esto, cuando falla en el PC de otra persona no queda absolutamente
    nada que mirar.
    """
    try:
        salida = Path(config.salida_dir) if config.salida_dir else directorio_salida_por_defecto()
        salida.mkdir(parents=True, exist_ok=True)
        ruta = salida / f"vigilante_{dt.date.today().isoformat()}.log"
        manejador = logging.FileHandler(ruta, encoding="utf-8")
        manejador.setLevel(logging.DEBUG)
        manejador.setFormatter(logging.Formatter(
            "%(asctime)s  %(levelname)-8s %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
        logging.getLogger().addHandler(manejador)
        return ruta
    except Exception:
        return None


def main(argv: Sequence[str] | None = None) -> int:
    # La consola de Windows va en cp1252 y destroza los acentos y separadores
    # de los avisos. Con esto el log en pantalla se lee igual que el del disco.
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):  # pragma: no cover
            pass

    args = construir_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verboso else logging.INFO,
        format="%(asctime)s  %(levelname)-8s %(message)s",
        datefmt="%H:%M:%S",
    )
    # El archivo siempre recoge DEBUG, aunque la consola vaya en INFO.
    logging.getLogger().setLevel(logging.DEBUG)
    for h in logging.getLogger().handlers:
        h.setLevel(logging.DEBUG if args.verboso else logging.INFO)

    config = config_desde_args(args)
    ruta_log = _anadir_log_en_archivo(config)
    log.info("Vigilante %s iniciando.", VERSION)
    if ruta_log:
        log.info("Registro detallado en: %s", ruta_log)

    if not comprobar_requisitos(config):
        return 5

    cerrojo = instancia_unica()
    if cerrojo is None:
        log.error("Ya hay un vigilante corriendo en este equipo. No se abre otro.")
        return 3

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, _manejar_senal)
        except (ValueError, AttributeError):  # pragma: no cover
            pass

    try:
        return ejecutar(config, reanudar=not args.no_reanudar)
    except SalidaSolicitada:
        # Ya se explico el motivo con un mensaje para el medico.
        return 6
    except ImportError:
        log.error("Falta Playwright. Instalelo con:  pip install playwright && playwright install chromium")
        return 4
    except Exception:
        # Nada puede escapar de aqui: si sale una traza, la consola se cierra
        # de golpe y el medico se queda sin saber que paso.
        log.error(
            "El vigilante se detuvo por un error inesperado. Detalle:\n%s",
            traceback.format_exc(),
        )
        return 7
    finally:
        if hasattr(cerrojo, "close"):
            cerrojo.close()


if __name__ == "__main__":
    _codigo = main()
    _esperar_antes_de_cerrar(_codigo)
    raise SystemExit(_codigo)
