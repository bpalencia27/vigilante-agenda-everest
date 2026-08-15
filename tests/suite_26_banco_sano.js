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

  async pruebas(t) {
    const dir = __dirname;
    const suites = fs.readdirSync(dir)
      .filter((f) => /^suite_.*\.js$/.test(f) && f !== path.basename(__filename))
      .sort();

    // v14.1.7 — LAS PROPIAS ASERCIONES DEL BANCO, PROBADAS.
    // `t.lanza` y `t.noLanza` solo atrapaban lo síncrono, así que con una función `async`
    // no podían fallar jamás. El arreglo es fácil de escribir y fácil de revertir sin que
    // nadie note nada — de hecho, al mutarlo de vuelta a la versión vieja el banco entero
    // seguía en verde, porque en la base no hay ni un uso async de los 49 que hay. Un
    // arreglo que ninguna prueba ejercita no está arreglado: está esperando a que alguien
    // lo deshaga. Estos cuatro casos son los que lo sujetan.
    await t.casoAsync("t.noLanza con una función async: CAE si la promesa se rechaza, y pasa si se resuelve", async () => {
      let cayo = false;
      try { await t.noLanza(async () => { throw new Error("fallo de verdad"); }, "debía caer"); }
      catch (e) { cayo = true; }
      t.cierto(cayo, "una promesa rechazada TIENE que hacer caer la prueba; si no, es una prueba que no puede fallar");

      let cayoSinMotivo = false;
      try { await t.noLanza(async () => 42); } catch (e) { cayoSinMotivo = true; }
      t.falso(cayoSinMotivo, "una promesa que resuelve no debe hacer caer nada");
    });

    await t.casoAsync("t.lanza con una función async: pasa si la promesa se rechaza, y CAE si se resuelve", async () => {
      let cayoSinMotivo = false;
      try { await t.lanza(async () => { throw new Error("esperada"); }); } catch (e) { cayoSinMotivo = true; }
      t.falso(cayoSinMotivo, "si se esperaba excepción y la promesa se rechaza, la prueba pasa");

      let cayo = false;
      try { await t.lanza(async () => 42, "debía caer"); } catch (e) { cayo = true; }
      t.cierto(cayo, "si se esperaba excepción y la promesa resuelve, la prueba TIENE que caer");
    });

    t.caso("t.noLanza y t.lanza siguen funcionando igual con funciones síncronas (los 49 usos que ya había)", () => {
      let cayo = false;
      try { t.noLanza(() => { throw new Error("x"); }, "debía caer"); } catch (e) { cayo = true; }
      t.cierto(cayo, "noLanza síncrono que lanza sigue cayendo");

      let cayoSinMotivo = false;
      try { t.noLanza(() => 42); } catch (e) { cayoSinMotivo = true; }
      t.falso(cayoSinMotivo, "noLanza síncrono que no lanza sigue pasando");

      let cayo2 = false;
      try { t.lanza(() => 42, "debía caer"); } catch (e) { cayo2 = true; }
      t.cierto(cayo2, "lanza síncrono sin excepción sigue cayendo");
    });

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

    // v14.1.7 — Hermano del centinela de t.casoAsync, y por el mismo motivo.
    // `t.lanza` y `t.noLanza` ahora entienden promesas, pero solo si el llamador ESPERA
    // el resultado. Una llamada async sin `await` devuelve una promesa que nadie mira: la
    // prueba termina antes de que se sepa si falló, y queda verde pase lo que pase.
    // Es exactamente el agujero que tenían antes, solo que movido un paso más allá.
    t.caso("toda llamada async a t.lanza / t.noLanza se invoca con await — si no, vuelve a ser una prueba que no puede fallar", () => {
      const huerfanos = [];
      for (const f of suites) {
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        src.split("\n").forEach((linea, i) => {
          const limpia = linea.replace(/\/\/.*$/, "");                   // fuera comentarios
          if (!/\bt\.(lanza|noLanza)\s*\(\s*async\b/.test(limpia)) return;
          if (/\bawait\s+t\.(lanza|noLanza)\s*\(/.test(limpia)) return;
          huerfanos.push(f + ":" + (i + 1) + "  " + limpia.trim().slice(0, 80));
        });
      }
      t.igual(huerfanos, [], "llamada async a t.lanza/t.noLanza sin await: la prueba no puede fallar aunque el código esté roto");
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
