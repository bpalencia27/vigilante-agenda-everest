@echo off
chcp 65001 >nul
REM ===========================================================================
REM  VIGILANTE DE AGENDA - Captura de DOM (un solo clic)
REM  Vuelca el DOM de la agenda para afinar selectores. El archivo queda en
REM  Escritorio\Reportes_Vigilante_Copiloto\captura_dom_*.txt
REM
REM  ANTES de usar: abra Chrome con 'Iniciar_Vigilante.bat', inicie sesion en
REM  Everest y entre a 'Citas del dia'. Luego doble clic a este archivo.
REM
REM  Usa el ejecutable si existe; si no, el entorno .venv del repositorio
REM  (creado por PREPARAR_VIGILANTE.bat).
REM ===========================================================================
setlocal
title Vigilante de Agenda - Captura DOM
cd /d "%~dp0"

set "EXE="
if exist "%~dp0vigilante_agenda_pym.exe" set "EXE=%~dp0vigilante_agenda_pym.exe"
if not defined EXE if exist "%~dp0dist\vigilante_agenda_pym\vigilante_agenda_pym.exe" set "EXE=%~dp0dist\vigilante_agenda_pym\vigilante_agenda_pym.exe"

if defined EXE (
  start "" "%EXE%" --capturar
  exit /b 0
)

if exist "%~dp0.venv\Scripts\python.exe" (
  echo  Ejecutando captura con el entorno del repositorio...
  ".venv\Scripts\python.exe" "src\main.py" --capturar
  if errorlevel 1 (
    echo.
    echo  [ERROR] La captura fallo. Revise el mensaje de arriba.
    echo.
    pause
    exit /b 1
  )
  exit /b 0
)

echo  [ERROR] No hay ejecutable ni entorno preparado en esta carpeta.
echo  Ejecute primero PREPARAR_VIGILANTE.bat (doble clic) y reintente.
echo.
pause
exit /b 1
