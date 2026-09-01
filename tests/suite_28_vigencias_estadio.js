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
    "pymRcvCubiertoPorAthenea", "mtrCacheResumenGuardar",
    "pymPaqueteCubiertoPorAthenea", "pymPaqueteHechoEnAthenea"],

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

    // --- Mapeo: las ausencias documentadas (analitos de la tabla sin clave RCV hoy) ---
    t.caso("analitoTablaDesdeClaveRcv - las claves que NO tienen vigencia propia no se inventan: null", () => {
      t.igual(api.analitoTablaDesdeClaveRcv("HEMOGLOBINA"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("PTH"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("ALBUMINA"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("FOSFORO"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("LDL"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("ECG"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("ECOCARDIOGRAMA"), null);
      t.igual(api.analitoTablaDesdeClaveRcv("ACIDO_URICO"), null);
    });

    t.caso("v17.6.96: HbA1c SÍ tiene mapeo, y eso NO la mete en el aviso rojo de entrada", () => {
      // Dos listas distintas que nunca hay que volver a confundir:
      //  · RCV_VIGENCIA_KEYS = de qué se avisa en ROJO a TODO paciente. HbA1c sigue FUERA
      //    (pedido explícito del médico del 11-08-2026: no todo paciente es diabético).
      //  · el MAPA del traductor = "si me preguntan por esta clave, ¿qué vigencia tiene?".
      //    Devolver null obligaba al consumidor a caer en 180 planos, que para la HbA1c de
      //    un ERC G4 son 120 según la norma, y para un no diabético no son 180: es BLOQ.
      t.igual(api.analitoTablaDesdeClaveRcv("HBA1C"), "hba1c", "el traductor ya la conoce");
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const lista = /const RCV_VIGENCIA_KEYS = \[([^\]]*)\]/.exec(src);
      t.cierto(!!lista, "debía encontrarse RCV_VIGENCIA_KEYS en el fuente");
      t.falso(/HBA1C/.test(lista[1]),
        "HbA1c NO puede entrar en la lista del aviso rojo: se le pediría a todo paciente");
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

    // =================================================================
    // v17.6.99 — REPORTADO EN CONSULTA: «ya se lo realizó y me sigue mostrando
    // para enviárselo». El PSA aparecía hecho en Athenea seis días antes y el modal
    // de órdenes lo seguía ofreciendo premarcado.
    //
    // La causa NO era que el script no reconociera el examen —lo reconoce— sino que el
    // paquete Z125 no tenía `vigenciaDias`, y `pymPaqueteCubiertoPorAthenea` se rendía en
    // su primera línea con cualquier paquete que no la tuviera. Cinco de los ocho paquetes
    // estaban así, y nunca se cruzaban contra Athenea. Y esta función NO TENÍA NINGUNA
    // PRUEBA: se podía cambiar entera y el banco seguía verde.
    // =================================================================

    const _pkg = (cie10) => (api.__PYM_CATALOG || []).find((p) => p && p.cie10 === cie10);
    const _lab = (cod, nom, fecha, res) => ([{ codigo: cod, nombre: nom, Resultado: res, Fecha: fecha }]);
    const _HOY99 = "2026-08-27";
    const _LAB_PSA = (fecha, res) => _lab("906610", "ANTIGENO ESPECIFICO DE PROSTATA", fecha, res == null ? "0.63" : res);

    t.caso("v17.6.99: el PSA hecho hace seis días ya NO se vuelve a ofrecer", () => {
      // El caso exacto del reporte. Antes de esta versión devolvía false («no está hecho»).
      const psa = _pkg("Z125");
      t.cierto(!!psa, "el paquete del PSA existe en el catálogo");
      t.igual(psa.vigenciaDias, 730, "y ya tiene la vigencia que confirmó el médico (27-ago): 2 años");
      t.cierto(api.pymPaqueteCubiertoPorAthenea(psa, _LAB_PSA("2026-08-21"), _HOY99),
        "hecho hace 6 días: cubierto, no se premarca");
      t.cierto(api.pymPaqueteCubiertoPorAthenea(psa, _LAB_PSA("2025-09-01"), _HOY99),
        "hecho hace 360 días: sigue dentro de los 2 años");
      t.falso(api.pymPaqueteCubiertoPorAthenea(psa, _LAB_PSA("2024-01-15"), _HOY99),
        "hecho hace 955 días: fuera de los 2 años, se ofrece — y con razón");
      t.falso(api.pymPaqueteCubiertoPorAthenea(psa, [], _HOY99), "si no aparece, no se afirma que esté hecho");
    });

    t.caso("v17.6.99: NINGÚN paquete del catálogo puede quedarse sin cruzar contra Athenea", () => {
      // La guarda que impide que esto vuelva a pasar. Un paquete o tiene vigencia (y se
      // juzga si sigue vigente) o, al menos, se puede saber si está hecho y desde cuándo.
      // Lo que no puede es caer por el hueco y ofrecerse siempre en silencio.
      const sinCruce = [];
      for (const p of (api.__PYM_CATALOG || [])) {
        if (!p || !p.cie10) continue;
        const tieneCups = Array.isArray(p.cups) && p.cups.length;
        const tienePalabras = Array.isArray(p.keywords) && p.keywords.length;
        if (!tieneCups && !tienePalabras) sinCruce.push(p.cie10);
      }
      t.igual(sinCruce, [], "todo paquete necesita CUPS o palabras clave para poder reconocerse en Athenea");
    });

    t.caso("v17.6.99: «¿está hecho?» y «¿sigue vigente?» son dos preguntas distintas", () => {
      // Separarlas es lo que arregla el defecto: la segunda exige una vigencia declarada,
      // la primera no. La mamografía sigue sin vigencia confirmada.
      const mamo = _pkg("Z123");
      t.cierto(!!mamo && !mamo.vigenciaDias, "la mamografía sigue sin vigencia confirmada");
      const labs = _lab("876802", "MAMOGRAFIA BILATERAL", "2026-08-21", "BIRADS 1");
      t.falso(api.pymPaqueteCubiertoPorAthenea(mamo, labs, _HOY99),
        "sin vigencia NUNCA se declara cubierta: no se inventa el intervalo");
      const hecho = api.pymPaqueteHechoEnAthenea(mamo, labs, _HOY99);
      t.cierto(!!hecho, "pero SÍ se sabe que está hecha");
      t.igual(hecho.iso, "2026-08-21", "con su fecha");
      t.igual(hecho.dias, 6, "y cuántos días hace");
    });

    t.caso("v17.6.99: un examen PENDIENTE no cuenta como hecho, y la basura no revienta", () => {
      const psa = _pkg("Z125");
      t.igual(api.pymPaqueteHechoEnAthenea(psa, _LAB_PSA("2026-08-21", "PENDIENTE"), _HOY99), null,
        "una muestra sin procesar no es un examen hecho");
      t.igual(api.pymPaqueteHechoEnAthenea(psa, [], _HOY99), null, "sin laboratorios, null");
      t.igual(api.pymPaqueteHechoEnAthenea(null, _LAB_PSA("2026-08-21"), _HOY99), null, "sin paquete, null");
      t.igual(api.pymPaqueteHechoEnAthenea(psa, _LAB_PSA("2026-08-21"), "no-es-una-fecha"), null,
        "con la fecha de hoy ilegible NO se afirma nada — la misma trampa del cruce de RCV");
      t.noLanza(() => api.pymPaqueteHechoEnAthenea(psa, [{}, null, "basura"], _HOY99), "ni con basura dentro");
    });

    // =================================================================================
    //  v18.0.38 — UN EXAMEN NO ES UN PAQUETE (hallazgo L25747)
    //  La función devolvía «hecho» en cuanto UNA fila casara. Con eso el modal deshabilita
    //  la casilla y escribe en pantalla «se realizó hace N días; por ser tan reciente no la
    //  marcamos»: una afirmación falsa sobre una tamización que nadie hizo.
    // =================================================================================
    t.caso("v18.0.38: un paquete de 7 CUPS NO se da por hecho con un solo examen suelto", () => {
      const z108 = _pkg("Z108");
      t.cierto(!!z108 && z108.cups.length >= 7, "Z108 declara los siete componentes (" + (z108 && z108.cups.length) + ")");
      const soloCreatinina = _lab("903895", "CREATININA EN SUERO", "2026-06-01", "1.1");
      t.igual(api.pymPaqueteHechoEnAthenea(z108, soloCreatinina, _HOY99), null,
        "con una creatinina suelta no se afirma que el tamizaje cardiometabólico esté hecho");

      // Seis de siete tampoco: la cobertura es completa o no es.
      const seis = z108.cups.slice(0, 6).reduce((acc, c) => acc.concat(_lab(c.codigo, c.desc || "X", "2026-08-01", "1")), []);
      t.igual(api.pymPaqueteHechoEnAthenea(z108, seis, _HOY99), null, "seis de siete sigue siendo incompleto");

      // Y los siete sí.
      const siete = z108.cups.reduce((acc, c) => acc.concat(_lab(c.codigo, c.desc || "X", "2026-08-01", "1")), []);
      const hecho = api.pymPaqueteHechoEnAthenea(z108, siete, _HOY99);
      t.cierto(!!hecho, "con los siete componentes sí está hecho");
      t.igual(hecho.componentes, 7, "y se dice cuántos se cubrieron");
    });

    t.caso("v18.0.38: un paquete es tan VIEJO como su componente más viejo", () => {
      // El tercer defecto, encontrado al reproducir los otros dos: con el paquete completo
      // pero fechas dispares la función devolvía la MÁS RECIENTE. Un perfil lipídico de hace
      // seis meses se daba por actual porque los triglicéridos se repitieron la semana
      // pasada — y esa fecha es justo la que decide si el paquete sigue vigente.
      const z108 = _pkg("Z108");
      const dispares = z108.cups.reduce((acc, c, i) =>
        acc.concat(_lab(c.codigo, c.desc || "X", i === z108.cups.length - 1 ? "2026-08-28" : "2026-03-01", "1")), []);
      const hecho = api.pymPaqueteHechoEnAthenea(z108, dispares, _HOY99);
      t.cierto(!!hecho, "el paquete está completo");
      t.igual(hecho.iso, "2026-03-01", "la fecha es la del componente MÁS ANTIGUO, no la del último que se repitió");
      t.cierto(hecho.dias > 150, "y son meses, no días (" + hecho.dias + ")");
    });

    t.caso("v18.0.38: una palabra clave no cubre un CUPS — la HbA1c no hace un «Hemoglobina y Hematocrito»", () => {
      // «hemoglobina» casaba por SUBCADENA con «HEMOGLOBINA GLICOSILADA», que no pertenece
      // al paquete. Misma familia que el defecto de la v18.0.31, donde seis nombres del
      // hemograma se llevaban la casilla de la hemoglobina sérica.
      const z103 = _pkg("Z103");
      t.cierto(!!z103 && z103.keywords.indexOf("hemoglobina") >= 0,
        "Z103 sigue declarando «hemoglobina» como palabra clave (que es de donde venía el problema)");
      const hba1c = _lab("903843", "HEMOGLOBINA GLICOSILADA", "2026-08-25", "7.2");
      t.igual(api.pymPaqueteHechoEnAthenea(z103, hba1c, _HOY99), null,
        "un examen que NO es del paquete no lo da por hecho, aunque su nombre contenga la palabra clave");
      // Y con sus dos CUPS de verdad, sí.
      const propios = z103.cups.reduce((acc, c) => acc.concat(_lab(c.codigo, c.desc || "X", "2026-08-25", "14")), []);
      const hecho = api.pymPaqueteHechoEnAthenea(z103, propios, _HOY99);
      t.cierto(!!hecho && hecho.componentes === z103.cups.length,
        "con los CUPS del paquete completos sí está hecho (" + (hecho && hecho.componentes) + " de " + z103.cups.length + ")");
    });

    t.caso("v17.6.99: se queda con el resultado MÁS RECIENTE cuando hay varios", () => {
      const psa = _pkg("Z125");
      const varios = _LAB_PSA("2024-01-15").concat(_LAB_PSA("2026-08-21")).concat(_LAB_PSA("2025-03-02"));
      const h = api.pymPaqueteHechoEnAthenea(psa, varios, _HOY99);
      t.igual(h.iso, "2026-08-21", "el más reciente manda, venga en el orden que venga");
    });

    t.caso("v17.6.99 CABLEADO — el modal cruza TODOS los paquetes y respeta el tope para desmarcar", () => {
      // Los tres puntos viven dentro de openOrdenamientoModal, que el banco no puede
      // ejecutar con Athenea simulada. Se protegen por texto fuente, igual que las reglas
      // del sábado y de la cintura. Lo que no se puede ejecutar aquí, al menos no se puede
      // borrar sin que caiga una prueba.
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      t.falso(/const paquetesConVigencia = pkgsToRender\.filter/.test(src),
        "ya no se filtra por vigencia antes de cruzar: ese filtro ERA el defecto");
      t.cierto(/atheneaHechoPorCie10\[_p\.cie10\] = pymPaqueteHechoEnAthenea\(/.test(src),
        "los paquetes sin vigencia se cruzan por la vía de «¿está hecho?»");
      t.cierto(/const hechoYReciente = !mandaPym && !!hechoSinVigencia && hechoSinVigencia\.dias <= PYM_TOPE_DESMARCAR_SIN_VIGENCIA_DIAS;/.test(src),
        "y solo se desmarca lo reciente");
      t.cierto(/!yaHechoAthenea && !hechoYReciente/.test(src),
        "el premarcado mira las dos vías");
      // v17.14.0 — decisión del médico (27-ago): «mamografía guiarse netamente de los
      // SharePoints». Para esos paquetes, la lista de PyM de la sede manda sobre lo que
      // Athenea traiga: el resultado se muestra con su fecha, pero no toca la casilla.
      t.cierto(/const PYM_MANDA_SHAREPOINT = \["Z123"\];/.test(src),
        "la tamización de mama se guía por la lista de PyM, no por el tope de días");
      t.cierto(/const mandaPym = PYM_MANDA_SHAREPOINT\.indexOf\(pkg\.cie10\) >= 0;/.test(src),
        "y el premarcado lo consulta de verdad");
      t.cierto(/mandaPym \|\| \(!yaHechoAthenea && !hechoYReciente\)/.test(src),
        "si PyM manda, ni el cruce vigente ni el tope pueden desmarcarlo");
      t.cierto(/const PYM_TOPE_DESMARCAR_SIN_VIGENCIA_DIAS = 730;/.test(src),
        "el tope es el intervalo más largo que el médico ha confirmado, no uno inventado");
    });

    // =================================================================
    // v17.6.96 — EL PUNTO CIEGO DE LA HbA1c EN EL ANTIDUPLICADO
    //
    // El paquete I10X («RCV EXPRÉS») ordena el CUPS 903426 desde v14.0.0, pero
    // `pymRcvCubiertoPorAthenea` respondía «ya está todo cubierto» mirando solo las 8 claves
    // de RCV_VIGENCIA_KEYS, que no la incluyen. La pregunta que hay que mantener separada:
    // el AVISO ROJO se le hace a todo paciente (y ahí la HbA1c no entra, por decisión del
    // médico); el ANTIDUPLICADO responde «¿lo que este paquete iba a pedir ya está hecho?»,
    // y ahí sí entra — pero solo cuando consta que el paciente es diabético.
    // =================================================================

    const _labsHba1c = (fBase, fHba1c, valHba1c) => {
      const l = [
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: fBase },
        { codigo: "903815", nombre: "COLESTEROL HDL", Resultado: "45", Fecha: fBase },
        { codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "150", Fecha: fBase },
        { codigo: "903841", nombre: "GLUCOSA EN SUERO", Resultado: "90", Fecha: fBase },
        { codigo: "907106", nombre: "UROANALISIS", Resultado: "NORMAL", Fecha: fBase },
        { codigo: "903895", nombre: "CREATININA", Resultado: "0.9", Fecha: fBase },
        { codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "10", Fecha: fBase },
        { codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "50", Fecha: fBase },
      ];
      if (fHba1c) l.push({ codigo: "903426", nombre: "HEMOGLOBINA GLICOSILADA", Resultado: valHba1c || "6.5", Fecha: fHba1c });
      return l;
    };
    const _HOY96 = "2026-08-27";
    const _op96 = (dm, prog, est, extra) => Object.assign({
      programa: prog, estadio: est, esDM2: dm, esDm2: dm, categoriaRiesgo: "alto", aplicar50: true,
    }, extra || {});

    t.caso("v17.6.96: el aviso rojo de entrada NO cambia para NADIE", () => {
      // La regla del 11-08-2026 es innegociable: sin `clavesExtra`, la HbA1c no se mira,
      // ni en el diabético ni en el que no lo es. Si esta prueba cae, el arreglo se desbordó
      // al aviso que ve TODO paciente al abrir su historia.
      const labs = _labsHba1c("2026-07-28", "2026-01-20", "11.2");   // HbA1c de 219 días
      for (const dm of [true, false]) {
        const f = api._analitosRcvVencidos(labs, _HOY96, _op96(dm, dm ? "DM2" : "HTA", "G2"));
        t.igual(f.map((x) => x.key), [], "sin clavesExtra no se reporta nada (diabético=" + dm + ")");
      }
    });

    t.caso("v17.6.96: con clavesExtra, la HbA1c vencida SÍ se reporta", () => {
      const vieja = _labsHba1c("2026-07-28", "2026-01-20", "6.5");    // 219 días, en meta
      const f = api._analitosRcvVencidos(vieja, _HOY96, _op96(true, "DM2", "G2", { clavesExtra: ["HBA1C"] }));
      t.igual(f.map((x) => x.key), ["HBA1C"], "solo la HbA1c: lo demás está fresco");
      t.cierto(/HbA1c/.test(f[0].nombre || ""), "y con nombre legible, no «HBA1C» pelado (obtuvo: " + f[0].nombre + ")");

      const fresca = _labsHba1c("2026-07-28", "2026-08-20", "6.5");
      t.igual(api._analitosRcvVencidos(fresca, _HOY96, _op96(true, "DM2", "G2", { clavesExtra: ["HBA1C"] })).length, 0,
        "una HbA1c reciente y en meta no se reporta");

      const ninguna = _labsHba1c("2026-07-28", null);
      t.igual(api._analitosRcvVencidos(ninguna, _HOY96, _op96(true, "DM2", "G2", { clavesExtra: ["HBA1C"] })).map((x) => x.key),
        ["HBA1C"], "y si nunca se la han tomado, también");
    });

    t.caso("v17.6.96: BLOQ ya no se disfraza de 180 — un examen que la norma niega se SALTA", () => {
      // ERC sin diabetes documentada: la norma devuelve BLOQ para la HbA1c. Antes de esta
      // versión el consumidor lo traducía a 180 días planos, es decir afirmaba una vigencia
      // sobre un examen que la norma prohíbe pedir. Ahora se salta.
      t.igual(api.mtrVigenciaDiasNorma("ERC", "hba1c", "G4", false, 60, null), "BLOQ", "la norma lo bloquea");
      t.igual(api._vigenciaDiasParaAnalito("HBA1C", "6.5", _op96(false, "ERC", "G4")), "BLOQ",
        "y el consumidor propaga el BLOQ en vez de devolver 180");
      const labs = _labsHba1c("2026-07-28", "2026-01-20", "6.5");
      const f = api._analitosRcvVencidos(labs, _HOY96, _op96(false, "ERC", "G4", { clavesExtra: ["HBA1C"] }));
      t.igual(f.map((x) => x.key), [], "aun pidiéndola como clave extra, un ERC no diabético no la recibe");
      // EL CASO QUE DE VERDAD PRUEBA EL SALTO: sin ninguna HbA1c en Athenea. Con una
      // presente, la comparación `dias > "BLOQ"` da NaN y el analito tampoco se reporta —
      // así que ese caso NO distingue si el salto existe. Sin candidato, en cambio, la rama
      // de «nunca se la han tomado» lo empujaría a faltantes: un examen que la norma
      // PROHÍBE pedir, anunciado como pendiente.
      const sinNinguna = _labsHba1c("2026-07-28", null);
      t.igual(api._analitosRcvVencidos(sinNinguna, _HOY96, _op96(false, "ERC", "G4", { clavesExtra: ["HBA1C"] })).map((x) => x.key),
        [], "y si NUNCA se la han tomado, tampoco se pide: la norma la bloquea, no está «pendiente»");
      // Y con diabetes documentada la misma HbA1c sí se mira, con la vigencia de 120 de G4.
      const g = api._analitosRcvVencidos(labs, _HOY96, _op96(true, "ERC", "G4", { clavesExtra: ["HBA1C"] }));
      t.igual(g.map((x) => x.key), ["HBA1C"], "el mismo paciente, con diabetes documentada, sí");
    });

    t.caso("v17.6.96: la regla del 50 % alcanza por fin a la HbA1c", () => {
      // `HBA1C` llevaba en MTR_CLAVES_CON_META desde v16.4.0 sin ningún consumidor que le
      // pasara esa clave. Ahora una HbA1c fuera de meta acorta su vigencia a la mitad, igual
      // que el LDL: el descontrolado se cita antes.
      const o = _op96(true, "DM2", "G2");
      t.igual(api._vigenciaDiasParaAnalito("HBA1C", "6.5", o), 180, "en meta: los 180 completos");
      t.igual(api._vigenciaDiasParaAnalito("HBA1C", "11.2", o), 90, "fuera de meta: la mitad");
      const oErc = _op96(true, "ERC", "G4");
      t.igual(api._vigenciaDiasParaAnalito("HBA1C", "6.5", oErc), 120, "ERC G4 en meta: 120, no 180");
      t.igual(api._vigenciaDiasParaAnalito("HBA1C", "11.2", oErc), 60, "ERC G4 fuera de meta: 60");
    });

    t.caso("v17.6.96 PUNTA A PUNTA: el paquete RCV deja de declararse cubierto con la HbA1c vencida", () => {
      // Es el camino donde el defecto AFIRMA: la pantalla decía «Athenea ya tiene todos
      // estos resultados vigentes — el paciente ya se los hizo» sobre un paquete que iba a
      // pedir una HbA1c de 219 días. Nadie construye `clavesExtra` a mano en producción: lo
      // hace `pymRcvCubiertoPorAthenea` leyendo el resumen en caché. Si se corta ese cable
      // dejando todo lo demás intacto, esta prueba es la única que lo nota.
      const RES = (dm, prog, est) => ({
        programa: prog, erc: { estadioAdministrativo: est },
        factores: { diabetes: dm }, riesgo: { categoria: "alto" },
      });
      const cubierto = (docId, labs, res) => {
        api.mtrCacheResumenGuardar(docId, res);
        return api.pymRcvCubiertoPorAthenea(labs, _HOY96, docId);
      };
      const vieja = _labsHba1c("2026-07-28", "2026-01-20", "11.2");   // 219 días, 11,2 %
      const fresca = _labsHba1c("2026-07-28", "2026-08-20", "6.5");
      const ninguna = _labsHba1c("2026-07-28", null);

      t.falso(cubierto("h96-a", vieja, RES(true, "DM2", "G2")),
        "diabético con la HbA1c vencida: el paquete NO está cubierto");
      t.falso(cubierto("h96-b", ninguna, RES(true, "DM2", "G2")),
        "diabético sin ninguna HbA1c: tampoco, el paquete la ordena");
      t.cierto(cubierto("h96-c", fresca, RES(true, "DM2", "G2")),
        "diabético con la HbA1c reciente y en meta: sí está cubierto");
      t.cierto(cubierto("h96-d", vieja, RES(false, "HTA", "G2")),
        "NO diabético con esa misma HbA1c vieja: sigue cubierto, no se le pide");
      t.cierto(api.pymRcvCubiertoPorAthenea(vieja, _HOY96, "h96-sin-cache"),
        "sin resumen en caché no consta la diabetes, así que no se exige: «no se sabe» no se lee como «sí»");
      try { api.mtrCacheResumenBorrar(); } catch (e) {}
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
        // v17.6.96 — este paciente está marcado como diabético, y desde esa versión el
        // antiduplicado también exige la HbA1c en los diabéticos. Se le añade una reciente
        // y EN META para que esta prueba siga midiendo lo suyo —las vigencias por estadio—
        // y no se enrede con el hueco de la HbA1c, que tiene sus propias pruebas.
        { codigo: "903426", nombre: "HEMOGLOBINA GLICOSILADA", Resultado: "6.5", Fecha: "2026-08-20" },
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
