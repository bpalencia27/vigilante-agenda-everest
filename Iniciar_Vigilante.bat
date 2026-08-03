@echo off
chcp 65001 >nul
REM ===========================================================================
REM  VIGILANTE DE AGENDA - Lanzador (un solo clic)
REM  1) Abre Chrome (perfil propio del Vigilante, con puerto de depuracion).
REM  2) Abre Everest para que el medico inicie sesion y entre a "Citas del dia".
REM  3) Inicia el Vigilante, que se conecta solo a ese Chrome.
REM  Coloque este archivo en la MISMA carpeta que 'vigilante_agenda_pym.exe'.
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

REM --- 3) Ubicar e iniciar el Vigilante (busca junto a este .bat y en dist\) ---
set "APP="
if exist "%~dp0vigilante_agenda_pym.exe" set "APP=%~dp0vigilante_agenda_pym.exe"
if not defined APP if exist "%~dp0dist\vigilante_agenda_pym\vigilante_agenda_pym.exe" set "APP=%~dp0dist\vigilante_agenda_pym\vigilante_agenda_pym.exe"

if defined APP (
  start "" "%APP%" --refresco 5
) else (
  echo  [AVISO] No se encontro 'vigilante_agenda_pym.exe' junto a este archivo.
  echo  Coloque este .bat en la misma carpeta que el ejecutable del Vigilante.
  echo.
  pause
)

endlocal
