#!/usr/bin/env bash
# =============================================================================
#  run-nightly-checks.sh — Chequeo nocturno del ecosistema .deepseek
#
#  Qué hace, en orden:
#    1. Verifica el entorno (node disponible).
#    2. Chequeo sintáctico del userscript:            node --check vigilante_agenda.user.js
#    3. Chequeo sintáctico de TODOS los .js de tests/ (suites + harness + runner).
#    4. Banco completo:                               node tests/runner.js
#       (opcional: pasar un sufijo de suite como $1, p. ej. "suite_94", para
#        filtrar el banco — misma semántica que el argumento del runner).
#  Escribe en .deepseek/logs/<YYYY-MM-DD>/:
#    - RESUMEN.md                  (resumen ejecutivo de la noche)
#    - <chequeo>.log               (salida completa por chequeo)
#  Termina con código de salida:
#    0  si TODO pasó (sintaxis + banco con EXIT real 0)
#    1  si algo falló
#    2  si el entorno no permite correr (falta node)
#
#  Convención del repo — EXIT REAL verificado, nunca asumido:
#      node tests/runner.js > log 2>&1; echo EXIT=$?
#  Cada comando de este script captura su salida y su código de salida en la
#  línea siguiente a su ejecución; el resumen solo da VERDE con EXIT=0 real.
#
#  La fecha de los logs es la fecha UTC (date -u): el cron corre en UTC y así el
#  nombre del directorio coincide con la noche del cron aunque la máquina esté
#  en Colombia (UTC-05:00) y sean las 21:17 de la víspera.
#
#  CRON SUGERIDA (línea para crontab):
#      17 2 * * *  cd /ruta/al/repo && bash .deepseek/run-nightly-checks.sh
#  Por qué el minuto 17 y no las 02:00 en punto:
#    - La mayoría de los crons corporativos y del sistema corren en el minuto 0
#      de la hora; arrancar a la vez multiplica contención de disco/CPU y hace
#      los tiempos de las pruebas (micro-bench p50/p95 de suite_94) menos
#      estables y menos comparables entre noches. Un minuto no redondo (17)
#      evita la colisión sin más coste.
#    - 02:17 UTC son las 21:17 de la víspera en Colombia (UTC-05:00): el
#      consultorio lleva horas cerrado y el médico no está en consulta, así que
#      el banco corre sin competir con el uso EN VIVO del userscript. El log de
#      la noche queda fechado con el día UTC del cron.
#    - La corrida es local y pesada (~3.700 comprobaciones): no se programa en
#      horario de consulta (06:00-12:00 y 14:00-18:00 Colombia) ni cerca de los
#      refrescos programados de agenda (06:00/12:00 Bogotá).
#
#  POLÍTICA DE RAMAS POR CAMBIO:
#      <agente>/<mejora>-<YYYY-MM-DD>   (p. ej. bolt/memo-tick-2026-09-08)
#  Cada corrección de un agente nocturno viaja en su propia rama dedicada, con
#  UN commit por cambio (un cambio = una mutación verificada = una fila en
#  tests/INFORME_MUTACIONES.md), para que la reversión en 7 días sea un
#  `git revert` limpio del commit exacto. Este script NO ejecuta git: solo
#  verifica; el orquestador commitea.
# =============================================================================
set -u

# --- Resolución de rutas (el script puede invocarse desde cualquier directorio)
DEEPSEEK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$DEEPSEEK/.." && pwd)"
US_ARCHIVO="$RAIZ/vigilante_agenda.user.js"

# --- Fecha y directorio de logs (UTC, ver cabecera)
FECHA="$(date -u +%Y-%m-%d)"
DIR_LOG="$DEEPSEEK/logs/$FECHA"
mkdir -p "$DIR_LOG"
# Un RESUMEN.md de una corrida anterior (o interrumpida) nunca debe pasar por el de hoy
rm -f "$DIR_LOG/RESUMEN.md"

# --- Filtro opcional de suite (misma semántica que el argv del runner)
FILTRO="${1:-}"

INI_EPOCA="$(date +%s)"
INICIO="$(date -u +%H:%M:%S) UTC"
VERDES=0
ROJOS=0

# Salida humana en vivo + registro en el resumen
nota() { printf '%s\n' "$*"; }

# -----------------------------------------------------------------------------
# correr <nombre> <etiqueta_visible> -- comando [args...]
#   Vuelca la salida completa a $DIR_LOG/<nombre>.log, anota el EXIT REAL de la
#   línea siguiente a la ejecución y pinta una línea de estado en vivo.
# -----------------------------------------------------------------------------
correr() {
  local nombre="$1"; shift
  local etiqueta="$1"; shift
  local log="$DIR_LOG/$nombre.log"
  local exit_real
  "$@" > "$log" 2>&1
  exit_real=$?                       # EXIT real, leído justo después de correr
  if [ "$exit_real" -eq 0 ]; then
    VERDES=$((VERDES + 1))
    printf '  [OK]  %s (EXIT=%s)\n' "$etiqueta" "$exit_real"
  else
    ROJOS=$((ROJOS + 1))
    printf '  [FALLA] %s (EXIT=%s) — detalle: %s\n' "$etiqueta" "$exit_real" "$log"
  fi
  echo "$etiqueta|$exit_real|$log" >> "$DIR_LOG/.estado_noche"
}

echo ""
echo "═ Chequeo nocturno del Vigilante — $FECHA ($INICIO) ═"
echo "  raíz:        $RAIZ"
if [ -n "$FILTRO" ]; then
  echo "  filtro:      banco limitado a suites que contengan '$FILTRO' (solo diagnóstico)"
fi
echo "  logs:        $DIR_LOG"
echo ""
: > "$DIR_LOG/.estado_noche"

# --- 1. Entorno --------------------------------------------------------------
if ! command -v node > /dev/null 2>&1; then
  echo "ERROR: no se encontró 'node' en el PATH. Chequeo nocturno abortado." >&2
  echo "### RESUMEN NOCTURNO — $FECHA" > "$DIR_LOG/RESUMEN.md"
  echo "" >> "$DIR_LOG/RESUMEN.md"
  echo "**VEREDICTO: ENTORNO NO DISPONIBLE** — falta node. Revisar la instalación y volver a correr." >> "$DIR_LOG/RESUMEN.md"
  exit 2
fi
echo "  node: $(node --version 2>/dev/null || echo '?')"
echo ""

# --- 2. Sintaxis del userscript ----------------------------------------------
nota "1/3  Sintaxis del userscript..."
correr "01_sintaxis_userscript" "node --check vigilante_agenda.user.js" node --check "$US_ARCHIVO"

# --- 3. Sintaxis de todos los .js de tests/ -----------------------------------
nota "2/3  Sintaxis de tests/*.js..."
# OJO: los paréntesis son SUBSHELL a propósito — el `exit "$fallo"` de dentro solo
# termina el subshell, no el script (con llaves { } habría matado el chequeo entero).
(
  fallo=0
  for f in "$RAIZ"/tests/*.js; do
    if node --check "$f" > /dev/null 2>&1; then
      printf '  [OK]    %s\n' "$(basename "$f")"
    else
      printf '  [FALLA] %s\n' "$(basename "$f")"
      node --check "$f" 2>&1
      fallo=1
    fi
  done
  exit "$fallo"
) > "$DIR_LOG/02_sintaxis_suites.log" 2>&1
exit_real=$?
if [ "$exit_real" -eq 0 ]; then
  VERDES=$((VERDES + 1))
  printf '  [OK]  sintaxis de tests/*.js (EXIT=%s)\n' "$exit_real"
else
  ROJOS=$((ROJOS + 1))
  printf '  [FALLA] sintaxis de tests/*.js (EXIT=%s) — detalle: %s\n' "$exit_real" "$DIR_LOG/02_sintaxis_suites.log"
fi
echo "sintaxis de tests/*.js|$exit_real|$DIR_LOG/02_sintaxis_suites.log" >> "$DIR_LOG/.estado_noche"

# --- 4. Banco completo --------------------------------------------------------
nota "3/3  Banco de pruebas..."
if [ -n "$FILTRO" ]; then
  correr "03_banco_filtrado_${FILTRO//[^A-Za-z0-9_]/_}" "node tests/runner.js '$FILTRO'" node "$RAIZ/tests/runner.js" "$FILTRO"
else
  correr "03_banco_completo" "node tests/runner.js (banco completo)" node "$RAIZ/tests/runner.js"
fi

# --- Resumen ejecutivo --------------------------------------------------------
FIN_EPOCA="$(date +%s)"
DURACION="$((FIN_EPOCA - INI_EPOCA))s"
{
  echo "# RESUMEN NOCTURNO — $FECHA"
  echo ""
  echo "- Inicio: $INICIO · Duración: $DURACION · Rama/sesión: ver informe del agente"
  echo "- Ejecutado por: \`.deepseek/run-nightly-checks.sh\` (plataforma DeepSeek)"
  if [ -n "$FILTRO" ]; then
    echo "- **OJO: corrida FILTRADA** por '$FILTRO' (solo diagnóstico): el banco completo NO es el de la noche."
  fi
  echo ""
  echo "## Veredicto por chequeo (EXIT real verificado, nunca asumido)"
  echo ""
  echo "| Chequeo | EXIT | Log completo |"
  echo "|---|---|---|"
  while IFS='|' read -r etiqueta exit_real log; do
    echo "| $etiqueta | $exit_real | \`$log\` |"
  done < "$DIR_LOG/.estado_noche"
  echo ""
  echo "## Cómo leer la salida del banco"
  echo ""
  echo "En \`03_*.log\` la línea que manda es: \`comprobaciones : N pasan\` (sin fallos),"
  echo "junto con \`funciones cubiertas: X / Y públicas\`. Una suite fallida se ve como"
  echo "\`✗ <suite> ... N FALLAN\`. El runner sale distinto de cero si algo falla; este"
  echo "script solo da VERDE con EXIT=0 real."
  echo ""
  if [ "$ROJOS" -eq 0 ]; then
    echo "## VEREDICTO FINAL: **VERDE** — $VERDES chequeos OK, 0 fallos. Entrega autorizada a revisión del orquestador."
  else
    echo "## VEREDICTO FINAL: **ROJO** — $ROJOS chequeo(s) con fallo. NO se entrega nada hasta que esté verde."
  fi
} > "$DIR_LOG/RESUMEN.md"

echo ""
echo "──────────────────────────────────────────────────────────────"
if [ "$ROJOS" -eq 0 ]; then
  echo "  VEREDICTO: VERDE — $VERDES chequeos OK, 0 fallos."
  echo "  Resumen ejecutivo: $DIR_LOG/RESUMEN.md"
  echo ""
  exit 0
else
  echo "  VEREDICTO: ROJO — $ROJOS chequeo(s) con fallo. Revisar los logs."
  echo "  Resumen ejecutivo: $DIR_LOG/RESUMEN.md"
  echo ""
  exit 1
fi
