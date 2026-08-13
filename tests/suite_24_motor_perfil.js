module.exports = {
  nombre: "Motor de perfil (D3-bis)",
  cubre: ["perfilPaciente", "recomendacionHorario", "clasificaCupoAgenda"],
  pruebas(t, api) {
    t.caso("Eje A (franja) - diabéticos obtienen primera mitad", () => {
      t.igual(api.perfilPaciente(["Diabetes"]).franja, "primera_mitad");
      t.igual(api.perfilPaciente(["HTA+DM"]).franja, "primera_mitad");
      t.igual(api.perfilPaciente(["HTA + DM"]).franja, "primera_mitad");
      t.igual(api.perfilPaciente(["hta/dm"]).franja, "primera_mitad");
    });

    t.caso("Eje A (franja) - perfiles sin preferencia", () => {
      t.igual(api.perfilPaciente(["Hipertensión"]).franja, "sin_preferencia");
      t.igual(api.perfilPaciente(["Nefroprotección"]).franja, "sin_preferencia");
      t.igual(api.perfilPaciente(["Hipertensión","Nefroprotección"]).franja, "sin_preferencia");
      t.igual(api.perfilPaciente([]).franja, "sin_preferencia");
      t.igual(api.perfilPaciente(null).franja, "sin_preferencia");
    });

    t.caso("Eje A (franja) - Nefroprotección y Diabetes: gana primera mitad", () => {
      t.igual(api.perfilPaciente(["Nefroprotección","Diabetes"]).franja, "primera_mitad");
      t.igual(api.perfilPaciente(["Nefroprotección","HTA+DM"]).franja, "primera_mitad");
    });

    t.caso("Eje B (cupos adicionales) - solo hipertenso sin DM ni Nefro", () => {
      t.igual(api.perfilPaciente(["Hipertensión"]).adicionales, true);
    });

    t.caso("Eje B (cupos adicionales) - Diabetes o Nefro excluyen adicionales", () => {
      t.igual(api.perfilPaciente(["Diabetes"]).adicionales, false);
      t.igual(api.perfilPaciente(["HTA+DM"]).adicionales, false);
      t.igual(api.perfilPaciente(["Nefroprotección"]).adicionales, false);
      t.igual(api.perfilPaciente(["Nefroprotección","Hipertensión"]).adicionales, false);
      t.igual(api.perfilPaciente(["Hipertensión","Nefroprotección"]).adicionales, false);
      t.igual(api.perfilPaciente(["Nefroprotección","Diabetes"]).adicionales, false);
      t.igual(api.perfilPaciente(["Nefroprotección","HTA+DM"]).adicionales, false);
    });

    t.caso("Eje B (cupos adicionales) - vacíos/desconocidos quedan visibles pero no recomendados", () => {
      t.igual(api.perfilPaciente([]).adicionales, "visibles");
      t.igual(api.perfilPaciente(null).adicionales, "visibles");
      t.igual(api.perfilPaciente(["Desconocido"]).adicionales, "visibles");
    });

    t.caso("RecomendacionHorario - primera mitad PM pura", () => {
      // turnos reales, todos PM, de 13:00 a 16:00
      const turnos = [
        { hora: "13:00" },
        { hora: "14:00" },
        { hora: "15:00" },
        { hora: "16:00" },
        { hora: "16:20" }
      ];
      const rec = api.recomendacionHorario({ franja: "primera_mitad" }, turnos);
      t.igual(rec.rangoTexto, "PM 13:00–16:00");
      t.igual(rec.sugerida, "13:00");
      t.cierto(rec.horasEnFranja.includes("13:00"));
      t.cierto(rec.horasEnFranja.includes("16:00"));
      t.falso(rec.horasEnFranja.includes("16:20"));
    });

    t.caso("RecomendacionHorario - primera mitad AM pura", () => {
      const turnos = [
        { hora: "06:00" },
        { hora: "08:00" },
        { hora: "09:00" },
        { hora: "09:20" }
      ];
      const rec = api.recomendacionHorario({ franja: "primera_mitad" }, turnos);
      t.igual(rec.rangoTexto, "AM 06:00–09:00");
      t.igual(rec.sugerida, "06:00");
      t.cierto(rec.horasEnFranja.includes("06:00"));
      t.cierto(rec.horasEnFranja.includes("09:00"));
      t.falso(rec.horasEnFranja.includes("09:20"));
    });

    t.caso("RecomendacionHorario - ambas jornadas, AM gana por hora", () => {
      const turnos = [
        { hora: "07:00" },
        { hora: "13:00" }
      ];
      const rec = api.recomendacionHorario({ franja: "primera_mitad" }, turnos);
      t.igual(rec.rangoTexto, "AM 06:00–09:00 y PM 13:00–16:00");
      t.igual(rec.sugerida, "07:00");
      t.cierto(rec.horasEnFranja.includes("07:00"));
      t.cierto(rec.horasEnFranja.includes("13:00"));
    });

    t.caso("RecomendacionHorario - sin preferencia", () => {
      const rec = api.recomendacionHorario({ franja: "sin_preferencia" }, [{hora:"08:00"}]);
      t.falso(rec.sugerida);
      t.igual(rec.horasEnFranja.length, 0);
    });

    t.caso("RecomendacionHorario - ningún turno en la franja", () => {
      const turnos = [
        { hora: "10:00" },
        { hora: "17:00" }
      ];
      const rec = api.recomendacionHorario({ franja: "primera_mitad" }, turnos);
      t.igual(rec.sugerida, null, "No debe inventar una sugerencia si no hay turno");
      t.igual(rec.horasEnFranja.length, 0);
    });

    t.caso("RecomendacionHorario - normalizeHora funciona y preselecciona primera disponible", () => {
      const turnos = [
        { hora: "08:00 AM" }, // 08:00
        { hora: "07:40" },    // 07:40 (es menor, debería ganar)
        { hora: "06:20:00" }  // 06:20 (aún menor, gana)
      ];
      const rec = api.recomendacionHorario({ franja: "primera_mitad" }, turnos);
      t.igual(rec.sugerida, "06:20");
    });

    t.caso("Clasifica cupo agenda - valores normales", () => {
      t.igual(api.clasificaCupoAgenda("Normal"), "normal");
      t.igual(api.clasificaCupoAgenda("normal"), "normal");
    });

    t.caso("Clasifica cupo agenda - valores adicionales (con y sin staff)", () => {
      t.igual(api.clasificaCupoAgenda("Adicional"), "adicional");
      t.igual(api.clasificaCupoAgenda("adicional"), "adicional");
      t.igual(api.clasificaCupoAgenda("Adicional-Staff"), "adicional");
      t.igual(api.clasificaCupoAgenda("adicional-staff"), "adicional");
    });

    t.caso("Clasifica cupo agenda - vacíos, nulos y desconocidos no asumen normalidad", () => {
      t.igual(api.clasificaCupoAgenda(""), "desconocido");
      t.igual(api.clasificaCupoAgenda(null), "desconocido");
      t.igual(api.clasificaCupoAgenda(undefined), "desconocido");
      t.igual(api.clasificaCupoAgenda("cualquierotra"), "desconocido");
    });
  }
};
