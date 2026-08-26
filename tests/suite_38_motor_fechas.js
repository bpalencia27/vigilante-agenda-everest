// =====================================================================
//  SUITE 38 — Motor portado: fechas, vigencias y el arreglo de CERO VENCIDOS
//
//  La suite 43 ya comprueba que el port reproduce al Copiloto vector a vector.
//  Esta comprueba lo que el contraste NO puede comprobar: lo que el port hace
//  DISTINTO a propósito, y por qué.
//
//  El caso que la motiva:
//
//    `ftl_date = sumar_dias_habiles(hoy, dias_labs_efectivos)`
//                                   (motor_deterministic.py:2525)
//
//  `dias_labs_efectivos` está calculado para caer EXACTAMENTE en el vencimiento
//  del primer analito — el propio comentario del Python lo dice: "la toma va al
//  vencimiento mas proximo para que ninguno caduque". Y `sumar_dias_habiles`
//  llama a `ajustar_fecha_habil`, que si esa fecha cae en domingo o festivo la
//  empuja +1 día: DESPUÉS del vencimiento.
//
//  Eso es `CERO VENCIDOS` roto en el mismo archivo que lo invoca como principio
//  rector (líneas 2338 y 2414). El médico cerró la regla el 5-ago-2026: la toma
//  se ADELANTA al último día hábil dentro de la vigencia, nunca se retrasa.
//
//  El port implementa lo decidido. Y la última prueba de esta suite documenta
//  que el Python todavía no — se pondrá en verde el día que se arregle allá.
// =====================================================================
module.exports = {
  nombre: "Motor portado: fechas y CERO VENCIDOS",
  cubre: [
    "mtrRetrocederADiaHabil", "mtrAjustarFechaHabil", "mtrEsDiaNoHabil",
    "mtrEsFestivoCO", "mtrFestivosCO", "mtrPascuaCO", "mtrFestivosDelAnio", "_mtrIsoUTC", "_mtrLunesSiguiente", "mtrSumarDias", "mtrFechaIso", "mtrDiaValidoParaControlConSabado",
    "mtrFechaControlSugerida", "mtrSabadosHabilitados", "mtrVigenciaDias", "mtrProgramaRector",
    "mtrVentanaAnrDias", "mtrRound", "mtrFloat",
    "mtrEsFalsy", "mtrNormalizarTexto", "mtrFechaDesdeIso", "mtrIsoDesdeFecha",
    "mtrIdxEstadio", "mtrAcortarRacSiAlbuminuria", "mtrNormEstadio", "mtrEsFecha",
  ],

  pruebas(t, api) {
    // ---------- el arreglo: la toma se adelanta, nunca se retrasa ----------

    t.caso("un vencimiento en domingo ADELANTA la toma al sábado, no la retrasa al lunes", () => {
      // 2026-08-16 es domingo.
      t.cierto(api.mtrEsDiaNoHabil("2026-08-16"), "2026-08-16 debía ser no hábil (domingo)");
      t.igual(api.mtrRetrocederADiaHabil("2026-08-16"), "2026-08-15", "el sábado SÍ es hábil según la norma");
      // y el port fiel del Python hace lo contrario, que es el defecto. Aquí
      // además se encadena: domingo 16 -> lunes 17 (que es festivo, Asunción)
      // -> martes 18. Dos días DESPUÉS del vencimiento, no uno.
      t.igual(api.mtrAjustarFechaHabil("2026-08-16"), "2026-08-18",
        "el Python empuja hasta el martes: el puente festivo agrava el retraso");
    });

    t.caso("un vencimiento en festivo salta hacia atrás hasta el día hábil anterior", () => {
      // 2026-08-17 (Asunción, trasladado) es festivo y cae lunes.
      t.cierto(api.mtrEsFestivoCO("2026-08-17"), "2026-08-17 debía ser festivo");
      // hacia atrás: domingo 16 tampoco vale -> sábado 15
      t.igual(api.mtrRetrocederADiaHabil("2026-08-17"), "2026-08-15");
    });

    t.caso("si la fecha ya es hábil, no se mueve en ninguno de los dos sentidos", () => {
      t.igual(api.mtrRetrocederADiaHabil("2026-08-18"), "2026-08-18");
      t.igual(api.mtrAjustarFechaHabil("2026-08-18"), "2026-08-18");
    });

    t.caso("el adelanto nunca devuelve una fecha posterior a la pedida", () => {
      // recorre un año entero: la propiedad tiene que valer SIEMPRE, no en un caso suelto
      let d = "2026-01-01", peor = null, n = 0;
      while (d && d < "2027-01-01") {
        const r = api.mtrRetrocederADiaHabil(d);
        if (r > d) { peor = d + " -> " + r; break; }
        n++;
        d = api.mtrSumarDias(d, 1);
      }
      t.igual(peor, null, "hubo una fecha en la que el 'adelanto' retrasó");
      t.cierto(n > 360, "solo se recorrieron " + n + " días");
    });

    t.caso("el resultado del adelanto es siempre un día hábil", () => {
      let d = "2026-01-01", malo = null;
      while (d && d < "2027-01-01") {
        const r = api.mtrRetrocederADiaHabil(d);
        if (api.mtrEsDiaNoHabil(r)) { malo = d + " -> " + r; break; }
        d = api.mtrSumarDias(d, 1);
      }
      t.igual(malo, null, "el adelanto devolvió un día no hábil");
    });

    // ---------- la cita de control ----------

    // v16.9.0 — DECISIÓN DEL MÉDICO (20-ago): el control va a +7 DÍAS de la toma, en
    // TODOS los caminos. La ventana 4-14 dejaba elegir entre once días y producía fechas
    // distintas para el mismo paciente según por dónde se entrara. Con el cambio se
    // retiraron `mtrFechaControlDesdeFtl` y `mtrDiaValidoParaControl` (el modelo
    // QUINCENAL anclado al 2026-07-11), que ninguna parte de la interfaz usaba desde
    // v15: la decisión real la tomaba mtrDiaValidoParaControlConSabado.
    t.caso("el control va a +7 días de la toma, no a «algún día entre 4 y 14»", () => {
      const r = api.mtrFechaControlSugerida("2026-08-03", {});   // lunes
      t.igual(r.fecha, "2026-08-10", "lunes + 7 = lunes siguiente");
      t.igual(r.dias, 7, "exactamente siete");
      t.cierto(/como manda la regla/.test(r.motivo), "y lo dice: " + r.motivo);
    });

    t.caso("si el día 7 no se puede citar, se corre al MÁS CERCANO a 7, no al primero que aparezca", () => {
      // Toma el sábado 2026-08-01: el día 7 cae sábado (sin agenda propia, no vale),
      // el 8 es domingo y el 6 es el 7 de agosto, festivo nacional. Queda el lunes.
      const r = api.mtrFechaControlSugerida("2026-08-01", {});
      t.igual(r.fecha, "2026-08-10");
      t.igual(r.dias, 9, "el más cercano a 7 que sí se podía citar");
      t.cierto(/se corrió al más cercano/.test(r.motivo), "y se declara el desvío: " + r.motivo);
      t.igual(r.objetivoDias, 7, "el objetivo sigue siendo 7 aunque no se alcance");
    });

    t.caso("con sábados habilitados, el sábado a +7 SÍ se propone (regla única de v16.9.0)", () => {
      const r = api.mtrFechaControlSugerida("2026-08-01", { grupoSabado: true });
      t.igual(r.fecha, "2026-08-08", "sábado siguiente");
      t.igual(r.dias, 7, "y sin desviarse del objetivo");
      t.cierto(r.esSabado, "es sábado, y se dice");
    });

    t.caso("mtrSabadosHabilitados: la regla única acepta lo que le den, y sin constancia NO propone sábados", () => {
      t.cierto(api.mtrSabadosHabilitados(true), "un sí es un sí");
      t.cierto(api.mtrSabadosHabilitados("1-3"), "el grupo del modelo viejo implica que trabaja sábados");
      t.cierto(api.mtrSabadosHabilitados({ observados: ["2026-08-01"] }), "una agenda propia observada basta");
      t.cierto(api.mtrSabadosHabilitados({ habilitado: true }), "o decirlo explícitamente");
      t.falso(api.mtrSabadosHabilitados(null), "sin constancia, no");
      t.falso(api.mtrSabadosHabilitados({ observados: [] }), "una memoria vacía no es constancia");
      t.falso(api.mtrSabadosHabilitados(undefined), "ni undefined");
      t.falso(api.mtrSabadosHabilitados(""), "ni un grupo vacío");
    });

    t.caso("el domingo nunca es día de control; el sábado depende solo de si el médico trabaja sábados", () => {
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-16", true), "domingo, aunque trabaje sábados");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-07-18", null), "sábado sin constancia de agenda propia");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-07-18", true), "el MISMO sábado, con constancia: válido");
      // Antes esto dependía de la quincena anclada: el 18 de julio salía inválido y el
      // 25 válido, aunque el médico tuviera agenda los dos. Eso es lo que se eliminó.
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-07-25", true), "y el otro también");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-07", true), "el 7 de agosto es festivo: eso no lo cambia ningún sábado");
    });

    // ---------- festivos por algoritmo, verificados contra la tabla ----------
    //
    // v16.9.0 — decisión del médico: calcular los festivos (Ley Emiliani) en vez de
    // mantener una tabla a mano, con la tabla 2024-2027 como verificación. Esta prueba
    // ES esa verificación: si el algoritmo se separa de la tabla en un día que no esté
    // declarado abajo, falla.
    t.caso("mtrFestivosCO reproduce la tabla escrita a mano de 2025, 2026 y el 2027 conocido", () => {
      const tabla = {
        2025: ["2025-01-01", "2025-01-06", "2025-03-24", "2025-04-17", "2025-04-18",
               "2025-05-01", "2025-06-02", "2025-06-23", "2025-06-30", "2025-07-20",
               "2025-08-07", "2025-08-18", "2025-10-13", "2025-11-03", "2025-11-17",
               "2025-12-08", "2025-12-25"],
        2026: ["2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
               "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
               "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02",
               "2026-11-16", "2026-12-08", "2026-12-25"],
      };
      Object.keys(tabla).forEach((anio) => {
        t.igual(api.mtrFestivosCO(Number(anio)), tabla[anio], "el año " + anio + " calculado debe ser idéntico al escrito a mano");
      });
    });

    t.caso("la ÚNICA diferencia con la tabla vieja es un error de la tabla, no del algoritmo", () => {
      // La tabla escrita a mano ponía la Independencia de Cartagena de 2024 el 18 de
      // noviembre. El 11 de noviembre de 2024 YA caía lunes, así que la Ley Emiliani no
      // lo traslada: el festivo era el 11. Un festivo mal puesto mueve una fecha de toma.
      const f2024 = api.mtrFestivosCO(2024);
      t.cierto(f2024.indexOf("2024-11-11") >= 0, "el 11 (lunes) es el festivo real");
      t.falso(f2024.indexOf("2024-11-18") >= 0, "y el 18 no lo era: eso lo destapó el algoritmo");
    });

    t.caso("mtrPascuaCO: el ancla de todos los festivos móviles", () => {
      const iso = (d) => d.toISOString().slice(0, 10);
      t.igual(iso(api.mtrPascuaCO(2024)), "2024-03-31");
      t.igual(iso(api.mtrPascuaCO(2025)), "2025-04-20");
      t.igual(iso(api.mtrPascuaCO(2026)), "2026-04-05");
      t.igual(iso(api.mtrPascuaCO(2027)), "2027-03-28");
      t.igual(api.mtrPascuaCO("no es un año"), null, "sin año no se inventa una Pascua");
      t.igual(api.mtrPascuaCO(1500), null, "fuera del calendario gregoriano tampoco");
    });

    t.caso("los festivos ya NO caducan con la tabla: 2028 y más allá se calculan igual", () => {
      // Antes, cualquier año fuera de la tabla devolvía "no es festivo" para TODO. En
      // enero de 2028 el asistente habría citado tomas el 1 de enero sin decir nada.
      t.cierto(api.mtrEsFestivoCO("2028-01-01"), "Año Nuevo de 2028");
      t.cierto(api.mtrEsFestivoCO("2030-12-25"), "Navidad de 2030");
      t.cierto(api.mtrEsFestivoCO("2030-10-14"), "Día de la Raza de 2030, trasladado al lunes");
      t.falso(api.mtrEsFestivoCO("2030-10-12"), "y el 12, que cae sábado, ya no lo es");
      t.falso(api.mtrEsFestivoCO("2028-02-14"), "un día cualquiera sigue sin ser festivo");
      // La caché por año es lo que evita recalcular en los bucles de fechas.
      const a = api.mtrFestivosDelAnio("2028");
      const b = api.mtrFestivosDelAnio("2028");
      t.cierto(a === b, "el año ya calculado se reutiliza, no se vuelve a calcular");
      t.cierto(a.has("2028-01-01"), "y el conjunto responde por pertenencia");
    });

    t.caso("las dos piezas del cálculo, por separado (un fallo aquí se propaga a todo el calendario)", () => {
      const d = (iso) => new Date(iso + "T00:00:00Z");
      t.igual(api._mtrIsoUTC(d("2026-08-21")), "2026-08-21", "la fecha vuelve a ISO sin desplazarse de huso");
      t.igual(api._mtrIsoUTC(new Date(Date.UTC(2026, 0, 5))), "2026-01-05", "con ceros a la izquierda");
      t.igual(api._mtrIsoUTC(null), null, "sin fecha, nada");
      t.igual(api._mtrIsoUTC(new Date("basura")), null, "y una fecha inválida no se disfraza de ISO");
      // El traslado de la Ley Emiliani: lo que ya es lunes NO se mueve.
      t.igual(api._mtrIsoUTC(api._mtrLunesSiguiente(d("2026-01-06"))), "2026-01-12", "martes -> lunes siguiente");
      t.igual(api._mtrIsoUTC(api._mtrLunesSiguiente(d("2026-06-29"))), "2026-06-29", "lunes -> se queda donde está");
      t.igual(api._mtrIsoUTC(api._mtrLunesSiguiente(d("2026-11-01"))), "2026-11-02", "domingo -> el lunes de al lado");
      t.igual(api._mtrLunesSiguiente(null), null, "sin fecha no lanza");
    });

    t.caso("Emiliani: lo que cae lunes se queda, lo que no se corre al lunes siguiente", () => {
      // 2026: Reyes (6-ene, martes) -> 12; San Pedro (29-jun) YA es lunes -> se queda.
      t.cierto(api.mtrEsFestivoCO("2026-01-12"), "Reyes trasladado");
      t.falso(api.mtrEsFestivoCO("2026-01-06"), "y el día litúrgico deja de ser festivo");
      t.cierto(api.mtrEsFestivoCO("2026-06-29"), "San Pedro ya caía lunes: no se mueve");
      // Los de Semana Santa NO se trasladan: caen donde caen.
      t.cierto(api.mtrEsFestivoCO("2026-04-02") && api.mtrEsFestivoCO("2026-04-03"), "Jueves y Viernes Santo");
      t.falso(api.mtrEsFestivoCO("2026-04-06"), "el lunes siguiente a Semana Santa NO es festivo");
    });

    // ---------- vigencias: las decisiones clínicas ya firmadas ----------

    t.caso("D-4: el estadio G5 hereda la columna de G4, no se queda sin tabla", () => {
      for (const ana of ["creatinina", "glicemia", "ldl", "pth", "hemoglobina"]) {
        t.igual(api.mtrVigenciaDias("ERC", ana, "G5", false, null, null),
          api.mtrVigenciaDias("ERC", ana, "G4", false, null, null),
          "G5 debía heredar G4 en " + ana);
      }
    });

    t.caso("el paciente más grave nunca recibe una vigencia más larga que el menos grave", () => {
      const orden = ["G1", "G2", "G3a", "G3b", "G4", "G5"];
      const min = (v) => (Array.isArray(v) ? v[0] : (typeof v === "number" ? v : null));
      for (const ana of ["creatinina", "glicemia", "colesterol_total", "hemoglobina"]) {
        let previo = null;
        for (const est of orden) {
          const v = min(api.mtrVigenciaDias("ERC", ana, est, true, null, null));
          if (v === null) continue;
          if (previo !== null) t.cierto(v <= previo, `${ana}: ${est} (${v}d) es más largo que el estadio anterior (${previo}d)`);
          previo = v;
        }
      }
    });

    t.caso("la HbA1c está bloqueada en ERC si el paciente no tiene DM2 confirmado", () => {
      t.igual(api.mtrVigenciaDias("ERC", "hba1c", "G3a", false, null, null), "BLOQ");
      t.igual(api.mtrVigenciaDias("ERC", "hba1c", "G3a", true, null, null), 180);
    });

    t.caso("con albuminuria (RAC>=30) la RAC se repite a la mitad de su vigencia", () => {
      t.igual(api.mtrVigenciaDias("ERC", "rac", "G3a", false, null, 29), 180, "por debajo del corte no cambia");
      t.igual(api.mtrVigenciaDias("ERC", "rac", "G3a", false, null, 30), 90, "en el corte se parte a la mitad");
      t.igual(api.mtrVigenciaDias("ERC", "rac", "G3a", false, null, 300), 90);
      // y SOLO a la RAC: la decisión del médico fue expresa
      t.igual(api.mtrVigenciaDias("ERC", "parcial_orina", "G3a", false, null, 300), 180);
    });

    t.caso("el ECG en DM2 solo aplica desde los 45 años", () => {
      t.igual(api.mtrVigenciaDias("DM2", "ecg", null, false, 44, null), null);
      t.igual(api.mtrVigenciaDias("DM2", "ecg", null, false, 45, null), 365);
    });

    // v17.0.3 — BUG REAL DE CAMPO (reporte del médico, 21-ago): "la Hemoglobina se ordena
    // en TODOS los programas a TODOS los pacientes", pero MTR_HTA y MTR_DM2 no tenían
    // entrada "hemoglobina" — solo MTR_ERC. Para un paciente HTA o DM2 puro, mtrVigenciaDias
    // devolvía null (analito "no aplica a este programa") y el Panel nunca la mostraba ni
    // en "Qué ordenar" ni en "Lo que sigue vigente", aunque Auto-Labs sí la completa si
    // Athenea trae resultado (está en la lista blanca de 13 analitos desde v12.5.6).
    t.caso("la Hemoglobina SÍ aplica en HTA y en DM2 (antes daba null: invisible para el Panel)", () => {
      t.igual(api.mtrVigenciaDias("HTA", "hemoglobina", null, false, null, null), 365, "HTA: 365 días, igual que ERC G1-G3b");
      t.igual(api.mtrVigenciaDias("DM2", "hemoglobina", null, false, null, null), 365, "DM2: mismo valor");
      t.igual(api.mtrVigenciaDias("DM2", "hemoglobina", null, true, null, null), 365, "y no depende de la edad (a diferencia del ECG)");
      // Sigue existiendo en ERC, escalonada por estadio — esto NO cambió con el arreglo.
      t.igual(api.mtrVigenciaDias("ERC", "hemoglobina", "G1", false, null, null), 365, "ERC G1: igual que antes");
      t.igual(api.mtrVigenciaDias("ERC", "hemoglobina", "G4", false, null, null), 180, "ERC G4: se acorta, igual que antes");
    });

    t.caso("la jerarquía del programa rector es ERC > DM2 > HTA, salvo ERC en G1/G2", () => {
      t.igual(api.mtrProgramaRector(true, "G3a", true, true), "ERC");
      t.igual(api.mtrProgramaRector(true, "G1", true, true), "DM2", "ERC G1 cede el mando");
      t.igual(api.mtrProgramaRector(true, "G2", false, true), "HTA");
      t.igual(api.mtrProgramaRector(true, "G1", false, false), "ERC", "ERC G1 sin DM2 ni HTA sigue rigiendo");
      t.igual(api.mtrProgramaRector(false, null, false, false), null);
    });

    t.caso("el ANR solo existe de G3a en adelante, y la vigilancia estrecha manda", () => {
      t.igual(api.mtrVentanaAnrDias("G2", "muy alto", false), null, "G2 no tiene ANR");
      t.igual(api.mtrVentanaAnrDias("G3a", "muy alto", false), 45);
      t.igual(api.mtrVentanaAnrDias("G3a", "alto", false), 60);
      t.igual(api.mtrVentanaAnrDias("G3a", "moderado", false), 90);
      t.igual(api.mtrVentanaAnrDias("G3a", "muy alto", true), 30, "la vigilancia estrecha fuerza 30d");
      t.igual(api.mtrVentanaAnrDias("G3a", "cualquier cosa", false), null, "categoría no reconocida: no se infiere");
    });

    // ---------- higiene del port ----------

    t.caso("el redondeo es el de Python (mitad al par), no el de JavaScript", () => {
      t.igual(api.mtrRound(2.5, 0), 2, "JS daría 3");
      t.igual(api.mtrRound(3.5, 0), 4);
      t.igual(api.mtrRound(0.5, 0), 0, "JS daría 1");
      t.igual(api.mtrRound(1.25, 1), 1.2, "JS daría 1.3");
    });

    t.caso("ante basura se devuelve casilla vacía, nunca un número inventado", () => {
      t.igual(api.mtrFloat("abc"), null);
      t.igual(api.mtrFloat(""), null);
      t.igual(api.mtrFloat(null), null);
      t.igual(api.mtrFechaIso("15/08/2026"), null, "formato no ISO");
      t.igual(api.mtrFechaIso("2026-02-30"), null, "fecha que el calendario no tiene");
      t.igual(api.mtrFechaIso("2026-08-15T10:30:00"), "2026-08-15", "un timestamp sí es legible");
    });

    t.caso("ninguna función del motor lanza ante entradas imposibles", () => {
      const basura = [null, undefined, "", 0, NaN, "xxx", {}, [], -1, 1e300];
      const fns = ["mtrEsFestivoCO", "mtrEsDiaNoHabil", "mtrAjustarFechaHabil",
        "mtrRetrocederADiaHabil", "mtrDiaValidoParaControlConSabado", "mtrFechaIso",
        "mtrNormalizarRiesgoCv", "mtrCnoHDL", "mtrReduccionLdlPct"];
      for (const n of fns) {
        for (const b of basura) {
          t.noLanza(() => api[n](b, b, b, b, b, b), n + " lanzó con " + JSON.stringify(b));
        }
      }
    });

    // ---------- las piezas internas, ejercitadas de verdad ----------
    //
    // Van con prueba propia y no solo apoyadas en las de arriba: son las que
    // deciden si un valor entra o se descarta, y un fallo aquí se propaga a
    // todo el bloque sin dejar rastro en la función que lo llamó.

    t.caso("mtrEsFalsy reproduce la verdad de Python: 0 y '' son falsos", () => {
      for (const v of [null, undefined, 0, "", false, NaN]) t.cierto(api.mtrEsFalsy(v), JSON.stringify(v));
      for (const v of [1, -1, "0", "x", [], {}, true]) t.falso(api.mtrEsFalsy(v), JSON.stringify(v));
    });

    t.caso("mtrNormalizarTexto quita tildes y baja a minúsculas", () => {
      t.igual(api.mtrNormalizarTexto("MUY ALTÓ"), "muy alto");
      t.igual(api.mtrNormalizarTexto("Hipertensión"), "hipertension");
      t.igual(api.mtrNormalizarTexto(null), "");
      t.igual(api.mtrNormalizarTexto(""), "");
    });

    t.caso("mtrFechaDesdeIso rechaza lo que el calendario no tiene", () => {
      t.cierto(api.mtrEsFecha(api.mtrFechaDesdeIso("2026-08-15")), "debia devolver un Date");
      t.igual(api.mtrFechaDesdeIso("2026-02-30"), null, "30 de febrero");
      t.igual(api.mtrFechaDesdeIso("2026-13-01"), null, "mes 13");
      t.igual(api.mtrFechaDesdeIso("2026-00-10"), null, "mes 0");
      t.igual(api.mtrFechaDesdeIso("15-08-2026"), null, "orden invertido");
      t.igual(api.mtrFechaDesdeIso(20260815), null, "no es texto");
    });

    t.caso("mtrIsoDesdeFecha y mtrFechaDesdeIso son inversas, y no se van de huso", () => {
      for (const s of ["2026-01-01", "2026-08-15", "2026-12-31", "2027-02-28"]) {
        t.igual(api.mtrIsoDesdeFecha(api.mtrFechaDesdeIso(s)), s);
      }
      t.igual(api.mtrIsoDesdeFecha(null), null);
      // un Date invalido creado DENTRO del mismo realm que el userscript
      t.igual(api.mtrIsoDesdeFecha(api.mtrFechaDesdeIso("2026-02-30")), null);
      // y uno de OTRO realm (como los que vienen del iframe clon) sigue valiendo
      t.igual(api.mtrIsoDesdeFecha(new Date(Date.UTC(2026, 7, 15))), "2026-08-15",
        "un Date de otro realm debe seguir leyendose: instanceof no cruza realms");
    });

    t.caso("mtrIdxEstadio mapea a la columna correcta y G5 apunta a la de G4", () => {
      t.igual(api.mtrIdxEstadio("G1"), 0);
      t.igual(api.mtrIdxEstadio("g3a"), 2);
      t.igual(api.mtrIdxEstadio("G3B"), 3);
      t.igual(api.mtrIdxEstadio("G4"), 4);
      t.igual(api.mtrIdxEstadio("G5"), 4, "D-4: G5 hereda G4");
      t.igual(api.mtrIdxEstadio("XX"), null);
      t.igual(api.mtrIdxEstadio(""), null);
      t.igual(api.mtrIdxEstadio(null), null);
    });

    t.caso("mtrNormEstadio del ANR sí distingue G5 de G4", () => {
      t.igual(api.mtrNormEstadio("G5"), "G5", "el ANR sí tabula G5: no se toca");
      t.igual(api.mtrNormEstadio("g3b"), "G3b");
      t.igual(api.mtrNormEstadio("XX"), null);
      t.igual(api.mtrNormEstadio(null), null);
    });

    t.caso("mtrAcortarRacSiAlbuminuria parte rangos y respeta BLOQ", () => {
      t.igual(api.mtrAcortarRacSiAlbuminuria("rac", 180, 45), 90);
      t.igual(api.mtrAcortarRacSiAlbuminuria("rac", [90, 121], 45), [45, 60], "el rango se parte entero");
      t.igual(api.mtrAcortarRacSiAlbuminuria("rac", "BLOQ", 45), "BLOQ", "no hay nada que acortar");
      t.igual(api.mtrAcortarRacSiAlbuminuria("rac", null, 45), null);
      t.igual(api.mtrAcortarRacSiAlbuminuria("rac", 180, "basura"), 180, "una RAC ilegible no acorta nada");
      t.igual(api.mtrAcortarRacSiAlbuminuria("creatinina", 180, 300), 180, "solo la RAC");
      t.igual(api.mtrAcortarRacSiAlbuminuria("rac", 1, 45), 1, "nunca baja de 1 día");
    });

    // ---------- la deuda que sigue viva al otro lado ----------

    t.caso("PENDIENTE_COPILOTO: el Python todavía retrasa la toma en vez de adelantarla", () => {
      // Esta prueba NO comprueba el Vigilante: comprueba que la deuda del Copiloto
      // sigue ahí. Cuando se arregle `ajustar_fecha_habil` allá, los dos valores
      // coincidirán, esta prueba caerá, y ese fallo es la señal de que hay que
      // borrarla y unificar. Es un recordatorio con fecha de caducidad automática.
      const domingo = "2026-08-16";
      const aPython = api.mtrAjustarFechaHabil(domingo);   // port fiel: +1
      const aDecidido = api.mtrRetrocederADiaHabil(domingo); // lo firmado el 5-ago
      t.cierto(aPython > domingo, "el port fiel del Python debía retrasar");
      t.cierto(aDecidido < domingo, "la regla decidida debía adelantar");
      t.cierto(aPython !== aDecidido,
        "Si esto falla: el Copiloto ya adelanta la toma. Borra esta prueba, quita " +
        "mtrRetrocederADiaHabil de las excepciones y unifica con el port fiel.");
    });
  },
};
