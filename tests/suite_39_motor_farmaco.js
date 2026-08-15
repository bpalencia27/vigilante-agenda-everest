// =====================================================================
//  SUITE 39 — Seguridad de dosis renal: comportamiento y costura
//
//  La suite 43 comprueba que el port reproduce al Copiloto en 9.000 vectores.
//  Esta comprueba las propiedades que un contraste vector a vector NO ve:
//
//   · que la ausencia de datos NUNCA se lea como "todo bien" — el fallo más
//     peligroso de un avisador clínico no es avisar de más, es callar porque
//     no pudo leer;
//   · que la costura hacia Everest sigue desenganchada y se nota;
//   · que la bandera nace apagada;
//   · que un fármaco prohibido nunca se degrada a un aviso blando.
// =====================================================================
module.exports = {
  nombre: "Seguridad de dosis renal (motor portado)",
  cubre: [
    "mtrAvisosDosisRenal", "mtrLeerMedicamentos", "mtrLeerFactoresRCV",
    "mtrMotorEncendido", "mtrDetectarPrincipios", "mtrPrincipioEnTexto",
    "mtrEvaluarDiscrepanciaEstadios", "mtrClasificarEstadioTfg",
    "mtrReglaErcG3aA2", "mtrReglaFurosemida", "mtrAlerta", "mtrAlertaSuave",
    "mtrFmt0", "mtrFmt1", "mtrNumPy",
  ],

  pruebas(t, api) {
    // ---------- lo que más importa: el silencio siempre lleva motivo ----------

    t.caso("sin lista de medicamentos NO se devuelve 'todo bien', se devuelve el motivo", () => {
      const r = api.mtrAvisosDosisRenal({});
      t.igual(r.avisos, []);
      t.igual(r.motivo, "SIN_LISTA_DE_MEDICAMENTOS");
      t.cierto(/no significa que no haya riesgo/i.test(r.legible),
        "el texto para el médico tiene que decir explícitamente que el silencio no es seguridad");
    });

    t.caso("cero avisos con lista leída y cero avisos sin lista son motivos DISTINTOS", () => {
      const sinLista = api.mtrAvisosDosisRenal({});
      const conLista = api.mtrAvisosDosisRenal({
        medicamentos: ["ACETAMINOFEN 500 MG"], tfgCkdEpi: 80, tfgCockcroftGault: 82,
      });
      t.igual(sinLista.avisos.length, 0);
      t.igual(conLista.avisos.length, 0);
      t.cierto(sinLista.motivo !== conLista.motivo,
        "clínicamente son opuestos y no pueden compartir motivo");
      t.igual(conLista.motivo, "SIN_HALLAZGOS");
    });

    t.caso("sin función renal tampoco se juzga nada, y se dice", () => {
      for (const ctx of [
        { medicamentos: ["METFORMINA 850 MG"] },
        { medicamentos: ["METFORMINA 850 MG"], tfgCkdEpi: 0, tfgCockcroftGault: 0 },
        { medicamentos: ["METFORMINA 850 MG"], tfgCkdEpi: "abc", tfgCockcroftGault: 30 },
        { medicamentos: ["METFORMINA 850 MG"], tfgCkdEpi: -5, tfgCockcroftGault: 30 },
      ]) {
        const r = api.mtrAvisosDosisRenal(ctx);
        t.igual(r.motivo, "SIN_FUNCION_RENAL", JSON.stringify(ctx));
        t.igual(r.avisos, []);
      }
    });

    t.caso("lista vacía leída de verdad es su propio motivo", () => {
      const r = api.mtrAvisosDosisRenal({ medicamentos: [], tfgCkdEpi: 25, tfgCockcroftGault: 26 });
      t.igual(r.motivo, "SIN_MEDICAMENTOS_ACTIVOS");
    });

    // ---------- la costura sigue desenganchada, y se comprueba ----------

    t.caso("la costura hacia Everest devuelve null: no hay endpoint adivinado", () => {
      t.igual(api.mtrLeerMedicamentos("cita-123"), null,
        "si esto deja de ser null, alguien enganchó un endpoint: hay que portar el contrato y sus pruebas");
      t.igual(api.mtrLeerFactoresRCV("cita-123"), null);
    });

    t.caso("la bandera nace apagada", () => {
      t.falso(api.mtrMotorEncendido(), "el motor no puede llegar encendido a veinte consultorios");
    });

    // ---------- que un fármaco prohibido no se degrade ----------

    t.caso("el anticoagulante con tilde sigue siendo CONTRAINDICADO, no un aviso blando", () => {
      // El bug que el Copiloto ya corrigió: con .lower() a secas "Dabigatrán"
      // no casaba con "dabigatran" y la alerta bajaba de CRITICAL a HIGH.
      const conTilde = api.mtrReglaDoac("DABIGATRÁN 150 MG", 20, null);
      const sinTilde = api.mtrReglaDoac("DABIGATRAN 150 MG", 20, null);
      t.igual(conTilde.conducta, "CONTRAINDICADA");
      t.igual(conTilde.severidad, "CRITICAL");
      t.igual(conTilde.mensaje, sinTilde.mensaje, "la tilde no puede cambiar la conducta");
    });

    t.caso("la metformina cruza sus dos umbrales en el sitio exacto", () => {
      t.igual(api.mtrReglaMetformina("METFORMINA", 29.9, null).conducta, "CONTRAINDICADA");
      t.igual(api.mtrReglaMetformina("METFORMINA", 30, null).conducta, "CAP_DOSIS");
      t.igual(api.mtrReglaMetformina("METFORMINA", 44.9, null).conducta, "CAP_DOSIS");
      t.igual(api.mtrReglaMetformina("METFORMINA", 45, null), null);
    });

    t.caso("la linagliptina se excluye del ajuste renal y las demás gliptinas no", () => {
      t.igual(api.mtrReglaDpp4("LINAGLIPTINA 5 MG", 20, null), null);
      t.cierto(!!api.mtrReglaDpp4("SITAGLIPTINA 100 MG", 20, null));
    });

    t.caso("un potasio alto contraindica la espironolactona aunque el riñón esté bien", () => {
      const r = api.mtrReglaEspironolactona("ESPIRONOLACTONA 25 MG", 90, 5.2);
      t.igual(r.conducta, "CONTRAINDICADA");
      t.igual(r.severidad, "CRITICAL");
      t.cierto(r.mensaje.indexOf("5.2") >= 0, "el mensaje tiene que llevar el valor real");
      t.igual(api.mtrReglaEspironolactona("ESPIRONOLACTONA 25 MG", 90, 4.9), null);
    });

    // ---------- detección de principios ----------

    t.caso("el texto libre del EHR se reconoce con dosis, mayúsculas y tildes", () => {
      for (const txt of ["METFORMINA 850 MG", "metformina", "Metformina 1000mg c/12h", "METFÓRMINA"]) {
        const p = api.mtrDetectarPrincipios(txt);
        if (txt === "METFÓRMINA") continue; // tilde inventada: no está en el vademécum
        t.cierto(p.indexOf("metformina") >= 0, "no reconoció: " + txt);
      }
      t.igual(api.mtrDetectarPrincipios("acetaminofen 500"), []);
      t.igual(api.mtrDetectarPrincipios(""), []);
      t.igual(api.mtrDetectarPrincipios(null), []);
    });

    t.caso("un mismo fármaco puede pertenecer a varios grupos, y se detectan todos", () => {
      const p = api.mtrDetectarPrincipios("ATENOLOL 50 MG");
      t.cierto(p.indexOf("betabloqueador_hidrofilico") >= 0);
      t.cierto(p.indexOf("betabloqueador") >= 0);
    });

    t.caso("mtrPrincipioEnTexto cae al propio nombre cuando no hay sinónimos", () => {
      t.cierto(api.mtrPrincipioEnTexto("metformina", "toma metformina hoy"));
      t.falso(api.mtrPrincipioEnTexto("metformina", "toma losartan hoy"));
      t.cierto(api.mtrPrincipioEnTexto("inventado", "algo inventado aqui"),
        "sin entrada en el vademécum, busca el nombre literal");
    });

    // ---------- discrepancia entre fórmulas ----------

    t.caso("dos fórmulas que discrepan más de dos estadios levantan alerta", () => {
      t.igual(api.mtrEvaluarDiscrepanciaEstadios(95, 92), null, "mismo estadio");
      t.igual(api.mtrEvaluarDiscrepanciaEstadios(null, 50), null);
      t.igual(api.mtrEvaluarDiscrepanciaEstadios(0, 50), null, "una TFG de 0 no es un dato");
      const d = api.mtrEvaluarDiscrepanciaEstadios(95, 20);
      t.cierto(!!d && d.alerta === true);
      t.igual(d.estadio_cg, "G1");
      t.igual(d.estadio_ckd, "G4");
      t.igual(d.diferencia_estadios, 4);
    });

    t.caso("los cortes KDIGO caen donde deben", () => {
      t.igual(api.mtrClasificarEstadioTfg(90), "G1");
      t.igual(api.mtrClasificarEstadioTfg(89.9), "G2");
      t.igual(api.mtrClasificarEstadioTfg(60), "G2");
      t.igual(api.mtrClasificarEstadioTfg(59.9), "G3a");
      t.igual(api.mtrClasificarEstadioTfg(45), "G3a");
      t.igual(api.mtrClasificarEstadioTfg(44.9), "G3b");
      t.igual(api.mtrClasificarEstadioTfg(30), "G3b");
      t.igual(api.mtrClasificarEstadioTfg(29.9), "G4");
      t.igual(api.mtrClasificarEstadioTfg(15), "G4");
      t.igual(api.mtrClasificarEstadioTfg(14.9), "G5");
    });

    // ---------- la regla global ----------

    t.caso("sin RAC, la regla de ERC G3a/A2 calla: no se estadifica la albuminuria a ojo", () => {
      t.igual(api.mtrReglaErcG3aA2(["ATORVASTATINA"], 50, null), []);
      t.igual(api.mtrReglaErcG3aA2(["ATORVASTATINA"], 50, 29), [], "por debajo de A2");
      t.igual(api.mtrReglaErcG3aA2(["ATORVASTATINA"], 50, 300), [], "por encima de A2");
      t.igual(api.mtrReglaErcG3aA2(["ATORVASTATINA"], 61, 100), [], "fuera de G3a");
    });

    t.caso("en G3a/A2 sin IECA/ARA-II se recomienda INICIAR, no solo suspender", () => {
      const r = api.mtrReglaErcG3aA2(["ATORVASTATINA 40 MG"], 50, 100);
      t.igual(r.length, 1);
      t.igual(r[0].conducta, "INICIAR");
      t.igual(r[0].severidad, "CRITICAL");
    });

    t.caso("en G3a/A2 el AINE sube a CRITICAL si además falta el bloqueo SRAA", () => {
      const conRaas = api.mtrReglaErcG3aA2(["LOSARTAN 50 MG", "IBUPROFENO 400 MG"], 50, 100);
      const sinRaas = api.mtrReglaErcG3aA2(["IBUPROFENO 400 MG"], 50, 100);
      const aineCon = conRaas.filter((a) => a.principio_activo === "erc_g3a_a2_con_aine")[0];
      const aineSin = sinRaas.filter((a) => a.principio_activo === "erc_g3a_a2_con_aine")[0];
      t.igual(aineCon.severidad, "HIGH");
      t.igual(aineSin.severidad, "CRITICAL");
      t.igual(sinRaas.length, 2, "sin RAAS salen las dos alertas: iniciar y suspender");
    });

    // ---------- furosemida y su dosis ----------

    t.caso("la furosemida sin dosis conocida avisa conservador, no calla", () => {
      t.igual(api.mtrReglaFurosemida("FUROSEMIDA", 60, null, null), null, "riñón sano: silencio");
      const r = api.mtrReglaFurosemida("FUROSEMIDA", 25, null, null);
      t.igual(r.conducta, "REVISAR_FICHA_TECNICA");
      t.igual(r.severidad, "HIGH");
      t.igual(api.mtrReglaFurosemida("FUROSEMIDA", 25, null, 80).conducta, "CAP_DOSIS");
      t.igual(api.mtrReglaFurosemida("FUROSEMIDA", 25, null, 40).severidad, "INFO");
    });

    t.caso("hipokalemia con ERC avanzada manda sobre el tope de dosis", () => {
      const r = api.mtrReglaFurosemida("FUROSEMIDA", 25, 3.2, 80);
      t.cierto(r.mensaje.indexOf("hipokalemia") >= 0, "la hipokalemia tiene prioridad sobre el cap");
    });

    // ---------- el orquestador no repite ni se atraganta ----------

    t.caso("no se repite la misma conducta para el mismo principio aunque haya dos presentaciones", () => {
      const r = api.mtrEvaluarSeguridadDosisRenal(
        ["METFORMINA 850 MG", "METFORMINA 1000 MG"], 20, 21, null, null, null);
      const metf = r.filter((a) => a.principio_activo === "metformina");
      t.igual(metf.length, 1, "dos presentaciones del mismo fármaco no son dos avisos");
    });

    t.caso("una lista con basura no tumba el motor ni ensucia la salida", () => {
      for (const lista of [[null], [""], ["   "], [undefined], [null, "METFORMINA 850 MG"]]) {
        t.noLanza(() => api.mtrEvaluarSeguridadDosisRenal(lista, 20, 21, null, null, null),
          JSON.stringify(lista));
      }
      const r = api.mtrEvaluarSeguridadDosisRenal([null, "METFORMINA 850 MG"], 20, 21, null, null, null);
      t.igual(r.length, 1, "la entrada basura se salta, la buena se evalúa");
    });

    t.caso("un paciente polimedicado en G4 recibe todos sus avisos, sin duplicar", () => {
      const r = api.mtrEvaluarSeguridadDosisRenal(
        ["METFORMINA 1000 MG", "GLIBENCLAMIDA 5 MG", "IBUPROFENO 400 MG",
         "HIDROCLOROTIAZIDA 25 MG", "ATENOLOL 50 MG"], 20, 21, null, null, null);
      const principios = r.map((a) => a.principio_activo).sort();
      t.cierto(principios.indexOf("metformina") >= 0);
      t.cierto(principios.indexOf("sulfonilurea") >= 0);
      t.cierto(principios.indexOf("aines") >= 0);
      t.cierto(principios.indexOf("tiazida") >= 0);
      t.cierto(principios.indexOf("betabloqueador_hidrofilico") >= 0);
      t.igual(principios.length, new Set(principios).size, "hay principios repetidos");
    });

    // ---------- formateo ----------

    t.caso("los números se formatean como en Python, no como en JavaScript", () => {
      t.igual(api.mtrFmt1(5.25), "5.3");
      t.igual(api.mtrFmt1(null), "");
      t.igual(api.mtrFmt0(24.4), "24");
      t.igual(api.mtrNumPy(10), "10.0", "str(10.0) en Python es '10.0', no '10'");
      t.igual(api.mtrNumPy(10.5), "10.5");
    });

    t.caso("toda alerta lleva su procedencia y su bandera de override", () => {
      const a = api.mtrAlerta("x", "y", "EVITAR", "m", "f", 10, "HIGH");
      t.igual(a.fuente, "SYS_MOTOR_RCV <SEGURIDAD_DOSIS_RENAL>");
      t.cierto(a.override_llm === true);
      t.cierto(api.mtrAlertaSuave("x", "y", "EVITAR", "m", "f", 10, "HIGH").override_llm === false);
    });
  },
};
