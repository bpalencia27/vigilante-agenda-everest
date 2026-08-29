const fs = require("fs");
const path = require("path");
const code = fs.readFileSync("/workspace/vigilante_agenda.user.js", "utf8");

let css = "";
let inCss = false;
for (const line of code.split('\n')) {
  if (line.includes('style.textContent = `')) { inCss = true; continue; }
  if (inCss && line.includes('`;')) { inCss = false; break; }
  if (inCss) css += line + '\n';
}
const cssClean = css.replace(/\/\*[\s\S]*?\*\//g, '');
const reglasCss = [];
const blockRegex = /([^{}]+)\{([^{}]+)\}/g;
let m;
while ((m = blockRegex.exec(cssClean)) !== null) {
  const selectorsStr = m[1];
  const blockStr = m[2];
  if (selectorsStr.includes('@media') || selectorsStr.includes('@keyframes')) continue;
  const decls = blockStr.split(';').map(p => p.trim()).filter(p => p.includes(':'));
  reglasCss.push({ selector: selectorsStr.trim(), decls });
}

// ---- Regla E ----
const paneles = ['#vgl-pym-modal', '#vgl-pes-modal', '#vgl-labs-modal', '#vgl-labsv-modal', '#vgl-postcita-panel', '#vgl-agendar-modal', '#vgl-ordenar-modal'];
const infracciones = new Set();
for (const r of reglasCss) {
  if (paneles.some(p => r.selector.includes(p))) {
    if (r.selector.includes(':where(')) continue;
    for (const cd of r.decls) {
      if (!cd.includes('!important')) {
        const normSel = r.selector.trim().replace(/\s+/g, ' ');
        const normDecl = cd.replace(/\s+/g, '');
        infracciones.add(`${normSel}|${normDecl}`);
      }
    }
  }
}
console.log("REGLAS_E count:", infracciones.size);
Array.from(infracciones).sort().forEach(x => console.log("  ", JSON.stringify(x)));

// ---- Regla G ----
console.log("REGLAS_G literal12:", (css.match(/font-size: *12px(?![0-9.])/g) || []).length);
console.log("REGLAS_G literal14:", (css.match(/font-size: *14px(?![0-9.])/g) || []).length);
console.log("REGLAS_G literal16:", (css.match(/font-size: *16px(?![0-9.])/g) || []).length);
const clasesTL1 = /\.(vgl-agm-[\w-]+|vgl-ord-[\w-]+|vgl-postcita-sub)\s*\{[^}]*font-size:\s*1[23]\.5px/g;
console.log("REGLAS_G TL1 sin migrar:", (css.match(clasesTL1) || []).length);
