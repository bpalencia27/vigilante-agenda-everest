// =====================================================================
//  SUITE 26 — El banco se ejecuta de verdad (guard estructural)
//
//  Mira el CÓDIGO FUENTE de las demás suites, no su comportamiento. Existe por un
//  incidente real: los 8 t.casoAsync de suite_05 (las llamadas que CREAN citas y
//  órdenes clínicas) se invocaban SIN await y `pruebas()` no era async, así que sus
//  aserciones resolvían después de que el runner ya había cerrado la cuenta de la
//  suite. El banco mostraba "Llamadas a Everest y clínicas — 1 ok" y estaba en
//  verde, con 6 de esas 8 pruebas fallando sin que nadie lo viera. Lo mismo en
//  suite_07 (2 casos).
//
//  Una prueba que no se ejecuta es peor que una prueba que no existe: la ausencia se
//  nota en la cobertura, la cobertura falsa no se nota en ningún lado.
// =====================================================================
const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "El banco se ejecuta de verdad",
  cubre: [],

  pruebas(t) {
    const dir = __dirname;
    const suites = fs.readdirSync(dir)
      .filter((f) => /^suite_.*\.js$/.test(f) && f !== path.basename(__filename))
      .sort();

    t.caso("hay suites que auditar (si esto falla, el propio guard quedó ciego)", () => {
      t.cierto(suites.length > 10, "se esperaban más de 10 suites, se hallaron " + suites.length);
    });

    // v14.1.5 — La guarda de cruce de pacientes es OPCIONAL por firma: sin el segundo
    // argumento, `injectLabsIntoCronicos` escribe sin comprobar nada. Eso es a propósito
    // (las suites montan un DOM sin cabecera de paciente), pero deja la puerta abierta a
    // que una edición futura añada un llamador de PRODUCCIÓN que se lo olvide y reabra en
    // silencio el peor bug que ha tenido este script. Esta prueba lee el userscript y
    // exige que toda llamada real lleve los dos argumentos.
    t.caso("toda llamada de producción a injectLabsIntoCronicos pasa el docId esperado (guarda de cruce de pacientes, v14.1.5)", () => {
      const src = fs.readFileSync(path.join(dir, "..", "vigilante_agenda.user.js"), "utf8");
      const MARCA = "injectLabsIntoCronicos(";
      const sinGuarda = [];
      let vistas = 0;
      src.split("\n").forEach((linea, i) => {
        const limpia = linea.replace(/\/\/.*$/, "");
        const pos = limpia.indexOf(MARCA);
        if (pos === -1) return;
        if (/function\s+injectLabsIntoCronicos/.test(limpia)) return;   // la declaración
        vistas++;
        const tras = limpia.slice(pos + MARCA.length);
        const cierre = tras.indexOf(")");
        const args = cierre === -1 ? tras : tras.slice(0, cierre);
        if (args.indexOf(",") === -1) sinGuarda.push((i + 1) + ": " + limpia.trim());
      });
      t.cierto(vistas > 0, "se esperaban llamadas a injectLabsIntoCronicos en el userscript; si son 0, esta prueba quedó ciega");
      t.igual(sinGuarda, [], "llamadas sin docId esperado: escribirían en la historia que esté abierta AHORA, no en la del paciente consultado");
    });

    t.caso("todo t.casoAsync se invoca con await — si no, sus aserciones caen fuera de la cuenta", () => {
      const huerfanos = [];
      for (const f of suites) {
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        src.split("\n").forEach((linea, i) => {
          // Solo llamadas reales: se ignoran comentarios y menciones en texto.
          const limpia = linea.replace(/\/\/.*$/, "");
          if (!/\bt\.casoAsync\s*\(/.test(limpia)) return;
          if (/\bawait\s+t\.casoAsync\s*\(/.test(limpia)) return;
          huerfanos.push(f + ":" + (i + 1));
        });
      }
      t.igual(huerfanos, [], "t.casoAsync sin await (sus aserciones resolverían tras cerrarse la cuenta de la suite)");
    });

    t.caso("toda suite que use t.casoAsync declara `async pruebas` — sin eso el await ni siquiera compila", () => {
      const malas = [];
      for (const f of suites) {
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        const usaAsync = /\bt\.casoAsync\s*\(/.test(src.replace(/\/\/.*$/gm, ""));
        if (!usaAsync) continue;
        if (!/\basync\s+pruebas\s*\(/.test(src)) malas.push(f);
      }
      t.igual(malas, [], "suites con t.casoAsync cuya función `pruebas` no es async");
    });

    t.caso("ninguna suite pisa el objeto `api` compartido sin restaurarlo en el mismo caso", () => {
      // Reasignar api.<algo> no intercepta nada (el script llama a sus funciones por
      // clausura dentro del IIFE, no a través del objeto exportado) Y contamina las
      // suites siguientes si el caso lanza antes de restaurar — fue justo lo que tumbó
      // de rebote la prueba de zipRead en suite_07. Los mocks entran por cargar({...}).
      const sospechosas = [];
      for (const f of suites) {
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        src.split("\n").forEach((linea, i) => {
          const limpia = linea.replace(/\/\/.*$/, "");
          // `api.foo = ` sobre el api COMPARTIDO (el que recibe pruebas(t, api, ...)),
          // no sobre una instancia propia (c.api.foo, cv.api.foo… esas son aisladas).
          if (/(^|[^.\w])api\.[A-Za-z_$][\w$]*\s*=[^=]/.test(limpia)) {
            sospechosas.push(f + ":" + (i + 1) + "  " + limpia.trim().slice(0, 80));
          }
        });
      }
      t.igual(sospechosas, [], "asignaciones al `api` compartido: no interceptan la llamada interna y contaminan las demás suites");
    });
  },
};
