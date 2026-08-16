// =====================================================================
//  SUITE 32 — Corrección Clínica, Frontera DOM y Límites de Seguridad (M2)
//
//  Cubre:
//  - R2.1: Matriz completa de 13 laboratorios, coincidencia y normalización.
//  - R2.2: Catálogo CUPS, invariantes normativos y divergencia lectura/escritura.
//  - R2.3: Motor renal, rangos fisiológicos, centinela 0, aviso empático en HTML.
//  - R2.4 / R2.10: Festivos de Colombia 2024-2027, ciclo horario y America/Bogota.
//  - R2.5: Máquina de estados de agenda, fraudWatch, alertedFraud, apptKey, diaNuevo.
//  - R2.6 / R2.8: Contrato DOM con Everest, fixtures congelados y desambiguación.
//  - R2.7 / R2.9: Recall clínico, deduplicación de órdenes, exportAudit.
// =====================================================================

const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Corrección Clínica, Frontera DOM y Límites (M2)",
  cubre: [
    "cockcroftGault", "ckdEpi2021", "estadioKDIGO",
    "estadioRenalDelPaciente", "calcularEstadioRenal", "_renderEstadioRenalHtml",
    "_creatininaDeLabs", "_esSexoFemenino", "_matchLabInWhitelist", "_esAnalitoDeOrina",
    "_matchUroComponente", "_findHbA1cFields",
    "esFestivo",
    "todayStamp", "horaBonita", "parseHoraMin", "apptKey",
    "colorAndAlert", "pymCubiertoPorOrdenVigente",
    "_ordenesVigentesInvalidar", "_demograficosInvalidar", "_bannerPymInvalidar",
    "apiAccesoObtenerDemograficos", "exportAudit"
  ],

  async pruebas(t, api, env, cargar) {

    // =================================================================
    // 1. R2.1: Matriz de 13 Laboratorios de Crónicos y Normalización
    // =================================================================
    t.caso("R2.1: _matchLabInWhitelist reconoce los 13 analitos por código LIS/CUPS exacto", () => {
      const codigos = [
        { code: "2009", key: "COLESTEROL_TOTAL" },
        { code: "903818", key: "COLESTEROL_TOTAL" },
        { code: "2015", key: "COLESTEROL_HDL" },
        { code: "903815", key: "COLESTEROL_HDL" },
        { code: "2014", key: "COLESTEROL_LDL" },
        { code: "903817", key: "COLESTEROL_LDL" },
        { code: "903816", key: "COLESTEROL_LDL" },
        { code: "2074", key: "TRIGLICERIDOS" },
        { code: "903868", key: "TRIGLICERIDOS" },
        { code: "2095", key: "UROANALISIS" },
        { code: "907106", key: "UROANALISIS" },
        { code: "2013", key: "GLUCOSA" },
        { code: "903841", key: "GLUCOSA" },
        { code: "8779", key: "RAC" },
        { code: "2028", key: "CREATININA" },
        { code: "903895", key: "CREATININA" },
        { code: "2035", key: "HBA1C" },
        { code: "903843", key: "HBA1C" },
        { code: "2065", key: "PTH" },
        { code: "904921", key: "PTH" },
        { code: "2031", key: "FOSFORO" },
        { code: "903837", key: "FOSFORO" },
        { code: "2002", key: "ALBUMINA" },
        { code: "903801", key: "ALBUMINA" },
        { code: "2034", key: "HEMOGLOBINA" },
        { code: "902207", key: "HEMOGLOBINA" }
      ];

      for (const item of codigos) {
        const m = api._matchLabInWhitelist({ CodigoParametro: item.code, NombreParametro: "TEST DIVERGENTE" });
        t.cierto(!!m, `Código ${item.code} debe casar con ${item.key}`);
        t.igual(m.key, item.key, `Código ${item.code} casó con ${m.key}`);
      }
    });

    t.caso("R2.1: _matchLabInWhitelist jerarquía: código manda sobre nombre ambiguo", () => {
      const m = api._matchLabInWhitelist({
        CodigoParametro: "903841", // Glicemia
        NombreParametro: "HEMOGLOBINA GLICOSILADA"
      });
      t.cierto(!!m);
      t.igual(m.key, "GLUCOSA", "El código CUPS 903841 tiene prevalencia absoluta sobre el nombre");
    });

    t.caso("R2.1: _matchLabInWhitelist es inmune a mayúsculas, tildes y signos de puntuación", () => {
      const variantes = [
        { lab: { NombreParametro: "Colesterol  Total" }, key: "COLESTEROL_TOTAL" },
        { lab: { NombreParametro: "colesterol de alta densidad" }, key: "COLESTEROL_HDL" },
        { lab: { NombreParametro: "TRIGLICÉRIDOS" }, key: "TRIGLICERIDOS" },
        { lab: { NombreParametro: "FÓSFORO EN SUERO" }, key: "FOSFORO" },
        { lab: { NombreParametro: "ALBÚMINA EN SUERO" }, key: "ALBUMINA" },
        { lab: { NombreParametro: "Relación Albúmina/Creatinina" }, key: "RAC" },
        { lab: { NombreParametro: "Hemoglobina Glicosilada (HbA1c)" }, key: "HBA1C" }
      ];

      for (const v of variantes) {
        const m = api._matchLabInWhitelist(v.lab);
        t.cierto(!!m, `Variante "${v.lab.NombreParametro}" debe casar`);
        t.igual(m.key, v.key, `Variante "${v.lab.NombreParametro}" casó con ${m.key}`);
      }
    });

    t.caso("R2.1: _esAnalitoDeOrina bloquea glucosa y hemoglobina en orina de contaminar suero", () => {
      t.cierto(api._esAnalitoDeOrina({ NombreParametro: "GLUCOSURIA", NombreParametroPadre: "UROANALISIS" }));
      t.cierto(api._esAnalitoDeOrina({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "SEDIMENTO URINARIO" }));
      t.cierto(api._esAnalitoDeOrina({ NombreParametro: "NITRITO", NombreParametroPadre: "PARCIAL DE ORINA" }));
      t.falso(api._esAnalitoDeOrina({ NombreParametro: "GLICEMIA BASAL", NombreParametroPadre: "QUIMICA SANGUINEA" }));
      t.falso(api._esAnalitoDeOrina({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "CUADRO HEMATICO" }));

      // En el matching completo, la glucosa urinaria no casa con GLUCOSA sérica
      const mUroGlucosa = api._matchLabInWhitelist({ NombreParametro: "GLUCOSA", NombreParametroPadre: "PARCIAL DE ORINA" });
      t.igual(mUroGlucosa, null, "Glucosa en panel de orina no debe inyectarse en Glicemia sérica");

      // La hemoglobina urinaria no casa con HEMOGLOBINA sérica
      const mUroHb = api._matchLabInWhitelist({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "PARCIAL DE ORINA" });
      t.igual(mUroHb, null, "Hemoglobina en panel de orina no debe inyectarse en Hemoglobina sérica");
    });

    t.caso("R2.1: _matchUroComponente reconoce los 7 componentes y rechaza orina de 24 horas", () => {
      t.igual(api._matchUroComponente({ NombreParametro: "NITRITOS" }) && api._matchUroComponente({ NombreParametro: "NITRITOS" }).key, "NITRITOS");
      t.igual(api._matchUroComponente({ NombreParametro: "GLUCOSA EN ORINA" }) && api._matchUroComponente({ NombreParametro: "GLUCOSA EN ORINA" }).key, "GLUCOSURIA");
      t.igual(api._matchUroComponente({ NombreParametro: "PROTEINURIA CUALITATIVA" }) && api._matchUroComponente({ NombreParametro: "PROTEINURIA CUALITATIVA" }).key, "PROTEINURIA");
      t.igual(api._matchUroComponente({ NombreParametro: "CILINDROS HIALINOS" }) && api._matchUroComponente({ NombreParametro: "CILINDROS HIALINOS" }).key, "CILINDROS");
      t.igual(api._matchUroComponente({ NombreParametro: "SANGRE OCULTA" }) && api._matchUroComponente({ NombreParametro: "SANGRE OCULTA" }).key, "SANGRE");
      t.igual(api._matchUroComponente({ NombreParametro: "HEMATIES POR CAMPO" }) && api._matchUroComponente({ NombreParametro: "HEMATIES POR CAMPO" }).key, "HEMATIES");
      t.igual(api._matchUroComponente({ NombreParametro: "ESTERASA LEUCOCITARIA" }) && api._matchUroComponente({ NombreParametro: "ESTERASA LEUCOCITARIA" }).key, "LEUCOCITOS");

      // Rechazos de 24 horas
      t.igual(api._matchUroComponente({ NombreParametro: "GLUCOSA EN ORINA DE 24 HORAS" }), null);
      t.igual(api._matchUroComponente({ NombreParametro: "PROTEINURIA EN 24 H" }), null);
      t.igual(api._matchUroComponente({ NombreParametro: "DEPURACION DE CREATININA EN 24 HORAS" }), null);
    });

    // =================================================================
    // 2. R2.2: Catálogo de CUPS, Invariantes y Divergencias
    // =================================================================
    t.caso("R2.2: CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO contiene los códigos oficiales de ordenamiento", () => {
      const c = api.__CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO;
      t.cierto(!!c, "Catálogo renal de escritura debe existir");
      t.igual(c.HBA1C, "903426", "HbA1c automatizada oficial");
      t.igual(c.PTH, "903890", "PTH molécula intacta oficial");
      t.igual(c.FOSFORO, "903885", "Fósforo en suero u otros fluidos");
      t.igual(c.ALBUMINA, "903803", "Albúmina en suero u otros fluidos");
      t.igual(c.HEMOGLOBINA, "902213", "Hemoglobina automatizada oficial");
    });

    t.caso("R2.2: Diferenciación de CUPS LDL entre sanos (Z108: 903816) y crónicos (I10X: 903817)", () => {
      const pym = api.__PYM_CATALOG;
      t.cierto(Array.isArray(pym), "PYM_CATALOG debe ser un array");
      const z108 = pym.find(p => p.cie10 === "Z108");
      const i10x = pym.find(p => p.cie10 === "I10X");
      t.cierto(!!z108, "Z108 debe existir");
      t.cierto(!!i10x, "I10X debe existir");
      t.cierto(z108.cups.some(c => c.codigo === "903816"), "Z108 Sanos usa LDL semiautomatizado 903816");
      t.cierto(i10x.cups.some(c => c.codigo === "903817"), "I10X Crónicos usa LDL automatizado 903817");
    });

    t.caso("R2.2: Exclusiones de PyM respetadas: VIH (906249) activo, Hepatitis C y VDRL excluidos", () => {
      const pym = api.__PYM_CATALOG;
      const z113 = pym.find(p => p.cie10 === "Z113");
      t.cierto(!!z113, "Z113 (VIH) debe estar en el catálogo");
      t.cierto(z113.cups.some(c => c.codigo === "906249"), "VIH 906249 debe estar presente");
      t.falso(pym.some(p => p.cups && p.cups.some(c => c.codigo === "906225")), "Hepatitis C (906225) debe estar excluida");
      t.falso(pym.some(p => p.cups && p.cups.some(c => c.codigo === "906039")), "VDRL (906039) debe estar excluida");
      t.falso(pym.some(p => p.cups && p.cups.some(c => c.codigo === "903866")), "TGP (903866) debe estar excluida");
    });

    // =================================================================
    // 3. R2.3: Motor Renal, Rangos Fisiológicos y Guardas
    // =================================================================
    t.caso("R2.3: cockcroftGault rechaza pacientes pediátricos (<18 años)", () => {
      t.igual(api.cockcroftGault(17, 60, 1.0, "M"), 0, "edad 17 retorna centinela 0");
      t.igual(api.cockcroftGault(10, 35, 0.7, "F"), 0, "edad 10 retorna centinela 0");
      t.cierto(api.cockcroftGault(18, 60, 1.0, "M") > 0, "edad 18 adulto calcula TFG positiva");
    });

    t.caso("R2.3: cockcroftGault rechaza edades fuera de rango (>120 años)", () => {
      t.igual(api.cockcroftGault(121, 60, 1.0, "M"), 0, "edad 121 retorna 0");
      t.cierto(api.cockcroftGault(120, 60, 1.0, "M") > 0, "edad 120 calcula TFG");
    });

    t.caso("R2.3: cockcroftGault rechaza pesos no fisiológicos (<20 kg o >300 kg)", () => {
      t.igual(api.cockcroftGault(45, 19.9, 1.0, "M"), 0, "peso < 20 kg retorna 0");
      t.igual(api.cockcroftGault(45, 300.5, 1.0, "M"), 0, "peso > 300 kg retorna 0");
      t.cierto(api.cockcroftGault(45, 20.0, 1.0, "M") > 0, "peso 20 kg calcula");
      t.cierto(api.cockcroftGault(45, 300.0, 1.0, "M") > 0, "peso 300 kg calcula");
    });

    t.caso("R2.3: cockcroftGault rechaza creatinina fuera de rango (<0.1 o >20 mg/dL)", () => {
      t.igual(api.cockcroftGault(45, 70, 0.08, "M"), 0, "creatinina < 0.1 retorna 0");
      t.igual(api.cockcroftGault(45, 70, 88.4, "M"), 0, "creatinina en µmol/L (88.4) retorna 0");
      t.igual(api.cockcroftGault(45, 70, 21.0, "M"), 0, "creatinina > 20 retorna 0");
      t.cierto(api.cockcroftGault(45, 70, 0.1, "M") > 0, "creatinina 0.1 calcula");
      t.cierto(api.cockcroftGault(45, 70, 20.0, "M") > 0, "creatinina 20.0 calcula");
    });

    t.caso("R2.3: ckdEpi2021 valida límites fisiológicos (<18, >120, <0.1, >20)", () => {
      t.igual(api.ckdEpi2021(16, 1.0, "M"), 0, "edad pediátrica 16 retorna 0");
      t.igual(api.ckdEpi2021(125, 1.0, "M"), 0, "edad 125 retorna 0");
      t.igual(api.ckdEpi2021(50, 0.05, "M"), 0, "creatinina 0.05 retorna 0");
      t.igual(api.ckdEpi2021(50, 88.4, "M"), 0, "creatinina 88.4 retorna 0");
      t.cierto(api.ckdEpi2021(50, 1.0, "M") > 0, "entradas válidas retornan TFG positiva");
    });

    t.caso("R2.3: estadioKDIGO devuelve null para 0, negativo, NaN o texto, NUNCA G5", () => {
      t.igual(api.estadioKDIGO(0), null, "0 es centinela 'no evaluable'");
      t.igual(api.estadioKDIGO(-10), null, "TFG negativa es dato inválido");
      t.igual(api.estadioKDIGO(NaN), null, "NaN es dato inválido");
      t.igual(api.estadioKDIGO(null), null, "null es dato inválido");
      t.igual(api.estadioKDIGO("PENDIENTE"), null, "texto es dato inválido");
      t.igual(api.estadioKDIGO(14.5), "G5", "TFG < 15 real sí es G5");
      t.igual(api.estadioKDIGO(0.5), "G5", "TFG 0.5 real sí es G5");
    });

    t.caso("R2.3: estadioRenalDelPaciente reporta razones específicas en faltan", () => {
      const rPed = api.estadioRenalDelPaciente({ edad: 15, peso: 50, creatininaCruda: "0.8", sexo: "M" });
      t.igual(rPed.estadio, null);
      t.cierto(rPed.faltan.includes("edad_pediatrica"), "debe reportar edad_pediatrica");

      const rPes = api.estadioRenalDelPaciente({ edad: 40, peso: 15, creatininaCruda: "1.0", sexo: "M" });
      t.igual(rPes.estadio, null);
      t.cierto(rPes.faltan.includes("peso_fuera_de_rango"), "debe reportar peso_fuera_de_rango");

      const rCr = api.estadioRenalDelPaciente({ edad: 40, peso: 70, creatininaCruda: "88.4", sexo: "M" });
      t.igual(rCr.estadio, null);
      t.cierto(rCr.faltan.includes("creatinina_fuera_de_rango"), "debe reportar creatinina_fuera_de_rango");
    });

    t.caso("R2.3: _creatininaDeLabs extrae la creatinina sérica más reciente y descarta orina", () => {
      const labs = [
        { nombre: "CREATININA EN ORINA DE 24 HORAS", Resultado: "1400", fechaResultado: "2026-08-14" },
        { nombre: "DEPURACION DE CREATININA", Resultado: "90", fechaResultado: "2026-08-13" },
        { nombre: "CREATININA EN SUERO", Resultado: "PENDIENTE", idEstado: 1, fechaResultado: "2026-08-14" },
        { nombre: "CREATININA EN SUERO", Resultado: "1.25", fechaResultado: "2026-08-10" }
      ];
      const c = api._creatininaDeLabs(labs);
      t.cierto(!!c, "debe extraer creatinina");
      t.igual(c.crudo, "1.25", "debe extraer el valor 1.25 ignorando PENDIENTE y orina");
      t.igual(c.fechaIso, "2026-08-10");
    });

    t.caso("R2.3: _renderEstadioRenalHtml emite avisos comprensibles sin NaN ni Infinity", () => {
      const rVacio = api.estadioRenalDelPaciente({});
      const htmlVacio = api._renderEstadioRenalHtml(rVacio);
      t.cierto(htmlVacio.includes("no se puede calcular"), "informa que no se puede calcular");
      t.falso(htmlVacio.includes("NaN"), "cero NaN en salida");
      t.falso(htmlVacio.includes("Infinity"), "cero Infinity en salida");

      const rPed = api.estadioRenalDelPaciente({ edad: 14, peso: 45, creatininaCruda: "0.7" });
      const htmlPed = api._renderEstadioRenalHtml(rPed);
      t.cierto(htmlPed.includes("menor de 18 años") || htmlPed.includes("pediátrico"), "aviso empático de pediatría");
      t.falso(htmlPed.includes("NaN"));

      const rOk = api.estadioRenalDelPaciente({ edad: 60, peso: 70, creatininaCruda: "1.0", sexo: "M" });
      const htmlOk = api._renderEstadioRenalHtml(rOk);
      t.cierto(htmlOk.includes("vgl-labs-renal"), "renderiza badge renal");
      t.cierto(htmlOk.includes("G2"), "estadio G2 correcto");
      t.falso(htmlOk.includes("NaN"));
    });

    t.caso("R2.3: _esSexoFemenino detecta correctamente variantes", () => {
      t.cierto(api._esSexoFemenino("F"));
      t.cierto(api._esSexoFemenino("femenino"));
      t.cierto(api._esSexoFemenino("FEMENINO"));
      t.cierto(api._esSexoFemenino("  f "));
      t.falso(api._esSexoFemenino("M"));
      t.falso(api._esSexoFemenino("masculino"));
      t.falso(api._esSexoFemenino(null));
      t.falso(api._esSexoFemenino(undefined));
    });

    await t.casoAsync("R2.3: calcularEstadioRenal ensambla demográficos, signos vitales y laboratorios", async () => {
      const respuestaJson = (obj) => async () => ({ ok: true, status: 200, json: async () => obj });
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { edad: 65, sexo: "F" } })();
          if (u.includes("ObtenerHistoricoSignosVitales")) return respuestaJson([{ peso: 70.0, fechaRegistro: "2026-08-12" }])();
          return respuestaJson([])();
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); }
      });
      const labs = [
        { nombre: "CREATININA EN SUERO", Resultado: "1.1", fechaResultado: "2026-08-10" }
      ];
      const r = await c.api.calcularEstadioRenal(12345, labs);
      t.cierto(!!r.estadio, "debe calcular estadio con datos válidos");
      t.igual(r.formula, "Cockcroft-Gault");
      t.igual(r.entradas.edad, 65);
      t.igual(r.entradas.peso, 70);
      t.igual(r.entradas.creatinina, 1.1);
      t.igual(r.entradas.sexo, "F");
    });

    await t.casoAsync("R2.3: apiAccesoObtenerDemograficos extrae edad y sexo con caché por paciente", async () => {
      const respuestaJson = (obj) => async () => ({ ok: true, status: 200, json: async () => obj });
      let fetchCalls = 0;
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          fetchCalls++;
          return respuestaJson({ data: { edad: 72, sexo: "M" } })();
        }
      });
      c.api._demograficosInvalidar();
      const d1 = await c.api.apiAccesoObtenerDemograficos(9999);
      t.igual(d1.edad, 72);
      t.igual(d1.sexo, "M");
      t.igual(fetchCalls, 1, "primer fetch realizado");

      // Segunda llamada usa caché
      const d2 = await c.api.apiAccesoObtenerDemograficos(9999);
      t.igual(d2.edad, 72);
      t.igual(fetchCalls, 1, "segunda llamada usa caché en memoria");
    });

    // =================================================================
    // 4. R2.4 & R2.10: Festivos de Colombia 2024-2027 y Horas
    // =================================================================
    t.caso("R2.4: Festivos de Colombia verificados en 2024, 2025, 2026 y 2027", () => {
      // 2024
      t.cierto(api.esFestivo(new Date(2024, 0, 1)), "2024-01-01 Año Nuevo");
      t.cierto(api.esFestivo(new Date(2024, 0, 8)), "2024-01-08 Reyes Magos");
      t.cierto(api.esFestivo(new Date(2024, 2, 28)), "2024-03-28 Jueves Santo");
      t.cierto(api.esFestivo(new Date(2024, 2, 29)), "2024-03-29 Viernes Santo");
      t.cierto(api.esFestivo(new Date(2024, 4, 1)), "2024-05-01 Día del Trabajo");
      t.cierto(api.esFestivo(new Date(2024, 6, 20)), "2024-07-20 Independencia");
      t.cierto(api.esFestivo(new Date(2024, 7, 7)), "2024-08-07 Batalla de Boyacá");
      t.cierto(api.esFestivo(new Date(2024, 11, 25)), "2024-12-25 Navidad");

      // 2025
      t.cierto(api.esFestivo(new Date(2025, 0, 1)), "2025-01-01 Año Nuevo");
      t.cierto(api.esFestivo(new Date(2025, 0, 6)), "2025-01-06 Reyes Magos");
      t.cierto(api.esFestivo(new Date(2025, 3, 17)), "2025-04-17 Jueves Santo");
      t.cierto(api.esFestivo(new Date(2025, 3, 18)), "2025-04-18 Viernes Santo");
      t.cierto(api.esFestivo(new Date(2025, 5, 30)), "2025-06-30 Sagrado Corazón / San Pedro");

      // 2026
      t.cierto(api.esFestivo(new Date(2026, 0, 1)), "2026-01-01 Año Nuevo");
      t.cierto(api.esFestivo(new Date(2026, 3, 2)), "2026-04-02 Jueves Santo");
      t.cierto(api.esFestivo(new Date(2026, 3, 3)), "2026-04-03 Viernes Santo");
      t.cierto(api.esFestivo(new Date(2026, 7, 7)), "2026-08-07 Batalla de Boyacá");

      // 2027
      t.cierto(api.esFestivo(new Date(2027, 0, 1)), "2027-01-01 Año Nuevo");
      t.cierto(api.esFestivo(new Date(2027, 2, 25)), "2027-03-25 Jueves Santo");
      t.cierto(api.esFestivo(new Date(2027, 2, 26)), "2027-03-26 Viernes Santo");
      t.cierto(api.esFestivo(new Date(2027, 6, 5)), "2027-07-05 San Pedro trasladado");
    });

    t.caso("R2.4: horaBonita y parseHoraMin ciclo completo de 1440 minutos", () => {
      for (let m = 0; m < 1440; m += 10) {
        const txt = api.horaBonita(m);
        const back = api.parseHoraMin(txt);
        t.igual(back, m, `Minuto ${m} (${txt}) recuperado exactamente`);
      }
    });

    t.caso("R2.4: horaBonita rechaza valores fuera de rango o no numéricos", () => {
      t.igual(api.horaBonita(null), "");
      t.igual(api.horaBonita(undefined), "");
      t.igual(api.horaBonita(-5), "");
      t.igual(api.horaBonita(1440), "");
      t.igual(api.horaBonita(2000), "");
      t.igual(api.horaBonita(NaN), "");
      t.igual(api.horaBonita("texto"), "");
    });

    t.caso("R2.10: todayStamp produce fecha YYYY-MM-DD", () => {
      const ts = api.todayStamp();
      t.cierto(/^\d{4}-\d{2}-\d{2}$/.test(ts), `todayStamp debe tener formato YYYY-MM-DD: ${ts}`);
    });

    // =================================================================
    // 5. R2.5: Máquina de Estados de Agenda y Detección de Fraude
    // =================================================================
    t.caso("R2.5: Transición Sin presentarse -> AMBAR y entrada en fraudWatch", () => {
      const c = cargar();
      c.api.__state.leader = true;
      const appt = { doc_id: "1098765432", hora_texto: "07:00 AM", estado: "Sin presentarse", index: 0 };
      const refDate = new Date();
      refDate.setHours(7, 10, 0, 0); // 10 minutos transcurridos (>= 6 min de tolerancia)

      const res = c.api.colorAndAlert(appt, refDate.getTime());
      t.igual(res.color, "AMBAR");
      t.cierto(c.api.__state.fraudWatch.has("1098765432@07:00 AM"), "debe entrar a fraudWatch");
      t.falso(res.sound, "AMBAR no emite sonido");
    });

    t.caso("R2.5: Transición Sin presentarse -> Atendido (salto de sala) dispara ROJO con sonido de flanco", () => {
      const c = cargar();
      c.api.__state.leader = true;
      const key = "1098765432@07:00 AM";
      c.api.__state.fraudWatch.add(key);

      const appt = { doc_id: "1098765432", hora_texto: "07:00 AM", estado: "Atendido", index: 0 };
      const now = Date.now();

      // Primer tick: salta sonido
      const res1 = c.api.colorAndAlert(appt, now);
      t.igual(res1.color, "ROJO");
      t.cierto(res1.sound, "primer aviso de fraude debe sonar");
      t.cierto(c.api.__state.alertedFraud.has(key), "debe quedar en alertedFraud");

      // Segundo tick: ya en alertedFraud, NO repite sonido
      const res2 = c.api.colorAndAlert(appt, now);
      t.igual(res2.color, "ROJO");
      t.falso(res2.sound, "sonido es de flanco único (edge-triggered)");
    });

    t.caso("R2.5: apptKey distingue citas del mismo paciente a distinta hora", () => {
      const c = cargar();
      const a1 = { doc_id: "12345", hora_texto: "07:00 AM" };
      const a2 = { doc_id: "12345", hora_texto: "09:00 AM" };

      const k1 = c.api.apptKey(a1);
      const k2 = c.api.apptKey(a2);
      t.igual(k1, "12345@07:00 AM");
      t.igual(k2, "12345@09:00 AM");
      t.cierto(k1 !== k2, "citas a diferente hora deben tener claves distintas");

      // Si falta a la de las 7, no afecta a la de las 9
      c.api.__state.fraudWatch.add(k1);
      t.cierto(c.api.__state.fraudWatch.has(k1));
      t.falso(c.api.__state.fraudWatch.has(k2));
    });

    // =================================================================
    // 6. R2.6 & R2.8: Contrato DOM con Everest y Fixtures Congelados
    // =================================================================
    t.caso("R2.6: Fixtures congelados existen en tests/fixtures/", () => {
      const fixDir = path.join(__dirname, "fixtures");
      t.cierto(fs.existsSync(path.join(fixDir, "dom_everest_cronicos.html")), "dom_everest_cronicos.html existe");
      t.cierto(fs.existsSync(path.join(fixDir, "dom_everest_cronicos_hombre.html")), "dom_everest_cronicos_hombre.html existe");
      t.cierto(fs.existsSync(path.join(fixDir, "dom_everest_cronicos_mujer.html")), "dom_everest_cronicos_mujer.html existe");
      t.cierto(fs.existsSync(path.join(fixDir, "dom_everest_agenda.html")), "dom_everest_agenda.html existe");
      t.cierto(fs.existsSync(path.join(fixDir, "dom_everest_ordenes.html")), "dom_everest_ordenes.html existe");
    });

    t.caso("R2.8: Desambiguación HbA1c vs Hemoglobina en formulario de Crónicos", () => {
      const c = cargar({ silencioso: true });
      const fakeHemoNormal = { tagName: "INPUT", id: "resultadoHemoglobina", name: "resultadoHemoglobina", type: "text", getAttribute: () => null, closest: () => null };
      const fakeHbA1cDate = { tagName: "INPUT", type: "date" };
      const fakeHbA1cGroup = { querySelector: (sel) => (sel === 'input[type="date"]' ? fakeHbA1cDate : null) };
      const fakeHbA1c = {
        tagName: "INPUT", id: "resultadoHemoglobina", name: "resultadoHemoglobina", type: "number",
        getAttribute: (k) => (k === "max" ? "30" : null),
        closest: (sel) => (sel === ".input-group" ? fakeHbA1cGroup : null)
      };

      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[name="resultadoHemoglobina"], input#resultadoHemoglobina') {
          return [fakeHemoNormal, fakeHbA1c];
        }
        return [];
      };

      const hba1cFields = c.api._findHbA1cFields();
      c.env.doc.querySelectorAll = prevQSA;

      t.cierto(!!hba1cFields, "debe encontrar el objeto de HbA1c");
      t.igual(hba1cFields.resultEl, fakeHbA1c, "resultEl debe ser el input con type=number max=30");
      t.igual(hba1cFields.dateEl, fakeHbA1cDate, "dateEl debe ser el input date hermano");
    });

    // =================================================================
    // 7. R2.7 & R2.9: Recall Clínico, Deduplicación de Órdenes y Auditoría
    // =================================================================
    t.caso("R2.7: pymCubiertoPorOrdenVigente exige todos los CUPS en actividades multi-CUP (ej. RAC)", () => {
      const actRAC = {
        key: "RAC",
        cups: [{ codigo: "903876" }, { codigo: "903026" }], // Creatinina en orina + Microalbuminuria
        vigenciaDias: 180
      };

      const ordenesParciales = [
        { cup: { codigo: "903876" }, fechaCreacion: "2026-08-01" } // Falta 903026
      ];
      const pendientes1 = api.pymCubiertoPorOrdenVigente([actRAC], ordenesParciales, "2026-08-14");
      t.igual(pendientes1.length, 1, "actividad con 1 de 2 CUPS vigentes sigue pendiente");

      const ordenesCompletas = [
        { cup: { codigo: "903876" }, fechaCreacion: "2026-08-01" },
        { cup: { codigo: "903026" }, fechaCreacion: "2026-08-02" }
      ];
      const pendientes2 = api.pymCubiertoPorOrdenVigente([actRAC], ordenesCompletas, "2026-08-14");
      t.igual(pendientes2.length, 0, "actividad con ambos CUPS vigentes ya está cubierta");
    });

    t.caso("R2.7: pymCubiertoPorOrdenVigente rechaza órdenes vencidas (> vigenciaDias) o futuras", () => {
      const act = { key: "COL_TOTAL", cups: [{ codigo: "903818" }], vigenciaDias: 180 };

      // Orden de hace 200 días
      const ordenVencida = [{ cup: { codigo: "903818" }, fechaCreacion: "2025-12-01" }];
      const pendientesVencida = api.pymCubiertoPorOrdenVigente([act], ordenVencida, "2026-08-14");
      t.igual(pendientesVencida.length, 1, "orden vencida deja la actividad pendiente");

      // Orden futura
      const ordenFutura = [{ cup: { codigo: "903818" }, fechaCreacion: "2026-10-01" }];
      const pendientesFutura = api.pymCubiertoPorOrdenVigente([act], ordenFutura, "2026-08-14");
      t.igual(pendientesFutura.length, 1, "orden futura deja la actividad pendiente");
    });

    t.caso("R2.9: Invalidadores de caché reinician el estado de memoria", () => {
      t.noLanza(() => api._ordenesVigentesInvalidar());
      t.noLanza(() => api._demograficosInvalidar());
      t.noLanza(() => api._bannerPymInvalidar());
    });

    t.caso("R2.9: exportAudit genera CSV válido con UTF-8 BOM", () => {
      const c = cargar({ silencioso: true });
      const blobs = [];
      c.ctx.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; blobs.push(this); };
      c.ctx.URL = { createObjectURL: () => "blob:csv", revokeObjectURL() {} };

      const dia = "2026-08-01";
      c.env.storage.setItem("vgl_ev_" + dia, JSON.stringify([
        { t: "08:01:02", ev: "FRAUDE_EXTEMPORANEO", hora: "07:40 AM", doc: "123", estado: "Confirmada", min: 21, nombre: "JUAN PEREZ" }
      ]));

      c.api.exportAudit(dia);

      t.igual(blobs.length, 1, "debe generar 1 blob");
      const csv = blobs[0].parts[0];
      t.cierto(typeof csv === "string", "el contenido del blob es string");
      t.cierto(csv.charCodeAt(0) === 0xFEFF, "debe iniciar con UTF-8 BOM para Excel");
      t.cierto(csv.includes("Fecha;2026-08-01"), "debe incluir la fecha");
      t.cierto(csv.includes("Hora;Evento;Hora cita;Documento;Estado;Estado previo;Minutos;Paciente"), "debe incluir cabecera");
    });

  }
};
