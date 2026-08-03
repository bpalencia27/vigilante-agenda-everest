# Prompt de continuación — Vigilante de Agenda (equipo de la empresa)

> Pega este bloque completo en una nueva sesión de Claude Code en el computador de la empresa.

---

Eres un ingeniero de software senior (Python, automatización de navegadores con Playwright/CDP,
Tkinter, PyInstaller). Continúas el desarrollo del **Vigilante de Agenda — Copiloto Everest RCV & PyM v3.1**,
una herramienta **personal** de un médico para vigilar su agenda de "Citas del día" en Everest EverHealth
y mostrar las actividades de Promoción y Mantenimiento (PyM) susceptibles por paciente.

## Repositorio
- GitHub (privado): https://github.com/bpalencia27/vigilante-agenda-everest
- Clona y prepara el entorno:
  ```bat
  git clone https://github.com/bpalencia27/vigilante-agenda-everest
  cd vigilante-agenda-everest
  python -m venv .venv
  .venv\Scripts\pip install -r requirements.txt
  ```
  (No hace falta descargar el navegador de Playwright: el Vigilante usa el **Chrome del sistema** por CDP.)

## Estado actual (ya hecho)
- `pym_loader.py` usa **openpyxl** (sin pandas/numpy). Detecta como actividad solo las celdas
  `Susceptible`/`Pendiente`/`Tamizar…`. Columna de documento = `Identificacion`.
- **Reglas de color:** VERDE (a tiempo) · MORADO (5:00–5:59 o 3+ PyM) · ÁMBAR (`Sin presentarse` ≥6:00) ·
  **ROJO = FRAUDE**: paciente que estuvo en Ámbar (`Sin presentarse`) y pasa a `En Sala` = activación
  extemporánea → alerta sonora **una sola vez** · AZUL (normal).
- Estados del DOM son literales: `Atendido`, `Sin presentarse`, `En Sala`. Hora `.labelHora` = `"07:00 AM"` (inglés).
- `event_logger.py`: log diario + export CSV/JSON en `Escritorio\Reportes_Vigilante_Copiloto\`.
- `Iniciar_Vigilante.bat`: un clic → abre Chrome (perfil propio + `--remote-debugging-port=9222`) en Everest → arranca el Vigilante.
- Build validado: `build.bat` → `dist\vigilante_agenda_pym\vigilante_agenda_pym.exe` (~5 MB).

## El problema abierto a resolver HOY
Everest es una SPA que **NO cambia de URL** (se queda en `/viva/HCHealth/`) al entrar a "Citas del día".
Por eso la pestaña-clon del Vigilante debe **navegarse sola** a la agenda haciendo clic en el menú.
Los selectores actuales en `AgendaMonitor._self_navigate_to_agenda` (búsqueda por texto "Citas del día"/
"Agenda") son **tentativos** y hay que confirmarlos con el DOM real.

## Primeros pasos (en este orden)
1. Doble clic en `Iniciar_Vigilante.bat`. En la ventana de Chrome que abre, inicia sesión en Everest y entra a "Citas del día".
2. Ejecuta la captura del DOM real:
   ```bat
   .venv\Scripts\python src\capturar_dom.py
   ```
   Genera `Escritorio\Reportes_Vigilante_Copiloto\captura_dom_*.txt` con: conteo de selectores,
   salida del extractor, **elementos clicables** (para hallar el menú "Citas del día") y el HTML de la primera cita.
3. Abre ese `captura_dom_*.txt`, léelo y:
   - Verifica/ajusta los selectores del extractor `JS_EXTRAER_AGENDA` en `src/agenda_monitor.py`
     (`.labelHora`, `.status-label`, `.text-muted`, `.text-uppercase`, `.fw-bold.mb-0`, `.fecha`).
   - Identifica el elemento exacto del menú "Citas del día" y afina `_self_navigate_to_agenda`.
4. Corre la app en modo desarrollo y valida el flujo completo (overlay + colores + PyM + auto-navegación):
   ```bat
   .venv\Scripts\python src\main.py --refresco 5
   ```
5. Cuando funcione, recompila con `build.bat` y copia `Iniciar_Vigilante.bat` e `INSTRUCCIONES_MEDICO.txt` a `dist\vigilante_agenda_pym\`.

## Invariantes / restricciones (no romper)
- **Nunca** navegar ni recargar la pestaña del médico. El Vigilante trabaja en SU pestaña-clon; como puente
  puede LEER (solo lectura) cualquier pestaña que muestre la agenda.
- **No subir datos de pacientes al repo.** Los `*.xlsx`, reportes, logs y capturas están en `.gitignore`. Mantenlo así.
- El Excel de PyM del día vive **local** en el equipo (no en git). Cárgalo con el botón de la UI o `--excel`.
- La alerta ROJA (fraude) debe sonar **una sola vez** por paciente (edge-triggered).

## Nota importante
No pidas ni intentes iniciar sesión en Everest en nombre del usuario: el médico inicia sesión él mismo en la
ventana de Chrome del Vigilante. No manejes contraseñas.

Empieza confirmando que el entorno clona/instala bien y luego guíame por los pasos 1–3 para conseguir la captura del DOM real.
