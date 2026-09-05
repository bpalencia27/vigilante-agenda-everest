# Cambios — claude/compuerta-consentimiento (P11: compuerta de consentimiento + purga de 12 meses)

Base: `claude/pym-agenda-blindaje-v12-4` f3625ee (contiene P10, rama barrera v2).
Sin bump de versión (lo hace S6 al publicar).

## Qué cambia para el médico

**Antes**, el script arrancaba solo con evaluarse: latidos cada 5 s, observadores
de red y captador de SharePoint corrían ANTES de que nadie dijera «sí» a los
términos. **Ahora** hay una compuerta: nada —ni un nodo, ni un temporizador, ni
una petición de red, ni un evento de telemetría— corre mientras el médico no
haya aceptado la versión vigente de los Términos y Aviso de Privacidad.

1. **Punto de entrada único** — `mtrCompuertaArranque()` reemplaza al arranque
   directo (vía `DOMContentLoaded`/`setTimeout 0`, que conserva la corrección
   v16.2.4 de la zona muerta de declaraciones). Es **fail-closed**: cualquier
   excepción en la decisión deja la pestaña en silencio total.
2. **Decisión pura** — `mtrCompuertaDecision()` (sin DOM, sin red): solo
   arranca quien está en el padrón (perfil COMPLETO o LABORATORIOS, no
   bloqueado) Y tiene constancia vigente. Fuera del padrón o bloqueado: ni
   pantalla, ni nodo, ni evento.
3. **Pantalla de términos v1.1** — velo modal propio (prefijos `vgl-terminos-`,
   cssText inline con `!important` en colores, fuera de `#vgl-root`), con el
   texto completo YA presente aunque plegado (PARTE 1 visible, «Ver los
   términos completos» para desplegar). Sin botón ✕; Escape y Tab se consumen
   y el foco queda atrapado: la única salida es contestar. Aceptar guarda
   SOLO `{version, ts, id}` (identificador = `uid:` validado por Everest, o
   `login:`, o vacío) y arranca. Rechazar apaga TODO, no envía ni un evento y
   deja marca local con hora.
4. **TTL del rechazo** — un rechazo fresco (< 12 h) no vuelve a preguntar; a
   las 13 h sí. Actualizar el script SIN cambiar el texto no re-pregunta;
   subir `TERMINOS_VERSION` sí (re-autorización).
5. **Latidos base tras la compuerta** — los tres intervalos que vivían al
   evaluar el script (registro NAV 5 s, vigía del reloj 30 s, latido de
   liderazgo 5 s) se movieron a `_instalarLatidosBase()`, que llama `boot()`
   DESPUÉS del kill-switch. Efectos documentados:
   - Un script apagado en remoto ya no late (el kill en frío NO llama
     `emergencyTeardown`; por eso el corte debía ser por omisión, no por
     desmontaje).
   - La rama de SharePoint ya no registra latidos de navegación (solo corre su
     captador ligero).
   - **R5.1-bis**: los dos `setInterval` literales del instalador (`navLog`,
     `vigiaReloj`) quedan registrados en `state.timers` — el apagado remoto de
     emergencia ahora también los cancela. boot() pasa de 17 a 19 timers
     registrados (caso de suite_17 actualizado).
6. **Fila de Ajustes** — `<b id="c-terminos">` muestra la versión vigente y la
   fecha de la constancia (§7 de la PARTE 2 del propio documento).

## Purga de 12 meses (entregable de instalación manual)

`docs/tablero_purga_12m.gs` — archivo Apps Script APARTE para el mismo proyecto
del tablero (prefijos `purga*`, no toca `Codigo.gs`). El dueño la instala UNA
vez (`purgaInstalar`): disparador diario a las 3 a.m. que recorre TODA hoja con
columna `recibido` y borra las filas con más de 365 días (fila sin fecha
legible NO se borra — criterio conservador). Escribe una fila de log por hoja y
corrida en `purga_log` (aunque borre 0). NO toca `acceso` (roster) ni
`resumen_flota` (vista). Instrucciones y límite de cuota (~6 min) en la
cabecera del archivo.

## Archivos

- `vigilante_agenda.user.js` — módulo P11 completo (TERMINOS_*, mtrCompuerta*,
  mtrTerminos*, _terminos*, _instalarLatidosBase, mtrArrancarTodo) + nuevo
  punto de entrada.
- `tests/harness.js` — exporta `__TERMINOS_TEXTO` (y piezas para el arnés).
- `tests/suite_82_consentimiento.js` — NUEVA: 11 casos (P11·0…P11·10).
- `tests/suite_74_auditoria_p123.js` — caso B7 instala `_instalarLatidosBase()`
  a mano antes de reiniciar el reloj (el latido ya no nace al evaluar).
- `tests/suite_17_nucleo.js` — contador de timers de boot 17 → 19.
- `docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md` — NUEVO: texto legal v1.1 (fuente:
  z.ai + Gemini).
- `docs/tablero_purga_12m.gs` — NUEVO: purga de 12 meses del tablero.
- `tests/INFORME_MUTACIONES.md` — 5 mutaciones verificadas (filas al final).

## Diferido (fuera de alcance de este PR)

- Recuperación de constancia si el médico borra el almacenamiento del script:
  hoy se re-pregunta (comportamiento esperado, P11·8 lo fija).
- Purga de la hoja `acceso` (roster): intencionalmente excluida.

## Hallazgos NO tocados

- La rama `claude/pym-agenda-blindaje-v12-4` remota se movió a `2573309`
  (merge PR #92 «publicar línea 17.x al tronco», @version 17.6.10): esa punta
  YA NO contiene la línea v18 (~431 commits, incluida la barrera P10 en la que
  se apoya esta compuerta). Por eso este PR NO se rebaseó sobre ella — la base
  sigue siendo `f3625ee` (punta v18 = P10). `origin/main` (5042294, P8) está
  detrás de `f3625ee`. El dueño debe decidir contra qué rama se abre el PR.

## Banco

Ver resultado final en la última línea de `tests/INFORME_MUTACIONES.md` (0 fallan).
