// =====================================================================
//  SUITE 90 — MENÚ DE INTERPRETACIÓN GENERAL DEL UROANÁLISIS
//  [REQ 07-sep — botón «🧪 Exámenes», pestaña Ruta Crónicos]
//
//  Athenea llena las casillas de los COMPONENTES del parcial (nitritos,
//  leucocitos…), pero la casilla GENERAL —la interpretación global que
//  va junto a la fecha— queda vacía. Tras el llenado (opciones 1 «Última
//  toma completa» y 2 «Historial por analito»), si esa casilla está
//  VACÍA, el script ofrece un menú numerado con el léxico acordado y la
//  opción RECOMENDADA por el motor clínico destacada (⭐ + fundamento).
//  La decisión final es del médico; cerrar sin elegir deja la casilla
//  vacía (casilla vacía antes que dato inventado).
//
//  Tres capas de prueba:
//   1. mtrUroRecomendacion — el motor PURO de recomendación (qué término
//      sugiere el perfil de Labs + síntomas, y con qué fundamento).
//   2. CONTRATOS DE FUENTE — el léxico completo y el hook en el camino
//      común de éxito de _ejecutarLlenadoExamenes (ambos modos).
//   3. _vglMenuInterpretacionUro — el menú con DOM real del arnés: solo
//      abre con casilla vacía y mismo paciente; al elegir escribe vía
//      setNgValue y registra el fundamento; las guardas (casilla llena,
//      cambio de paciente, escritura rechazada) frenan sin romper nada.
// =====================================================================
const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

module.exports = {
  nombre: "Suite 90 · Menú uroanálisis (Exámenes)",
  cubre: ["mtrUroRecomendacion", "_vglMenuInterpretacionUro"],

  async pruebas(t, api, env, cargar) {
    const { instalarDomEnriquecido, disparar: dispararComun } = require("./harness.js");
    const disparar = (nodo, tipo) => dispararComun(nodo, tipo, "[suite_90]");
    const c = cargar();
    const testApi = c.api;
    instalarDomEnriquecido(c.env.doc);

    // Fabrica un analito como lo entrega Athenea (patrón de suite_51).
    function labUro(nombre, resultado, extra) {
      return Object.assign({ NombreParametroPadre: "PARCIAL DE ORINA", NombreParametro: nombre, Resultado: resultado }, extra || {});
    }

    // =====================================================================
    //  PARTE 1 — EL MOTOR PURO: mtrUroRecomendacion
    //  Reutiliza el motor clínico existente (mtrHallazgosUroDesdeLabs +
    //  mtrEvaluarUroanalisis): no hay reglas nuevas que probar, lo que se
    //  fija aquí es la TRADUCCIÓN de ese veredicto al léxico del menú.
    // =====================================================================
    t.caso("mtrUroRecomendacion: sugestivo + síntomas confirmados → SUGESTIVO DE ITU", () => {
      const labs = [labUro("NITRITOS", "POSITIVO"), labUro("LEUCOCITOS", "10-15 x campo")];
      const r = testApi.mtrUroRecomendacion(labs, true);
      t.cierto(!!r, "debe recomendar");
      t.igual(r.termino, "SUGESTIVO DE ITU", "síntomas confirmados: la conducta cambia");
      t.cierto(String(r.fundamento).indexOf("síntomas urinarios confirmados") >= 0, "el fundamento cita los síntomas");
    });

    t.caso("mtrUroRecomendacion: sugestivo + síntomas NEGADOS → BACTERIURIA ASINTOMÁTICA (no se trata)", () => {
      const labs = [labUro("NITRITOS", "POSITIVO"), labUro("LEUCOCITOS", "10-15 x campo")];
      const r = testApi.mtrUroRecomendacion(labs, false);
      t.cierto(!!r, "debe recomendar");
      t.igual(r.termino, "BACTERIURIA ASINTOMÁTICA", "sin síntomas no es ITU");
      t.cierto(String(r.fundamento).indexOf("no se trata") >= 0, "el fundamento dice por qué no se trata");
    });

    t.caso("mtrUroRecomendacion: sugestivo + síntomas DESCONOCIDOS → NULL (no se afirma ni se niega)", () => {
      const labs = [labUro("NITRITOS", "POSITIVO"), labUro("LEUCOCITOS", "10-15 x campo")];
      t.cierto(testApi.mtrUroRecomendacion(labs, null) === null, "decide el médico: nada de inventar una conducta");
    });

    t.caso("mtrUroRecomendacion: bacteriuria franca sin piuria → BACTERIURIA", () => {
      const labs = [labUro("BACTERIAS", "ABUNDANTES"), labUro("LEUCOCITOS", "1-2 x campo")];
      const r = testApi.mtrUroRecomendacion(labs, null);
      t.igual(r && r.termino, "BACTERIURIA", "bacterias abundantes con leucocitos normales");
      t.cierto(String(r.fundamento).indexOf("sin piuria acompañante") >= 0, "el fundamento distingue de la ITU");
    });

    t.caso("mtrUroRecomendacion: sangre franca en la tira → HEMATURIA (y gana sobre proteinuria simultánea)", () => {
      const r = testApi.mtrUroRecomendacion([labUro("SANGRE", "++"), labUro("NITRITOS", "NEGATIVO"), labUro("PROTEINA", "3+")], null);
      t.igual(r && r.termino, "HEMATURIA", "la hematuria encabeza la cascada");
      const r2 = testApi.mtrUroRecomendacion([labUro("HEMATIES", "8-10 x campo"), labUro("NITRITOS", "NEGATIVO")], null);
      t.igual(r2 && r2.termino, "HEMATURIA", "hematíes > 3/campo también es hematuria aunque la tira no lo diga");
    });

    t.caso("mtrUroRecomendacion: proteína 2+ → PROTEINURIA", () => {
      const r = testApi.mtrUroRecomendacion([labUro("PROTEINA", "2+"), labUro("NITRITOS", "NEGATIVO")], null);
      t.igual(r && r.termino, "PROTEINURIA", "cruces de proteína en la tira");
    });

    t.caso("mtrUroRecomendacion: glucosa 1+ → GLUCOSURIA y NUNCA dispara ITU", () => {
      const r = testApi.mtrUroRecomendacion([labUro("GLUCOSA", "1+"), labUro("NITRITOS", "NEGATIVO")], true);
      t.igual(r && r.termino, "GLUCOSURIA", "aun con síntomas: la glucosuria no es criterio de ITU (regla S4)");
      t.cierto(String(r.fundamento).indexOf("no es criterio de ITU") >= 0, "el fundamento lo dice explícito");
    });

    t.caso("mtrUroRecomendacion: piuria aislada → LEUCOCITURIA (PIURIA)", () => {
      const r = testApi.mtrUroRecomendacion([labUro("LEUCOCITOS", "20-25 x campo"), labUro("NITRITOS", "NEGATIVO")], null);
      t.igual(r && r.termino, "LEUCOCITURIA (PIURIA)", "leucocitos altos sin criterios de ITU");
      t.cierto(String(r.fundamento).indexOf("sin criterios de ITU") >= 0, "el fundamento cierra la puerta del ITU");
    });

    t.caso("mtrUroRecomendacion: componentes leídos y todos negativos → NORMAL", () => {
      const labs = [labUro("NITRITOS", "NEGATIVO"), labUro("LEUCOCITOS", "0-2 x campo"), labUro("SANGRE", "NEGATIVA")];
      const r = testApi.mtrUroRecomendacion(labs, null);
      t.igual(r && r.termino, "NORMAL", "todo negativo: el parcial es normal");
      t.cierto(String(r.fundamento).indexOf("negativos") >= 0, "el fundamento cita los componentes leídos");
    });

    t.caso("mtrUroRecomendacion: sin datos de orina en lo que se escribió → NULL", () => {
      const labs = [{ NombreParametroPadre: "QUIMICA SANGUINEA", NombreParametro: "CREATININA", Resultado: "0.9" }];
      t.cierto(testApi.mtrUroRecomendacion(labs, true) === null, "un suero no es base para interpretar un parcial");
      t.cierto(testApi.mtrUroRecomendacion([], true) === null, "ni un arreglo vacío");
    });

    // =====================================================================
    //  PARTE 2 — CONTRATOS DE FUENTE: el léxico y el hook
    // =====================================================================
    t.caso("CONTRATO — el léxico MTR_URO_TERMINOS trae las categorías acordadas, sin duplicados", () => {
      const bloque = (FUENTE.match(/const MTR_URO_TERMINOS = \[([\s\S]*?)\];/) || ["", ""])[1];
      t.cierto(bloque.length > 0, "el bloque del léxico existe");
      const terminos = [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      for (const esperado of [
        "NORMAL", "ANORMAL", "GLUCOSURIA", "HEMATURIA", "PROTEINURIA", "BACTERIURIA",
        "LEUCOCITURIA (PIURIA)", "CRISTALURIA", "NITRITOS POSITIVOS",
        "SUGESTIVO DE ITU", "BACTERIURIA ASINTOMÁTICA", "MUESTRA CONTAMINADA",
      ]) {
        t.cierto(terminos.indexOf(esperado) >= 0, "el menú ofrece «" + esperado + "»");
      }
      t.igual(terminos.length, 12, "lista CORTA y generalista (decisión del médico en la entrevista)");
      t.igual(new Set(terminos).size, 12, "sin términos repetidos");
    });

    t.caso("CONTRATO — las opciones 1 y 2 del botón «Exámenes» desembocan en _ejecutarLlenadoExamenes", () => {
      t.cierto(FUENTE.indexOf('{ id: "ultima"') >= 0, "existe la opción 1 (última toma completa)");
      t.cierto(FUENTE.indexOf('{ id: "historial"') >= 0, "existe la opción 2 (historial por analito)");
      t.cierto(FUENTE.indexOf("onPick: (modo) => { _ejecutarLlenadoExamenes(docId, btn, modo); }") >= 0,
        "ambas opciones entran por el MISMO camino de llenado");
    });

    t.caso("CONTRATO — tras el llenado exitoso se ofrece el menú de interpretación (camino común, una sola vez)", () => {
      const HOOK = 'setTimeout(() => { try { _vglMenuInterpretacionUro(docId, labs); } catch (eUro) {} }, 1500);';
      const iHook = FUENTE.indexOf(HOOK);
      t.cierto(iHook >= 0, "el hook existe, literal, con su retardo de 1,5 s");
      const iFn = FUENTE.indexOf("function _ejecutarLlenadoExamenes");
      t.cierto(iFn >= 0, "existe _ejecutarLlenadoExamenes");
      // La primera función del IIFE declarada DESPUÉS del inicio marca el fin del cuerpo:
      // el hook debe quedar antes de ella (dentro de _ejecutarLlenadoExamenes).
      const iSgteFn = FUENTE.indexOf("\n  function ", iFn + 10);
      t.cierto(iSgteFn > iHook, "el hook vive DENTRO de _ejecutarLlenadoExamenes: lo cubren ambos modos");
      const iToastExito = FUENTE.indexOf('labs|" + docId', iFn);
      t.cierto(iToastExito > 0 && iHook > iToastExito, "se ofrece tras el aviso de éxito, no en los abortos");
      // Y no hay una segunda llamada con (docId, labs): el menú no puede abrirse dos veces.
      t.igual(FUENTE.split("_vglMenuInterpretacionUro(docId, labs);").length - 1, 1, "una sola invocación");
    });

    // =====================================================================
    //  PARTE 3 — EL MENÚ CON DOM REAL DEL ARNÉS
    //  Mismo patrón de suite_08: montarDomDePaciente parchea la lectura de
    //  la cédula en pantalla y sirve las casillas por id.
    // =====================================================================
    const _byIdOrig = c.env.doc.getElementById;   // sin el parche del paciente, para ver el modal real
    const modalUro = () => _byIdOrig("vgl-chooser-modal");
    const botonesOpcion = () => { const m = modalUro(); return m ? m.querySelectorAll("[data-chooser-id]") : []; };
    const quitarModal = () => { const m = modalUro(); if (m) m.remove(); };

    let mockDOM = {};
    const montarDomDePaciente = (cedulaEnPantalla) => {
      const prev = {
        qsa: c.env.doc.querySelectorAll,
        qs: c.env.doc.querySelector,
        byId: c.env.doc.getElementById,
      };
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) =>
        (sel === ".text-muted" && cedulaEnPantalla ? [{ textContent: "CC " + cedulaEnPantalla, closest: () => null }] : []);
      c.env.doc.getElementById = (id) => {
        if (id === "anamesis") return { id: "anamesis", tagName: "DIV" };
        if (mockDOM[id]) return mockDOM[id];
        return null;
      };
      return () => {
        c.env.doc.querySelectorAll = prev.qsa;
        c.env.doc.querySelector = prev.qs;
        c.env.doc.getElementById = prev.byId;
      };
    };
    const casillaFalsa = (id, inicial) => ({
      id, tagName: "INPUT", type: "text", dispatchEvent: () => {}, _val: inicial || "",
      set value(v) { this._val = v; }, get value() { return this._val; },
    });

    t.caso("el menú NO abre si la casilla general ya tiene valor (aunque haya recomendación)", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis", "HEMATURIA") };
      const restaurar = montarDomDePaciente("111111");
      testApi._vglMenuInterpretacionUro("111111", [labUro("SANGRE", "++")]);
      t.cierto(!modalUro(), "la casilla del médico o del LIS no se toca: el menú ni se muestra");
      t.igual(mockDOM.resultadoUroanalisis.value, "HEMATURIA", "el valor preexistente queda intacto");
      restaurar(); quitarModal();
    });

    t.caso("el menú NO abre si la vista no tiene la casilla del uroanálisis montada", () => {
      mockDOM = {};
      const restaurar = montarDomDePaciente("111111");
      testApi._vglMenuInterpretacionUro("111111", [labUro("SANGRE", "++")]);
      t.cierto(!modalUro(), "sin casilla no hay nada que ofrecer: silencio");
      restaurar(); quitarModal();
    });

    t.caso("el menú NO abre si el paciente en pantalla cambió entre el llenado y el menú", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis") };
      const restaurar = montarDomDePaciente("222222");
      testApi._vglMenuInterpretacionUro("111111", [labUro("SANGRE", "++")]);
      t.cierto(!modalUro(), "la interpretación de A no se ofrece sobre la historia de B");
      t.igual(mockDOM.resultadoUroanalisis.value, "", "nada se escribió");
      restaurar(); quitarModal();
    });

    t.caso("con casilla vacía y mismo paciente: abre con los 12 términos numerados y la RECOMENDADA primera", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis") };
      const restaurar = montarDomDePaciente("111111");
      testApi._vglMenuInterpretacionUro("111111", [labUro("SANGRE", "++"), labUro("NITRITOS", "NEGATIVO")]);
      const m = modalUro();
      t.cierto(!!m, "el menú se despliega");
      const btns = botonesOpcion();
      t.igual(btns.length, 12, "los 12 términos del léxico, uno por botón");
      const ids = btns.map((b) => b.getAttribute("data-chooser-id"));
      t.igual(new Set(ids).size, 12, "sin duplicados");
      t.igual(ids[0], "HEMATURIA", "la recomendada del motor (sangre ++) va PRIMERA");
      t.igual(btns[0].querySelector(".vgl-chooser-num").textContent, "1", "numerados secuencialmente desde 1");
      t.igual(btns[btns.length - 1].querySelector(".vgl-chooser-num").textContent, "12", "…hasta 12");
      t.igual(btns[0].querySelector(".vgl-chooser-ico").textContent, "⭐", "la ⭐ la distingue de las demás");
      const d0 = btns[0].querySelector(".vgl-chooser-d");
      t.cierto(!!d0 && d0.textContent.indexOf("Recomendado según el parcial") === 0, "la recomendada exhibe su fundamento");
      restaurar(); quitarModal();
    });

    t.caso("sin base clínica (síntomas desconocidos con parcial sugestivo): 12 opciones, NINGUNA marcada como recomendada", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis") };
      const restaurar = montarDomDePaciente("111118");
      testApi._vglMenuInterpretacionUro("111118", [labUro("NITRITOS", "POSITIVO"), labUro("LEUCOCITOS", "10-15 x campo")]);
      const btns = botonesOpcion();
      t.igual(btns.length, 12, "el menú abre igual: la decisión es del médico");
      t.igual(btns[0].getAttribute("data-chooser-id"), "NORMAL", "sin recomendación, el orden del léxico manda");
      t.cierto(!btns.some((b) => b.querySelector(".vgl-chooser-d")), "ninguna opción se presenta como recomendada");
      restaurar(); quitarModal();
    });

    t.caso("elegir la RECOMENDADA la escribe en la casilla, cierra el menú y registra el fundamento", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis") };
      const restaurar = montarDomDePaciente("111112");
      testApi._vglMenuInterpretacionUro("111112", [labUro("SANGRE", "++"), labUro("NITRITOS", "NEGATIVO")]);
      const btns = botonesOpcion();
      t.cierto(btns.length === 12, "precondición: el menú está abierto");
      disparar(btns[0], "click");
      t.igual(mockDOM.resultadoUroanalisis.value, "HEMATURIA", "el término elegido queda en la casilla general");
      t.cierto(!modalUro(), "el menú se cierra tras la elección");
      const lib = JSON.parse(c.env.storage.getItem("vgl_uro_interp") || "{}");
      t.igual(lib["111112"] && lib["111112"].termino, "HEMATURIA", "queda registrada la elección");
      t.cierto(String(lib["111112"] && lib["111112"].fundamento).indexOf("sedimento") >= 0, "y su FUNDAMENTO clínico, no solo el término");
      restaurar(); quitarModal();
    });

    t.caso("elección MANUAL (no la recomendada): se escribe igual y el registro dice «elección manual del médico»", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis") };
      const restaurar = montarDomDePaciente("111113");
      testApi._vglMenuInterpretacionUro("111113", [labUro("SANGRE", "++"), labUro("NITRITOS", "NEGATIVO")]);
      const btn = botonesOpcion().find((b) => b.getAttribute("data-chooser-id") === "CRISTALURIA");
      t.cierto(!!btn, "precondición: CRISTALURIA está en el menú");
      disparar(btn, "click");
      t.igual(mockDOM.resultadoUroanalisis.value, "CRISTALURIA", "el script sugiere, el médico decide");
      const lib = JSON.parse(c.env.storage.getItem("vgl_uro_interp") || "{}");
      t.igual(lib["111113"] && lib["111113"].fundamento, "elección manual del médico", "el registro no falsea la recomendación");
      restaurar(); quitarModal();
    });

    t.caso("cerrar sin elegir (✕): la casilla queda VACÍA y no hay registro", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis") };
      const restaurar = montarDomDePaciente("111114");
      testApi._vglMenuInterpretacionUro("111114", [labUro("SANGRE", "++")]);
      const m = modalUro();
      t.cierto(!!m, "precondición: el menú está abierto");
      disparar(m.querySelector(".vgl-agm-close"), "click");
      t.cierto(!modalUro(), "el menú se cierra");
      t.igual(mockDOM.resultadoUroanalisis.value, "", "la casilla queda vacía: nada se inventa");
      const lib = JSON.parse(c.env.storage.getItem("vgl_uro_interp") || "{}");
      t.cierto(!lib["111114"], "sin elección no hay registro");
      restaurar(); quitarModal();
    });

    t.caso("guarda en el clic: si el paciente cambió CON el menú abierto, no se escribe nada", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis") };
      const restaurar = montarDomDePaciente("111116");
      testApi._vglMenuInterpretacionUro("111116", [labUro("SANGRE", "++")]);
      t.cierto(!!modalUro(), "precondición: el menú está abierto");
      const restaurar2 = montarDomDePaciente("999999");   // el médico abrió otra historia
      const btn = botonesOpcion()[0];
      disparar(btn, "click");
      t.igual(mockDOM.resultadoUroanalisis.value, "", "la interpretación del paciente anterior no se escribió");
      const lib = JSON.parse(c.env.storage.getItem("vgl_uro_interp") || "{}");
      t.cierto(!lib["111116"], "ni quedó registro");
      restaurar2(); restaurar(); quitarModal();
    });

    t.caso("guarda en el clic: si la casilla se llenó CON el menú abierto (LIS/médico), no se pisa", () => {
      mockDOM = { resultadoUroanalisis: casillaFalsa("resultadoUroanalisis") };
      const restaurar = montarDomDePaciente("111117");
      testApi._vglMenuInterpretacionUro("111117", [labUro("SANGRE", "++")]);
      t.cierto(!!modalUro(), "precondición: el menú está abierto");
      mockDOM.resultadoUroanalisis.value = "ANORMAL";      // alguien escribió primero
      const btn = botonesOpcion()[0];
      disparar(btn, "click");
      t.igual(mockDOM.resultadoUroanalisis.value, "ANORMAL", "la casilla del médico es sagrada");
      const lib = JSON.parse(c.env.storage.getItem("vgl_uro_interp") || "{}");
      t.cierto(!lib["111117"], "no se registra una escritura que no ocurrió");
      restaurar(); quitarModal();
    });

    t.caso("si el navegador rechaza la escritura: la casilla queda vacía y no hay registro falso", () => {
      mockDOM = {
        resultadoUroanalisis: {
          id: "resultadoUroanalisis", tagName: "INPUT", type: "text", dispatchEvent: () => {},
          get value() { return ""; }, set value(_v) { /* Everest bloqueó el input */ },
        },
      };
      const restaurar = montarDomDePaciente("111115");
      testApi._vglMenuInterpretacionUro("111115", [labUro("SANGRE", "++")]);
      const btn = botonesOpcion()[0];
      t.cierto(!!btn, "precondición: el menú está abierto");
      disparar(btn, "click");
      t.igual(mockDOM.resultadoUroanalisis.value, "", "el rechazo no deja texto a medias");
      const lib = JSON.parse(c.env.storage.getItem("vgl_uro_interp") || "{}");
      t.cierto(!lib["111115"], "no se registra como escrito lo que no se pudo escribir");
      restaurar(); quitarModal();
    });
  },
};
