// =====================================================================
//  SUITE 45 — Clasificador de riesgo cardiovascular (4 pasos) y ERC
//
//  QUÉ COMPRUEBA: que el clasificador portado desde `motor_riesgo_cv.py`
//  reproduce al Copiloto vector a vector (991 vectores dorados generados
//  ejecutando su Python REAL), y que las dos diferencias deliberadas están
//  donde se dijo que estaban y en ninguna parte más.
//
//  LAS DOS DIFERENCIAS DELIBERADAS, y por qué:
//
//   (A) Donde el Python LANZA por falta de TFG, aquí se devuelve un objeto con
//       `categoria: null` y `motivo: "tfg_requerida"`. Misma conducta clínica
//       (sin TFG no hay categoría) sin tumbar la consulta a mitad de camino.
//
//   (B) Cuando los pasos 1-3 no clasifican y el ETL no trae el % de ASCVD, el
//       Python devuelve `categoria: null` y se acabó — y con ella se cae toda
//       la cadena: sin categoría no hay meta de LDL, y sin meta no se detecta
//       falla terapéutica. Aquí, si están los cuatro insumos (edad, colesterol
//       total, HDL y presión sistólica), se calcula la escala y se sigue. El
//       propio comentario del Python dice que el navegador hace esto y que es
//       lo correcto. La prueba EXIGE que solo pase en ese caso: si el JS
//       clasifica donde el Python no y NO tenía los cuatro insumos, falla.
// =====================================================================
const fs = require("fs");
const path = require("path");

const GOLD = path.join(__dirname, "golden", "clasificar_riesgo_cv.json");

// nombre del campo en Python -> nombre del campo en el port
const MAPA_ENTRADA = {
  edad: "edad", sexo: "sexo", egfr_ckdepi: "egfrCkdepi",
  hta: "hta", tabaquismo: "tabaquismo",
  prediabetes_sd_metabolico: "prediabetesSdMetabolico",
  sedentarismo: "sedentarismo", obesidad: "obesidad", imc: "imc",
  circunferencia_abd_elevada: "circunferenciaAbdElevada",
  masld: "masld", apnea_sueno: "apneaSueno", hiperuricemia: "hiperuricemia",
  disfuncion_erectil: "disfuncionErectil",
  ecv_aterosclerotica_establecida: "ecvAterescleroticaEstablecida",
  hf_homocigota: "hfHomocigota", hf_heterocigota: "hfHeterocigota",
  diabetes: "diabetes", dm_larga_duracion: "dmLargaDuracion", dm_anios: "dmAnios",
  rac: "rac", retinopatia: "retinopatia", neuropatia: "neuropatia",
  ecv_subclinica_lesion_mayor_50: "ecvSubclinicaLesionMayor50",
  ecv_subclinica_lesion_menor_50: "ecvSubclinicaLesionMenor50",
  calcio_coronario_agatston: "calcioCoronarioAgatston",
  pa_sistolica: "paSistolica", pa_diastolica: "paDiastolica",
  ldl: "ldl", ct: "ct",
  inflamacion_cronica: "inflamacionCronica",
  hxfam_ecv_prematura: "hxfamEcvPrematura",
  itb: "itb", pcr_us: "pcrUs", apob: "apob",
  condiciones_especificas_mujer: "condicionesEspecificasMujer",
  pobreza_multidimensional: "pobrezaMultidimensional",
  ascvd_10y_crudo: "ascvd10yCrudo",
};

function traducir(entradaPy) {
  const out = {};
  for (const k of Object.keys(entradaPy)) {
    const destino = MAPA_ENTRADA[k];
    if (destino) out[destino] = entradaPy[k];
  }
  return out;
}

module.exports = {
  nombre: "Riesgo CV (4 pasos) y función renal unificada",
  cubre: [
    "mtrClasificarRiesgoCv", "mtrContarFrMayores", "mtrContarPotenciadores", "mtrSindromeMetabolico",
    "mtrCriteriosPaso1", "mtrCriteriosPaso2", "mtrAscvdPceCrudo",
    "mtrAscvdFueraDeRangoEtario", "mtrEsSexoFemenino", "mtrEsSexoMasculino",
    "mtrMetasLipidicas", "mtrEvaluarMetaLdl", "mtrLdlBasalDeSerie", "_isoAMs",
    "mtrEvaluarErc", "mtrRemisionNefrologia", "mtrSospechaIra", "mtrPosEstadio",
  ],

  pruebas(t, api) {
    // ================= CONFORMIDAD CON EL COPILOTO =================
    t.caso("el corpus dorado existe y no está vacío (si no, esta suite pasaría en el vacío)", () => {
      t.cierto(fs.existsSync(GOLD), "falta tests/golden/clasificar_riesgo_cv.json");
      const d = JSON.parse(fs.readFileSync(GOLD, "utf8"));
      t.cierto(d.vectores.length >= 900, "se esperaban al menos 900 vectores, hay " + d.vectores.length);
    });

    t.caso("PISO POR DIABETES: ningún diabético puede quedar por debajo de ALTO (v16.2.9)", () => {
      // Decisión del médico (20-ago, textual): "sí, todo diabético debe entrar como riesgo
      // ALTO". Es un PISO: el paso 1 sigue mandando hacia arriba.
      const base = { edad: 55, sexo: "M", egfrCkdepi: 90 };

      const sinDm = api.mtrClasificarRiesgoCv(Object.assign({}, base));
      t.cierto(sinDm.categoria !== "alto" || sinDm.paso === 2, "el no diabético sigue su curso normal");

      const conDm = api.mtrClasificarRiesgoCv(Object.assign({}, base, { diabetes: true }));
      t.igual(conDm.categoria, "alto", "el diabético entra en ALTO");
      t.cierto(conDm.pisoPorDiabetes === true, "y queda marcado que fue por el piso");
      t.cierto(conDm.criterios.some((c) => /diabetes mellitus/i.test(c) && /alto/i.test(c)), "el porqué se dice en pantalla");

      // El piso NO puede tapar el paso 1: con daño de órgano blanco sigue subiendo.
      const conDano = api.mtrClasificarRiesgoCv(Object.assign({}, base, { diabetes: true, rac: 350 }));
      t.igual(conDano.categoria, "muy alto", "diabético con macroalbuminuria sigue en MUY ALTO, no se baja a alto");
      const conEcv = api.mtrClasificarRiesgoCv(Object.assign({}, base, { diabetes: true, ecvAterescleroticaEstablecida: true }));
      t.igual(conEcv.categoria, "muy alto", "diabético con ECV establecida también");
      const conErc = api.mtrClasificarRiesgoCv(Object.assign({}, base, { diabetes: true, egfrCkdepi: 25 }));
      t.igual(conErc.categoria, "muy alto", "y con TFG <= 30");

      // Un diabético ya no puede quedarse SIN clasificar por falta de la escala ASCVD.
      const sinInsumos = api.mtrClasificarRiesgoCv({ edad: 60, sexo: "F", egfrCkdepi: 80, diabetes: true });
      t.igual(sinInsumos.categoria, "alto", "sin colesterol ni presión, el diabético ya no se queda sin categoría");

      // Y la meta de LDL que se deriva baja de 116 a 70: el efecto que motivó todo.
      const metas = api.mtrMetasLipidicas(conDm.categoria, null);
      t.igual(metas.ldl, 70, "meta de LDL <70 (antes, en «bajo», era <116)");
    });

    t.caso("los 4 pasos reproducen al Copiloto vector a vector", () => {
      const d = JSON.parse(fs.readFileSync(GOLD, "utf8"));
      const desviaciones = [];
      // v16.2.9 — EXCEPCIÓN (C): PISO POR DIABETES. Decisión clínica del médico del
      // 20-ago-2026, textual: "sí, todo diabético debe entrar como riesgo ALTO". Es un
      // PISO, no un valor fijo: el paso 1 manda igual, así que el diabético con daño de
      // órgano blanco conserva su MUY ALTO; lo que desaparece es que un diabético quede
      // en "moderado", en "bajo" o SIN CLASIFICAR.
      //
      // El porqué lo destapó la auditoría del mismo día: las dos reglas de diabetes de
      // los pasos 1 y 2 dependen de `dmAnios` / `dmLargaDuracion`, y esos dos campos NO
      // LOS ESCRIBE NADIE en producción — eran código muerto, y con ellos moría la única
      // vía por la que un diabético subía de categoría. Por eso una paciente de 85 años
      // con HTA y DM2 insulinorrequiriente salía en riesgo BAJO, con meta de LDL <116.
      //
      // La excepción es ESTRECHA a propósito: solo tapa a los diabéticos que el Copiloto
      // dejaba POR DEBAJO de alto. Un diabético que allá salía "muy alto" y aquí saliera
      // otra cosa SIGUE siendo una desviación y rompe la suite, como debe ser.
      const desviacionesPiso = [];
      for (const v of d.vectores) {
        const js = api.mtrClasificarRiesgoCv(traducir(v.entrada));
        const py = v.salida;

        if (v.entrada && v.entrada.diabetes === true
            && py.categoria !== "alto" && py.categoria !== "muy alto") {
          if (js.categoria !== "alto") {
            desviacionesPiso.push("diabético que NO quedó en alto: " + js.categoria + " · " + JSON.stringify(v.entrada));
          }
          continue;
        }

        // v16.4.0 — EXCEPCIÓN (D): PISO POR EDAD. Decisión del médico (20-ago, textual):
        // "Mayores de 79: directamente ALTO [y claramente puede subir a muy alto]". Igual
        // de estrecha que la (C): solo tapa a los >79 que el Copiloto dejaba POR DEBAJO
        // de alto o sin clasificar; un >79 "muy alto" allá sigue comparándose normal.
        if (v.entrada && typeof v.entrada.edad === "number" && v.entrada.edad > 79
            && py.categoria !== "alto" && py.categoria !== "muy alto") {
          if (js.categoria !== "alto") {
            desviacionesPiso.push("mayor de 79 que NO quedó en alto: " + js.categoria + " · " + JSON.stringify(v.entrada));
          }
          continue;
        }

        // Excepción (B): el Python se quedó sin ASCVD y el JS sí pudo calcularla.
        if (py.categoria === null && py.requiere_ascvd === true && js.categoria !== null) {
          const e = v.entrada;
          const teniaInsumos = e.edad && e.ct && e.hdl && e.pa_sistolica;
          if (!teniaInsumos) {
            desviaciones.push("clasificó SIN los cuatro insumos de la escala: " + JSON.stringify(e));
          } else if (js.paso !== 4) {
            desviaciones.push("clasificó por el paso " + js.paso + " y debía ser el 4: " + JSON.stringify(e));
          }
          continue;
        }
        if (js.categoria !== py.categoria) {
          desviaciones.push("categoría " + js.categoria + " != " + py.categoria + " · " + JSON.stringify(v.entrada));
          continue;
        }
        if (py.categoria !== null && js.paso !== py.paso) {
          desviaciones.push("paso " + js.paso + " != " + py.paso + " · " + JSON.stringify(v.entrada));
          continue;
        }
        if (js.conteoFrMayores !== py.conteo_fr_mayores) {
          desviaciones.push("conteo FR " + js.conteoFrMayores + " != " + py.conteo_fr_mayores + " · " + JSON.stringify(v.entrada));
        }
      }
      t.igual(desviaciones.slice(0, 5), [], "desviaciones frente al Copiloto (" + desviaciones.length + " en total)");
      t.igual(desviacionesPiso.slice(0, 5), [], "diabéticos que el piso debía subir a alto y no subió (" + desviacionesPiso.length + " en total)");
      // La excepción no puede quedar huérfana: si algún día deja de aplicarse a nadie,
      // es que el corpus cambió y hay que revisar si el piso sigue haciendo falta.
      const nDia = d.vectores.filter((v) => v.entrada && v.entrada.diabetes === true
        && v.salida.categoria !== "alto" && v.salida.categoria !== "muy alto").length;
      t.cierto(nDia > 0, "la excepción del piso por diabetes sigue ejercitándose (" + nDia + " vectores)");
      const nEdad = d.vectores.filter((v) => v.entrada && typeof v.entrada.edad === "number" && v.entrada.edad > 79
        && v.entrada.diabetes !== true
        && v.salida.categoria !== "alto" && v.salida.categoria !== "muy alto").length;
      t.cierto(nEdad > 0, "la excepción del piso por edad sigue ejercitándose (" + nEdad + " vectores)");
    });

    t.caso("excepción (B): el corpus NO puede ejercitarla, y esa es la razón de que exista", () => {
      // `RiesgoCVInput` del Copiloto NO tiene campo `hdl`: su clasificador no
      // puede calcular la escala aunque el paciente tenga los datos delante.
      // Por eso todo vector dorado que llega al paso 4 sin `ascvd_10y_crudo`
      // sale con categoria null. Aquí se comprueba las dos mitades:
      const d = JSON.parse(fs.readFileSync(GOLD, "utf8"));
      const sinAscvd = d.vectores.filter((v) => v.salida.requiere_ascvd === true);
      t.cierto(sinAscvd.length > 0, "el corpus debía traer casos que el Copiloto no clasifica");
      t.cierto(sinAscvd.every((v) => !v.entrada.hdl),
        "ningún vector dorado trae HDL: el modelo del Copiloto no tiene ese campo");

      // (1) mismo paciente SIN HDL -> tampoco clasifica aquí, y lo dice.
      const sinHdl = api.mtrClasificarRiesgoCv({ edad: 52, sexo: "M", egfrCkdepi: 95, ct: 200, paSistolica: 125 });
      t.igual(sinHdl.categoria, null, "sin HDL no se puede calcular la escala");
      t.igual(sinHdl.motivo, "ascvd_requerido", "y se dice exactamente qué falta");

      // (2) el mismo paciente CON HDL -> aquí sí se clasifica, por el paso 4.
      const conHdl = api.mtrClasificarRiesgoCv({ edad: 52, sexo: "M", egfrCkdepi: 95, ct: 200, hdl: 48, paSistolica: 125 });
      t.igual(conHdl.paso, 4, "clasifica por el paso 4");
      t.cierto(conHdl.categoria !== null, "y con categoría, que es lo que desbloquea la meta de LDL");
      t.cierto(conHdl.criterios.some((c) => /calculado aqu/i.test(c)),
        "el criterio debía decir que la escala se calculó aquí, no que vino dada");
    });

    t.caso("los contadores y los criterios de cada paso se pueden pedir por separado", () => {
      // No es cobertura por integración: se invocan directamente, porque el
      // recuadro los usa sueltos para explicarle al médico QUÉ disparó la
      // categoría sin volver a clasificar.
      const paciente = { edad: 70, sexo: "M", egfrCkdepi: 55, hta: true, tabaquismo: true, rac: 40 };
      const fr = api.mtrContarFrMayores(paciente);
      t.igual(fr.conteo, 3, "edad>65 + HTA + tabaquismo");
      const pot = api.mtrContarPotenciadores(paciente, fr.conteo);
      t.cierto(pot.lista.indexOf("RAC>30") >= 0, "la RAC de 40 es potenciador");
      const c1 = api.mtrCriteriosPaso1(paciente, fr.conteo);
      t.igual(c1, [], "sin diabetes ni ECV ni eGFR<=30, el paso 1 no dispara");
      const c2 = api.mtrCriteriosPaso2(paciente, fr.conteo);
      t.cierto(c2.length >= 2, "el paso 2 sí: 3 FR y ERC 30-60");
      t.cierto(c2.some((c) => /ERC eGFR 30-60/.test(c)), "y uno de ellos debía ser la ERC");
    });

    // ================= LA ESCALA ASCVD =================
    t.caso("las Pooled Cohort Equations dan los dos casos de referencia publicados", () => {
      // Mujer y hombre de 55 años, CT 213, HDL 50, PAS 120 sin tratar.
      const mujer = api.mtrAscvdPceCrudo(55, "F", 213, 50, 120, false, false, false);
      const hombre = api.mtrAscvdPceCrudo(55, "M", 213, 50, 120, false, false, false);
      t.cierto(Math.abs(mujer - 2.05) < 0.05, "mujer 55 años debía dar ~2.05%, dio " + mujer);
      t.cierto(Math.abs(hombre - 5.38) < 0.05, "hombre 55 años debía dar ~5.38%, dio " + hombre);
    });

    t.caso("sin alguno de los cuatro insumos devuelve null, NUNCA un número aproximado", () => {
      t.igual(api.mtrAscvdPceCrudo(null, "M", 213, 50, 120), null, "sin edad");
      t.igual(api.mtrAscvdPceCrudo(55, "M", null, 50, 120), null, "sin colesterol total");
      t.igual(api.mtrAscvdPceCrudo(55, "M", 213, null, 120), null, "sin HDL");
      t.igual(api.mtrAscvdPceCrudo(55, "M", 213, 50, null), null, "sin presión sistólica");
      t.igual(api.mtrAscvdPceCrudo(55, "M", 0, 50, 120), null, "un cero no es un colesterol");
    });

    t.caso("fuera de 40-79 años el porcentaje se declara extrapolación, no se calla", () => {
      t.cierto(api.mtrAscvdFueraDeRangoEtario(85), "85 años está fuera del rango validado");
      t.cierto(api.mtrAscvdFueraDeRangoEtario(30), "30 años está fuera del rango validado");
      t.falso(api.mtrAscvdFueraDeRangoEtario(55), "55 años está dentro");
      // v16.4.0 — decisión del médico: los MAYORES de 79 ya no llegan a la escala (piso
      // ALTO); la extrapolación con letrero solo sigue viva en los MENORES de 40, donde
      // él dispuso mantener la escala calibrada como manda el consenso.
      const r = api.mtrClasificarRiesgoCv({ edad: 32, sexo: "M", egfrCkdepi: 95, ct: 200, hdl: 45, paSistolica: 130 });
      t.cierto(r.ascvdEdadFueraDeRango, "debía marcar la edad fuera de rango");
      t.cierto(r.criterios.some((c) => /extrapolaci/i.test(c)), "el aviso debía viajar CON el criterio que se transcribe a la nota");

      const mayor = api.mtrClasificarRiesgoCv({ edad: 88, sexo: "M", egfrCkdepi: 95, ct: 200, hdl: 45, paSistolica: 130 });
      t.igual(mayor.categoria, "alto", "el mayor de 79 entra por el piso, no por la extrapolación");
      t.cierto(mayor.pisoPorEdad === true, "y queda trazado que fue el piso por edad");
      const mayorGrave = api.mtrClasificarRiesgoCv({ edad: 88, sexo: "M", egfrCkdepi: 25 });
      t.igual(mayorGrave.categoria, "muy alto", "y claramente puede subir a MUY ALTO (palabras del médico): el paso 1 sigue mandando");
    });

    // ================= LOS PASOS, UNO A UNO =================
    t.caso("PASO 1 — un no diabético con RAC>=300 también es MUY ALTO", () => {
      // Este es el caso que el Copiloto contaba solo DENTRO de diabetes: un no
      // diabético con macroalbuminuria severa se quedaba una categoría por debajo.
      const r = api.mtrClasificarRiesgoCv({ edad: 50, sexo: "M", egfrCkdepi: 80, rac: 320 });
      t.igual(r.categoria, "muy alto", "RAC>=300 es daño de órgano blanco por sí solo");
      t.igual(r.paso, 1, "debía clasificar en el paso 1");
    });

    t.caso("PASO 1 — eGFR<=30 clasifica MUY ALTO, y 31 ya no", () => {
      t.igual(api.mtrClasificarRiesgoCv({ edad: 60, sexo: "M", egfrCkdepi: 30 }).categoria, "muy alto", "eGFR 30");
      t.igual(api.mtrClasificarRiesgoCv({ edad: 60, sexo: "M", egfrCkdepi: 31 }).categoria, "alto", "eGFR 31 cae al paso 2 (ERC 30-60)");
    });

    t.caso("PASO 2 — tres factores de riesgo mayores bastan", () => {
      const r = api.mtrClasificarRiesgoCv({ edad: 70, sexo: "F", egfrCkdepi: 80, hta: true, tabaquismo: true, sedentarismo: true });
      t.igual(r.categoria, "alto", "edad>65 + HTA + tabaquismo + sedentarismo = 4 FR");
      t.igual(r.conteoFrMayores, 4, "el conteo debía ser 4");
    });

    t.caso("la disfunción eréctil solo cuenta como factor de riesgo en hombre", () => {
      t.igual(api.mtrContarFrMayores({ edad: 50, sexo: "M", disfuncionErectil: true }).conteo, 1, "hombre: cuenta");
      t.igual(api.mtrContarFrMayores({ edad: 50, sexo: "F", disfuncionErectil: true }).conteo, 0, "mujer: no cuenta");
    });

    // [auditoría 25-ago, sección 4, decisión confirmada por el médico] síndrome
    // metabólico (≥3 de 5) no tenía ningún cálculo real — solo un campo homónimo de
    // membresía manual a un programa de Everest. Criterios IDF Latinoamérica.
    t.caso("mtrSindromeMetabolico: 3 de 5 criterios cumplidos -> cumple=true", () => {
      const r = api.mtrSindromeMetabolico({
        sexo: "M", cinturaCm: 95, trigliceridos: 180, hdl: 45, paSistolica: 120, paDiastolica: 78, glicemia: 90,
      });
      t.igual(r.count, 2, "cintura (95>90) y triglicéridos (180>=150): 2 criterios");
      t.igual(r.cumple, false, "con los 5 evaluados y solo 2, no cumple (concluyente)");
      const r2 = api.mtrSindromeMetabolico({
        sexo: "M", cinturaCm: 95, trigliceridos: 180, hdl: 35, paSistolica: 120, paDiastolica: 78, glicemia: 90,
      });
      t.igual(r2.count, 3, "+ HDL bajo (35<40 en hombre) = 3");
      t.igual(r2.cumple, true, "3 de 5: cumple");
      t.cierto(r2.criterios.some((c) => c.includes("cintura")) && r2.criterios.some((c) => c.includes("triglic")) && r2.criterios.some((c) => c.includes("HDL")));
    });

    t.caso("mtrSindromeMetabolico: los cortes de cintura y HDL son distintos por sexo", () => {
      // Mujer: cintura >80 (no >90), HDL <50 (no <40).
      const mujer = api.mtrSindromeMetabolico({ sexo: "F", cinturaCm: 85, hdl: 45 });
      t.igual(mujer.count, 2, "85>80 (cintura) y 45<50 (HDL): ambos cuentan en mujer");
      const hombreMismosValores = api.mtrSindromeMetabolico({ sexo: "M", cinturaCm: 85, hdl: 45 });
      t.igual(hombreMismosValores.count, 0, "los MISMOS valores (85 cm, HDL 45) no cuentan en hombre (cortes 90/40)");
    });

    t.caso("mtrSindromeMetabolico: PA y glicemia también cuentan si ya está en tratamiento/diagnosticado, sin la cifra cruda", () => {
      const r = api.mtrSindromeMetabolico({ sexo: "M", enAntihipertensivos: true, diabetes: true });
      t.igual(r.count, 2, "tratamiento antihipertensivo + diabetes ya diagnosticada cuentan igual que las cifras");
    });

    t.caso("mtrSindromeMetabolico: CERO INFERENCIA — con datos insuficientes para saber si llega a 3, cumple queda null (no false)", () => {
      // Solo cintura evaluable (positiva) de los 5; los otros 4 sin dato -> con 1 y hasta
      // 4 más posibles, SÍ podría llegar a 3: no se puede afirmar que no cumple.
      const r = api.mtrSindromeMetabolico({ sexo: "M", cinturaCm: 95 });
      t.igual(r.count, 1);
      t.igual(r.evaluables, 1, "solo 1 de los 5 criterios tenía dato para evaluarse");
      t.igual(r.cumple, null, "1 de 1 evaluado, pero con 4 sin dato que SÍ podrían sumar: no concluyente");
    });

    t.caso("mtrSindromeMetabolico: sin ningún dato, cumple=null y count=0 (nunca se inventa)", () => {
      const r = api.mtrSindromeMetabolico(null);
      t.igual(r.count, 0);
      t.igual(r.evaluables, 0);
      t.igual(r.cumple, null, "cero datos no es lo mismo que 'no cumple': es 'no se sabe'");
    });

    t.caso("mtrSindromeMetabolico: aunque falten datos, si ni el mejor caso llega a 3, cumple=false (no null)", () => {
      // Cintura y HDL negativos (2 evaluados, ninguno cumple); TG/PA/glicemia sin dato (3 sin evaluar).
      // Mejor caso posible: 0 + 3 = 3... así que con 3 sin evaluar SÍ podría llegar a 3. Bajamos a solo
      // 1 sin evaluar para que el mejor caso posible (2+1=3) sea el límite, y a 0 evaluados sin cumplir
      // más 1 sin dato para que el mejor caso (0+1=1) definitivamente no llegue a 3.
      const r = api.mtrSindromeMetabolico({
        sexo: "M", cinturaCm: 80, hdl: 55, trigliceridos: 100, enAntihipertensivos: false, paSistolica: 100, paDiastolica: 70,
      });
      t.igual(r.count, 0, "ningún criterio de los 4 evaluados (cintura, HDL, TG, PA) se cumple");
      t.igual(r.evaluables, 4, "solo glicemia queda sin dato");
      t.igual(r.cumple, false, "mejor caso posible es 0+1=1 < 3: sí se puede afirmar que NO cumple, aunque falte 1 dato");
    });

    t.caso("PASO 3 — tres potenciadores suben a ALTO; uno o dos dejan MODERADO", () => {
      const base = { edad: 50, sexo: "M", egfrCkdepi: 90 };
      const tres = api.mtrClasificarRiesgoCv(Object.assign({}, base, { inflamacionCronica: true, hxfamEcvPrematura: true, itb: 0.8 }));
      t.igual(tres.categoria, "alto", "3 potenciadores");
      const uno = api.mtrClasificarRiesgoCv(Object.assign({}, base, { hxfamEcvPrematura: true }));
      t.igual(uno.categoria, "moderado", "1 potenciador");
    });

    t.caso("PASO 4 — el ajuste a Colombia usa 0.28 en hombre y 0.54 en mujer", () => {
      const h = api.mtrClasificarRiesgoCv({ edad: 60, sexo: "M", egfrCkdepi: 90, ascvd10yCrudo: 50 });
      const m = api.mtrClasificarRiesgoCv({ edad: 60, sexo: "F", egfrCkdepi: 90, ascvd10yCrudo: 50 });
      t.igual(h.ascvdAjustadoPct, 14, "50 x 0.28 = 14");
      t.igual(m.ascvdAjustadoPct, 27, "50 x 0.54 = 27");
      t.igual(h.categoria, "moderado", "14% ajustado -> moderado");
      t.igual(m.categoria, "alto", "27% ajustado -> alto");
    });

    // [auditoría 25-ago, hallazgo 1.11] mtrAscvdPceCrudo elige ecuación con
    // mtrEsSexoFemenino(sexo) — femenina si es cierto, MASCULINA en cualquier otro caso
    // (incluido sexo ausente). El factor de ajuste Colombia elegía con
    // mtrEsSexoMasculino(sexo) — una función DISTINTA que, con sexo ausente, TAMBIÉN da
    // false. El crudo salía calculado con la ecuación masculina pero el factor aplicado
    // era el FEMENINO (0.54 en vez de 0.28): casi el doble de riesgo ajustado.
    t.caso("PASO 4 — con sexo AUSENTE, el factor de ajuste debe parear con la ecuación realmente usada (la masculina)", () => {
      // Mismo paciente, calculado desde cero (sin ascvd10yCrudo fijo) para que el crudo
      // salga de mtrAscvdPceCrudo — que con sexo ausente usa su rama masculina (else).
      const base = { egfrCkdepi: 90, edad: 55, ct: 240, hdl: 40, paSistolica: 140 };
      const sinSexo = api.mtrClasificarRiesgoCv(base);
      const conHombre = api.mtrClasificarRiesgoCv(Object.assign({}, base, { sexo: "Hombre" }));
      t.igual(sinSexo.ascvdAjustadoPct, conHombre.ascvdAjustadoPct,
        "sexo ausente debe dar EXACTAMENTE el mismo % que 'Hombre' (misma ecuación, mismo factor) — antes salía casi el doble");
      t.igual(sinSexo.categoria, conHombre.categoria, "y por tanto la misma categoría de riesgo");
      // Con sexo femenino real, sí debe usar el factor de mujer (0.54), distinto del de hombre.
      const conMujer = api.mtrClasificarRiesgoCv(Object.assign({}, base, { sexo: "Mujer" }));
      t.cierto(conMujer.ascvdAjustadoPct !== conHombre.ascvdAjustadoPct, "una mujer real sí debe dar un ajuste distinto al de un hombre");
    });

    t.caso("sin TFG no se inventa categoría: se dice qué falta y no se lanza", () => {
      let r = null;
      t.noLanza(() => { r = api.mtrClasificarRiesgoCv({ edad: 60, sexo: "M" }); }, "no debe tumbar la consulta");
      t.igual(r.categoria, null, "sin TFG no hay categoría");
      t.igual(r.motivo, "tfg_requerida", "y se dice por qué");
      t.falso(r.datosCompletos, "los datos no están completos");
    });

    // ================= METAS =================
    t.caso("las metas de LDL y de colesterol no-HDL son las de la norma", () => {
      t.igual(api.mtrMetasLipidicas("muy alto").ldl, 55, "muy alto");
      t.igual(api.mtrMetasLipidicas("alto").ldl, 70, "alto");
      t.igual(api.mtrMetasLipidicas("moderado").ldl, 100, "moderado");
      t.igual(api.mtrMetasLipidicas("bajo").ldl, 116, "bajo");
      t.igual(api.mtrMetasLipidicas("muy alto").cnoHdl, 85, "cnoHDL muy alto");
      t.igual(api.mtrMetasLipidicas("bajo").cnoHdl, 150, "cnoHDL bajo");
    });

    t.caso("una meta previa solo puede APRETAR la meta, nunca aflojarla", () => {
      t.igual(api.mtrMetasLipidicas("moderado", 70).ldl, 70, "la previa más baja manda");
      t.igual(api.mtrMetasLipidicas("muy alto", 100).ldl, 55, "la previa más alta NO afloja la meta");
    });

    t.caso("estar bajo la meta sin la reducción del 50% es meta PARCIAL, no meta cumplida", () => {
      // ALTO exige LDL<70 Y reducción >=50% desde el basal.
      const r = api.mtrEvaluarMetaLdl("alto", 65, 100);
      t.igual(r.estado, "meta_parcial", "LDL 65 (<70) pero solo 35% de reducción");
      const ok = api.mtrEvaluarMetaLdl("alto", 65, 140);
      t.igual(ok.estado, "en_meta", "LDL 65 con 53.6% de reducción");
    });

    // ===== v16.9.0 — DE DÓNDE SALE EL LDL BASAL =====
    // Decisión del médico (20-ago): «el más alto del histórico de un año»; sin histórico,
    // la reducción NO es evaluable. Hasta aquí NADIE suministraba el basal: llegaba
    // undefined, la reducción salía null y el criterio de «≥50 % desde el basal» era
    // inalcanzable por construcción — un paciente de riesgo alto por DEBAJO de su meta
    // se quedaba en «meta parcial» para siempre.
    t.caso("mtrLdlBasalDeSerie: el basal es el MÁS ALTO de los controles previos del último año", () => {
      const serie = [
        { fecha: "2025-10-01", valor: 160 },
        { fecha: "2026-02-01", valor: 145 },
        { fecha: "2026-08-01", valor: 70 },
      ];
      const b = api.mtrLdlBasalDeSerie(serie, "2026-08-21", 365);
      t.igual(b.valor, 160, "el punto de partida del tratamiento, no el promedio ni el primero de la lista");
      t.igual(b.fecha, "2025-10-01", "y se dice cuándo fue, para que el médico lo compruebe");
      t.igual(b.nPrevios, 2, "sobre los controles ANTERIORES al último");
    });

    t.caso("_isoAMs: la fecha ISO se parsea a mano, no con Date.parse (que cambia de huso según el navegador)", () => {
      const a = api._isoAMs("2026-08-21");
      const b = api._isoAMs("2026-08-20");
      t.cierto(typeof a === "number" && typeof b === "number", "devuelve milisegundos");
      t.igual(Math.round((a - b) / 86400000), 1, "un día de diferencia es exactamente un día");
      t.igual(api._isoAMs("2026-08-21T14:30:00"), a, "la hora sobra: se compara por día");
      t.igual(api._isoAMs("sin fecha"), null, "lo que no es ISO no se adivina");
      t.igual(api._isoAMs(null), null, "ni null");
      t.igual(api._isoAMs(""), null, "ni vacío");
    });

    t.caso("mtrLdlBasalDeSerie: un solo control no tiene «antes» — no evaluable, que no es «no ha reducido»", () => {
      t.igual(api.mtrLdlBasalDeSerie([{ fecha: "2026-08-01", valor: 70 }], "2026-08-21", 365), null);
      t.igual(api.mtrLdlBasalDeSerie([], "2026-08-21", 365), null, "sin serie tampoco");
      t.igual(api.mtrLdlBasalDeSerie(null, "2026-08-21", 365), null, "y null no lanza");
    });

    t.caso("mtrLdlBasalDeSerie: lo de hace tres años NO es el basal del tratamiento de este año", () => {
      const serie = [{ fecha: "2020-01-01", valor: 200 }, { fecha: "2026-08-01", valor: 70 }];
      t.igual(api.mtrLdlBasalDeSerie(serie, "2026-08-21", 365), null, "fuera de la ventana de 365 días");
      const dentro = api.mtrLdlBasalDeSerie(serie, "2026-08-21", 3650);
      t.igual(dentro.valor, 200, "con la ventana abierta a diez años, sí entra");
    });

    t.caso("mtrResumenClinico: deduce el basal de la serie y publica la reducción con su fecha", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-21", edad: 66, sexo: "F", ldl: 70, creatinina: 1.1, pesoKg: 70,
        factores: { diabetes: true, hta: true, ecvAterescleroticaEstablecida: true },
        seriesLdl: [{ fecha: "2025-10-01", valor: 160 }, { fecha: "2026-08-01", valor: 70 }],
      });
      t.igual(r.meta.ldlBasal, 160, "el basal salió de la serie de Athenea");
      t.igual(r.meta.ldlBasalFecha, "2025-10-01", "con su fecha");
      t.cierto(r.meta.reduccionPct >= 56 && r.meta.reduccionPct <= 57, "y la reducción se puede calcular por fin (" + r.meta.reduccionPct + " %)");
      const sinSerie = api.mtrResumenClinico({
        hoyIso: "2026-08-21", edad: 66, sexo: "F", ldl: 70, creatinina: 1.1, pesoKg: 70,
        factores: { diabetes: true, hta: true, ecvAterescleroticaEstablecida: true },
      });
      t.igual(sinSerie.meta.reduccionPct, null, "sin serie no se inventa un basal");
      t.igual(sinSerie.meta.ldlBasal, null, "y se declara ausente");
    });

    t.caso("falta de LDL no se confunde con estar fuera de meta", () => {
      const r = api.mtrEvaluarMetaLdl("alto", null, 140);
      t.igual(r.estado, "sin_ldl", "sin LDL no se puede decir si está en meta");
      t.igual(r.enMeta, null, "ni true ni false: null");
    });

    t.caso("falla terapéutica a meta+15% y grave a meta+30%", () => {
      const leve = api.mtrEvaluarMetaLdl("alto", 81, null);   // 70 * 1.15 = 80.5
      t.cierto(leve.falla, "81 supera 80.5");
      t.falso(leve.fallaGrave, "81 no llega a 91");
      const grave = api.mtrEvaluarMetaLdl("alto", 92, null);  // 70 * 1.30 = 91
      t.cierto(grave.fallaGrave, "92 supera 91");
    });

    // ================= FUNCIÓN RENAL =================
    t.caso("Cockcroft-Gault y CKD-EPI se calculan las DOS y se declaran por separado", () => {
      const r = api.mtrEvaluarErc({ edad: 72, sexo: "F", pesoKg: 58, creatinina: 1.4 });
      // C-G = ((140-72)*58)/(72*1.4)*0.85 = 33.26
      t.cierto(Math.abs(r.crcl - 33.3) < 0.2, "CrCl debía ser ~33.3, dio " + r.crcl);
      t.igual(r.estadioAdministrativo, "G3b", "estadio administrativo por Cockcroft-Gault");
      t.cierto(r.egfr > 33 && r.egfr < 50, "eGFR CKD-EPI debía quedar en la treintena/cuarentena, dio " + r.egfr);
      t.cierto(!!r.estadioClinico, "el estadio clínico no puede quedar vacío con estos datos");
    });

    t.caso("sin peso NO se inventa un Cockcroft-Gault, pero el CKD-EPI sí sale", () => {
      const r = api.mtrEvaluarErc({ edad: 72, sexo: "F", creatinina: 1.4 });
      t.igual(r.crcl, null, "sin peso no hay Cockcroft-Gault");
      t.igual(r.estadioAdministrativo, null, "y por tanto no hay estadio administrativo");
      t.cierto(r.egfr !== null, "el CKD-EPI no necesita peso");
      t.falso(r.datosCompletos, "los datos no están completos");
      t.cierto(r.faltan.indexOf("peso") >= 0, "y se dice que falta el peso");
    });

    t.caso("los datos fuera de rango dan null, JAMÁS un estadio G5 por defecto", () => {
      const r = api.mtrEvaluarErc({ edad: 9, sexo: "M", pesoKg: 25, creatinina: 0.5 });
      t.igual(r.estadioAdministrativo, null, "9 años queda fuera de la guarda 18-120");
      t.igual(r.estadioClinico, null, "y tampoco se clasifica el clínico");
      const r2 = api.mtrEvaluarErc({ edad: 60, sexo: "M", pesoKg: 70, creatinina: 40 });
      t.igual(r2.estadioAdministrativo, null, "creatinina 40 queda fuera de la guarda 0.1-20");
    });

    // [auditoría 25-ago, hallazgo 1.5] con sexo vacío, mtrEsSexoFemenino da false y AMBAS
    // fórmulas se calculan como hombre: una mujer sin sexo registrado sube un estadio
    // administrativo entero (G2 en vez de G3a) sin que nada distinga "calculado con un
    // supuesto" de "calculado con dato real". `sexoAusente` expone esa diferencia.
    t.caso("sexo ausente: el número sale calculado COMO HOMBRE y sube el estadio; sexoAusente avisa que es un supuesto", () => {
      const sinSexo = api.mtrEvaluarErc({ edad: 70, pesoKg: 70, creatinina: 1.0, sexo: "" });
      t.igual(sinSexo.crcl, 68.1, "sin sexo, el CrCl se calcula como si fuera hombre");
      t.igual(sinSexo.estadioAdministrativo, "G2", "y el estadio sale un grado mejor de lo real");
      t.cierto(sinSexo.sexoAusente, "sexoAusente debe avisar que este número es un supuesto, no un dato real");

      const conF = api.mtrEvaluarErc({ edad: 70, pesoKg: 70, creatinina: 1.0, sexo: "F" });
      t.igual(conF.crcl, 57.8, "la misma paciente, con sexo real, tiene un CrCl distinto");
      t.igual(conF.estadioAdministrativo, "G3a", "un estadio administrativo entero más avanzado");
      t.falso(conF.sexoAusente, "con sexo real, sexoAusente debe ser false");
    });

    t.caso("cuando el estadio clínico es PEOR que el administrativo, las dosis lo siguen a él", () => {
      // Peso alto infla el Cockcroft-Gault: administrativo mejor que el clínico.
      const r = api.mtrEvaluarErc({ edad: 70, sexo: "M", pesoKg: 120, creatinina: 1.9 });
      const pAdmin = api.mtrPosEstadio(r.estadioAdministrativo);
      const pClin = api.mtrPosEstadio(r.estadioClinico);
      t.cierto(pClin >= pAdmin, "con peso 120 el clínico debía ser igual o peor que el administrativo");
      t.igual(r.estadioParaDosis, r.estadioClinico, "las dosis siguen al peor de los dos");
    });

    t.caso("remisión a nefrología por los tres criterios de la norma", () => {
      t.cierto(api.mtrRemisionNefrologia(28, null, null).remitir, "eGFR<30");
      t.cierto(api.mtrRemisionNefrologia(50, 350, null).remitir, "RAC>=300");
      t.cierto(api.mtrRemisionNefrologia(44, null, 62).remitir, "caída >=25% con cambio de estadio (62->44)");
      t.falso(api.mtrRemisionNefrologia(85, 12, 88).remitir, "paciente estable: no se remite");
    });

    t.caso("una caída brusca de la TFG se marca como posible lesión renal aguda", () => {
      t.cierto(api.mtrSospechaIra(44, 62), "caída del 29% con cambio de estadio");
      t.falso(api.mtrSospechaIra(86, 88), "variación normal");
      t.falso(api.mtrSospechaIra(80, null), "sin creatinina previa no se sospecha nada");
    });

    t.caso("'Mujer' se reconoce como femenino (el DOM de Everest rotula así el sexo)", () => {
      // El mapa de Everest trae `Sex_radio` con etiquetas "Mujer"/"Hombre".
      t.cierto(api.mtrEsSexoFemenino("Mujer"), "'Mujer' debía ser femenino");
      t.cierto(api.mtrEsSexoFemenino("F"), "'F' debía ser femenino");
      t.cierto(api.mtrEsSexoFemenino("FEMENINO"), "'FEMENINO' debía ser femenino");
      t.falso(api.mtrEsSexoFemenino("Hombre"), "'Hombre' no es femenino");
      t.cierto(api.mtrEsSexoMasculino("Hombre"), "'Hombre' debía ser masculino");
      // Y el factor 0.85 se aplica de verdad con esa forma del dato.
      const m = api.mtrEvaluarErc({ edad: 60, sexo: "Mujer", pesoKg: 70, creatinina: 1.0 });
      const h = api.mtrEvaluarErc({ edad: 60, sexo: "Hombre", pesoKg: 70, creatinina: 1.0 });
      t.cierto(m.crcl < h.crcl, "la mujer debía tener menor CrCl por el factor 0.85");
    });
  },
};
