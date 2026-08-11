// Suite 21 — v12.4.0: hora de Athenea de punta a punta, chips del panel sin AV/OD,
// pendientes restantes tras ordenar, parada del polling del PyM diario y tabla
// oficial de CUPS (sin ETS excepto VIH). Casos construidos sobre los formatos
// REALES vistos en campo (tarjetas de Athenea, valores ASP.NET /Date(ms)/).
module.exports = {
  nombre: "v12.4: horas, panel PyM y tabla CUPS",
  cubre: ["_parseFechaHoraLike", "isPanelHiddenActivity", "panelActivities", "pymPendientesRestantes", "debeBuscarPymDiario"],
  pruebas(t, api, env, cargar) {

    // ---------- _parseFechaHoraLike ----------
    t.caso("_parseFechaHoraLike: fecha sola (ISO y dd/mm/aaaa) sin hora inventada", () => {
      t.igual(api._parseFechaHoraLike("2026-08-11"), { iso: "2026-08-11", hora: null });
      t.igual(api._parseFechaHoraLike("11/08/2026"), { iso: "2026-08-11", hora: null });
    });

    t.caso("_parseFechaHoraLike: ISO con hora la conserva (antes se truncaba)", () => {
      t.igual(api._parseFechaHoraLike("2026-08-11T07:35:00"), { iso: "2026-08-11", hora: "07:35" });
      t.igual(api._parseFechaHoraLike("2026-08-11 19:05"), { iso: "2026-08-11", hora: "19:05" });
    });

    t.caso("_parseFechaHoraLike: dd/mm/aaaa CON hora ya no cae a 'Sin fecha' (bug del ancla $)", () => {
      // Antes: la rama dd/mm/aaaa exigía fin de cadena y "11/08/2026 07:35" devolvía null
      // — se perdía la fecha ENTERA, no solo la hora.
      t.igual(api._parseFechaHoraLike("11/08/2026 07:35"), { iso: "2026-08-11", hora: "07:35" });
    });

    t.caso("_parseFechaHoraLike: formato del portal '7:35 a. m.' / 'p. m.' convierte a 24h", () => {
      t.igual(api._parseFechaHoraLike("11/08/2026 7:35 a. m."), { iso: "2026-08-11", hora: "07:35" });
      t.igual(api._parseFechaHoraLike("11/08/2026 7:35 p. m."), { iso: "2026-08-11", hora: "19:35" });
      t.igual(api._parseFechaHoraLike("11/08/2026 12:15 a. m."), { iso: "2026-08-11", hora: "00:15" });
      t.igual(api._parseFechaHoraLike("11/08/2026 12:15 p. m."), { iso: "2026-08-11", hora: "12:15" });
    });

    t.caso("_parseFechaHoraLike: hora fuera de rango se descarta, la fecha se conserva", () => {
      t.igual(api._parseFechaHoraLike("11/08/2026 99:99"), { iso: "2026-08-11", hora: null });
    });

    t.caso("_parseFechaHoraLike: /Date(ms)/ conserva la hora real y calla la medianoche exacta", () => {
      const conHora = new Date("2026-08-11T07:35:00").getTime();
      const medianoche = new Date("2026-08-11T00:00:00").getTime();
      t.igual(api._parseFechaHoraLike("/Date(" + conHora + ")/"), { iso: "2026-08-11", hora: "07:35" });
      // La medianoche en punto es el patrón ASP.NET de "solo guardo la fecha": no se
      // muestra como hora porque sería inventar precisión que el dato no tiene.
      t.igual(api._parseFechaHoraLike("/Date(" + medianoche + ")/"), { iso: "2026-08-11", hora: null });
    });

    t.caso("_parseFechaHoraLike: los guardas de v12.3.33 siguen (folios y fechas imposibles)", () => {
      t.igual(api._parseFechaHoraLike("2026-08-1234567"), null);
      t.igual(api._parseFechaHoraLike("2026-99-99"), null);
      t.igual(api._parseFechaHoraLike(""), null);
      t.igual(api._parseFechaHoraLike(null), null);
    });

    // ---------- la hora fluye por _extractAtheneaFecha ----------
    t.caso("_extractAtheneaFecha: devuelve la hora cuando el campo del analito la trae", () => {
      const r = api._extractAtheneaFecha({ Fecha: "2026-08-11T07:35:00", Resultado: "1.2" });
      t.igual(r.iso, "2026-08-11");
      t.igual(r.hora, "07:35");
    });

    t.caso("_extractAtheneaFecha: hereda la hora de la tarjeta (__vglHoraSolicitud) como respaldo", () => {
      const r = api._extractAtheneaFecha({ Resultado: "1.2", __vglFechaSolicitud: "2026-08-11", __vglHoraSolicitud: "07:35" });
      t.igual(r.iso, "2026-08-11");
      t.igual(r.hora, "07:35");
      const sinHora = api._extractAtheneaFecha({ Resultado: "1.2", __vglFechaSolicitud: "2026-08-11" });
      t.igual(sinHora.hora, null);
    });

    t.caso("_atheneaExtraerSolicitudes: raspa la hora pegada a la fecha de la tarjeta", () => {
      const html = '<div class="card">11/08/2026 7:35 a. m.<form action="/Resultados/Reporte" id="5552026" data-modulo="LAB"></form></div>';
      const r = api._atheneaExtraerSolicitudes(html);
      t.igual(r, [{ idSolicitud: 555, ano: 2026, modulo: "LAB", fechaIso: "2026-08-11", horaTxt: "07:35" }]);
    });

    t.caso("_atheneaExtraerSolicitudes: dos horas distintas junto a la misma fecha = ninguna (no adivinar)", () => {
      const html = '<div class="card">11/08/2026 7:35 a. m. reimpreso 11/08/2026 8:40 a. m.<form action="/Resultados/Reporte" id="5552026" data-modulo="LAB"></form></div>';
      const r = api._atheneaExtraerSolicitudes(html);
      t.igual(r[0].fechaIso, "2026-08-11");
      t.igual(r[0].horaTxt, null);
    });

    // ---------- chips del panel: AV/OD ocultos, el resto visible ----------
    t.caso("isPanelHiddenActivity: solo Optometría y Odontología se ocultan del panel", () => {
      t.cierto(api.isPanelHiddenActivity("Remisión a Optometría"));
      t.cierto(api.isPanelHiddenActivity("Remisión a Odontología"));
      t.falso(api.isPanelHiddenActivity("VIH"));
      t.falso(api.isPanelHiddenActivity("Tamización cardiometabólica"));
      t.falso(api.isPanelHiddenActivity("Remisión a Planificación Familiar"));
    });

    t.caso("panelActivities: filtra AV/OD y conserva el orden del resto", () => {
      const lista = ["Tamización cardiometabólica", "Remisión a Optometría", "VIH", "Remisión a Odontología", "Mamografía"];
      t.igual(api.panelActivities(lista), ["Tamización cardiometabólica", "VIH", "Mamografía"]);
      t.igual(api.panelActivities([]), []);
      t.igual(api.panelActivities(null), []);
    });

    // ---------- pendientes restantes tras ordenar desde el panel ----------
    t.caso("pymPendientesRestantes: sin órdenes de hoy devuelve todo lo pendiente", () => {
      const c = cargar();
      c.api.__state.pym = new Map([["888", ["Tamización cardiometabólica", "Remisión a Optometría", "Remisión a Odontología"]]]);
      t.igual(c.api.pymPendientesRestantes("888"), ["Tamización cardiometabólica", "Remisión a Optometría", "Remisión a Odontología"]);
    });

    t.caso("pymPendientesRestantes: resta las actividades ya ordenadas y deja las remisiones", () => {
      const c = cargar();
      c.api.__state.pym = new Map([["888", ["Tamización cardiometabólica", "VIH", "Remisión a Optometría", "Remisión a Odontología"]]]);
      c.api.markOrdenesCreadasHoy("888", ["AGP-1"], ["Tamización cardiometabólica", "VIH"]);
      t.igual(c.api.pymPendientesRestantes("888"), ["Remisión a Optometría", "Remisión a Odontología"]);
    });

    t.caso("pymPendientesRestantes: órdenes viejas sin detalle de actividades dejan solo remisiones/valoración", () => {
      const c = cargar();
      c.api.__state.pym = new Map([["888", ["Tamización cardiometabólica", "Remisión a Odontología", "Valoración integral de salud"]]]);
      c.api.markOrdenesCreadasHoy("888", ["AGP-1"]); // sin `actividades` (formato anterior)
      t.igual(c.api.pymPendientesRestantes("888"), ["Remisión a Odontología", "Valoración integral de salud"]);
    });

    t.caso("markOrdenesCreadasHoy: acumula actividades de dos tandas sin duplicar", () => {
      const c = cargar();
      c.api.markOrdenesCreadasHoy("777", ["A1"], ["VIH"]);
      c.api.markOrdenesCreadasHoy("777", ["A2"], ["VIH", "Mamografía"]);
      const det = c.api.ordenesDetalleHoy("777");
      t.igual(det.agrupadores, ["A1", "A2"]);
      t.igual(det.actividades, ["VIH", "Mamografía"]);
    });

    // ---------- parada del polling del PyM diario ----------
    t.caso("debeBuscarPymDiario: sin nada cargado o con la piloto, se sigue buscando", () => {
      const c = cargar();
      c.api.__state.pymFile = ""; c.api.__state.pymFallback = false; c.api.__state.pymDia = "";
      t.cierto(c.api.debeBuscarPymDiario(), "sin archivo: buscar");
      c.api.__state.pymFile = "BASE PILOTO.xlsx"; c.api.__state.pymFallback = true; c.api.__state.pymDia = c.api.todayStamp();
      t.cierto(c.api.debeBuscarPymDiario(), "con piloto: buscar (es respaldo)");
    });

    t.caso("debeBuscarPymDiario: con el PyM REAL de hoy cargado, la re-búsqueda PARA", () => {
      const c = cargar();
      c.api.__state.pymFile = "Agenda_Dia_CMB_20260811.xlsx";
      c.api.__state.pymFallback = false;
      c.api.__state.pymDia = c.api.todayStamp();
      t.falso(c.api.debeBuscarPymDiario(), "real de hoy: parar");
    });

    t.caso("debeBuscarPymDiario: un PyM cargado OTRO día (pestaña que cruzó medianoche) reactiva la búsqueda", () => {
      const c = cargar();
      c.api.__state.pymFile = "Agenda_Dia_CMB_20260810.xlsx";
      c.api.__state.pymFallback = false;
      c.api.__state.pymDia = "2026-08-10";
      t.cierto(c.api.debeBuscarPymDiario());
    });

    // ---------- tabla oficial de CUPS ----------
    t.caso("PYM_CATALOG: sin ETS excepto VIH — Hepatitis C (906225) y VDRL (906039) fuera del catálogo", () => {
      const codigos = api.__PYM_CATALOG.flatMap((p) => p.cups.map((c2) => c2.codigo));
      t.falso(codigos.includes("906225"), "Hepatitis C no debe ordenarse");
      t.falso(codigos.includes("906039"), "VDRL no debe ordenarse");
      t.cierto(codigos.includes("906249"), "VIH sí se conserva");
    });

    t.caso("PYM_CATALOG: Z108 (CMB de sanos) ordena LDL 903816; el 903817 queda SOLO en RCV exprés (crónicos)", () => {
      const z108 = api.__PYM_CATALOG.find((p) => p.cie10 === "Z108");
      const rcv = api.__PYM_CATALOG.find((p) => p.cie10 === "I10X");
      const cod = (p) => p.cups.map((c2) => c2.codigo);
      t.cierto(cod(z108).includes("903816"), "tabla oficial: LDL semiautomatizado en tamizaje de sanos");
      t.falso(cod(z108).includes("903817"), "el LDL de crónicos no va en el tamizaje de sanos");
      t.cierto(cod(rcv).includes("903817"), "RCV exprés (ERC/HTA/DM2) conserva su LDL");
      // Los 7 exámenes del tamizaje cardiometabólico según la tabla oficial:
      t.igual(cod(z108).slice().sort(), ["903815", "903816", "903818", "903841", "903868", "903895", "907106"]);
    });

    t.caso("PYM_CATALOG: las etiquetas nuevas del panel (FRIENDLY) premarcan su paquete por keywords", () => {
      const strip = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const casa = (etiqueta, pkg) => pkg.keywords.some((kw) => strip(etiqueta).includes(strip(kw)));
      const porCie = (cie) => api.__PYM_CATALOG.find((p) => p.cie10 === cie);
      t.cierto(casa("Tamización cardiometabólica", porCie("Z108")), "CMB casa con Z108 (antes el género -a/-o la dejaba por fuera)");
      t.cierto(casa("Cáncer de cuello uterino — VPH", porCie("Z124")));
      t.cierto(casa("VIH", porCie("Z113")));
      t.cierto(casa("Mamografía", porCie("Z123")));
      t.cierto(casa("PSA (antígeno de próstata)", porCie("Z125")));
      t.cierto(casa("SOMF (sangre oculta en materia fecal)", porCie("Z121")), "el nombre de la tabla y el 'Última SOMF' de la piloto casan con Z121");
      t.cierto(casa("Hemoglobina", porCie("Z103")));
    });
  }
};
