// =====================================================================
//  SUITE 48 — Uroanálisis (ITU vs bacteriuria), foco clínico,
//             banderas de educación y alerta de triglicéridos
//
//  Los cuatro bloques de SYS_MOTOR_RCV que faltaban por portar. El del
//  uroanálisis es el que más importa vigilar: la norma PROHÍBE tratar una
//  bacteriuria asintomática con antibiótico, y ese es un error frecuente.
//  Estas pruebas fijan que el script nunca diga "trate" cuando la norma dice
//  "no trate", y que nunca decida "asintomática" sin que conste que se
//  preguntó por los síntomas.
// =====================================================================

module.exports = {
  nombre: "Uroanálisis, foco clínico, educación y triglicéridos",
  cubre: [
    "mtrEvaluarUroanalisis", "mtrPriorityFocus", "mtrEjesEnFalla",
    "mtrEducationFlags", "mtrAlertaTrigliceridos",
    "mtrUroGrado", "mtrUroRecuento", "_uroMayorGrado",
    "mtrDebePreguntarEmbarazo", "mtrEmbarazoEdadFertil", "mtrPreguntaEmbarazo", "_vglConfirmacionVigente",
    "_uroToggleAcordeon",
  ],

  pruebas(t, api) {
    // ============ COMO ESCRIBEN DE VERDAD LOS LABORATORIOS ============
    // v16.7.0, auditoría #13. El criterio viejo solo entendía true,
    // "positivo" y "+". Los informes de la IPS traen cruces y escalas, así
    // que un parcial claramente positivo se leía NEGATIVO. Esto es lo que
    // no puede volver a pasar.

    t.caso("mtrUroGrado: las cruces valen lo que dicen, y «++» ya no es negativo", () => {
      t.igual(api.mtrUroGrado("+"), 1, "una cruz");
      t.igual(api.mtrUroGrado("++"), 2, "dos cruces — ESTE era el falso negativo");
      t.igual(api.mtrUroGrado("+++"), 3, "tres");
      t.igual(api.mtrUroGrado("++++"), 4, "cuatro");
      t.igual(api.mtrUroGrado("3+"), 3, "la notación numérica del LIS vale igual");
      t.igual(api.mtrUroGrado("2 +"), 2, "con espacio de por medio también");
      t.igual(api.mtrUroGrado("+ + +"), 3, "y separadas");
      t.igual(api.mtrUroGrado("9+"), 4, "no se pasa de 4 aunque el LIS escriba cualquier cosa");
    });

    t.caso("mtrUroGrado: las escalas del sedimento (escasas/moderadas/abundantes)", () => {
      t.igual(api.mtrUroGrado("ABUNDANTES"), 3, "abundantes es positivo franco");
      t.igual(api.mtrUroGrado("Moderadas"), 2, "moderadas también, y sin importar mayúsculas");
      t.igual(api.mtrUroGrado("INCONTABLES"), 4, "incontables es el tope");
      t.igual(api.mtrUroGrado("ESCASAS"), 0, "escasas NO: es el hallazgo inespecífico más común del parcial");
      t.igual(api.mtrUroGrado("Trazas"), 0, "trazas tampoco llega a cruz franca");
    });

    t.caso("mtrUroGrado: los negativos de verdad, con y sin tildes", () => {
      [ "NEGATIVO", "Negativa", "no se observan", "AUSENTE", "Ninguna", "0", "-" ].forEach((v) => {
        t.igual(api.mtrUroGrado(v), 0, "negativo: " + v);
      });
      t.igual(api.mtrUroGrado("POSITIVO"), 1, "y positivo sigue siendo positivo");
      t.igual(api.mtrUroGrado("Presente"), 1, "igual que presente");
      t.igual(api.mtrUroGrado(true), 1, "el booleano de siempre no se rompió");
      t.igual(api.mtrUroGrado(false), 0, "ni el falso");
    });

    t.caso("mtrUroGrado: lo que no se entiende devuelve null — no se inventa un resultado", () => {
      t.igual(api.mtrUroGrado("muestra insuficiente"), null, "una nota del laboratorio no es un resultado");
      t.igual(api.mtrUroGrado(""), null, "vacío tampoco");
      t.igual(api.mtrUroGrado(null), null, "ni null");
      t.igual(api.mtrUroGrado(undefined), null, "ni undefined");
    });

    t.caso("mtrUroRecuento: rangos y comparadores, que es como llega el sedimento", () => {
      t.igual(api.mtrUroRecuento("10-15"), 15, "un rango vale por su tope: perder una piuria cuesta más");
      t.igual(api.mtrUroRecuento("10-15 x campo"), 15, "con unidad pegada, igual");
      t.igual(api.mtrUroRecuento("0-2"), 2, "y un rango normal sigue siendo normal");
      t.igual(api.mtrUroRecuento("> 50"), 50, "el comparador no estorba");
      t.igual(api.mtrUroRecuento("MAYOR A 100"), 100, "ni escrito con palabras");
      t.igual(api.mtrUroRecuento("30"), 30, "el número suelto de siempre");
      t.igual(api.mtrUroRecuento(25), 25, "y el número de verdad");
      t.igual(api.mtrUroRecuento("INCONTABLES"), 999, "campo cubierto: piuria franca");
      t.igual(api.mtrUroRecuento("ESCASOS"), null, "una escala no es un recuento");
      t.igual(api.mtrUroRecuento(""), null, "vacío, nada");
    });

    t.caso("EL CASO DEL INFORME REAL: esterasa ++ con 10-15 leucocitos por campo es sugestivo", () => {
      const r = api.mtrEvaluarUroanalisis({ esterasa: "++", leucocitos: "10-15" }, null, false);
      t.cierto(r.sugestivo, "hasta v16.6.1 esto salía SIN HALLAZGOS con el positivo en pantalla");
      t.igual(r.estado, "REQUIERE SÍNTOMAS", "y ahora pide lo único que falta: preguntar por los síntomas");
    });

    t.caso("bacterias ABUNDANTES con piuria es sugestivo; ESCASAS no decide pero se muestra", () => {
      const franco = api.mtrEvaluarUroanalisis({ bacteriuria: "ABUNDANTES", leucocitos: "20-25" }, true, false);
      t.cierto(franco.sugestivo, "bacteriuria franca + piuria");
      const leve = api.mtrEvaluarUroanalisis({ bacteriuria: "ESCASAS", leucocitos: "20-25" }, true, false);
      t.falso(leve.sugestivo, "escasas bacterias no manda a urocultivo a media consulta");
      t.cierto(leve.leves.some((x) => /bacterias: ESCASAS/.test(x)), "pero el médico las ve anotadas: " + JSON.stringify(leve.leves));
    });

    t.caso("_uroMayorGrado: entre dos lecturas del mismo hallazgo gana la más alarmante, no la última", () => {
      t.igual(api._uroMayorGrado("NEGATIVO", "++"), "++", "el positivo posterior sí manda");
      t.igual(api._uroMayorGrado("++", "NEGATIVO"), "++", "pero un negativo posterior NO borra el positivo");
      t.igual(api._uroMayorGrado(null, "+"), "+", "sin nada previo, entra el nuevo");
      t.igual(api._uroMayorGrado("+", "nota rara"), "+", "lo ininterpretable no pisa lo que ya se sabía");
      t.igual(api._uroMayorGrado("nota rara", "+"), "+", "y sí lo reemplaza al revés");
    });

    // ===== v16.9.0 — LA PREGUNTA DE EMBARAZO, solo donde cambia la conducta =====
    // Decisión del médico (20-ago): preguntar SOLO a mujer en edad fértil con parcial
    // sugestivo, y que la respuesta valga 30 días. Hasta aquí `embarazo` llegaba
    // undefined en todos los caminos: la regla «en embarazo la bacteriuria se trata
    // siempre», que el motor ya tenía escrita, era inalcanzable.
    t.caso("mtrDebePreguntarEmbarazo: se pregunta cuando —y solo cuando— la respuesta cambia la conducta", () => {
      const base = { sexo: "F", edad: 30, uroSugestivo: true, yaConfirmado: null };
      t.cierto(api.mtrDebePreguntarEmbarazo(base), "mujer fértil + parcial sugestivo: se pregunta");
      t.falso(api.mtrDebePreguntarEmbarazo(Object.assign({}, base, { uroSugestivo: false })),
        "sin parcial sugestivo no cambia nada: no se pregunta");
      t.falso(api.mtrDebePreguntarEmbarazo(Object.assign({}, base, { sexo: "M" })), "a un hombre no se le pregunta");
      t.falso(api.mtrDebePreguntarEmbarazo(Object.assign({}, base, { edad: 70 })), "ni fuera de la edad fértil");
      t.falso(api.mtrDebePreguntarEmbarazo(Object.assign({}, base, { edad: 8 })), "ni a una niña");
      t.falso(api.mtrDebePreguntarEmbarazo(Object.assign({}, base, { yaConfirmado: { v: false, ts: 1 } })),
        "si ya lo respondió y sigue vigente, no se vuelve a preguntar");
      t.falso(api.mtrDebePreguntarEmbarazo(null), "sin datos no se pregunta nada");
      t.falso(api.mtrDebePreguntarEmbarazo({ sexo: "F", uroSugestivo: true }), "sin edad tampoco: no se adivina");
    });

    t.caso("mtrEmbarazoEdadFertil: los bordes de la ventana", () => {
      t.cierto(api.mtrEmbarazoEdadFertil(12) && api.mtrEmbarazoEdadFertil(55), "los extremos entran");
      t.falso(api.mtrEmbarazoEdadFertil(11) || api.mtrEmbarazoEdadFertil(56), "fuera, no");
      t.falso(api.mtrEmbarazoEdadFertil(null), "sin edad no se supone nada");
      t.falso(api.mtrEmbarazoEdadFertil("mucha"), "ni con basura");
    });

    t.caso("_vglConfirmacionVigente: la respuesta de embarazo CADUCA a los 30 días", () => {
      const doc = "999888777";
      api._vglConfirmacionGuardar(doc, "embarazo", true);
      const hoy = Date.now();
      const viva = api._vglConfirmacionVigente(doc, "embarazo", 30, hoy);
      t.cierto(!!viva && viva.v === true, "recién respondida, vale");
      const dentro = api._vglConfirmacionVigente(doc, "embarazo", 30, hoy + 29 * 86400000);
      t.cierto(!!dentro, "a los 29 días sigue valiendo");
      const vencida = api._vglConfirmacionVigente(doc, "embarazo", 30, hoy + 31 * 86400000);
      t.igual(vencida, null, "a los 31 ya no: se vuelve a preguntar, que es lo que el médico pidió");
      t.igual(api._vglConfirmacionVigente(doc, "nunca-respondida", 30, hoy), null, "lo que no se respondió no vale");
      t.cierto(!!api._vglConfirmacionVigente(doc, "embarazo", null, hoy + 999 * 86400000),
        "sin vigencia declarada se comporta como las demás confirmaciones: no caduca");
    });

    t.caso("mtrPreguntaEmbarazo: la pregunta dice POR QUÉ se hace y frena el flujo", () => {
      const q = api.mtrPreguntaEmbarazo();
      t.igual(q.clave, "embarazo");
      t.igual(q.severidad, "alta", "frena: la conducta cambia según la respuesta");
      t.igual(q.vigenciaDias, 30, "y la respuesta vale 30 días, no toda la vida");
      t.cierto(/se trata SIEMPRE/.test(q.porQue), "explica la regla clínica que está en juego");
      t.cierto(/error frecuente/.test(q.porQue), "y el error que evita en la otra dirección");
      t.igual(api.mtrDiscrepanciasQueFrenan([q]).length, 1, "el reconciliador la trata como bloqueante");
      // v17.0.2 — La pregunta tiene que hablar el MISMO idioma que el modal que la pinta:
      // con los campos de antes (`titulo`, `porque`, `fuentes`) el modal reventaba con
      // undefined y el Panel no abría en ninguna paciente con parcial sugestivo.
      t.cierto(typeof q.etiqueta === "string" && q.etiqueta.length > 0, "trae `etiqueta`, que es lo que el modal muestra");
      t.cierto(Array.isArray(q.afirman) && q.afirman.length > 0, "y `afirman`, sobre el que el modal hace .map");
      t.cierto(Array.isArray(q.niegan), "y `niegan`, idem");
      t.noLanza(() => q.afirman.map((x) => x.fuente + " (" + x.detalle + ")"),
        "la misma operación que hace el modal no puede lanzar");
    });

    t.caso("con embarazo confirmado, la bacteriuria se trata aunque no haya síntomas", () => {
      const sin = api.mtrEvaluarUroanalisis({ nitritos: "++" }, false, false);
      t.igual(sin.estado, "BACTERIURIA ASINTOMÁTICA", "fuera del embarazo y sin síntomas: NO se trata");
      const con = api.mtrEvaluarUroanalisis({ nitritos: "++" }, false, true);
      t.igual(con.estado, "BACTERIURIA EN EMBARAZO", "en embarazo sí, y es la excepción de la norma");
      t.cierto(con.orden.indexOf("Urocultivo") >= 0, "con su urocultivo");
    });

    // ================= UROANÁLISIS =================

    t.caso("nitritos positivos hacen el parcial sugestivo por sí solos", () => {
      const r = api.mtrEvaluarUroanalisis({ nitritos: true }, true, false);
      t.cierto(r.sugestivo, "nitritos(+) ya es criterio");
      t.igual(r.estado, "PROBABLE ITU", "con síntomas -> probable ITU");
    });

    t.caso("esterasa sola NO basta: hace falta piuria", () => {
      t.falso(api.mtrEvaluarUroanalisis({ esterasa: true }, true, false).sugestivo,
        "esterasa sin piuria no es sugestivo");
      t.cierto(api.mtrEvaluarUroanalisis({ esterasa: true, piuria: true }, true, false).sugestivo,
        "esterasa + piuria sí");
    });

    t.caso("la piuria se puede dar como conteo de leucocitos, no solo como bandera", () => {
      const r = api.mtrEvaluarUroanalisis({ esterasa: true, leucocitos: 25 }, true, false);
      t.cierto(r.sugestivo, "25 leucocitos cuentan como piuria");
    });

    t.caso("la glucosuria NUNCA es criterio de ITU (un diabético no tiene por eso infección)", () => {
      const r = api.mtrEvaluarUroanalisis({ glucosuria: true, glucosa: 300 }, true, false);
      t.falso(r.sugestivo, "glucosa en orina no hace sugestivo el parcial");
      t.igual(r.estado, "SIN HALLAZGOS", "y sin otro hallazgo, no hay ITU");
    });

    t.caso("sugestivo CON síntomas -> PROBABLE ITU, urocultivo, y NADA de antibiótico a ciegas", () => {
      const r = api.mtrEvaluarUroanalisis({ nitritos: true }, true, false);
      t.igual(r.estado, "PROBABLE ITU", "estado");
      t.cierto(r.orden.indexOf("Urocultivo") >= 0, "pide urocultivo");
      t.cierto(/no inicie antibi.tico a ciegas/i.test(r.conducta), "y prohíbe el antibiótico empírico");
    });

    t.caso("sugestivo SIN síntomas -> BACTERIURIA ASINTOMÁTICA, NO se trata", () => {
      const r = api.mtrEvaluarUroanalisis({ nitritos: true }, false, false);
      t.igual(r.estado, "BACTERIURIA ASINTOMÁTICA", "estado");
      t.cierto(/no se trata/i.test(r.conducta), "la norma dice no tratar");
      t.igual(r.orden.filter((o) => /urocultivo/i.test(o)).length, 0,
        "y no se pide urocultivo por un hallazgo sin síntomas");
    });

    t.caso("sugestivo con síntomas DESCONOCIDOS -> no se decide, se pide confirmar", () => {
      // El error a evitar: decir "asintomática" sin haber preguntado.
      const r = api.mtrEvaluarUroanalisis({ nitritos: true }, null, false);
      t.igual(r.estado, "REQUIERE SÍNTOMAS", "no se asume nada");
      t.cierto(/confirme/i.test(r.conducta), "se pide confirmar con el paciente");
    });

    t.caso("en embarazo la bacteriuria SÍ se trata, con o sin síntomas", () => {
      const conSint = api.mtrEvaluarUroanalisis({ nitritos: true }, false, true);
      t.igual(conSint.estado, "BACTERIURIA EN EMBARAZO", "el embarazo es la excepción");
      t.cierto(conSint.orden.indexOf("Urocultivo") >= 0, "se pide urocultivo aunque no haya síntomas");
    });

    t.caso("un parcial limpio da SIN HALLAZGOS y aun así deja una orden (nunca vacía)", () => {
      const r = api.mtrEvaluarUroanalisis({}, null, false);
      t.igual(r.estado, "SIN HALLAZGOS", "sin nada positivo");
      t.cierto(r.orden.length >= 1, "la orden nunca queda vacía");
    });

    t.caso("acepta los hallazgos como '+' o como texto 'positivo', no solo booleanos", () => {
      t.cierto(api.mtrEvaluarUroanalisis({ nitritos: "+" }, true, false).sugestivo, "'+' cuenta");
      t.cierto(api.mtrEvaluarUroanalisis({ nitritos: "POSITIVO" }, true, false).sugestivo, "'POSITIVO' cuenta");
    });

    // ================= FOCO CLÍNICO =================

    const resumen = (over) => Object.assign({
      programa: "HTA",
      riesgo: { categoria: "alto", paso: 2 },
      meta: { falla: false, fallaGrave: false },
      erc: { anr: null, sospechaIra: false, remitirNefrologia: false },
      plan: { anr: null, drivers: [] },
    }, over || {});

    t.caso("paso 4 pendiente manda: el foco es 'clasificación' por encima de todo", () => {
      const r = resumen({ riesgo: { categoria: null, paso: 4, requiereAscvd: true } });
      t.igual(api.mtrPriorityFocus(r), "clasificación", "sin clasificar, eso es lo primero");
    });

    t.caso("dos ejes en falla crítica -> 'mixto'", () => {
      const r = resumen({
        erc: { remitirNefrologia: true },  // renal
        meta: { fallaGrave: true },        // lipídico
        plan: { drivers: [] },
      });
      t.igual(api.mtrPriorityFocus(r), "mixto", "renal + lipídico a la vez");
    });

    t.caso("un solo eje en falla nombra el foco", () => {
      const soloRenal = resumen({ erc: { sospechaIra: true }, plan: { drivers: [] } });
      t.igual(api.mtrPriorityFocus(soloRenal), "renal", "IRA -> renal");
      const soloMetab = resumen({
        plan: { drivers: [{ clave: "HBA1C", estado: "A" }] },
      });
      t.igual(api.mtrPriorityFocus(soloMetab), "metabólico", "HbA1c vencida -> metabólico");
    });

    t.caso("sin nada en falla, el foco lo marca el programa rector", () => {
      t.igual(api.mtrPriorityFocus(resumen({ programa: "ERC" })), "renal", "ERC -> renal");
      t.igual(api.mtrPriorityFocus(resumen({ programa: "DM2" })), "metabólico", "DM2 -> metabólico");
      t.igual(api.mtrPriorityFocus(resumen({ programa: "HTA" })), "lipídico", "HTA -> lipídico");
    });

    t.caso("los ejes en falla se leen del plan y del estado renal", () => {
      const ejes = api.mtrEjesEnFalla(resumen({
        erc: { remitirNefrologia: true },
        plan: { drivers: [{ clave: "GLUCOSA", estado: "A" }] },
        meta: { falla: true },
      }));
      t.cierto(ejes.renal, "remisión -> eje renal");
      t.cierto(ejes.metabolico, "glicemia vencida -> eje metabólico");
      t.cierto(ejes.lipidico, "falla de meta -> eje lipídico");
    });

    // ================= EDUCACIÓN =================

    t.caso("las alarmas se encienden en muy alto riesgo o cuando hay falla", () => {
      t.cierto(api.mtrEducationFlags({ riesgo: { categoria: "muy alto" }, meta: {}, programa: "ERC" }).alarmas,
        "muy alto -> alarmas");
      t.cierto(api.mtrEducationFlags({ riesgo: { categoria: "moderado" }, meta: { falla: true }, programa: "DM2" }).alarmas,
        "falla -> alarmas");
      t.falso(api.mtrEducationFlags({ riesgo: { categoria: "moderado" }, meta: { falla: false }, programa: "HTA" }).alarmas,
        "sin nada de eso, no");
    });

    t.caso("dieta y actividad se encienden cuando el programa incluye RCV", () => {
      const f = api.mtrEducationFlags({ riesgo: {}, meta: {}, programa: "ERC" });
      t.cierto(f.dieta && f.actividad, "ERC es un programa de RCV");
      const sinPrograma = api.mtrEducationFlags({ riesgo: {}, meta: {}, programa: null });
      t.falso(sinPrograma.dieta, "sin programa RCV, no se encienden");
    });

    // ================= TRIGLICÉRIDOS =================

    t.caso("triglicéridos >= 500 son alerta de pancreatitis", () => {
      const r = api.mtrAlertaTrigliceridos(520);
      t.igual(r.nivel, "critico", "nivel crítico");
      t.cierto(/pancreatitis/i.test(r.mensaje), "y lo nombra");
    });

    t.caso("triglicéridos entre 150 y 500 avisan que están sobre la meta, sin alarma", () => {
      const r = api.mtrAlertaTrigliceridos(200);
      t.igual(r.nivel, "info", "solo informativo");
    });

    t.caso("triglicéridos en meta no generan aviso, y un valor ausente tampoco", () => {
      t.igual(api.mtrAlertaTrigliceridos(120), null, "120 está en meta");
      t.igual(api.mtrAlertaTrigliceridos(null), null, "sin dato, sin aviso inventado");
    });

    // ================= INTEGRACIÓN CON EL RESUMEN =================

    t.caso("el resumen clínico trae ya calculados el foco, las banderas y el TG", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 60, sexo: "M", pesoKg: 80, creatinina: 1.0,
        ct: 200, hdl: 40, ldl: 100, paSistolica: 130, tg: 610,
        factores: { hta: true, diabetes: true },
        ultimos: {}, programa: "DM2",
      });
      t.cierto(!!r.foco, "trae foco");
      t.cierto(!!r.educationFlags, "trae banderas de educación");
      t.cierto(!!r.tgAlerta && r.tgAlerta.nivel === "critico", "y la alerta de TG≥500");
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(/pancreatitis/i.test(html), "que se ve en el recuadro");
      t.cierto(/foco:/i.test(html), "y el foco también");
    });

    t.caso("el uroanálisis solo aparece en el resumen si llegaron sus componentes", () => {
      const sin = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 60, sexo: "M", pesoKg: 80, creatinina: 1.0,
        factores: {}, ultimos: {}, programa: "HTA",
      });
      t.igual(sin.uroanalisis, null, "sin componentes, no se inventa un uroanálisis");
      const con = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 60, sexo: "M", pesoKg: 80, creatinina: 1.0,
        factores: {}, ultimos: {}, programa: "HTA",
        uroHallazgos: { nitritos: true }, uroSintomas: true,
      });
      t.igual(con.uroanalisis.estado, "PROBABLE ITU", "con componentes y síntomas, sí");
    });

    // ============ #116 — EL ACORDEÓN «🔍 Ver N analitos» ============
    // v17.1.0. El acordeón tuvo el HTML y el CSS listos desde la v14.6.0 y el clic sin
    // enganchar hasta la v17.0.3: el médico tocaba la lupa y no pasaba nada, durante
    // trece versiones, sin que ninguna prueba lo notara. El motivo del hueco: la lógica
    // vivía en un closure anónimo dentro del listener delegado de openLaboratoriosModal,
    // inalcanzable para el arnés (que no reconstruye DOM real desde innerHTML). Ahora es
    // una función nombrada y estas pruebas la ejercen por invocación directa.
    // Dobles a mano y no el elem() del arnés: su `style` no arranca en "none" y su
    // querySelector devuelve null siempre, así que no serviría para medir el conmutador.
    const montarAcordeon = (id) => {
      const flecha = { textContent: "▾" };
      const panel = { style: { display: "none" } };
      const btn = {
        dataset: { target: id },
        classList: {
          _s: new Set(),
          toggle(c, f) { if (f) this._s.add(c); else this._s.delete(c); },
          contains(c) { return this._s.has(c); },
        },
        querySelector: (s) => (s === ".vgl-uro-arrow" ? flecha : null),
      };
      const cont = { querySelector: (s) => (s === "#" + id ? panel : null) };
      return { btn, panel, flecha, cont };
    };

    t.caso("_uroToggleAcordeon: el primer clic ABRE el panel, marca el botón y gira la flecha", () => {
      const { btn, panel, flecha, cont } = montarAcordeon("vgl-uro-acc-0");
      t.igual(api._uroToggleAcordeon(btn, cont), true, "devuelve true: quedó abierto");
      t.igual(panel.style.display, "", "el panel deja de estar oculto");
      t.cierto(btn.classList.contains("abierto"), "el botón queda en estado abierto");
      t.igual(flecha.textContent, "▴", "la flecha apunta hacia arriba");
    });

    t.caso("_uroToggleAcordeon: el segundo clic CIERRA — es un conmutador, no un abridor", () => {
      const { btn, panel, flecha, cont } = montarAcordeon("vgl-uro-acc-0");
      api._uroToggleAcordeon(btn, cont);
      t.igual(api._uroToggleAcordeon(btn, cont), false, "devuelve false: quedó cerrado");
      t.igual(panel.style.display, "none", "el panel vuelve a esconderse");
      t.falso(btn.classList.contains("abierto"), "el botón pierde el estado abierto");
      t.igual(flecha.textContent, "▾", "y la flecha vuelve a apuntar hacia abajo");
    });

    t.caso("_uroToggleAcordeon: dos filas son INDEPENDIENTES — abrir la de agosto no cierra la de marzo", () => {
      const a = montarAcordeon("vgl-uro-acc-0");
      const b = montarAcordeon("vgl-uro-acc-1");
      api._uroToggleAcordeon(a.btn, a.cont);
      api._uroToggleAcordeon(b.btn, b.cont);
      t.igual(a.panel.style.display, "", "la primera sigue abierta");
      t.igual(b.panel.style.display, "", "y la segunda también");
      t.cierto(a.btn.classList.contains("abierto") && b.btn.classList.contains("abierto"),
        "comparar dos fechas de uroanálisis a la vez es válido y tiene que poder hacerse");
    });

    t.caso("_uroToggleAcordeon: sin botón, sin data-target o sin panel devuelve null y no lanza", () => {
      const { btn, cont } = montarAcordeon("vgl-uro-acc-0");
      t.igual(api._uroToggleAcordeon(null, cont), null, "sin botón");
      t.igual(api._uroToggleAcordeon({ dataset: {}, getAttribute: () => null }, cont), null, "sin data-target");
      t.igual(api._uroToggleAcordeon(btn, { querySelector: () => null }), null, "sin panel que casar");
    });

    t.caso("_uroToggleAcordeon: un botón sin flecha (HTML de una versión vieja) no rompe el conmutador", () => {
      const { btn, panel, cont } = montarAcordeon("vgl-uro-acc-0");
      btn.querySelector = () => null;
      t.igual(api._uroToggleAcordeon(btn, cont), true, "el panel se abre igual");
      t.igual(panel.style.display, "", "y queda visible");
    });

    // Centinela de forma: que nadie vuelva a meter el conmutador dentro del closure.
    t.caso("el listener delegado de la tabla de labs DELEGA en la función nombrada, no reimplementa el toggle", () => {
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/_uroToggleAcordeon\(btnUro, contentEl\)/.test(src), "el handler llama a la función nombrada");
      t.igual((src.match(/const abrir = panel\.style\.display === "none";/g) || []).length, 1,
        "el conmutador vive en UN solo sitio: dos copias es como se coló el bug de la v14.6.0");
    });
  },
};
