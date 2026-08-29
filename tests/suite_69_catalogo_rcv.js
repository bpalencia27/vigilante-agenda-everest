// =====================================================================
//  SUITE 69 — Catálogo farmacológico RCV (v17.6.4, catalogo_farmacologico_rcv.json)
//
//  Base externa con fuente citada (BNF / Stockley's / ficha técnica). La
//  copia embebida es MTR_CATALOGO_RCV; el JSON de la raíz es la fuente de
//  verdad. ADITIVO: no toca las 8 del Copiloto ni la capa ampliada v14.2.0.
//
//  Semántica de `lados`: array de arrays; dispara si CADA lado tiene al menos
//  un grupo presente (dentro de un lado las alternativas son OR).
// =====================================================================

const tipo = (alertas, t) => (alertas || []).find((x) => x.tipo_interaccion === t) || null;

// Vademécum REAL de Everest capturado el 23-ago-2026 y sanitizado (cero PHI).
const fixtureVademecum = require("./fixtures/captura_vademecum_everest_20260823.json");

module.exports = {
  nombre: "Catálogo farmacológico RCV (interacciones y renales con fuente citada)",
  cubre: ["mtrGruposCatalogoRcv", "mtrEvaluarConCatalogoRcv"],

  pruebas(t, api) {
    const cat = (meds, egfr, k, crcl) => api.mtrEvaluarConCatalogoRcv(
      meds, egfr === undefined ? 90 : egfr, k === undefined ? null : k,
      crcl === undefined ? 80 : crcl);

    // ============ VACÍO Y FIXTURE REAL ============

    t.caso("listas vacías o nulas: sin alertas y sin lanzar", () => {
      t.igual(cat([]).length, 0, "vacía");
      t.igual(cat(null).length, 0, "nula");
    });

    t.caso("el fixture everest_medicamentos.json dispara exactamente AINE_RAAS (ibuprofeno+losartán)", () => {
      const fixture = [
        "METFORMINA CLORHIDRATO 850 MG TABLETA RECUBIERTA",
        "LOSARTAN POTASICO 50 MG TABLETA",
        "IBUPROFENO 400 MG TABLETA RECUBIERTA",
        "ESPIRONOLACTONA 25 MG TABLETA",
        "ENOXAPARINA SODICA 40 MG/0.4 ML SOLUCION INYECTABLE",
      ];
      const as = cat(fixture);
      t.cierto(!!tipo(as, "AINE_RAAS"), "el par AINE + ARA-II del fixture es un hallazgo real del catálogo");
      t.igual(as.length, 1, "una sola alerta del catálogo para el fixture");
      const g = api.mtrGruposCatalogoRcv(fixture);
      t.cierto(g.ibp === undefined, "sin grupos nuevos del catálogo en el fixture");
    });

    // ============ AINE + IECA/ARA-II (doble whammy sin diurético) ============

    t.caso("ibuprofeno + losartán dispara AINE_RAAS HIGH", () => {
      const a = tipo(cat(["IBUPROFENO 400 MG TABLETA RECUBIERTA", "LOSARTAN POTASICO 50 MG TABLETA"]), "AINE_RAAS");
      t.cierto(!!a, "dispara");
      t.igual(a.severidad, "HIGH", "grave");
      t.igual(a.conducta, "EVITAR", "conducta");
      t.igual(a.fuente, "BNF", "fuente citada");
    });

    t.caso("AINE solo, o IECA solo, no disparan AINE_RAAS", () => {
      t.falso(!!tipo(cat(["IBUPROFENO 400 MG TABLETA RECUBIERTA"]), "AINE_RAAS"), "AINE solo");
      t.falso(!!tipo(cat(["ENALAPRIL 20 MG (TABLETA)"]), "AINE_RAAS"), "IECA solo");
    });

    t.caso("v17.26.0 — el aviso lleva el título legible del catálogo, no el código crudo", () => {
      // Bug reportado en vivo (28-ago) contra un paciente real: MTR_ETIQUETA_INTERACCION
      // solo tenía las 8 etiquetas del Copiloto original; los 17 códigos de este catálogo
      // (AINE_RAAS, CLOPIDOGREL_IBP...) caían al respaldo "código crudo" de mtrEtiquetaAviso
      // y se veían tal cual en pantalla. El catálogo YA trae `titulo` legible con fuente
      // (BNF); mtrEvaluarConCatalogoRcv ahora lo copia al aviso y mtrEtiquetaAviso lo
      // prefiere sobre el mapa de códigos.
      const a = tipo(cat(["IBUPROFENO 400 MG TABLETA RECUBIERTA", "LOSARTAN POTASICO 50 MG TABLETA"]), "AINE_RAAS");
      t.cierto(!!a, "dispara");
      t.igual(a.titulo, "AINE + IECA/ARA-II (doble whammy sin diuretico)",
        "el aviso trae el título del catálogo, no solo el código");
      t.igual(api.mtrEtiquetaAviso(a), a.titulo,
        "y la etiqueta que se pinta en pantalla usa ese título, nunca el código \"AINE_RAAS\" crudo");
    });

    // ============ CLOPIDOGREL + IBP ============

    t.caso("clopidogrel + omeprazol dispara CLOPIDOGREL_IBP HIGH", () => {
      const a = tipo(cat(["CLOPIDOGREL 75 MG (TABLETA)", "OMEPRAZOL 20 MG (CAPSULA)"]), "CLOPIDOGREL_IBP");
      t.cierto(!!a, "dispara");
      t.igual(a.severidad, "HIGH", "grave");
      t.igual(a.conducta, "AJUSTAR", "conducta");
    });

    t.caso("aspirina + omeprazol NO dispara (la gastroprotección con IBP en aspirina es correcta)", () => {
      t.falso(!!tipo(cat(["ASPIRINA 100 MG (TABLETA)", "OMEPRAZOL 20 MG (CAPSULA)"]), "CLOPIDOGREL_IBP"),
        "la interacción es del P2Y12, no de la aspirina");
    });

    t.caso("clopidogrel solo no dispara", () => {
      t.falso(!!tipo(cat(["CLOPIDOGREL 75 MG (TABLETA)"]), "CLOPIDOGREL_IBP"), "solo");
    });

    // ============ ISRS/ISRN ============

    t.caso("sertralina + clopidogrel dispara ISRS_ISRN_SANGRADO HIGH", () => {
      const a = tipo(cat(["SERTRALINA 50 MG (TABLETA)", "CLOPIDOGREL 75 MG (TABLETA)"]), "ISRS_ISRN_SANGRADO");
      t.cierto(!!a && a.severidad === "HIGH", "dispara grave");
    });

    t.caso("venlafaxina + rivaroxabán también dispara sangrado (ISRN + DOAC)", () => {
      t.cierto(!!tipo(cat(["VENLAFAXINA 75 MG (TABLETA)", "RIVAROXABAN 20MG (TABLETA)"]), "ISRS_ISRN_SANGRADO"), "ISRN + DOAC");
    });

    t.caso("sertralina + ibuprofeno dispara ISRS_ISRN_AINE HIGH", () => {
      const a = tipo(cat(["SERTRALINA 50 MG (TABLETA)", "IBUPROFENO 400 MG (TABLETA)"]), "ISRS_ISRN_AINE");
      t.cierto(!!a && a.severidad === "HIGH", "hemorragia digestiva");
      t.falso(!!tipo(cat(["SERTRALINA 50 MG (TABLETA)"]), "ISRS_ISRN_AINE"), "solo ISRS no");
    });

    // ============ DIGOXINA ============

    t.caso("digoxina + furosemida dispara DIGOXINA_DIURETICO HIGH", () => {
      const a = tipo(cat(["DIGOXINA 0.25 MG (TABLETA)", "FUROSEMIDA 40 MG TABLETA"]), "DIGOXINA_DIURETICO");
      t.cierto(!!a && a.severidad === "HIGH", "asa");
      t.cierto(!!tipo(cat(["DIGOXINA 0.25 MG (TABLETA)", "HIDROCLOROTIAZIDA 25 MG (TABLETA)"]), "DIGOXINA_DIURETICO"), "tiazida");
    });

    t.caso("bisoprolol + digoxina dispara BETA_DIGOXINA HIGH", () => {
      const a = tipo(cat(["BISOPROLOL 5 MG (TABLETA)", "DIGOXINA 0.25 MG (TABLETA)"]), "BETA_DIGOXINA");
      t.cierto(!!a && a.severidad === "HIGH", "bradicardia/bloqueo aditivo");
    });

    // ============ iSGLT2 ============

    t.caso("empagliflozina + furosemida dispara SGLT2_DIURETICO HIGH", () => {
      const a = tipo(cat(["EMPAGLIFLOZINA 10 MG (TABLETA)", "FUROSEMIDA 40 MG TABLETA"]), "SGLT2_DIURETICO");
      t.cierto(!!a && a.severidad === "HIGH", "depleción de volumen");
    });

    t.caso("empagliflozina + insulina glargina dispara SGLT2_INSULINA HIGH", () => {
      const a = tipo(cat(["EMPAGLIFLOZINA 10 MG (TABLETA)", "INSULINA GLARGINA 100 UI/ML (SOLUCION INYECTABLE)"]), "SGLT2_INSULINA");
      t.cierto(!!a && a.severidad === "HIGH", "hipoglucemia");
    });

    // ============ ESTATINA + CCB NO-DHP ============

    t.caso("simvastatina + verapamilo dispara CCB_NODHP_ESTATINA HIGH", () => {
      const a = tipo(cat(["SIMVASTATINA 40 MG (TABLETA)", "VERAPAMILO CLORHIDRATO 120 MG (TABLETA)"]), "CCB_NODHP_ESTATINA");
      t.cierto(!!a && a.severidad === "HIGH", "miopatía, tope 10 mg simva");
    });

    t.caso("atorvastatina + verapamilo NO dispara (la regla es para simva/lova)", () => {
      t.falso(!!tipo(cat(["ATORVASTATINA 40 MG (TABLETA)", "VERAPAMILO CLORHIDRATO 120 MG (TABLETA)"]), "CCB_NODHP_ESTATINA"),
        "atorvastatina no es estatina_cyp_alta");
    });

    // ============ CORTICOIDES ============

    t.caso("prednisolona + ibuprofeno dispara CORTICOIDE_AINE HIGH", () => {
      const a = tipo(cat(["PREDNISOLONA 5 MG (TABLETA)", "IBUPROFENO 400 MG (TABLETA)"]), "CORTICOIDE_AINE");
      t.cierto(!!a && a.severidad === "HIGH", "sangrado GI");
    });

    t.caso("prednisolona + enalapril dispara CORTICOIDE_ANTIHIPERTENSIVO INFO", () => {
      const a = tipo(cat(["PREDNISOLONA 5 MG (TABLETA)", "ENALAPRIL 20 MG (TABLETA)"]), "CORTICOIDE_ANTIHIPERTENSIVO");
      t.cierto(!!a && a.severidad === "INFO", "antagonismo, vigilar PA");
    });

    t.caso("FILTRO DE VÍA: la hidrocortisona en CREMA no dispara la interacción sistémica", () => {
      t.falso(!!tipo(cat(["HIDROCORTISONA 1% (CREMA)", "IBUPROFENO 400 MG (TABLETA)"]), "CORTICOIDE_AINE"),
        "un corticoide tópico no produce la interacción sistémica");
    });

    // ============ QT: AMIODARONA + FLUOROQUINOLONA ============

    t.caso("amiodarona + moxifloxacino dispara AMIODARONA_FQ_QT HIGH", () => {
      const a = tipo(cat(["AMIODARONA 200 MG (TABLETA)", "MOXIFLOXACINO 400 MG (TABLETA)"]), "AMIODARONA_FQ_QT");
      t.cierto(!!a && a.severidad === "HIGH", "QT aditivo");
    });

    t.caso("amiodarona sola no dispara; ni ciprofloxacino solo", () => {
      t.falso(!!tipo(cat(["AMIODARONA 200 MG (TABLETA)"]), "AMIODARONA_FQ_QT"), "amiodarona sola");
      t.falso(!!tipo(cat(["CIPROFLOXACINO 500 MG (TABLETA)"]), "AMIODARONA_FQ_QT"), "fluoroquinolona sola");
    });

    // ============ TRAMADOL + ISRS/ISRN ============

    t.caso("tramadol + sertralina dispara TRAMADOL_ISRS_ISRN HIGH", () => {
      const a = tipo(cat(["TRAMADOL 50 MG (CAPSULA)", "SERTRALINA 50 MG (TABLETA)"]), "TRAMADOL_ISRS_ISRN");
      t.cierto(!!a && a.severidad === "HIGH", "serotoninérgico");
    });

    // ============ ALOPURINOL + AZATIOPRINA/MERCAPTOPURINA ============

    t.caso("alopurinol + azatioprina es CRITICAL", () => {
      const a = tipo(cat(["ALOPURINOL 100 MG (TABLETA)", "AZATIOPRINA 50 MG (TABLETA)"]), "ALOPURINOL_AZATIOPRINA");
      t.cierto(!!a && a.severidad === "CRITICAL", "mielosupresión fatal descrita");
      t.cierto(!!tipo(cat(["ALOPURINOL 100 MG (TABLETA)", "MERCAPTOPURINA 50 MG (TABLETA)"]), "ALOPURINOL_AZATIOPRINA"), "mercaptopurina también");
    });

    // ============ METOTREXATO ============

    t.caso("metotrexato + ibuprofeno dispara METOTREXATO_AINE HIGH", () => {
      const a = tipo(cat(["METOTREXATO 2.5 MG (TABLETA)", "IBUPROFENO 400 MG (TABLETA)"]), "METOTREXATO_AINE");
      t.cierto(!!a && a.severidad === "HIGH", "mielosupresión");
    });

    t.caso("metotrexato + TMP-SMX es CRITICAL (antifolatos)", () => {
      const a = tipo(cat(["METOTREXATO 2.5 MG (TABLETA)", "TRIMETOPRIM + SULFAMETOXAZOL 160/800 MG (TABLETA)"]), "METOTREXATO_TMP_SMX");
      t.cierto(!!a && a.severidad === "CRITICAL", "pancitopenia");
    });

    // ============ AJUSTE RENAL DEL CATÁLOGO (Cockcroft-Gault) ============

    t.caso("aspirina con CrCl 25 dispara EVITAR HIGH; con CrCl 45 no", () => {
      const mal = cat(["ASPIRINA 100 MG (TABLETA)"], 90, null, 25).filter((x) => x.principio_activo === "aspirina");
      t.igual(mal.length, 1, "una alerta");
      t.igual(mal[0].severidad, "HIGH", "grave");
      t.igual(mal[0].conducta, "EVITAR", "conducta");
      t.igual(cat(["ASPIRINA 100 MG (TABLETA)"], 90, null, 45).filter((x) => x.principio_activo === "aspirina").length, 0, "CrCl 45: nada");
    });

    t.caso("warfarina con CrCl 25 avisa INFO; verapamilo con CrCl 25 REDUCIR HIGH", () => {
      const war = cat(["WARFARINA SODICA 5 MG (TABLETA)"], 90, null, 25).filter((x) => x.principio_activo === "warfarina");
      t.igual(war.length, 1, "warfarina avisa");
      t.igual(war[0].severidad, "INFO", "precaución, no contraindicada");
      const ver = cat(["VERAPAMILO CLORHIDRATO 120 MG (TABLETA)"], 90, null, 25).filter((x) => x.principio_activo === "verapamilo");
      t.igual(ver.length, 1, "verapamilo avisa");
      t.igual(ver[0].severidad, "HIGH", "reducir dosis");
      t.igual(ver[0].conducta, "REDUCIR", "conducta");
    });

    t.caso("sin CrCl (null/0) las interacciones siguen, las renales callan", () => {
      const s = cat(["SERTRALINA 50 MG (TABLETA)", "CLOPIDOGREL 75 MG (TABLETA)"], 90, null, null);
      t.cierto(!!tipo(s, "ISRS_ISRN_SANGRADO"), "interacción sin CrCl sigue");
      const con0 = cat(["ASPIRINA 100 MG (TABLETA)"], 90, null, 0);
      t.igual(con0.filter((x) => x.principio_activo === "aspirina").length, 0, "CrCl 0: renal calla");
    });

    // ============ INTEGRACIÓN: el orquestador entrega el catálogo ============

    t.caso("el orquestador no duplica: con diurético manda el TRIPLE_WHAMMY y el AINE_RAAS calla", () => {
      const r = api.mtrAvisosFarmacologicos({
        medicamentos: ["IBUPROFENO 400 MG TABLETA RECUBIERTA", "LOSARTAN POTASICO 50 MG TABLETA", "FUROSEMIDA 40 MG TABLETA"],
        tfgCkdEpi: 60, tfgCockcroftGault: 60, potasio: null,
      });
      t.cierto(!!tipo(r.interacciones, "TRIPLE_WHAMMY"), "el triple de la capa base manda");
      t.falso(!!tipo(r.interacciones, "AINE_RAAS"), "el catálogo no duplica el mismo eje fisiológico");
    });

    t.caso("mtrAvisosFarmacologicos incluye la interacción y la renal del catálogo en todo", () => {
      const r = api.mtrAvisosFarmacologicos({
        medicamentos: ["CLOPIDOGREL 75 MG (TABLETA)", "OMEPRAZOL 20 MG (CAPSULA)", "ASPIRINA 100 MG (TABLETA)"],
        tfgCkdEpi: 60, tfgCockcroftGault: 25, potasio: null,
      });
      t.cierto(!!tipo(r.interacciones, "CLOPIDOGREL_IBP"), "la interacción del catálogo llega al médico");
      t.cierto(r.todo.some((x) => x.principio_activo === "aspirina"), "la renal del catálogo llega al médico");
      t.igual(r.todo.length, r.avisos.length + r.interacciones.length, "la identidad de la vista se conserva");
    });

    // ============ VADEMÉCUM REAL DE EVEREST (captura 23-ago, sanitizada) ============

    t.caso("vademécum REAL sanitizado: cada descripción del fixture cae en su grupo", () => {
      const nombres = fixtureVademecum.respuesta.map((m) => m.descripcion);
      const g = api.mtrGruposCatalogoRcv(nombres);
      t.cierto(!!g.ccb_dhp, "levoamlodipino → CCB DHP");
      t.cierto(!!g.ibp, "levopantoprazol → IBP");
      t.cierto(!!g.levotiroxina, "levotiroxina → hormona tiroidea");
      t.cierto(!!g.fluoroquinolona_qt, "levofloxacino → FQ con QT");
      t.cierto(g.isrs === undefined && g.tramadol === undefined, "sin grupos ajenos");
      t.igual(cat(nombres).length, 0, "los 10 nombres solos no forman ningún par de interacción");
    });

    t.caso("levotiroxina real + warfarina = LEVOTIROXINA_ANTICOAGULANTE HIGH", () => {
      const a = tipo(cat(["LEVOTIROXINA SODICA 50 mcg (TABLETA)", "WARFARINA SODICA 5 MG (TABLETA)"]), "LEVOTIROXINA_ANTICOAGULANTE");
      t.cierto(!!a && a.severidad === "HIGH", "INR a vigilar");
      t.cierto(!!tipo(cat(["LEVOTIROXINA SODICA 100 mcg (TABLETA)", "RIVAROXABAN 20MG (TABLETA)"]), "LEVOTIROXINA_ANTICOAGULANTE"), "con DOAC también");
      t.falso(!!tipo(cat(["LEVOTIROXINA SODICA 50 mcg (TABLETA)"]), "LEVOTIROXINA_ANTICOAGULANTE"), "levotiroxina sola no");
    });

    t.caso("levopantoprazol real + clopidogrel dispara CLOPIDOGREL_IBP", () => {
      t.cierto(!!tipo(cat(["LEVOPANTOPRAZOL 20MG (TABLETAS DE LIBERACIÓN RETARDADA)", "CLOPIDOGREL 75 MG (TABLETA)"]), "CLOPIDOGREL_IBP"),
        "levopantoprazol es un IBP que inhibe CYP2C19");
    });

    t.caso("levofloxacino real: el inyectable dispara QT con amiodarona, el oftálmico NO", () => {
      t.cierto(!!tipo(cat(["LEVOFLOXACINO 500 MG/100ML (SOLUCION INYECTABLE) - (H)", "AMIODARONA 200 MG (TABLETA)"]), "AMIODARONA_FQ_QT"),
        "sistémico: sí");
      t.falso(!!tipo(cat(["LEVOFLOXACINO 5MG/ML (SOLUCION OFTALMICA FRASCO GOTERO*5ML)", "AMIODARONA 200 MG (TABLETA)"]), "AMIODARONA_FQ_QT"),
        "oftálmico: filtro de vía (texto real de la base)");
    });

    t.caso("levoamlodipino real entra al lado antihipertensivo del corticoide", () => {
      const a = tipo(cat(["PREDNISOLONA 5 MG (TABLETA)", "LEVOAMLODIPINO 2,5 MG (TABLETA)"]), "CORTICOIDE_ANTIHIPERTENSIVO");
      t.cierto(!!a && a.severidad === "INFO", "CCB DHP antagonizado por el corticoide");
    });

    t.caso("amlodipino (sin 'levo') también es CCB DHP — aserción faltante cazada por mutación", () => {
      t.cierto(!!api.mtrGruposCatalogoRcv(["AMLODIPINO 5 MG (TABLETA)"]).ccb_dhp, "la aguja corta no se pierde");
      t.falso(!!api.mtrGruposCatalogoRcv(["AMLODIPINO 5 MG (TABLETA)"]).isrs, "y no inventa grupos ajenos");
    });

    t.caso("levocetirizina (no RCV) no dispara ninguna regla del catálogo", () => {
      t.igual(cat(["LEVOCETIRIZINA 5 MG (CAPSULA)"]).length, 0, "ruido limpio");
    });
  },
};
