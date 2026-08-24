// =====================================================================
//  SUITE 27 — Función renal (R1a): las cuatro fórmulas puras
//
//  Solo la aritmética (TFG por Cockcroft-Gault, TFG por CKD-EPI 2021,
//  estadificación KDIGO y discordancia entre ambas TFG), portada tal cual
//  desde el proyecto hermano Copiloto RCV, ya verificada en producción allí.
//  Sin DOM, sin red, sin estado global. La lectura de peso/talla por red y el
//  disparo por paciente/día son de otro PR (R1b) — no se cubren aquí.
//
//  Vectores calculados y verificados independientemente antes de escribir la
//  implementación: si la implementación no los reproduce, la implementación
//  está mal, no el vector.
// =====================================================================
module.exports = {
  nombre: "Función renal (R1)",
  cubre: ["cockcroftGault", "ckdEpi2021", "estadioKDIGO", "evaluarDiscordanciaTFG", "_esSexoFemenino"],

  pruebas(t, api) {
    // ---------- _esSexoFemenino ----------
    t.caso("_esSexoFemenino - reconoce 'F', 'FEMENINO' ignorando mayúsculas y espacios", () => {
      t.cierto(api._esSexoFemenino("F"));
      t.cierto(api._esSexoFemenino("f"));
      t.cierto(api._esSexoFemenino("FEMENINO"));
      t.cierto(api._esSexoFemenino("femenino"));
      t.cierto(api._esSexoFemenino("  f  "));
      t.cierto(api._esSexoFemenino("  FEMENINO  "));
      t.falso(api._esSexoFemenino("M"));
      t.falso(api._esSexoFemenino("m"));
      t.falso(api._esSexoFemenino("MASCULINO"));
      t.falso(api._esSexoFemenino("masculino"));
      t.falso(api._esSexoFemenino(null));
      t.falso(api._esSexoFemenino(undefined));
      t.falso(api._esSexoFemenino(""));
    });

    t.caso("cockcroftGault - caso 'paciente obesa' que motivó usar peso real (peso 113kg)", () => {
      t.igual(api.cockcroftGault(63, 113, 0.55, "F"), 186.8);
      t.igual(api.cockcroftGault(63, 113, 0.55, "M"), 219.7);
    });

    t.caso("cockcroftGault - caso general, ambos sexos", () => {
      t.igual(api.cockcroftGault(55, 70, 1.1, "M"), 75.1);
      t.igual(api.cockcroftGault(55, 70, 1.1, "F"), 63.9);
    });

    t.caso("cockcroftGault - centinelas (edad<=0, creatinina<=0, edad>=140 -> 0, no evaluable)", () => {
      t.igual(api.cockcroftGault(0, 70, 1, "M"), 0);
      t.igual(api.cockcroftGault(55, 70, 0, "M"), 0);
      t.igual(api.cockcroftGault(140, 70, 1, "M"), 0);
    });

    t.caso("ckdEpi2021 - casos verificados independientemente", () => {
      t.igual(api.ckdEpi2021(63, 0.55, "F"), 102.9);
      t.igual(api.ckdEpi2021(55, 1.1, "M"), 79.3);
      t.igual(api.ckdEpi2021(55, 1.1, "F"), 59.3);
      t.igual(api.ckdEpi2021(55, 2.5, "M"), 29.6);
    });

    t.caso("ckdEpi2021 - centinela (creatinina<=0 -> 0, no evaluable)", () => {
      t.igual(api.ckdEpi2021(55, 0, "M"), 0);
    });

    t.caso("estadioKDIGO - cada frontera exacta de los seis estadios", () => {
      t.igual(api.estadioKDIGO(90), "G1");
      t.igual(api.estadioKDIGO(89.9), "G2");
      t.igual(api.estadioKDIGO(60), "G2");
      t.igual(api.estadioKDIGO(59.9), "G3a");
      t.igual(api.estadioKDIGO(45), "G3a");
      t.igual(api.estadioKDIGO(44.9), "G3b");
      t.igual(api.estadioKDIGO(30), "G3b");
      t.igual(api.estadioKDIGO(29.9), "G4");
      t.igual(api.estadioKDIGO(15), "G4");
      t.igual(api.estadioKDIGO(14.9), "G5");
    });

    // v14.1.3 — El peor fallo posible de esta función, y estaba escondido en la aritmética
    // de JavaScript: TODA comparación de orden con NaN es false, así que un valor no
    // numérico caía por los seis `if` y salía por el `return "G5"` del final — falla renal
    // terminal a partir de un dato que ni siquiera se pudo leer. Lo mismo con el centinela 0
    // que devuelven cockcroftGault/ckdEpi2021 para decir "no evaluable".
    t.caso("estadioKDIGO - un valor NO evaluable devuelve null, JAMÁS G5 (el estadio más grave)", () => {
      t.igual(api.estadioKDIGO(0), null, "0 es el centinela 'no evaluable' de las dos fórmulas, no una TFG de cero");
      t.igual(api.estadioKDIGO(NaN), null);
      t.igual(api.estadioKDIGO(null), null);
      t.igual(api.estadioKDIGO(undefined), null);
      t.igual(api.estadioKDIGO(""), null);
      t.igual(api.estadioKDIGO("PENDIENTE"), null);
      t.igual(api.estadioKDIGO("> 60"), null, "el texto con desigualdad del LIS no es un número");
      t.igual(api.estadioKDIGO(-5), null, "una TFG negativa es un dato corrupto, no un estadio");
    });

    t.caso("estadioKDIGO - una TFG real muy baja SÍ es G5 (no se confunde con 'no evaluable')", () => {
      t.igual(api.estadioKDIGO(14.9), "G5");
      t.igual(api.estadioKDIGO(3), "G5");
      t.igual(api.estadioKDIGO(0.1), "G5", "por encima de cero, por bajo que sea, es una TFG medida");
    });

    t.caso("evaluarDiscordanciaTFG - diferencia de 2 estadios SÍ es alerta (v16.9.0, umbral del médico)", () => {
      // v16.9.0 — mismo umbral que mtrEvaluarDiscrepanciaEstadios: la alerta empieza en DOS
      // estadios (decisión del médico); desde TRES se pide además revisar el dato.
      const d = api.evaluarDiscordanciaTFG(95, 50);
      t.cierto(d && d.alerta === true, "a partir de 2 estadios la alerta se dispara");
      t.igual(d.sospechaDatoCorrupto, false, "con 2 estadios avisa pero no pide revisar el dato (eso es desde 3)");
      t.igual(d.estadioCG, "G1");
      t.igual(d.estadioCKD, "G3a");
      t.igual(d.diferenciaEstadios, 2);
    });

    t.caso("evaluarDiscordanciaTFG - diferencia de 3 estadios SÍ es alerta", () => {
      const d = api.evaluarDiscordanciaTFG(95, 35);
      t.cierto(d && d.alerta === true, "se esperaba alerta:true");
      t.igual(d.estadioCG, "G1");
      t.igual(d.estadioCKD, "G3b");
      t.igual(d.diferenciaEstadios, 3);
      t.cierto(typeof d.mensaje === "string" && d.mensaje.length > 0, "se esperaba un mensaje no vacío");
    });

    t.caso("evaluarDiscordanciaTFG - cualquier TFG en 0/centinela no es evaluable", () => {
      t.igual(api.evaluarDiscordanciaTFG(0, 50), null);
    });
  },
};
