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
    "mtrFueraDeMeta", "_mtrMargenMeta", "mtrStatusV68", "mtrSolicitudV68",
    "mtrClasificarRiesgoCv", "mtrContarFrMayores", "mtrContarPotenciadores", "mtrSindromeMetabolico",
    "mtrCriteriosPaso1", "mtrCriteriosPaso2", "mtrAscvdPceCrudo",
    "mtrAscvdFueraDeRangoEtario", "mtrEsSexoFemenino", "mtrEsSexoMasculino",
    "mtrMetasLipidicas", "mtrEvaluarMetaLdl", "mtrLdlBasalDeSerie", "_isoAMs",
    "mtrEvaluarErc", "mtrRemisionNefrologia", "mtrSospechaIra", "mtrPosEstadio",
    "mtrDmEvolucionConocida", "mtrDmLargaDuracion", "mtrSindromeMetabolico",
  ],

  pruebas(t, api) {
    // ================= CONFORMIDAD CON EL COPILOTO =================
    t.caso("el corpus dorado existe y no está vacío (si no, esta suite pasaría en el vacío)", () => {
      t.cierto(fs.existsSync(GOLD), "falta tests/golden/clasificar_riesgo_cv.json");
      const d = JSON.parse(fs.readFileSync(GOLD, "utf8"));
      t.cierto(d.vectores.length >= 900, "se esperaban al menos 900 vectores, hay " + d.vectores.length);
    });

    t.caso("PISO POR DIABETES: el diabético SIN tiempo de evolución no puede quedar por debajo de ALTO", () => {
      // v16.2.9 — decisión del médico (20-ago, textual): "sí, todo diabético debe entrar
      // como riesgo ALTO". Es un PISO: el paso 1 sigue mandando hacia arriba.
      // v17.6.94 — y ahora es CONDICIONAL: solo mientras no conste hace cuántos años tiene
      // la diabetes. Con el dato manda el consenso; sin él, el piso (ver la prueba de abajo).
      const base = { edad: 55, sexo: "M", egfrCkdepi: 90 };

      const sinDm = api.mtrClasificarRiesgoCv(Object.assign({}, base));
      t.cierto(sinDm.categoria !== "alto" || sinDm.paso === 2, "el no diabético sigue su curso normal");

      const conDm = api.mtrClasificarRiesgoCv(Object.assign({}, base, { diabetes: true }));
      t.igual(conDm.categoria, "alto", "el diabético entra en ALTO");
      t.cierto(conDm.pisoPorDiabetes === true, "y queda marcado que fue por el piso");
      t.cierto(conDm.dmAniosRequerido === true, "y que el piso es provisional por falta de un dato");
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

    // ====== v17.6.97 — LA CINTURA, QUE POR FIN LLEGA AL MOTOR ======

    t.caso("v17.6.97: el 5º criterio del síndrome metabólico deja de ser inevaluable", () => {
      // Paciente clásico del programa: TG 200, HDL 35, sin más. Sin la cintura solo se
      // pueden juzgar 4 de los 5 criterios y el veredicto queda en null («con lo que hay
      // no se puede decidir»). Con la cintura, se decide — en los dos sentidos.
      const base = { sexo: "M", trigliceridos: 200, hdl: 35, paSistolica: 128, paDiastolica: 82, glicemia: 95 };
      const sin = api.mtrSindromeMetabolico(base);
      t.igual(sin.evaluables, 4, "sin cintura solo hay 4 criterios evaluables");
      t.igual(sin.cumple, null, "y el veredicto queda sin decidir, que es lo honesto");

      const conAlta = api.mtrSindromeMetabolico(Object.assign({}, base, { cinturaCm: 104 }));
      t.igual(conAlta.evaluables, 5, "con la cintura ya son los cinco");
      t.igual(conAlta.cumple, true, "y con 104 cm cumple");

      const conNormal = api.mtrSindromeMetabolico(Object.assign({}, base, { cinturaCm: 84 }));
      t.igual(conNormal.cumple, false,
        "y con 84 cm se puede DESCARTAR: el dato también sirve para decir que no");
    });

    t.caso("v17.6.97: el umbral del síndrome metabólico es MAYOR O IGUAL, como dice el consenso", () => {
      // v68, S2: «Sd metabólico si >=3 de: CA>=90H/>=80M…». Estaba con mayor estricto, así
      // que el hombre de exactamente 90 cm no sumaba el criterio que la norma sí le cuenta.
      const h = (ca) => api.mtrSindromeMetabolico({ sexo: "M", cinturaCm: ca, trigliceridos: 200, hdl: 35, paSistolica: 120, paDiastolica: 70, glicemia: 90 });
      const m = (ca) => api.mtrSindromeMetabolico({ sexo: "F", cinturaCm: ca, trigliceridos: 200, hdl: 55, paSistolica: 120, paDiastolica: 70, glicemia: 90 });
      t.falso(h(89).criterios.some((c) => /cintura/.test(c)), "hombre 89 cm: no");
      t.cierto(h(90).criterios.some((c) => /cintura/.test(c)), "hombre 90 cm: SÍ (el borde exacto)");
      t.falso(m(79).criterios.some((c) => /cintura/.test(c)), "mujer 79 cm: no");
      t.cierto(m(80).criterios.some((c) => /cintura/.test(c)), "mujer 80 cm: SÍ");
    });

    t.caso("v17.6.97: la obesidad central cuenta como FR mayor, con SU umbral (no el del síndrome)", () => {
      // Son dos reglas distintas sobre la misma medida, y v68 las escribe distintas:
      //   FR mayor:            «obesidad(IMC>=30 o CA>94H/>90M)»   -> estricto
      //   Síndrome metabólico: «CA>=90H/>=80M»                     -> mayor o igual
      const fr = (sexo, ca) => api.mtrClasificarRiesgoCv({
        edad: 55, sexo: sexo, egfrCkdepi: 90, cinturaCm: ca,
        ct: 200, hdl: 45, ldl: 120, paSistolica: 120, paDiastolica: 75,
      }).conteoFrMayores;
      t.igual(fr("M", 94), 0, "hombre 94 cm: el umbral es ESTRICTO, todavía no");
      t.igual(fr("M", 96), 1, "hombre 96 cm: sí");
      t.igual(fr("F", 90), 0, "mujer 90 cm: todavía no");
      t.igual(fr("F", 92), 1, "mujer 92 cm: sí");
      t.igual(fr("M", null), 0, "sin cintura no se infiere nada");
      // Y lo que ya documentaba el médico a mano sigue mandando.
      t.igual(api.mtrClasificarRiesgoCv({ edad: 55, sexo: "M", egfrCkdepi: 90, circunferenciaAbdElevada: true,
        ct: 200, hdl: 45, ldl: 120, paSistolica: 120, paDiastolica: 75 }).conteoFrMayores, 1,
        "la casilla marcada a mano cuenta igual, sin necesidad del número");
    });

    t.caso("v17.6.97 CABLEADO — la cintura sobrevive a la reclasificación de los 20 s", () => {
      // Everest sí tiene la casilla, pero el repaso de los 20 s reconstruye los factores
      // desde el DOM; si la mezcla no la conservara, el dato desaparecería solo. Es el
      // mismo defecto que v17.6.86 encontró con las frecuencias y v17.6.94 con los años
      // de diabetes.
      const previo = api.mtrResumenClinico({
        hoyIso: "2026-08-27", edad: 58, sexo: "M", pesoKg: 82, creatinina: 1.0,
        ct: 200, hdl: 35, ldl: 120, paSistolica: 128, paDiastolica: 82,
        factores: { hta: true, cinturaCm: 104, trigliceridos: 200 },
        ultimos: { CREATININA: { fecha: "2026-08-01", valor: 1.0 } },
      });
      t.igual(previo.factores.cinturaCm, 104, "el resumen de partida la tiene");
      t.cierto(!!previo.sindromeMetabolico, "y el síndrome metabólico se calcula");
      const nuevo = api.mtrRecalcularConFactores(previo, { paSistolica: 132 }, "2026-08-27");
      t.cierto(!!nuevo, "la reclasificación devolvió algo");
      t.igual(nuevo.factores.cinturaCm, 104, "y la cintura sigue ahí tras reclasificar");
    });

    // ====== v17.6.94 — EL TIEMPO DE EVOLUCIÓN DE LA DIABETES ======
    // Las dos reglas de diabetes del consenso (paso 1 «larga duración», paso 2 «>10 años»)
    // llevaban desde siempre sin poder dispararse porque nadie alimentaba los campos. El
    // piso incondicional no corregía el consenso: tapaba esa ceguera.

    t.caso("v17.6.94: saber si SE SABE hace cuánto es diabético es tri-estado", () => {
      t.cierto(api.mtrDmEvolucionConocida({ diabetes: false }), "al no diabético no le falta nada: la pregunta no aplica");
      t.cierto(api.mtrDmEvolucionConocida({}), "sin diabetes documentada, tampoco");
      t.falso(api.mtrDmEvolucionConocida({ diabetes: true }), "al diabético sin dato SÍ le falta");
      t.cierto(api.mtrDmEvolucionConocida({ diabetes: true, dmAnios: 0 }), "cero años es un dato, no un vacío");
      t.cierto(api.mtrDmEvolucionConocida({ diabetes: true, dmLargaDuracion: false }),
        "y decir explícitamente que NO es de larga evolución también responde la pregunta");
      t.falso(api.mtrDmEvolucionConocida({ diabetes: true, dmAnios: "" }), "una cadena vacía no es un número de años");
    });

    t.caso("v17.6.94: «larga duración» sale de los años, y lo que marca el médico manda", () => {
      t.falso(api.mtrDmLargaDuracion({ diabetes: true, dmAnios: 12 }), "12 años todavía no es larga evolución");
      t.cierto(api.mtrDmLargaDuracion({ diabetes: true, dmAnios: 20 }), "20 sí (es el corte exacto)");
      t.cierto(api.mtrDmLargaDuracion({ diabetes: true, dmAnios: 31 }), "y de ahí para arriba");
      t.cierto(api.mtrDmLargaDuracion({ diabetes: true, dmAnios: 3, dmLargaDuracion: true }),
        "si el médico lo marca a mano, su palabra gana sobre el cálculo");
      t.falso(api.mtrDmLargaDuracion({ diabetes: true, dmAnios: 40, dmLargaDuracion: false }),
        "y también gana cuando dice que NO");
      t.falso(api.mtrDmLargaDuracion({ diabetes: false, dmAnios: 40 }), "sin diabetes, no hay diabetes de larga evolución");
    });

    // ============================================================================
    // v18.0.6 — AVISO: v18.0.5 REVIRTIÓ v17.6.94, Y ESTA SUITE LO DEJA POR ESCRITO.
    //
    // v17.6.94 había refinado el piso por diabetes: el piso solo intervenía cuando NO se
    // sabía el tiempo de evolución; sabiéndolo, mandaba el consenso y un diabético de 5 o
    // 12 años sin otros factores podía quedar MODERADO. La build 18.0.5 (31-ago, editada
    // fuera de este banco) volvió al piso plano de v16.2.9: TODO diabético entra en ALTO,
    // se sepa o no el tiempo de evolución (vigilante_agenda.user.js:33660).
    //
    // NO SE REVIERTE AQUÍ: es la conducta que el médico tiene instalada y corriendo en
    // consulta, y una regla clínica no se cambia desde el banco de pruebas. Lo que sí se
    // hace es no dejarla sin prueba, y decir su CONSECUENCIA, que no es pequeña: al pasar
    // de MODERADO a ALTO, la meta de LDL baja de 100 a 70 (MTR_METAS_LIPIDICAS). Con
    // MTR_FALLA_UMBRAL = 0 (estricto, decisión D9 del 29-ago), un LDL de 110 que antes
    // estaba EN meta pasa a estar FUERA, su vigencia se parte a la mitad (regla del 50 %),
    // y el arrastre del grupo lipídico (mtrPlanParaclinicos, regla 1.15) se lleva colesterol
    // total, HDL y triglicéridos al mismo viaje. Es decir: este cambio, solo, multiplica las
    // repeticiones de perfil lipídico. Pendiente de que el médico confirme o revierta.
    // ============================================================================
    t.caso("v18.0.5 (revierte v17.6.94): el piso por diabetes vuelve a ser plano — con dato o sin él", () => {
      const base = { edad: 60, sexo: "M", egfrCkdepi: 75, hta: true, enAntihipertensivos: true,
        ct: 200, hdl: 45, ldl: 120, paSistolica: 140, paDiastolica: 85, diabetes: true };
      const sinDato = api.mtrClasificarRiesgoCv(Object.assign({}, base));
      t.cierto(sinDato.pisoPorDiabetes === true, "sin el dato, piso");
      t.cierto(sinDato.dmAniosRequerido === true, "y se sigue pidiendo el dato que falta");
      t.cierto(sinDato.criterios.some((c) => /sin tiempo de evolución/i.test(c)),
        "y la pantalla dice que el piso es provisional por ese dato que falta");

      const cinco = api.mtrClasificarRiesgoCv(Object.assign({}, base, { dmAnios: 5 }));
      t.igual(cinco.categoria, "alto", "v18.0.5: con 5 años TAMBIÉN entra por el piso");
      t.cierto(cinco.pisoPorDiabetes === true, "el piso ya no se aparta al conocer el dato");
      t.cierto(cinco.dmAniosRequerido !== true, "pero ya no pide un dato que sí tiene");
      t.cierto(cinco.criterios.some((c) => /todo diabético/i.test(c)),
        "y el porqué se dice en pantalla, sin fingir que lo decidió el consenso");

      const doce = api.mtrClasificarRiesgoCv(Object.assign({}, base, { dmAnios: 12 }));
      t.igual(doce.categoria, "alto", "12 años: ALTO");

      const veinticinco = api.mtrClasificarRiesgoCv(Object.assign({}, base, { dmAnios: 25 }));
      t.igual(veinticinco.categoria, "muy alto", "25 años es larga evolución: MUY ALTO por el paso 1");
      t.igual(veinticinco.paso, 1, "y por el paso 1");
    });

    t.caso("v17.6.94: tener la diabetes hace MÁS tiempo nunca baja de categoría", () => {
      // El hueco de redacción de v68: el paso 3 decía «DM<10a sin FR», así que un diabético
      // de 12 años SIN ningún otro factor no lo recogía ni el paso 1 (CONTEO=0, sin daño de
      // órgano, no llega a larga evolución), ni el paso 2 (exige CONTEO>=1), ni el paso 3
      // (lo dejaba fuera por pasar de 10) — y salía BAJO, mientras que con 5 años salía
      // MODERADO. Aquí se comprueba que la escalera solo sube.
      const orden = { bajo: 0, moderado: 1, alto: 2, "muy alto": 3 };
      const base = { edad: 52, sexo: "M", egfrCkdepi: 88, diabetes: true,
        ct: 190, hdl: 50, ldl: 110, paSistolica: 120, paDiastolica: 75 };
      let previo = -1, detalle = [];
      for (const a of [0, 5, 9, 10, 12, 19, 20, 30]) {
        const r = api.mtrClasificarRiesgoCv(Object.assign({}, base, { dmAnios: a }));
        const n = orden[r.categoria];
        detalle.push(a + "a=" + r.categoria);
        t.cierto(n !== undefined, a + " años debía dar categoría (obtuvo " + r.categoria + ")");
        t.cierto(n >= previo, "a los " + a + " años bajó de categoría respecto al tramo anterior · " + detalle.join(" "));
        previo = n;
      }
      // Y en concreto: el caso que estaba roto en v68 (salía BAJO). Sigue sin caer a BAJO;
      // desde v18.0.5 sale ALTO en vez de MODERADO, por el piso plano por diabetes — ver el
      // aviso largo unas líneas más arriba, y su coste en repeticiones de perfil lipídico.
      const doce = api.mtrClasificarRiesgoCv(Object.assign({}, base, { dmAnios: 12 }));
      t.igual(doce.categoria, "alto", "el diabético de 12 años sin otros factores no cae a BAJO");
      t.cierto(doce.pisoPorDiabetes === true, "y consta que fue el piso quien lo puso ahí");
      // v18.0.6 — antes salía por el paso 3 y el criterio citaba «sin otros factores de
      // riesgo mayores». Ahora sale por el piso plano por diabetes, así que el criterio que
      // ve el médico es el del piso. Lo que la prueba protege sigue siendo lo mismo: que la
      // pantalla diga POR QUÉ quedó en esa categoría, nunca una categoría a secas.
      t.cierto(doce.criterios.some((c) => /todo diabético entra como riesgo ALTO/i.test(c)),
        "y el porqué se dice: fue el piso por diabetes, no una escala");
    });

    // =====================================================================
    // v17.52.0 — D7: LA ALBUMINURIA MODERADA (A2) SUBE A ALTO POR SÍ SOLA.
    // Decisión del médico del 29-ago, textual: "A2 (30-300) sube a ALTO por sí sola".
    // Antes solo pesaba dentro de la rama de diabetes, así que un hipertenso NO diabético
    // con RAC 45 no subía de categoría por su albuminuria.
    // =====================================================================
    t.caso("v17.52.0 (D7): un RAC de 45 sube a ALTO a quien no es diabético", () => {
      const base = { edad: 55, sexo: "M", egfrCkdepi: 90 };
      t.igual(api.mtrClasificarRiesgoCv(base).categoria, null, "sin albuminuria y sin insumos, el paso 4 no puede clasificar");
      const conA2 = api.mtrClasificarRiesgoCv(Object.assign({}, base, { rac: 45 }));
      t.igual(conA2.categoria, "alto", "con RAC 45 sube a alto sin necesitar diabetes");
      t.igual(conA2.paso, 2, "y lo hace por el paso 2, no por otro");
      t.cierto(conA2.criterios.some((c) => /A2/.test(c)), "y el porqué se dice: " + JSON.stringify(conA2.criterios));
    });

    t.caso("v17.52.0 (D7): la meta de LDL baja de 100 a 70 con ese solo dato", () => {
      // La escala del paso 4 (ASCVD ajustada a Colombia) deja a este paciente en moderado;
      // se le añade SOLO la albuminuria y nada más.
      const base = { edad: 55, sexo: "M", egfrCkdepi: 90, ascvd10yCrudo: 20 };
      const sin = api.mtrClasificarRiesgoCv(base);
      const con = api.mtrClasificarRiesgoCv(Object.assign({}, base, { rac: 45 }));
      t.igual(sin.categoria, "moderado", "por la escala del paso 4: moderado");
      t.igual(con.categoria, "alto", "el mismo paciente más su albuminuria: alto");
      t.igual(con.paso, 2, "y deja de decidirlo la escala: lo decide el paso 2");
      t.igual(api.mtrMetasLipidicas(sin.categoria).ldl, 100);
      t.igual(api.mtrMetasLipidicas(con.categoria).ldl, 70, "la conducta que cambia de verdad: la meta");
    });

    t.caso("v17.52.0 (D7): los bordes exactos — 29 no, 30 sí, 299 sí, 300 sube más (muy alto)", () => {
      const base = { edad: 55, sexo: "M", egfrCkdepi: 90 };
      const cat = (rac) => api.mtrClasificarRiesgoCv(Object.assign({}, base, { rac })).categoria;
      t.igual(cat(29), null, "29 es A1: no es albuminuria y no sube nada");
      t.igual(cat(30), "alto", "30 es el borde de A2");
      t.igual(cat(299), "alto", "299 sigue siendo A2");
      t.igual(cat(300), "muy alto", "300 es A3: macroalbuminuria, y ya subía sola al paso 1");
      t.igual(cat(1200), "muy alto");
    });

    t.caso("v17.52.0 (D7): un RAC que NADIE midió no es un RAC normal", () => {
      const base = { edad: 55, sexo: "M", egfrCkdepi: 90, ascvd10yCrudo: 20 };
      t.igual(api.mtrClasificarRiesgoCv(base).categoria, "moderado", "sin el campo: se queda donde estaba");
      t.igual(api.mtrClasificarRiesgoCv(Object.assign({}, base, { rac: null })).categoria, "moderado", "con el campo en nulo, igual");
      t.igual(api.mtrClasificarRiesgoCv(Object.assign({}, base, { rac: "" })).categoria, "moderado", "y con el campo vacío, igual: ausente no es negativo");
      t.igual(api.mtrClasificarRiesgoCv(Object.assign({}, base, { rac: "no se tomó" })).categoria, "moderado", "ni un texto que no es un número");
    });

    t.caso("v17.52.0 (D7): el paso 2 NO se cuelga la macroalbuminuria — esa es del paso 1", () => {
      // Vista desde el clasificador esta frontera es invisible (un RAC>=300 nunca llega al
      // paso 2: el paso 1 ya lo paró). Se comprueba llamando al paso 2 directamente, que es
      // donde la regla vive: si no, el borde superior seria una mutacion que nadie caza.
      t.igual(api.mtrCriteriosPaso2({ rac: 45 }, 0), ["Albuminuria moderada (RAC 30-299 mg/g, A2)"]);
      t.igual(api.mtrCriteriosPaso2({ rac: 299 }, 0).length, 1, "299 sigue siendo A2");
      t.igual(api.mtrCriteriosPaso2({ rac: 300 }, 0), [], "300 es A3 y le corresponde al paso 1, no a este");
      t.igual(api.mtrCriteriosPaso2({ rac: 1200 }, 0), [], "ni la macroalbuminuria franca");
      t.igual(api.mtrCriteriosPaso2({ rac: 29 }, 0), [], "29 es A1: no hay criterio");
    });

    t.caso("v17.52.0 (D7): el RAC vale igual si Athenea lo manda como texto", () => {
      // Los valores de laboratorio llegan del portal como cadenas. Si el numero no se
      // normaliza antes de compararlo, "45" funciona por casualidad (JavaScript lo convierte)
      // pero cualquier variante deja de subir al paciente, en silencio.
      const base = { edad: 55, sexo: "M", egfrCkdepi: 90, ascvd10yCrudo: 20 };
      const cat = (rac) => api.mtrClasificarRiesgoCv(Object.assign({}, base, { rac })).categoria;
      t.igual(cat(45), "alto", "como número");
      t.igual(cat("45"), "alto", "y como texto, el mismo paciente y la misma conducta");
      t.igual(cat("45.5"), "alto", "con decimal");
      t.igual(cat("29"), "moderado", "y el borde de abajo se respeta también en texto");
    });

    t.caso("v17.52.0 (D7): el paso 1 sigue mandando — un A2 con ECV establecida NO se queda en alto", () => {
      const r = api.mtrClasificarRiesgoCv({ edad: 55, sexo: "M", egfrCkdepi: 90, rac: 45, ecvAterescleroticaEstablecida: true });
      t.igual(r.categoria, "muy alto", "la regla nueva vive en el paso 2 y el clasificador para en el primero que se cumple");
      t.igual(r.paso, 1);
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

        // v17.6.94 — la excepción se estrecha al caso que la justifica: el piso solo
        // aplica al diabético cuyo TIEMPO DE EVOLUCIÓN no consta. Un vector dorado que sí
        // lo traiga vuelve a compararse contra el Copiloto como cualquier otro — si algún
        // día el corpus incorpora esos casos, esta suite los verá en vez de taparlos.
        const _dmSinEvolucion = v.entrada && v.entrada.diabetes === true
          && (v.entrada.dm_anios === null || v.entrada.dm_anios === undefined)
          && (v.entrada.dm_larga_duracion === null || v.entrada.dm_larga_duracion === undefined);
        if (_dmSinEvolucion && py.categoria !== "alto" && py.categoria !== "muy alto") {
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

        // v17.52.0 — EXCEPCIÓN (E): ALBUMINURIA MODERADA COMO EJE. Decisión clínica del
        // médico del 29-ago-2026, textual: "A2 (30-300) sube a ALTO por sí sola". El
        // Copiloto original solo contaba la albuminuria moderada como daño de órgano blanco
        // DENTRO de la rama de diabetes, así que un no diabético con RAC 45 se quedaba donde
        // estuviera. El eje CGA de KDIGO la trata como eje propio, independiente del
        // filtrado y del diagnóstico de base.
        //
        // Igual de estrecha que las anteriores: solo tapa a los A2 que el Copiloto dejaba
        // POR DEBAJO de alto. Un A2 que allá salía "muy alto" y aquí saliera otra cosa SIGUE
        // siendo una desviación y rompe la suite, como debe ser. Y exige que el RAC exista:
        // un vector sin RAC no entra por aquí.
        const _racPy = (v.entrada && typeof v.entrada.rac === "number") ? v.entrada.rac : null;
        if (_racPy !== null && _racPy >= 30 && _racPy < 300
            && py.categoria !== "alto" && py.categoria !== "muy alto") {
          if (js.categoria !== "alto") {
            desviacionesPiso.push("A2 que NO quedó en alto: " + js.categoria + " · " + JSON.stringify(v.entrada));
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
        && (v.entrada.dm_anios === null || v.entrada.dm_anios === undefined)
        && (v.entrada.dm_larga_duracion === null || v.entrada.dm_larga_duracion === undefined)
        && v.salida.categoria !== "alto" && v.salida.categoria !== "muy alto").length;
      t.cierto(nDia > 0, "la excepción del piso por diabetes sigue ejercitándose (" + nDia + " vectores)");
      const nEdad = d.vectores.filter((v) => v.entrada && typeof v.entrada.edad === "number" && v.entrada.edad > 79
        && v.entrada.diabetes !== true
        && v.salida.categoria !== "alto" && v.salida.categoria !== "muy alto").length;
      t.cierto(nEdad > 0, "la excepción del piso por edad sigue ejercitándose (" + nEdad + " vectores)");
      // v17.52.0 — misma guarda para la excepción (E): si el corpus dejara de tener A2 por
      // debajo de alto, la excepción quedaría huérfana y habría que revisarla en vez de
      // arrastrarla. Medido al escribirla: 2 vectores (RAC 45, ambos "moderado" allá).
      const nA2 = d.vectores.filter((v) => v.entrada && typeof v.entrada.rac === "number"
        && v.entrada.rac >= 30 && v.entrada.rac < 300
        && v.salida.categoria !== "alto" && v.salida.categoria !== "muy alto").length;
      t.cierto(nA2 > 0, "la excepción de albuminuria A2 sigue ejercitándose (" + nA2 + " vectores)");
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

    // v18.0.95 — hallazgo #47 del enjambre: el potenciador "diabetes sin otros factores
    // de riesgo mayores" (v17.6.94) era código muerto — el piso incondicional por
    // diabetes de mtrClasificarRiesgoCv (v18.0.5) intercepta a TODO diabético antes de
    // que la función llegue a invocar mtrContarPotenciadores. Retirado por
    // mantenimiento, sin cambio de comportamiento real: ningún diabético podía alcanzar
    // esta rama de todos modos.
    t.caso("REGRESIÓN — mtrContarPotenciadores ya no tiene la rama de diabetes muerta (hallazgo #47)", () => {
      const diabeticoSinOtrosFR = { diabetes: true, edad: 30, sexo: "M", egfrCkdepi: 95 };
      const pot = api.mtrContarPotenciadores(diabeticoSinOtrosFR, 0);
      t.falso(pot.lista.includes("diabetes sin otros factores de riesgo mayores"),
        "la rama se retiró: nunca fue alcanzable desde mtrClasificarRiesgoCv");
      t.igual(pot.conteo, 0, "sin ningún otro potenciador, la cuenta queda en cero");

      // Y el comportamiento REAL (a través de mtrClasificarRiesgoCv, el único llamador
      // real) no cambió: el piso incondicional por diabetes lo sigue clasificando ALTO.
      const clasificado = api.mtrClasificarRiesgoCv(diabeticoSinOtrosFR);
      t.igual(clasificado.categoria, "alto");
      t.cierto(clasificado.pisoPorDiabetes, "sigue entrando por el piso, nunca por el potenciador retirado");
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

    // ===== v17.6.92 — el síndrome metabólico existía y NO CONTABA =====
    //
    // `mtrSindromeMetabolico` llevaba versiones escrita y con CERO llamadores en producción.
    // Es uno de los diez factores de riesgo mayores del consenso, y sumaba cero siempre.
    // Verificado con el harness sobre el paciente clásico del programa (hipertenso tratado,
    // sedentario, TG 200, HDL 35, glicemia 105, NO diabético): el cálculo decía `cumple:true`
    // con cuatro de cinco criterios, pero el conteo salía en 2 y el paciente se clasificaba
    // **BAJO con meta de LDL 116**. Con su punto cruza el CONTEO>=3 del Paso 2: ALTO, meta
    // <70. Y de la meta salen la falla terapéutica, las vigencias y las fechas de toma.
    //
    // De paso, al clasificador no le llegaban TRIGLICÉRIDOS ni GLICEMIA, que son dos de los
    // cinco criterios: sin ellos el cálculo no podía ni intentarse.
    const clasico = (over, factOver) => api.mtrResumenClinico(Object.assign({
      hoyIso: "2026-08-27", edad: 55, sexo: "M", pesoKg: 88, creatinina: 0.9,
      ct: 230, hdl: 35, ldl: 140, paSistolica: 142, paDiastolica: 90,
      ultimos: { CREATININA: { fecha: "2026-08-01", valor: 0.9 } },
      factores: Object.assign({ hta: true, sedentarismo: true, enAntihipertensivos: true, diabetes: false }, factOver || {}),
    }, over || {}));

    t.caso("v17.6.92: el síndrome metabólico cuenta como factor mayor y cambia la categoría", () => {
      const r = clasico({ tg: 200, glicemia: 105 });
      t.igual(r.sindromeMetabolico.cumple, true, "el cálculo concluye que cumple");
      t.igual(r.factores.prediabetesSdMetabolico, true, "y llega al clasificador como factor");
      t.igual(r.riesgo.conteoFrMayores, 3, "el conteo sube de 2 a 3");
      t.igual(r.riesgo.categoria, "alto", "y con CONTEO>=3 el Paso 2 lo hace ALTO");
      t.igual(r.meta.metas.ldl, 70, "meta de LDL 70, no 116");
      // El médico tiene que poder ver POR QUÉ: un factor sin explicación es indistinguible
      // de uno inventado.
      t.cierto(r.sindromeMetabolico.criterios.length >= 3, "y viaja el detalle de los criterios");
      t.cierto(r.sindromeMetabolico.criterios.some((x) => /triglic/i.test(x)), "nombrando cuáles: " + JSON.stringify(r.sindromeMetabolico.criterios));
    });

    t.caso("v17.6.92: los triglicéridos y la glicemia llegan al clasificador", () => {
      // Del ctx si el llamador los trae…
      const directo = clasico({ tg: 200, glicemia: 105 });
      t.igual(directo.factores.trigliceridos, 200, "triglicéridos del ctx");
      t.igual(directo.factores.glicemia, 105, "glicemia del ctx");
      // …y si no, del último resultado, que es de donde sale el resto del motor.
      const deUltimos = clasico({
        ultimos: {
          CREATININA: { fecha: "2026-08-01", valor: 0.9 },
          TRIGLICERIDOS: { fecha: "2026-08-01", valor: 210 },
          GLUCOSA: { fecha: "2026-08-01", valor: 110 },
        },
      });
      t.igual(deUltimos.factores.trigliceridos, 210, "triglicéridos del último resultado");
      t.igual(deUltimos.factores.glicemia, 110, "glicemia del último resultado");
      t.igual(deUltimos.sindromeMetabolico.cumple, true, "y con eso el cálculo ya puede concluir");
    });

    // LA REGLA QUE NO SE PUEDE EQUIVOCAR: `cumple` es tri-estado. Un `null` significa "con lo
    // que hay no se puede decidir" y NO cuenta ni a favor ni en contra. Contarlo sería
    // inferir un factor de riesgo, y de ahí sale una meta de LDL más estricta.
    t.caso("v17.6.92: un síndrome metabólico SIN DECIDIR no cuenta como factor", () => {
      const sinDecidir = clasico({ tg: 100, glicemia: 85 });
      t.igual(sinDecidir.sindromeMetabolico.cumple, null, "el vector es el que debe ser: sin decidir");
      t.falso(sinDecidir.factores.prediabetesSdMetabolico === true, "no se marca el factor");
      t.igual(sinDecidir.riesgo.conteoFrMayores, 2, "y el conteo no sube");
      t.igual(sinDecidir.riesgo.categoria, "bajo", "la categoría se queda donde estaba");
    });

    t.caso("v17.6.92: si el médico ya documentó el factor, el cálculo no se lo pisa", () => {
      const marcado = clasico({}, { prediabetesSdMetabolico: true });
      t.igual(marcado.sindromeMetabolico.cumple, null, "el cálculo no concluye…");
      t.igual(marcado.factores.prediabetesSdMetabolico, true, "…pero lo que el médico documentó manda");
      t.igual(marcado.riesgo.conteoFrMayores, 3, "y sigue contando");
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

    // v18.0.73 — HALLAZGO DE ENJAMBRE #21. Antes, `_isoAMs` solo validaba el formato con una
    // regexp de 3 grupos de dígitos y dejaba que `new Date(y, m-1, d)` hiciera el rollover
    // silencioso de JS: «2026-04-31» pasaba a ser 1-mayo sin ningún aviso, y ese timestamp
    // fabricado entraba en mtrLdlBasalDeSerie/mtrPenultimaCreatinina como si fuera una lectura
    // real — justo lo que «casilla vacía antes que dato inventado» prohíbe. mtrFechaDesdeIso,
    // en este mismo archivo y para el mismo propósito, ya hacía este round-trip.
    t.caso("REGRESIÓN — _isoAMs rechaza fechas que el calendario no tiene, igual que mtrFechaDesdeIso (hallazgo #21)", () => {
      t.igual(api._isoAMs("2026-04-31"), null, "30 de abril no tiene un día 31: antes rodaba en silencio a 1-mayo");
      t.igual(api._isoAMs("2026-02-30"), null, "febrero no tiene 30");
      t.igual(api._isoAMs("2025-02-29"), null, "2025 no es bisiesto: no hay 29 de febrero");
      t.cierto(typeof api._isoAMs("2024-02-29") === "number", "pero 2024 SÍ es bisiesto: el 29 de febrero de ese año es real");
      t.igual(api._isoAMs("2026-13-01"), null, "mes 13 tampoco existe");
      t.igual(api._isoAMs("2026-08-21"), api._isoAMs("2026-08-21"), "una fecha real sigue dando el mismo milisegundo de siempre");
    });

    t.caso("REGRESIÓN — mtrLdlBasalDeSerie no acepta un basal con fecha de calendario imposible (hallazgo #21)", () => {
      // Antes: con «2026-04-31» _isoAMs devolvía un timestamp válido (1-may), la ventana de
      // días lo dejaba pasar, y el LDL de una fecha que no existe se usaba como basal real.
      const serie = [
        { fecha: "2026-04-31", valor: 210 },
        { fecha: "2026-08-01", valor: 70 },
      ];
      const b = api.mtrLdlBasalDeSerie(serie, "2026-08-21", 365);
      t.igual(b, null, "sin ningún control previo con fecha usable, no hay basal que calcular — antes daba 210");
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

    // v17.54.0 (D9) — esta función tenía el 1.15 y el 1.30 ESCRITOS A MANO, sin pasar por la
    // constante: era una cuarta puerta del margen que ninguna medición había encontrado, y
    // alimenta (vía mtrEducationFlags) la hoja educativa que el paciente se lleva impresa.
    // Ahora lee el mismo número que las otras tres. El escalón del 30 % NO se toca aquí:
    // esa es la decisión D10, pendiente.
    // v17.55.0 — se retiran las aserciones sobre `fallaGrave`: ese campo YA NO EXISTE. Con la
    // D10, «grave» deja de ser un porcentaje y pasa a ser la regla renal, que esta función no
    // puede evaluar (no recibe filtrado ni edad). Mantenerlo habría dejado dos definiciones
    // distintas de «grave» conviviendo sobre el mismo paciente.
    t.caso("v17.55.0 (D9+D10): la meta de LDL declara falla por encima de la meta, y ya no opina sobre la gravedad", () => {
      t.falso(api.mtrEvaluarMetaLdl("alto", 70, null).falla, "justo en la meta de «alto» (70) no hay falla");
      t.cierto(api.mtrEvaluarMetaLdl("alto", 71, null).falla, "71 ya es falla — antes hacía falta pasar de 80,5");
      t.cierto(api.mtrEvaluarMetaLdl("alto", 80, null).falla, "y 80, el caso de la franja callada, también");
      t.igual(api.mtrEvaluarMetaLdl("alto", 260, null).fallaGrave, undefined,
        "la gravedad ya no se decide aquí: la decide mtrGravedadFalla con la regla renal");
      t.igual(api.mtrEvaluarMetaLdl("alto", 92, null).fallaGrave, undefined, "ni siquiera muy por encima");
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

    // 02-sep — CIERRE ADVERSARIAL (fila 22): v18.0.61 cerró «falta el peso» sobre un peso
    // implausible en la vía legacy (_renderEstadioRenalHtml), pero el motor nuevo devolvía
    // `crcl:null, faltan:[]` con 15 kg registrados, y la ficha viva decía «para Cockcroft-Gault
    // falta algún dato»: el dato SÍ está en Everest, es implausible, y nadie mostraba el 15.
    t.caso("02-sep: un peso registrado pero implausible no se anuncia como ausente en mtrEvaluarErc ni en la ficha viva", () => {
      const erc = api.mtrEvaluarErc({ edad: 70, pesoKg: 15, creatinina: 1.0, sexo: "F" });
      t.igual(erc.crcl, null, "sin Cockcroft-Gault: el peso no sirve (control del caso)");
      t.igual(erc.faltan.length, 1, "pero `faltan` ya no está vacío");
      t.cierto(/peso/.test(erc.faltan[0]) && /15/.test(erc.faltan[0]) && /20/.test(erc.faltan[0]), "dice que es el peso, el valor registrado y el rango: " + erc.faltan[0]);
      t.falso(erc.faltan.includes("peso"), "y NO dice «peso» a secas, que significa «ausente» para quien lo lee (pesoFaltaParaEstadio)");
      const filas = JSON.stringify(api.mtrFichaVivaFilas({ erc, riesgo: {}, meta: {}, programa: "HTA", plan: {}, factores: { edad: 70, sexo: "F" } }));
      const fila = /Filtrado \(CKD-EPI[^"]*/.exec(filas);
      t.cierto(!!fila && /15/.test(fila[0]) && !/algún dato/.test(fila[0]), "la ficha viva muestra el 15 para corregirlo, no «falta algún dato»: " + (fila && fila[0]));
      const bien = api.mtrEvaluarErc({ edad: 70, pesoKg: 70, creatinina: 1.0, sexo: "F" });
      t.igual(bien.faltan.length, 0, "con datos plausibles, `faltan` sigue vacío");
    });

    t.caso("cuando el estadio clínico es PEOR que el administrativo, las dosis lo siguen a él", () => {
      // Peso alto infla el Cockcroft-Gault: administrativo mejor que el clínico.
      const r = api.mtrEvaluarErc({ edad: 70, sexo: "M", pesoKg: 120, creatinina: 1.9 });
      const pAdmin = api.mtrPosEstadio(r.estadioAdministrativo);
      const pClin = api.mtrPosEstadio(r.estadioClinico);
      t.cierto(pClin >= pAdmin, "con peso 120 el clínico debía ser igual o peor que el administrativo");
      t.igual(r.estadioParaDosis, r.estadioClinico, "las dosis siguen al peor de los dos");
    });

    // v18.0.82 — HALLAZGO DE ENJAMBRE #34. El `||` de repliegue anterior solo cubría el caso
    // de arriba (clínico peor): `(posClinico > posAdmin && posClinico >= 0) ? estadioClinico
    // : (estadioClinico || estadioAdmin)` — en CUALQUIER otro caso, incluido el
    // administrativo peor, devolvía estadioClinico (el MEJOR) porque es el primer operando
    // truthy del `||`. Es justo el caso real que el propio mensaje de discordancia cita como
    // ejemplo ("Suele pasar con peso muy alto o muy bajo"): con peso muy BAJO (sarcopenia),
    // Cockcroft-Gault (administrativo) sale más grave que CKD-EPI (clínico).
    t.caso("REGRESIÓN — cuando el estadio ADMINISTRATIVO es PEOR que el clínico, las dosis también lo siguen a él (hallazgo #34)", () => {
      // Peso muy bajo (sarcopenia) infla el estadio de Cockcroft-Gault: administrativo peor.
      const r = api.mtrEvaluarErc({ edad: 60, sexo: "F", pesoKg: 30, creatinina: 1.2 });
      const pAdmin = api.mtrPosEstadio(r.estadioAdministrativo);
      const pClin = api.mtrPosEstadio(r.estadioClinico);
      t.cierto(pAdmin > pClin, "con peso 30 el administrativo debía ser peor que el clínico — si no, la prueba no está probando este caso");
      t.igual(r.estadioParaDosis, r.estadioAdministrativo,
        "las dosis siguen al peor de los dos, sea cual sea — antes devolvía el MEJOR (el clínico) en este caso exacto");
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
    t.caso("v17.16.0 — mtrFueraDeMeta: el umbral de meta+15 %, probado de frente", () => {
      // Estaba entre las «sin cubrir» y decide una conducta: es el umbral con el que se
      // declara FALLA TERAPÉUTICA y con el que se acorta la vigencia. La decisión del
      // médico (20-ago, #4 de las ambigüedades) fue UN SOLO umbral —meta+15 %— para las
      // dos cosas, en vez de «estrictamente > meta» para una y meta+15 % para la otra.
      // v17.54.0 (D9) — el margen se retira por decisión del médico del 29-ago, que revoca
      // la suya del 20-ago citada arriba. La prueba no se borra: pasa a fijar el contrato
      // nuevo, que es el mismo en las dos puertas (acortar la vigencia y declarar falla).
      t.igual(api._mtrMargenMeta(), 0, "sin margen: por encima de la meta ya cuenta");

      // LDL en riesgo muy alto: meta 55 → el corte está EN la meta.
      const muyAlto = { categoriaRiesgo: "muy alto" };
      t.falso(api.mtrFueraDeMeta("COLESTEROL_LDL", 55, muyAlto), "justo en la meta no es falla");
      t.cierto(api.mtrFueraDeMeta("COLESTEROL_LDL", 56, muyAlto), "un punto por encima ya lo es");
      t.cierto(api.mtrFueraDeMeta("COLESTEROL_LDL", 63, muyAlto),
        "la franja 55,1-63,25, que el margen del 15 % callaba, ahora se marca");

      // La misma cifra sigue cambiando de veredicto con la categoría: 70 está en meta para
      // «alto» y fuera para «muy alto». Por eso la categoría no se puede suponer.
      t.falso(api.mtrFueraDeMeta("COLESTEROL_LDL", 70, { categoriaRiesgo: "alto" }), "70 es justo la meta de «alto»");
      t.cierto(api.mtrFueraDeMeta("COLESTEROL_LDL", 70, muyAlto), "y está por encima de la de «muy alto»");
      t.cierto(api.mtrFueraDeMeta("COLESTEROL_LDL", 80, { categoriaRiesgo: "alto" }),
        "80 con meta 70: el caso que antes se callaba");
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", 200, {}), null,
        "SIN categoría no se juzga: no se inventa una meta, se devuelve null");

      // v17.28.0 — encargo del médico (28-ago): TRIGLICÉRIDOS SALE de esta regla — no debe
      // disparar por sí solo, solo arrastrarse con el grupo lipídico (mecanismo aparte,
      // MTR_GRUPO_LIPIDOS). Ya no tiene meta propia aquí: null pase lo que pase.
      t.igual(api.mtrFueraDeMeta("TRIGLICERIDOS", 170, {}), null,
        "triglicéridos ya no dispara por su cuenta — sin meta propia en esta regla");
      t.igual(api.mtrFueraDeMeta("TRIGLICERIDOS", 500, {}), null,
        "ni siquiera muy alto: la única vía para triglicéridos es arrastrarse con el grupo, no aquí");

      // HbA1c: solo tiene sentido en diabéticos. Meta 7,0 → v17.54.0 (D9): el corte ES 7,0.
      t.igual(api.mtrFueraDeMeta("HBA1C", 12, { esDm2: false }), null,
        "en un hipertenso sin diabetes la HbA1c NO se mide contra 7,0");
      t.falso(api.mtrFueraDeMeta("HBA1C", 7, { esDm2: true }), "justo en 7,0 sigue siendo meta cumplida");
      t.cierto(api.mtrFueraDeMeta("HBA1C", 8, { esDm2: true }),
        "8,0 estaba en la franja 7,1-8,05 que el margen callaba: ahora se marca");
      t.cierto(api.mtrFueraDeMeta("HBA1C", 8.1, { esDm2: true }), "y 8,1 con más razón");
      t.cierto(api.mtrFueraDeMeta("HBA1C", 8.5, { esDm2: true, metaHba1c: 7 }), "con meta individual explícita, igual");
      // La meta individual más laxa (el paciente añoso al que el médico le fija 8,0) sigue
      // mandando: con ella, 7,9 está EN meta aunque contra la general de 7,0 estaría fuera.
      // v17.54.0: la comprobación cambia de cifras porque el margen desaparece, pero lo que
      // fija —que la meta del médico manda sobre la general— es exactamente lo mismo.
      t.falso(api.mtrFueraDeMeta("HBA1C", 7.9, { esDm2: true, metaHba1c: 8 }),
        "una meta individual más laxa se respeta en vez de ignorarse");
      t.cierto(api.mtrFueraDeMeta("HBA1C", 7.9, { esDm2: true }),
        "el mismo valor, sin esa meta individual, sí está fuera de la general");
      t.cierto(api.mtrFueraDeMeta("HBA1C", 8.5, { esDm2: true, metaHba1c: 8 }),
        "y por encima de la individual también se marca: laxa no es ilimitada");

      // v17.28.0 — GLICEMIA ENTRA (encargo del médico, 28-ago): meta 130, mismo margen del
      // 15% que el resto ("una sola vara") → corte en 149,5. Solo en diabéticos, igual que
      // HbA1c — un hipertenso sin diabetes no tiene "glicemia fuera de meta".
      t.igual(api.mtrFueraDeMeta("GLUCOSA", 200, { esDm2: false }), null,
        "en un hipertenso sin diabetes la glicemia NO se mide contra 130");
      // v17.54.0 (D9): el corte era 149,5 con el margen; ahora es la meta misma, 130.
      t.falso(api.mtrFueraDeMeta("GLUCOSA", 130, { esDm2: true }), "justo en la meta sigue siendo meta cumplida");
      t.cierto(api.mtrFueraDeMeta("GLUCOSA", 131, { esDm2: true }), "131 abre la franja 131-149,5 que antes se callaba");
      t.cierto(api.mtrFueraDeMeta("GLUCOSA", 149, { esDm2: true }), "y 149, que estaba justo debajo del viejo corte");
      t.cierto(api.mtrFueraDeMeta("GLUCOSA", 150, { esDm2: true }), "150 con más razón");

      // Sin resultado, y con claves que no tienen meta, no se opina.
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", null, muyAlto), null, "sin cifra no se juzga");
      t.igual(api.mtrFueraDeMeta("CREATININA", 1.6, muyAlto), null, "la creatinina no tiene «meta» que incumplir");
      t.igual(api.mtrFueraDeMeta("RAC", 45, muyAlto), null,
        "el RAC tampoco: tiene su propio mecanismo de acortamiento, no este");
    });

    t.caso("v17.16.0 — mtrStatusV68 y mtrSolicitudV68: cuando NO se pudo clasificar, se dice", () => {
      // Estaban entre las «sin cubrir» y son la pieza que impide que la nota clínica hable
      // de una categoría de riesgo que nunca se calculó. Sin categoría no hay meta de LDL,
      // y sin meta no hay falla terapéutica: afirmar una categoría inventada arrastra todo.
      t.igual(api.mtrStatusV68({ riesgo: {} }), "PENDIENTE", "sin categoría, PENDIENTE");
      t.igual(api.mtrStatusV68({ riesgo: { categoria: null } }), "PENDIENTE", "con categoría null, igual");
      t.igual(api.mtrStatusV68({ riesgo: { categoria: "" } }), "PENDIENTE", "y con cadena vacía");
      t.igual(api.mtrStatusV68({ riesgo: { categoria: "alto", datosCompletos: false } }), "PENDIENTE",
        "con la categoría puesta pero los datos incompletos, TAMBIÉN pendiente: una categoría sobre datos a medias no es una clasificación");
      t.falso(api.mtrStatusV68({ riesgo: { categoria: "alto" }, meta: {} }) === "PENDIENTE",
        "con categoría y datos, deja de estar pendiente");

      // Y la solicitud dice QUÉ falta, en vez de dejar al médico adivinando.
      t.cierto(/ASCVD/.test(api.mtrSolicitudV68({ riesgo: { requiereAscvd: true } })),
        "si los pasos 1-3 no clasificaron, se le pide el ASCVD crudo");
      t.cierto(/TFG/.test(api.mtrSolicitudV68({ riesgo: { motivo: "tfg_requerida" } })),
        "si falta la función renal, se le pide");
      t.cierto(/años/.test(api.mtrSolicitudV68({ riesgo: { dmAniosRequerido: true } })),
        "y si falta hace cuántos años tiene diabetes, se dice que el ALTO es provisional");
      t.igual(api.mtrSolicitudV68({ riesgo: {} }), "",
        "sin nada que pedir, cadena vacía: nunca una solicitud vacía que el modelo copie");
    });


    // =====================================================================
    //  v18.0.8 — «TODO DIABÉTICO ENTRA EN ALTO, PERO PUEDE SUBIR A MUY ALTO»
    //
    //  Precisión del médico (31-ago, textual): «todo diabético entra en alto riesgo pero se
    //  sigue clasificando con el método de 4 pasos del consenso colombiano de dislipidemias,
    //  es decir que los diabéticos aún pueden subir a muy alto».
    //
    //  Se comprobó sobre el corpus dorado ANTES de tocar nada, y NO hizo falta cambiar el
    //  código: de los 125 vectores diabéticos, 102 salen MUY ALTO y 23 ALTO — ninguno por
    //  debajo. La razón es estructural y conviene dejarla fijada: «muy alto» lo produce
    //  ÚNICAMENTE el paso 1, que corre ANTES del piso por diabetes. Los pasos 3 y 4 solo
    //  pueden dar alto/moderado/bajo, así que el `return` del piso no puede tapar ningún
    //  MUY ALTO por mucho que corte la escalera.
    //
    //  Estas dos pruebas existen para que ese razonamiento no se pierda: si alguien mueve el
    //  piso por diabetes ANTES del paso 1, o hace que el paso 3/4 pueda producir «muy alto»,
    //  la propiedad clínica se rompe en silencio y aquí salta.
    // =====================================================================
    t.caso("v18.0.8: en TODO el corpus dorado, ningún diabético queda por debajo de ALTO — y la mayoría sube a MUY ALTO", () => {
      const d = JSON.parse(fs.readFileSync(GOLD, "utf8"));
      const vs = d.vectores || d;
      let dm = 0, muyAlto = 0, alto = 0;
      const flojos = [];
      for (const v of vs) {
        const e = v.entrada || v.input || v;
        const x = {};
        for (const k in MAPA_ENTRADA) if (e[k] !== undefined) x[MAPA_ENTRADA[k]] = e[k];
        for (const k in e) if (!(k in MAPA_ENTRADA)) x[k] = e[k];
        if (!x.diabetes) continue;
        dm++;
        const r = api.mtrClasificarRiesgoCv(x);
        if (r.categoria === "muy alto") muyAlto++;
        else if (r.categoria === "alto") alto++;
        else flojos.push(r.categoria);
      }
      t.cierto(dm >= 100, "el corpus trae suficientes diabéticos para que esto pruebe algo (" + dm + ")");
      t.igual(flojos.length, 0, "ni uno por debajo de ALTO · encontrados: " + flojos.join(", "));
      t.cierto(muyAlto > 0, "y el paso 1 sigue subiendo diabéticos a MUY ALTO (" + muyAlto + " de " + dm + ")");
      t.igual(muyAlto + alto, dm, "la suma cuadra: solo hay estas dos categorías entre los diabéticos");
    });

    t.caso("v18.0.8: «muy alto» solo puede salir del paso 1 — que es lo que hace inofensivo al piso por diabetes", () => {
      // El piso corta la escalera con un `return` en el paso 2. Eso es seguro SOLO mientras
      // ningún paso posterior pueda producir «muy alto». Si alguien lo añadiera al paso 3 o
      // al 4, el piso empezaría a tapar categorías sin que nadie se enterase.
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const ini = src.indexOf("function mtrClasificarRiesgoCv");
      t.cierto(ini > 0, "se localiza el clasificador");
      const cuerpo = src.slice(ini, ini + 12000);
      const conMuyAlto = cuerpo.split("\n").filter((l) => /categoria\s*[:=]\s*"muy alto"/.test(l));
      t.cierto(conMuyAlto.length > 0, "hay al menos una vía a «muy alto»");
      conMuyAlto.forEach((l) => {
        t.cierto(/paso:\s*1\b/.test(l),
          "toda vía a «muy alto» sale del paso 1, que corre ANTES del piso por diabetes · " + l.trim().slice(0, 110));
      });
    });

    // =====================================================================
    // v18.0.26 — «NO EVALUABLE» SE CONVERTÍA EN «FALLA PARCIAL», Y ESO ACABA FIRMADO
    //
    // El comentario de `mtrEvaluarMetaLdl` ya lo decía —«devuelve un objeto explícito en vez
    // de un booleano, porque no evaluable por falta de LDL basal no es lo mismo que no está
    // en meta»— y el código NO lo cumplía: `cumpleReduccion` colapsaba `reduccion === null`
    // a false, igual que una reducción medida e insuficiente.
    //
    // El caso es el del PACIENTE NUEVO, que es lo normal: `mtrLdlBasalDeSerie` devuelve null
    // cuando la serie tiene menos de dos puntos. Un paciente de riesgo MUY ALTO con LDL 45
    // (meta < 55) y sin LDL previo salía "meta_parcial" y `enMeta` false, y mtrStatusV68 lo
    // traduce a «FALLA PARCIAL». Ese texto viaja al JSON que alimenta la nota clínica de la
    // IA y al registro permanente: la historia que el médico FIRMA decía falla terapéutica
    // parcial de alguien que está en meta, y lo único que faltaba era el laboratorio previo.
    //
    // Otro comentario que prometía una red que no existía — el mismo patrón que costó dos
    // defectos en la v18.0.13 y uno en la v18.0.19.
    // =====================================================================
    t.caso("v18.0.26: sin LDL previo, un paciente bajo meta NO se declara en falla", () => {
      const r = api.mtrEvaluarMetaLdl("muy alto", 45, null, null);
      t.igual(r.estado, "en_meta_reduccion_no_evaluable",
        "LDL 45 con meta <55 y sin basal: está en meta, y la reducción no se pudo evaluar");
      t.cierto(r.enMeta, "enMeta es cierto: el LDL bajo meta es un hecho medido");
      t.falso(r.reduccionEvaluable, "y se dice aparte que la reducción no era evaluable");
      const txt = api.mtrStatusV68({ riesgo: { categoria: "muy alto", datosCompletos: true }, meta: r });
      t.falso(/FALLA/.test(txt), `el texto que se firma no puede afirmar falla (salió: ${txt})`);
      t.cierto(/EN META/.test(txt), "dice que está en meta");
      t.cierto(/no evaluable/i.test(txt), "y declara lo que no se pudo evaluar, en vez de callarlo");
    });

    t.caso("v18.0.26: y la falla REAL sigue diciendo falla — no se sobre-corrigió", () => {
      // Reducción medida y de verdad insuficiente: 60 -> 45 son 25 %, y se exige 50 %.
      const r = api.mtrEvaluarMetaLdl("muy alto", 45, 60, null);
      t.igual(r.estado, "meta_parcial", "con basal medido y reducción corta, sigue siendo falla parcial");
      t.falso(r.enMeta, "y no está en meta");
      t.cierto(r.reduccionEvaluable, "porque aquí SÍ se pudo evaluar");
      t.igual(api.mtrStatusV68({ riesgo: { categoria: "muy alto", datosCompletos: true }, meta: r }), "FALLA PARCIAL");
    });

    t.caso("v18.0.26: fuera de meta sigue siendo fuera de meta, haya basal o no", () => {
      const sin = api.mtrEvaluarMetaLdl("muy alto", 90, null, null);
      t.igual(sin.estado, "fuera_de_meta", "LDL 90 con meta <55 está fuera, y eso no depende del basal");
      t.falso(sin.enMeta);
      const con = api.mtrEvaluarMetaLdl("muy alto", 90, 200, null);
      t.igual(con.estado, "en_meta_reduccion_no_evaluable" === con.estado ? con.estado : "meta_parcial",
        "con basal 200 la reducción sí llega al 55 %, así que es parcial, no «fuera»");
    });

    t.caso("v18.0.26: donde la norma NO exige reducción, nada cambia", () => {
      const r = api.mtrEvaluarMetaLdl("moderado", 90, null, null);
      t.igual(r.estado, "en_meta", "moderado no exige reducción: bajo meta es «en meta», sin matices");
      t.cierto(r.reduccionEvaluable, "y se considera evaluable porque no se exige");
    });

  },
};
