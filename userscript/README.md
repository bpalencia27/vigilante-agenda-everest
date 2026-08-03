# Vigilante de Agenda — Userscript (v3.2)

Versión de navegador del Vigilante. Corre **dentro del Chrome del médico** como userscript de
Tampermonkey: sin `.exe`, sin `.bat`, sin puerto de depuración. No dispara antivirus porque no
hace nada de lo que hace un *infostealer* (nada de CDP ni extracción de cookies): solo lee el DOM
de la página que el médico ya está viendo y pinta un overlay.

## Instalación (una vez)

1. Abre **Tampermonkey** (icono en Chrome) → **Panel de control**.
2. Pestaña **Utilidades** → *Importar desde archivo* → elige `vigilante_agenda.user.js`.
   (O: pestaña **+** *Crear nuevo script* → borra todo → pega el contenido → **Ctrl+S**.)
3. Verifica que quede **habilitado**.

## Uso

1. Inicia sesión en Everest y entra a **Citas del día**. El overlay aparece abajo a la derecha.
2. Pulsa **Cargar PyM** y selecciona la matriz del día (`.xlsx` o `.csv`).
3. El overlay muestra cada cita con su color y las actividades de PyM susceptibles.
   - **VERDE** a tiempo · **MORADO** pre-alerta (5:00–5:59 o 3+ PyM) · **ÁMBAR** "Sin presentarse" ≥6:00
   - **ROJO = fraude** (pasó de Ámbar a "En Sala") con alerta sonora una sola vez · **AZUL** normal.
4. Se puede arrastrar por la barra superior y minimizar con **_**.

## Si detecta 0 citas

La maquetación de Everest pudo cambiar. Pulsa **Diag** en el overlay: descarga
`diagnostico_dom_SANITIZADO.txt` (sin datos de pacientes) para reajustar `CONFIG.SEL` en el script.

## Notas

- Ningún dato sale del navegador; el PyM se procesa en memoria.
- El `.xlsx` se parsea con SheetJS vía `@require` a cdnjs. Si la red lo bloquea, usa `.csv`.
- La lógica de colores/fraude/PyM es un puerto fiel de `src/agenda_monitor.py` y `src/pym_loader.py`.
