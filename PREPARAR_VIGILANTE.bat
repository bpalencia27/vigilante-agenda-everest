@echo off
chcp 65001 >nul
REM ===========================================================================
REM  VIGILANTE DE AGENDA v3.1 - Preparacion del entorno (ejecutar UNA sola vez)
REM  Crea el entorno virtual .venv e instala las dependencias del repositorio.
REM  Requiere: Python 3.11 instalado y conexion a internet.
REM ===========================================================================
setlocal
title Vigilante 3.1 - Preparando entorno...
cd /d "%~dp0"

if not exist "requirements.txt" (
  echo  [ERROR] Ejecute este archivo dentro de la carpeta del repositorio
  echo  vigilante-agenda-everest ^(donde esta requirements.txt^).
  echo.
  pause
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  echo  [ERROR] Python no esta instalado o no esta en el PATH.
  echo  Instale Python 3.11 desde python.org y vuelva a intentar.
  echo.
  pause
  exit /b 1
)

echo  [1/2] Creando entorno virtual (.venv)...
if exist ".venv\Scripts\python.exe" (
  echo         ...ya existe, se reutiliza.
) else (
  python -m venv .venv
)
if not exist ".venv\Scripts\python.exe" (
  echo  [ERROR] No se pudo crear el entorno virtual.
  echo.
  pause
  exit /b 1
)

echo  [2/2] Instalando dependencias (3-10 minutos segun el internet)...
echo.
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check --timeout 120 --retries 10 -r requirements.txt
if errorlevel 1 (
  echo.
  echo  [ERROR] Fallo la instalacion de dependencias. Revise el mensaje de arriba.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo   [OK] Entorno listo.
echo.
echo   Para capturar el DOM de la agenda:
echo     1. Doble clic a Iniciar_Vigilante.bat
echo     2. Inicie sesion en Everest y entre a 'Citas del dia'
echo     3. Doble clic a Capturar_DOM.bat
echo.
echo   Para compilar el .exe (cuando los selectores esten listos):
echo     build.bat
echo  ============================================================
echo.
pause
endlocal
