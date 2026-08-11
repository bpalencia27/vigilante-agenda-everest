const fs = require("fs");
const path = require("path");
const os = require("os");
const comp = require("../tools/comparar_fuentes.js");

module.exports = {
  nombre: "Comparador de fuentes",
  cubre: [], // Tool test, doesn't cover API functions
  async pruebas(t) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vgl-comp-"));
    const pathA = path.join(tmpDir, "A.user.js");
    const pathB = path.join(tmpDir, "B.user.js");

    try {
      const srcA = `// @version 1.0.0\nfunction comun() {}\nfunction soloA() {}\nconst asincrona = async () => {};\n`;
      const srcB = `// @version 1.1.0\nfunction comun() {}\nfunction soloB() {}\nconst flecha = (a, b) => { return a+b; };\nconst asincrona = async () => {};\n`;

      fs.writeFileSync(pathA, srcA);
      fs.writeFileSync(pathB, srcB);

      let res;
      t.caso("Compara dos archivos de juguete y detecta diferencias", () => {
        res = comp.compararFuentes(pathA, pathB);
        t.igual(res.a.version, "1.0.0");
        t.igual(res.b.version, "1.1.0");

        t.cierto(res.compartidas.includes("comun"), "Ambos tienen comun");
        t.cierto(res.compartidas.includes("asincrona"), "Ambos tienen asincrona");

        t.cierto(res.soloA.includes("soloA"), "soloA está en A");
        t.falso(res.soloA.includes("soloB"), "soloB no está en A");

        t.cierto(res.soloB.includes("soloB"), "soloB está en B");
        t.cierto(res.soloB.includes("flecha"), "flecha está en B");
        t.falso(res.soloB.includes("soloA"), "soloA no está en B");
      });

    } finally {
      if (fs.existsSync(pathA)) fs.unlinkSync(pathA);
      if (fs.existsSync(pathB)) fs.unlinkSync(pathB);
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
    }
  }
};
