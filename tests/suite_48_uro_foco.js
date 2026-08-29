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
    // v17.16.0 — estas ya se ejercitaban en esta misma suite y NO estaban declaradas: el
    // informe de cobertura las listaba como «sin cubrir» y escondía cuáles son los huecos
    // de verdad. Un informe que subestima engaña igual que uno que exagera.
    "_vglConfirmacionGuardar", "mtrDiscrepanciasQueFrenan",
    "mtrEvaluarUroanalisis", "mtrPriorityFocus", "mtrEjesEnFalla",
    "mtrEducationFlags", "mtrAlertaTrigliceridos",
    "mtrUroGrado", "mtrUroRecuento", "_uroMayorGrado",
    "mtrDebePreguntarEmbarazo", "mtrEmbarazoEdadFertil", "mtrPreguntaEmbarazo", "_vglConfirmacionVigente",
    "mtrInsumosEmbarazo",
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

    // ===== v17.6.91 — la gestante con bacteriuria no recibía la pregunta de embarazo =====
    //
    // `mtrEvaluarUroanalisis` ya tenía bien resuelta la excepción de la norma (`embarazo &&
    // (sugestivo || bacteriuria)` → urocultivo + antibiograma), pero esa rama era
    // INALCANZABLE en el camino real: la pregunta de embarazo solo se disparaba con parciales
    // SUGESTIVOS de ITU, y una bacteriuria franca sin piuria no lo es. Además el motor
    // calculaba `bacteriuria` internamente y no la exponía, así que el llamador ni siquiera
    // podía consultarla.
    //
    // Importa porque la bacteriuria asintomática no tratada en el embarazo es factor de
    // pielonefritis y de parto pretérmino — la única excepción que la norma marca en
    // mayúsculas.
    t.caso("v17.6.91: el uroanálisis expone la bacteriuria, no solo si es sugestivo", () => {
      const soloBacterias = { bacterias: "ABUNDANTES", nitritos: "NEGATIVO", esterasa: "NEGATIVO", leucocitos: "0-2" };
      const u = api.mtrEvaluarUroanalisis(soloBacterias, null, false);
      t.falso(u.sugestivo, "bacteriuria SIN piuria no es sugestiva de ITU: eso no cambia");
      t.cierto(u.bacteriuria, "pero la bacteriuria sí se expone, que es lo que faltaba");
      const limpio = api.mtrEvaluarUroanalisis({ bacterias: "NEGATIVO", nitritos: "NEGATIVO" }, null, false);
      t.falso(limpio.bacteriuria, "y una orina limpia no la inventa");
    });

    t.caso("v17.6.91: a la mujer en edad fértil con bacteriuria SÍ se le pregunta por embarazo", () => {
      const p = (o) => api.mtrDebePreguntarEmbarazo(o);
      t.cierto(p({ sexo: "F", edad: 28, uroBacteriuria: true }),
        "bacteriuria franca basta: en embarazo se trata siempre, haya o no piuria");
      t.cierto(p({ sexo: "F", edad: 28, uroSugestivo: true }), "y el caso de siempre no se pierde");
      // Y NO se dispara de más, que sería una pregunta inútil en cada consulta.
      t.falso(p({ sexo: "F", edad: 28, uroBacteriuria: false, uroSugestivo: false }), "orina limpia: no se pregunta");
      t.falso(p({ sexo: "M", edad: 28, uroBacteriuria: true }), "a un hombre no se le pregunta");
      t.falso(p({ sexo: "F", edad: 70, uroBacteriuria: true }), "fuera de edad fértil tampoco");
      t.falso(p({ sexo: "F", edad: 28, uroBacteriuria: true, yaConfirmado: true }), "ni si ya contestó");
    });

    // Esta prueba existe por una mutación que NO caía: borrar el insumo `uroBacteriuria` del
    // cableado del Panel dejaba el banco entero en verde, porque ese armado vivía suelto
    // dentro de una función de interfaz que el banco no puede ejercitar. Se extrajo a
    // `mtrInsumosEmbarazo` justamente para poder vigilarlo.
    t.caso("v17.6.91: los insumos de la pregunta se leen del resumen, sin perder ninguno", () => {
      const res = {
        factores: { sexo: "F", edad: 28 },
        uroanalisis: { sugestivo: false, bacteriuria: true },
      };
      const ins = api.mtrInsumosEmbarazo(res, false);
      t.igual(ins.sexo, "F", "el sexo sale de los factores");
      t.igual(ins.edad, 28, "y la edad");
      t.igual(ins.uroSugestivo, false, "lo sugestivo del uroanálisis");
      t.igual(ins.uroBacteriuria, true, "y LA BACTERIURIA, que es la que faltaba");
      t.igual(ins.yaConfirmado, false, "más si ya contestó");
      // Y con esos insumos, la compuerta dice que sí: la cadena completa funciona.
      t.cierto(api.mtrDebePreguntarEmbarazo(ins), "la compuerta se dispara con lo que se le entrega");
      // Un resumen vacío no revienta ni inventa nada.
      const vacio = api.mtrInsumosEmbarazo(null, false);
      t.igual(vacio.uroBacteriuria, false, "sin resumen, no se inventa bacteriuria");
      t.falso(api.mtrDebePreguntarEmbarazo(vacio), "y no se pregunta nada");
    });

    t.caso("v17.6.91: la rama BACTERIURIA EN EMBARAZO ya es alcanzable de punta a punta", () => {
      const hallazgos = { bacterias: "ABUNDANTES", nitritos: "NEGATIVO", esterasa: "NEGATIVO", leucocitos: "0-2" };
      const ctx = {
        hoyIso: "2026-08-27", edad: 28, sexo: "F", pesoKg: 60, creatinina: 0.7,
        factores: {}, ultimos: { CREATININA: { fecha: "2026-08-01", valor: 0.7 } },
        uroHallazgos: hallazgos,
      };
      // 1. El resumen expone la bacteriuria — es de donde el llamador la lee.
      const r = api.mtrResumenClinico(ctx);
      t.cierto(r.uroanalisis.bacteriuria, "el resumen la trae");
      // 2. Con ese insumo, la pregunta se dispara (es la llamada real del Panel).
      t.cierto(api.mtrDebePreguntarEmbarazo({
        sexo: "F", edad: 28,
        uroSugestivo: !!r.uroanalisis.sugestivo,
        uroBacteriuria: !!r.uroanalisis.bacteriuria,
        yaConfirmado: false,
      }), "y la pregunta se dispara con lo que el resumen expone");
      // 3. Respondida que sí, la conducta cambia.
      const conEmb = api.mtrResumenClinico(Object.assign({}, ctx, { embarazo: true }));
      t.igual(conEmb.uroanalisis.estado, "BACTERIURIA EN EMBARAZO", "la rama se alcanza");
      t.cierto(conEmb.uroanalisis.orden.some((o) => /urocultivo/i.test(o)), "con su urocultivo");
      t.cierto(/se trata siempre/i.test(conEmb.uroanalisis.conducta), "y la conducta lo dice: " + conEmb.uroanalisis.conducta);
    });

    // ============ LA ORDEN DEL UROANÁLISIS LLEGA A LA IA (v17.6.88) ============
    //
    // `mtrEvaluarUroanalisis` calcula la orden concreta de cada estado, pero ese array NO
    // viajaba al JSON: la IA recibía solo `itu_estado` y tenía que DEDUCIR el urocultivo a
    // partir de él — justo la inferencia que el resto del prompt le prohíbe, así que o lo
    // omitía o se lo inventaba. Va en campo PROPIO y no dentro de `order_list`, que lleva
    // CLAVES de analito que sus lectores cruzan con el catálogo de CUPS.
    t.caso("v17.6.88: la orden del uroanálisis viaja al JSON que lee la IA", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 58, sexo: "F", pesoKg: 65, creatinina: 0.9,
        rac: 12, ct: 190, hdl: 50, ldl: 100, paSistolica: 130, paDiastolica: 82,
        factores: { hta: true },
        ultimos: {
          CREATININA: { fecha: "2026-08-01", valor: 0.9 },
          UROANALISIS: { fecha: "2026-08-20", valor: 1 },
        },
        uroHallazgos: { nitritos: "POSITIVO", esterasa: "++", leucocitos: "20-30" },
        uroSintomas: true,
      });
      t.igual(r.uroanalisis.estado, "PROBABLE ITU", "el vector es el que debe ser");
      const json = api.mtrJsonV68DesdeResumen(r, api.mtrHojaDesdeResumen(r));
      t.cierto(Array.isArray(json.orden_uroanalisis), "el campo existe y es una lista");
      t.cierto(json.orden_uroanalisis.some((o) => /urocultivo/i.test(o)),
        "y lleva el urocultivo: " + JSON.stringify(json.orden_uroanalisis));
      t.cierto(json.orden_uroanalisis.some((o) => /antibiograma/i.test(o)), "con su antibiograma");
      // No se contamina `order_list`, que lleva claves de analito para cruzar con los CUPS.
      t.falso(json.order_list.some((k) => /urocultivo/i.test(k)),
        "order_list sigue llevando solo claves de analito: " + JSON.stringify(json.order_list));

      // Y en la PANTALLA la orden se ve como una acción propia, no solo enterrada dentro de
      // la frase de la conducta: el médico que recorre la lista de qué pedir tiene que
      // encontrarla ahí. (Sin esta comprobación, la línea del render se puede borrar entera
      // y el banco seguiría verde — comprobado con una mutación.)
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(/Qué ordenar por este hallazgo/.test(html),
        "el recuadro enseña qué ordenar por el uroanálisis, como línea propia");
      t.cierto(/Qué ordenar por este hallazgo:[^<]*Urocultivo/.test(html),
        "y esa línea nombra el urocultivo");
    });

    t.caso("v17.6.88: sin uroanálisis evaluado no se inventa ninguna orden", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 58, sexo: "F", pesoKg: 65, creatinina: 0.9,
        factores: { hta: true }, ultimos: { CREATININA: { fecha: "2026-08-01", valor: 0.9 } },
      });
      t.igual(r.uroanalisis, null, "sin hallazgos de orina el motor no evalúa nada");
      const json = api.mtrJsonV68DesdeResumen(r, api.mtrHojaDesdeResumen(r));
      t.igual(JSON.stringify(json.orden_uroanalisis), "[]", "y el campo sale vacío, no inventado");
    });

    // v68 S4: "Orden nunca vacía". Los cinco estados tienen que decir algo — incluso el
    // negativo, donde lo que corresponde es el control de rutina, y el ambiguo, donde lo que
    // corresponde es confirmar los síntomas ANTES de pedir el urocultivo.
    t.caso("v17.6.88: los cinco estados del uroanálisis traen orden, ninguno la deja vacía", () => {
      const sugestivo = { nitritos: "POSITIVO", esterasa: "++", leucocitos: "20-30" };
      const limpio = { nitritos: "NEGATIVO", esterasa: "NEGATIVO", leucocitos: "0-2" };
      const casos = [
        ["PROBABLE ITU", sugestivo, true, false],
        ["BACTERIURIA ASINTOMÁTICA", sugestivo, false, false],
        ["REQUIERE SÍNTOMAS", sugestivo, null, false],
        ["BACTERIURIA EN EMBARAZO", sugestivo, null, true],
        ["SIN HALLAZGOS", limpio, null, false],
      ];
      casos.forEach(([esperado, hallazgos, sintomas, embarazo]) => {
        const u = api.mtrEvaluarUroanalisis(hallazgos, sintomas, embarazo);
        t.igual(u.estado, esperado, "estado esperado para el caso " + esperado);
        t.cierto(Array.isArray(u.orden) && u.orden.length > 0 && String(u.orden[0]).trim().length > 0,
          "la orden nunca queda vacía en " + esperado + ": " + JSON.stringify(u.orden));
      });
      // Y las dos que SÍ deben pedir urocultivo lo piden; las otras tres no.
      t.cierto(api.mtrEvaluarUroanalisis(sugestivo, true, false).orden.some((o) => /urocultivo/i.test(o)),
        "con síntomas se pide urocultivo");
      t.falso(api.mtrEvaluarUroanalisis(sugestivo, false, false).orden.some((o) => /^urocultivo$/i.test(o)),
        "sin síntomas NO se pide urocultivo: la norma prohíbe tratar la bacteriuria asintomática");
    });

    // ================= FOCO CLÍNICO =================

    const resumen = (over) => Object.assign({
      programa: "HTA",
      riesgo: { categoria: "alto", paso: 2 },
      meta: { falla: false },
      erc: { anr: null, sospechaIra: false, remitirNefrologia: false },
      plan: { anr: null, drivers: [] },
    }, over || {});

    t.caso("v17.6.98: un ANR activo enciende el foco RENAL — la rama que nunca se probaba", () => {
      // Hueco reportado al auditar el ANR: mtrPriorityFocus lee `plan.anr` para decidir el
      // foco «renal», pero TODOS los fixtures de esta suite usan `anr: null`, así que esa
      // rama no la ejercitaba nadie. Con la agrupación de v17.6.98 el ANR pasa a tener
      // consecuencias reales sobre la orden, y el foco que viaja al JSON de la IA con él.
      const sinAnr = api.mtrPriorityFocus(resumen({ plan: { anr: null, drivers: [] } }));
      const conAnr = api.mtrPriorityFocus(resumen({
        plan: { anr: { ventanaDias: 60, vence: "2026-10-19" }, drivers: [] },
      }));
      t.igual(conAnr, "renal", "con el agujero negro renal activo, el foco es renal");
      t.cierto(sinAnr !== "renal", "y sin él no lo es (obtuvo " + JSON.stringify(sinAnr) + "): el ANR es quien lo enciende");
    });

    t.caso("paso 4 pendiente manda: el foco es 'clasificación' por encima de todo", () => {
      const r = resumen({ riesgo: { categoria: null, paso: 4, requiereAscvd: true } });
      t.igual(api.mtrPriorityFocus(r), "clasificación", "sin clasificar, eso es lo primero");
    });

    t.caso("dos ejes en falla crítica -> 'mixto'", () => {
      const r = resumen({
        erc: { remitirNefrologia: true },  // renal
        meta: { falla: true },             // lipídico (v17.55.0: `fallaGrave` ya no existe)
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

    // v17.6.83 — auditoría v68 (S5, priority_focus). Desde v17.6.75 un RAC≥30 VENCIDO ya
    // no sale como estado "A": sale como "R" (vigilancia estrecha) con `vencidoBase`. El
    // eje renal solo miraba "A", así que el paciente cuyo problema REAL es la albuminuria
    // salía de la consulta con el foco puesto en LÍPIDOS — y ese foco viaja al JSON
    // (`priority_focus`) que lee la IA, así que la nota clínica declaraba el foco
    // equivocado justo en el paciente que v17.6.75 acababa de promover a prioritario.
    t.caso("v17.6.83: un RAC≥30 vencido (Estado R) enciende el eje renal, no solo el Estado A", () => {
      const racVencido = resumen({
        plan: { anr: null, drivers: [{ clave: "RAC", estado: "R", vencidoBase: true }] },
      });
      t.cierto(api.mtrEjesEnFalla(racVencido).renal, "RAC vencido en Estado R -> eje renal");
      t.igual(api.mtrPriorityFocus(racVencido), "renal", "y el foco de la consulta es renal");
      // Un Estado R que todavía NO ha vencido es vigilancia estrecha, no falla: si esto
      // encendiera el eje, TODO paciente con albuminuria tendría foco renal permanente.
      const racVigente = resumen({
        plan: { anr: null, drivers: [{ clave: "RAC", estado: "R", vencidoBase: false }] },
      });
      t.falso(api.mtrEjesEnFalla(racVigente).renal, "un RAC en R pero VIGENTE no es falla");
    });

    // v17.6.84 — el eje metabólico solo miraba el ESTADO del driver (ausente/vencido), nunca
    // la FALLA TERAPÉUTICA — al contrario que el lipídico, que sí cuenta `meta.falla`. Con la
    // glicemia recién incorporada como tercer eje de falla, un diabético con la glicemia en
    // 260 y TODOS sus laboratorios frescos disparaba la falla pero no el foco: el eje habría
    // nacido medio cableado. Se comprueba contra mtrEjesEnFalla directamente y no a través
    // del foco, porque en un diabético el programa rector ya devuelve "metabólico" por su
    // cuenta y la aserción pasaría igual con el código roto.
    t.caso("v17.6.84: la falla terapéutica de glicemia/HbA1c enciende el eje metabólico aunque el driver esté vigente", () => {
      const driversVigentes = [{ clave: "GLUCOSA", estado: "D" }, { clave: "HBA1C", estado: "D" }];
      const conGlicemia = resumen({
        plan: { anr: null, drivers: driversVigentes },
        fallas: { fallas: [{ analito: "Glicemia", gravedad: "grave" }] },
      });
      t.cierto(api.mtrEjesEnFalla(conGlicemia).metabolico, "glicemia en falla -> eje metabólico");
      const conHba1c = resumen({
        plan: { anr: null, drivers: driversVigentes },
        fallas: { fallas: [{ analito: "HbA1c", gravedad: "leve" }] },
      });
      t.cierto(api.mtrEjesEnFalla(conHba1c).metabolico, "HbA1c en falla -> eje metabólico");
      const sinFalla = resumen({
        plan: { anr: null, drivers: driversVigentes },
        fallas: { fallas: [] },
      });
      t.falso(api.mtrEjesEnFalla(sinFalla).metabolico,
        "con los drivers vigentes y sin falla, el eje sigue apagado");
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

    // v17.6.83 — auditoría v68 (S5, education_flags). `alarmas` solo miraba
    // `meta.falla`/`meta.fallaGrave`, que son del eje LIPÍDICO exclusivamente. Un
    // diabético con HbA1c en 11% (falla GRAVE del eje metabólico) y el LDL en meta se iba
    // de la consulta con la hoja educativa impresa SIN la sección de signos de alarma.
    t.caso("v17.6.83: la falla de CUALQUIER eje enciende las alarmas, no solo la de lípidos", () => {
      const base = { riesgo: { categoria: "alto" }, meta: { falla: false }, programa: "DM2" };
      t.cierto(api.mtrEducationFlags(Object.assign({}, base, { fallas: { hayGrave: true, hayLeve: false } })).alarmas,
        "HbA1c en falla grave con el LDL en meta -> alarmas");
      t.cierto(api.mtrEducationFlags(Object.assign({}, base, { fallas: { hayGrave: false, hayLeve: true } })).alarmas,
        "una falla leve también es FALLA para v68 — educar de más es inocuo, omitir no");
      t.falso(api.mtrEducationFlags(Object.assign({}, base, { fallas: { hayGrave: false, hayLeve: false } })).alarmas,
        "sin falla en ningún eje, no se encienden");
    });

    // La invariante que de verdad importa: la hoja educativa que se IMPRIME y el JSON que
    // lee la IA salen del mismo resumen y no pueden contradecirse. Antes de v17.6.83 cada
    // uno tenía su propia fórmula y sobre este mismo paciente decían cosas opuestas.
    t.caso("v17.6.83: la hoja impresa y el JSON de la IA nunca discrepan en 'alarmas'", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-26",
        edad: 55, sexo: "M", pesoKg: 80, creatinina: 0.9,
        rac: 10, ct: 150, hdl: 50, ldl: 60, paSistolica: 125, paDiastolica: 78,
        factores: { hta: false, diabetes: true },
        ultimos: {
          CREATININA:       { fecha: "2026-08-01", valor: 0.9 },
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 150 },
          COLESTEROL_HDL:   { fecha: "2026-08-01", valor: 50 },
          COLESTEROL_LDL:   { fecha: "2026-08-01", valor: 60 },
          TRIGLICERIDOS:    { fecha: "2026-08-01", valor: 110 },
          GLUCOSA:          { fecha: "2026-08-01", valor: 210 },
          HBA1C:            { fecha: "2026-08-01", valor: 11 },
          RAC:              { fecha: "2026-08-01", valor: 10 },
        },
        ldl: 60, hba1c: 11,
      });
      // v17.55.0 — esta HbA1c de 11 % era «grave» por el escalón del 30 % (corte 9,1), que la
      // D10 retiró: con función renal normal ya no cumple la única vía que queda (riesgo alto
      // + TFG<45 + edad<75), así que es LEVE. Lo que esta prueba defiende no cambia: que la
      // hoja impresa y el JSON de la IA no discrepen. `hayFalla` mira las dos, grave y leve.
      t.cierto(r.fallas && r.fallas.hayLeve, "el vector es el que debe ser: HbA1c del eje metabólico en falla");
      t.falso(!!(r.fallas && r.fallas.hayGrave), "y NO grave: su función renal está bien");
      t.falso(!!(r.meta && r.meta.falla), "y el LDL SÍ está en meta");
      const json = api.mtrJsonV68DesdeResumen(r, api.mtrHojaDesdeResumen(r));
      t.igual(!!json.education_flags.alarmas, !!r.educationFlags.alarmas,
        "hoja impresa y JSON de la IA dicen lo mismo");
      t.cierto(r.educationFlags.alarmas, "y con una falla grave, lo que dicen es que SÍ");
      t.cierto(api.mtrEducacionFlagsTexto(r.educationFlags).indexOf("reforzar signos de alarma") >= 0,
        "la hoja que se le entrega al paciente lleva los signos de alarma");

      // El caso que de verdad separa las dos fórmulas viejas: una falla LEVE. La del JSON
      // solo miraba `hayGrave`, así que aquí habría dicho `false` mientras la hoja decía
      // `true`. Con una falla grave las dos coincidían por casualidad y la divergencia
      // pasaba inadvertida — por eso este vector, y no el de arriba, es el que vigila que
      // nadie vuelva a meter una segunda fórmula en el JSON.
      const leve = api.mtrResumenClinico({
        hoyIso: "2026-08-26",
        edad: 55, sexo: "M", pesoKg: 80, creatinina: 0.9,
        rac: 10, ct: 150, hdl: 50, ldl: 60, paSistolica: 125, paDiastolica: 78,
        factores: { hta: false, diabetes: true },
        ultimos: {
          CREATININA:       { fecha: "2026-08-01", valor: 0.9 },
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 150 },
          COLESTEROL_HDL:   { fecha: "2026-08-01", valor: 50 },
          COLESTEROL_LDL:   { fecha: "2026-08-01", valor: 60 },
          TRIGLICERIDOS:    { fecha: "2026-08-01", valor: 110 },
          GLUCOSA:          { fecha: "2026-08-01", valor: 150 },
          HBA1C:            { fecha: "2026-08-01", valor: 8.5 },   // >7.0+15%, por debajo de +30%
          RAC:              { fecha: "2026-08-01", valor: 10 },
        },
        ldl: 60, hba1c: 8.5,
      });
      t.cierto(leve.fallas && leve.fallas.hayLeve && !leve.fallas.hayGrave,
        "el vector es el que debe ser: falla LEVE, no grave");
      t.falso(leve.riesgo.categoria === "muy alto", "y el riesgo no es 'muy alto'");
      const jsonLeve = api.mtrJsonV68DesdeResumen(leve, api.mtrHojaDesdeResumen(leve));
      t.igual(!!jsonLeve.education_flags.alarmas, !!leve.educationFlags.alarmas,
        "con falla LEVE, hoja y JSON siguen diciendo lo mismo");
      t.cierto(leve.educationFlags.alarmas, "y una falla leve también es FALLA para v68");
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
