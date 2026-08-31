// Suite 21 — v12.4.0: hora de Athenea de punta a punta, chips del panel sin AV/OD,
// pendientes restantes tras ordenar, parada del polling del PyM diario y tabla
// oficial de CUPS (sin ETS excepto VIH). Casos construidos sobre los formatos
// REALES vistos en campo (tarjetas de Athenea, valores ASP.NET /Date(ms)/).
module.exports = {
  nombre: "v12.4: horas, panel PyM y tabla CUPS",
  cubre: ["_parseFechaHoraLike", "pymPendientesRestantes", "debeBuscarPymDiario", "pymCubiertoPorOrdenVigente"],
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

    t.caso("_parseFechaHoraLike v12.4.1: basura tras la fecha invalida el valor ENTERO (revisión adversarial)", () => {
      // Un rango, un texto o una pseudo-hora pegados a la fecha significan que el valor
      // NO es una fecha confiable: mejor rechazarlo que escribir la primera mitad.
      t.igual(api._parseFechaHoraLike("11/08/2026 99:99"), null);
      t.igual(api._parseFechaHoraLike("11/08/2026-15/09/2026"), null);
      t.igual(api._parseFechaHoraLike("12/05/2026 Control"), null);
      t.igual(api._parseFechaHoraLike("2026-08-11 tomado"), null);
    });

    t.caso("_parseFechaHoraLike v12.4.1: designador de zona (Z / ±hh:mm) calla la hora, conserva la fecha", () => {
      // No sabemos en qué reloj está escrita esa hora: antes casilla sin hora que hora corrida.
      t.igual(api._parseFechaHoraLike("2026-08-11T12:35:00Z"), { iso: "2026-08-11", hora: null });
      t.igual(api._parseFechaHoraLike("2026-08-11T12:35:00+00:00"), { iso: "2026-08-11", hora: null });
      t.igual(api._parseFechaHoraLike("2026-08-11T07:35:00-05:00"), { iso: "2026-08-11", hora: null });
      t.igual(api._parseFechaHoraLike("2026-08-11T07:35:00.123"), { iso: "2026-08-11", hora: "07:35" });
    });

    t.caso("_parseFechaHoraLike v12.4.1: medianoche UTC exacta = fecha-sola en UTC (sin corrimiento de día)", () => {
      // 1786752000000 = 2026-08-15T00:00:00Z. En Colombia (UTC-5) la versión anterior
      // devolvía 2026-08-14 con hora "19:00": día corrido Y hora inventada.
      t.igual(api._parseFechaHoraLike("/Date(1786752000000)/"), { iso: "2026-08-15", hora: null });
    });

    t.caso("_parseFechaHoraLike v12.4.1: NBSP y espacio fino como separadores de la hora", () => {
      t.igual(api._parseFechaHoraLike("11/08/2026 7:35 a. m."), { iso: "2026-08-11", hora: "07:35" });
      t.igual(api._parseFechaHoraLike("11/08/2026 7:35 p. m."), { iso: "2026-08-11", hora: "19:35" });
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
      t.igual(r, [{ idSolicitud: 555, ano: 2026, modulo: "LAB", fechaIso: "2026-08-11", horaTxt: "07:35", hash: null, token: null }]);
    });

    t.caso("_atheneaExtraerSolicitudes: dos horas distintas junto a la misma fecha = ninguna (no adivinar)", () => {
      const html = '<div class="card">11/08/2026 7:35 a. m. reimpreso 11/08/2026 8:40 a. m.<form action="/Resultados/Reporte" id="5552026" data-modulo="LAB"></form></div>';
      const r = api._atheneaExtraerSolicitudes(html);
      t.igual(r[0].fechaIso, "2026-08-11");
      t.igual(r[0].horaTxt, null);
    });

    t.caso("_atheneaExtraerSolicitudes v12.4.1: el 'p. m.' con entidad HTML (&nbsp;/&#160;) NO invierte la hora", () => {
      // ASP.NET encodea el espacio duro del designador español: sin normalizar entidades,
      // "7:35 p.&nbsp;m." se capturaba a medias y una toma de la TARDE salía como 07:35
      // de la mañana (hallazgo ALTO de la revisión adversarial).
      const conNbsp = '<div class="card">11/08/2026 7:35 p.&nbsp;m.<form action="/Resultados/Reporte" id="5552026" data-modulo="LAB"></form></div>';
      t.igual(api._atheneaExtraerSolicitudes(conNbsp)[0].horaTxt, "19:35");
      const conNum = '<div class="card">11/08/2026 7:35 p.&#160;m.<form action="/Resultados/Reporte" id="5552026" data-modulo="LAB"></form></div>';
      t.igual(api._atheneaExtraerSolicitudes(conNum)[0].horaTxt, "19:35");
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

    t.caso("pymPendientesRestantes v12.4.1: órdenes de hoy SIN coincidencia PyM (actividades=[]) no silencian nada", () => {
      // El médico ordenó manualmente algo que no casaba con el Excel: el [] queda
      // persistido y significa "no se cubrió ninguna actividad" — el aviso muestra todo.
      const c = cargar();
      c.api.__state.pym = new Map([["888", ["VIH", "Mamografía", "Remisión a Odontología"]]]);
      c.api.markOrdenesCreadasHoy("888", ["AGP-X"], []);
      t.igual(c.api.pymPendientesRestantes("888"), ["VIH", "Mamografía", "Remisión a Odontología"]);
    });

    t.caso("afterPymLoaded v12.4.1: un archivo que NO es el diario real de hoy no detiene la re-búsqueda", () => {
      // «Abrir PyM» con el Excel de AYER (lo que induce el recordatorio de las 7:30 si
      // la red falló) apagaba la búsqueda del real de hoy para toda la jornada.
      const c = cargar();
      c.api.__state.pymFallback = false;
      c.api.afterPymLoaded("Agenda_Dia_CMB_20200101.xlsx (manual)", false);
      t.cierto(c.api.debeBuscarPymDiario(), "carga que no es el diario de hoy: seguir buscando");
      c.api.afterPymLoaded("Agenda_Dia_CMB_hoy.xlsx (PyM de hoy)", true);
      t.falso(c.api.debeBuscarPymDiario(), "diario real de hoy: parar");
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

    // v14.0.0 — HALLAZGO A de AUDITORIA_MOTOR_RCV_v68.md: el script marcaba la RAC como
    // VENCIDA en rojo (está en RCV_VIGENCIA_KEYS) y su propio paquete NO PODÍA PEDIRLA —
    // la relación albúmina/creatinina se produce con creatinina en orina parcial +
    // microalbuminuria automatizada en orina parcial, y ninguno de los dos existía en el
    // archivo. El médico los añadía a mano en cada paciente.
    // Esta prueba fija la regla general que hace imposible repetir el fallo: NINGÚN
    // analito que el script vigile por vencimiento puede quedarse sin forma de ordenarse.
    t.caso("v14 (Hallazgo A) - todo analito que el script marca como VENCIDO se puede ordenar: la RAC ya tiene sus CUPS", () => {
      const rcv = api.__PYM_CATALOG.find((p) => p.cie10 === "I10X");
      const cod = rcv.cups.map((c2) => c2.codigo);
      // Los dos exámenes que producen la RAC, con los códigos que verificó el médico
      // contra la tabla oficial. La microalbuminuria es 903026 — la auditoría decía 903028
      // y estaba equivocada; un dígito de diferencia es un examen distinto.
      t.cierto(cod.includes("903876"), "creatinina en orina parcial (903876) ordenable");
      t.cierto(cod.includes("903026"), "microalbuminuria automatizada en orina parcial (903026) ordenable");
      t.falso(cod.includes("903028"), "903028 NO: era el código equivocado de la auditoría");
      // Van SIEMPRE los dos: uno solo no produce la relación.
      t.igual(cod.includes("903876"), cod.includes("903026"),
        "la RAC necesita AMBOS: tener uno sin el otro deja al médico con media orden");
      // La regla de fondo: RAC se vigila, luego RAC debe poder ordenarse. La precondición
      // se comprueba por el camino real que produce el aviso de vencimiento, no por una
      // constante interna: _vigenciaDiasParaAnalito devuelve una vigencia para "RAC", que
      // es justamente lo que hace que pueda marcarse como vencida.
      t.cierto(typeof api._vigenciaDiasParaAnalito("RAC", "") === "number",
        "precondición: la RAC sigue siendo un analito vigilado por vencimiento");
    });

    // v14.0.1 — EVIDENCIA_ORDENAMIENTO_CURADO.md §2: "LA LISTA CURADA REAL", tomada de un
    // ordenamiento YA GUARDADO en Everest (no de un clic observado) — la fuente más
    // confiable posible. La HbA1c automatizada es uno de sus 9 CUPS y faltaba en I10X.
    t.caso("v14.0.1 (EVIDENCIA_ORDENAMIENTO_CURADO §2) - RCV exprés ordena la HbA1c automatizada (903426), confirmada contra una orden real ya guardada", () => {
      const rcv = api.__PYM_CATALOG.find((p) => p.cie10 === "I10X");
      const cod = rcv.cups.map((c2) => c2.codigo);
      t.cierto(cod.includes("903426"), "hemoglobina glicosilada automatizada (903426) ordenable en RCV exprés");
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

    // ================= pymCubiertoPorOrdenVigente (T6) =================
    // v14.0.0 (CORREGIDO tras releer D4 completo — ver el comentario junto a la función
    // real: la ventana es la VIGENCIA CLÍNICA por actividad (PYM_CATALOG[].vigenciaDias),
    // no el año calendario). Cruza actividades PyM (paquetes con forma de PYM_CATALOG)
    // contra las órdenes VIGENTES ya existentes en Everest. Devuelve las que SIGUEN
    // pendientes.
    (() => {
      const rcv = () => api.__PYM_CATALOG.find((p) => p.cie10 === "I10X"); // vigenciaDias=180 (RCV_VIGENCIA_DIAS); 903815/903817/903818/903868/903895/903841/907106
      const z123 = () => api.__PYM_CATALOG.find((p) => p.cie10 === "Z123"); // 876802 (mamografía) — SIN vigenciaDias confirmado
      const HOY = "2026-08-14";
      const HACE_30D = "2026-07-15";
      const HACE_180D = "2026-02-15";   // límite exacto de RCV_VIGENCIA_DIAS
      const HACE_181D = "2026-02-14";   // un día más allá del límite
      const HACE_200D = "2026-01-26";

      // v14.1.4 — Con la regla `every` (decisión del médico), un paquete solo cuenta como
      // cubierto cuando TODOS sus CUPS están vigentes. Este ayudante fabrica esa situación
      // a partir del catálogo real, en vez de repetir a mano los diez códigos del RCV.
      const todasLasOrdenesDe = (act, fecha) => act.cups.map((c) => ({ cup: { codigo: c.codigo }, estado: "PEN", fechaCreacion: fecha }));

      t.caso("pymCubiertoPorOrdenVigente: RCV con TODOS sus exámenes ordenados hace poco (dentro de 180 días) cubre la actividad", () => {
        const ordenes = todasLasOrdenesDe(rcv(), HACE_30D);
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, HOY), [], "los diez exámenes de hace 30 días, bien dentro de los 180 de RCV_VIGENCIA_DIAS");
      });

      t.caso("pymCubiertoPorOrdenVigente: sin ningún CUPS coincidente, la actividad sigue pendiente", () => {
        const ordenes = [{ cup: { codigo: "999999" }, estado: "PEN", fechaCreacion: HACE_30D }];
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, HOY), [rcv()]);
      });

      // v14.1.4 — REGLA INVERTIDA POR DECISIÓN DEL MÉDICO (14-ago-2026). Antes bastaba UNO
      // de los diez CUPS para dar el paquete por cubierto, y esta misma prueba lo fijaba
      // como intencional ("cruce por paquete, no por examen suelto"). El caso que lo tumbó
      // es la RAC: el catálogo dice que necesita DOS exámenes y que "van SIEMPRE los dos:
      // uno solo no produce la RAC", pero la regla vieja la daba por hecha con cualquiera.
      // Con `every`, una glicemia de hace un mes ya no silencia los otros nueve exámenes.
      t.caso("pymCubiertoPorOrdenVigente v14.1.4: con SOLO UNO de los diez CUPS del paquete, la actividad SIGUE pendiente", () => {
        const ordenes = [{ cup: { codigo: "903818" }, estado: "PEN", fechaCreacion: HACE_30D }];
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, HOY), [rcv()], "un examen de diez no es el paquete hecho");
      });

      t.caso("pymCubiertoPorOrdenVigente v14.1.4: faltando UN SOLO examen de los diez, la actividad SIGUE pendiente", () => {
        const todas = todasLasOrdenesDe(rcv(), HACE_30D);
        const menosUno = todas.slice(0, -1);
        t.igual(menosUno.length, todas.length - 1, "precondición: se quitó exactamente un examen");
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], menosUno, HOY), [rcv()], "nueve de diez tampoco es el paquete hecho");
      });

      // El caso concreto que motivó el cambio, con los dos CUPS reales de la RAC.
      t.caso("pymCubiertoPorOrdenVigente v14.1.4: la RAC necesita SUS DOS exámenes (903876 + 903026), no uno", () => {
        const soloCreatOrina = [{ cup: { codigo: "903876" }, estado: "PEN", fechaCreacion: HACE_30D }];
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], soloCreatOrina, HOY), [rcv()], "con la creatinina en orina sola no hay RAC");
        const soloMicro = [{ cup: { codigo: "903026" }, estado: "PEN", fechaCreacion: HACE_30D }];
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], soloMicro, HOY), [rcv()], "con la microalbuminuria sola tampoco");
      });

      // Guarda del borde que `every` introduce y `some` no tenía: [].every() es true.
      t.caso("pymCubiertoPorOrdenVigente v14.1.4: una actividad SIN CUPS nunca se da por cubierta ([].every() es true)", () => {
        const vacia = { cie10: "XXX", titulo: "Actividad sin CUPS", vigenciaDias: 180, cups: [] };
        const ordenes = [{ cup: { codigo: "903818" }, estado: "PEN", fechaCreacion: HACE_30D }];
        t.igual(api.pymCubiertoPorOrdenVigente([vacia], ordenes, HOY), [vacia], "sin CUPS no hay nada que comprobar: no puede estar cubierta");
      });

      t.caso("pymCubiertoPorOrdenVigente (D4, vigencia clínica): a los 180 días EXACTOS todavía cubre (límite inclusive)", () => {
        const ordenes = todasLasOrdenesDe(rcv(), HACE_180D);
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, HOY), []);
      });

      t.caso("pymCubiertoPorOrdenVigente (D4, vigencia clínica): pasados los 180 días (181) YA NO cubre — sigue pendiente", () => {
        const ordenes = [{ cup: { codigo: "903818" }, estado: "PEN", fechaCreacion: HACE_181D }];
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, HOY), [rcv()]);
      });

      t.caso("pymCubiertoPorOrdenVigente (D4): una actividad SIN vigenciaDias confirmado SIEMPRE cuenta como pendiente, aunque exista una orden vigente reciente con el CUPS exacto", () => {
        const ordenes = [{ cup: { codigo: "876802" }, estado: "PEN", fechaCreacion: HACE_30D }];
        t.igual(api.pymCubiertoPorOrdenVigente([z123()], ordenes, HOY), [z123()], "Z123 (mamografía) todavía no tiene la periodicidad de la Resolución 3280 confirmada por el médico");
        t.falso(Number.isFinite(z123().vigenciaDias), "confirma la premisa: el catálogo real no le puso vigenciaDias a Z123 todavía");
      });

      t.caso("pymCubiertoPorOrdenVigente: mismo CUPS con dos órdenes -> gana la fecha MÁS RECIENTE (una vieja fuera de ventana no descarta la cobertura si hay una nueva vigente)", () => {
        // v14.1.4 — El paquete entero va vigente (regla `every`) y ADEMÁS el 903818 tiene
        // una orden vieja fuera de ventana. Lo que se comprueba es que esa vieja no
        // "desvigente" al examen, no que baste ella sola.
        const ordenes = todasLasOrdenesDe(rcv(), HACE_30D)
          .concat([{ cup: { codigo: "903818" }, estado: "PEN", fechaCreacion: HACE_200D }]);
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, HOY), [], "la orden reciente (30 días) es la que decide, no la vieja (200 días)");
      });

      t.caso("pymCubiertoPorOrdenVigente: una orden con fecha FUTURA se descarta por prudencia (dato absurdo)", () => {
        const ordenes = [{ cup: { codigo: "903818" }, estado: "PEN", fechaCreacion: "2026-12-25" }];
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, HOY), [rcv()]);
      });

      t.caso("pymCubiertoPorOrdenVigente: NO interpreta `estado` — 'PEN' y 'PRO' cubren igual, por CUPS+vigencia únicamente", () => {
        // v14.1.4 — con `every` hace falta el paquete completo; el estado se varía en TODAS
        // las órdenes, que es lo que esta prueba mide.
        const conEstado = (est) => todasLasOrdenesDe(rcv(), HACE_30D).map((o) => ({ ...o, estado: est }));
        const cubrePen = api.pymCubiertoPorOrdenVigente([rcv()], conEstado("PEN"), HOY);
        const cubrePro = api.pymCubiertoPorOrdenVigente([rcv()], conEstado("PRO"), HOY);
        const cubreRaro = api.pymCubiertoPorOrdenVigente([rcv()], conEstado("ALGO-NUNCA-VISTO"), HOY);
        t.igual(cubrePen, []); t.igual(cubrePro, []); t.igual(cubreRaro, [], "un estado desconocido no descarta la orden: no se interpreta");
      });

      t.caso("pymCubiertoPorOrdenVigente: fecha de la orden ilegible -> por prudencia, NO cuenta como cobertura", () => {
        const ordenes = [{ cup: { codigo: "903818" }, estado: "PEN", fechaCreacion: "esto-no-es-una-fecha" }];
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, HOY), [rcv()]);
      });

      t.caso("pymCubiertoPorOrdenVigente: respuesta vacía de órdenes -> TODO sigue pendiente", () => {
        t.igual(api.pymCubiertoPorOrdenVigente([rcv(), z123()], [], HOY), [rcv(), z123()]);
      });

      // v14.0.0 — LA MUTACIÓN MÁS IMPORTANTE DEL ENCARGO (según el propio criterio de
      // aceptación de T6): "fallo = no cubierto". Si `ordenes` no es un arreglo utilizable
      // (null por fallo de red, undefined, un objeto malformado), TODAS las actividades
      // deben seguir pendientes — nunca se pierde en silencio un recordatorio real.
      t.caso("pymCubiertoPorOrdenVigente (D4, LA MUTACIÓN OBLIGATORIA): fallo de red (ordenes=null) -> TODO sigue pendiente, nunca se descarta nada", () => {
        t.igual(api.pymCubiertoPorOrdenVigente([rcv(), z123()], null, HOY), [rcv(), z123()]);
      });

      t.caso("pymCubiertoPorOrdenVigente: respuesta malformada (ni null ni arreglo) -> también todo pendiente", () => {
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], { inesperado: true }, HOY), [rcv()]);
      });

      t.caso("pymCubiertoPorOrdenVigente: sin actividades que revisar, devuelve la lista vacía sin lanzar", () => {
        t.igual(api.pymCubiertoPorOrdenVigente([], [{ cup: { codigo: "903818" }, fechaCreacion: HACE_30D }], HOY), []);
        t.noLanza(() => api.pymCubiertoPorOrdenVigente(null, null, HOY));
      });

      t.caso("pymCubiertoPorOrdenVigente: sin un 'hoy' fiable (fecha ilegible), no se puede calcular ninguna vigencia -> por prudencia, todo pendiente", () => {
        const ordenes = [{ cup: { codigo: "903818" }, estado: "PEN", fechaCreacion: HACE_30D }];
        t.igual(api.pymCubiertoPorOrdenVigente([rcv()], ordenes, "fecha-invalida"), [rcv()]);
      });
    })();
  }
};
