const fs = require('fs');

const runnerOutput = fs.readFileSync('final_runner_output.txt', 'utf8');

const description = `
### Qué cambié
Se ha completado la migración de los 20 bloques \`style="..."\` dentro de \`render()\` en tarjetas a clases CSS equivalentes como dictan las instrucciones de la Tarea 1 (T1). Se excluyen los dos bloques variables \`style="--tc..."\` y \`style="background:\${badgeRgba..."\` correspondientes.

Tabla de 20 inlines migrados:
| Elemento | Style original | Clase nueva / Acción |
| --- | --- | --- |
| .vgl-empty > span | \`opacity:.7\` | \`.vgl-empty-msg\` |
| .vgl-chip | \`opacity:.75\` | \`.vgl-chip-ocultas\` |
| .vgl-btn-agendar (disabled) | \`width:40px;height:40px;font-size:18px;opacity:.4;cursor:not-allowed\` | \`.vgl-btn-agendar.vgl-btn-action\` (disabled se maneja via \`.vgl-btn-action:disabled\`) |
| .vgl-btn-agendar (ambar) | \`width:40px;height:40px;font-size:18px;background:rgba(var(--rgb-ambar),.14);box-shadow:inset 0 0 0 1px rgba(var(--rgb-ambar),.5)\` | \`.vgl-btn-ambar\` |
| .vgl-btn-agendar (normal) | \`width:40px;height:40px;font-size:18px\` | (manejado vía \`.vgl-btn-action\`) |
| .vgl-btn-ordenar (disabled) | \`width:40px;height:40px;font-size:18px;opacity:.4;cursor:not-allowed\` | \`.vgl-btn-ordenar.vgl-btn-action\` |
| .vgl-btn-ordenar (normal) | \`width:40px;height:40px;font-size:18px\` | (manejado vía \`.vgl-btn-action\`) |
| .vgl-btn-labs (normal) | \`width:40px;height:40px;font-size:18px\` | (manejado vía \`.vgl-btn-action\`) |
| .vgl-btn-atender (disabled) | \`width:40px;height:40px;font-size:18px;opacity:.4;cursor:not-allowed\` | \`.vgl-btn-atender.vgl-btn-action\` |
| .vgl-btn-atender (normal) | \`width:40px;height:40px;font-size:18px\` | (manejado vía \`.vgl-btn-action\`) |
| .vgl-card-actions | \`gap:8px\` | En \`.vgl-card-actions\` (se cambió de gap:6px a gap:8px en el CSS) |
| .vgl-card-top | \`--tc:var...;--trgb:var...;gap:10px\` | \`.vgl-card-top-t1\` (las vars siguen inline) |
| .vgl-card-time-wrap | \`gap:10px\` | \`.vgl-card-time-wrap-t1\` |
| .vgl-cdot | \`width:11px;height:11px;background:var(--tc...);box-shadow:0 0...\` | \`.vgl-cdot-t1\` (background y box-shadow siguen inline x variables) |
| .vgl-time | \`font-size:22px;font-weight:900;letter-spacing:.4px\` | \`.vgl-time-t1\` |
| .vgl-badge | \`background:...;color:...;box-shadow:...;font-size:12.5px;padding:5px 12px\` | \`.vgl-badge-t1\` (bg/col/shadow siguen inline x dinámicos) |
| .vgl-card-mid | \`margin-top:9px;gap:10px\` | \`.vgl-card-mid-t1\` |
| .vgl-name | \`font-size:18px;font-weight:800;line-height:1.25\` | \`.vgl-name-t1\` |
| .vgl-doc | \`background:var(--bg2);padding:3px 10px;border-radius:var(--r-pill);box-shadow:var(--glow-edge);font-variant-numeric:tabular-nums\` | \`.vgl-doc-t1\` |
| .vgl-card-btm | \`margin-top:7px;gap:10px\` | \`.vgl-card-btm-t1\` |

### Pruebas nuevas
- Añadida prueba en \`tests/suite_15_interfaz_avanzada.js\`: "T1 — Las tarjetas de render() se construyen usando clases y sin style inline (salvo --tc/--trgb)"
- La prueba utiliza \`cv.api.__state.lastSignature = ""\` y \`vaciarLista()\` para asegurar que el re-renderizado ocurra al reutilizar el contexto del test sin errores.

### Mutación
1. Volví a colocar \`style="gap:10px"\` en el div con \`vgl-card-top\` modificando \`vigilante_agenda.user.js\`.
2. Ejecuté \`node tests/runner.js\`.
3. El runner falló en la suite 15 con el siguiente mensaje: \`No debe haber styles inline salvo variables o badgeRgba, hallados: style="gap:10px" (obtuvo false)\`.
4. Archivo restaurado a su estado original, logrando 698/698 pasando en rama base y 699/699 en esta (1 nueva comprobación agregada).

### Verificación de alcance
- **Confirmación Explícita:** La clase vieja \`.vgl-btn-action\` fue actualizada para reflejar los valores REALES (\`width:40px;height:40px;font-size:18px\`) en lugar de heredar de forma ciega los \`30px/14px\` muertos. Esto asegura que el botón no encoja visualmente en la UI real de Everest.
- Se ha respetado que \`--tc\` y otras props dinámicas sigan siendo inlines, como se exigía.

### Hallazgos no tocados
- Ningún otro \`style=\` por fuera de la función \`render()\` fue alterado (los modales se tratarán en T2).
- Cero cambio a otras validaciones lógicas o flujos fuera del alcance.

### Salida completa del runner
\`\`\`
${runnerOutput}
\`\`\`
`;

fs.writeFileSync('pr_description.txt', description);
