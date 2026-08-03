# -*- mode: python ; coding: utf-8 -*-
# Build del Vigilante de Agenda (v3.1).
# - Un solo ejecutable de ventana: vigilante_agenda_pym.exe
#   * Modo normal: overlay flotante + monitoreo.
#   * Modo captura: vigilante_agenda_pym.exe --capturar  (vuelca el DOM de la agenda).
# - Ya NO usa pandas/numpy (PyM se lee con openpyxl): build más liviana y sin el
#   bloqueo de DLLs por Windows Application Control.
# - Playwright se empaqueta con sus propios hooks de PyInstaller. No se incluye el
#   navegador Chromium: el Vigilante usa el Chrome del sistema por CDP.

a = Analysis(
    ['src\\main.py'],
    pathex=['src'],
    binaries=[],
    datas=[],
    hiddenimports=[
        'capturar_dom',        # modo --capturar (import diferido en main)
        'openpyxl',
        'win32crypt',
        'win32timezone',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'pandas',
        'numpy',
        'matplotlib',
        'scipy',
        'PIL',
        'pytest',
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='vigilante_agenda_pym',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='vigilante_agenda_pym',
)
