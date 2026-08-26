// =====================================================================
//  SUITE 56 — Hoja de hechos DESIDENTIFICADA (la barrera de PHI hacia Gemini)
//
//  Esta es la suite más importante del módulo de IA: fija que lo que sale hacia
//  un tercero (Gemini) no puede llevar identificadores del paciente. El enfoque
//  es lista blanca — la hoja se construye copiando SOLO campos clínicos elegidos
//  a mano — así que la prueba saltea identificadores por todos lados y exige que
//  NINGUNO aparezca ni en la hoja ni en su texto aplanado.
// =====================================================================

// Un resumen realista con IDENTIFICADORES SALTEADOS en cada rincón donde un
// descuido podría colarlos. Ninguno está en la lista blanca -> ninguno debe salir.
function resumenConPhi() {
  return {
    programa: "HTA",
    // factores trae, además de lo clínico, basura identificable (como si un lector
    // futuro la metiera por error): debe caer toda.
    factores: {
      edad: 61, sexo: "F", diabetes: true, hta: true, tabaquismo: true, imc: 31.2,
      paSistolica: 148, paDiastolica: 90, ecvEstablecida: false,
      nombre: "MARIA FERNANDA QUINTERO", primerApellido: "QUINTERO",
      identificacion: "52123456", cedula: "52123456", fechaNacimiento: "1965-03-12",
      telefono: "3151234567", correo: "maria.q@gmail.com", direccion: "CALLE 45 # 12-30",
      acompanante: "JOSE QUINTERO", medicoTratante: "DR. HENAO",
    },
    erc: { egfr: 52.3, crcl: 48.1, estadioAdministrativo: "G3a", estadioClinico: "G3a", remitirNefrologia: false, sospechaIra: false },
    riesgo: { categoria: "alto", paso: 3 },
    meta: { metas: { ldl: 70, cnoHdl: 100 } },
    framingham: { puntos: 16 },
    foco: "control de LDL fuera de meta",
    // v17.6.0 — mtrEducationFlags() SIEMPRE devuelve un objeto {alarmas,dieta,actividad},
    // nunca un array: este fixture traía la forma equivocada (arreglo de frases) y por
    // eso el defecto de mtrHojaDeHechos/mtrJsonV68DesdeResumen (Array.isArray sobre un
    // objeto, siempre falso) no se veía desde aquí — la prueba nueva de abajo sí lo cubre.
    educationFlags: { alarmas: true, dieta: true, actividad: false },
    plan: { faltantes: [{ clave: "RAC" }], vencidos: [{ clave: "HBA1C" }] },
  };
}

const IDENTIFICADORES = [
  "MARIA", "FERNANDA", "QUINTERO", "52123456", "1965-03-12", "1965",
  "3151234567", "maria.q@gmail.com", "CALLE 45", "JOSE", "HENAO",
];

module.exports = {
  nombre: "Hoja de hechos desidentificada (barrera de PHI hacia la IA)",
  cubre: ["mtrHojaDeHechos", "mtrHojaDeHechosTexto", "mtrRelativizarFecha", "mtrSanearTextoLibreAI", "mtrEducacionFlagsTexto"],

  pruebas(t, api) {
    const opts = {
      hoyIso: "2026-08-17",
      medicamentos: ["LOSARTAN 50 MG (TABLETA)", "ATORVASTATINA 40 MG (TABLETA)"],
      ultimos: {
        LDL: { valor: 118, fecha: "2026-06-10" },
        HBA1C: { valor: 8.2, fecha: "2026-02-01" },
      },
      dxActivos: ["I10X Hipertensión esencial", "E119 Diabetes mellitus tipo 2"],
    };

    t.caso("NINGÚN identificador salteado aparece en la hoja ni en su texto", () => {
      const hoja = api.mtrHojaDeHechos(resumenConPhi(), opts);
      const blob = JSON.stringify(hoja) + "\n" + api.mtrHojaDeHechosTexto(hoja);
      for (const id of IDENTIFICADORES) {
        t.cierto(blob.toUpperCase().indexOf(id.toUpperCase()) < 0,
          "el identificador '" + id + "' JAMÁS debe salir hacia la IA");
      }
    });

    t.caso("la lista blanca sí conserva lo CLÍNICO (si no, la nota saldría vacía)", () => {
      const hoja = api.mtrHojaDeHechos(resumenConPhi(), opts);
      t.igual(hoja.demografia.edad, 61, "edad (no es identificador)");
      t.igual(hoja.demografia.sexo, "F", "sexo");
      t.igual(hoja.programa, "HTA", "programa");
      t.cierto(hoja.factores.diabetes && hoja.factores.hta && hoja.factores.tabaquismo, "factores clínicos");
      t.igual(hoja.factores.nombre, undefined, "pero NADA fuera de la lista blanca");
      t.igual(hoja.renal.tfgCkdepi, 52.3, "TFG");
      t.igual(hoja.riesgo.categoria, "alto", "riesgo");
      t.igual(hoja.riesgo.framinghamPuntos, 16, "framingham");
      t.igual(hoja.metaLdl, 70, "meta LDL");
      t.igual(hoja.medicamentos.length, 2, "medicamentos (moléculas, no PHI)");
      t.igual(hoja.labs.length, 2, "labs");
    });

    // =====================================================================
    // v17.6.1 — Estas cuatro son las claves REALES que sí escribe el resto del
    // archivo (mtrLeerFactoresRcvDelDom, mtrLeerFactoresRCV): antes de esta prueba,
    // MTR_HECHOS_FACTORES nunca se había verificado de punta a punta con las cuatro
    // encendidas a la vez. Un comentario anterior junto a MTR_HECHOS_FACTORES
    // atribuía esto a un arreglo de "v16.7.0 — Auditoría #14" que, verificado, no
    // existe (ver el comentario allá). Esta prueba deja el hecho comprobado en vez
    // de dado por sentado.
    // =====================================================================
    t.caso("mtrHojaDeHechos: dislipidemia, ECV establecida, HxFam de ECV prematura y ERC SÍ llegan a la hoja cuando están documentadas", () => {
      const r = resumenConPhi();
      r.factores.dislipidemiaDocumentada = true;
      r.factores.ecvAterescleroticaEstablecida = true;
      r.factores.hxfamEcvPrematura = true;
      r.factores.enfermedadRenalDocumentada = true;
      const hoja = api.mtrHojaDeHechos(r, opts);
      t.cierto(hoja.factores.dislipidemiaDocumentada, "dislipidemia documentada llega");
      t.cierto(hoja.factores.ecvAterescleroticaEstablecida, "ECV aterosclerótica establecida llega");
      t.cierto(hoja.factores.hxfamEcvPrematura, "antecedente familiar de ECV prematura llega");
      t.cierto(hoja.factores.enfermedadRenalDocumentada, "enfermedad renal documentada llega");
    });

    t.caso("mtrHojaDeHechos: las claves viejas retiradas (dislipidemia, ecvEstablecida, antecedenteFamiliarPrematuro, ercPrevia) NUNCA salen, aunque vengan encendidas", () => {
      const r = resumenConPhi();
      r.factores.dislipidemia = true;
      r.factores.ecvEstablecida = true;
      r.factores.antecedenteFamiliarPrematuro = true;
      r.factores.ercPrevia = true;
      const hoja = api.mtrHojaDeHechos(r, opts);
      t.igual(hoja.factores.dislipidemia, undefined, "clave vieja retirada: no sale");
      t.igual(hoja.factores.ecvEstablecida, undefined, "clave vieja retirada: no sale");
      t.igual(hoja.factores.antecedenteFamiliarPrematuro, undefined, "clave vieja retirada: no sale");
      t.igual(hoja.factores.ercPrevia, undefined, "clave vieja retirada: no sale");
    });

    // =====================================================================
    // v17.6.0 — «Educación indicada» NUNCA llegaba a la hoja que lee la IA: leía
    // Array.isArray(r.educationFlags), y mtrEducationFlags() siempre devuelve un
    // OBJETO ({alarmas,dieta,actividad}), así que esa comprobación era falsa desde
    // que existe. La señal de reforzar dieta/actividad/signos de alarma se perdía
    // en silencio, exactamente en el paciente que más la necesitaba.
    // =====================================================================
    t.caso("mtrHojaDeHechos: 'Educación indicada' ahora sí llega a la hoja (antes: Array.isArray sobre un objeto, siempre falso)", () => {
      const hoja = api.mtrHojaDeHechos(resumenConPhi(), opts);
      t.igual(hoja.educacion.length, 2, "alarmas y dieta encendidas en el fixture -> 2 items, no 0");
      t.cierto(hoja.educacion.indexOf("reforzar signos de alarma") >= 0, "la de alarmas");
      t.cierto(hoja.educacion.indexOf("orientación dietaria") >= 0, "la de dieta");
      t.falso(hoja.educacion.indexOf("actividad física") >= 0, "actividad estaba apagada en el fixture, no debe aparecer");
    });

    t.caso("mtrEducacionFlagsTexto: nunca lanza, y trata cualquier forma que no sea el objeto esperado como 'nada encendido'", () => {
      const f = api.mtrEducacionFlagsTexto;
      t.igual(f({ alarmas: false, dieta: false, actividad: false }).length, 0, "objeto con todo apagado -> nada");
      t.igual(f({}).length, 0, "objeto vacío -> nada, no lanza");
      t.igual(f(null).length, 0, "null -> nada, no lanza");
      t.igual(f(undefined).length, 0, "undefined -> nada, no lanza");
      t.igual(f(["adherencia a estatina"]).length, 0, "la forma vieja (arreglo) ya no ocurre en la práctica, pero si llegara no debe lanzar ni inventar texto");
      t.igual(f({ alarmas: true, dieta: true, actividad: true }).length, 3, "las tres encendidas -> 3 items");
    });

    t.caso("las FECHAS de laboratorio se relativizan (no viajan fechas absolutas)", () => {
      const hoja = api.mtrHojaDeHechos(resumenConPhi(), opts);
      const texto = api.mtrHojaDeHechosTexto(hoja);
      t.cierto(texto.indexOf("2026-06-10") < 0 && texto.indexOf("2026-02-01") < 0, "ninguna fecha absoluta");
      const ldl = hoja.labs.find((x) => x.analito === "LDL");
      t.cierto(/hace ~2 mes/.test(ldl.hace), "el LDL de junio queda como 'hace ~2 meses' (desde 17-ago)");
    });

    t.caso("mtrRelativizarFecha: bandas correctas y a prueba de basura", () => {
      t.igual(api.mtrRelativizarFecha("2026-08-16", "2026-08-17"), "reciente", "1 día");
      t.igual(api.mtrRelativizarFecha("2026-08-01", "2026-08-17"), "hace ~2 semanas", "16 días");
      t.igual(api.mtrRelativizarFecha("2026-05-17", "2026-08-17"), "hace ~3 meses", "92 días");
      t.igual(api.mtrRelativizarFecha("2023-08-17", "2026-08-17"), "hace ~3 año(s)", "3 años");
      t.igual(api.mtrRelativizarFecha(null, "2026-08-17"), null, "sin fecha, null");
      t.igual(api.mtrRelativizarFecha("no-fecha", "2026-08-17"), null, "basura, null");
      t.igual(api.mtrRelativizarFecha("2026-09-01", "2026-08-17"), null, "futuro, null (no se inventa)");
    });

    t.caso("un free-text incluido pasa igual por scrubPII (defensa en profundidad)", () => {
      // Si el foco trajera un correo (no debería, pero por si acaso), se censura.
      const r = resumenConPhi(); r.foco = "coordinar con paciente@correo.com el control";
      const hoja = api.mtrHojaDeHechos(r, opts);
      t.cierto(String(hoja.foco).indexOf("paciente@correo.com") < 0, "el correo se censura aunque venga en un campo clínico");
    });

    t.caso("sin datos, hoja mínima sin lanzar (no inventa)", () => {
      const hoja = api.mtrHojaDeHechos({}, {});
      t.igual(hoja.demografia.edad, null, "edad null");
      t.igual(hoja.labs.length, 0, "sin labs");
      t.igual(hoja.medicamentos.length, 0, "sin meds");
      t.igual(api.mtrHojaDeHechosTexto(hoja), "", "texto vacío, no una plantilla inventada");
      t.igual(api.mtrHojaDeHechos(null, null).programa, null, "nulo no lanza");
    });

    // =====================================================================
    // v15.2.0 — BARRERA DE NOMBRES HACIA GEMINI. Dos fugas reales, medidas:
    //   · el honorifico se escribia a mano ("[Pp]aciente"), asi que "PACIENTE Maria
    //     Rodriguez" NO se censuraba — y la historia de Everest se escribe en mayusculas.
    //   · exigia un espacio justo detras, asi que "Acompañante: Jose Perez" tampoco.
    // Las dos direcciones importan igual: dejar pasar un nombre es una fuga de datos de
    // paciente hacia un servicio externo; censurar de mas destroza el borrador clinico.
    // =====================================================================
    t.caso("mtrSanearTextoLibreAI: censura el nombre con el honorifico en MAYUSCULAS (la historia de Everest se escribe asi)", () => {
      const f = api.mtrSanearTextoLibreAI;
      t.cierto(f("PACIENTE Maria Rodriguez refiere cefalea.").includes("[NOMBRE_CENSURADO]"), "PACIENTE en mayusculas");
      t.cierto(f("SEÑORA Ana Gomez, control.").includes("[NOMBRE_CENSURADO]"), "SEÑORA en mayusculas");
      t.falso(/Maria|Rodriguez|Ana|Gomez/.test(f("PACIENTE Maria Rodriguez y SEÑORA Ana Gomez.")), "no queda ni un apellido suelto");
    });

    t.caso("mtrSanearTextoLibreAI: censura tambien con dos puntos o coma detras del honorifico", () => {
      const f = api.mtrSanearTextoLibreAI;
      t.cierto(f("Acompañante: Jose Perez asiste.").includes("[NOMBRE_CENSURADO]"), "con dos puntos");
      t.cierto(f("Sr. Carlos Gomez asiste a control.").includes("[NOMBRE_CENSURADO]"), "con el punto de la abreviatura");
      t.falso(/Jose|Perez|Carlos|Gomez/.test(f("Acompañante: Jose Perez. Sr. Carlos Gomez.")));
    });

    t.caso("mtrSanearTextoLibreAI: NO se come contenido clinico (censurar de mas destroza el borrador)", () => {
      const f = api.mtrSanearTextoLibreAI;
      const clinicas = [
        "PACIENTE HIPERTENSO EN CONTROL PERIODICO.",
        "PACIENTE DIABETICO TIPO 2 CON BUENA ADHERENCIA.",
        "PACIENTE OBESO, IMC 32.",
        "PACIENTE ESTABLE HEMODINAMICAMENTE.",
        "MADRE DIABETICA, PADRE HIPERTENSO.",
        "PACIENTE ADULTO MAYOR, VIVE SOLO.",
        "El paciente refiere disnea de medianos esfuerzos.",
        "Paciente asintomatico, niega dolor toracico.",
      ];
      const rotas = clinicas.filter((x) => f(x).includes("[NOMBRE_CENSURADO]"));
      t.igual(rotas, [], "ninguna frase clinica sin nombre puede salir censurada; salieron: " + rotas.join(" | "));
    });

    t.caso("mtrSanearTextoLibreAI: LIMITE CONOCIDO — con la nota entera en mayusculas el nombre NO se distingue de una palabra clinica", () => {
      // Constancia deliberada, no un descuido: "MARIA" y "HIPERTENSO" son la misma forma
      // para una expresion regular. Se probo acotarlo con una lista de palabras clinicas y
      // censuraba de mas en 6 de cada 8 frases reales. La solucion correcta es de diseño:
      // pasarle a esta funcion el NOMBRE REAL del paciente abierto (el script ya lo lee del
      // DOM) y retirar ese nombre concreto. Esta prueba fija el estado de HOY para que el
      // dia que se implemente, se ponga roja y obligue a actualizarla a conciencia.
      const f = api.mtrSanearTextoLibreAI;
      const r = f("PACIENTE MARIA RODRIGUEZ REFIERE CEFALEA DE 3 DIAS.");
      t.falso(r.includes("[NOMBRE_CENSURADO]"),
        "hoy NO se censura este caso; si esta prueba se pone roja es porque alguien lo resolvio — revisar y actualizar el limite documentado");
    });
  },
};
