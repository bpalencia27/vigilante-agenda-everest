# PASADA 1 — Contratos: objeto literal devuelto vs consumidores (Ley 2)

Fecha: 2026-09-04 · Artefacto: `vigilante_agenda.user.js` v18.0.137 (48.481 líneas).
Método: `grep -n` + ventanas `sed -n` (Ley 8). Techo de lectura respetado.

## Contrato 1 — `mtrRecalcularConFactores` (regla histórica: 4 pérdidas de campos)

**Definición (grep):** `function mtrRecalcularConFactores` → **L36014**.

Contrato verificado: devuelve un objeto resumen recalculado con **fusión tri-estado**
(`null` = sin dato / `false` = negativo explícito / valor de pantalla). La regla de las
reglas (Ley 2) exige verificar el contrato EN EL CONSUMIDOR, no en la definición.

### Consumidor A — tick del panel (L26124)

```bash
sed -n '26121,26125p' vigilante_agenda.user.js
```

```js
const factores = mtrPanelFactoresDePantalla(apt.doc_id, document);
if (!factores) return;
const nuevo = mtrRecalcularConFactores(_resumen, factores, todayStamp());
if (!nuevo) return;
```

Dictamen: el consumidor **tolera** el retorno falsy con `if (!nuevo) return` antes de
tocar el DOM (y una línea antes, `if (!factores) return` protege también la entrada).
Arriba del bloque, el comentario v18.0.33 documenta la guarda explícita de firma
(`if (!ahora || ahora === _firma) return`). **Contrato respetado. No hay pérdida de
campos en esta vía.**

### Consumidor B — `mtrPanelResumenAlAbrir` (L36195)

```bash
sed -n '36195,36201p' vigilante_agenda.user.js
```

```js
function mtrPanelResumenAlAbrir(resumenCacheado, factoresActuales, hoyIso) {
  if (!resumenCacheado) return null;
  try {
    const recalculado = mtrRecalcularConFactores(resumenCacheado, factoresActuales, hoyIso);
    return recalculado || resumenCacheado;
  } catch (e) { return resumenCacheado; }
}
```

Dictamen: doble defensa — try/catch alrededor del recálculo **y** fallback al resumen
cacheado si el recálculo devuelve falsy (`recalculado || resumenCacheado`). Nunca deja
la pantalla sin resumen. **Contrato respetado.**

**Veredicto P1-1: SIN HALLAZGO.** Las 4 pérdidas históricas de campos documentadas en las
reglas están cubiertas por las dos vías de consumo actuales (guarda de null + fallback).

## Contrato 2 — Módulo de disco (nuevo en 136/137, nunca auditado)

Cadena contractual verificada con citas (ventanas L32195-32340):

| Eslabón | Línea | Contrato observado |
|---|---|---|
| `_vglDiscoEscribirMdAhora(docId, registro)` | L32197 | devuelve `true/false`; `registro` opcional (lee cosecha si falta) |
| `_vglDiscoProgramar(clave, accion)` | L32212 | debounce `VGL_DISCO_DEBOUNCE_MS` (L32009 = **4000 ms**); al disparar borra su entrada del Map y ejecuta `accion()` con try/catch |
| `vglDiscoMemoriaProgramar()` | L32223 | acción: `if (!vglCarpetaElegida()) return;` → `_vglDiscoMemoriaEscribirAhora().catch(() => {})` |
| `vglDiscoHistoriaProgramar(docId)` | L32228 | idem, escribe `.md` del día del paciente |
| `_vglDiscoMemoriaEscribirAhora()` | L32237 | revalida `vglCarpetaElegida()` ANTES de escribir; devuelve bool |
| `vglDiscoRescatarCosecha(id, fusion, todo)` | L32250 | rescate de cuota: corre YA (sin debounce), revalida carpeta |
| `_vglDiscoMemoriaRestaurar()` | L32268 | fusión por registro, gana el `ts` mayor (ver P5, hallazgo b) |
| `vglDiscoMigrar()` | L32315 | UNA sola vez (candado `VGL_DISCO_MIGRADO_KEY` antes de escribir), tope `slice(0, VGL_COSECHA_MAX_PACIENTES)` |

Dictamen del contrato escritor: **todos los escritores revalidan la carpeta elegida al
momento de escribir** (se programa con retardo, se lee el estado AL DISPARAR — el propio
comentario de L32210 lo declara y el código lo cumple). El contrato interno es coherente.

La excepción contractual detectada NO es entre escritor y programador, sino entre el
**kill-switch y el módulo disco**: la acción del debounce revisa `vglCarpetaElegida()`
pero jamás `state.killed` (verificado: `grep -c "state.killed"` en L31950-32500 → `0`).
Ese dictamen corresponde a PASADA 5, hallazgo (a).

**Veredicto P1-2: SIN HALLAZGO de contrato roto en el módulo disco** (el hueco de
kill-switch se dictamina en P5 y queda en COLA_FUTURO).

## Contrato 3 — `injectLabsIntoCronicos` (L3402, objeto literal grande)

```bash
sed -n '3403,3407p' vigilante_agenda.user.js
```

```js
if (state.killed) {
    return { count: 0, pendientes: 0, sinCasilla: [], respetadas: 0, uroanalisisMarcado: false,
             implausibles: [], obligatoriasVacias: [], abortadoPorKillSwitch: true };
}
```

Dictamen: el retorno abortado **conserva la forma completa** del objeto (mismas claves
que el camino feliz + `abortadoPorKillSwitch: true`), así ningún consumidor revienta por
desestructurar un campo ausente. Patrón correcto, citado como referencia de cómo debería
comportarse todo retorno abortado.

Estado: **COMPLETO** — 3 contratos verificados, 0 hallazgos de contrato roto.
