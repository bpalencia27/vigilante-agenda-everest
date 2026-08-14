// =====================================================================
//  SUITE 28 — Vigencias por estadio renal (R2, MODO SOMBRA)
//
//  Consulta pura de la tabla de vigencias transcrita de
//  PROMPT_JULES_R2_VIGENCIAS_ESTADIO.md líneas 35-70. NO está conectada a ningún
//  aviso: el médico sigue viendo los 180 días planos hoy (RCV_VIGENCIA_DIAS,
//  _vigenciaDiasParaAnalito y _analitosRcvVencidos, sin tocar). Esta suite solo
//  verifica la tabla y su función de consulta en aislamiento.
// =====================================================================
module.exports = {
  nombre: "Vigencias por estadio renal (R2, sombra)",
  cubre: ["vigenciaPorEstadio", "analitoTablaDesdeClaveRcv"],

  pruebas(t, api) {
    // --- Programa ERC: creatinina, los tres rangos {min,max} tal cual la tabla fuente ---
    t.caso("vigenciaPorEstadio - ERC/creatinina en G3a es RANGO {min:90,max:121}, no un número colapsado", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "creatinina", {}), { min: 90, max: 121 });
    });
    t.caso("vigenciaPorEstadio - ERC/creatinina en G3b es RANGO {min:90,max:121}", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G3b", "creatinina", {}), { min: 90, max: 121 });
    });
    t.caso("vigenciaPorEstadio - ERC/creatinina en G4 es RANGO {min:60,max:93}", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "creatinina", {}), { min: 60, max: 93 });
    });
    t.caso("vigenciaPorEstadio - ERC/creatinina en G1 y G2 son 180 planos (no rango)", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "creatinina", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G2", "creatinina", {}), 180);
    });

    // --- Programa ERC: todos los BLOQ de la tabla ---
    t.caso("vigenciaPorEstadio - ERC/pth BLOQ en G1 y G2", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "pth", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G2", "pth", {}), "BLOQ");
    });
    t.caso("vigenciaPorEstadio - ERC/pth NO es BLOQ en G3a: debe ser 365 (fila que la mutación obligatoria invierte)", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "pth", {}), 365);
    });
    t.caso("vigenciaPorEstadio - ERC/pth sigue 365 en G3b, y baja a 180 en G4", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G3b", "pth", {}), 365);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "pth", {}), 180);
    });
    t.caso("vigenciaPorEstadio - ERC/albumina BLOQ en G1, G2 y G3a; 365 desde G3b", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "albumina", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G2", "albumina", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "albumina", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G3b", "albumina", {}), 365);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "albumina", {}), 365);
    });
    t.caso("vigenciaPorEstadio - ERC/fosforo BLOQ en G1, G2 y G3a; 365 desde G3b", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "fosforo", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G2", "fosforo", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "fosforo", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G3b", "fosforo", {}), 365);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "fosforo", {}), 365);
    });

    // --- Programa ERC: hba1c, solo si esDM2 === true ---
    t.caso("vigenciaPorEstadio - ERC/hba1c sin esDM2 (u opciones vacías) siempre null, aunque el estadio exista en la tabla", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "hba1c", {}), null);
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "hba1c", { esDM2: false }), null);
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "hba1c", { esDM2: "si" }), null); // no truthy suelto, exige === true
    });
    t.caso("vigenciaPorEstadio - ERC/hba1c con esDM2:true sigue la tabla: BLOQ en G1/G2, 180 en G3a/G3b, 120 en G4", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "hba1c", { esDM2: true }), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G2", "hba1c", { esDM2: true }), "BLOQ");
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "hba1c", { esDM2: true }), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G3b", "hba1c", { esDM2: true }), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "hba1c", { esDM2: true }), 120);
    });

    // --- Resto de analitos ERC no bloqueados, para dejar la tabla íntegramente cubierta ---
    t.caso("vigenciaPorEstadio - ERC/glicemia baja a 60 solo en G4, resto 180", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "glicemia", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G3b", "glicemia", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "glicemia", {}), 60);
    });
    t.caso("vigenciaPorEstadio - ERC/parcial_orina baja a 120 en G4", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "parcial_orina", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "parcial_orina", {}), 120);
    });
    t.caso("vigenciaPorEstadio - ERC/hemoglobina es 365 hasta G3b y baja a 180 en G4", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G3b", "hemoglobina", {}), 365);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "hemoglobina", {}), 180);
    });
    t.caso("vigenciaPorEstadio - ERC/colesterol_total y trigliceridos bajan a 120 en G4", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "colesterol_total", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "colesterol_total", {}), 120);
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "trigliceridos", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "trigliceridos", {}), 120);
    });
    t.caso("vigenciaPorEstadio - ERC/ldl, hdl y rac se mantienen 180 en todos los estadios de la tabla", () => {
      for (const est of ["G1", "G2", "G3a", "G3b", "G4"]) {
        t.igual(api.vigenciaPorEstadio("ERC", est, "ldl", {}), 180);
        t.igual(api.vigenciaPorEstadio("ERC", est, "hdl", {}), 180);
        t.igual(api.vigenciaPorEstadio("ERC", est, "rac", {}), 180);
      }
    });
    t.caso("vigenciaPorEstadio - ERC/G5 no está contemplado por la tabla fuente: null", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G5", "creatinina", {}), null);
    });

    // --- Programa DM2: valores planos, ecg condicionado por edad ---
    t.caso("vigenciaPorEstadio - DM2: hba1c, glicemia, creatinina, rac, parcial_orina, colesterol_total, ldl, hdl, trigliceridos = 180", () => {
      const analitos = ["hba1c", "glicemia", "creatinina", "rac", "parcial_orina", "colesterol_total", "ldl", "hdl", "trigliceridos"];
      for (const a of analitos) t.igual(api.vigenciaPorEstadio("DM2", "G1", a, {}), 180);
    });
    t.caso("vigenciaPorEstadio - DM2/ecg con edad 44 es null (no cumple el umbral)", () => {
      t.igual(api.vigenciaPorEstadio("DM2", "G1", "ecg", { edad: 44 }), null);
    });
    t.caso("vigenciaPorEstadio - DM2/ecg con edad 45 es 365 (cumple el umbral exacto)", () => {
      t.igual(api.vigenciaPorEstadio("DM2", "G1", "ecg", { edad: 45 }), 365);
    });
    t.caso("vigenciaPorEstadio - DM2/ecg sin opciones.edad es null (nunca se deduce)", () => {
      t.igual(api.vigenciaPorEstadio("DM2", "G1", "ecg", {}), null);
    });
    t.caso("vigenciaPorEstadio - DM2 no exige PTH/Albúmina/Fósforo: null (no están en este programa)", () => {
      t.igual(api.vigenciaPorEstadio("DM2", "G1", "pth", {}), null);
      t.igual(api.vigenciaPorEstadio("DM2", "G1", "albumina", {}), null);
      t.igual(api.vigenciaPorEstadio("DM2", "G1", "fosforo", {}), null);
    });

    // --- Programa HTA: valores planos, acido_urico BLOQ siempre ---
    t.caso("vigenciaPorEstadio - HTA: glicemia, creatinina, rac, parcial_orina, colesterol_total, ldl, hdl, trigliceridos = 180; ecg y ecocardiograma = 365", () => {
      const analitos180 = ["glicemia", "creatinina", "rac", "parcial_orina", "colesterol_total", "ldl", "hdl", "trigliceridos"];
      for (const a of analitos180) t.igual(api.vigenciaPorEstadio("HTA", "G1", a, {}), 180);
      t.igual(api.vigenciaPorEstadio("HTA", "G1", "ecg", {}), 365);
      t.igual(api.vigenciaPorEstadio("HTA", "G1", "ecocardiograma", {}), 365);
    });
    t.caso("vigenciaPorEstadio - HTA/acido_urico BLOQ siempre, sin importar el estadio", () => {
      t.igual(api.vigenciaPorEstadio("HTA", "G1", "acido_urico", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("HTA", "G4", "acido_urico", {}), "BLOQ");
      t.igual(api.vigenciaPorEstadio("HTA", "G5", "acido_urico", {}), "BLOQ");
    });

    // --- Programa no confirmado y analito desconocido ---
    t.caso("vigenciaPorEstadio - programa \"NO_CONFIRMADO\" nunca se adivina: siempre null", () => {
      t.igual(api.vigenciaPorEstadio("NO_CONFIRMADO", "G3a", "creatinina", {}), null);
      t.igual(api.vigenciaPorEstadio("NO_CONFIRMADO", "G1", "glicemia", { esDM2: true, edad: 50 }), null);
    });
    t.caso("vigenciaPorEstadio - analito desconocido en cualquier programa: null", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "analito_inexistente", {}), null);
      t.igual(api.vigenciaPorEstadio("DM2", "G1", "analito_inexistente", {}), null);
      t.igual(api.vigenciaPorEstadio("HTA", "G1", "analito_inexistente", {}), null);
    });

    // --- Mapeo clave RCV -> analito de la tabla: las 7 confirmadas ---
    t.caso("analitoTablaDesdeClaveRcv - mapeo completo de las 7 claves RCV_VIGENCIA_KEYS", () => {
      t.igual(api.analitoTablaDesdeClaveRcv("CREATININA"), "creatinina");
      t.igual(api.analitoTablaDesdeClaveRcv("GLUCOSA"), "glicemia");
      t.igual(api.analitoTablaDesdeClaveRcv("UROANALISIS"), "parcial_orina");
      t.igual(api.analitoTablaDesdeClaveRcv("COLESTEROL_TOTAL"), "colesterol_total");
      t.igual(api.analitoTablaDesdeClaveRcv("TRIGLICERIDOS"), "trigliceridos");
      t.igual(api.analitoTablaDesdeClaveRcv("COLESTEROL_HDL"), "hdl");
      t.igual(api.analitoTablaDesdeClaveRcv("RAC"), "rac");
    });

    // --- Mapeo: las 9 ausencias documentadas (analitos de la tabla sin clave RCV hoy) ---
    t.caso("analitoTablaDesdeClaveRcv - las 9 claves que NO existen en RCV_VIGENCIA_KEYS no se inventan: null", () => {
      t.igual(api.analitoTablaDesdeClaveRcv("HEMOGLOBINA"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("PTH"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("ALBUMINA"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("FOSFORO"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("LDL"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("HBA1C"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("ECG"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("ECOCARDIOGRAMA"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("ACIDO_URICO"), null);
    });

    t.caso("analitoTablaDesdeClaveRcv - clave completamente desconocida (ni RCV ni de la tabla): null", () => {
      t.igual(api.analitoTablaDesdeClaveRcv("NO_EXISTE_ESTA_CLAVE"), null);
      t.igual(api.analitoTablaDesdeClaveRcv(""), null);
      t.igual(api.analitoTablaDesdeClaveRcv(null), null);
    });
  },
};
