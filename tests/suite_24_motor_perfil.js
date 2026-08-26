module.exports = {
  nombre: "Motor de perfil (D3-bis)",
  cubre: ["perfilPaciente", "recomendacionHorario", "clasificaCupoAgenda", "esCupoAdicional",
    // v15.4.0 — triaje v2 y regla labs-primero (reglas dictadas por el médico, 19-ago)
    "_evaluarComplejidadPaciente", "mtrPlanLabsPrimero", "mtrControlDesdeLabs", "hora24De"],
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

    // ================= v15.4.0 — TRIAJE v2 (reglas del médico, 19-ago) =================
    t.caso("triaje v2: el insulinorrequirente va a PRIMERA MITAD aunque todo lo demás esté estable", () => {
      const r = api._evaluarComplejidadPaciente({}, {
        factores: {}, riesgo: { categoria: "moderado" },
        medicamentos: ["Insulina glargina 100 UI", "Metformina 850mg"],
      }, []);
      t.igual(r.franjaSugerida, "primera_mitad");
      t.cierto(r.badges.join(" ").includes("Insulinorrequirente"), "con su insignia explicando por qué");
    });
    t.caso("triaje v2: polifarmacia (>=5 fármacos DEL PROGRAMA) fuerza primera mitad", () => {
      // v16.4.0 — Reportado con pantallazo ("lista 27 medicamentos pero más de 20 no son
      // de riesgo cardiovascular"): la polifarmacia ahora se mide SOLO sobre fármacos del
      // programa (orden vigente de v16.1.0: los demás no entran en ningún cálculo). Cinco
      // letras sueltas ya no cuentan; cinco fármacos RCV reales, sí.
      const r = api._evaluarComplejidadPaciente({}, {
        factores: {}, riesgo: { categoria: "bajo" },
        medicamentos: ["Losartán 50mg", "Metformina 850mg", "Atorvastatina 40mg", "Enalapril 20mg", "ASA 100mg"],
      }, []);
      t.igual(r.franjaSugerida, "primera_mitad");

      // Y el caso del reporte: muchos fármacos, casi ninguno del programa → NO es
      // polifarmacia para el triaje (con riesgo bajo y sin nada más, va al final).
      const r2 = api._evaluarComplejidadPaciente({}, {
        factores: {}, riesgo: { categoria: "bajo" },
        medicamentos: ["Acetaminofén", "Loratadina", "Omeprazol", "Naproxeno", "Vitamina D", "Calcio", "Hierro"],
      }, []);
      t.falso(r2.franjaSugerida === "primera_mitad", "7 fármacos NO cardiovasculares ya no fuerzan primera mitad");
    });
    t.caso("triaje v2: DM NO insulinorrequirente, estable y con pocos fármacos, va al FINAL de la jornada", () => {
      const r = api._evaluarComplejidadPaciente({}, {
        factores: { diabetes: true }, riesgo: { categoria: "moderado" },
        medicamentos: ["Metformina 850mg", "Losartán 50mg"],
      }, []);
      t.igual(r.franjaSugerida, "final_jornada", "la regla nueva: estable con pocos medicamentos → últimos cupos");
      t.falso(r.esComplejo);
    });
    t.caso("triaje v2: RCV ALTO pero estable y con pocos fármacos también es elegible para el final", () => {
      const r = api._evaluarComplejidadPaciente({}, {
        factores: { hipertension: true }, riesgo: { categoria: "alto" },
        medicamentos: ["Losartán 50mg"],
      }, []);
      t.igual(r.franjaSugerida, "final_jornada");
    });
    t.caso("triaje v2: RCV MUY ALTO nunca va al final de la jornada", () => {
      const r = api._evaluarComplejidadPaciente({}, {
        factores: {}, riesgo: { categoria: "muy alto" },
        medicamentos: ["Losartán 50mg"],
      }, []);
      t.cierto(r.franjaSugerida !== "final_jornada");
    });
    t.caso("triaje v2: falla terapéutica o PA descontrolada mandan a primera mitad", () => {
      const r1 = api._evaluarComplejidadPaciente({}, { factores: {}, fallas: { hayGrave: true }, medicamentos: [] }, []);
      t.igual(r1.franjaSugerida, "primera_mitad");
      const r2 = api._evaluarComplejidadPaciente({}, { factores: { paSistolica: 165, paDiastolica: 95 }, medicamentos: [] }, []);
      t.igual(r2.franjaSugerida, "primera_mitad");
    });
    t.caso("triaje v2: diabético SIN resumen clínico se asume complejo (no se puede verificar la insulina)", () => {
      const r = api._evaluarComplejidadPaciente({}, null, [{ descripcion: "Diabetes" }]);
      t.igual(r.franjaSugerida, "primera_mitad");
      t.cierto(r.badges.join(" ").includes("sin resumen"));
    });
    t.caso("recomendacionHorario: franja FINAL DE JORNADA sugiere el primero de los últimos 4 cupos y marca las últimas 2 horas", () => {
      const turnos = ["07:00 AM", "08:00 AM", "01:00 PM", "02:00 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM"]
        .map((h) => ({ horaTexto: h }));
      const r = api.recomendacionHorario({ franja: "final_jornada" }, turnos);
      t.igual(r.sugerida, "15:30", "el primero de los últimos 4 turnos (3:30 PM)");
      t.cierto(r.horasEnFranja.indexOf("15:00") !== -1 && r.horasEnFranja.indexOf("17:00") !== -1,
        "las últimas 2 horas completas quedan en la franja");
      t.igual(r.horasEnFranja.indexOf("08:00"), -1, "la mañana no entra en la franja del final");
      t.cierto(/final de la jornada/.test(r.rangoTexto));
    });

    // v16.2.0 — HALLAZGO DE CAMPO (pantallazo): el pillbox mostraba "🟡 Control habitual
    // (...) ➔ Sugerido: Segunda mitad o cupo adicional (:30)" pero recomendacionHorario
    // no tenía NINGUNA rama para franja "adicional_30" — caía al catch-all y devolvía
    // sugerida:null. El médico reportó que la agenda dejó de autoseleccionar "como en
    // otras ocasiones" para estos pacientes (los más frecuentes: control habitual).
    t.caso("recomendacionHorario: franja ADICIONAL_30 prefiere un cupo :30 real (HORAS_ADICIONALES) si hay uno libre", () => {
      const turnos = ["07:00 AM", "07:30 AM", "08:00 AM", "09:30 AM"].map((h) => ({ horaTexto: h }));
      const r = api.recomendacionHorario({ franja: "adicional_30" }, turnos);
      t.igual(r.sugerida, "07:30", "el primer cupo :30 disponible, aunque sea temprano");
      t.cierto(r.horasEnFranja.indexOf("09:30") !== -1, "el otro cupo :30 también queda marcado");
      t.igual(r.horasEnFranja.indexOf("08:00"), -1, "un turno normal (no :30) no entra en la franja");
      t.cierto(/cupo adicional/.test(r.rangoTexto));
    });
    t.caso("recomendacionHorario: franja ADICIONAL_30 sin cupos :30 libres cae a la segunda mitad de la jornada", () => {
      const turnos = ["07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM"].map((h) => ({ horaTexto: h }));
      const r = api.recomendacionHorario({ franja: "adicional_30" }, turnos);
      t.igual(r.sugerida, "09:00", "sin :30 disponibles, el primero de la mitad más tardía");
      t.cierto(/segunda mitad/.test(r.rangoTexto));
    });
    t.caso("recomendacionHorario: franja ADICIONAL_30 sin turnos legibles no inventa nada", () => {
      const r = api.recomendacionHorario({ franja: "adicional_30" }, []);
      t.igual(r.sugerida, null);
      t.igual(r.horasEnFranja.length, 0);
    });

    // v16.2.0 — la causa raíz del bug de arriba era estructural: "adicional_30" es el
    // valor por defecto tanto para "control habitual genuino" (hay factores reales, p.
    // ej. Hipertensión) COMO para "todavía no sabemos nada de este paciente" (sin
    // resumen, sin etiquetas). tieneEvidencia distingue los dos — el llamador en
    // openAgendamientoModal usa esto para no imponer una sugerencia donde no hay de
    // dónde salga (ver el siguiente bloque de pruebas, D3-bis).
    t.caso("_evaluarComplejidadPaciente: tieneEvidencia distingue \"control habitual real\" de \"sin datos todavía\"", () => {
      const conEvidencia = api._evaluarComplejidadPaciente({}, null, [{ descripcion: "Hipertensión" }]);
      t.igual(conEvidencia.franjaSugerida, "adicional_30");
      t.cierto(conEvidencia.tieneEvidencia, "hay un factor real (Hipertensión) detrás de la sugerencia");

      const sinEvidencia = api._evaluarComplejidadPaciente({}, null, []);
      t.igual(sinEvidencia.franjaSugerida, "adicional_30");
      t.falso(sinEvidencia.tieneEvidencia, "sin ninguna etiqueta ni resumen, es puro default — no hay de dónde salga");
    });

    // ================= v15.4.0 — REGLA LABS-PRIMERO =================
    // v17.1.0 (#137) — CAMBIO DE COMPORTAMIENTO AUTORIZADO POR EL MÉDICO.
    // Con un examen YA VENCIDO, el piso de 14 días cede: esperar dos semanas no recupera
    // un examen que ya venció, y era justo el caso MÁS urgente el que seguía esperando.
    // El techo de 21 días NO se mueve: la ventana se ensancha solo hacia abajo, porque de
    // la monotonía hacia arriba depende mtrLabsPrimeroVencimientoInevitable.
    t.caso("mtrPlanLabsPrimero: con un examen YA VENCIDO el piso de 14 días cede (#137)", () => {
      const plan = { drivers: [], pasajeros: [], vencidos: [{ clave: "HBA1C", nombre: "HbA1c" }] };
      const r = api.mtrPlanLabsPrimero(plan, "2026-08-19");
      t.cierto(!!r && r.activa);
      t.cierto(r.pisoRelajado, "el piso cedió");
      t.cierto(r.labMinIso < r.pisoNormalIso, "la toma se puede agendar antes del piso habitual");
      t.cierto(r.labMinIso > "2026-08-19", "pero nunca hoy ni en el pasado: como mínimo el próximo día hábil");
      t.cierto(r.pisoNormalIso >= "2026-09-02", "el piso habitual sigue siendo 14 días, y se informa aparte");
      t.igual(r.labMaxIso, "2026-09-09", "el techo de 21 días NO se mueve");
      t.igual(r.labSugeridaIso, r.labMinIso, "y lo sugerido es lo más pronto posible");
      t.cierto(/ya hay examen\(es\) vencido\(s\)/.test(r.motivoPiso), "con el motivo en lenguaje del consultorio: " + r.motivoPiso);
      t.igual(r.vencidos, ["HbA1c"]);
    });

    t.caso("mtrPlanLabsPrimero: sin nada vencido ni a punto de vencer, el piso de 14 días MANDA (#137)", () => {
      // El ensanche es una excepción, no la regla nueva: si el piso puede cumplirse, se cumple.
      const plan = { drivers: [{ clave: "LDL", nombre: "LDL", subestado: "vigente", diasParaVencer: 25, estado: "D", vence: "2026-09-13" }], pasajeros: [], vencidos: [] };
      const r = api.mtrPlanLabsPrimero(plan, "2026-08-19");
      t.cierto(!!r && r.activa);
      t.falso(r.pisoRelajado, "no hay razón para adelantar");
      t.igual(r.labMinIso, r.pisoNormalIso, "la toma queda en el piso de siempre");
      t.igual(r.motivoPiso, "", "y no se inventa un motivo");
    });

    t.caso("mtrPlanLabsPrimero: un examen que vence ANTES del piso adelanta la toma A SU VENCIMIENTO (#137)", () => {
      const plan = {
        drivers: [{ clave: "GLICEMIA", nombre: "Glicemia", subestado: "vigente", diasParaVencer: 3, estado: "D", vence: "2026-08-24" }],
        pasajeros: [], vencidos: [],
      };
      const r = api.mtrPlanLabsPrimero(plan, "2026-08-21");
      t.cierto(!!r && r.pisoRelajado, "el piso cede");
      t.cierto(r.labMinIso <= "2026-08-24", "la toma queda en el vencimiento o antes, nunca después");
      t.cierto(/Glicemia/.test(r.motivoPiso), "y se dice por cuál examen: " + r.motivoPiso);
      // La comprobación que de verdad importa: el cambio RESUELVE el problema que #128
      // solo pudo declarar. Con la fecha nueva, ya no hay aviso de vencimiento.
      t.igual(api.mtrAvisoVencimiento(plan, r.labMinIso), null, "CERO VENCIDOS: con esta fecha el examen ya no llega vencido");
      t.cierto(api.mtrLabsPrimeroVencimientoInevitable(plan, r.pisoNormalIso), "y en el piso viejo sí llegaba: por eso se movió");
    });
    t.caso("mtrPlanLabsPrimero: un examen vigente que vence en <=30 días también la activa; a >30 días NO", () => {
      const plan30 = { drivers: [{ clave: "LDL", nombre: "LDL", subestado: "vigente", diasParaVencer: 25 }], pasajeros: [], vencidos: [] };
      t.cierto(!!api.mtrPlanLabsPrimero(plan30, "2026-08-19"), "25 días → activa");
      const plan40 = { drivers: [{ clave: "LDL", nombre: "LDL", subestado: "vigente", diasParaVencer: 40 }], pasajeros: [], vencidos: [] };
      t.igual(api.mtrPlanLabsPrimero(plan40, "2026-08-19"), null, "40 días → NO activa");
    });
    // v16.2.5 — Pedido del médico sobre el aviso de agendamiento (pantallazo del 20-08):
    // "mejora la redacción de ese tipo de mensajes y ahí directamente se debe mencionar
    // CUÁLES son aquellos exámenes que se van a vencer para que el médico los vea
    // rápidamente". El banner decía "3 por vencer en ≤30 días" — un número que obliga a
    // salir a otro módulo para saber de qué se trata. El detalle sale ordenado por
    // urgencia, que es lo que hace útil el vistazo rápido.
    t.caso("mtrPlanLabsPrimero: el detalle nombra los exámenes por vencer y los ORDENA por urgencia (v16.2.5)", () => {
      const plan = {
        drivers: [
          { clave: "LDL", nombre: "Colesterol LDL", subestado: "vigente", diasParaVencer: 28 },
          { clave: "CREATININA", nombre: "Creatinina", subestado: "vigente", diasParaVencer: 3 },
          { clave: "RAC", nombre: "RAC", subestado: "vigente", diasParaVencer: 15 },
        ],
        pasajeros: [], vencidos: [],
      };
      const r = api.mtrPlanLabsPrimero(plan, "2026-08-19");
      t.cierto(!!r && r.activa);
      t.igual(r.porVencerDetalle.map((x) => x.nombre), ["Creatinina", "RAC", "Colesterol LDL"],
        "lo que vence primero va primero: es lo que el médico necesita ver de un vistazo");
      t.igual(r.porVencerDetalle[0].dias, 3, "cada uno lleva sus días restantes, no solo el nombre");
      t.igual(r.porVencer.length, 3, "la lista de solo-nombres se conserva intacta (no se rompe a quien ya la usaba)");
    });

    t.caso("mtrPlanLabsPrimero: sin exámenes por vencer el detalle es una lista vacía, nunca undefined (v16.2.5)", () => {
      // El banner recorre porVencerDetalle sin comprobar nada: si aquí saliera undefined
      // en el caso "solo vencidos", el aviso entero reventaría justo cuando más hace falta.
      const plan = { drivers: [], pasajeros: [], vencidos: [{ clave: "HBA1C", nombre: "HbA1c" }] };
      const r = api.mtrPlanLabsPrimero(plan, "2026-08-19");
      t.cierto(Array.isArray(r.porVencerDetalle), "siempre un arreglo");
      t.igual(r.porVencerDetalle.length, 0);
      t.igual(r.vencidos, ["HbA1c"], "y el vencido sí queda nombrado para la ficha roja");
    });

    t.caso("hora24De: entiende AM/PM (el bug del 6:00 PM estrellado como mañana) y respeta el reloj de 24h", () => {
      t.igual(api.hora24De("06:00 PM"), "18:00", "las 6 de la tarde son las 18:00, no las 06:00");
      t.igual(api.hora24De("07:00 AM"), "07:00");
      t.igual(api.hora24De("12:15 PM"), "12:15", "mediodía");
      t.igual(api.hora24De("12:05 AM"), "00:05", "medianoche");
      t.igual(api.hora24De("13:40"), "13:40", "24h pasa igual");
      t.igual(api.hora24De("3:05 p.m."), "15:05", "variante con puntos");
    });
    // v16.9.0 — Este camino (el aviso «labs primero» del agendamiento) tenía su propia
    // aritmética: +7 y al siguiente hábil, sin proponer nunca un sábado aunque al médico
    // le tocara. Ahora pasa por mtrFechaControlSugerida, igual que el módulo clínico:
    // objetivo +7 y, si ese día no se puede citar, el MÁS CERCANO a 7 dentro de la
    // ventana clínica (nunca por debajo del suelo de 4 días = 72 h para el resultado).
    t.caso("mtrControlDesdeLabs: objetivo +7, y si ese día no se puede citar, el más cercano", () => {
      t.igual(api.mtrControlDesdeLabs("2026-08-24"), "2026-08-31", "lunes+7=lunes hábil: no se mueve");
      // Toma el sábado 5-sep: el día 7 cae sábado. Sin constancia de que trabaje
      // sábados, el más cercano es el viernes 11 (6 días, por encima del suelo de 4).
      const sinSabados = api.mtrControlDesdeLabs("2026-09-05");
      t.igual(sinSabados, "2026-09-11", "el más cercano a 7 que sí se puede citar");
      const dias = Math.round((Date.parse(sinSabados + "T00:00:00Z") - Date.parse("2026-09-05T00:00:00Z")) / 86400000);
      t.cierto(dias >= 4, "nunca por debajo de las 72 h que pide la norma (quedaron " + dias + " días)");
      // Con constancia de agenda propia en sábado, el objetivo se cumple exacto.
      t.igual(api.mtrControlDesdeLabs("2026-09-05", { grupoSabado: true }), "2026-09-12", "+7 clavado");
    });
  }
};
