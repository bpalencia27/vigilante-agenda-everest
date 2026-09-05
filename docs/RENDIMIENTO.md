# RENDIMIENTO — v18.3 (P12), 05-sep-2026

Pista B del prompt `06_saneamiento_rendimiento`. Regla B1 que rigió esta pasada:
**nada se optimiza sin medición antes/después** — y la medición de INP real requiere
consultorio (Everest + paciente), no este banco. Por eso este documento verifica los
conteos, diagnostica y deja listo lo medible aquí; NO contiene optimizaciones aplicadas.

## Verificación propia de los conteos (PowerShell sobre la fuente actual)

Los números del prompt eran de v18.0.143; el archivo creció con P9-P13. Conteos de HOY
(v18.3, 51.059 líneas físicas, 3.245 KB):

| Conteo | Prompt (v18.0.143) | Hoy (v18.3) | Verificado con |
|---|---|---|---|
| `GM_getValue`/`GM_setValue` | 119 | **147** | `[regex]::Matches` sobre fuente |
| `localStorage` | 106 | **189** | ídem |
| `JSON.parse`/`JSON.stringify` | 107 | **125** | ídem |
| Líneas de comentario completo | 38,2 % | **34,0 %** (17.348 líneas) | `Get-Content` + filtro `^\s*//` |
| Líneas de código | 58,2 % | 62,4 % (31.850) | ídem |
| Líneas vacías | 3,6 % | 3,6 % (1.861) | ídem |

## Presupuestos (quedan declarados, no instrumentados en consultorio)

- Interacción (clic → pintado): **50 ms**.
- Arranque en frío: **200 ms**.
- Cualquier tarea de fondo: **1 s**.

Telemetría que ya existe y alimenta este tablero: `rum.page.inp.poor`,
`rum.self.inp.poor`, `ux.rage.host`, `pestana.descartada` (cola `vgl_repq`), y desde
P13 el módulo `obs*` da denominador por consulta.

## Diagnóstico B2 — almacenamiento síncrono en el camino del clic

Candidato #1 confirmado por conteo, NO por perfil: 147 accesos GM + 189 `localStorage`
+ 125 parse/stringify. Los `GM_*` viajan puente NPAPI/mensajería del manager y son más
caros que `localStorage`. Riesgos conocidos del camino actual:

- Lecturas repetidas de la misma clave dentro de un mismo handler (sin memo por frame).
- Escrituras de colas/telemetría (`vgl_repq`, tablero P9-P11) dentro del mismo tick
  que el clic pinta la agenda — cada `JSON.stringify` de cola grande entra al INP.
- `S` (ajustes) se persiste entero en cada cambio de un solo flag.

**Qué NO se tocó y por qué (B1):** mover escrituras a `requestIdleCallback`/microtask
o memoizar lecturas cambia el momento en que el estado visible se persiste; sin medición
antes/después en consultorio sería a ciegas. Queda como propuesta priorizada:

1. Medir INP base una semana con `rum.page.inp.poor` ya en producción (existe).
2. Luego, UN cambio: sacar `vgl_repq`/tablero del tick del clic (encolar al idle).
3. Re-medir una semana; comparar; revertir si no mejora.

## B3-B8 (resto del checklist del prompt)

- **B3 selectores:** sin medición de consultorio no hay ranking honesto; el DOM es de
  Everest y el arnés no reproduce su costo real.
- **B4 arranque:** el arranque ya es diferido por diseño (boot silencioso); el conteo
  de trabajo en frío no cambió con P9-P13 más allá del módulo `obs*` (una lectura GM
  de identidad + una huella por pestaña).
- **B5 memoria:** sin evidencia de fuga reportada por telemetría; no se especula.
- **B6 red:** fuera de alcance de esta pasada (sin cargas nuevas).
- **B7 paint/layout:** los estilos nuevos de P9-P13 viven bajo `#vgl-root`; sin
  `!important` añadidos a reglas clase fuera del root (regla del repo respetada).
- **B8 listeners delegados:** los paneles ya usan delegación (`mtrIaClickDelegado` era
  el caso patológico inverso: delegado sin registro — ver SANEAMIENTO.md defecto 1).

## Conclusión de la pasada

Pista B queda en estado **medido-en-conteos, propuesto-en-cambio**: la única decisión
tomada fue la del prompt (no optimizar a ciegas). El saneamiento de Pista A NO era una
optimización de rendimiento y no se presenta como tal: retiró 2 constantes muertas y
marcó 3 funciones — impacto en INP: nulo por diseño.
