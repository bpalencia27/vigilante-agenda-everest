// =====================================================================
//  VERIFICACIÓN EMPÍRICA EN CHROMIUM — v18.0.53
//
//  El cartel del kill-switch remoto (#vgl-pausa-clinica) estaba dentro del grupo de CSS
//  que el "modo oculto" apaga. Con el modo oculto heredado de una sesión anterior —que
//  sobrevive recargas, por diseño—, el kill-switch se activaba EN SILENCIO TOTAL: el reloj
//  se paraba, la interfaz se borraba, y el único aviso que lo delataba lo escondía nuestra
//  propia hoja de estilos.
//
//  CLAUDE.md exige comprobar toda regla de color/visibilidad nueva contra el CSS REAL en
//  Chromium, no contra una copia recortada a mano. Este programa hace exactamente eso, con
//  el mismo método de extracción de tools/verificar_color_chromium.js.
// =====================================================================
const fs = require("fs");
const { chromium } = require("playwright");

const code = fs.readFileSync("/home/user/vigilante-agenda-everest/vigilante_agenda.user.js", "utf8");
let css = "", inCss = false;
for (const l of code.split("\n")) {
  if (l.includes("style.textContent = `")) { inCss = true; continue; }
  if (inCss && l.includes("`;")) { inCss = false; break; }
  if (inCss) css += l + "\n";
}
for (const m of css.matchAll(/\$\{_cssSeguro\(\(\) => (\w+)\)\}/g)) {
  const ini = code.indexOf("const " + m[1] + " = `");
  if (ini < 0) continue;
  const desde = ini + ("const " + m[1] + " = `").length;
  css = css.replace(m[0], code.slice(desde, code.indexOf("`;", desde)));
}

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const pag = await nav.newPage();
  await pag.setContent(`<style>${css}</style><body><div id="vgl-pausa-clinica">aviso</div><div id="vgl-root">panel</div></body>`);
  const medir = async (conModoOculto) => {
    await pag.evaluate((v) => { document.body.classList.toggle("vgl-modo-oculto", v); }, conModoOculto);
    return pag.evaluate(() => ({
      pausa: getComputedStyle(document.getElementById("vgl-pausa-clinica")).display,
      root: getComputedStyle(document.getElementById("vgl-root")).display,
    }));
  };
  const sin = await medir(false);
  const con = await medir(true);
  console.log("CSS real extraído: " + css.length + " caracteres\n");
  console.log("SIN modo oculto  → #vgl-pausa-clinica: " + sin.pausa + "   · #vgl-root: " + sin.root);
  console.log("CON modo oculto  → #vgl-pausa-clinica: " + con.pausa + "   · #vgl-root: " + con.root);
  console.log("");
  const ok = con.pausa !== "none";
  const rootOk = con.root === "none";
  console.log(ok
    ? "✓ El cartel de Pausa de seguridad SOBREVIVE al modo oculto: el kill-switch ya no se activa en silencio."
    : "✗ SIGUE OCULTO: el kill-switch se activaría sin que el médico lo vea.");
  console.log(rootOk
    ? "✓ Y el modo oculto sigue haciendo su trabajo con el resto de la interfaz (#vgl-root oculto)."
    : "✗ El modo oculto dejó de ocultar el panel: se rompió lo que sí debía seguir funcionando.");
  await nav.close();
  process.exit(ok && rootOk ? 0 : 1);
})();
