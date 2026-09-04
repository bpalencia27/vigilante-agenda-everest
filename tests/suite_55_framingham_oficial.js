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
  cubre: ["mtrFraminghamEverest", "mtrSugerirFindrisc", "mtrMedsSinGrupo", "mtrSondaPestanias", "mtrLeerTensionDelDom", "mtrLeerPesoDelDom"],

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

    // =================================================================
    //  v18.0.54 — REPORTE EN VIVO DEL MÉDICO (1-sep), con captura de su pantalla y de la
    //  nota generada: la nota decía «AL EXAMEN FÍSICO CON PRESIÓN ARTERIAL DE 110/70
    //  MMHG» y en la pantalla la tensión de hoy era **136/85**. Peso (70) y cintura (95)
    //  sí coincidían — solo la tensión estaba mal.
    //
    //  Dos defectos encadenados:
    //   (1) SE PREFERÍA LA CASILLA EQUIVOCADA: Everest tiene «T.A:*» (obligatoria, la que
    //       el médico llena) y «T.A Acostado:» (opcional, vacía en su captura). El lector
    //       pedía primero la de ACOSTADO.
    //   (2) EL RESPALDO NUNCA LEÍA LA DIASTÓLICA (`pad: null` cableado), así que en el
    //       mejor de los casos la tensión de hoy llegaba a medias.
    // =================================================================
    t.caso("v18.0.54: manda la tensión OBLIGATORIA, y se leen SIEMPRE las dos cifras", () => {
      const docCon = (mapa) => ({ querySelector: (sel) => {
        for (const k of Object.keys(mapa)) if (sel.indexOf('"' + k + '"') >= 0 || sel === "#" + k) return { value: mapa[k] };
        return null;
      } });
      // El caso del médico: T.A con 136/85, acostado vacía.
      const suyo = api.mtrLeerTensionDelDom(docCon({ sistolica: "136", diastolica: "85" }));
      t.igual(suyo.pas, 136, "la sistólica que el médico escribió");
      t.igual(suyo.pad, 85, "y la diastólica TAMBIÉN — antes se devolvía null cableado");

      // Con las dos llenas, la obligatoria le gana a la de acostado.
      const ambas = api.mtrLeerTensionDelDom(docCon({
        sistolica: "136", diastolica: "85", taSistolicaAcostado: "120", taDiastolicaAcostado: "70",
      }));
      t.igual(ambas.pas, 136, "manda «T.A», no «T.A Acostado»");
      t.igual(ambas.pad, 85, "las dos cifras, de la misma toma");

      // Y la de acostado sigue sirviendo cuando es la única que hay.
      const soloAcostado = api.mtrLeerTensionDelDom(docCon({ taSistolicaAcostado: "138", taDiastolicaAcostado: "86" }));
      t.igual(soloAcostado.pas, 138, "si solo está la de acostado, se usa esa");
      t.igual(soloAcostado.pad, 86, "con sus dos cifras");
    });

    // =================================================================
    //  v18.0.142 — GROUNDING DE LA TENSIÓN (reporte del 04-sep: «PUSE
    //  111/78… FALTÓ LA DIASTÓLICA»; notas generadas con 124/82 y 110/70
    //  que nadie tomó). Tres causas encadenadas: la obligatoria «T.A:*»
    //  no tenía lector por rótulo, «111/78» salía 11178 por _labNumerico,
    //  y la sistólica sola dejaba el hueco para que OTRA medición lo
    //  completara río abajo.
    // =================================================================
    t.caso("v18.0.142: «111/78» se lee COMPLETO desde el texto — jamás 11178", () => {
      const ta = api._mtrTaDesdeTexto("111/78");
      t.igual(ta.pas, 111, "la sistólica del texto");
      t.igual(ta.pad, 78, "y la diastólica que antes se perdía");
      const clinica = api._mtrTaDesdeTexto("165/70");
      t.igual(clinica.pas, 165, "el otro par del reporte, completo");
      t.igual(clinica.pad, 70);
      t.igual(api._mtrTaDesdeTexto("11178"), null, "un solo grupo de 5 dígitos NO es una tensión");
      t.igual(api._mtrTaDesdeTexto("95/120"), null, "par cruzado (pad > pas): lectura que no se entendió");
      t.igual(api._mtrTaDesdeTexto("300/190"), null, "300/190: fuera del rango fisiológico, no es tensión");
      t.igual(api._mtrTaDesdeTexto("999"), null, "una cifra imposible tampoco pasa como sistólica");
      t.igual(api._mtrTaDesdeTexto("-110"), null, "negativo: basura, no tensión");
      const sola = api._mtrTaDesdeTexto("111");
      t.igual(sola.pas, 111, "una sola cifra legítima pasa como sistólica");
      t.igual(sola.pad, null, "sin inventar la diastólica");
    });

    t.caso("v18.0.142: una casilla por NOMBRES que trae «111/78» entero gana y no se mezcla", () => {
      const docCon = (mapa) => ({ querySelector: (sel) => {
        for (const k of Object.keys(mapa)) if (sel.indexOf('"' + k + '"') >= 0 || sel === "#" + k) return { value: mapa[k] };
        return null;
      } });
      const suyo = api.mtrLeerTensionDelDom(docCon({ sistolica: "111/78" }));
      t.igual(suyo.pas, 111, "el par completo de UNA casilla");
      t.igual(suyo.pad, 78, "antes _labNumerico lo convertía en 11178");
      // La casilla cruzada (95/120) no se "corrige" intercambiando: es null.
      t.igual(api.mtrLeerTensionDelDom(docCon({ sistolica: "95/120" })).pas, null, "par cruzado en una casilla: null");
    });

    t.caso("v18.0.142: «T.A:*» se lee por RÓTULO — con 1 y con 2 casillas", () => {
      const nodo = (rotulo, valor) => ({ value: valor, getAttribute: (a) => (a === "aria-label" ? rotulo : null) });
      const docR = (nodos) => ({
        querySelector: () => null,
        querySelectorAll: (sel) => (sel === "input, select, textarea" ? nodos : []),
      });
      // El caso del reporte: UNA casilla «T.A:*» con «111/78» y nada por nombres.
      const suyo = api.mtrLeerTensionDelDom(docR([nodo("T.A:*", "111/78")]));
      t.igual(suyo.pas, 111, "por el rótulo de la casilla obligatoria");
      t.igual(suyo.pad, 78, "completo, aunque ningún name casara");
      // Dos casillas «T.A:*» en orden DOM (sis, dia).
      const dos = api.mtrLeerTensionDelDom(docR([nodo("T.A:*", "165"), nodo("T.A:*", "70")]));
      t.igual(dos.pas, 165);
      t.igual(dos.pad, 70);
      // «Talla» NO es «T.A»: la frontera del rótulo lo deja fuera.
      t.igual(api.mtrLeerTensionDelDom(docR([nodo("Talla (cm)", "165")])).pas, null, "«Talla (cm)» no casa la obligatoria");
      // «T.A Acostado:» es OTRA medición: no contamina la obligatoria y se lee por SU rótulo.
      const acostado = api.mtrLeerTensionDelDom(docR([nodo("T.A Acostado:", "138/86")]));
      t.igual(acostado.pas, 138, "la acostado llega como respaldo, no como obligatoria");
      t.igual(acostado.pad, 86);
      // Par cruzado por rótulo: null, no se intercambia.
      t.igual(api.mtrLeerTensionDelDom(docR([nodo("T.A:*", "95"), nodo("T.A:*", "120")])).pas, null, "cruzado por rótulo: null");
      // La costura de la EXCLUSIÓN: «T.A:* acostado» casa el regex principal
      // Y el de acostado; sin la exclusión le robaría el lugar a la
      // obligatoria aunque venga PRIMERO en el DOM (mutante 523).
      const ambiguo = api.mtrLeerTensionDelDom(docR([nodo("T.A:* acostado", "138/86"), nodo("T.A:*", "165/70")]));
      t.igual(ambiguo.pas, 165, "rótulo ambiguo de acostado NO le roba el lugar a la obligatoria");
      t.igual(ambiguo.pad, 70);
    });

    t.caso("v18.0.142: la lectura COMPLETA por rótulo le gana a la PARCIAL por nombres", () => {
      const nodo = (rotulo, valor) => ({ value: valor, getAttribute: (a) => (a === "aria-label" ? rotulo : null) });
      const doc = {
        querySelector: (sel) => (sel.indexOf('"sistolica"') >= 0 ? { value: "111" } : null),
        querySelectorAll: (sel) => (sel === "input, select, textarea" ? [nodo("T.A:*", "165/70")] : []),
      };
      const ta = api.mtrLeerTensionDelDom(doc);
      t.igual(ta.pas, 165, "el par completo de la pantalla manda");
      t.igual(ta.pad, 70, "sobre la media cifra del name afortunado (111 sin pad)");
    });

    // ============ LECTURA DEL PESO (ancla real: id="peso", Examen físico) ============
    // v17.6.75 — REPORTE EN VIVO: "no aparece la TFG y me dice que falta el peso pero
    // yo ya lo consigné en su respectiva casilla de Everest". A diferencia de la
    // tensión, nunca hubo lector de DOM en vivo para el peso.
    t.caso("mtrLeerPesoDelDom: lee la casilla real id=\"peso\" de Examen físico; sin ella, null", () => {
      const docCon = (mapa) => ({ querySelector: (sel) => {
        for (const k of Object.keys(mapa)) if (sel.indexOf(k) >= 0) return { value: mapa[k] };
        return null;
      } });
      t.igual(api.mtrLeerPesoDelDom(docCon({ peso: "77" })), 77, "el peso recién escrito, aunque no se haya guardado en Athenea");
      t.igual(api.mtrLeerPesoDelDom(docCon({})), null, "sin la casilla: null, nunca un valor inventado");
    });

    // ============ SONDA DE PESTAÑAS ============

    t.caso("la sonda no lanza, y SIN la URL aprendida del API no consulta ni sella el día", () => {
      t.noLanza(() => api.mtrSondaPestanias(), "best-effort siempre");
      t.falso(!!env.almacen["vgl_sonda_pest_dia"], "sin API.url no gasta el intento del día (reintentará)");
    });

    // =====================================================================
    // v18.0.27 — EL SEXO LLEGABA SIN NORMALIZAR Y EL FRAMINGHAM SE DECLARABA INCOMPLETO
    //
    // `mtrFraminghamEverest` exige exactamente "M" o "F". Cuando la demografía de la API no
    // trae un sexo reconocible, `mtrResumenDesdeModalLabs` cae al respaldo de la cabecera
    // (v17.6.85), que devuelve la PALABRA COMPLETA: «Sexo: MASCULINO». Ese valor crudo
    // llegaba al motor y respondía `puntos: null` con `faltantes: ["sexo"]`, de modo que la
    // cabecera de riesgo pintaba «Framingham oficial: faltan sexo» EN EL MISMO RECUADRO donde
    // la TFG ya se había calculado CON ese mismo sexo.
    //
    // Un fallo del sistema presentado al médico como un hueco del paciente — y el puntaje
    // predicho del formulario oficial no se calculaba nunca para ese paciente. Los
    // normalizadores ya existían y son los que usa el resto del motor; aquí no se llamaban.
    // =====================================================================
    t.caso("v18.0.27: «MASCULINO»/«FEMENINO» se normalizan y el Framingham deja de decir que falta el sexo", () => {
      const norm = (s) => (api.mtrEsSexoFemenino(s) ? "F" : (api.mtrEsSexoMasculino(s) ? "M" : null));
      for (const crudo of ["MASCULINO", "Masculino", "masculino"]) {
        t.igual(norm(crudo), "M", `«${crudo}» es masculino`);
      }
      for (const crudo of ["FEMENINO", "Femenino", "femenino"]) {
        t.igual(norm(crudo), "F", `«${crudo}» es femenino`);
      }
      const r = api.mtrFraminghamEverest({
        sexo: norm("MASCULINO"), edad: 60, colTotal: 200, hdl: 45,
        pas: 140, fumador: false, enTratamientoHta: false,
      });
      t.falso((r.faltantes || []).indexOf("sexo") >= 0,
        "con el sexo normalizado, el motor ya no puede declararlo faltante");
    });

    t.caso("v18.0.27: y cuando el sexo de verdad no se sabe, se sigue declarando faltante", () => {
      const norm = (s) => (api.mtrEsSexoFemenino(s) ? "F" : (api.mtrEsSexoMasculino(s) ? "M" : null));
      for (const crudo of ["", null, undefined, "X", "NO REGISTRA"]) {
        t.igual(norm(crudo), null, `«${JSON.stringify(crudo)}» no se puede interpretar, y no se adivina`);
      }
      const r = api.mtrFraminghamEverest({
        sexo: norm(""), edad: 60, colTotal: 200, hdl: 45,
        pas: 140, fumador: false, enTratamientoHta: false,
      });
      t.cierto((r.faltantes || []).indexOf("sexo") >= 0,
        "sin sexo interpretable SÍ falta el sexo: no se sobre-corrigió hasta inventarlo");
    });

    // El cable: que el llamador de verdad normalice. Sin esto, las dos pruebas de arriba
    // comprobarían los normalizadores —que ya funcionaban— y no el defecto, que era que
    // NADIE los llamaba en ese punto. Es la lección de las cuatro pruebas huecas del 31-ago.
    t.caso("v18.0.27: el llamador del Framingham normaliza el sexo antes de pasarlo", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const soloCodigo = (txt) => txt.split("\n")
        .filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\/\/.*$/, "")).join("\n");
      const i = src.indexOf("resumen.framingham = mtrFraminghamEverest({");
      t.cierto(i > 0, "se localiza el llamador");
      // La ventana se toma sobre el CÓDIGO ya despojado de comentarios, no sobre los
      // caracteres crudos: la nota que explica el arreglo ocupa más de mil caracteres, así
      // que un recorte fijo sobre el texto original se quedaba entero dentro del comentario
      // y no veía ni una línea de código. Otra cara de la misma lección del 31-ago.
      const bloque = soloCodigo(src.slice(i, i + 4000)).slice(0, 700);
      t.cierto(/mtrEsSexoFemenino/.test(bloque) && /mtrEsSexoMasculino/.test(bloque),
        "el sexo se normaliza en el llamador con los mismos ayudantes que usa el resto del motor");
      t.falso(/sexo:\s*c\.sexo\b/.test(bloque),
        "y ya no puede pasarse el valor crudo de la cabecera, que es una palabra completa");
    });

  },
};
