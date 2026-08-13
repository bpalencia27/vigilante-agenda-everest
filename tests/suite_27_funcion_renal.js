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
  cubre: ["cockcroftGault", "ckdEpi2021", "estadioKDIGO", "evaluarDiscordanciaTFG"],

  pruebas(t, api) {
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

    t.caso("evaluarDiscordanciaTFG - diferencia de 2 estadios no es alerta", () => {
      t.igual(api.evaluarDiscordanciaTFG(95, 50), null);
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
