// =====================================================================
//  SUITE 40 — Interacciones farmacológicas
//
//  Las reglas de dosis renal miran un fármaco a la vez. Estas miran la lista
//  entera: hay combinaciones seguras fármaco a fármaco y peligrosas juntas.
//
//  La suite 43 contrasta las 8 reglas contra 1.008 vectores del Copiloto. Esta
//  comprueba lo que el contraste no ve: que las combinaciones clínicas que
//  motivan cada regla disparen de verdad, que las parciales NO disparen, y que
//  el orden de presentación ponga primero lo que puede matar.
// =====================================================================
module.exports = {
  nombre: "Interacciones farmacológicas (motor portado)",
  cubre: [
    "mtrEvaluarInteracciones", "mtrUnirFarmacos", "mtrAlertaInteraccion",
    "mtrAvisosFarmacologicos",
  ],

  pruebas(t, api) {
    const tipos = (r) => r.map((a) => a.tipo_interaccion).sort();
    const uno = (meds, tfg, k) => api.mtrEvaluarInteracciones(meds, tfg === undefined ? 60 : tfg, k === undefined ? null : k);

    // ---------- 1. Triple Whammy ----------

    t.caso("Triple Whammy: las tres patas juntas disparan; dos no", () => {
      const tres = ["LOSARTAN 50 MG", "HIDROCLOROTIAZIDA 25 MG", "IBUPROFENO 400 MG"];
      t.cierto(tipos(uno(tres)).indexOf("TRIPLE_WHAMMY") >= 0);
      // quitar cualquiera de las tres lo apaga
      t.igual(tipos(uno(["LOSARTAN 50 MG", "HIDROCLOROTIAZIDA 25 MG"])).indexOf("TRIPLE_WHAMMY"), -1, "sin AINE");
      t.igual(tipos(uno(["LOSARTAN 50 MG", "IBUPROFENO 400 MG"])).indexOf("TRIPLE_WHAMMY"), -1, "sin diurético");
      t.igual(tipos(uno(["HIDROCLOROTIAZIDA 25 MG", "IBUPROFENO 400 MG"])).indexOf("TRIPLE_WHAMMY"), -1, "sin IECA/ARA-II");
    });

    t.caso("Triple Whammy: el diurético de asa cuenta igual que la tiazida", () => {
      t.cierto(tipos(uno(["ENALAPRIL 10 MG", "FUROSEMIDA 40 MG", "NAPROXENO 500 MG"]))
        .indexOf("TRIPLE_WHAMMY") >= 0, "furosemida también es diurético");
    });

    t.caso("Triple Whammy es CRITICAL y nombra a los tres implicados", () => {
      const a = uno(["LOSARTAN 50 MG", "HIDROCLOROTIAZIDA 25 MG", "IBUPROFENO 400 MG"])
        .filter((x) => x.tipo_interaccion === "TRIPLE_WHAMMY")[0];
      t.igual(a.severidad, "CRITICAL");
      t.igual(a.conducta, "SUSPENDER");
      t.igual(a.par_farmacos.length, 3);
      t.cierto(a.mecanismo.indexOf("aferente") >= 0, "el mecanismo tiene que explicar el porqué");
    });

    // ---------- 2 a 8 ----------

    t.caso("doble bloqueo del SRAA: IECA + ARA-II a la vez", () => {
      t.cierto(tipos(uno(["ENALAPRIL 10 MG", "LOSARTAN 50 MG"])).indexOf("DOBLE_BLOQUEO_SRAA") >= 0);
      t.igual(tipos(uno(["ENALAPRIL 10 MG", "CAPTOPRIL 25 MG"])).indexOf("DOBLE_BLOQUEO_SRAA"), -1,
        "dos IECA no son doble bloqueo: hace falta uno de cada eje");
      t.igual(tipos(uno(["LOSARTAN 50 MG", "VALSARTAN 80 MG"])).indexOf("DOBLE_BLOQUEO_SRAA"), -1);
    });

    t.caso("gemfibrozilo + estatina: rabdomiólisis, y el fenofibrato NO dispara", () => {
      t.cierto(tipos(uno(["GEMFIBROZILO 600 MG", "ATORVASTATINA 40 MG"])).indexOf("GEMFIBROZILO_ESTATINA") >= 0);
      t.igual(tipos(uno(["FENOFIBRATO 145 MG", "ATORVASTATINA 40 MG"])).indexOf("GEMFIBROZILO_ESTATINA"), -1,
        "el fenofibrato es justo el reemplazo que la alerta recomienda");
    });

    t.caso("hiperkalemia sinérgica: sube a CRITICAL solo con K+ >= 5,5", () => {
      const meds = ["LOSARTAN 50 MG", "ESPIRONOLACTONA 25 MG", "CLORURO DE POTASIO"];
      const norm = uno(meds, 60, 5.0).filter((a) => a.tipo_interaccion === "HIPERKALEMIA_SINERGICA")[0];
      const grave = uno(meds, 60, 5.5).filter((a) => a.tipo_interaccion === "HIPERKALEMIA_SINERGICA")[0];
      t.igual(norm.severidad, "HIGH");
      t.igual(grave.severidad, "CRITICAL");
    });

    t.caso("hiperkalemia: IECA + espironolactona sin suplemento solo dispara con K+ alto o riñón malo", () => {
      const meds = ["LOSARTAN 50 MG", "ESPIRONOLACTONA 25 MG"];
      t.igual(tipos(uno(meds, 60, 4.0)).indexOf("HIPERKALEMIA_SINERGICA"), -1, "riñón bien y K+ normal");
      t.cierto(tipos(uno(meds, 60, 5.0)).indexOf("HIPERKALEMIA_SINERGICA") >= 0, "K+ en el corte");
      t.cierto(tipos(uno(meds, 25, 4.0)).indexOf("HIPERKALEMIA_SINERGICA") >= 0, "eGFR < 30");
    });

    // =================================================================
    //  v18.0.45 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta.
    //
    //  `egfr` llega en `null` cuando la función renal NUNCA se ha medido: paciente nuevo,
    //  o falta el peso para calcularla. Las dos comparaciones eran `egfr < 30` y
    //  `egfr < 60` a pelo, y en JavaScript `null < 30` es TRUE (null se convierte a 0).
    //  O sea: un paciente sin función renal medida se evaluaba como si tuviera una eGFR
    //  de CERO, y salían dos avisos farmacológicos de severidad alta sobre una cifra que
    //  nadie midió. «Casilla vacía antes que dato inventado», del lado peor: un aviso
    //  falso o gasta la atención del médico, o le hace suspender un fármaco por un dato
    //  que no existe.
    // =================================================================
    t.caso("SIN función renal medida (eGFR null) no se inventa una eGFR de cero", () => {
      const conEspiro = ["LOSARTAN 50 MG", "ESPIRONOLACTONA 25 MG"];
      t.igual(tipos(uno(conEspiro, null, 4.0)).indexOf("HIPERKALEMIA_SINERGICA"), -1,
        "sin eGFR medida y con K+ normal NO se afirma riesgo de hiperkalemia por riñón");
      t.cierto(tipos(uno(conEspiro, 25, 4.0)).indexOf("HIPERKALEMIA_SINERGICA") >= 0,
        "y con una eGFR REAL de 25 sigue disparando, como debe (control de la otra dirección)");

      const conContraste = ["METFORMINA 850 MG", "MEDIO DE CONTRASTE YODADO"];
      t.igual(tipos(uno(conContraste, null, null)).indexOf("METFORMINA_CONTRASTE"), -1,
        "sin eGFR medida no se manda suspender la metformina");
      t.cierto(tipos(uno(conContraste, 45, null)).indexOf("METFORMINA_CONTRASTE") >= 0,
        "con eGFR real de 45 sí se manda, como debe");

      // Y el K+ alto sigue mandando por su cuenta aunque no haya función renal: la regla
      // tiene DOS disparadores y solo se desactivó el que dependía de una cifra ausente.
      t.cierto(tipos(uno(conEspiro, null, 5.2)).indexOf("HIPERKALEMIA_SINERGICA") >= 0,
        "con K+ de 5,2 medido de verdad, el aviso sale aunque la función renal falte");

      // Una eGFR que no es número (texto de una lectura fallida) tampoco vale como cero.
      t.igual(tipos(uno(conContraste, "no legible", null)).indexOf("METFORMINA_CONTRASTE"), -1,
        "una eGFR ilegible no es una eGFR baja");
    });

    t.caso("anticoagulante directo + AINE", () => {
      t.cierto(tipos(uno(["RIVAROXABAN 20 MG", "IBUPROFENO 400 MG"])).indexOf("RIESGO_SANGRADO_AINE_DOAC") >= 0);
      t.igual(tipos(uno(["WARFARINA 5 MG", "IBUPROFENO 400 MG"])).indexOf("RIESGO_SANGRADO_AINE_DOAC"), -1,
        "la warfarina no es un DOAC: esta regla no la cubre");
    });

    t.caso("metformina + contraste: solo con la función renal ya comprometida", () => {
      const meds = ["METFORMINA 850 MG", "MEDIO DE CONTRASTE YODADO"];
      t.igual(tipos(uno(meds, 60)).indexOf("METFORMINA_CONTRASTE"), -1, "eGFR 60 justo: no dispara");
      t.cierto(tipos(uno(meds, 59)).indexOf("METFORMINA_CONTRASTE") >= 0);
      t.cierto(tipos(uno(meds, 25)).indexOf("METFORMINA_CONTRASTE") >= 0);
    });

    t.caso("betabloqueador + calcioantagonista no dihidropiridínico", () => {
      t.cierto(tipos(uno(["METOPROLOL 50 MG", "VERAPAMILO 80 MG"])).indexOf("BETA_CCB_NODHP") >= 0);
      t.cierto(tipos(uno(["CARVEDILOL 6.25 MG", "DILTIAZEM 60 MG"])).indexOf("BETA_CCB_NODHP") >= 0);
      t.igual(tipos(uno(["METOPROLOL 50 MG", "AMLODIPINO 5 MG"])).indexOf("BETA_CCB_NODHP"), -1,
        "el amlodipino SÍ es dihidropiridínico: no entra");
    });

    t.caso("iSGLT2 + sulfonilurea: hipoglucemia por sinergia", () => {
      t.cierto(tipos(uno(["EMPAGLIFLOZINA 10 MG", "GLIBENCLAMIDA 5 MG"])).indexOf("SGLT2_SULFONILUREA") >= 0);
      t.igual(tipos(uno(["EMPAGLIFLOZINA 10 MG", "METFORMINA 850 MG"])).indexOf("SGLT2_SULFONILUREA"), -1);
    });

    // ---------- el paciente que las tiene casi todas ----------

    t.caso("un polimedicado real levanta varias alertas a la vez, sin repetirlas", () => {
      const r = uno(["ENALAPRIL 10 MG", "HIDROCLOROTIAZIDA 25 MG", "IBUPROFENO 400 MG",
        "ESPIRONOLACTONA 25 MG", "CLORURO DE POTASIO", "RIVAROXABAN 20 MG",
        "GEMFIBROZILO 600 MG", "ATORVASTATINA 40 MG", "VERAPAMILO 80 MG",
        "METOPROLOL 50 MG", "EMPAGLIFLOZINA 10 MG", "GLIBENCLAMIDA 5 MG"], 25, 5.6);
      const ts = tipos(r);
      for (const esperado of ["TRIPLE_WHAMMY", "GEMFIBROZILO_ESTATINA", "HIPERKALEMIA_SINERGICA",
        "RIESGO_SANGRADO_AINE_DOAC", "BETA_CCB_NODHP", "SGLT2_SULFONILUREA"]) {
        t.cierto(ts.indexOf(esperado) >= 0, "faltó " + esperado);
      }
      t.igual(ts.length, new Set(ts).size, "hay tipos de interacción repetidos");
    });

    // ---------- higiene ----------

    t.caso("sin medicamentos o con basura no hay alertas ni excepciones", () => {
      t.igual(uno([]), []);
      t.igual(uno(null), []);
      t.igual(uno(undefined), []);
      for (const l of [[null], [""], ["   "], [undefined, null]]) {
        t.noLanza(() => uno(l), JSON.stringify(l));
        t.igual(uno(l), [], JSON.stringify(l));
      }
    });

    t.caso("el orden de par_farmacos es estable, no como en el Copiloto", () => {
      // En Python sale de un list(set(...)): el orden cambia entre procesos.
      // Aquí va ordenado, para que dos situaciones clínicas idénticas produzcan
      // el mismo texto — importa si ese texto llega a una nota firmada.
      const meds = ["LOSARTAN 50 MG", "HIDROCLOROTIAZIDA 25 MG", "IBUPROFENO 400 MG"];
      const a = uno(meds)[0].par_farmacos;
      const b = uno(meds.slice().reverse())[0].par_farmacos;
      t.igual(a, b, "el mismo conjunto de fármacos debe dar la misma lista, venga en el orden que venga");
      t.igual(a, a.slice().sort(), "y tiene que venir ordenada");
    });

    t.caso("mtrAlertaInteraccion arma la alerta con las claves que el Copiloto espera", () => {
      // El orden de las claves importa: la suite 43 compara el objeto
      // serializado contra el model_dump() del pydantic del Copiloto.
      const a = api.mtrAlertaInteraccion(["A", "B"], "TIPO_X", "EVITAR", "mensaje", "HIGH", "mecanismo");
      t.igual(Object.keys(a),
        ["par_farmacos", "tipo_interaccion", "conducta", "mensaje", "severidad", "mecanismo", "override_llm"],
        "cambió el juego o el orden de las claves: el contraste con el Copiloto se rompe");
      t.cierto(a.override_llm === true, "una alerta determinista sobrescribe al LLM por definición");
      t.igual(api.mtrAlertaInteraccion([], "T", "C", "M", "HIGH").mecanismo, "",
        "sin mecanismo tiene que quedar cadena vacía, nunca undefined: iría al JSON como ausente");
    });

    t.caso("mtrUnirFarmacos quita repetidos, ordena y aguanta huecos", () => {
      t.igual(api.mtrUnirFarmacos(["b", "a"], ["a", "c"]), ["a", "b", "c"]);
      t.igual(api.mtrUnirFarmacos(null, undefined, ["x"]), ["x"]);
      t.igual(api.mtrUnirFarmacos(), []);
    });

    // ---------- la vista que ve el médico ----------

    t.caso("la vista combinada pone primero lo CRITICAL", () => {
      const r = api.mtrAvisosFarmacologicos({
        medicamentos: ["ENALAPRIL 10 MG", "HIDROCLOROTIAZIDA 25 MG", "IBUPROFENO 400 MG",
          "METFORMINA 850 MG", "ATENOLOL 50 MG"],
        tfgCkdEpi: 25, tfgCockcroftGault: 26,
      });
      t.cierto(r.todo.length >= 2);
      const sev = r.todo.map((a) => a.severidad);
      const orden = { CRITICAL: 0, HIGH: 1, INFO: 2 };
      for (let i = 1; i < sev.length; i++) {
        t.cierto(orden[sev[i - 1]] <= orden[sev[i]],
          "en consulta nadie lee la tercera línea: lo grave va primero (" + sev.join(",") + ")");
      }
    });

    t.caso("la vista combinada separa dosis renal de interacciones, y conserva el motivo", () => {
      const r = api.mtrAvisosFarmacologicos({
        medicamentos: ["ENALAPRIL 10 MG", "HIDROCLOROTIAZIDA 25 MG", "IBUPROFENO 400 MG"],
        tfgCkdEpi: 25, tfgCockcroftGault: 26,
      });
      t.cierto(r.avisos.length > 0, "el AINE con eGFR 25 es aviso de dosis renal");
      t.cierto(r.interacciones.length > 0, "y las tres juntas son Triple Whammy");
      t.igual(r.todo.length, r.avisos.length + r.interacciones.length);
      t.igual(r.motivo, "OK");
    });

    t.caso("sin lista de medicamentos, la vista combinada tampoco dice 'todo bien'", () => {
      const r = api.mtrAvisosFarmacologicos({});
      t.igual(r.motivo, "SIN_LISTA_DE_MEDICAMENTOS");
      t.igual(r.avisos, []);
      t.igual(r.interacciones, []);
      t.cierto(/no significa que no haya riesgo/i.test(r.legible));
    });

    t.caso("sin función renal no se juzgan interacciones que dependen de ella", () => {
      const r = api.mtrAvisosFarmacologicos({ medicamentos: ["METFORMINA 850 MG"] });
      t.igual(r.motivo, "SIN_FUNCION_RENAL");
      t.igual(r.interacciones, []);
    });
  },
};
