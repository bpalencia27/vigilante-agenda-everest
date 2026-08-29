// =====================================================================
//  SUITE 50 — El puente entre los tres modales (caché + gaps 1 y 2)
//
//  El modal de laboratorios calcula el resumen y lo guarda en caché;
//  agendamiento y ordenamiento lo leen SIN volver a la red. Esta suite
//  fija que la caché no cruce pacientes, que la fecha sugerida caiga en el
//  chip correcto, y que la prioridad del PyM solo suba cuando la
//  clasificación de verdad lo justifica.
// =====================================================================

module.exports = {
  nombre: "Puente entre modales (caché, fecha sugerida y prioridad PyM)",
  cubre: [
    "mtrCacheResumenGuardar", "mtrCacheResumenLeer",
    "mtrItemSugeridoEnRango", "mtrPrioridadPaquetePym",
  ],

  pruebas(t, api) {
    // ================= CACHÉ =================

    t.caso("lo que guarda el modal de labs se puede leer con el mismo documento", () => {
      const resumen = { plan: { ftl: "2026-09-01", control: { fecha: "2026-09-07" } } };
      t.cierto(api.mtrCacheResumenGuardar("111", resumen), "se guarda");
      const leido = api.mtrCacheResumenLeer("111");
      t.cierto(!!leido && leido.plan.control.fecha === "2026-09-07", "y se lee igual");
    });

    t.caso("la caché NUNCA cruza pacientes: otro documento lee null", () => {
      api.mtrCacheResumenGuardar("111", { plan: { ftl: "2026-09-01" } });
      t.igual(api.mtrCacheResumenLeer("222"), null,
        "un documento distinto no puede leer el resumen de otro — es la misma barrera anti-cruce del resto del script");
    });

    t.caso("guardar sin documento o sin resumen no hace nada y no lanza", () => {
      t.falso(api.mtrCacheResumenGuardar("", { plan: {} }), "sin documento");
      t.falso(api.mtrCacheResumenGuardar("333", null), "sin resumen");
      t.igual(api.mtrCacheResumenLeer(""), null, "leer sin documento devuelve null");
    });

    // =====================================================================
    // v17.6.0 — RELOJES DE FRESCURA UNIFICADOS A 10 MIN: el del resumen bajó de 20
    // a 10 (aprobado el 22-ago junto con el resto de la lista del 20-ago). A los 15
    // minutos, el reloj VIEJO lo seguía dando por fresco; el NUEVO ya no. El gancho
    // __envejecerCacheResumen vive solo en el cargador de pruebas (harness.js ya
    // declara que no toca el archivo de producción) y adelanta el `ts` guardado
    // para simular el paso del tiempo sin dormir minutos de verdad.
    // =====================================================================
    // v17.29.0 — ENCARGO DEL MÉDICO (28-ago, decisión #23): el TTL bajó otra vez, de 10 a
    // 3 min — se le explicó el mecanismo (Agendamiento/Ordenamiento reutilizan el resumen
    // que calculó Laboratorios, para no repetir la consulta de red) y eligió 3 minutos
    // para que una consulta activa no se apoye en datos que ya cambiaron.
    t.caso("v17.29.0 — el TTL del resumen bajó de 10 a 3 min: a los 4 min ya no se lee (con el reloj viejo sí se habría leído)", () => {
      api.mtrCacheResumenGuardar("444", { plan: { ftl: "2026-09-01" } });
      t.cierto(!!api.mtrCacheResumenLeer("444"), "recién guardado: vigente");
      api.__envejecerCacheResumen(2 * 60000 + 30000); // 2m30s atrás: dentro de los 3 min nuevos
      t.cierto(!!api.mtrCacheResumenLeer("444"), "a los 2m30s sigue vigente con el TTL nuevo");
      api.__envejecerCacheResumen(4 * 60000); // 4 min atrás: dentro de los 10 viejos, fuera de los 3 nuevos
      t.igual(api.mtrCacheResumenLeer("444"), null,
        "a los 4 min: con el TTL viejo (10 min) todavía se habría leído; con el nuevo (3 min) ya no");
    });

    // ================= FECHA SUGERIDA EN EL RANGO =================

    const rango = [
      { iso: "2026-09-03" }, { iso: "2026-09-04" }, { iso: "2026-09-07", isCenter: true },
      { iso: "2026-09-08" }, { iso: "2026-09-09" },
    ];

    t.caso("si la fecha de control está en el rango, se elige ese chip exacto", () => {
      const it = api.mtrItemSugeridoEnRango(rango, "2026-09-07");
      t.igual(it.iso, "2026-09-07", "coincidencia exacta");
    });

    t.caso("si no está exacta, se elige el chip más cercano por fecha", () => {
      const it = api.mtrItemSugeridoEnRango(rango, "2026-09-06");
      t.igual(it.iso, "2026-09-07", "el 6 no está; el más cercano es el 7 (1 día) frente al 4 (2 días)");
      const it2 = api.mtrItemSugeridoEnRango(rango, "2026-09-01");
      t.igual(it2.iso, "2026-09-03", "antes del rango: el primer día");
    });

    t.caso("un rango vacío o una fecha inválida devuelven null, no un chip inventado", () => {
      t.igual(api.mtrItemSugeridoEnRango([], "2026-09-07"), null, "rango vacío");
      t.igual(api.mtrItemSugeridoEnRango(rango, "no-es-fecha"), null, "fecha inválida");
      t.igual(api.mtrItemSugeridoEnRango(null, "2026-09-07"), null, "rango nulo");
    });

    // ================= PRIORIDAD DEL PAQUETE PyM =================

    t.caso("el paquete RCV exprés sube a prioritario cuando hay labs de RCV pendientes", () => {
      const resumen = { plan: { faltantes: [{ clave: "CREATININA" }], vencidos: [{ clave: "RAC" }] } };
      const p = api.mtrPrioridadPaquetePym("I10X", resumen);
      t.igual(p.nivel, "alta", "con 2 pendientes, prioritario");
      t.cierto(/pendiente/i.test(p.motivo), "y el motivo lo dice");
    });

    t.caso("el paquete RCV también sube por falla terapéutica, aunque no falten labs", () => {
      const grave = api.mtrPrioridadPaquetePym("I10X", { plan: { faltantes: [], vencidos: [] }, fallas: { hayGrave: true } });
      t.igual(grave.nivel, "alta", "falla grave -> prioritario");
      const leve = api.mtrPrioridadPaquetePym("I10X", { plan: { faltantes: [], vencidos: [] }, fallas: { hayLeve: true } });
      t.igual(leve.nivel, "alta", "falla leve también");
    });

    t.caso("el paquete RCV sin nada pendiente NO se marca prioritario", () => {
      const p = api.mtrPrioridadPaquetePym("I10X", { plan: { faltantes: [], vencidos: [] }, fallas: {} });
      t.igual(p.nivel, "normal", "sin pendientes ni falla, normal");
    });

    t.caso("los paquetes de tamizaje (mama, cérvix, próstata) NO los prioriza la clasificación de RCV", () => {
      // Su prioridad la marca la coincidencia con el Excel de PyM, no el RCV;
      // inventarles urgencia por la clasificación cardiovascular sería un error.
      const conPendientes = { plan: { faltantes: [{ clave: "CREATININA" }], vencidos: [] } };
      t.igual(api.mtrPrioridadPaquetePym("Z123", conPendientes).nivel, "normal", "mamografía: normal");
      t.igual(api.mtrPrioridadPaquetePym("Z124", conPendientes).nivel, "normal", "citología: normal");
      t.igual(api.mtrPrioridadPaquetePym("Z125", conPendientes).nivel, "normal", "PSA: normal");
    });

    t.caso("sin resumen (no se abrió Laboratorios) ningún paquete se marca prioritario", () => {
      t.igual(api.mtrPrioridadPaquetePym("I10X", null).nivel, "normal", "sin clasificación no se inventa prioridad");
    });
  },
};
