@echo off
chcp 65001 >nul
REM ===========================================================================
REM  VIGILANTE DE AGENDA - Lanzador (un solo clic)
REM  1) Abre Chrome (perfil propio del Vigilante, con puerto de depuracion).
REM  2) Abre Everest para que el medico inicie sesion y entre a "Citas del dia".
REM  3) Inicia el Vigilante: usa el .exe si existe; si no, el entorno .venv
REM     del repositorio (creado por PREPARAR_VIGILANTE.bat).
REM ===========================================================================
setlocal
title Vigilante de Agenda - Iniciando...

set "PORT=9222"
set "PERFIL=%LOCALAPPDATA%\VigilanteEverestProfile"
set "EVEREST=https://neps.everestintelligent.com/viva/HCHealth/"

echo.
echo  Iniciando Vigilante de Agenda...
echo.

REM --- 1) Ubicar Google Chrome ---
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if "%CHROME%"=="" (
  echo  [ERROR] No se encontro Google Chrome.
  echo  Instale Chrome y vuelva a intentar.
  echo.
  pause
  exit /b 1
)

REM --- 2) Abrir Chrome del Vigilante (perfil propio + puerto de depuracion) en Everest ---
start "" "%CHROME%" --remote-debugging-port=%PORT% --user-data-dir="%PERFIL%" --new-window "%EVEREST%"

REM --- 3) Iniciar el Vigilante: .exe si existe; si no, entorno .venv ---
set "APP="
if exist "%~dp0vigilante_agenda_pym.exe" set "APP=%~dp0vigilante_agenda_pym.exe"
if not defined APP if exist "%~dp0dist\vigilante_agenda_pym\vigilante_agenda_pym.exe" set "APP=%~dp0dist\vigilante_agenda_pym\vigilante_agenda_pym.exe"

if defined APP (
  start "" "%APP%" --refresco 5
  goto :fin
)

if exist "%~dp0.venv\Scripts\pythonw.exe" (
  start "" "%~dp0.venv\Scripts\pythonw.exe" "%~dp0src\main.py" --refresco 5
  goto :fin
)

echo  [AVISO] No se encontro el ejecutable ni el entorno .venv.
echo  Si solo va a CAPTURAR el DOM: deje esta ventana de Chrome abierta,
echo  ejecute PREPARAR_VIGILANTE.bat y luego Capturar_DOM.bat.
echo.
pause

:fin
endlocal
