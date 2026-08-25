// Subsistema: normalización de texto y datos del paciente.
// Aquí vive el cruce de cédulas contra el PyM: un fallo silencioso en
// normalizeKey deja a pacientes sin sus actividades pendientes.
module.exports = {
  nombre: "Texto y datos del paciente",
  cubre: ["limpio", "normalizeKey", "extractDoc", "isPending", "esSi", "stripAccents",
    "friendly", "activityLabel", "isExcludedActivity", "detalleTipoCervix", "escapeHtml",
    "csvCell", "clampNum", "unescXml", "colToIdx", "normName", "nameHasToken",
    "sanitizePII", "debounceVgl", "fuzzyMatch", "mtrTextoOpinaSobre"],

  pruebas(t, api) {
    // ---------- limpio ----------
    t.caso("limpio colapsa espacios y recorta", () => {
      t.igual(api.limpio("  Juan   Pérez \n"), "Juan Pérez");
      t.igual(api.limpio(null), "");
      t.igual(api.limpio(undefined), "");
    });

    // ---------- normalizeKey: el cruce con el PyM depende de esto ----------
    t.caso("normalizeKey quita ceros a la izquierda", () => {
      t.igual(api.normalizeKey("0005150076"), "5150076");
      t.igual(api.normalizeKey("5150076"), "5150076");
    });
    t.caso("normalizeKey resuelve la notación científica de Excel", () => {
      t.igual(api.normalizeKey("1.23457E+9"), "1234570000");
      t.igual(api.normalizeKey("4.3040508E+7"), "43040508");
    });
    t.caso("normalizeKey descarta el sufijo .0 de Excel", () => {
      t.igual(api.normalizeKey("43040508.0"), "43040508");
    });
    t.caso("normalizeKey deja solo dígitos", () => {
      t.igual(api.normalizeKey("CC 43.040.508"), "43040508");
      t.igual(api.normalizeKey(" 43-040-508 "), "43040508");
    });
    t.caso("normalizeKey tolera vacíos sin lanzar", () => {
      t.igual(api.normalizeKey(null), "");
      t.igual(api.normalizeKey(undefined), "");
      t.igual(api.normalizeKey(""), "");
      t.igual(api.normalizeKey("sin dígitos"), "");
    });
    t.caso("normalizeKey: un cero solo no se convierte en vacío", () => {
      t.igual(api.normalizeKey("0"), "0");
    });

    // ---------- extractDoc: saca la cédula del texto de la tarjeta ----------
    t.caso("extractDoc lee cédulas reales de la agenda", () => {
      t.igual(api.extractDoc("43040508"), "43040508");
      t.igual(api.extractDoc("43.040.508"), "43040508");
      t.igual(api.extractDoc("43040508, 66 años"), "43040508");
      t.igual(api.extractDoc("CC 8396613"), "8396613");
    });
    t.caso("extractDoc devuelve vacío cuando no hay cédula", () => {
      t.igual(api.extractDoc(""), "");
      t.igual(api.extractDoc(null), "");
      t.igual(api.extractDoc("MARIA LUZ DARY"), "");
      t.igual(api.extractDoc("1234"), "", "4 dígitos no es una cédula");
    });

    // ---------- isPending: decide qué actividad de PyM está pendiente ----------
    t.caso("isPending reconoce los estados pendientes de la base", () => {
      t.cierto(api.isPending("Susceptible"));
      t.cierto(api.isPending("SUSCEPTIBLE"));
      t.cierto(api.isPending(" pendiente "));
      t.cierto(api.isPending("Tamizar con CCU"));
      t.cierto(api.isPending("tamizar con VPH"));
    });
    t.caso("isPending no marca lo que no está pendiente", () => {
      t.falso(api.isPending(""));
      t.falso(api.isPending(null));
      t.falso(api.isPending(undefined));
      t.falso(api.isPending("No aplica"));
      t.falso(api.isPending("2026-01-15"));
      t.falso(api.isPending("x".repeat(40)), "un texto largo se descarta por coste");
    });

    // ---------- esSi: abandono del programa cardiovascular ----------
    t.caso("esSi solo acepta sí exacto", () => {
      t.cierto(api.esSi("Si"));
      t.cierto(api.esSi("SÍ"));
      t.cierto(api.esSi(" si "));
    });
    t.caso("esSi no confunde 'Sin dato' con un sí", () => {
      t.falso(api.esSi("Sin dato"), "empieza por 'si' pero NO es un sí");
      t.falso(api.esSi("No"));
      t.falso(api.esSi(""));
      t.falso(api.esSi(null));
    });

    // ---------- stripAccents ----------
    t.caso("stripAccents normaliza tildes y eñes", () => {
      t.igual(api.stripAccents("Relación Albúmina"), "Relacion Albumina");
      t.igual(api.stripAccents("MUÑOZ"), "MUNOZ");
      t.igual(api.stripAccents(""), "");
      t.igual(api.stripAccents(null), "");
    });

    // ---------- friendly / activityLabel ----------
    t.caso("friendly traduce los encabezados conocidos", () => {
      t.igual(api.friendly("TAMIZACION_VIH"), "VIH");
      t.igual(api.friendly("VALORACION_INTEGRAL"), "Valoración integral de salud");
    });
    t.caso("friendly respeta lo que ya viene escrito como texto", () => {
      t.igual(api.friendly("Última tamización CMB"), "Última tamización CMB");
    });
    t.caso("friendly arregla los encabezados en mayúsculas", () => {
      t.igual(api.friendly("OTRA_COSA_RARA"), "Otra cosa rara");
    });
    t.caso("activityLabel añade el detalle cuando lo hay", () => {
      t.igual(api.activityLabel("TAMIZACION_VIH", "Susceptible"), "VIH");
      t.igual(api.activityLabel("TAMIZACION_CERVIX", "Tamizar con CCU"), "Cáncer de cuello uterino — Tamizar con CCU");
    });

    // ---------- isExcludedActivity: VIH nunca se oculta ----------
    t.caso("isExcludedActivity oculta las metas ya cumplidas", () => {
      t.cierto(api.isExcludedActivity("TAMIZACION_VDRL", "Tamización de Sífilis"));
      t.cierto(api.isExcludedActivity("TAMIZACION_HEPC", "Tamización de Hepatitis C"));
    });
    t.caso("isExcludedActivity NUNCA oculta el VIH", () => {
      t.falso(api.isExcludedActivity("TAMIZACION_VIH", "VIH"));
      t.falso(api.isExcludedActivity("Último VIH", "VIH"));
    });

    // ---------- detalleTipoCervix ----------
    t.caso("detalleTipoCervix distingue VPH de citología", () => {
      t.igual(api.detalleTipoCervix("Tamizar con VPH"), "VPH");
      t.igual(api.detalleTipoCervix("Tamizar con CCU"), "citología cervicouterina");
      t.igual(api.detalleTipoCervix("citologia"), "citología cervicouterina");
    });
    t.caso("detalleTipoCervix devuelve el valor tal cual si no lo reconoce", () => {
      t.igual(api.detalleTipoCervix("Otra prueba"), "Otra prueba");
      t.igual(api.detalleTipoCervix(""), "");
    });

    // ---------- escapeHtml: los nombres van al DOM sin escapar ----------
    t.caso("escapeHtml neutraliza los seis caracteres peligrosos", () => {
      t.igual(api.escapeHtml("<b>"), "&lt;b&gt;");
      t.igual(api.escapeHtml('a"b'), "a&quot;b");
      t.igual(api.escapeHtml("a'b"), "a&#039;b");
      t.igual(api.escapeHtml("a`b"), "a&#x60;b");
      t.igual(api.escapeHtml("a&b"), "a&amp;b");
    });
    t.caso("escapeHtml impide inyectar una etiqueta desde un nombre", () => {
      const malo = '"><img src=x onerror=alert(1)>';
      const salida = api.escapeHtml(malo);
      t.falso(salida.includes("<img"), "no debe quedar una etiqueta viva");
      t.falso(salida.includes('">'), "no debe poder cerrar el atributo");
    });
    t.caso("escapeHtml tolera nulos", () => {
      t.igual(api.escapeHtml(null), "");
      t.igual(api.escapeHtml(undefined), "");
    });

    // ---------- csvCell: el reporte de auditoría ----------
    t.caso("csvCell entrecomilla lo que rompería el CSV", () => {
      t.igual(api.csvCell("hola"), "hola");
      t.igual(api.csvCell("a;b"), '"a;b"');
      t.igual(api.csvCell('di "hola"'), '"di ""hola"""');
      t.igual(api.csvCell("línea\nnueva"), '"línea\nnueva"');
      t.igual(api.csvCell(null), "");
    });

    // ---------- clampNum ----------
    t.caso("clampNum acota dentro del rango", () => {
      t.igual(api.clampNum("5", 2, 120, 10), 5);
      t.igual(api.clampNum("1", 2, 120, 10), 2, "por debajo del mínimo");
      t.igual(api.clampNum("999", 2, 120, 10), 120, "por encima del máximo");
    });
    t.caso("clampNum usa el valor por defecto si no es número", () => {
      t.igual(api.clampNum("abc", 2, 120, 10), 10);
      t.igual(api.clampNum(null, 2, 120, 10), 10);
      t.igual(api.clampNum("", 2, 120, 10), 10);
    });

    // ---------- unescXml / colToIdx: lectura del Excel ----------
    t.caso("unescXml decodifica las entidades del Excel", () => {
      t.igual(api.unescXml("a&amp;b"), "a&b");
      t.igual(api.unescXml("&lt;x&gt;"), "<x>");
      t.igual(api.unescXml("&#65;"), "A");
      t.igual(api.unescXml("&#x41;"), "A");
      t.igual(api.unescXml("sin entidades"), "sin entidades");
    });
    t.caso("unescXml resuelve &amp; en último lugar", () => {
      t.igual(api.unescXml("&amp;lt;"), "&lt;", "no debe convertirse en '<'");
    });
    t.caso("colToIdx traduce la letra de columna a índice", () => {
      t.igual(api.colToIdx("A1"), 0);
      t.igual(api.colToIdx("B2"), 1);
      t.igual(api.colToIdx("Z1"), 25);
      t.igual(api.colToIdx("AA1"), 26);
      t.igual(api.colToIdx("BC7"), 54);
      t.igual(api.colToIdx(""), -1);
    });

    // ---------- normName / nameHasToken: detección del PyM del día ----------
    t.caso("normName deja el nombre comparable", () => {
      t.igual(api.normName("Agenda_Dia_CMB 2026-08-10.xlsx"), "agendadiacmb20260810xlsx");
    });
    t.caso("nameHasToken no acepta el token pegado a otro número", () => {
      t.cierto(api.nameHasToken("agenda6deagosto", "6deagosto"));
      t.falso(api.nameHasToken("agenda26deagosto", "6deagosto"), "el 6 es la cola del 26");
    });

    // ---------- sanitizePII: la bitácora no debe llevar cédulas ----------
    t.caso("sanitizePII censura los números largos", () => {
      t.igual(api.sanitizePII("paciente 43040508 llegó"), "paciente [CENSURADO] llegó");
      t.igual(api.sanitizePII("turno 4335825"), "turno [CENSURADO]");
    });
    t.caso("sanitizePII no toca los números cortos", () => {
      t.igual(api.sanitizePII("son 12 citas"), "son 12 citas");
      t.igual(api.sanitizePII(""), "");
      t.igual(api.sanitizePII(null), null);
    });

    // ---------- debounceVgl ----------
    t.caso("debounceVgl devuelve una función", () => {
      const f = api.debounceVgl(() => {}, 10);
      t.igual(typeof f, "function");
      t.noLanza(() => f(), "invocarla no debe lanzar");
    });

    // ---------- fuzzyMatch: buscador de pacientes ----------
    t.caso("fuzzyMatch encuentra por subcadena", () => {
      t.cierto(api.fuzzyMatch("uribe", "MARIA LUZ DARY URIBE TORRES"));
      t.cierto(api.fuzzyMatch("maria uribe", "MARIA LUZ DARY URIBE TORRES"));
    });
    t.caso("fuzzyMatch tolera erratas en palabras largas", () => {
      t.cierto(api.fuzzyMatch("uribbe", "MARIA LUZ DARY URIBE TORRES"), "una letra de más");
      t.cierto(api.fuzzyMatch("palencai", "BRANDON JESUS PALENCIA MARTINEZ"), "transposición");
    });
    t.caso("fuzzyMatch no tolera erratas en palabras muy cortas", () => {
      t.falso(api.fuzzyMatch("xyz", "MARIA LUZ DARY URIBE TORRES"));
    });
    t.caso("fuzzyMatch ignora acentos", () => {
      t.cierto(api.fuzzyMatch("muñoz", "MARIA EDINETH PINO MUNOZ"));
      t.cierto(api.fuzzyMatch("munoz", "MARIA EDINETH PINO MUÑOZ"));
    });
    t.caso("fuzzyMatch exige que TODAS las palabras casen", () => {
      t.falso(api.fuzzyMatch("uribe inexistente", "MARIA LUZ DARY URIBE TORRES"));
    });

    // ---------- mtrTextoOpinaSobre ----------
    // v17.6.30 — AUDITORÍA S+ (barrido total, 24-ago-2026): la negación "no + verbo"
    // simple ("no fuma", "no es diabético") no calzaba con ninguna frase de la lista de
    // negaciones (niega/no refiere/sin antecedente/descarta/no presenta/no tiene/nunca
    // ha), así que el texto libre que NIEGA un hecho terminaba usándose como fuente que
    // lo AFIRMA — justo lo opuesto de lo que decía.
    const RE_FUMA = /\bfumador|tabaquism|\bfuma\b/i;
    const RE_HTA = /\bhta\b|hipertens/i;
    t.caso("v17.6.30: mtrTextoOpinaSobre reconoce la negación simple 'no + verbo', no solo las frases largas", () => {
      t.igual(api.mtrTextoOpinaSobre("Paciente no fuma.", RE_FUMA), false, "'no fuma' debe negar, no afirmar");
      t.igual(api.mtrTextoOpinaSobre("No es hipertenso, tensión normal en consulta.", RE_HTA), false, "'no es hipertenso' debe negar");
      // Las negaciones ya reconocidas antes de esta versión siguen funcionando igual.
      t.igual(api.mtrTextoOpinaSobre("Niega tabaquismo activo.", RE_FUMA), false, "negación ya soportada: 'niega'");
      // Y una afirmación limpia SIGUE afirmando (no se sobre-corrigió a negar todo).
      t.igual(api.mtrTextoOpinaSobre("Paciente fumador activo, un paquete/día.", RE_FUMA), true, "una afirmación real sigue devolviendo true");
      t.igual(api.mtrTextoOpinaSobre("Refiere ser hipertenso de larga data.", RE_HTA), true);
    });

    t.caso("mtrTextoOpinaSobre descarta antecedentes de terceros (no del propio paciente)", () => {
      t.igual(api.mtrTextoOpinaSobre("Padre hipertenso, madre diabética.", RE_HTA), null, "antecedente FAMILIAR, no del paciente: sin veredicto");
    });

    t.caso("mtrTextoOpinaSobre: sin texto o sin coincidencia, null (conservador)", () => {
      t.igual(api.mtrTextoOpinaSobre("", RE_FUMA), null);
      t.igual(api.mtrTextoOpinaSobre(null, RE_FUMA), null);
      t.igual(api.mtrTextoOpinaSobre("Consulta de control por hipertensión.", RE_FUMA), null, "el texto no menciona el hecho buscado");
    });

    t.caso("v17.6.31: mtrTextoOpinaSobre reconoce el hecho aunque la frase real lleve tilde y el patrón no", () => {
      const RE_DIABETES = /\bdiabet|\bdm2?\b|\bdmid\b|insulinorrequir/i;
      // "diabético" lleva tilde; el patrón exige "diabet" literal (sin tilde) — antes del
      // fix, re.test(frase) fallaba contra la frase CRUDA y la frase entera se descartaba.
      t.igual(api.mtrTextoOpinaSobre("No es diabético, controles normales.", RE_DIABETES), false, "'no es diabético' debe negar (antes daba null: la frase ni pasaba el filtro inicial)");
      t.igual(api.mtrTextoOpinaSobre("Refiere ser diabético de larga data.", RE_DIABETES), true, "una afirmación con tilde también debe reconocerse");
      t.igual(api.mtrTextoOpinaSobre("Padre diabético, madre sana.", RE_DIABETES), null, "antecedente familiar con tilde: sigue sin veredicto");
    });
  },
};
