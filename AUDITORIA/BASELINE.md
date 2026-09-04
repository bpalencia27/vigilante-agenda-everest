# BASELINE — Arranque del turno de estabilización (PASADA 0)

Fecha: 2026-09-04 · Motor: TraeDesign (sesión con historial 18.0.136 → 18.0.137)
Reglas aplicadas: «Reglas del proyecto — Vigilante de Agenda (v18.x)» (cargadas por el médico).
Nota de vigencia: las reglas citan la v18.0.136 (48.452 líneas); el repo YA está en **18.0.137**
(48.481 líneas, +29 netas del reintento de disco en el bloque ~L32009-32174). Todo rango de línea
posterior a L32009 hereda un desplazamiento de +29 respecto al mapa de las reglas.

## Línea base del banco (evidencia literal)

Comando exacto:

```bash
node tests/runner.js > baseline_137_raw.txt 2>&1; echo "RUNNER_EXIT=$?"
```

Salida literal (cola del reporte):

```
RUNNER_EXIT=0
  comprobaciones : 3226 pasan
  funciones cubiertas: 912 / 1153 públicas  (79.1%)  ·  115 anidadas se prueban a través de sus dueñas

  sin cubrir (241):
    _frGenNueva, _atheneaCredsMigrarDeClaro, atheneaAvisoSilencioso, _conTope, _diaValidoParaMes, _esNumeroParaDesempate
    ... (lista completa en baseline_137_raw.txt, líneas 154-185)
```

- **Banco: VERDE.** 3.226 pasan / 0 fallan. Exit 0. No hay primer hallazgo rojo: se procede.

## El runner: qué recoge y qué ignora

Comando: `grep -n "suite_\|readdir" tests/runner.js | head -5` → L160:

```js
const archivos = fs.readdirSync(__dirname).filter(f => /^suite_.*\.js$/.test(f)).sort()
```

- **Recoge: 79 archivos** `tests/suite_*.js` (confirmado: `ls tests/suite_*.js | wc -l` → `79`).
- **IGNORA** (presentes en `tests/` y NO recogidos por el regex):
  - `_challenger_test.js` — la lección de la Ley 3 sigue viva: el archivo existe y sigue fuera del runner.
  - `repro_hallazgo20b.js` — repro antiguo, fuera del runner (documentado, no requiere acción).
  - `harness.js` — módulo de apoyo importado por las suites (correcto que no corra solo).
  - `fixtures/`, `golden/`, `mutantes/` — datos, no pruebas.
  - `REPORTE-VIGILANTE*.xlsx|.csv` — datos de campo, jamás abrirlos para citar (Ley 6).

## Identidad del artefacto auditado

```bash
grep -n "@version" vigilante_agenda.user.js | head -1   # → 4:// @version      18.0.137
wc -l -c vigilante_agenda.user.js                        # → 48481 3165121
sha256sum vigilante_agenda.user.js                       # → 558721bdc1a68d76de7bb6f6b8525507e05c400b10f28fb7e83b516316f8d4ba
```

Publicación v18.0.137 ya cerrada en esta sesión: commit `2971d63` + registro `24eee20`,
`main` remoto en `24eee20`, Gist verificado byte a byte. **Ningún cambio de código adicional
ha entrado desde la publicación**: el working tree está limpio.

Estado: **COMPLETO** (PASADA 0 cerrada; MAPA.md arrancado en paralelo).
