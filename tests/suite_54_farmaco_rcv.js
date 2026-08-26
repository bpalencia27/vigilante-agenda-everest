// =====================================================================
//  SUITE 54 — Motor farmacológico AMPLIADO (enfoque RCV, solo mortal/grave)
//
//  Decisiones del médico (17-08) que esta suite fija:
//   · Enfoque en fármacos de riesgo cardiovascular; los SOCIOS peligrosos de
//     otras especialidades entran porque la letalidad está en el par.
//   · Solo severidades CRITICAL/HIGH (mortales y graves) — nada moderado.
//   · Cockcroft-Gault para las reglas de ficha técnica (renales ampliadas).
//  Y dos reglas de la casa:
//   · mtrEvaluarInteracciones (las 8 del Copiloto) NO se toca: la ampliada la
//     ENVUELVE. Aquí se comprueba que las 8 siguen saliendo por la ampliada.
//   · La base de la IPS trae presentaciones TÓPICAS/OFTÁLMICAS de eritromicina,
//     ketoconazol, tacrolimus… que NO producen interacción sistémica: el
//     filtro de vía las excluye y esta suite lo fija con los textos REALES
//     de medicamentos_db_normalizado.
// =====================================================================

const tipo = (alertas, t) => (alertas || []).find((x) => x.tipo_interaccion === t) || null;

module.exports = {
  nombre: "Motor farmacológico ampliado (RCV: pares mortales y graves)",
  cubre: ["mtrDetectarGruposAmp", "mtrEvaluarInteraccionesAmpliadas", "mtrReglasRenalesAmpliadas", "mtrEsSuplementoKReal"],

  pruebas(t, api) {
    const inter = (meds, egfr, k) => api.mtrEvaluarInteraccionesAmpliadas(meds, egfr === undefined ? 90 : egfr, k === undefined ? null : k);

    // ============ LAS 8 DEL COPILOTO SIGUEN SALIENDO POR LA AMPLIADA ============

    t.caso("la ampliada conserva las 8 originales (doble bloqueo SRAA de ejemplo)", () => {
      const a = inter(["ENALAPRIL 20 MG (TABLETA)", "LOSARTAN 50 MG (TABLETA)"]);
      t.cierto(!!tipo(a, "DOBLE_BLOQUEO_SRAA"), "la regla del Copiloto sigue disparando");
    });

    t.caso("lista vacía o nula: sin alertas y sin lanzar", () => {
      t.igual(inter([]).length, 0, "vacía");
      t.igual(inter(null).length, 0, "nula");
    });

    // ============ A1 · NITRATO + PDE5 (mortal) ============

    t.caso("nitrato + sildenafil = contraindicación absoluta CRITICAL", () => {
      const a = tipo(inter(["ISOSORBIDE DINITRATO 10 MG (TABLETA)", "SILDENAFIL 100 MG (TABLETA)-(H)"]), "NITRATO_PDE5");
      t.cierto(!!a, "dispara");
      t.igual(a.severidad, "CRITICAL", "mortal");
      t.igual(a.conducta, "CONTRAINDICADA", "conducta");
    });

    t.caso("nitrato solo, o PDE5 solo, no disparan", () => {
      t.falso(!!tipo(inter(["ISOSORBIDE DINITRATO 10 MG (TABLETA)"]), "NITRATO_PDE5"), "nitrato solo");
      t.falso(!!tipo(inter(["TADALAFILO 20MG (TABLETA)"]), "NITRATO_PDE5"), "PDE5 solo");
    });

    // ============ A2/A3 · WARFARINA ============

    t.caso("warfarina + AINE = sangrado mayor CRITICAL", () => {
      const a = tipo(inter(["WARFARINA SODICA 5 MG (TABLETA)", "IBUPROFENO 400 MG (TABLETA)"]), "WARFARINA_AINE");
      t.cierto(!!a && a.severidad === "CRITICAL", "dispara en CRITICAL");
    });

    t.caso("warfarina + TMP-SMX es CRITICAL; con claritromicina es HIGH", () => {
      const conTmp = tipo(inter(["WARFARINA SODICA 5 MG (TABLETA)", "TRIMETOPRIM + SULFAMETOXAZOL 160/800 MG (TABLETA)"]), "WARFARINA_TMP_SMX");
      t.cierto(!!conTmp && conTmp.severidad === "CRITICAL", "TMP-SMX: la de más hospitalizaciones");
      const conMacro = tipo(inter(["WARFARINA SODICA 5 MG (TABLETA)", "CLARITROMICINA 500 MG (TABLETA)"]), "WARFARINA_POTENCIADOR_INR");
      t.cierto(!!conMacro && conMacro.severidad === "HIGH", "macrólido: grave");
    });

    // ============ A4 · ESTATINA + INHIBIDOR CYP3A4 (y el filtro de vía) ============

    t.caso("simvastatina + claritromicina = rabdomiólisis, CONTRAINDICADA", () => {
      const a = tipo(inter(["SIMVASTATINA 40 MG (TABLETA)", "CLARITROMICINA 500 MG (TABLETA)"]), "ESTATINA_INHIBIDOR_CYP3A4");
      t.cierto(!!a, "dispara");
      t.igual(a.severidad, "CRITICAL", "simva/lova: contraindicado");
      t.igual(a.conducta, "CONTRAINDICADA", "conducta");
    });

    t.caso("atorvastatina + claritromicina baja a HIGH (ajustar), y con azitromicina NO dispara", () => {
      const atorva = tipo(inter(["ATORVASTATINA 40 MG (TABLETA)", "CLARITROMICINA 500 MG (TABLETA)"]), "ESTATINA_INHIBIDOR_CYP3A4");
      t.cierto(!!atorva && atorva.severidad === "HIGH", "atorva: grave, no contraindicada");
      t.falso(!!tipo(inter(["ATORVASTATINA 40 MG (TABLETA)", "AZITROMICINA 500 MG (TABLETA)"]), "ESTATINA_INHIBIDOR_CYP3A4"),
        "azitromicina no inhibe CYP3A4: sin alerta de rabdomiólisis");
    });

    t.caso("FILTRO DE VÍA: la eritromicina TÓPICA de la base real NO dispara rabdomiólisis", () => {
      // Texto real de medicamentos_db_normalizado: presentación tópica.
      const a = inter(["SIMVASTATINA 40 MG (TABLETA)", "ACIDO RETINOICO + ERITROMICINA 0.025/4G (SOLUCION TOPICA)"]);
      t.falso(!!tipo(a, "ESTATINA_INHIBIDOR_CYP3A4"), "un tópico no produce la interacción sistémica");
      const b = inter(["SIMVASTATINA 40 MG (TABLETA)", "KETOCONAZOL 2% (CREMA)"]);
      t.falso(!!tipo(b, "ESTATINA_INHIBIDOR_CYP3A4"), "ketoconazol en crema tampoco");
      const c = inter(["SIMVASTATINA 40 MG (TABLETA)", "KETOCONAZOL 200 MG (TABLETA)"]);
      t.cierto(!!tipo(c, "ESTATINA_INHIBIDOR_CYP3A4"), "el MISMO principio por vía oral SÍ");
    });

    // ============ A5 · COLCHICINA + INHIBIDOR (mortal, peor en ERC) ============

    t.caso("colchicina + claritromicina = CRITICAL, y el mensaje avisa si la TFG está baja", () => {
      const sano = tipo(inter(["COLCHICINA 0.5 MG (TABLETA)", "CLARITROMICINA 500 MG (TABLETA)"], 90), "COLCHICINA_INHIBIDOR");
      t.cierto(!!sano && sano.severidad === "CRITICAL", "mortal descrita incluso con función renal normal");
      const erc = tipo(inter(["COLCHICINA 0.5 MG (TABLETA)", "CLARITROMICINA 500 MG (TABLETA)"], 40), "COLCHICINA_INHIBIDOR");
      t.cierto(/TFG ya está reducida/.test(erc.mensaje), "con TFG<60 el mensaje lo dice");
    });

    t.caso("colchicina + verapamilo también dispara (P-gp)", () => {
      t.cierto(!!tipo(inter(["COLCHICINA 0.5 MG (TABLETA)", "VERAPAMILO CLORHIDRATO 120 MG (TABLETA)"]), "COLCHICINA_INHIBIDOR"), "verapamilo inhibe P-gp");
    });

    // ============ A6/A7 · TMP-SMX ============

    t.caso("TMP-SMX + enalapril: HIGH con buena TFG, SUSPENDER/CRITICAL con TFG<45 o K≥5.5", () => {
      const ok = tipo(inter(["TRIMETOPRIM + SULFAMETOXAZOL 160/800 MG (TABLETA)", "ENALAPRIL 20 MG (TABLETA)"], 80), "TMP_SMX_HIPERKALEMIA");
      t.cierto(!!ok && ok.severidad === "HIGH", "con TFG 80: grave");
      const erc = tipo(inter(["TRIMETOPRIM + SULFAMETOXAZOL 160/800 MG (TABLETA)", "ENALAPRIL 20 MG (TABLETA)"], 40), "TMP_SMX_HIPERKALEMIA");
      t.cierto(!!erc && erc.severidad === "CRITICAL" && erc.conducta === "SUSPENDER", "con TFG 40: suspender");
      const kAlto = tipo(inter(["TRIMETOPRIM + SULFAMETOXAZOL 160/800 MG (TABLETA)", "ESPIRONOLACTONA 100 MG (TABLETA)"], 80, 5.7), "TMP_SMX_HIPERKALEMIA");
      t.cierto(!!kAlto && kAlto.severidad === "CRITICAL", "con K 5.7: crítico");
    });

    t.caso("TMP-SMX oftálmico (texto real de la base) NO dispara hiperkalemia", () => {
      const a = inter(["POLIMIXINA + TRIMETOPRIM 1MUI /0.1G (UNGUENTO OFTALMICO)", "ENALAPRIL 20 MG (TABLETA)"], 40);
      t.falso(!!tipo(a, "TMP_SMX_HIPERKALEMIA"), "el ungüento oftálmico no bloquea ENaC sistémico");
    });

    t.caso("TMP-SMX + glibenclamida = hipoglucemia severa HIGH", () => {
      t.cierto(!!tipo(inter(["TRIMETOPRIM + SULFAMETOXAZOL 160/800 MG (TABLETA)", "GLIBENCLAMIDA 5 MG (TABLETA)"]), "TMP_SMX_SULFONILUREA"), "dispara");
    });

    // ============ A8 · SACUBITRILO + IECA (angioedema) ============

    t.caso("sacubitrilo/valsartán + enalapril = angioedema, CONTRAINDICADA con lavado de 36 h", () => {
      const a = tipo(inter(["SACUBITRILO VALSARTAN 24.3 + 25.7 EQ. 50MG (TABLETA)", "ENALAPRIL 20 MG (TABLETA)"]), "SACUBITRILO_IECA");
      t.cierto(!!a && a.severidad === "CRITICAL", "contraindicación absoluta");
      t.cierto(/36 horas/.test(a.mensaje), "el mensaje exige el lavado de 36 horas");
    });

    t.caso("sacubitrilo/valsartán SIN IECA no dispara la del angioedema", () => {
      t.falso(!!tipo(inter(["SACUBITRILO VALSARTAN 24.3 + 25.7 EQ. 50MG (TABLETA)"]), "SACUBITRILO_IECA"), "solo: es su uso normal");
    });

    // ============ A9 · AMIODARONA ============

    t.caso("amiodarona: con digoxina AJUSTAR, con macrólido QT, con simvastatina tope de 20 mg", () => {
      t.cierto(!!tipo(inter(["AMIODARONA 200 MG (TABLETA)", "DIGOXINA 0.25 MG (TABLETA)"]), "AMIODARONA_DIGOXINA"), "digoxina externa: niveles suben ~2x");
      t.cierto(!!tipo(inter(["AMIODARONA 200 MG (TABLETA)", "AZITROMICINA 500 MG (TABLETA)"]), "AMIODARONA_MACROLIDO_QT"), "QT aditivo");
      const est = tipo(inter(["AMIODARONA 200 MG (TABLETA)", "SIMVASTATINA 40 MG (TABLETA)"]), "AMIODARONA_ESTATINA");
      t.cierto(!!est && /20 mg/.test(est.mensaje), "tope de simvastatina explícito");
    });

    // ============ A10/A11/A12 ============

    t.caso("DOAC + itraconazol dispara; DOAC + fluconazol NO (solo inhibidores fuertes 3A4/P-gp)", () => {
      t.cierto(!!tipo(inter(["RIVAROXABAN 20MG (TABLETA)", "ITRACONAZOL 100 MG (CAPSULA)"]), "DOAC_INHIBIDOR"), "itraconazol: fuerte");
      t.falso(!!tipo(inter(["RIVAROXABAN 20MG (TABLETA)", "FLUCONAZOL 150 MG (CAPSULA)"]), "DOAC_INHIBIDOR"), "fluconazol con DOAC es moderado: fuera por umbral");
    });

    t.caso("digoxina + verapamilo = toxicidad digitálica HIGH", () => {
      t.cierto(!!tipo(inter(["DIGOXINA 0.25 MG (TABLETA)", "VERAPAMILO CLORHIDRATO 120 MG (TABLETA)"]), "DIGOXINA_CCB_NODHP"), "dispara");
    });

    t.caso("litio + hidroclorotiazida/AINE = intoxicación por litio HIGH", () => {
      t.cierto(!!tipo(inter(["LITIO CARBONATO 300 MG (TABLETA O CAPSULA)", "HIDROCLOROTIAZIDA 25 MG (TABLETA)"]), "LITIO_ACUMULACION"), "tiazida");
      t.cierto(!!tipo(inter(["LITIO CARBONATO 300 MG (TABLETA O CAPSULA)", "IBUPROFENO 400 MG (TABLETA)"]), "LITIO_ACUMULACION"), "AINE");
    });

    // ============ RENALES AMPLIADAS (Cockcroft-Gault, ficha técnica) ============

    t.caso("alendronato con CrCl 30 = CONTRAINDICADA; con CrCl 50 no se molesta", () => {
      const mal = api.mtrReglasRenalesAmpliadas(["ALENDRONATO 70 MG (TABLETA) (H)"], 30);
      t.igual(mal.length, 1, "una alerta");
      t.igual(mal[0].conducta, "CONTRAINDICADA", "ficha técnica: CrCl<35");
      t.igual(mal[0].severidad, "CRITICAL", "crítica");
      t.igual(mal[0].formula_tfg, "Cockcroft-Gault (CrCl)", "con la fórmula de dosificación");
      t.igual(api.mtrReglasRenalesAmpliadas(["ALENDRONATO 70 MG (TABLETA) (H)"], 50).length, 0, "CrCl 50: nada");
    });

    t.caso("sacubitrilo con CrCl 25 pide dosis inicial reducida (HIGH)", () => {
      const a = api.mtrReglasRenalesAmpliadas(["SACUBITRILO VALSARTAN 24.3 + 25.7 EQ. 50MG (TABLETA)"], 25);
      t.igual(a.length, 1, "una alerta");
      t.igual(a[0].severidad, "HIGH", "grave, no contraindicada");
    });

    t.caso("renales ampliadas: sin CrCl o sin medicamentos, silencio limpio", () => {
      t.igual(api.mtrReglasRenalesAmpliadas(["ALENDRONATO 70 MG (TABLETA)"], null).length, 0, "sin CrCl no se juzga");
      t.igual(api.mtrReglasRenalesAmpliadas([], 20).length, 0, "sin meds nada");
      t.igual(api.mtrReglasRenalesAmpliadas(null, 20).length, 0, "nulo nada");
    });

    // ============ EL ORQUESTADOR ENTREGA EL MOTOR AMPLIADO ============

    t.caso("mtrAvisosFarmacologicos incluye las nuevas y conserva la identidad todo = avisos + interacciones", () => {
      const r = api.mtrAvisosFarmacologicos({
        medicamentos: ["ISOSORBIDE DINITRATO 10 MG (TABLETA)", "SILDENAFIL 100 MG (TABLETA)", "ALENDRONATO 70 MG (TABLETA)"],
        tfgCkdEpi: 50, tfgCockcroftGault: 30, potasio: null,
      });
      t.cierto(!!tipo(r.interacciones, "NITRATO_PDE5"), "la interacción nueva llega al médico");
      t.cierto(r.avisos.some((x) => x.principio_activo === "bifosfonato"), "la renal nueva llega al médico");
      t.igual(r.todo.length, r.avisos.length + r.interacciones.length, "la identidad de la vista se conserva");
      t.igual(r.todo[0].severidad, "CRITICAL", "lo mortal va primero");
    });

    // ============ CRIBA DEL FALSO SUPLEMENTO DE POTASIO ============

    t.caso("amoxicilina-clavulanato (potasio irrelevante) NO dispara la hiperkalemia del Copiloto", () => {
      // El antibiótico más formulado caía como "suplemento de K" por la aguja "potasio".
      const a = inter(["ENALAPRIL 20 MG (TABLETA)", "AMOXICILINA+ CLAVULANATO DE POTASIO 875+125 MG (TABLETA) (H)"], 80);
      t.falso(!!tipo(a, "HIPERKALEMIA_SINERGICA"), "0.8 mEq de K por tableta no es un suplemento");
    });

    t.caso("el cloruro de potasio DE VERDAD sí la dispara, igual que siempre", () => {
      const a = inter(["ENALAPRIL 20 MG (TABLETA)", "CLORURO DE POTASIO 20MEQ (TABLETAS DE LIBERACION MODIFICADA)"], 80);
      t.cierto(!!tipo(a, "HIPERKALEMIA_SINERGICA"), "el suplemento real conserva la alerta del Copiloto");
    });

    t.caso("la criba NO apaga la segunda vía (SRAA + espironolactona con TFG<30)", () => {
      const a = inter(["ENALAPRIL 20 MG (TABLETA)", "ESPIRONOLACTONA 100 MG (TABLETA)", "AMOXICILINA+ CLAVULANATO DE POTASIO 875+125 MG (TABLETA) (H)"], 25);
      t.cierto(!!tipo(a, "HIPERKALEMIA_SINERGICA"), "con espironolactona y TFG 25 la alerta es legítima y se queda");
    });

    t.caso("mtrEsSuplementoKReal distingue suplementos de coincidencias", () => {
      t.cierto(api.mtrEsSuplementoKReal("CLORURO DE POTASIO 20MEQ"), "cloruro sí");
      t.cierto(api.mtrEsSuplementoKReal("CITRATO DE POTASIO 1080 MG (TABLETA)"), "citrato sí");
      t.falso(api.mtrEsSuplementoKReal("AMOXICILINA+CLAVULANATO DE POTASIO 500+125 MG"), "clavulanato no");
      t.falso(api.mtrEsSuplementoKReal("CLORURO DE SODIO+CLORURO DE POTASIO (SOLUCION OFTALMICA)"), "colirio no");
      t.falso(api.mtrEsSuplementoKReal("MAGNESIO SULFATO+POTASIO SULFATO+SODIO SULFATO (SOLUCION)"), "preparación intestinal no");
      t.falso(api.mtrEsSuplementoKReal(""), "vacío no y no lanza");
    });

    t.caso("el detector ampliado agrupa por principio y respeta la vía", () => {
      const g = api.mtrDetectarGruposAmp(["WARFARINA SODICA 5 MG (TABLETA)", "TACROLIMUS 0,03% (SOLUCION OFTALMICA * 5ML)"]);
      t.cierto(!!g.warfarina, "warfarina detectada");
      t.falso(!!g.calcineurina, "tacrolimus OFTÁLMICO excluido por vía");
    });
  },
};
