// =====================================================================
//  SUITE 30 — Rangos y unidades oficiales leídos de Everest (v14.1.8)
//
//  Everest publica en `GetValidacionExamenCronicos?citaId=` los rangos de validación
//  por examen, parametrizados por sexo y edad, y —lo que más importaba— la UNIDAD.
//
//  Esa unidad es la respuesta a un problema que llevaba semanas sin solución: la RAC
//  puede venir en mg/g o en mg/mmol y NINGUNA guarda de rango puede distinguirlas,
//  porque 15 mg/mmol y 15 mg/g son igual de plausibles y significan cosas opuestas —
//  nefropatía franca una, normalidad la otra. Con la unidad declarada, deja de ser un
//  problema de adivinanza.
//
//  El criterio que estas pruebas fijan, y que es lo que las hace valer:
//  ANTE LA DUDA, LA REGLA NO SE APLICA. Una fila cuyo sexo no se reconozca, o que
//  acote por edad cuando la del paciente no se pudo leer, se descarta. Aplicar una
//  regla que quizá no corresponde es peor que no aplicar ninguna: convierte un valor
//  legítimo en una alarma falsa, y a la tercera alarma falsa el médico deja de mirarlas.
// =====================================================================
module.exports = {
  nombre: "Rangos oficiales de Everest (v14.1.8)",
  cubre: [
    "_numeroEstricto", "_reglaExamenAplicable", "_reglasDeExamen",
    "_unidadOficialDeExamen", "_plausibilidadOficial",
    "apiHcValidacionExamenCronicos", "_reglasParaLabKey",
  ],

  async pruebas(t, api, env, cargar) {
    // Forma real del endpoint, tal como la devolvió el mapa del DOM del 14-08-2026:
    // codigoExamen, sexo, edadMin, edadMax, valorMinimo, valorMaximo, swRequerido,
    // unidad, mensajeMinimo, mensajeMaximo.
    const fila = (o) => Object.assign({
      codigoExamen: "903895", sexo: "", edadMin: null, edadMax: null,
      valorMinimo: null, valorMaximo: null, swRequerido: false,
      unidad: "", mensajeMinimo: "", mensajeMaximo: "",
    }, o);

    // ---------- la trampa de la que salieron tres alarmas falsas ----------

    t.caso("_numeroEstricto: lo que NO es un número no se convierte en cero", () => {
      // Esta prueba existe porque la primera versión usaba Number() a secas y las pruebas
      // de abajo la tumbaron en tres sitios a la vez. Number(null), Number("") y
      // Number(false) valen 0, no NaN — así que "no acoto por edad" se leía como "acoto
      // desde los 0 años", el rango [null,null] se volvía [0,0] (que declara ALTO
      // cualquier valor) y un resultado vacío del LIS se volvía un 0 marcado BAJO.
      for (const nada of [null, undefined, "", "   ", false, true, [], {}, NaN, Infinity, -Infinity, "PENDIENTE", "12,5"]) {
        t.igual(api._numeroEstricto(nada), null, JSON.stringify(nada) + " no es un número: tiene que salir null, jamás 0");
      }
      t.igual(api._numeroEstricto(0), 0, "el cero de verdad SÍ es un número: es un mínimo legítimo (la RAC empieza en 0)");
      t.igual(api._numeroEstricto("0"), 0);
      t.igual(api._numeroEstricto(12.5), 12.5);
      t.igual(api._numeroEstricto(" 12.5 "), 12.5, "los espacios de la API no estorban");
      t.igual(api._numeroEstricto(-3), -3, "aquí no se juzga el signo: eso lo decide quien use el número");
    });

    // ---------- ¿a quién le corresponde cada fila? ----------

    t.caso("una fila sin sexo declarado vale para cualquier paciente", () => {
      const f = fila({ sexo: "" });
      t.cierto(api._reglaExamenAplicable(f, { edad: 60, sexo: "MASCULINO" }));
      t.cierto(api._reglaExamenAplicable(f, { edad: 60, sexo: "FEMENINO" }));
      t.cierto(api._reglaExamenAplicable(f, {}), "sin datos del paciente tampoco estorba: la fila no acota nada");
    });

    t.caso("una fila con sexo declarado solo aplica al sexo que coincide", () => {
      const soloF = fila({ sexo: "F" });
      t.cierto(api._reglaExamenAplicable(soloF, { sexo: "FEMENINO" }));
      t.falso(api._reglaExamenAplicable(soloF, { sexo: "MASCULINO" }));
      const soloM = fila({ sexo: "MASCULINO" });
      t.cierto(api._reglaExamenAplicable(soloM, { sexo: "M" }));
      t.falso(api._reglaExamenAplicable(soloM, { sexo: "F" }));
    });

    t.caso("una fila acotada por sexo NO se aplica si no sabemos el sexo del paciente — no se adivina", () => {
      const soloF = fila({ sexo: "F" });
      t.falso(api._reglaExamenAplicable(soloF, { edad: 60 }), "sin sexo del paciente, la regla se descarta");
      t.falso(api._reglaExamenAplicable(soloF, { edad: 60, sexo: "" }));
      t.falso(api._reglaExamenAplicable(soloF, { edad: 60, sexo: null }));
    });

    t.caso("un valor de sexo que no se reconoce descarta la fila, en vez de interpretarlo a ojo", () => {
      // Si mañana la IPS empieza a mandar "1"/"2", o "OTRO", no se puede saber a quién se
      // refiere. Adivinar aquí sería aplicarle a media flota un rango que no es el suyo.
      for (const raro of ["1", "2", "X", "OTRO", "INDETERMINADO"]) {
        t.falso(api._reglaExamenAplicable(fila({ sexo: raro }), { sexo: "FEMENINO" }),
          "sexo no reconocido (" + raro + "): la fila no se aplica");
      }
    });

    t.caso("la edad se respeta por los dos bordes, incluidos los valores exactos", () => {
      const f = fila({ edadMin: 18, edadMax: 65 });
      t.falso(api._reglaExamenAplicable(f, { edad: 17 }), "por debajo del mínimo");
      t.cierto(api._reglaExamenAplicable(f, { edad: 18 }), "el mínimo exacto SÍ entra");
      t.cierto(api._reglaExamenAplicable(f, { edad: 65 }), "el máximo exacto SÍ entra");
      t.falso(api._reglaExamenAplicable(f, { edad: 66 }), "por encima del máximo");
    });

    t.caso("una fila acotada por edad NO se aplica si la edad del paciente no se pudo leer", () => {
      const f = fila({ edadMin: 18, edadMax: 65 });
      t.falso(api._reglaExamenAplicable(f, {}), "sin edad, la regla acotada se descarta");
      t.falso(api._reglaExamenAplicable(f, { edad: null }));
      t.falso(api._reglaExamenAplicable(f, { edad: "no sé" }));
      // Pero una fila SIN acotar sí se aplica aunque falte la edad: no depende de ella.
      t.cierto(api._reglaExamenAplicable(fila({}), {}), "una fila sin límites de edad no necesita la edad");
    });

    // ---------- selección por examen ----------

    t.caso("el código de examen se compara EXACTO: un código clínico no se parece 'un poco'", () => {
      const tabla = [fila({ codigoExamen: "903895" }), fila({ codigoExamen: "9038950" }), fila({ codigoExamen: "90389" })];
      t.igual(api._reglasDeExamen(tabla, "903895", {}).length, 1, "solo casa el idéntico, no el que lo contiene ni el contenido");
      t.igual(api._reglasDeExamen(tabla, " 903895 ", {}).length, 1, "los espacios alrededor no cuentan");
      t.igual(api._reglasDeExamen(tabla, "903896", {}).length, 0);
    });

    t.caso("una tabla ausente o un código vacío devuelven lista vacía, sin lanzar", () => {
      t.igual(api._reglasDeExamen(null, "903895", {}), []);
      t.igual(api._reglasDeExamen(undefined, "903895", {}), []);
      t.igual(api._reglasDeExamen("no es una tabla", "903895", {}), []);
      t.igual(api._reglasDeExamen([fila({})], "", {}), []);
      t.igual(api._reglasDeExamen([fila({})], null, {}), []);
    });

    // ---------- LA UNIDAD: el motivo por el que existe todo esto ----------

    t.caso("la unidad declarada se lee — es lo que resuelve la ambigüedad de la RAC entre mg/g y mg/mmol", () => {
      const reglas = [fila({ codigoExamen: "903856", unidad: "mg/g", valorMinimo: 0, valorMaximo: 3000 })];
      t.igual(api._unidadOficialDeExamen(reglas), "mg/g");
      t.igual(api._plausibilidadOficial(15, reglas).unidad, "mg/g",
        "con la unidad declarada, un 15 deja de ser ambiguo: en mg/g es normal, en mg/mmol sería nefropatía franca");
    });

    t.caso("si las filas aplicables se contradicen en la unidad, NO se elige una: se devuelve null", () => {
      const reglas = [fila({ unidad: "mg/dL" }), fila({ unidad: "µmol/L" })];
      t.igual(api._unidadOficialDeExamen(reglas), null,
        "dos unidades para el mismo paciente es una contradicción de la fuente; elegir una sería adivinar");
    });

    t.caso("filas que repiten la MISMA unidad no cuentan como contradicción", () => {
      t.igual(api._unidadOficialDeExamen([fila({ unidad: "mg/dL" }), fila({ unidad: " mg/dL " })]), "mg/dL");
      t.igual(api._unidadOficialDeExamen([fila({ unidad: "" }), fila({ unidad: "mg/dL" })]), "mg/dL",
        "una fila sin unidad no contradice a la que sí la trae");
      t.igual(api._unidadOficialDeExamen([]), null);
      t.igual(api._unidadOficialDeExamen(null), null);
    });

    // ---------- el veredicto ----------

    t.caso("'no hay regla' y 'se sale del rango' son estados DISTINTOS — fundirlos hace desaparecer el analito", () => {
      // Este es el defecto exacto por el que se rechazó una implementación anterior: al
      // descartar el valor sin más, el analito desaparecía como si el laboratorio no
      // hubiera llegado nunca, y el médico perdía la diferencia entre "no me llegó" y
      // "me llegó ilegible".
      t.igual(api._plausibilidadOficial(1.0, []).estado, "sin_regla");
      t.igual(api._plausibilidadOficial(1.0, null).estado, "sin_regla");
      const reglas = [fila({ valorMinimo: 0.1, valorMaximo: 20, unidad: "mg/dL" })];
      t.igual(api._plausibilidadOficial(88, reglas).estado, "alto", "88 (que sería µmol/L) se marca ALTO, no 'sin dato'");
      t.igual(api._plausibilidadOficial(0.05, reglas).estado, "bajo");
      t.igual(api._plausibilidadOficial(1.0, reglas).estado, "dentro");
    });

    t.caso("un valor no numérico tiene su propio estado, distinto de 'fuera de rango'", () => {
      const reglas = [fila({ valorMinimo: 0.1, valorMaximo: 20 })];
      for (const basura of ["PENDIENTE", "", null, undefined, NaN, "muestra hemolizada"]) {
        t.igual(api._plausibilidadOficial(basura, reglas).estado, "valor_no_numerico",
          JSON.stringify(basura) + " no es 'fuera de rango': es que no hay número que comparar");
      }
    });

    t.caso("los bordes del rango se aceptan: el valor exacto NO se marca fuera", () => {
      const reglas = [fila({ valorMinimo: 0.1, valorMaximo: 20 })];
      t.igual(api._plausibilidadOficial(0.1, reglas).estado, "dentro", "el mínimo exacto está dentro");
      t.igual(api._plausibilidadOficial(20, reglas).estado, "dentro", "el máximo exacto está dentro");
    });

    t.caso("con varias reglas aplicables se toma la ENVOLVENTE, no la más estrecha", () => {
      // Rechazar por el rango más estrecho marcaría como imposible un valor que otra regla
      // de la propia IPS considera válido. El paciente más grave es justo el que cae en
      // los extremos, y es en quien más importa no equivocarse.
      const reglas = [
        fila({ valorMinimo: 12, valorMaximo: 16 }),
        fila({ valorMinimo: 2, valorMaximo: 28 }),
      ];
      const r = api._plausibilidadOficial(3, reglas);
      t.igual(r.estado, "dentro", "3 cae fuera de la regla estrecha pero dentro de la amplia: se acepta");
      t.igual(r.min, 2);
      t.igual(r.max, 28);
      t.igual(api._plausibilidadOficial(1, reglas).estado, "bajo", "por debajo de TODAS las reglas sí es bajo");
    });

    t.caso("una regla que solo acota por un lado funciona por ese lado y no inventa el otro", () => {
      const soloMin = [fila({ valorMinimo: 3, valorMaximo: null })];
      t.igual(api._plausibilidadOficial(2, soloMin).estado, "bajo");
      t.igual(api._plausibilidadOficial(99999, soloMin).estado, "dentro", "sin máximo declarado, no hay techo que romper");
      const soloMax = [fila({ valorMinimo: null, valorMaximo: 25 })];
      t.igual(api._plausibilidadOficial(26, soloMax).estado, "alto");
      t.igual(api._plausibilidadOficial(0.001, soloMax).estado, "dentro");
    });

    t.caso("una regla sin ningún límite numérico es 'sin_regla', no un rango vacío que rechace todo", () => {
      const reglas = [fila({ valorMinimo: null, valorMaximo: null, unidad: "mg/dL" })];
      const r = api._plausibilidadOficial(5, reglas);
      t.igual(r.estado, "sin_regla", "una fila que no acota nada no puede declarar nada fuera de rango");
      t.igual(r.unidad, "mg/dL", "pero su unidad sí se conserva: es información útil por sí sola");
    });

    t.caso("el mensaje que la IPS quiere mostrar viaja con el veredicto", () => {
      const reglas = [fila({ valorMinimo: 0.1, valorMaximo: 20, mensajeMinimo: "Creatinina muy baja, verifique", mensajeMaximo: "Creatinina crítica" })];
      t.igual(api._plausibilidadOficial(0.01, reglas).mensaje, "Creatinina muy baja, verifique");
      t.igual(api._plausibilidadOficial(50, reglas).mensaje, "Creatinina crítica");
      t.igual(api._plausibilidadOficial(1, reglas).mensaje, "", "dentro de rango no hay nada que decir");
    });

    // ---------- caso clínico completo ----------

    t.caso("caso real: la hemoglobina de una mujer no se juzga con el rango del hombre", () => {
      const tabla = [
        fila({ codigoExamen: "903001", sexo: "M", valorMinimo: 13, valorMaximo: 18, unidad: "g/dL" }),
        fila({ codigoExamen: "903001", sexo: "F", valorMinimo: 12, valorMaximo: 16, unidad: "g/dL" }),
      ];
      const mujer = api._reglasDeExamen(tabla, "903001", { sexo: "FEMENINO", edad: 45 });
      t.igual(mujer.length, 1, "a la paciente solo le aplica su propia fila");
      t.igual(api._plausibilidadOficial(12.5, mujer).estado, "dentro", "12.5 es normal en mujer");
      const hombre = api._reglasDeExamen(tabla, "903001", { sexo: "MASCULINO", edad: 45 });
      t.igual(api._plausibilidadOficial(12.5, hombre).estado, "bajo", "el MISMO 12.5 es bajo en hombre: por eso el sexo importa");
    });

    t.caso("sin sexo conocido no se aplica NINGUNA de las dos reglas por sexo, y el resultado es 'sin_regla'", () => {
      const tabla = [
        fila({ codigoExamen: "903001", sexo: "M", valorMinimo: 13, valorMaximo: 18 }),
        fila({ codigoExamen: "903001", sexo: "F", valorMinimo: 12, valorMaximo: 16 }),
      ];
      const reglas = api._reglasDeExamen(tabla, "903001", { edad: 45 });
      t.igual(reglas.length, 0);
      t.igual(api._plausibilidadOficial(12.5, reglas).estado, "sin_regla",
        "callar es lo correcto: marcar 12.5 como bajo sin saber el sexo sería una alarma inventada");
    });

    // ---------- contra la tabla REAL de la IPS ----------
    //
    // Extraída de captura_rutacronicos_borrado_rac_20260812.json, la respuesta literal del
    // endpoint en consultorio. No contiene ni un dato de paciente: son 28 filas de
    // parametrización (nombre de examen, rango, unidad, obligatoriedad).
    const REAL = [
      { codigoExamen: "HEMOGLOBINA", sexo: null, edadMin: 0, edadMax: 110, valorMinimo: 3.0, valorMaximo: 30.0, swRequerido: true, unidad: "g/dL" },
      { codigoExamen: "GLUCOSA_SUERO", valorMinimo: 20.0, valorMaximo: 1000.0, swRequerido: false, unidad: "mg/dL" },
      { codigoExamen: "HBA1C", valorMinimo: 3.0, valorMaximo: 25.0, swRequerido: true, unidad: "%" },
      { codigoExamen: "HDL", valorMinimo: 5.0, valorMaximo: 150.0, swRequerido: false, unidad: "mg/dL" },
      { codigoExamen: "LDL", valorMinimo: 10.0, valorMaximo: 600.0, swRequerido: false, unidad: "mg/dL" },
      { codigoExamen: "CREATININA", valorMinimo: 0.2, valorMaximo: 20.0, swRequerido: true, unidad: "mg/dL" },
      { codigoExamen: "MICROALBUMINURIA_CREATINURIA", valorMinimo: 1.0, valorMaximo: 10000.0, swRequerido: false, unidad: "mg/g" },
      { codigoExamen: "RELACION_ALBUMINURIA_CREATININA", valorMinimo: 1.0, valorMaximo: 20000.0, swRequerido: false, unidad: "mg/g" },
      { codigoExamen: "FOSFORO_SERICO", valorMinimo: 0.5, valorMaximo: 20.0, swRequerido: true, unidad: "mg/dL" },
      { codigoExamen: "ALBUMINA_SERICA", valorMinimo: 1.0, valorMaximo: 10.0, swRequerido: true, unidad: "g/dL" },
      { codigoExamen: "PTH", valorMinimo: 1.0, valorMaximo: 3000.0, swRequerido: false, unidad: "pg/ml" },
      { codigoExamen: "COLESTEROL_TOTAL", valorMinimo: 40.0, valorMaximo: 1000.0, swRequerido: false, unidad: "mg/dL" },
      { codigoExamen: "TRIGLICERIDOS", valorMinimo: 10.0, valorMaximo: 5000.0, swRequerido: false, unidad: "mg/dL" },
    ];

    t.caso("LO MÁS IMPORTANTE DE ESTE ARCHIVO: 'dentro' NO significa 'normal'", () => {
      // La tabla real declara la hemoglobina plausible entre 3 y 30 g/dL. Una hemoglobina
      // de 3.2 está DENTRO y es una urgencia transfusional. Estos rangos contestan "¿este
      // número puede ser un resultado de verdad?", no "¿este paciente está bien?".
      // Si alguna vez alguien pinta "dentro" como "normal" o como un visto verde, estará
      // tranquilizando al médico sobre un valor crítico. Esta prueba está aquí para que
      // ese cambio no pueda hacerse sin leer esto primero.
      const hb = api._reglasParaLabKey(REAL, "HEMOGLOBINA", { edad: 45, sexo: "FEMENINO" });
      t.igual(api._plausibilidadOficial(3.2, hb).estado, "dentro",
        "3.2 g/dL es PLAUSIBLE (un laboratorio puede reportarlo) y a la vez catastrófico: 'dentro' no dice nada sobre la salud del paciente");
      t.igual(api._plausibilidadOficial(25, hb).estado, "dentro",
        "25 g/dL también es plausible como dato; el juicio clínico no es asunto de esta función");
      // Lo que sí detecta es lo que vino a detectar: basura y unidades cambiadas.
      t.igual(api._plausibilidadOficial(0.5, hb).estado, "bajo", "0.5 no es una hemoglobina: es un dedazo");
      t.igual(api._plausibilidadOficial(320, hb).estado, "alto", "320 es la hemoglobina en g/L metida en una casilla de g/dL");
    });

    t.caso("la RAC del script apunta al examen de Everest que corresponde, no al que se le parece", () => {
      // Las dos vienen en mg/g y son exámenes DISTINTOS. El catálogo del script (v12.0.5,
      // etiqueta leída en consultorio) dice que su casilla es "Relación
      // albuminuria/Creatinina en orina (mg/g)" y prohíbe expresamente la otra.
      const rac = api._reglasParaLabKey(REAL, "RAC", {});
      t.igual(rac.length, 1);
      t.igual(rac[0].codigoExamen, "RELACION_ALBUMINURIA_CREATININA",
        "NO es MICROALBUMINURIA_CREATINURIA: esa es la otra casilla, la que el catálogo prohíbe usar");
      t.igual(api._plausibilidadOficial(15, rac).unidad, "mg/g",
        "y aquí muere la ambigüedad que llevaba semanas abierta: la IPS declara la RAC en mg/g, no en mg/mmol");
    });

    t.caso("cada clave del catálogo de labs encuentra su examen en la tabla real (o no se mapea a propósito)", () => {
      // Si alguien renombra una clave del catálogo o Everest renombra un examen, esto cae
      // aquí y no en el consultorio con un rango que no se aplica y nadie echa de menos.
      const esperado = {
        COLESTEROL_TOTAL: "COLESTEROL_TOTAL", COLESTEROL_HDL: "HDL", COLESTEROL_LDL: "LDL",
        TRIGLICERIDOS: "TRIGLICERIDOS", GLUCOSA: "GLUCOSA_SUERO", CREATININA: "CREATININA",
        HBA1C: "HBA1C", PTH: "PTH", FOSFORO: "FOSFORO_SERICO", ALBUMINA: "ALBUMINA_SERICA",
        HEMOGLOBINA: "HEMOGLOBINA", RAC: "RELACION_ALBUMINURIA_CREATININA",
      };
      const sinCasar = [];
      for (const clave of Object.keys(esperado)) {
        const r = api._reglasParaLabKey(REAL, clave, { edad: 45, sexo: "FEMENINO" });
        if (r.length !== 1 || r[0].codigoExamen !== esperado[clave]) sinCasar.push(clave);
      }
      t.igual(sinCasar, [], "claves del catálogo que no encontraron su examen oficial");
      t.igual(api._reglasParaLabKey(REAL, "UROANALISIS", {}), [],
        "UROANALISIS no se mapea a propósito: no es un examen numérico y Everest no lo parametriza");
      t.igual(api._reglasParaLabKey(REAL, "INVENTADO", {}), []);
      t.igual(api._reglasParaLabKey(REAL, "", {}), []);
      t.igual(api._reglasParaLabKey(REAL, null, {}), []);

      // Y "no se mapea" tiene que seguir siendo cierto AUNQUE la tabla traiga una fila que
      // se llame igual. Sin esta comprobación, un `|| labKey` de una línea convertía la
      // exclusión deliberada en una coincidencia por casualidad, y nada lo notaba: con la
      // tabla real ambas versiones devuelven [] porque no hay fila UROANALISIS. El día que
      // la IPS añada una, el analito que se excluyó por no tener número empezaría a
      // juzgarse con un rango.
      const conTrampa = REAL.concat([
        { codigoExamen: "UROANALISIS", valorMinimo: 1, valorMaximo: 10, unidad: "?" },
        { codigoExamen: "INVENTADO", valorMinimo: 1, valorMaximo: 10, unidad: "?" },
      ]);
      t.igual(api._reglasParaLabKey(conTrampa, "UROANALISIS", {}), [],
        "el mapa es una lista blanca: lo que no está mapeado no se busca por su propio nombre");
      t.igual(api._reglasParaLabKey(conTrampa, "INVENTADO", {}), []);
    });

    t.caso("la forma real de la tabla —sexo null, sexo ausente, edades ausentes— no descarta ninguna fila", () => {
      // 27 de las 28 filas reales no traen `sexo` ni `edadMin`/`edadMax`, y HEMOGLOBINA
      // trae `sexo: null`. Con Number() a secas, `edadMin: null` se leía como "acoto desde
      // los 0 años" y la fila se caía en todo paciente sin edad legible. Aquí se comprueba
      // que la tabla entera sigue aplicando incluso sin saber nada del paciente.
      for (const clave of ["CREATININA", "HBA1C", "RAC", "GLUCOSA"]) {
        t.igual(api._reglasParaLabKey(REAL, clave, {}).length, 1,
          clave + ": sin edad ni sexo del paciente, una fila que no acota nada TIENE que seguir aplicando");
      }
      // HEMOGLOBINA es la ÚNICA de las 28 que acota por edad (0–110), y `sexo: null` no
      // acota nada. Con la edad se aplica; sin la edad se descarta — que es el criterio de
      // toda esta suite funcionando, no un fallo. La consecuencia práctica hay que
      // aceptarla con los ojos abiertos: si el script no logra leer la edad del paciente,
      // la hemoglobina se queda sin rango oficial y no se juzga. Callar es lo correcto.
      t.igual(api._reglasParaLabKey(REAL, "HEMOGLOBINA", { edad: 45 }).length, 1, "con la edad conocida, sí aplica");
      t.igual(api._reglasParaLabKey(REAL, "HEMOGLOBINA", { edad: 0 }).length, 1, "el borde 0 entra");
      t.igual(api._reglasParaLabKey(REAL, "HEMOGLOBINA", { edad: 110 }).length, 1, "el borde 110 entra");
      t.igual(api._reglasParaLabKey(REAL, "HEMOGLOBINA", { edad: 111 }).length, 0, "111 años queda fuera del 0–110 declarado");
      t.igual(api._reglasParaLabKey(REAL, "HEMOGLOBINA", {}).length, 0, "sin edad legible, la hemoglobina se queda sin rango: no se adivina");
      // `sexo: null` no es un sexo declarado: no puede descartar a nadie.
      t.igual(api._reglasParaLabKey(REAL, "HEMOGLOBINA", { edad: 45, sexo: "MASCULINO" }).length, 1);
      t.igual(api._reglasParaLabKey(REAL, "HEMOGLOBINA", { edad: 45, sexo: "FEMENINO" }).length, 1);
    });

    // ---------- la lectura del endpoint ----------

    await t.casoAsync("apiHcValidacionExamenCronicos: sin citaId no consulta nada — y 'nada' se comprueba, no se supone", async () => {
      // La primera versión de esta prueba solo miraba el valor devuelto, y al quitar la
      // guarda seguía en verde: sin citaId la petición salía igual, fallaba, y el catch
      // devolvía null de todos modos. El nombre prometía algo que no se verificaba. Se
      // cuentan las llamadas: si sale una sola petición con la cita vacía, esto cae.
      let llamadas = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { llamadas++; return { ok: true, status: 200, json: async () => [], text: async () => "[]" }; },
      });
      for (const vacio of ["", null, undefined, 0, false]) {
        t.igual(await c.api.apiHcValidacionExamenCronicos(vacio), null, "sin cita no hay tabla que devolver");
      }
      t.igual(llamadas, 0, "sin citaId no debe salir NI UNA petición: pedir 'citaId=' es preguntar por la nada");
    });

    await t.casoAsync("apiHcValidacionExamenCronicos: solo un ARRAY se acepta; cualquier otra forma sube como null", async () => {
      // Misma prudencia que el resto de lecturas del proyecto: un objeto de error, una
      // página de login devuelta con HTTP 200, o una cadena, NO son una tabla de reglas.
      for (const respuesta of [{ error: "no autorizado" }, "<html>login</html>", 42, null]) {
        const c = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, json: async () => respuesta, text: async () => JSON.stringify(respuesta) }) });
        t.igual(await c.api.apiHcValidacionExamenCronicos("999"), null, "respuesta " + JSON.stringify(respuesta) + " no es utilizable");
      }
    });

    await t.casoAsync("apiHcValidacionExamenCronicos: una tabla VACÍA sí es una respuesta válida", async () => {
      // Vacío significa "esta cita no tiene reglas parametrizadas", que es un hecho real y
      // distinto de "no se pudo consultar". Confundirlos haría reintentar sin motivo.
      const c = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, json: async () => [], text: async () => "[]" }) });
      t.igual(await c.api.apiHcValidacionExamenCronicos("999"), []);
    });

    await t.casoAsync("apiHcValidacionExamenCronicos: se cachea por citaId, y una cita DISTINTA no hereda la tabla de la anterior", async () => {
      let llamadas = 0;
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          llamadas++;
          const cual = String(url).includes("citaId=111") ? "111" : "222";
          return { ok: true, status: 200, json: async () => [{ codigoExamen: cual }], text: async () => JSON.stringify([{ codigoExamen: cual }]) };
        },
      });
      const a1 = await c.api.apiHcValidacionExamenCronicos("111");
      const a2 = await c.api.apiHcValidacionExamenCronicos("111");
      t.igual(llamadas, 1, "la segunda consulta de la MISMA cita sale de la caché");
      t.igual(a1, a2);
      const b = await c.api.apiHcValidacionExamenCronicos("222");
      t.igual(llamadas, 2, "otra cita SÍ dispara consulta nueva");
      t.igual(b[0].codigoExamen, "222", "y devuelve lo suyo, no lo de la cita anterior");
    });
  },
};
