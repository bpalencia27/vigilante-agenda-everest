module.exports = {
  nombre: "Motor de perfil y recomendaciones T3",
  cubre: ["perfilPaciente", "recomendacionHorario"],
  pruebas(t, api, env, cargar) {
    t.caso("perfilPaciente: Diabetes -> primera mitad, NO adicionales", () => {
      const c = cargar();
      const p1 = c.api.perfilPaciente(["Diabetes"]);
      t.igual(p1.franja, "primera_mitad");
      t.igual(p1.adicionales, "no_recomendados");

      const p2 = c.api.perfilPaciente(["HTA+DM"]);
      t.igual(p2.franja, "primera_mitad");
      t.igual(p2.adicionales, "no_recomendados");

      const p3 = c.api.perfilPaciente(["HTA + DM"]);
      t.igual(p3.franja, "primera_mitad");

      const p4 = c.api.perfilPaciente(["hta/dm"]);
      t.igual(p4.franja, "primera_mitad");
    });

    t.caso("perfilPaciente: Hipertension -> sin preferencia, SÍ adicionales", () => {
      const c = cargar();
      const p = c.api.perfilPaciente(["Hipertensión"]);
      t.igual(p.franja, "sin_preferencia");
      t.igual(p.adicionales, "recomendados");
    });

    t.caso("perfilPaciente: Nefroproteccion -> sin preferencia, NO adicionales", () => {
      const c = cargar();
      const p = c.api.perfilPaciente(["Nefroprotección"]);
      t.igual(p.franja, "sin_preferencia");
      t.igual(p.adicionales, "no_recomendados");
    });

    t.caso("perfilPaciente: Hipertension + Nefroproteccion -> sin preferencia, NO adicionales", () => {
      const c = cargar();
      const p = c.api.perfilPaciente(["Hipertensión", "Nefroprotección"]);
      t.igual(p.franja, "sin_preferencia");
      t.igual(p.adicionales, "no_recomendados");
    });

    t.caso("perfilPaciente: Nefroprotección + Diabetes -> primera mitad, NO adicionales", () => {
      const c = cargar();
      const p = c.api.perfilPaciente(["Nefroprotección", "Diabetes"]);
      t.igual(p.franja, "primera_mitad", "Nefroprotección NO debe anular la franja de diabetes");
      t.igual(p.adicionales, "no_recomendados");
    });

    t.caso("perfilPaciente: Nefroprotección + HTA+DM -> primera mitad, NO adicionales", () => {
      const c = cargar();
      const p = c.api.perfilPaciente(["Nefroprotección", "HTA+DM"]);
      t.igual(p.franja, "primera_mitad");
      t.igual(p.adicionales, "no_recomendados");
    });

    t.caso("perfilPaciente: Independencia del orden", () => {
      const c = cargar();
      const p1 = c.api.perfilPaciente(["Nefroprotección", "Hipertensión"]);
      const p2 = c.api.perfilPaciente(["Hipertensión", "Nefroprotección"]);
      t.igual(p1.franja, p2.franja);
      t.igual(p1.adicionales, p2.adicionales);
    });

    t.caso("perfilPaciente: Ninguna / Desconocida -> SIN_ETIQUETA, visibles", () => {
      const c = cargar();
      const p = c.api.perfilPaciente(["Rinitis"]);
      t.igual(p.franja, "sin_preferencia");
      t.igual(p.adicionales, "visibles");

      const p2 = c.api.perfilPaciente(null);
      t.igual(p2.franja, "sin_preferencia");
      t.igual(p2.adicionales, "visibles");
      t.igual(p2.id, "SIN_ETIQUETA");
    });

    t.caso("recomendacionHorario: Franja AM incluye 09:00 pero no 09:20", () => {
      const c = cargar();
      const perfil = { franja: "primera_mitad" };
      const turnos = [
        { hora: "08:00" },
        { hora: "09:00" },
        { hora: "09:20" },
        { hora: "10:00" }
      ];
      const r = c.api.recomendacionHorario(perfil, turnos);
      t.cierto(r.jornadaAM);
      t.falso(r.jornadaPM);
      t.cierto(r.sugeridos.includes("08:00"));
      t.cierto(r.sugeridos.includes("09:00"), "09:00 debe estar dentro");
      t.falso(r.sugeridos.includes("09:20"), "09:20 debe estar fuera");
      t.falso(r.sugeridos.includes("10:00"));
      t.igual(c.api.normalizeHora(r.horaRecomendada.hora), "08:00", "El primero de la franja se recomienda");
    });

    t.caso("recomendacionHorario: Franja PM incluye 16:00 pero no 16:20", () => {
      const c = cargar();
      const perfil = { franja: "primera_mitad" };
      const turnos = [
        { hora: "13:00" },
        { hora: "16:00" },
        { hora: "16:20" }
      ];
      const r = c.api.recomendacionHorario(perfil, turnos);
      t.falso(r.jornadaAM);
      t.cierto(r.jornadaPM);
      t.cierto(r.sugeridos.includes("13:00"));
      t.cierto(r.sugeridos.includes("16:00"), "16:00 debe estar dentro");
      t.falso(r.sugeridos.includes("16:20"), "16:20 debe estar fuera");
    });

    t.caso("recomendacionHorario: Sin turnos en la franja", () => {
      const c = cargar();
      const perfil = { franja: "primera_mitad" };
      const turnos = [
        { hora: "10:00" },
        { hora: "11:00" }
      ];
      const r = c.api.recomendacionHorario(perfil, turnos);
      t.cierto(r.jornadaAM);
      t.igual(r.sugeridos.length, 0);
      t.igual(r.horaRecomendada, null);
    });
  }
};
