# INFORME FINAL — Auditoría de estabilización v18.0.137 (PASADAS 0-6)

Fecha: 2026-09-04 · Sesión: TraeDesign, ejecutada de principio a fin según las
«Reglas del proyecto — Vigilante de Agenda (v18.x)».
Artefacto: `vigilante_agenda.user.js` **v18.0.137** — **SIN CAMBIOS** (48.481 líneas,
3.165.121 bytes, sha256 `558721bd...16f8d4ba`, idéntico al publicado).

**Resultado en una línea:** siete pasadas completas, cero hallazgos S0/S1, dos
hallazgos S3 confirmados esperando su decisión, nada roto, nada arreglado, todo
documentado con cita verificable.

---

## 1. Lo que encontré

**Cero defectos que rompan la clínica hoy.** Los cinco frentes auditados salieron
limpios o con hallazgos menores:

- **Contratos internos (P1):** `mtrRecalcularConFactores` —la función con historia de
  «4 pérdidas de campos»— está bien consumida en sus dos vías: el vigilante de 20 s
  corta con `if (!nuevo) return` y la apertura del panel cae al caché si el recálculo
  falla. El módulo de disco (nuevo, nunca auditado) cumple su contrato interno:
  revalida la carpeta elegida al momento de escribir.
- **Ciclo de vida (P2):** los 14 temporizadores del arranque están registrados y el
  apagado de emergencia los mata a todos; el reloj de segundo plano se apaga por
  completo; el supuesto temporizador «zombi» del watchdog es inofensivo (su primera
  línea lo desactiva solo). 237 listeners revisados por bloques: los que sobreviven
  al apagado están protegidos por la guarda `state.killed`.
- **Rendimiento (P3):** los barridos de pantalla por ciclo tienen tope duro (máximo
  400 nodos); la trampa VLDL/LDL sigue protegida; el único barrido completo del DOM
  solo ocurre cuando usted descarga un diagnóstico a propósito.
- **Seguridad (P4):** las 46 interpolaciones de HTML dinámico llegan TODAS escapadas
  o son literales. Ningún dominio autorizado (`@connect`) recibe PHI fuera del canal
  propio de la IPS: la telemetría sale con triple filtro, el prompt de IA pasa por el
  saneador de texto libre, el Gist solo se consulta (no se envía nada), y SharePoint
  solo descarga la base PyM.
- **Barrido PHI del repositorio (P4):** 159 coincidencias de patrones sensibles,
  revisadas una a una (enmascaradas, sin imprimir ningún valor): todas son datos
  sintéticos de las pruebas, fechas técnicas o identificadores de ruta. **Cero PHI
  real en el repositorio.**

## 2. Lo que arreglé

**Nada. Y es la noticia buena.** Las reglas solo permiten arreglar en la PASADA 6 lo
que sea S0/S1 confirmado, y no apareció ninguno. El userscript queda exactamente como
estaba publicado: sin cambio de versión, sin Gist, sin riesgo nuevo. Lo único que se
escribió fueron estos documentos de auditoría.

## 3. Lo que descarté y por qué

- **Migración al disco lenta (`await` uno por uno):** es a propósito — corre una sola
  vez en la vida del navegador, con candado contra repeticiones y tope de 80
  pacientes. Diseño, no defecto (P5-c).
- **Temporizador «zombi» del watchdog del reloj:** nunca se cancela, pero tras el
  apagado su primera línea (`if (!_reloj.ok || !_reloj.worker ...) return false`) lo
  vuelve inofensivo para siempre. No revive nada (P2).
- **`innerHTML +=` en el aviso de datos incompletos (L28285):** el contenido está
  escapado, es condicional y corre fuera de bucles. Sin riesgo; quedó nota de estilo (P5-d).
- **Las 46 interpolaciones HTML dinámico:** trazadas una a una hasta su origen; todas
  pasan por `escapeHtml` o interpolan números/literales. Ningún vector de inyección (P4).
- **Deriva de inventarios vs el mapa de las reglas (+12 listeners, +7 intervalos):**
  crecieron con el módulo de disco y los banners PyM; los nuevos están en contenedores
  propios que el apagado borra, o registrados en `state.timers`. Sin fuga.

## 4. Lo que quedó en cola (espera SU decisión — `COLA_FUTURO.md`)

1. **Hallazgo A:** el apagado de emergencia no cancela una escritura espejo que pueda
   estar esperando; podría salir una última escritura local hasta 4 s después del
   apagado. Local, única, sin red. Opciones: arreglar (3 líneas) / dejarlo y
   documentarlo / juntarlo con B / pedir reproducción en prueba.
2. **Hallazgo B:** la recuperación de memoria confía en `vgl_cosecha.json` sin tope de
   registros y la fusión la gana cualquier fecha, aunque esté manipulada o corrupta.
   Opciones: tope + rechazo de fechas futuras / solo tope / dejarlo / probar primero.
3. **Nota D:** refactor de estilo del `innerHTML +=` (sin urgencia).

Ninguno se arregló sin su voz: la clínica se reporta con opciones, no se decide.

## 5. Verificación en campo (en lenguaje llano)

- **¿Tiene que hacer algo ahora?** No. La versión que tiene instalada (18.0.137)
  sigue siendo la vigente y correcta. No hay nada que actualizar ni que revertir.
- **¿Cambió algo en su computador o en la agenda?** No. Esta auditoría solo leyó
  código y corrió pruebas en un entorno aislado; el userscript no se modificó.
- **¿Cómo sé que no rompí nada?** El banco de pruebas se corrió al empezar (3.226
  pruebas, 0 fallas) y al terminar (3.226 pruebas, 0 fallas, mismo exit 0 y mismo
  hash del archivo). Idéntico antes y después.
- **¿Y la memoria de sus pacientes?** Intacta. No se tocó ningún dato; el barrido PHI
  revisó el código y las pruebas del repositorio, nunca datos reales (los reportes de
  campo xlsx/csv ni se abrieron).
- **Cuándo volver a mirar esto:** cuando decida las opciones de los hallazgos A y B
   en `COLA_FUTURO.md`. Con su decisión, el arreglo entra por el circuito completo
   (prueba roja → parche → banco verde → mutación) y esa versión sí se publicaría en
   GitHub y Gist.

---

**Constancia del banco final (comando y salida):**

```bash
node tests/runner.js > final.txt 2>&1; echo "RUNNER_EXIT=$?"
# RUNNER_EXIT=0
# comprobaciones : 3226 pasan
# funciones cubiertas: 912 / 1153 públicas  (79.1%)
```

Documentos de esta auditoría: `BASELINE.md`, `MAPA.md`, `P1_CONTRATOS.md`,
`P2_CICLO_VIDA.md`, `P3_RENDIMIENTO.md`, `P4_PHI_SEGURIDAD.md`, `P5_REFUTACION.md`,
`COLA_FUTURO.md`, `baseline_137_raw.txt`.
