# Vigilante de Agenda — Módulo 3

Audita la **regla de los 5:59** sobre la agenda de Everest (`/viva/HCHealth/`)
leyendo **únicamente el DOM**. No llama ninguna API de la IPS.

| Situación | Resultado | Alerta |
|---|---|---|
| Paciente marcado presente entre la hora de la cita y +5:59 | `EN_REGLA` | — |
| A los +6:00 sigue sin marcar | `INASISTENCIA` | Naranja |
| Ya vencido el límite, "aparece" marcado presente | `REGISTRO_EXTEMPORANEO` | Roja (no se autocierra) |
| Cancelada / reagendada | `EXCLUIDA` | — |

---

## Puesta en marcha

```bash
pip install playwright && playwright install chromium
```

**Modo recomendado (`cdp`)** — se engancha al Chrome que el médico ya tiene
abierto y logueado, sin pedir otra sesión ni duplicar perfiles:

```bat
:: 1. Cerrar Chrome POR COMPLETO y reabrirlo así:
chrome.exe --remote-debugging-port=9222
:: 2. Entrar a Everest y abrir "Citas del día"
:: 3. Lanzar el vigilante:
python vigilante_agenda.py
```

**Modo alterno (`perfil`)** — abre una ventana propia (exige iniciar sesión la
primera vez):

```bash
python vigilante_agenda.py --modo perfil
```

**Ensayo sin tocar producción**, contra el simulador incluido:

```bash
python vigilante_agenda.py --url file:///ruta/a/simulador_agenda_ips.html
```

Cierre con `Ctrl+C`: el reporte se escribe igual.

---

## Qué produce

En `Escritorio/Reportes_Vigilante_Copiloto/` (configurable con `--salida`):

- `auditoria_agenda_AAAA-MM-DD.csv` — para el humano. Separador `;` y BOM UTF-8
  porque Excel en español así lo espera; con `,` las tildes y las columnas salen
  rotas.
- `auditoria_agenda_AAAA-MM-DD.json` — para la máquina.
- `estado_vigilante_AAAA-MM-DD.json` — permite **reanudar el turno** si el script
  se cae a media mañana, sin repetir alertas ni perder hallazgos.
- `evidencias/*.png` — captura de **la tarjeta** de la cita, no de la pantalla.

Todo se escribe de forma atómica (temporal + `replace`), así que nunca queda un
reporte a medias.

---

## Decisiones que conviene conocer

**No se afirma lo que no se observó.** Si el vigilante arranca a las 9 y la cita
de las 6 ya figura "En Sala", no puede saber si la marcaron a las 6:02 o a las
8:50. Esa fila sale como `EN_REGLA` pero con **confianza `PARCIAL`** y la nota
correspondiente. Un reporte de auditoría que afirma de más no sirve como
soporte.

**Agenda de otro día = modo pausa.** Si el médico consulta una fecha pasada, el
vigilante observa pero no audita. Sin esa guarda, cada cita vieja saldría como
fraude.

**Agenda fuera de vista ≠ inasistencia.** Cuando el médico entra a una historia
clínica la lista desaparece del DOM. Un snapshot vacío no convierte a nadie en
infractor; el reporte anota cuántos minutos se tuvo la agenda realmente a la
vista.

**Estado desconocido = pendiente.** Si la IPS estrena un estado no catalogado,
se trata como "no ha llegado" y se registra en el log. Conservador a propósito:
puede sobrar una alerta, nunca faltar una.

**Zona segura.** Las alertas van arriba a la derecha (bajo la barra fija de
Everest) y el indicador de actividad abajo a la **izquierda**. El rectángulo
`bottom:20px; right:20px` queda libre: es del Módulo 2, y la web real ya tiene
ahí su `#everest-panel-container`.

**Nunca se toca el trabajo del médico.** No se cierran sus pestañas, no se
navega una pestaña que él abrió, y las alertas solo se pintan en Everest.

---

## Verificación

```bash
python -m unittest test_vigilante_agenda -v     # 33 pruebas del núcleo
```

El núcleo (`MotorAuditoria`) es puro y no sabe que existe un navegador, así que
la lógica que decide si hubo fraude se prueba sin Playwright ni red.

La extracción del DOM se validó además contra la estructura real de Everest
(anclas `<!---->` de Angular, atributos `_ngcontent-*`, el envoltorio
`<div class="card mt-1">` que contiene toda la lista) y contra cuatro escenarios
de maquetación rota.

---

## Dato sensible

Los reportes y las evidencias contienen nombre y documento de pacientes. Quedan
**en claro** en el disco del médico. Antes de desplegar conviene definir dónde
se guardan, cuánto tiempo y quién accede (Ley 1581 de 2012). `--sin-evidencia`
desactiva las capturas si el hallazgo textual basta como soporte.

---

## Opciones

| Opción | Por defecto | Para qué |
|---|---|---|
| `--modo {cdp,perfil}` | `cdp` | Cómo se conecta al navegador |
| `--url` | agenda de Everest | Otra URL o el simulador |
| `--cdp-endpoint` | `http://127.0.0.1:9222` | Puerto de depuración |
| `--intervalo` | `5` | Segundos entre lecturas |
| `--gracia` | `359` | Segundos de gracia inclusive (5:59) |
| `--fin-turno` | `20` | Minutos tras la última cita para cerrar |
| `--salida` | Escritorio | Carpeta de reportes |
| `--sin-evidencia` | — | No guardar capturas |
| `--no-reanudar` | — | Empezar el turno de cero |
| `--config archivo.json` | — | Configuración completa en JSON |
