// =====================================================================
//  SUITE 49 — Falla terapéutica, recontrol, MTT y telemetría de uso
//
//  Dos cosas que esta suite protege por encima del resto:
//
//   1. La regla de gravedad. Un >30% de sobrepaso es grave a CUALQUIER edad;
//      la vía de riesgo (alto + eGFR<45 + <75 años) SÍ la baja la edad. Es
//      fácil colar un `&&` de más y dejar a un anciano con LDL disparado como
//      "leve" — o al revés, alarmar de más. Se fija cada caso.
//
//   2. La barrera anti-PHI de la telemetría. La clave que se manda al tablero
//      NUNCA puede llevar un dato del paciente. Se comprueba que toda clave
//      emitida es un enum acotado y que ni un valor clínico crudo se cuela.
// =====================================================================

module.exports = {
  nombre: "Falla terapéutica, recontrol, MTT y telemetría",
  cubre: [
    "mtrGravedadFalla", "mtrEvaluarFalla", "mtrVentanaRecontrol", "mtrFechaRecontrol",
    "mtrDosisDeTexto", "mtrEstatinaAltaIntensidad", "mtrInerciaEstatina",
    "mtrConsolidarMtt", "mtrPlanFallas", "mtrTelemetriaResumen",
    "mtrMetaGlicemiaGeneral", "mtrAcortarPorFueraDeMeta",
  ],

  pruebas(t, api) {
    // ================= GRAVEDAD DE LA FALLA =================

    // v17.54.0 (D9) — REESCRITA. Fijaba el margen del +15 %, que era la decisión del médico
    // del 20-ago y que él mismo revocó el 29-ago: "ya no quiero usar el +15% ahora quiero ser
    // estricto como lo dicen las guías". No era una prueba equivocada: era la prueba correcta
    // de una decisión anterior. Lo que fija ahora es el contrato nuevo, y de paso el borde
    // exacto, que es lo único que la anterior no comprobaba.
    t.caso("v17.54.0 (D9): por encima de la meta ya hay falla — sin franja de cortesía", () => {
      t.igual(api.mtrGravedadFalla(70, 70, {}), null, "justo EN la meta no es falla");
      t.igual(api.mtrGravedadFalla(70.1, 70, {}), "leve", "un décimo por encima ya lo es");
      t.igual(api.mtrGravedadFalla(80, 70, {}), "leve", "80 con meta 70: antes se callaba, ahora se dice");
      t.igual(api.mtrGravedadFalla(69, 70, {}), null, "por debajo de la meta, nada");
      t.igual(api.mtrGravedadFalla(80.5, 70, {}), "leve", "el antiguo borde del +15% ya no protege a nadie");
    });

    t.caso("entre meta+15% y meta+30% es leve (sin la vía de riesgo)", () => {
      t.igual(api.mtrGravedadFalla(85, 70, {}), "leve", "85 vs 70 = +21%");
    });

    // v17.55.0 (D10) — REESCRITA. Fijaba el escalón del +30 %, que el médico retiró: "Sin
    // +30%, pero la regla renal se queda". No era una prueba equivocada: era la prueba
    // correcta de la regla anterior. Lo que fija ahora es que ese escalón YA NO EXISTE —
    // por muy lejos que esté el paciente de su meta, la gravedad la decide la función renal.
    // Que un descontrolado severo no se quede sin vigilancia lo garantiza otra cosa: desde
    // esta versión TODA falla lleva fecha de recontrol (ver mtrPlanFallas).
    t.caso("v17.55.0 (D10): por muy alto que esté, el porcentaje ya no hace grave a nadie", () => {
      t.igual(api.mtrGravedadFalla(95, 70, { edad: 82 }), "leve", "+35% a los 82 sin criterio renal: leve");
      t.igual(api.mtrGravedadFalla(95, 70, { edad: 50 }), "leve", "y a los 50 también");
      t.igual(api.mtrGravedadFalla(260, 70, { edad: 50 }), "leve", "ni un LDL al cuádruple de su meta");
      t.igual(api.mtrGravedadFalla(260, 70, { categoriaRiesgo: "alto", egfr: 40, edad: 50 }), "grave",
        "el ÚNICO camino a grave: riesgo alto + eGFR<45 + menor de 75");
    });

    t.caso("la vía de riesgo hace grave a <75 con eGFR<45 y riesgo alto, y NO a los >=75", () => {
      const ctxJoven = { categoriaRiesgo: "alto", egfr: 40, edad: 60 };
      t.igual(api.mtrGravedadFalla(83, 70, ctxJoven), "grave", "+18% pero riesgo alto + eGFR40 + 60a");
      const ctxMayor = { categoriaRiesgo: "alto", egfr: 40, edad: 78 };
      t.igual(api.mtrGravedadFalla(83, 70, ctxMayor), "leve", "misma cifra a los 78: la vía de riesgo NO aplica");
      const ctxRenalOk = { categoriaRiesgo: "alto", egfr: 60, edad: 60 };
      t.igual(api.mtrGravedadFalla(83, 70, ctxRenalOk), "leve", "eGFR 60 no dispara la vía de riesgo");
      const ctxBajo = { categoriaRiesgo: "moderado", egfr: 40, edad: 60 };
      t.igual(api.mtrGravedadFalla(83, 70, ctxBajo), "leve", "riesgo moderado tampoco");
    });

    t.caso("mtrEvaluarFalla devuelve el exceso en % y un motivo legible", () => {
      const f = api.mtrEvaluarFalla("LDL", 95, 70, { edad: 50 });
      t.cierto(f.falla, "es falla");
      t.igual(f.gravedad, "leve", "v17.55.0: sin criterio renal, el porcentaje ya no la hace grave");
      t.cierto(Math.abs(f.excesoPct - 35.7) < 0.2, "exceso ~35.7% — el dato SIGUE viajando, aunque ya no decida la gravedad");
      t.falso(/30%/.test(f.motivo), "y el motivo ya no puede nombrar un escalón que no existe");
      const g = api.mtrEvaluarFalla("LDL", 95, 70, { categoriaRiesgo: "alto", egfr: 40, edad: 50 });
      t.igual(g.gravedad, "grave");
      t.cierto(/eGFR<45/.test(g.motivo), "y el motivo dice el único porqué que queda: " + g.motivo);
    });

    // ================= v17.55.0 — MENOS VIAJES AL LABORATORIO =================
    // Encargo del médico, textual: "la idea es que el paciente tenga la menos cantidad de
    // veces que ir a sangrarse e ir a la IPS". Medido sobre 3.072 planes ANTES de tocar nada:
    // 2,33 viajes por paciente y el 78,1 % con una segunda cita dedicada.
    // =========================================================================

    t.caso("v17.55.0: la ventana de recontrol se usa ENTERA — el extremo largo por defecto", () => {
      // Hasta hoy `maxDias` se declaraba, viajaba en el objeto devuelto y no colocaba
      // ninguna fecha jamás: el "6-8 semanas" del LDL era en realidad "42 días, siempre".
      // `diasReales` puede pasarse unos días del objetivo porque la fecha se ajusta a día
      // hábil (sábado sí, domingo y festivo no) — por eso se comprueba el tramo, no el punto.
      const largo = api.mtrFechaRecontrol("ldl", "2026-08-16", {});
      t.cierto(largo.diasReales >= 56 && largo.diasReales <= 59,
        "LDL sin urgencia: 8 semanas, que caben mejor en la toma maestra (dio " + largo.diasReales + ")");
      const corto = api.mtrFechaRecontrol("ldl", "2026-08-16", { urgente: true });
      t.cierto(corto.diasReales >= 42 && corto.diasReales <= 45,
        "con criterio renal sí se aprieta a 6 semanas (dio " + corto.diasReales + ")");
      t.cierto(corto.diasReales < largo.diasReales, "y el urgente siempre cae antes que el normal");
      t.cierto(corto.diasReales >= largo.pisoDias, "nunca por debajo del piso de 4 semanas");
    });

    t.caso("v17.55.0: donde la biología no deja graduar, no se gradúa", () => {
      // En HbA1c el piso ES el extremo corto (90 d): antes no es interpretable, así que
      // urgente y no urgente coinciden. El diseño se autolimita en vez de fingir precisión.
      t.igual(api.mtrFechaRecontrol("hba1c", "2026-08-16", {}).diasReales, 120);
      t.igual(api.mtrFechaRecontrol("hba1c", "2026-08-16", { urgente: true }).diasReales, 90);
      t.igual(api.mtrVentanaRecontrol("hba1c").pisoDias, 90, "el piso y el extremo corto son el mismo número");
    });

    t.caso("v17.55.0: TODA falla lleva fecha, no solo las graves", () => {
      const base = { hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55 };
      const leve = api.mtrPlanFallas(Object.assign({}, base, { ldl: { actual: 260, meta: 70 } }));
      t.igual(leve.fallas[0].gravedad, "leve", "sin criterio renal, un LDL al cuádruple es leve");
      t.igual(leve.recontroles.length, 1, "pero NO se queda sin fecha: eso era lo que D10 iba a romper");
    });

    t.caso("v17.55.0: una falla leve no manda al paciente a sangrarse aparte", () => {
      const base = { hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55, ftlMaestra: "2027-01-01" };
      const leve = api.mtrPlanFallas(Object.assign({}, base, { ldl: { actual: 260, meta: 70 } }));
      t.igual(leve.fechasDedicadas.length, 0, "la toma maestra queda lejísimos y aun así no hay segunda cita");
      t.igual(leve.sinViaje.length, 1, "queda anotada, no desaparece");
      const grave = api.mtrPlanFallas(Object.assign({}, base, { egfr: 40, ldl: { actual: 260, meta: 70 } }));
      t.igual(grave.fechasDedicadas.length, 1, "la misma cifra con criterio renal SÍ justifica el viaje aparte");
    });

    t.caso("v17.55.0: el barrido completo hace menos viajes que antes, y nadie se queda sin fecha", () => {
      // La métrica de esta entrega. Base medida con el código de la v17.54.0: 2,329 viajes
      // por paciente y 78,1 % con segunda cita.
      let n = 0, viajes = 0, conDed = 0, sinFecha = 0;
      for (const creat of [0.9, 1.4, 2.0, 2.6]) {
        for (const ldl of [60, 90, 140, 260]) {
          for (const hba1c of [null, 6.8, 7.6, 11.5]) {
            for (const glu of [95, 140, 220]) {
              const r = api.mtrPlanFallas({
                hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: (creat > 2 ? 30 : 70), edad: 66,
                esDm2: hba1c != null, ftlMaestra: "2026-10-01",
                ldl: { actual: ldl, meta: 70 },
                hba1c: hba1c != null ? { actual: hba1c } : null,
                glicemia: { actual: glu },
              });
              n++;
              const ded = (r.fechasDedicadas || []).length;
              viajes += 1 + ded;
              if (ded) conDed++;
              // La contracara: nadie con falla puede quedarse sin nada. La glicemia es la
              // excepción DECIDIDA —no tiene fecha propia a propósito, la cubre la toma
              // maestra— así que se comprueba sobre las fallas que sí deben tenerla.
              const noGlicemia = (r.fallas || []).filter((x) => x.analito !== "Glicemia");
              if (noGlicemia.length && !(r.recontroles || []).length && !ded) sinFecha++;
            }
          }
        }
      }
      const media = viajes / n;
      t.cierto(media < 2.0, "viajes por paciente = " + media.toFixed(3) + " — la base de la v17.54.0 era 2,329");
      t.cierto(conDed / n < 0.6, "con segunda cita = " + (100 * conDed / n).toFixed(1) + " % — la base era 78,1 %");
      t.igual(sinFecha, 0, "y NADIE con falla se queda sin ninguna fecha: menos viajes no puede ser menos vigilancia");
    });

    t.caso("v17.55.0: una glicemia sola en falla no tiene fecha propia — y eso es lo que ahorra el viaje", () => {
      const base = { hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55, esDm2: true, ftlMaestra: "2026-10-01" };
      const sola = api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 220 } }));
      t.igual(sola.fallas.length, 1, "la falla SÍ se declara: el médico la ve y la IA la redacta");
      t.igual(sola.recontroles.length, 0, "pero no genera fecha propia");
      t.igual(sola.fechasDedicadas.length, 0, "ni cita aparte: la cubre la toma maestra y su vigencia ya partida por la D9");
    });

    // ================= VENTANAS Y FECHAS DE RECONTROL =================

    t.caso("las ventanas de recontrol son las de la norma", () => {
      t.igual(api.mtrVentanaRecontrol("ldl").minDias, 42, "LDL 6 semanas");
      t.igual(api.mtrVentanaRecontrol("ldl").pisoDias, 28, "nunca antes de 4 semanas");
      t.igual(api.mtrVentanaRecontrol("hba1c").minDias, 90, "HbA1c mínimo 90 días");
      t.igual(api.mtrVentanaRecontrol("glicemia").minDias, 14, "glicemia 2 semanas");
      t.igual(api.mtrVentanaRecontrol("desconocido"), null, "un analito fuera de la lista no inventa ventana");
    });

    // v17.6.84 — decisión del médico del 26-ago ("Sí, piso de 90 días"). La regla del 50%
    // (v16.2.7) partía la vigencia de cualquier analito fuera de meta sin mirar si el
    // resultado seguía siendo interpretable. En ERC G4 la HbA1c vale 120 días, así que una
    // HbA1c fuera de meta se volvía a pedir a los 60 — por debajo del piso de 90 que el
    // propio motor declara en MTR_RECONTROL. En G4 la vida del eritrocito ya está acortada:
    // repetirla a los 60 días no es interpretable como respuesta al tratamiento, gasta un
    // cupo de alto costo y le suma un viaje al paciente.
    t.caso("v17.6.84: la regla del 50% nunca baja la HbA1c por debajo de su piso de 90 días", () => {
      t.igual(api.mtrAcortarPorFueraDeMeta(120, true, "HBA1C"), 90,
        "ERC G4: 120 días fuera de meta se quedan en 90, no en 60");
      t.igual(api.mtrAcortarPorFueraDeMeta(180, true, "HBA1C"), 90,
        "y desde 180 el 50% ya da 90 justo: sin cambio");
      t.igual(api.mtrAcortarPorFueraDeMeta(60, true, "HBA1C"), 60,
        "si la NORMA ya da menos que el piso, manda la norma: el piso nunca ALARGA una vigencia");
      t.igual(api.mtrAcortarPorFueraDeMeta(120, false, "HBA1C"), 120,
        "en meta no se acorta nada");
      t.igual(api.mtrAcortarPorFueraDeMeta(120, true, "COLESTEROL_LDL"), 60,
        "el LDL no cambia: su piso (28 d) no se alcanza con estas vigencias");
      t.igual(api.mtrAcortarPorFueraDeMeta(120, true, "TRIGLICERIDOS"), 60,
        "un analito sin piso declarado conserva el comportamiento de siempre");
    });

    t.caso("la fecha de recontrol respeta el piso y cae en día hábil", () => {
      const r = api.mtrFechaRecontrol("ldl", "2026-08-16", {});
      t.cierto(r.diasReales >= 42, "al menos 42 días");
      t.falso(api.mtrEsFestivoCO(r.fecha), "no cae en festivo");
      // 2026-08-16 + 42 = 2026-09-27 (domingo) -> avanza a hábil.
      t.cierto(api.mtrFechaDesdeIso(r.fecha).getUTCDay() !== 0, "no cae en domingo");
    });

    // ================= INERCIA (ESTATINA DE ALTA INTENSIDAD) =================

    t.caso("reconoce atorvastatina 40-80 y rosuvastatina 20-40 como alta intensidad", () => {
      t.cierto(!!api.mtrEstatinaAltaIntensidad(["Atorvastatina 40 mg"]), "atorva 40");
      t.cierto(!!api.mtrEstatinaAltaIntensidad(["ROSUVASTATINA 20MG"]), "rosuva 20");
      t.igual(api.mtrEstatinaAltaIntensidad(["Atorvastatina 20 mg"]), null, "atorva 20 NO es alta intensidad");
      t.igual(api.mtrEstatinaAltaIntensidad(["Rosuvastatina 10 mg"]), null, "rosuva 10 tampoco");
      t.igual(api.mtrEstatinaAltaIntensidad(["Losartán 50 mg"]), null, "un ARA-II no es estatina");
    });

    t.caso("lee la dosis aunque el nombre venga en un objeto o con acentos", () => {
      t.igual(api.mtrDosisDeTexto("Atorvastatina 80 mg noche", "atorvastatina"), 80, "extrae 80");
      t.cierto(!!api.mtrEstatinaAltaIntensidad([{ nombre: "atorvastatina 40 mg" }]), "acepta objeto con .nombre");
    });

    // =================================================================
    //  v18.0.49 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta:
    //  EN UNA COMBINACIÓN DE DOSIS FIJA SE LEÍA LA DOSIS DEL OTRO PRINCIPIO ACTIVO.
    //
    //  «Amlodipino/Atorvastatina 5/40mg» es una presentación real y común en HTA +
    //  dislipidemia. Se tomaba el PRIMER número tras el nombre buscado, y después de
    //  «atorvastatina» lo primero que aparece es el 5 del amlodipino. Resultado medido:
    //  el script le decía al médico «LDL en falla SIN estatina de alta intensidad: revise
    //  intensidad» de un paciente que YA está en atorvastatina 40 mg. Una afirmación
    //  clínicamente falsa que empuja a subir una dosis que ya está bien.
    // =================================================================
    t.caso("dosis fija combinada: cada dosis se empareja con SU principio, no con el primer número", () => {
      t.igual(api.mtrDosisDeTexto("Amlodipino/Atorvastatina 5/40mg tableta, 1 cada noche", "atorvastatina"), 40,
        "la atorvastatina es 40, no el 5 del amlodipino");
      t.igual(api.mtrDosisDeTexto("Amlodipino/Atorvastatina 5/40mg tableta", "amlodipino"), 5,
        "y el amlodipino sigue siendo 5: se emparejan por posición, no se invierte el error");
      t.igual(api.mtrDosisDeTexto("Losartan/Hidroclorotiazida 50/12,5 mg", "hidroclorotiazida"), 12.5,
        "con coma decimal, como lo escribe el laboratorio");

      // La consecuencia clínica, que es lo que el médico veía:
      const combo = ["Amlodipino/Atorvastatina 5/40mg tableta, 1 cada noche"];
      const r = api.mtrInerciaEstatina(true, combo);
      t.falso(r.inercia, "con atorvastatina 40 en un combo NO se declara inercia");
      t.igual(r.estatina.dosis, 40, "y se reconoce la dosis real");
    });

    t.caso("dosis fija combinada: si no se puede emparejar, se devuelve VACÍO en vez de adivinar", () => {
      // Un combo con un solo número es ambiguo: ese 5 puede ser de cualquiera de los dos.
      // Antes se devolvía 5 como si fuera de la atorvastatina. Casilla vacía antes que dato
      // inventado — y aquí el dato inventado es la dosis de OTRO fármaco.
      t.igual(api.mtrDosisDeTexto("Amlodipino/Atorvastatina 5 mg", "atorvastatina"), null,
        "un combo sin bloque de dosis emparejable no da número");
      // Y lo que NO es un combo sigue leyéndose exactamente igual que siempre.
      t.igual(api.mtrDosisDeTexto("Atorvastatina 80 mg noche", "atorvastatina"), 80, "un solo principio: sin cambios");
      t.igual(api.mtrDosisDeTexto("Rosuvastatina 20 mg", "rosuvastatina"), 20, "tampoco aquí");
    });

    // v18.0.97 — CIERRE DEL ENJAMBRE (02-sep): el emparejamiento por posición solo se
    // activaba con «/». El catálogo INVIMA/CUM nombra las combinaciones con «+» y a veces
    // con «-»; con esos separadores se caía a la lectura vieja y volvía a leer la dosis del
    // OTRO principio — y mtrInerciaEstatina volvía a acusar «sin estatina de alta
    // intensidad» a un paciente en atorvastatina 40.
    t.caso("v18.0.97: las combinaciones con «+» y «-», y las dosis «5 mg + 40 mg» / «5mg/40mg», emparejan por posición igual que con «/»", () => {
      t.igual(api.mtrDosisDeTexto("Amlodipino + Atorvastatina 5/40 mg", "atorvastatina"), 40, "«+» entre nombres — antes 5");
      t.igual(api.mtrDosisDeTexto("AMLODIPINO + ATORVASTATINA 5 MG + 40 MG", "atorvastatina"), 40, "«+» entre nombres y entre dosis con unidad — antes 5");
      t.igual(api.mtrDosisDeTexto("Ezetimiba + Rosuvastatina 10/20 mg", "rosuvastatina"), 20, "otra pareja real — antes 10");
      t.igual(api.mtrDosisDeTexto("Amlodipino-Atorvastatina 5/40 mg", "atorvastatina"), 40, "«-» entre nombres — antes 5");
      t.igual(api.mtrDosisDeTexto("AMLODIPINO/ATORVASTATINA 5MG/40MG TABLETA", "atorvastatina"), 40, "unidad pegada a cada dosis — antes null");
      t.igual(api.mtrDosisDeTexto("Amlodipino + Atorvastatina 5/40 mg", "amlodipino"), 5, "y el primero de la pareja sigue leyendo el suyo");
      t.igual(api.mtrDosisDeTexto("Losartan 50 mg + Hidroclorotiazida 12.5 mg", "losartan"), 50, "dos principios con su dosis cada uno no son un combo: lectura de siempre");
      t.igual(api.mtrDosisDeTexto("Amlodipino/Atorvastatina 5 mg", "atorvastatina"), null, "y lo ambiguo sigue siendo null, no la dosis del otro");
      t.falso(api.mtrInerciaEstatina(true, ["Amlodipino + Atorvastatina 5/40 mg"]).inercia,
        "el médico ya NO recibe «LDL en falla sin estatina de alta intensidad» por un paciente en atorvastatina 40");
    });

    t.caso("inercia: una falla de LDL sin estatina de alta intensidad la marca", () => {
      const conInercia = api.mtrInerciaEstatina(true, ["Atorvastatina 20 mg"]);
      t.cierto(conInercia.inercia, "dosis corta con falla = inercia");
      t.cierto(/intensidad y adherencia/i.test(conInercia.mensaje), "y lo dice");
      const sinInercia = api.mtrInerciaEstatina(true, ["Atorvastatina 80 mg"]);
      t.falso(sinInercia.inercia, "con alta intensidad no hay inercia (será adherencia u otra cosa)");
      t.igual(api.mtrInerciaEstatina(false, []), null, "sin falla de LDL, no se evalúa inercia");
    });

    // ================= MTT-CONSOLIDA =================

    // v17.6.57 (1.19) — la fusión solo puede ser un RETRASO del recontrol (la FTL cae en o
    // después de su fecha natural): fusionar a una FTL ANTERIOR lo adelantaría, y un
    // recontrol de LDL adelantado a 2-3 semanas de cambiar la estatina no es interpretable.
    t.caso("una falla grave cuyo recontrol cae cerca de la FTL, y la FTL es POSTERIOR (retraso), se FUSIONA (un solo viaje)", () => {
      const graves = [{ analito: "ldl", fecha: "2026-09-20", gravedad: "grave" }];
      const mtt = api.mtrConsolidarMtt(graves, "2026-10-05");   // FTL 15 días DESPUÉS del recontrol natural
      t.igual(mtt.fusiones.length, 1, "se fusiona a la FTL maestra (esperar 15 días más es aceptable)");
      t.igual(mtt.dedicadas.length, 0, "y no genera fecha aparte");
    });

    t.caso("1.19 — una falla grave cuyo recontrol cae DESPUÉS de la FTL nunca se ADELANTA fusionándola", () => {
      // Caso real de la auditoría: FTL a 14-21 d, recontrol de LDL (tras cambiar estatina)
      // a 42 d — antes se fusionaba (Math.abs <= 60) y el LDL se adelantaba a 2-3 semanas.
      const graves = [{ analito: "ldl", fecha: "2026-09-27", gravedad: "grave" }];   // 42 d desde el 16-ago
      const mtt = api.mtrConsolidarMtt(graves, "2026-08-16");   // FTL a los 14-21 d, ANTES del recontrol natural
      t.igual(mtt.fusiones.length, 0, "NO debe fusionarse: eso adelantaría el LDL por debajo del piso de 4 semanas");
      t.igual(mtt.dedicadas.length, 1, "debe quedar como fecha dedicada, respetando su fecha natural (2026-09-27)");
      t.igual(mtt.dedicadas[0].fecha, "2026-09-27", "sin adelantar ni un día");
    });

    t.caso("un recontrol lejano (>60 d de la FTL) se vuelve una 2ª fecha dedicada", () => {
      const graves = [{ analito: "hba1c", fecha: "2026-12-20", gravedad: "grave" }];
      const mtt = api.mtrConsolidarMtt(graves, "2026-09-20");   // 91 días
      t.igual(mtt.fusiones.length, 0, "no se fusiona");
      t.igual(mtt.dedicadas.length, 1, "es fecha dedicada");
    });

    t.caso("dos fechas dedicadas a <=7 d entre sí se colapsan en una", () => {
      const graves = [
        { analito: "ldl", fecha: "2026-12-20", gravedad: "grave" },
        { analito: "hba1c", fecha: "2026-12-23", gravedad: "grave" },
      ];
      const mtt = api.mtrConsolidarMtt(graves, "2026-09-20");
      t.igual(mtt.dedicadas.length, 1, "un solo viaje para las dos");
      t.igual(mtt.dedicadas[0].analitos.length, 2, "y lleva los dos analitos juntos");
    });

    // ================= ORQUESTADOR =================

    t.caso("mtrPlanFallas junta LDL y HbA1c, y solo evalúa HbA1c si es DM2", () => {
      const plan = api.mtrPlanFallas({
        hoyIso: "2026-08-16", categoriaRiesgo: "muy alto", egfr: 38, edad: 60,
        ftlMaestra: "2026-09-20", esDm2: true,
        ldl: { actual: 120, meta: 55 }, hba1c: { actual: 9.5, meta: 7 },
        meds: ["Atorvastatina 20 mg"],
      });
      t.igual(plan.fallas.length, 2, "LDL y HbA1c en falla");
      t.cierto(plan.hayGrave, "hay grave");
      t.cierto(plan.inercia && plan.inercia.inercia, "y marca inercia (atorva 20 con LDL en falla)");
      const noDm2 = api.mtrPlanFallas({
        hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 60,
        esDm2: false, ldl: { actual: 120, meta: 70 }, hba1c: { actual: 9.5, meta: 7 },
      });
      t.igual(noDm2.fallas.filter((f) => f.analito === "HbA1c").length, 0, "sin DM2 no se evalúa la HbA1c");
    });

    t.caso("sin LDL ni HbA1c, mtrPlanFallas no inventa fallas", () => {
      const plan = api.mtrPlanFallas({ hoyIso: "2026-08-16", esDm2: true });
      t.igual(plan.fallas.length, 0, "cero fallas");
      t.igual(plan.inercia, null, "y nada de inercia");
    });

    // ============ v17.54.0 — LA FUSIÓN MTT ENTRA EN LA ORDEN ============
    // La v17.7.5 midió 1.440 planes y encontró CERO fusiones fuera de la lista de órdenes, y
    // decidió NO escribir la unión explícita: habría sido una línea que ninguna mutación
    // podía matar. Correcto entonces; falso desde la D9. Al retirar el margen, un analito
    // puede entrar en falla SIN estar cerca de vencer, y ahí la coincidencia se rompe.
    t.caso("v17.54.0: una glicemia en falla TOMADA AYER entra en la orden, aunque su vigencia no haya vencido", () => {
      const ayer = new Date(Date.UTC(2026, 7, 15)).toISOString().slice(0, 10);
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 66, sexo: "M", pesoKg: 80, creatinina: 2.4,
        ct: 300, hdl: 35, ldl: 260, paSistolica: 150, paDiastolica: 90, hba1c: 11.5,
        factores: { hta: true, diabetes: true },
        ultimos: {
          CREATININA: { fecha: ayer, valor: 2.4 },
          COLESTEROL_LDL: { fecha: "2026-06-17", valor: 260 },
          COLESTEROL_TOTAL: { fecha: ayer, valor: 300 }, COLESTEROL_HDL: { fecha: ayer, valor: 35 },
          TRIGLICERIDOS: { fecha: ayer, valor: 250 }, GLUCOSA: { fecha: ayer, valor: 140 },
          RAC: { fecha: ayer, valor: 12 }, UROANALISIS: { fecha: ayer, valor: 1 },
          HEMOGLOBINA: { fecha: ayer, valor: 14 }, HBA1C: { fecha: "2026-06-17", valor: 11.5 },
        },
      });
      // v17.55.0 — la precondición ya no puede exigir «fusiones»: desde que los recontroles se
      // reparten entre fusionados, con cita dedicada y sin viaje, este caso acaba en cita
      // dedicada. Lo que esta prueba defiende NO es por dónde salga, sino que el examen se
      // pida. Ese fue justamente el defecto que cazó: la unión a la orden solo miraba las
      // fusiones, así que se agendaba la cita y nadie pedía la glicemia.
      const fa = r.fallas || {};
      const todos = [].concat(fa.fusiones || [], fa.fechasDedicadas || [], fa.sinViaje || []);
      const nombra = (x) => [].concat(x.analitos || [x.analito]).join(",");
      t.cierto(todos.some((x) => /glicemia/i.test(nombra(x))),
        "precondición: la glicemia de 140 con meta 130 tiene recontrol — " + JSON.stringify(todos.map(nombra)));
      const claves = (r.plan.ordenar || []).map((x) => x.clave);
      t.cierto(claves.indexOf("GLUCOSA") >= 0,
        "y tiene que ir en la orden: si no, el médico agenda la toma y nadie pide el examen — " + JSON.stringify(claves));
    });

    // ============ EL TERCER EJE: GLICEMIA (v17.6.84) ============
    // v68 manda vigilar la falla en TRES ejes (LDL/glicemia/HbA1c) y el tercero nunca se
    // cableó: lo bloqueaba que no existiera meta de glicemia en el archivo — v68 tampoco la
    // da. El médico la fijó en 130 mg/dL el 26-ago. Sin este eje, un diabético con la
    // glicemia disparada y la HbA1c todavía vigente no disparaba falla ni recontrol: el
    // descontrol agudo pasaba por debajo del radar, porque la HbA1c se mueve en 90-120 días.
    t.caso("v17.6.84: la glicemia es el tercer eje de falla, con meta de 130 mg/dL", () => {
      t.igual(api.mtrMetaGlicemiaGeneral(), 130, "la meta que fijó el médico");
      const base = { hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55, esDm2: true };
      // v17.54.0 (D9): 140 estaba «dentro del margen» con el +15 % (corte en 149,5). Retirado
      // el margen, una glicemia de 140 en un diabético con meta de 130 es falla, y se dice.
      const enMargen = api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 140 } }));
      t.igual(enMargen.fallas.length, 1, "140 con meta 130 es falla: la franja 131-149,5 ya no se calla");
      t.igual(api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 130 } })).fallas.length, 0,
        "y justo en la meta sigue sin serlo");
      const leve = api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 160 } }));
      t.igual(leve.fallas.length, 1, "160 sí es falla");
      t.igual(leve.fallas[0].analito, "Glicemia", "y es del eje de la glicemia");
      t.igual(leve.fallas[0].gravedad, "leve", "por debajo de meta+30% es leve");
      // v17.55.0 (D10) — el escalón del 30 % se retiró: con la función renal sana (egfr 80),
      // ni una glicemia de 260 es «grave». Lo es con criterio renal, y solo entonces.
      const grave = api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 260 } }));
      t.igual(grave.fallas[0].gravedad, "leve", "260 con función renal sana: falla, pero no grave");
      const renal = api.mtrPlanFallas(Object.assign({}, base, { egfr: 40, glicemia: { actual: 260 } }));
      t.igual(renal.fallas[0].gravedad, "grave", "la misma cifra con eGFR 40 sí: es la única vía que queda");
      // v17.55.0 — Y AQUÍ ESTÁ EL CAMBIO QUE MÁS VIAJES AHORRA: la glicemia NO programa una
      // fecha propia. Medido sobre 3.072 planes, provocaba 884 segundas citas — mandar a
      // sangrarse otra vez a los 14 días a quien viene de lejos. El propio v68 lo autoriza
      // («2-4 sem O ALINEADA CON LA HbA1c»). La falla se declara igual; lo que desaparece es
      // el viaje.
      t.igual(grave.recontroles.length, 0, "una falla de glicemia sola no manda al paciente a sangrarse aparte");
      const conHba1c = api.mtrPlanFallas(Object.assign({}, base, {
        glicemia: { actual: 260 }, hba1c: { actual: 11 },
      }));
      const rGlu = conHba1c.recontroles.filter((r) => r.analito === "glicemia")[0];
      const rHba = conHba1c.recontroles.filter((r) => r.analito === "hba1c")[0];
      t.cierto(!!rGlu && !!rHba, "con la HbA1c también en falla, la glicemia sí tiene fecha");
      t.igual(rGlu.fecha, rHba.fecha, "y es EXACTAMENTE la misma: se alinea, no se suma");
      t.igual(rGlu.alineadoA, "hba1c", "dicho explícitamente, para que se pueda leer por qué");
    });

    t.caso("v17.6.84: en un no diabético la glicemia NO es falla terapéutica", () => {
      const noDm2 = api.mtrPlanFallas({
        hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55,
        esDm2: false, glicemia: { actual: 260 },
      });
      t.igual(noDm2.fallas.filter((f) => f.analito === "Glicemia").length, 0,
        "en un hipertenso sin diabetes, una glicemia alta no es 'falla del tratamiento'");
    });

    t.caso("v17.6.84: el eje llega cableado desde mtrResumenClinico, no nace muerto", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 55, sexo: "M", pesoKg: 80, creatinina: 0.9,
        rac: 10, ct: 150, hdl: 50, ldl: 60, paSistolica: 125, paDiastolica: 78,
        factores: { hta: true, diabetes: true },
        ultimos: {
          CREATININA:       { fecha: "2026-08-01", valor: 0.9 },
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 150 },
          COLESTEROL_HDL:   { fecha: "2026-08-01", valor: 50 },
          COLESTEROL_LDL:   { fecha: "2026-08-01", valor: 60 },
          TRIGLICERIDOS:    { fecha: "2026-08-01", valor: 110 },
          HBA1C:            { fecha: "2026-08-20", valor: 6.5 },   // EN META y vigente
          RAC:              { fecha: "2026-08-01", valor: 10 },
          UROANALISIS:      { fecha: "2026-08-01", valor: 1 },
          GLUCOSA:          { fecha: "2026-08-20", valor: 260 },
        },
        ldl: 60, hba1c: 6.5,
      });
      // Este es el escenario que el eje existe para cazar: la HbA1c dice que todo va bien
      // (está en meta y vigente) y la glicemia dice que no.
      t.cierto(r.fallas && r.fallas.fallas.some((f) => f.analito === "Glicemia"),
        "la glicemia del ctx llega hasta mtrPlanFallas sin que el llamador la pase a mano");
      t.igual(r.foco, "metabólico",
        "y el foco de la consulta refleja esa falla, no solo el estado del driver");
    });

    // ================= TELEMETRÍA (BARRERA ANTI-PHI) =================

    const resumenReal = () => api.mtrResumenClinico({
      hoyIso: "2026-08-16", edad: 66, sexo: "F", pesoKg: 70, creatinina: 1.5,
      rac: 55, ct: 240, hdl: 38, ldl: 155, paSistolica: 150, tg: 540,
      hba1c: 9.5, factores: { hta: true, diabetes: true },
      ultimos: { CREATININA: { fecha: "2026-02-01", valor: 1.5 } },
      programa: "ERC", meds: ["Atorvastatina 20 mg"],
    });

    t.caso("la telemetría emite solo claves de acción con nombre fijo (enums y conteos)", () => {
      const eventos = api.mtrTelemetriaResumen(resumenReal());
      t.cierto(eventos.length >= 3, "emite varias señales de uso");
      for (const ev of eventos) {
        t.cierto(/^recuadro\.[a-z0-9._]+$/.test(ev.accion),
          "clave '" + ev.accion + "' debe ser un nombre de acción acotado, sin acentos ni datos");
      }
    });

    t.caso("NINGÚN valor del paciente se cuela en la clave de telemetría", () => {
      const resumen = resumenReal();
      const eventos = api.mtrTelemetriaResumen(resumen);
      const prohibidos = ["155", "1.5", "540", "9.5", "70", "66", "240"];  // valores del paciente de arriba
      for (const ev of eventos) {
        for (const p of prohibidos) {
          t.igual(ev.accion.indexOf(p), -1, "la clave '" + ev.accion + "' no puede contener el valor " + p);
        }
        // los conteos van en extra.n (un número acotado), jamás en la clave
        if (ev.extra) t.cierto(typeof ev.extra.n === "number", "el único extra permitido es un conteo numérico");
      }
    });

    t.caso("la telemetría capta la señal de CALIDAD DE DATOS (no se pudo clasificar)", () => {
      const sinDatos = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 66, sexo: "F", factores: {}, ultimos: {}, programa: "HTA",
      });
      const eventos = api.mtrTelemetriaResumen(sinDatos);
      t.cierto(eventos.some((e) => e.accion === "recuadro.datos_incompletos"),
        "sin creatinina, se cuenta como dato incompleto — justo lo que mejora el servicio");
    });

    t.caso("la telemetría marca la falla como señal de calidad, sin números", () => {
      const eventos = api.mtrTelemetriaResumen(resumenReal());
      t.cierto(eventos.some((e) => e.accion === "recuadro.falla.grave" || e.accion === "recuadro.falla.leve"),
        "una falla terapéutica se cuenta (grave/leve), sin el valor del LDL");
    });

    t.caso("el recuadro muestra la falla y el recontrol cuando los hay", () => {
      const html = api.mtrRenderResumenClinicoHtml(resumenReal());
      t.cierto(/Falla terap.utica/.test(html), "sale el bloque de falla");
      t.cierto(/intensidad y adherencia/i.test(html), "y el aviso de inercia de la estatina");
    });

    // =====================================================================
    //  D11 (KDIGO) — CON TFG < 60 EL PERFIL LIPÍDICO NO SE REPITE AL 50 %
    //
    //  Decisión del médico, verbatim (entrevista del 29-ago): «en pacientes con ckd epi
    //  2021 menor a 60 tfg no repitamos perfil lipídico al 50% por falla terapéutica como
    //  lo dicen las guías kdigo». Punto 9 de su orden de ejecución.
    //
    //  Lo que estas pruebas fijan, y por qué cada una:
    //   · La guarda frena SOLO el adelanto. NO apaga la falla terapéutica: el LDL sigue
    //     estando fuera de meta y el panel lo sigue diciendo. Confundir las dos cosas
    //     dejaría a un paciente sin tratar creyendo que está bien.
    //   · La TFG es la de CKD-EPI 2021, NUNCA Cockcroft-Gault (aquí solo administrativa).
    //   · SIN TFG no se supone nada: manda la regla del 50 %, que es lo conservador
    //     (repetir antes, no después).
    //   · La guarda vive en los DOS caminos que parten la vigencia (el motor del panel y
    //     la vara del aviso de entrada / antiduplicado de PyM). Con una sola, el panel
    //     diría 180 y el aviso seguiría reclamándolo a los 90 sobre el mismo paciente.
    //   · Y no rompe CERO VENCIDOS: solo puede ALARGAR, así que la fecha de toma no se
    //     adelanta ni deja vencer nada. Se comprueba de punta a punta.
    // =====================================================================
    const _ctxKdigo = (tfg) => ({
      hoyIso: "2026-08-31", programa: "DM2", esDm2: true, categoriaRiesgo: "alto", edad: 62,
      estadioAdministrativo: null, rac: 12, egfrCkdEpi: tfg,
      ultimos: {
        COLESTEROL_LDL: { fecha: "2026-07-10", valor: 110 },
        GLUCOSA: { fecha: "2026-07-10", valor: 165 },
        HBA1C: { fecha: "2026-07-10", valor: 8.2 },
        COLESTEROL_TOTAL: { fecha: "2026-07-10", valor: 190 },
        COLESTEROL_HDL: { fecha: "2026-07-10", valor: 42 },
        TRIGLICERIDOS: { fecha: "2026-07-10", valor: 180 },
        CREATININA: { fecha: "2026-08-01", valor: 0.9 },
        RAC: { fecha: "2026-08-01", valor: 12 },
        UROANALISIS: { fecha: "2026-08-01", valor: 1 },
      },
    });
    const _claves = (lista) => (lista || []).map((a) => a.clave);

    t.caso("D11: la guarda solo mira los cuatro lípidos, y solo por debajo de 60", () => {
      for (const k of ["COLESTEROL_LDL", "COLESTEROL_TOTAL", "COLESTEROL_HDL", "TRIGLICERIDOS"]) {
        t.cierto(api.mtrKdigoNoRepiteLipidos(k, { egfrCkdEpi: 59.9 }), k + " con TFG 59,9 sí la frena");
        t.falso(api.mtrKdigoNoRepiteLipidos(k, { egfrCkdEpi: 60 }), k + " con TFG 60 exactos NO: la guía dice MENOR de 60");
      }
      for (const k of ["HBA1C", "GLUCOSA", "CREATININA", "RAC"]) {
        t.falso(api.mtrKdigoNoRepiteLipidos(k, { egfrCkdEpi: 30 }), k + " no es un lípido: KDIGO no lo cubre");
      }
    });

    t.caso("D11: sin TFG no se supone nada — manda la regla del 50 %", () => {
      t.falso(api.mtrKdigoNoRepiteLipidos("COLESTEROL_LDL", {}), "sin dato");
      t.falso(api.mtrKdigoNoRepiteLipidos("COLESTEROL_LDL", { egfrCkdEpi: null }), "TFG nula");
      t.falso(api.mtrKdigoNoRepiteLipidos("COLESTEROL_LDL", { egfrCkdEpi: "" }), "TFG vacía");
      t.cierto(api.mtrKdigoNoRepiteLipidos("COLESTEROL_LDL", { erc: { egfr: 45 } }), "y la lee del resumen si viene ahí");
    });

    t.caso("D11: la TFG es la de CKD-EPI 2021, nunca la de Cockcroft-Gault", () => {
      // erc.crcl es Cockcroft-Gault y en este proyecto es solo administrativa/dosificación.
      // Un crcl bajo NO puede activar la guarda por su cuenta.
      t.falso(api.mtrKdigoNoRepiteLipidos("COLESTEROL_LDL", { erc: { crcl: 30, egfr: 90 } }),
        "con CKD-EPI 90 no se frena, aunque Cockcroft-Gault diga 30");
      t.cierto(api.mtrKdigoNoRepiteLipidos("COLESTEROL_LDL", { erc: { crcl: 90, egfr: 45 } }),
        "y con CKD-EPI 45 sí se frena, aunque Cockcroft-Gault diga 90");
    });

    // =====================================================================
    // v18.0.67 — REGLA DEL MÉDICO (01-sep): EL 50 % LO DECIDE ÉL
    // «Cuando un paciente se encuentra fuera de metas … se le debe preguntar al médico que si
    // en ese paciente desea repetir los exámenes fuera de metas sí o no. Si la respuesta es sí
    // se repiten al 50 % de la vigencia original, si la respuesta es no se repiten en su
    // vigencia normal sin adelantar. Los únicos exámenes que se repiten sí o sí es la
    // creatinina en suero si la TFG por C-G es menor a 60 y la RAC si el resultado es mayor a
    // 30 mg/gr.»
    // Ver docs/REGLAS_MEDICO_20260901.md.
    // =====================================================================
    t.caso("v18.0.67: creatinina obligatoria con TFG por COCKCROFT-GAULT < 60 (no CKD-EPI)", () => {
      t.cierto(api.mtrRepeticionObligatoria("CREATININA", { crclCockcroftGault: 59.9 }),
        "59,9 por C-G: se repite sí o sí");
      t.falso(api.mtrRepeticionObligatoria("CREATININA", { crclCockcroftGault: 60 }),
        "60 exactos no: él dijo MENOR a 60");
      // La distinción con KDIGO es deliberada y el médico la confirmó: son fórmulas
      // distintas y un paciente puede quedar a un lado u otro del 60 según cuál se mire.
      t.cierto(api.mtrRepeticionObligatoria("CREATININA", { erc: { crcl: 40, egfr: 90 } }),
        "manda Cockcroft-Gault, aunque CKD-EPI diga 90");
      t.falso(api.mtrRepeticionObligatoria("CREATININA", { erc: { crcl: 90, egfr: 40 } }),
        "y no al revés: CKD-EPI bajo no la vuelve obligatoria");
      t.falso(api.mtrRepeticionObligatoria("CREATININA", {}),
        "sin el dato no se afirma nada: la decisión vuelve a ser del médico");
    });

    t.caso("v18.0.67: RAC obligatoria por encima de 30 mg/g", () => {
      t.cierto(api.mtrRepeticionObligatoria("RAC", {}, 30.1), "31 mg/g: se repite sí o sí");
      t.falso(api.mtrRepeticionObligatoria("RAC", {}, 30), "30 exactos no: él dijo MAYOR a 30");
      t.falso(api.mtrRepeticionObligatoria("RAC", {}, null), "sin valor no se afirma nada");
      t.falso(api.mtrRepeticionObligatoria("HBA1C", { crclCockcroftGault: 20 }, 300),
        "la obligatoriedad es SOLO de esos dos exámenes, no de todos los del paciente renal");
    });

    t.caso("v18.0.67: sin respuesta manda la conducta de siempre; el NO del médico la relaja", () => {
      // Todavía no ha respondido: se adelanta, que es lo conservador y lo que ya hacía.
      t.cierto(api.mtrPuedeAdelantarPorFueraDeMeta("HBA1C", {}, 9),
        "el script no cambia nada por su cuenta: hace falta un «no» explícito");
      t.cierto(api.mtrPuedeAdelantarPorFueraDeMeta("HBA1C", { repetirFueraMeta: true }, 9), "y con el sí, igual");
      t.falso(api.mtrPuedeAdelantarPorFueraDeMeta("HBA1C", { repetirFueraMeta: false }, 9),
        "con el NO se repite en su vigencia normal, sin adelantar");
      // Pero su «no» no puede desactivar los dos obligatorios.
      t.cierto(api.mtrPuedeAdelantarPorFueraDeMeta("CREATININA", { repetirFueraMeta: false, crclCockcroftGault: 40 }, 1.6),
        "la creatinina con C-G < 60 se repite igual: no depende de la respuesta");
      t.cierto(api.mtrPuedeAdelantarPorFueraDeMeta("RAC", { repetirFueraMeta: false }, 45),
        "y la RAC > 30, también");
    });

    t.caso("v18.0.67: la pregunta es UNA por paciente y dice qué queda fuera de ella", () => {
      const plan = { drivers: [
        { clave: "HBA1C", fueraMeta: true, valor: 9 },
        { clave: "COLESTEROL_LDL", fueraMeta: true, valor: 160 },
        { clave: "CREATININA", fueraMeta: true, valor: 1.6 },
        { clave: "RAC", fueraMeta: true, valor: 45 },
        { clave: "GLUCOSA", fueraMeta: false, valor: 100 },
      ] };
      const r = api.mtrExamenesParaPreguntaFueraMeta(plan, { crclCockcroftGault: 40, egfrCkdEpi: 45 });
      t.igual(_claves(r.dentro).join(","), "HBA1C", "solo la HbA1c entra en la pregunta");
      t.igual(_claves(r.obligatorios).sort().join(","), "CREATININA,RAC", "los dos obligatorios salen aparte");
      t.igual(_claves(r.frenadosKdigo).join(","), "COLESTEROL_LDL",
        "y el lípido lo frena KDIGO: con TFG < 60 no se adelanta aunque él diga que sí (decisión suya)");
      t.falso(_claves(r.dentro).indexOf("GLUCOSA") >= 0, "lo que está en meta no se pregunta");

      const q = api.mtrPreguntaFueraMeta(r);
      t.igual(q.clave, "repetirFueraMeta");
      t.igual(q.vigenciaDias, 1, "vale solo para esta consulta");
      t.igual(q.severidad, "media", "se ofrece, no retiene el flujo: él manda");
      t.cierto(/Hemoglobina glicosilada/.test(JSON.stringify(q.afirman)), "la lista va delante, con nombre clínico");
      t.cierto(/no dependen de esta respuesta/.test(JSON.stringify(q.niegan)),
        "y se DICE por qué los obligatorios no están en la pregunta: callarlo la volvería una caja negra");
    });

    t.caso("v18.0.67: sin nada fuera de meta que dependa de él, no se pregunta", () => {
      const vacio = api.mtrExamenesParaPreguntaFueraMeta({ drivers: [{ clave: "HBA1C", fueraMeta: false }] }, {});
      t.falso(api.mtrDebePreguntarFueraMeta(vacio, null), "no hay nada que preguntar");
      const conUno = api.mtrExamenesParaPreguntaFueraMeta({ drivers: [{ clave: "HBA1C", fueraMeta: true, valor: 9 }] }, {});
      t.cierto(api.mtrDebePreguntarFueraMeta(conUno, null), "con uno dentro, sí");
      t.falso(api.mtrDebePreguntarFueraMeta(conUno, { v: true, ts: Date.now() }),
        "y si ya respondió en esta consulta, no se le vuelve a preguntar");
    });

    t.caso("D11: la falla terapéutica NO se apaga — el LDL sigue estando fuera de meta", () => {
      const ctx = _ctxKdigo(52);
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", 110, ctx), true,
        "110 sigue por encima de la meta de 70 del riesgo alto: eso no lo toca KDIGO");
      const a = api.mtrEstadoAnalito("COLESTEROL_LDL", ctx.ultimos.COLESTEROL_LDL, ctx);
      t.cierto(a.fueraDeMeta === true, "y el analito lo sigue publicando");
      t.cierto(a.kdigoSinAcortar === true, "marcando aparte que la guarda renal frenó el adelanto");
      t.igual(a.vigenciaDias, 180, "la vigencia se respeta entera");
      t.cierto(/KDIGO/.test(a.motivo) && /no se repite antes/.test(a.motivo),
        "y el porqué se dice: un examen que no se pide sin explicación parece un olvido · " + a.motivo);
    });

    t.caso("D11 PUNTA A PUNTA: con TFG < 60 el perfil lipídico entero sale de la toma", () => {
      const sano = api.mtrPlanParaclinicos(_ctxKdigo(88));
      const renal = api.mtrPlanParaclinicos(_ctxKdigo(52));

      t.cierto(_claves(sano.ordenar).indexOf("COLESTEROL_LDL") >= 0, "con TFG 88 el LDL se ordena (regla del 50 %)");
      for (const k of ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "TRIGLICERIDOS"]) {
        t.cierto(_claves(sano.ordenar).indexOf(k) >= 0, k + " lo arrastra el grupo lipídico");
      }
      for (const k of ["COLESTEROL_LDL", "COLESTEROL_TOTAL", "COLESTEROL_HDL", "TRIGLICERIDOS"]) {
        t.falso(_claves(renal.ordenar).indexOf(k) >= 0, k + " NO se ordena con TFG 52");
        t.cierto(_claves(renal.diferidos).indexOf(k) >= 0, k + " queda diferido a su vencimiento natural");
      }
      // Y lo que sí debe seguir pidiéndose se sigue pidiendo: KDIGO es sobre lípidos.
      t.cierto(_claves(renal.ordenar).indexOf("GLUCOSA") >= 0, "la glicemia fuera de meta sigue entrando");
      t.cierto(_claves(renal.ordenar).indexOf("HBA1C") >= 0, "y la HbA1c también");
    });

    t.caso("D11 y CERO VENCIDOS: la guarda solo ALARGA — la fecha de toma no se adelanta ni deja vencer nada", () => {
      const sano = api.mtrPlanParaclinicos(_ctxKdigo(88));
      const renal = api.mtrPlanParaclinicos(_ctxKdigo(52));
      t.cierto(renal.ftl >= sano.ftl, "la toma nunca se adelanta por esta guarda");
      // CERO VENCIDOS: ningún examen ordenado o diferido puede vencer ANTES de la toma.
      for (const a of (renal.ordenar || []).concat(renal.diferidos || [])) {
        if (!a.vence) continue;
        t.cierto(a.vence >= renal.ftl, a.nombre + " no vence antes de la toma (" + a.vence + " vs " + renal.ftl + ")");
      }
    });

    t.caso("D11: la guarda vive TAMBIÉN en la vara del aviso de entrada y del antiduplicado de PyM", () => {
      // Si viviera solo en el motor del panel, el panel diría 180 y el aviso de entrada
      // seguiría reclamando el LDL a los 90 sobre el MISMO paciente: dos varas para una regla.
      const base = { programa: "DM2", esDm2: true, esDM2: true, categoriaRiesgo: "alto", edad: 62, aplicar50: true };
      const sinRenal = api._vigenciaDiasParaAnalito("COLESTEROL_LDL", 110, Object.assign({}, base, { egfrCkdEpi: 88 }));
      const conRenal = api._vigenciaDiasParaAnalito("COLESTEROL_LDL", 110, Object.assign({}, base, { egfrCkdEpi: 52 }));
      t.cierto(conRenal > sinRenal, "con TFG < 60 la vigencia de este camino tampoco se parte (" + sinRenal + " -> " + conRenal + ")");
      t.igual(conRenal * 1, sinRenal * 2, "y es exactamente el doble: es la mitad que ya no se aplica");
    });
  },
};
