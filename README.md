# Vigilante de Agenda — Copiloto Everest RCV & PyM (v3.1)

Widget flotante *Always-on-Top* que vigila la agenda de "Citas del día" en la
plataforma **Everest EverHealth** y muestra, por paciente, las actividades de
**Promoción y Mantenimiento (PyM)** susceptibles — sin interrumpir el flujo de
atención del médico.

> ⚠️ **PRIVACIDAD (importante):** este repositorio **NO** contiene datos de
> pacientes. Los Excel de agenda (`Agenda_Dia_CMB_*.xlsx`), los reportes/logs y
> las capturas de DOM están excluidos por `.gitignore` y **nunca** deben subirse.
> Es un proyecto de **uso personal** del médico sobre su propia cuenta/equipo.

## Cómo funciona

- **Monitoreo por CDP:** se adjunta al Chrome del médico (`--remote-debugging-port=9222`),
  detecta la vista de "Citas del día" y lee su DOM cada 5 s.
- **Pestaña-clon:** el Vigilante abre su **propia pestaña** (misma sesión) y se
  navega solo a la agenda, para seguir vigilando aunque el médico entre a
  "Historias Clínicas". Nunca navega ni recarga la pestaña del médico.
- **Clasificación por colores:** VERDE (a tiempo) · MORADO (pre-alerta / 3+ PyM) ·
  ÁMBAR ("Sin presentarse" pasada la tolerancia) · **ROJO** (fraude: pasó de
  Ámbar a "En Sala" = activación extemporánea, alerta sonora única) · AZUL (normal).
- **PyM:** cruza la cédula del DOM contra la matriz diaria (openpyxl) y lista las
  columnas marcadas `Susceptible`.
- **Auditoría:** log diario + export CSV/JSON en `Escritorio\Reportes_Vigilante_Copiloto\`.

## Estructura

```
src/
  main.py            Orquestador + CLI (--excel, --refresco, --capturar)
  agenda_monitor.py  Monitoreo CDP, colores/alertas, pestaña-clon
  pym_loader.py      Carga la matriz PyM (openpyxl) e indexa por documento
  session_manager.py Extracción de cookies de Chrome (reservado para vía HTTP futura)
  overlay_ui.py      Widget flotante Tkinter (Slate dark)
  event_logger.py    Logs + export CSV/JSON
  capturar_dom.py    Utilidad de captura de DOM (afinar selectores)
Iniciar_Vigilante.bat   Lanzador de un clic (abre Chrome + Vigilante)
INSTRUCCIONES_MEDICO.txt Guía de 3 pasos para el médico
vigilante_agenda_pym.spec  Build PyInstaller
build.bat               Recompila el ejecutable
requirements.txt
```

## Puesta en marcha (desarrollo)

```bat
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m playwright install
.venv\Scripts\python src\main.py --refresco 5
```

## Empaquetado

```bat
build.bat
```
Genera `dist\vigilante_agenda_pym\vigilante_agenda_pym.exe`. Copie
`Iniciar_Vigilante.bat` e `INSTRUCCIONES_MEDICO.txt` dentro de esa carpeta.

## Captura de DOM (para afinar selectores)

Con Chrome abierto (por `Iniciar_Vigilante.bat`) y sesión iniciada en "Citas del día":

```bat
.venv\Scripts\python src\capturar_dom.py
REM  o, con el ejecutable:
vigilante_agenda_pym.exe --capturar
```
Genera `Escritorio\Reportes_Vigilante_Copiloto\captura_dom_*.txt`.

## Pendiente (perfeccionamiento)

- **Confirmar selectores reales** de "Citas del día" y del menú de navegación
  (la SPA no cambia de URL) con `capturar_dom.py` en el equipo de la empresa.
- Afinar la auto-navegación de la pestaña-clon con esos selectores.
- Verificar el flujo completo (Chrome + login + overlay) en el equipo real.
