@echo off
REM ===========================================================================
REM  Recompila el Vigilante de Agenda a un ejecutable (dist\vigilante_agenda_pym\)
REM  Requiere el entorno virtual .venv con las dependencias instaladas.
REM ===========================================================================
setlocal
echo Cerrando instancias abiertas del Vigilante (si las hay)...
taskkill /f /im vigilante_agenda_pym.exe >nul 2>&1

echo Compilando con PyInstaller...
call ".venv\Scripts\activate.bat"
pyinstaller --noconfirm --clean vigilante_agenda_pym.spec

if errorlevel 1 (
  echo.
  echo [ERROR] La compilacion fallo. Revise los mensajes anteriores.
  pause
  exit /b 1
)

echo.
echo [OK] Ejecutable en: dist\vigilante_agenda_pym\vigilante_agenda_pym.exe
echo Recuerde copiar 'Iniciar_Vigilante.bat' y 'INSTRUCCIONES_MEDICO.txt'
echo dentro de esa carpeta para la entrega al medico.
endlocal
