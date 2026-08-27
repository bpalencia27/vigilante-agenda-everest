// =====================================================================
//  SUITE 28 — Vigencias por estadio renal (R2, MODO SOMBRA)
//
//  Consulta pura de la tabla de vigencias transcrita de
//  PROMPT_JULES_R2_VIGENCIAS_ESTADIO.md líneas 35-70 (la "Tabla 50" oficial).
//
//  OJO CON LA CABECERA VIEJA: decía que esta tabla estaba en "modo sombra" y que el
//  médico seguía viendo 180 días planos. Eso dejó de ser cierto en v16.4.0, cuando el
//  aviso de entrada y el antiduplicado de PyM empezaron a pasarle programa y estadio.
//
//  Y desde v17.6.95 vuelve a ser casi cierto, pero por otro motivo: `vigenciaPorEstadio`
//  YA NO decide nada en producción. `_vigenciaDiasParaAnalito` delega en
//  `mtrVigenciaDiasNorma` —la misma tabla que usan el motor, el Panel, Agendar y
//  Ordenar— porque las dos no coincidían y la legacy siempre era la más larga.
//  Esta tabla se conserva como DOCUMENTO DE REFERENCIA de la Tabla 50, con filas que la
//  norma no tiene (hematocrito, depuración en orina 24 h, microalbuminuria), y sus
//  pruebas siguen fijando su contenido. Lo que ya no hace es gobernar un aviso.
// =====================================================================
module.exports = {
  nombre: "Vigencias por estadio renal (R2, sombra)",
  cubre: ["vigenciaPorEstadio", "analitoTablaDesdeClaveRcv", "_vigenciaDiasParaAnalito",
    "mtrVigenciaDiasNorma", "mtrColapsarVigencia", "_analitosRcvVencidos",
    "pymRcvCubiertoPorAthenea", "mtrCacheResumenGuardar"],

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

    // =================================================================
    // v17.6.27 — AUDITORÍA S+ (barrido total, 24-ago-2026): con opts.estadio/opts.programa
    // (el caso principal: los dos únicos llamadores con aplicar50:true SIEMPRE pasan
    // también programa/estadio cuando hay resumen en caché), _vigenciaDiasParaAnalito
    // retornaba la vigencia por tabla ANTES de llegar al bloque de v16.4.0 que la parte a
    // la mitad si el resultado está fuera de meta — la regla "50% en todo" quedaba
    // inalcanzable justo para los pacientes con contexto clínico completo.
    // =================================================================
    t.caso("v17.6.27: aplicar50 SÍ se aplica cuando hay programa/estadio (antes era inalcanzable)", () => {
      // Programa HTA, tabla: ldl = 180 días planos. Meta "alto" = 70 mg/dL, margen 15% = 80.5.
      const opts = { programa: "HTA", aplicar50: true, categoriaRiesgo: "alto" };
      t.igual(api._vigenciaDiasParaAnalito("COLESTEROL_LDL", "150", opts), 90,
        "LDL 150 (fuera de meta 80.5) con programa HTA: 180/2 = 90, no los 180 completos");
      t.igual(api._vigenciaDiasParaAnalito("COLESTEROL_LDL", "60", opts), 180,
        "LDL 60 (dentro de meta) con programa HTA: se conservan los 180 días completos, sin acortar");
    });

    t.caso("v17.6.27: aplicar50 también funciona por estadio ERC (rango {min,max} de la tabla)", () => {
      // ERC/creatinina en G3a es un RANGO {min:90,max:121} — la regla usa el max (121) como base.
      const opts = { estadio: "G3a", aplicar50: true, categoriaRiesgo: "alto" };
      // "CREATININA" no tiene meta (no está en MTR_CLAVES_CON_META): mtrFueraDeMeta
      // devuelve null y la vigencia por estadio se conserva sin tocar.
      t.igual(api._vigenciaDiasParaAnalito("CREATININA", "1.4", opts), 121,
        "sin meta que evaluar para creatinina, se usa el max del rango por estadio, no RCV_VIGENCIA_DIAS (180)");
    });

    t.caso("v17.6.27: sin opts.aplicar50, el resultado por estadio/programa no cambia (compatibilidad)", () => {
      t.igual(api._vigenciaDiasParaAnalito("COLESTEROL_LDL", "150", { programa: "HTA", categoriaRiesgo: "alto" }), 180,
        "sin aplicar50, la vigencia por tabla se respeta tal cual, sin acortar");
    });

    // =================================================================
    // v17.6.95 — HUECO 8: UNA SOLA TABLA DE VIGENCIAS
    //
    // El aviso rojo de entrada y el antiduplicado de PyM eran los dos últimos sitios que
    // consultaban la tabla legacy. Donde las dos tablas no coinciden, la legacy SIEMPRE es
    // la más larga: declara vigente un examen que la norma da por vencido. Barrido
    // exhaustivo (8 claves × todos los estadios × 3 programas × esDM2 en ambos valores):
    // cero celdas al revés, y toda la divergencia dentro del programa ERC.
    // =================================================================

    const CLAVES_RCV = ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS",
      "GLUCOSA", "UROANALISIS", "CREATININA", "RAC"];

    t.caso("v17.6.95: ERC G5 ya no recibe 180 días planos (era el paciente MÁS enfermo con la vigencia MÁS larga)", () => {
      // La tabla legacy no tiene columna G5: devolvía null y entraba el respaldo plano de
      // 180 para los OCHO analitos. La norma colapsa G5 en G4, que es lo conservador.
      const g5 = (k) => api._vigenciaDiasParaAnalito(k, null, { programa: "ERC", estadio: "G5", esDM2: true, edad: 60 });
      t.igual(g5("GLUCOSA"), 60, "glicemia en G5: 60 días, no 180");
      t.igual(g5("CREATININA"), 93, "creatinina en G5: 93 (extremo superior del rango 60-93), no 180");
      t.igual(g5("COLESTEROL_TOTAL"), 120, "colesterol total en G5");
      t.igual(g5("COLESTEROL_LDL"), 120, "LDL en G5");
      t.igual(g5("TRIGLICERIDOS"), 120, "triglicéridos en G5");
      t.igual(g5("UROANALISIS"), 120, "parcial de orina en G5");
      t.igual(g5("RAC"), 120, "RAC en G5");
      t.igual(g5("COLESTEROL_HDL"), 180, "el HDL sí son 180 en todos los estadios: no se acorta lo que la norma no acorta");
    });

    t.caso("v17.6.95: ningún estadio de ERC puede quedar con la vigencia más larga que el anterior", () => {
      // La propiedad que de verdad importa, y que el defecto rompía: cuanto peor el
      // estadio, la vigencia nunca puede alargarse. Con la tabla legacy, pasar de G4 a G5
      // la alargaba de 60 a 180.
      const ORDEN = ["G1", "G2", "G3a", "G3b", "G4", "G5"];
      for (const k of CLAVES_RCV) {
        let previo = Infinity;
        const traza = [];
        for (const est of ORDEN) {
          const v = api._vigenciaDiasParaAnalito(k, null, { programa: "ERC", estadio: est, esDM2: true, edad: 60 });
          traza.push(est + "=" + v);
          t.cierto(v <= previo, k + " se ALARGA al empeorar el estadio · " + traza.join(" "));
          previo = v;
        }
      }
    });

    t.caso("v17.6.95: ERC G4 + RAC pasa de 180 a 120 (la Tabla 50 no tiene fila `rac`, tiene `microalbuminuria`)", () => {
      // Que `vigenciaPorEstadio` devuelva null para `rac` en ERC es CORRECTO respecto de su
      // fuente y se sigue fijando más arriba en esta misma suite. El problema era que ese
      // null caía al respaldo plano de 180 en vez de a la norma, que sí tiene la fila.
      t.igual(api.vigenciaPorEstadio("ERC", "G4", "rac", {}), null, "la Tabla 50 sigue sin fila rac: intacta");
      t.igual(api._vigenciaDiasParaAnalito("RAC", null, { programa: "ERC", estadio: "G4", esDM2: true, edad: 60 }), 120,
        "pero el aviso ya no usa el respaldo de 180: usa la norma");
      // Esto ya estaba DECLARADO como corrección de la norma desde antes de esta versión;
      // lo único que faltaba era que este camino se enterara.
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G4", true, 60, null), 120, "la norma ya lo decía");
    });

    t.caso("v17.6.95: DM2 y HTA no cambian en NINGUNA celda", () => {
      // La divergencia entera vivía en ERC. Si esta prueba cae, el cambio se desbordó.
      for (const prog of ["DM2", "HTA"]) {
        for (const k of CLAVES_RCV) {
          for (const est of ["G1", "G2", "G3a", "G3b", "G4", "G5", null]) {
            const v = api._vigenciaDiasParaAnalito(k, null, { programa: prog, estadio: est, esDM2: true, edad: 60 });
            t.igual(v, 180, prog + "/" + est + "/" + k + " debía seguir en 180");
          }
        }
      }
    });

    t.caso("v17.6.95: la creatinina sigue tomando el extremo SUPERIOR del rango, no el inferior", () => {
      // La línea vieja hacía `v.max`. `mtrColapsarVigencia(v, false)` hace lo mismo. Elegir
      // el inferior sin saber si la función renal se está moviendo sería inferir.
      t.igual(api._vigenciaDiasParaAnalito("CREATININA", null, { programa: "ERC", estadio: "G3a", esDM2: true, edad: 60 }), 121,
        "G3a: 121, el superior del rango 90-121");
      t.igual(api._vigenciaDiasParaAnalito("CREATININA", null, { programa: "ERC", estadio: "G4", esDM2: true, edad: 60 }), 93,
        "G4: 93, el superior del rango 60-93");
      t.igual(api.mtrColapsarVigencia([90, 121], false), 121, "y el colapsador es el que decide, con la regla de la norma");
      t.igual(api.mtrColapsarVigencia([90, 121], true), 90, "con la función renal moviéndose sería el inferior");
    });

    t.caso("v17.6.95: el recorte por albuminuria (RAC>=30) sigue vivo y no se aplica dos veces", () => {
      // El override de la norma es un plazo PLANO de 90 días acotado a la base. Aquí se
      // aplica con `resultValCrudo`, que es el valor que este camino sí tiene.
      const conRac = (est, val) => api._vigenciaDiasParaAnalito("RAC", val, { programa: "ERC", estadio: est, esDM2: true, edad: 60 });
      t.igual(conRac("G2", "10"), 180, "RAC normal en G2: los 180 de la tabla");
      t.igual(conRac("G2", "350"), 90, "RAC 350 en G2: recorte a 90");
      t.igual(conRac("G4", "350"), 90, "RAC 350 en G4: 90, no 60 — el plazo es plano, no la mitad de 120");
      t.igual(conRac("G4", "10"), 120, "y sin albuminuria manda la tabla");
      t.igual(conRac("G2", "> 300"), 90, "el LIS reporta desigualdades: '> 300' también recorta");
    });

    t.caso("v17.6.95: ninguna de las 8 claves RCV puede producir BLOQ (si alguien añade una, esta prueba lo obliga a decidir)", () => {
      // `base` solo se acepta si es un número finito; un "BLOQ" caería al respaldo de 180,
      // es decir el aviso listaría como vencido un examen que está BLOQUEADO por KDIGO.
      // Hoy eso no puede pasar porque ningún analito bloqueable (PTH, fósforo, albúmina,
      // HbA1c) está en el mapa de analitoTablaDesdeClaveRcv. Se fija por prueba.
      const bloqueables = [];
      for (const k of CLAVES_RCV) {
        const a = api.analitoTablaDesdeClaveRcv(k);
        t.cierto(a !== null, k + " debía tener traducción a nombre de analito");
        for (const prog of ["ERC", "DM2", "HTA"]) {
          for (const est of ["G1", "G2", "G3a", "G3b", "G4", "G5"]) {
            for (const dm of [true, false]) {
              if (api.mtrVigenciaDiasNorma(prog, a, est, dm, 60, null) === "BLOQ") bloqueables.push(prog + "/" + est + "/" + k);
            }
          }
        }
      }
      t.igual(bloqueables, [], "si esto deja de estar vacío hay que decidir qué hace el aviso con un examen bloqueado");
    });

    t.caso("v17.6.95 PUNTA A PUNTA: el paquete RCV deja de declararse «cubierto» en un ERC G5", () => {
      // Este es el camino donde el defecto AFIRMA algo en pantalla, no donde se calla:
      // `pymRcvCubiertoPorAthenea` en true desmarca la casilla del paquete RCV y pinta
      // «🧪 Athenea ya tiene todos estos resultados vigentes — el paciente ya se los hizo».
      // Con exámenes de 130 días en un G5 eso era falso: la glicemia vence a los 60.
      // (La casilla NO se bloquea nunca — decisión del médico del 20-ago — así que lo que
      //  se perdía era el premarcado y la confianza en el mensaje, no la posibilidad.)
      const HACE_130 = "2026-04-19";
      const HOY = "2026-08-27";
      const labs = [
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: HACE_130 },
        { codigo: "903815", nombre: "COLESTEROL HDL", Resultado: "45", Fecha: HACE_130 },
        { codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "150", Fecha: HACE_130 },
        { codigo: "903841", nombre: "GLUCOSA EN SUERO", Resultado: "90", Fecha: HACE_130 },
        { codigo: "907106", nombre: "UROANALISIS", Resultado: "NORMAL", Fecha: HACE_130 },
        { codigo: "903895", nombre: "CREATININA", Resultado: "6.0", Fecha: HACE_130 },
        { codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "10", Fecha: HACE_130 },
        { codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "50", Fecha: HACE_130 },
      ];
      // Se siembra la caché igual que hace producción: es de ahí de donde los dos
      // llamadores sacan programa y estadio (ver las líneas del ctx en el userscript).
      const conEstadio = (docId, estadio) => {
        api.mtrCacheResumenGuardar(docId, {
          programa: "ERC",
          erc: { estadioAdministrativo: estadio },
          factores: { diabetes: true },
          riesgo: { categoria: "muy alto" },
        });
        return api.pymRcvCubiertoPorAthenea(labs, HOY, docId);
      };
      t.falso(conEstadio("h8-g4", "G4"), "en G4 ya se sabía que NO estaba cubierto");
      t.falso(conEstadio("h8-g5", "G5"),
        "y en G5 tampoco puede estarlo: la glicemia de 130 días vence a los 60");
      // El contraste: un G2 con esos mismos exámenes sí está cubierto de verdad.
      t.cierto(conEstadio("h8-g2", "G2"), "un ERC G2 con 130 días sí está cubierto (vigencia 180)");
      try { api.mtrCacheResumenBorrar(); } catch (e) {}
    });

    t.caso("v17.6.95 PUNTA A PUNTA: el aviso rojo de un ERC G5 deja de decir «todo al día»", () => {
      // El defecto no se ve mirando la tabla: se ve en lo que el médico lee al abrir la
      // historia. Estos son los MISMOS exámenes, el MISMO día, y solo cambia el estadio.
      const HOY = "2026-08-27";
      const HACE_170 = "2026-03-10";
      const labs = [
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: HACE_170 },
        { codigo: "903815", nombre: "COLESTEROL HDL", Resultado: "45", Fecha: HACE_170 },
        { codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "150", Fecha: HACE_170 },
        { codigo: "903841", nombre: "GLUCOSA EN SUERO", Resultado: "90", Fecha: HACE_170 },
        { codigo: "907106", nombre: "UROANALISIS", Resultado: "NORMAL", Fecha: HACE_170 },
        { codigo: "903895", nombre: "CREATININA", Resultado: "3.8", Fecha: HACE_170 },
        { codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "10", Fecha: HACE_170 },
        { codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "100", Fecha: HACE_170 },
      ];
      const avisa = (est) => api._analitosRcvVencidos(labs, HOY, {
        programa: "ERC", estadio: est, esDM2: true, esDm2: true, edad: 60, aplicar50: true,
      }).map((x) => x.key).sort();

      const g4 = avisa("G4");
      const g5 = avisa("G5");
      t.cierto(g4.length >= 6, "en G4 el aviso ya listaba al menos 6 exámenes (obtuvo " + g4.length + ")");
      t.cierto(g5.length >= g4.length,
        "el paciente MÁS enfermo no puede recibir MENOS avisos que el menos enfermo · G4=[" + g4.join(",") + "] G5=[" + g5.join(",") + "]");
      t.cierto(g5.indexOf("GLUCOSA") >= 0, "la glicemia de hace 170 días en un G5 (vigencia 60) tiene que salir");
      t.cierto(g5.indexOf("CREATININA") >= 0, "y la creatinina (vigencia 93) también");
      t.cierto(g5.indexOf("RAC") >= 0, "y la RAC (vigencia 120), que antes caía al respaldo de 180");
      // Y el contraste que prueba que no se volvió todo más estricto porque sí:
      const g2 = avisa("G2");
      t.igual(g2, [], "un ERC G2 con esos mismos exámenes de 170 días sigue al día: 180 no se toca");
    });
  },
};
