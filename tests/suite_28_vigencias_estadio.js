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
    // v14.1.2 — CORREGIDO contra la Tabla 50 oficial (imagen del médico, 14-ago-2026).
    // La versión anterior de esta prueba anclaba "BLOQ" en G1/G2, que NO está en la fuente:
    // la tabla da 180 días en los cuatro primeros estadios y 120 en E4. El "(solo para
    // diabéticos)" de la tabla es una condición de PACIENTE, no de estadio, y ya la aplica
    // vigenciaPorEstadio con esDM2 (ver la prueba de arriba). Con el BLOQ, un diabético en
    // estadio renal temprano se quedaba sin HbA1c — justo en quien más se controla.
    t.caso("vigenciaPorEstadio - ERC/hba1c con esDM2:true sigue la Tabla 50: 180 en G1..G3b, 120 en G4", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "hba1c", { esDM2: true }), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G2", "hba1c", { esDM2: true }), 180);
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
    // v14.1.2 — CORREGIDO contra la Tabla 50. Dos cambios respecto a la versión anterior:
    //  · El LDL NO se mantiene en 180: en Estadio 4 baja a 120, igual que el colesterol
    //    total y los triglicéridos de su misma fila. El valor viejo hacía que en el estadio
    //    MÁS avanzado el LDL se pidiera con MENOS frecuencia que sus compañeros de perfil.
    //  · La fila de la Tabla 50 se llama "Micro albuminuria", no "Relación
    //    albúmina/creatinina". Son analitos distintos (concentración vs. cociente) y este
    //    proyecto los separa a propósito. Las tablas de HTA y DM sí piden la RELACIÓN.
    t.caso("vigenciaPorEstadio - ERC/hdl y microalbuminuria a 180 en todos los estadios; el LDL baja a 120 en G4", () => {
      for (const est of ["G1", "G2", "G3a", "G3b", "G4"]) {
        t.igual(api.vigenciaPorEstadio("ERC", est, "hdl", {}), 180);
        t.igual(api.vigenciaPorEstadio("ERC", est, "microalbuminuria", {}), 180);
      }
      for (const est of ["G1", "G2", "G3a", "G3b"]) {
        t.igual(api.vigenciaPorEstadio("ERC", est, "ldl", {}), 180);
      }
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "ldl", {}), 120, "Tabla 50: LDL en Estadio 4 = 120 días");
    });

    // v14.1.2 — Filas de la Tabla 50 que faltaban ENTERAS en la tabla del script.
    t.caso("vigenciaPorEstadio - ERC/hematocrito: 365 en G1..G3b y 180 en G4 (Tabla 50)", () => {
      for (const est of ["G1", "G2", "G3a", "G3b"]) {
        t.igual(api.vigenciaPorEstadio("ERC", est, "hematocrito", {}), 365);
      }
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "hematocrito", {}), 180);
    });
    t.caso("vigenciaPorEstadio - ERC/depuracion_creatinina_orina24h: 365 en G1, 180 en G2..G3b, 90 en G4", () => {
      t.igual(api.vigenciaPorEstadio("ERC", "G1", "depuracion_creatinina_orina24h", {}), 365);
      t.igual(api.vigenciaPorEstadio("ERC", "G2", "depuracion_creatinina_orina24h", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G3a", "depuracion_creatinina_orina24h", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G3b", "depuracion_creatinina_orina24h", {}), 180);
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "depuracion_creatinina_orina24h", {}), 90);
    });

    // v14.1.2 — La Tabla 50 NO tiene una fila de "relación albúmina/creatinina": pide
    // microalbuminuria. Que `rac` devuelva null en ERC es el comportamiento correcto según
    // la fuente, y esta prueba lo fija para que nadie lo "arregle" añadiéndola por parecido.
    t.caso("vigenciaPorEstadio - ERC/rac NO existe en la Tabla 50: devuelve null (la fuente pide microalbuminuria)", () => {
      for (const est of ["G1", "G2", "G3a", "G3b", "G4"]) {
        t.igual(api.vigenciaPorEstadio("ERC", est, "rac", {}), null);
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

    // =====================================================================
    //  T3 — Enganche de vigencias por estadio en _analitosRcvVencidos
    // =====================================================================
    t.caso("_analitosRcvVencidos: compatibilidad hacia atrás — sin opts aplica 180 días planos", () => {
      const labs = [
        { codigo: "903895", nombre: "CREATININA", Resultado: "0.9", Fecha: "2026-03-14" }, // 150 días a 2026-08-11
        { codigo: "903841", nombre: "GLUCOSA EN SUERO", Resultado: "90", Fecha: "2026-07-01" },
        { codigo: "907106", nombre: "UROANALISIS", Resultado: "NORMAL", Fecha: "2026-07-01" },
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-07-01" },
        { codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "140", Fecha: "2026-07-01" },
        { codigo: "903815", nombre: "COLESTEROL HDL", Resultado: "50", Fecha: "2026-07-01" },
        { codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "95", Fecha: "2026-07-01" },
        { codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "10", Fecha: "2026-07-01" },
      ];
      // Sin opts: 150 días <= 180 -> ningún faltante
      const sinOpts = api._analitosRcvVencidos(labs, "2026-08-11");
      t.igual(sinOpts, []);
    });

    t.caso("_analitosRcvVencidos: dos pacientes con la MISMA fecha de creatinina (100 días), en G4 vence y en G1 NO", () => {
      const labs = [
        { codigo: "903895", nombre: "CREATININA", Resultado: "1.4", Fecha: "2026-05-03" }, // 100 días a 2026-08-11
        { codigo: "903841", nombre: "GLUCOSA EN SUERO", Resultado: "90", Fecha: "2026-07-01" },
        { codigo: "907106", nombre: "UROANALISIS", Resultado: "NORMAL", Fecha: "2026-07-01" },
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-07-01" },
        { codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "140", Fecha: "2026-07-01" },
        { codigo: "903815", nombre: "COLESTEROL HDL", Resultado: "50", Fecha: "2026-07-01" },
        { codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "95", Fecha: "2026-07-01" },
        { codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "10", Fecha: "2026-07-01" },
      ];

      // Paciente en G1: vigencia es 180 días -> 100 días NO está vencida
      const resG1 = api._analitosRcvVencidos(labs, "2026-08-11", { estadio: "G1" });
      const creatG1 = resG1.find((f) => f.key === "CREATININA");
      t.igual(creatG1, undefined, "en G1 creatinina de 100 días sigue vigente");

      // Paciente en G4: vigencia es 60-93 días -> 100 días SÍ está vencida
      const resG4 = api._analitosRcvVencidos(labs, "2026-08-11", { estadio: "G4" });
      const creatG4 = resG4.find((f) => f.key === "CREATININA");
      t.cierto(!!creatG4, "en G4 creatinina de 100 días está vencida (tope 93 días)");
      t.igual(creatG4.dias, 100);
      t.igual(creatG4.resultDate, "2026-05-03");
    });

    t.caso("_analitosRcvVencidos: Glicemia en G4 vence a los 60 días (Tabla 50)", () => {
      const labs = [
        { codigo: "903895", nombre: "CREATININA", Resultado: "1.4", Fecha: "2026-07-01" },
        { codigo: "903841", nombre: "GLUCOSA EN SUERO", Resultado: "95", Fecha: "2026-05-13" }, // 90 días a 2026-08-11
        { codigo: "907106", nombre: "UROANALISIS", Resultado: "NORMAL", Fecha: "2026-07-01" },
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-07-01" },
        { codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "140", Fecha: "2026-07-01" },
        { codigo: "903815", nombre: "COLESTEROL HDL", Resultado: "50", Fecha: "2026-07-01" },
        { codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "95", Fecha: "2026-07-01" },
        { codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "10", Fecha: "2026-07-01" },
      ];

      // G1: glicemia 90 días <= 180 -> vigente
      const resG1 = api._analitosRcvVencidos(labs, "2026-08-11", { estadio: "G1" });
      t.igual(resG1.find((f) => f.key === "GLUCOSA"), undefined);

      // G4: glicemia 90 días > 60 -> vencida
      const resG4 = api._analitosRcvVencidos(labs, "2026-08-11", { estadio: "G4" });
      const gluG4 = resG4.find((f) => f.key === "GLUCOSA");
      t.cierto(!!gluG4, "en G4 glicemia de 90 días está vencida");
      t.igual(gluG4.dias, 90);
    });
  },
};


