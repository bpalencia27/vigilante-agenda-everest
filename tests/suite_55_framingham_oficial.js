// =====================================================================
//  SUITE 55 — Framingham OFICIAL predicho, FINDRISC, cobertura y sonda
//
//  El puntaje que va a calcular el FORMULARIO de Everest, predicho con la
//  parametrización REAL de la IPS (114 filas rescatadas del HAR). Lo que se fija:
//   1. VERIFICACIÓN CRUZADA: la tabla embebida en el script se contrasta fila a
//      fila (vía una implementación de referencia independiente que lee el
//      catálogo grounding/catalogos/tabla_puntaje_framingham_everest.json)
//      sobre una rejilla de casos. Si alguna copia deriva, esto se pone rojo.
//   2. TODO-O-NADA: sin PAS o sin tabaquismo el puntaje es null con la lista de
//      faltantes — un Framingham "parcial" sería un número inventado.
//   3. La edad fuera de 20-79 se dice explícitamente (la tabla no la cubre).
// =====================================================================
const fs = require("fs");
const path = require("path");

const CATALOGO = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "grounding", "catalogos", "tabla_puntaje_framingham_everest.json"), "utf8")).tabla;

// Implementación de REFERENCIA, independiente del script: busca directo en el catálogo.
function refPuntos(d) {
  const en = (v, i, f) => (i == null || v >= +i) && (f == null || v <= +f);
  const busca = (fn) => { const r = CATALOGO.find(fn); return r ? r.puntos : null; };
  const pE = busca((r) => r.tipo === "EDAD" && r.sexo === d.sexo && en(d.edad, r.edadInicio, r.edadFin));
  const pC = busca((r) => r.tipo === "TOTAL" && r.sexo === d.sexo && en(d.edad, r.edadInicio, r.edadFin) && en(d.colTotal, r.valorInicio, r.valorFin));
  const pH = busca((r) => r.tipo === "HDL" && en(d.hdl, r.valorInicio, r.valorFin));
  const pF = busca((r) => r.tipo === "FUMADOR" && r.sexo === d.sexo && en(d.edad, r.edadInicio, r.edadFin) && r.esFumador === d.fumador);
  const pP = busca((r) => r.tipo === "PRESION" && r.sexo === d.sexo && en(d.pas, r.valorInicio, r.valorFin) && r.conTratamiento === d.tratamientoHta);
  if (pE == null || pC == null || pH == null || pF == null || pP == null) return null;
  return pE + pC + pH + pF + pP;
}

module.exports = {
  nombre: "Framingham oficial predicho, FINDRISC, cobertura del motor y sonda",
  cubre: ["mtrFraminghamEverest", "mtrSugerirFindrisc", "mtrMedsSinGrupo", "mtrSondaPestanias", "mtrLeerTensionDelDom"],

  pruebas(t, api, env) {
    t.caso("el catálogo rescatado del HAR sigue teniendo las 114 filas", () => {
      t.igual(CATALOGO.length, 114, "las 114 filas de la parametrización oficial");
    });

    t.caso("VERIFICACIÓN CRUZADA: el script coincide con el catálogo en una rejilla de casos", () => {
      let comparados = 0;
      const cts = [150, 180, 210, 250, 300], hdls = [35, 45, 55, 65], pases = [110, 125, 135, 150, 165];
      let i = 0;
      for (const sexo of ["F", "M"]) {
        for (let edad = 25; edad <= 79; edad += 6) {
          const d = {
            sexo, edad, colTotal: cts[i % 5], hdl: hdls[i % 4], pas: pases[i % 5],
            fumador: i % 2 === 0, tratamientoHta: i % 3 === 0,
          };
          i++;
          const esperado = refPuntos(d);
          const obtenido = api.mtrFraminghamEverest(d);
          t.igual(obtenido.puntos, esperado,
            "caso " + JSON.stringify(d) + " debía dar " + esperado);
          comparados++;
        }
      }
      t.cierto(comparados >= 18, "se compararon " + comparados + " casos de la rejilla");
    });

    t.caso("ancla a mano: F/61/fumadora/CT180/HDL45/PAS135 sin tratamiento = 16 puntos", () => {
      const r = api.mtrFraminghamEverest({ sexo: "F", edad: 61, colTotal: 180, hdl: 45, pas: 135, fumador: true, tratamientoHta: false });
      t.igual(r.puntos, 16, "10 (edad) + 1 (CT) + 1 (HDL) + 2 (fuma) + 2 (PAS sin trat)");
      t.igual(r.detalle.length, 5, "con el desglose de los 5 componentes");
    });

    t.caso("ancla a mano: M/55/no fumador/CT210/HDL38/PAS125 con tratamiento = 14 puntos", () => {
      const r = api.mtrFraminghamEverest({ sexo: "M", edad: 55, colTotal: 210, hdl: 38, pas: 125, fumador: false, tratamientoHta: true });
      t.igual(r.puntos, 14, "8 + 3 + 2 + 0 + 1");
    });

    t.caso("los puntajes negativos existen y se respetan (F 25 años con todo óptimo)", () => {
      const r = api.mtrFraminghamEverest({ sexo: "F", edad: 25, colTotal: 150, hdl: 65, pas: 110, fumador: false, tratamientoHta: false });
      t.igual(r.puntos, -8, "-7 (edad) + 0 + (-1 HDL) + 0 + 0");
    });

    t.caso("TODO-O-NADA: sin PAS o sin tabaquismo, puntaje null y faltantes listados", () => {
      const sinPas = api.mtrFraminghamEverest({ sexo: "F", edad: 61, colTotal: 180, hdl: 45, pas: null, fumador: true, tratamientoHta: false });
      t.igual(sinPas.puntos, null, "sin PAS no hay puntaje parcial");
      t.cierto(sinPas.faltantes.indexOf("PAS") >= 0, "y lo dice");
      const sinFuma = api.mtrFraminghamEverest({ sexo: "M", edad: 50, colTotal: 200, hdl: 45, pas: 130 });
      t.cierto(sinFuma.puntos === null && sinFuma.faltantes.indexOf("tabaquismo") >= 0, "tabaquismo desconocido ≠ no fumador");
    });

    t.caso("edad fuera de 20-79: la tabla oficial no la cubre y se dice", () => {
      const r = api.mtrFraminghamEverest({ sexo: "M", edad: 85, colTotal: 200, hdl: 45, pas: 130, fumador: false, tratamientoHta: true });
      t.igual(r.puntos, null, "sin puntaje");
      t.cierto(/fuera de la tabla/.test(r.motivo), "con el motivo explícito");
    });

    t.caso("el resumen clínico integra el Framingham y llega al recuadro", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-17", edad: 61, sexo: "F", pesoKg: 65, creatinina: 0.9,
        factores: { tabaquismo: true, hta: true }, ct: 180, hdl: 45, paSistolica: 135,
        programa: "HTA", ultimos: {},
      });
      t.igual(r.framingham.puntos, 18, "con tratamiento HTA la PAS 135 vale 4: 10+1+1+2+4");
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(html.indexOf("Framingham oficial Everest") >= 0, "el recuadro lo muestra");
    });

    // ============ FINDRISC ============

    t.caso("glicemia alterada sin diagnóstico de DM -> sugiere el FINDRISC oficial", () => {
      const s = api.mtrSugerirFindrisc({ diabetes: false }, { GLUCOSA: { valor: 110 } });
      t.cierto(!!s && /FINDRISC/.test(s.texto), "sugiere el cuestionario");
      t.cierto(/110/.test(s.motivo), "con la glicemia que lo motiva");
    });

    t.caso("el FINDRISC NO se sugiere si ya hay DM, si la glicemia es normal o si es de rango diabético", () => {
      t.igual(api.mtrSugerirFindrisc({ diabetes: true }, { GLUCOSA: { valor: 110 } }), null, "ya es DM");
      t.igual(api.mtrSugerirFindrisc({}, { GLUCOSA: { valor: 92 } }), null, "normal");
      t.igual(api.mtrSugerirFindrisc({}, { GLUCOSA: { valor: 140 } }), null, "≥126 es criterio diagnóstico, no tamizaje");
      t.igual(api.mtrSugerirFindrisc({}, {}), null, "sin glicemia no se inventa");
    });

    // ============ COBERTURA DEL MOTOR ============

    t.caso("mtrMedsSinGrupo cuenta qué fracción de la fórmula ve el motor (solo enteros)", () => {
      const r = api.mtrMedsSinGrupo(["LOSARTAN 50 MG (TABLETA)", "ACETAMINOFEN 500 MG (TABLETA)"]);
      t.igual(r.total, 2, "dos medicamentos");
      t.igual(r.sinGrupo, 1, "el acetaminofén no participa en ninguna regla (correcto: fuera de dominio)");
      t.igual(api.mtrMedsSinGrupo([]).total, 0, "vacío");
      t.igual(api.mtrMedsSinGrupo(null).sinGrupo, 0, "nulo sin lanzar");
    });

    // v17.6.77 — auditoría 25-ago (ítem 5): hallazgo cruzado al promover esta detección
    // a un aviso visible — mtrMedsSinGrupo solo miraba mtrDetectarGruposFarmacologicos
    // (base) y mtrDetectarGruposAmp (ampliado), nunca mtrGruposCatalogoRcv (el catálogo
    // externo v17.6.4, un TERCER sistema de clasificación que llegó después). Un
    // fármaco reconocido SOLO por el catálogo (omeprazol, vía la interacción
    // CLOPIDOGREL_IBP) contaba como "sin grupo" pese a que el motor SÍ lo evalúa — un
    // falso positivo de cobertura real desde que existe el catálogo, no solo teórico.
    t.caso("mtrMedsSinGrupo (v17.6.77): un fármaco reconocido SOLO por el catálogo RCV externo NO cuenta como sin grupo", () => {
      const r = api.mtrMedsSinGrupo(["OMEPRAZOL 20 MG (CAPSULA)"]);
      t.igual(r.total, 1);
      t.igual(r.sinGrupo, 0, "el omeprazol SÍ está cubierto — por el catálogo RCV, aunque no por base/ampliado");
    });

    // ============ LECTURA DE LA TENSIÓN ARTERIAL (anclas capturadas) ============

    t.caso("lee la TA por las anclas capturadas y prioriza el examen físico sobre Ruta", () => {
      const docCon = (mapa) => ({ querySelector: (sel) => {
        for (const k of Object.keys(mapa)) if (sel.indexOf(k) >= 0) return { value: mapa[k] };
        return null;
      } });
      const exFis = api.mtrLeerTensionDelDom(docCon({ taSistolicaAcostado: "138", taDiastolicaAcostado: "86" }));
      t.igual(exFis.pas, 138, "PAS del examen físico");
      t.igual(exFis.pad, 86, "PAD del examen físico");
      const ruta = api.mtrLeerTensionDelDom(docCon({ sistolica: "142" }));
      t.igual(ruta.pas, 142, "PAS de Ruta Crónicos como respaldo");
      t.igual(ruta.pad, null, "la diastólica de Ruta NO está capturada: no se adivina");
      const vacio = api.mtrLeerTensionDelDom(docCon({}));
      t.igual(vacio.pas, null, "sin casillas: null, jamás un valor inventado");
    });

    // ============ SONDA DE PESTAÑAS ============

    t.caso("la sonda no lanza, y SIN la URL aprendida del API no consulta ni sella el día", () => {
      t.noLanza(() => api.mtrSondaPestanias(), "best-effort siempre");
      t.falso(!!env.almacen["vgl_sonda_pest_dia"], "sin API.url no gasta el intento del día (reintentará)");
    });
  },
};
