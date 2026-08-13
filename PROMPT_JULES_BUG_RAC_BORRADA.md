# TAREA — La RAC se borra sola cuando el médico edita Creatinina a mano

> **Cómo se usa:** copia este archivo ENTERO y pégalo como única instrucción en Jules.
> Es autocontenido: no hace falta pegar nada más.

---

## 0. TU PAPEL Y EL LÍMITE DE TU TRABAJO

Eres un ingeniero que hace **una sola tarea acotada** en un repositorio ajeno de producción
clínica. No eres el arquitecto de este proyecto: las decisiones ya están tomadas y **no se
re-litigan**. Esta tarea corrige **pérdida real de un dato clínico ya escrito** — es la más
seria en producción hasta ahora. Tu éxito se mide por cuán exactamente resuelves esto y nada
más, sin tocar ningún otro comportamiento.

---

## 1. CONTEXTO DEL REPOSITORIO

- Repositorio: `vigilante-agenda-everest`.
- Archivo principal: **`vigilante_agenda.user.js`** — userscript de Tampermonkey, IIFE de
  ~11.700 líneas, sin build, sin dependencias.
- Pruebas: `tests/`, sin frameworks. Se corren con **`node tests/runner.js`**.
- **Rama base: `claude/pym-agenda-blindaje-v12-4`**. NUNCA `main`.
- El banco parte de **698 o más**. Tu PR debe terminar con **699 o más**.
- `git fetch origin claude/pym-agenda-blindaje-v12-4` y trabaja desde ahí.

---

## 2. EL PROBLEMA (evidencia real, reproducida DOS VECES en consultorio, dos pacientes)

El médico usa el botón "🧬 Auto-Labs (Athenea)" en la pestaña **Ruta Crónicos**, que escribe
automáticamente los resultados de laboratorio en sus casillas (función
`injectLabsIntoCronicos`, línea ~2262). Entre esas casillas está la **RAC** (Relación
Albuminuria/Creatinina, casilla `input#resultadoRelacionAlbuminaCreatinina`), que el robot
completa igual que las demás — verbatim, solo en casilla vacía (línea 2455).

**El bug:** cuando el médico, DESPUÉS de esa auto-carga, edita a mano la casilla de
**Creatinina EN SUERO** (`input#resultadoCreatinina`, un campo DISTINTO, sin relación
aparente), unos segundos más tarde la casilla de la RAC —que el robot ya había llenado
correctamente— **aparece vacía**. El dato se pierde.

Evidencia capturada en consultorio (grabación de red + clics, PHI ya redactado, sigue en el
repo): `captura_rutacronicos_borrado_rac_20260812.json`. La secuencia relevante:

```
23:46:18.392Z  clic en input#resultadoCreatinina — el médico edita Creatinina a mano
23:46:25.400Z  clic en input#resultadoRelacionAlbuminaCreatinina — la casilla que el
               robot YA había completado aparece VACÍA. Everest la borró sola.
```

Reproducido una segunda vez, en un paciente distinto, mismo disparador exacto (editar
Creatinina a mano → la RAC ya escrita desaparece).

**No hay evidencia de POR QUÉ Everest hace esto** — no se capturó el mecanismo interno (no es
tarea de esta corrección investigar el Angular de Everest, es codigo ajeno y cerrado). Lo que
SÍ hay es un patrón reproducible dos veces: editar Creatinina dispara, en algún momento
posterior, un vaciado de la casilla de RAC. **No inventes la causa** — la solución no depende
de saberla: hace falta **defender el dato**, no perseguir el mecanismo que lo borra.

---

## 3. QUÉ HAY QUE HACER, EXACTAMENTE

### 3.1 El patrón: "guardia" que restaura, no que confronta

Después de que el robot escribe la RAC (línea 2455, dentro del `forEach` de
`candidatosPorClave` en `injectLabsIntoCronicos`), si `matched.key === "RAC"`, arma una
guardia que recuerda **qué valor escribió el robot** para esa casilla.

En el bucle `tick()` que ya existe (línea ~11375, corre cada `CONFIG.POLL_MS` — 5000 ms por
defecto — mientras el médico está en la historia clínica, mismo patrón ya usado para
`createLabInjectorUI()`/`createExamenFisicoInjectorUI()`), añade una comprobación barata: si
hay una guardia activa, relee el valor ACTUAL de la casilla de la RAC:

- Si está **vacía** → Everest la borró: restaura el valor guardado con `setNgValue` y regístralo
  con `console.warn` (para que quede evidencia si vuelve a pasar) y `uxTrack` (para medir cuántas
  veces ocurre esto en producción — dato útil para saber si el patrón real es "solo tras editar
  Creatinina" o más amplio).
- Si tiene el **mismo valor** que se guardó → no hacer nada.
- Si tiene un valor **DISTINTO y no vacío** → el médico la editó a mano de verdad: **apaga la
  guardia inmediatamente y respeta ese valor para siempre**. La guardia existe para defender lo
  que el ROBOT escribió, nunca para pelearle una edición real al médico — esa es la regla más
  importante de esta tarea, viólala y el PR se rechaza aunque todo lo demás esté perfecto.

### 3.2 Cuándo se apaga la guardia

- Al detectar una edición real distinta (3.1).
- Al cambiar de paciente (reutiliza el patrón ya existente de guardas por paciente, como
  `lastAutoFetchedDoc` en `autoFetchAtheneaLabsForActivePatient` — búscalo y sigue exactamente
  ese estilo, una guardia por sesión de "paciente abierto", no algo que sobreviva entre
  pacientes).
- Si la casilla de la RAC deja de existir en el DOM (el médico salió de Ruta Crónicos): no
  revienta, simplemente no hay nada que restaurar ese tick.

### 3.3 Un detalle técnico importante — no pierdas tiempo con esto

`MutationObserver` **NO se dispara** cuando se cambia la propiedad `.value` de un `<input>`
por JavaScript (ni la tuya ni la de Everest) — eso NO es una mutación del DOM en el sentido que
observa `MutationObserver`, es una asignación de propiedad. Por eso la guardia usa el `tick()`
que ya existe (polling barato, no un observer nuevo). No propongas un `MutationObserver` para
esto: no funcionaría y sería tiempo perdido.

---

## 4. LO QUE NO DEBES HACER

1. **NO investigues ni documentes el mecanismo interno de Angular/Everest.** Es código ajeno,
   cerrado, y no es el alcance de esta tarea. La guardia defiende el dato sin necesitar saber
   por qué se borra.
2. **NO apliques esta guardia a ningún otro campo.** Solo a la RAC (`matched.key === "RAC"`).
   Si crees que otros campos podrían tener el mismo problema, repórtalo en el PR como hallazgo,
   no lo arregles aquí — necesita su propia evidencia reproducida, no una suposición.
3. **NO uses `MutationObserver`** para detectar el borrado (ver §3.3).
4. **NO le impidas al médico borrar o editar la RAC de verdad.** La guardia solo restaura
   cuando la casilla queda VACÍA teniendo el valor del robot; una edición real a un valor
   distinto apaga la guardia para siempre en esa sesión de paciente.
5. **NO añadas un intervalo nuevo (`setInterval`) para esto.** Reutiliza el `tick()` existente
   — ya corre cada `CONFIG.POLL_MS` mientras el médico está en la historia clínica; un
   intervalo adicional es CPU quemada en máquinas lentas, justo lo que el proyecto evita.
6. **NO reformatees NADA.** Ni Prettier, ni ESLint `--fix`, ni reordenar funciones.
7. **NO añadas dependencias**, ni build, ni TypeScript.
8. **NO toques ningún otro archivo** salvo `vigilante_agenda.user.js`, el archivo de pruebas
   donde añadas casos, y `tests/INFORME_MUTACIONES.md`.
9. **NO borres ni debilites ninguna prueba existente.**
10. **NO incluyas ningún dato real de paciente.** Usa datos inventados evidentes.
11. **NO hagas ninguna petición de red real** en las pruebas — mocks, como las suites
    existentes.

---

## 5. PRUEBAS (obligatorio)

Casos mínimos:

1. El robot escribe RAC en una casilla vacía → la casilla queda vacía por causas externas (
   simula `el.value = ""` como haría Everest) → el siguiente `tick()` la restaura al valor
   original, con `setNgValue` (verifica que dispare `input`/`change`, mismo patrón que las
   demás pruebas de `setNgValue` en el repo).
2. El médico edita la RAC a un valor DISTINTO y no vacío después de que el robot la escribió →
   el siguiente `tick()` **NO** la toca, y una prueba posterior confirma que la guardia quedó
   apagada (vacía la casilla otra vez a propósito y verifica que YA NO se restaura — la guardia
   murió con la edición real).
3. Cambio de paciente → la guardia del paciente anterior no interfiere con el nuevo (sin falsos
   positivos de restaurar un valor de OTRO paciente).
4. La casilla de la RAC no existe en el DOM en ese tick (el médico cambió de pestaña) → no
   revienta, no hace nada.

### Prueba de mutación (obligatoria)

Rompe tu propio cambio (por ejemplo, haz que la guardia se apague también cuando el valor
vuelve vacío, en vez de solo restaurar) y confirma que una prueba TUYA cae. Restaura y confirma
verde. Transcribe qué línea rompiste y qué prueba lo detectó.

---

## 6. QUÉ DEBE CONTENER TU PR (formato obligatorio)

```markdown
## 1. Qué cambié
(funciones nuevas/tocadas, con línea)

## 2. Salida COMPLETA del runner
(pegar entera, incluida la línea de resumen final)

## 3. Pruebas nuevas
(nombre de cada caso y qué comprueba)

## 4. Mutación aplicada
(qué línea rompiste, qué prueba cayó, confirmación de que restauraste)

## 5. Verificación de alcance
(git diff --stat contra la rama base; confirma que la guardia SOLO aplica a la RAC)

## 6. Hallazgos NO tocados
(si sospechas que el mismo problema afecta a otro campo, dilo aquí, no lo arregles)
```

---

## 7. AUTOVERIFICACIÓN ANTES DE ABRIR EL PR

1. ¿El banco está en 699 o más, en verde?
2. ¿La guardia SOLO existe para la RAC, ningún otro campo?
3. ¿Probaste que una edición REAL del médico apaga la guardia para siempre (no solo la
   ignora una vez)?
4. ¿Usaste el `tick()` existente, sin `MutationObserver` ni `setInterval` nuevo?
5. ¿Rompiste tu cambio y viste una prueba TUYA en rojo?
6. ¿Hay algún dato de paciente real en algún sitio? (Debe ser no.)

---

## 8. SI TE ATASCAS

- **¿No encuentras `tick()` o `CONFIG.POLL_MS`?** Búscalos por esos nombres exactos, no
  inventes un mecanismo de refresco distinto.
- **¿No estás seguro de si un valor cambiado es "el médico editó" o "Everest lo alteró
  parcialmente"?** Tratar cualquier valor no vacío y distinto del guardado como edición real
  del médico es la opción segura — nunca proponer heurísticas para adivinar la intención.

**Regla final:** ante cualquier duda, el cambio más pequeño que defiende el dato sin pelearle
nada al médico es el correcto.
