module.exports = {
  nombre: "Motor de perfil (D3-bis)",
  cubre: ["perfilPaciente", "recomendacionHorario", "clasificaCupoAgenda", "esCupoAdicional"],
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
      t.igual(api.perfilPaciente(["HTA"]).adicionales, true);
      t.igual(api.perfilPaciente(["hta"]).adicionales, true);
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
    // v14.0.0 — El encargo del médico (12-ago) eran DOS cosas: «se deben repintar de otro
    // color Y escoger alguna de esas como sugerida». Solo se hacía la segunda: se marcaba
    // UNA hora con la insignia ⭐ y `horasEnFranja` —que recomendacionHorario YA calculaba—
    // se descartaba sin usar, así que las demás horas de la franja recomendada se veían
    // exactamente igual que las de fuera. Esta prueba fija el contrato del que depende el
    // repintado en openAgendamientoModal: la franja debe traer TODAS sus horas, no solo la
    // elegida, y la sugerida debe ser una de ellas.
    t.caso("v14 (repinte de franja) - horasEnFranja trae TODO el bloque recomendado, no solo la sugerida", () => {
      const perfil = api.perfilPaciente(["Diabetes"]);
      const rec = api.recomendacionHorario(perfil, [
        { hora: "06:30" }, { hora: "07:00" }, { hora: "08:15" },   // dentro de AM 06:00-09:00
        { hora: "10:00" }, { hora: "11:30" },                       // fuera de franja
        { hora: "14:00" },                                          // dentro de PM 13:00-16:00
        { hora: "17:00" },                                          // fuera de franja
      ]);
      t.igual(rec.sugerida, "06:30", "la sugerida es la más temprana de la franja");
      t.cierto(rec.horasEnFranja.includes("06:30") && rec.horasEnFranja.includes("07:00") &&
               rec.horasEnFranja.includes("08:15") && rec.horasEnFranja.includes("14:00"),
        "las CUATRO horas dentro de franja vienen en horasEnFranja — son las que se repintan");
      t.falso(rec.horasEnFranja.includes("10:00"), "10:00 está fuera de franja: no se repinta");
      t.falso(rec.horasEnFranja.includes("11:30"), "11:30 está fuera de franja: no se repinta");
      t.falso(rec.horasEnFranja.includes("17:00"), "17:00 está fuera de franja: no se repinta");
      t.cierto(rec.horasEnFranja.includes(rec.sugerida), "la sugerida pertenece a la franja");
      t.cierto(rec.horasEnFranja.length > 1,
        "si la franja trajera una sola hora, repintar el bloque no aportaría nada sobre la insignia");
    });

    // Un paciente SIN franja impuesta no debe repintar nada: si horasEnFranja viniera con
    // contenido, el modal pintaría medio calendario de ámbar a un hipertenso puro.
    t.caso("v14 (repinte de franja) - perfil sin preferencia no repinta ninguna hora", () => {
      const perfil = api.perfilPaciente(["Hipertensión"]);
      const rec = api.recomendacionHorario(perfil, [{ hora: "06:30" }, { hora: "14:00" }]);
      t.igual(rec.sugerida, null, "sin franja impuesta no hay hora sugerida");
      t.igual(rec.horasEnFranja.length, 0, "ni ninguna hora que repintar");
    });
    // v14.0.0 — CITAS ADICIONALES (encargo del 12-ago). El médico las identifica por hora
    // (7:30/9:30/11:30/1:30/3:30/5:30, fuera de la malla de 20 min) y pidió resaltarlas
    // con color y elemento visual propios. clasificaCupoAgenda ya sabía leer el CAMPO de
    // Everest pero llevaba desde su commit sin un solo llamador; esCupoAdicional lo conecta
    // y añade la lista de horas como respaldo cuando el campo no viene.
    t.caso("v14 (cupos adicionales) - el CAMPO de Everest manda sobre la hora", () => {
      // Campo explícito: se respeta aunque la hora no esté en la lista.
      t.cierto(api.esCupoAdicional({ tipoCupo: "ADICIONAL" }, "08:00").adicional, "campo ADICIONAL en hora normal");
      t.igual(api.esCupoAdicional({ tipoCupo: "ADICIONAL" }, "08:00").fuente, "campo");
      // Campo dice NORMAL en una hora de la lista: gana el campo, no el reloj.
      t.falso(api.esCupoAdicional({ tipoCupo: "NORMAL" }, "07:30").adicional,
        "si Everest dice que el cupo es normal, la heurística de la hora NO puede contradecirlo");
      t.igual(api.esCupoAdicional({ tipoCupo: "NORMAL" }, "07:30").fuente, "campo");
    });

    t.caso("v14 (cupos adicionales) - sin campo, se deducen por la hora que dio el médico", () => {
      for (const h of ["07:30", "09:30", "11:30", "13:30", "15:30", "17:30"]) {
        const r = api.esCupoAdicional({}, h);
        t.cierto(r.adicional, h + " es una hora de cupo adicional");
        t.igual(r.fuente, "hora", "y queda marcado como DEDUCIDO, no como dato de Everest");
      }
      for (const h of ["07:00", "08:20", "10:00", "14:40", "16:00"]) {
        t.falso(api.esCupoAdicional({}, h).adicional, h + " es un cupo normal de la malla de 20 min");
      }
    });

    // La regla clínica del Eje B, que se calculaba y nadie leía: las adicionales se
    // sugieren a hipertensos SIN diabetes ni enfermedad renal.
    t.caso("v14 (Eje B) - solo el hipertenso puro tiene las adicionales recomendadas", () => {
      t.igual(api.perfilPaciente(["Hipertensión"]).adicionales, true, "HTA puro: se le pueden ofrecer");
      t.igual(api.perfilPaciente(["Diabetes"]).adicionales, false, "diabético: se reservan");
      t.igual(api.perfilPaciente(["HTA+DM"]).adicionales, false, "HTA+DM: se reservan");
      t.igual(api.perfilPaciente(["Nefroprotección"]).adicionales, false, "renal: se reservan");
      t.igual(api.perfilPaciente([]).adicionales, "visibles", "sin etiqueta reconocida: se muestran sin opinar");
      // Ninguno de los tres estados oculta el cupo: el médico debe poder usarlo cuando no
      // queda otra cita — el caso puntual que él mismo describió.
      for (const et of [["Hipertensión"], ["Diabetes"], []]) {
        t.falso(api.perfilPaciente(et).adicionales === "oculto",
          "las adicionales nunca se ocultan ni se bloquean, solo se recomiendan o se desaconsejan");
      }
    });
  }
};
