const fs = require("fs");

function encontrarNombresFlecha(src) {
  const nombres = [];
  const cabecera = /\n\s{0,4}(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?/g;
  let m;
  while ((m = cabecera.exec(src))) {
    let i = cabecera.lastIndex;
    let profundidad = src[i - 1] === "(" ? 1 : 0;
    let hallado = false;
    const limite = Math.min(src.length, i + 500);
    for (; i < limite; i++) {
      const c = src[i];
      if (c === "(") profundidad++;
      else if (c === ")") { profundidad--; if (profundidad < 0) break; }
      else if (profundidad <= 0 && (c === ";" || c === "\n")) break;
      else if (profundidad <= 0 && c === "=" && src[i + 1] === ">") { hallado = true; break; }
    }
    if (hallado) nombres.push(m[1]);
  }
  return nombres;
}

function analizarArchivo(ruta) {
  const src = fs.readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");

  const versionMatch = src.match(/\/\/\s*@version\s+([0-9.]+)/);
  const version = versionMatch ? versionMatch[1] : "Desconocida";

  const lineas = src.split("\n").length;

  const decl = [...src.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  const flecha = encontrarNombresFlecha(src);
  const nombres = [...new Set(decl.concat(flecha))];

  return { version, lineas, funciones: nombres };
}

function compararFuentes(rutaA, rutaB) {
  const a = analizarArchivo(rutaA);
  const b = analizarArchivo(rutaB);

  const setA = new Set(a.funciones);
  const setB = new Set(b.funciones);

  const soloA = [];
  const soloB = [];
  const compartidas = [];

  for (const fn of setA) {
    if (setB.has(fn)) {
      compartidas.push(fn);
    } else {
      soloA.push(fn);
    }
  }

  for (const fn of setB) {
    if (!setA.has(fn)) {
      soloB.push(fn);
    }
  }

  return { a, b, soloA, soloB, compartidas };
}

function reporte(res) {
  console.log(`=== Comparación de Fuentes ===`);
  console.log(`Archivo A: versión ${res.a.version}, ${res.a.lineas} líneas`);
  console.log(`Archivo B: versión ${res.b.version}, ${res.b.lineas} líneas`);
  console.log(`\nFunciones compartidas: ${res.compartidas.length}`);

  console.log(`\nFunciones SOLO en A (${res.soloA.length}):`);
  if (res.soloA.length > 0) {
    console.log(`  ${res.soloA.join(", ")}`);
  } else {
    console.log(`  (Ninguna)`);
  }

  console.log(`\nFunciones SOLO en B (${res.soloB.length}):`);
  if (res.soloB.length > 0) {
    console.log(`  ${res.soloB.join(", ")}`);
  } else {
    console.log(`  (Ninguna)`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error("Uso: node tools/comparar_fuentes.js <archivoA.user.js> <archivoB.user.js>");
    process.exit(1);
  }

  try {
    const res = compararFuentes(args[0], args[1]);
    reporte(res);
  } catch (err) {
    console.error(`Error al comparar: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { encontrarNombresFlecha, analizarArchivo, compararFuentes, reporte };
