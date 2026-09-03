// v18.0.130 — DOS PREGUNTAS DEL MÉDICO (reporte en vivo del 02-sep), medidas por fuerza bruta
// sobre el motor real. Un barrido exhaustivo dice más que leer el código: aquí no se opina.
//
//  A. ¿Existe ALGÚN caso en que uno de los cuatro lípidos se ordene y otro se quede en «lo que
//     sigue vigente»? En Everest los cuatro van en el mismo tubo (no se piden sueltos), así que
//     enseñarlos separados le miente al médico sobre lo que el paquete de verdad agrega.
//  B. ¿En qué celdas de la tabla la regla del 50 % por fuera de metas deja una ventana MÁS CORTA
//     que el piso de recontrol del analito? El médico ya fijó ese principio para la HbA1c el
//     26-ago (piso 90 d en ERC G4): partir una vigencia ya corta manda al paciente a un viaje
//     que no aporta.
const path = require("path");
const RAIZ = "/home/user/vigilante-agenda-everest";
const { cargar } = require(path.join(RAIZ, "tests/harness.js"));

const LIPIDOS = ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS"];
const PROGRAMAS = ["DM2", "HTA", "ERC"];
const ESTADIOS = [null, "G1", "G2", "G3a", "G3b", "G4", "G5"];
const HOY = "2026-09-02";

// Fechas de toma repartidas por toda la vida útil de un examen, para que el barrido toque
// vigentes holgados, vigentes al filo, y vencidos.
const DIAS_ATRAS = [5, 20, 45, 70, 95, 130, 175, 200, 260, 400];
const isoMenos = (n) => {
  const d = new Date(HOY + "T00:00:00");
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
// Un valor en meta y uno fuera de meta por analito, para cruzar la regla del 50 %.
const VALORES = {
  COLESTEROL_LDL: [60, 160], COLESTEROL_TOTAL: [150, 260], COLESTEROL_HDL: [55, 30],
  TRIGLICERIDOS: [110, 320], GLUCOSA: [95, 180], HBA1C: [6.2, 9.5],
  CREATININA: [0.9, 2.4], RAC: [10, 90], UROANALISIS: [1, 1],
  HEMOGLOBINA: [14, 10], PTH: [40, 180], FOSFORO: [3.5, 6.2], ALBUMINA: [4.2, 3.0],
};

(async () => {
  const c = await cargar({ silencioso: true });
  const api = c.api;

  // ---------- A. lípidos separados ----------
  let casos = 0;
  const rotos = [];
  const claves = Object.keys(VALORES);
  // Se barren combinaciones con una semilla determinista (nada de aleatorio: esto tiene que
  // dar lo mismo mañana). Cada analito toma su fecha de DIAS_ATRAS rotando el índice, y el
  // LDL recorre además el caso «sin resultado», que es el de la captura del médico.
  for (const programa of PROGRAMAS) {
    for (const estadio of ESTADIOS) {
      for (const esDm2 of [true, false]) {
        for (const fueraDeMeta of [true, false]) {
          for (let giro = 0; giro < DIAS_ATRAS.length; giro++) {
            for (const ldlSinResultado of [true, false]) {
              const ultimos = {};
              claves.forEach((k, i) => {
                if (k === "COLESTEROL_LDL" && ldlSinResultado) return;
                const dias = DIAS_ATRAS[(giro + i) % DIAS_ATRAS.length];
                ultimos[k] = { fecha: isoMenos(dias), valor: VALORES[k][fueraDeMeta ? 1 : 0] };
              });
              const ctx = {
                hoyIso: HOY, programa: programa, esDm2: esDm2, categoriaRiesgo: "alto", edad: 62,
                estadioAdministrativo: estadio, rac: VALORES.RAC[fueraDeMeta ? 1 : 0],
                egfrCkdEpi: estadio === "G4" || estadio === "G5" ? 25 : 88,
                ultimos: ultimos,
              };
              let plan;
              try { plan = api.mtrPlanParaclinicos(ctx); } catch (e) { continue; }
              if (!plan) continue;
              casos++;
              const enOrdenar = new Set((plan.ordenar || []).map((a) => a.clave));
              const vigentes = [].concat(plan.drivers || [], plan.pasajeros || [])
                .filter((a) => a && (a.estado === "D" || a.estado === "R") && a.vence && !enOrdenar.has(a.clave))
                .map((a) => a.clave);
              const lipOrden = LIPIDOS.filter((k) => enOrdenar.has(k));
              const lipVig = LIPIDOS.filter((k) => vigentes.indexOf(k) >= 0);
              if (lipOrden.length && lipVig.length) {
                rotos.push({ programa, estadio, esDm2, fueraDeMeta, giro, ldlSinResultado, ordenados: lipOrden, sueltos: lipVig, ftl: plan.ftl });
              }
            }
          }
        }
      }
    }
  }
  console.log("=== A. ¿un lípido arriba y otro en «sigue vigente»? ===");
  console.log("   combinaciones barridas:", casos);
  console.log("   casos rotos:", rotos.length);
  for (const r of rotos.slice(0, 12)) {
    console.log(`     ${r.programa}/${String(r.estadio)} dm2=${r.esDm2 ? "sí" : "no"} fuera=${r.fueraDeMeta ? "sí" : "no"} ldlSinResultado=${r.ldlSinResultado} giro=${r.giro}`);
    console.log(`       ordenados: ${r.ordenados.join(", ")}  ·  sueltos en vigente: ${r.sueltos.join(", ")}  ·  toma ${r.ftl}`);
  }
  if (rotos.length > 12) console.log(`     … y ${rotos.length - 12} más`);

  // ---------- B. el 50 % contra el piso de recontrol ----------
  console.log("\n=== B. dónde el 50 % deja la ventana por debajo del piso ===");
  const ANALITOS = { COLESTEROL_LDL: "ldl", HBA1C: "hba1c", GLUCOSA: "glicemia" };
  const filas = [];
  for (const clave of Object.keys(ANALITOS)) {
    for (const programa of PROGRAMAS) {
      for (const estadio of ESTADIOS) {
        for (const esDm2 of [true, false]) {
          const opts = {
            programa, estadio, esDM2: esDm2, esDm2: esDm2, categoriaRiesgo: "alto", edad: 62,
            egfrCkdEpi: 88, aplicar50: true,
          };
          const norma = api._vigenciaNormaDiasParaAnalito(clave, VALORES[clave][1], opts);
          const efectiva = api._vigenciaDiasParaAnalito(clave, VALORES[clave][1], opts);
          if (typeof norma !== "number" || typeof efectiva !== "number") continue;
          if (efectiva >= norma) continue;                    // no se acortó
          const v = api.mtrVentanaRecontrol(ANALITOS[clave]);
          const piso = (v && typeof v.pisoDias === "number") ? v.pisoDias : null;
          filas.push({ clave, programa, estadio, esDm2, norma, efectiva, piso, bajoPiso: piso !== null && efectiva < piso });
        }
      }
    }
  }
  const vistas = new Set();
  for (const f of filas) {
    const k = [f.clave, f.norma, f.efectiva, f.piso].join("|");
    if (vistas.has(k)) continue;
    vistas.add(k);
    console.log(`   ${f.clave.padEnd(16)} norma ${String(f.norma).padStart(3)} d -> efectiva ${String(f.efectiva).padStart(3)} d · piso ${f.piso === null ? "(ninguno)" : f.piso + " d"}${f.bajoPiso ? "   <-- POR DEBAJO DEL PISO" : ""}`);
  }
  const bajo = filas.filter((f) => f.bajoPiso);
  console.log(`   celdas por debajo de su piso: ${bajo.length} de ${filas.length}`);
  const sinPiso = filas.filter((f) => f.piso === null);
  if (sinPiso.length) {
    const cs = [...new Set(sinPiso.map((f) => f.clave + " (mín " + Math.min(...sinPiso.filter((x) => x.clave === f.clave).map((x) => x.efectiva)) + " d)"))];
    console.log(`   analitos que se acortan SIN piso declarado: ${cs.join(", ")}`);
  }
})();
