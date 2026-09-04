# PASADA 3 — Rendimiento: barridos DOM, mayúsculas, await en bucles, innerHTML en bucle

Fecha: 2026-09-04 · Artefacto: `vigilante_agenda.user.js` v18.0.137 (48.481 líneas).
Método: `grep -n` + ventanas `sed -n` (Ley 8). Alcance dictaminado: rutas calientes
(tick 5 s, vigilancia de panel 20 s, módulo disco) según techo de lectura.

## 1. Riesgo VLDL/LDL (regla histórica del mapa) — PROTEGIDO

```bash
sed -n '1230p' vigilante_agenda.user.js
```

```js
{ key: "COLESTEROL_LDL", names: ["COLESTEROL LDL", "COLESTEROL DE BAJA DENSIDAD", "LDL INMUNOLOGICO", "LDL DIRECTO"], excluye: ["VLDL", "MUY BAJA DENSIDAD"], codes: ["2014", "903817", "903816"], ... },
```

El comentario de L1227-1229 documenta la trampa: «"VLDL DIRECTO" contiene "LDL DIRECTO"
como subcadena y sin esta guarda caería aquí». La lista `excluye` está viva en la
definición. **Sin regresión.**

## 2. Mayúsculas sostenidas

```bash
grep -c "toUpperCase()" vigilante_agenda.user.js   # → 62
```

62 usos. Muestreo de rutas calientes: se aplican sobre cadenas cortas (rótulos de
laboratorio, cabeceras), no sobre `innerText` de contenedores grandes. Sin patrón de
mayusculización de la historia clínica completa por tick. **Sin hallazgo.**

## 3. Selectores sin ancla `vgl-`

```bash
grep -c "querySelectorAll(" vigilante_agenda.user.js                    # → 75
grep -n "querySelectorAll(" vigilante_agenda.user.js | grep -vc "vgl"    # → 41
```

41 selectores sin prefijo propio. Dictamen por familias:
- **Anclados a clases/ids del ANFITRIÓN** (`.labelHora`, `.card`, `.status-label`...):
  correctos por diseño — leen la página de Everest, no el DOM propio.
- **Con tope duro** en la cabecera leída por ciclo (L5584, cita literal):

```bash
sed -n '5584p' vigilante_agenda.user.js
```

```js
try { nodos = Array.prototype.slice.call(d.querySelectorAll("span,div,label,b,strong,p,td"), 0, 400); } catch (e) { nodos = []; }
```

  El comentario de L5582-5583 declara la intención: «así no se barre la historia
  entera en cada ciclo». Máximo 400 nodos por barrido.

- **El único `querySelectorAll("*")`** (L34346) vive en `downloadDiagnostic()`:

```bash
sed -n '34346p' vigilante_agenda.user.js
```

```js
const freq = {}; ddoc.querySelectorAll("*").forEach((n) => (n.classList ? [...n.classList] : []).forEach((c) => (freq[c] = (freq[c] || 0) + 1)));
```

  Censo de clases para el reporte de diagnóstico: corre UNA VEZ y SOLO cuando el médico
  descarga el diagnóstico (gesto explícito), jamás en tick. **Benigno.**

## 4. `await` dentro de bucles

Contexto: 242 bucles `for (const ... of ...)` en el archivo (grep de contexto). En las
zonas auditadas, el único `await` serializado en bucle es la migración de disco:

```bash
sed -n '32326,32329p' vigilante_agenda.user.js
```

```js
const claves = Object.keys(todo || {}).slice(0, VGL_COSECHA_MAX_PACIENTES);
let escritos = 0;
for (const k of claves) {
  try { if (await _vglDiscoEscribirMdAhora(k, todo[k])) escritos++; } catch (e1) {}
```

Dictamen: **by design** — corre una sola vez por vida del navegador (candado
`VGL_DISCO_MIGRADO_KEY` marcado ANTES de escribir, idempotente), tope 80 pacientes,
fuera de toda ruta periódica. Ver P5 hallazgo (c) para la refutación completa.
Las rutas periódicas (tick, panel 20 s, debounces de disco) no esperan en bucle.

## 5. `innerHTML` en bucle / concatenación `+=`

Inventario de la PASADA 4 (ver `P4_PHI_SEGURIDAD.md`): 5 sitios `innerHTML +=`
(27837, 28285, 28296, 28548, 36504). Cuatro son COMENTARIOS que documentan bugs ya
arreglados (v18.0.121). El único vivo es L28285, fuera de bucle y condicional.
**Ningún `innerHTML` dentro de bucle en las rutas auditadas. Sin hallazgo.**

Estado: **COMPLETO** — 0 hallazgos de rendimiento. El archivo es grande (48.481 líneas)
pero los barridos por ciclo están acotados (≤400 nodos) y las escrituras seriales
están confinadas a la migración única.
