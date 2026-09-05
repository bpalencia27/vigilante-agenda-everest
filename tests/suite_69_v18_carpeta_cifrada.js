// =====================================================================
//  SUITE 69 — v18.0.144: la carpeta local deja de ser una historia
//  clínica identificada y pasa a ser un caché cifrado y seudonimizado.
//
//  Las nueve pruebas obligatorias del pedido, una por caso:
//   1. el nombre de archivo no contiene la cédula (20 cédulas inventadas)
//   2. dos equipos con claves distintas nombran distinto al mismo paciente
//   3. la cédula no vive en el contenido, ni en claro ni en la cabecera
//   4. el ancla de control anterior NO cambia ni una coma (migración y relectura)
//   5. un archivo del formato viejo se migra, poda, cifra y el original desaparece
//   6. purga a 365 días: el control de hace 366 se va, el de 364 se queda
//   7. una carpeta sincronizada con la nube se RECHAZA
//   8. sin clave de equipo el caché viejo se descarta y el asistente sigue
//   9. «Borrar todo lo guardado» deja la carpeta sin archivos del asistente
//
//  CERO datos de paciente: TODAS las cédulas de esta suite son INVENTADAS
//  y no corresponden a persona alguna; los nombres de medicamentos son
//  genéricos de catálogo.
// =====================================================================

// Un "disco" de carpeta para la costura fs: leer/escribir/listar/borrar.
function fsDe(disco) {
  return {
    leer: async (n) => (n in disco ? disco[n] : null),
    escribir: async (n, txt) => { disco[n] = txt; return true; },
    listar: async () => Object.keys(disco),
    borrar: async (n) => { delete disco[n]; return true; },
  };
}

module.exports = {
  nombre: "v18.0.144 — la carpeta local como caché cifrado: seudonimizado, AES-GCM, migración, purga y borrado total",

  cubre: [
    "mtrNombreArchivoPaciente", "_vglCarpetaClaveEquipo", "_vglCarpetaCifrar", "_vglCarpetaDescifrar",
    "_vglCarpetaMigrar", "_vglCarpetaPurgar", "_vglCarpetaFechaIsoHace", "_vglCarpetaContar",
    "vglCarpetaBorrarTodo", "vglCarpetaElegir", "_vglCarpetaPareceSincronizada",
    "mtrControlAnteriorDe", "mtrAnclaControlAnterior", "mtrPrellenadoEnfermedadActual",
    "vglCarpetaGuardarInstantanea", "vglCarpetaLeerHistorial", "_vglCarpetaEntender",
  ],

  async pruebas(t, api, env, cargar) {

    // Dos "equipos" falsos: claves de 256 bits inventadas, solo para ver que
    // el nombre y el cifrado dependen de la clave y no solo de la cédula.
    const HEX_A = "11".repeat(32), HEX_B = "2e".repeat(32);

    // (1) El nombre de archivo nunca contiene la cédula, completa ni en partes.
    await t.casoAsync("carpeta v18.0.144 (1): el nombre de archivo no contiene la cédula — 20 cédulas inventadas", async () => {
      const ceds = [];
      for (let i = 0; i < 20; i++) ceds.push(String(1000000 + i * 777));   // inventadas
      const nombres = new Set(), delaciones = [];
      for (const c of ceds) {
        const n = await api.mtrNombreArchivoPaciente(c);
        if (!/^[0-9a-f]{64}\.json$/.test(n || "")) { delaciones.push("formato:" + c); continue; }
        if (n.indexOf(c) >= 0) delaciones.push("completa:" + c);
        for (let i = 0; i + 6 <= c.length; i++) {          // ninguna parte de 6+ dígitos
          if (n.indexOf(c.slice(i, i + 6)) >= 0) { delaciones.push("parte:" + c + ":" + c.slice(i, i + 6)); break; }
        }
        nombres.add(n);
      }
      t.igual(delaciones.length, 0, "ninguno de los 20 nombres delata la cédula: " + delaciones.slice(0, 3).join(" | "));
      t.igual(nombres.size, 20, "y las 20 cédulas distintas dan 20 archivos distintos");
    });

    // (2) Dos equipos (claves distintas) producen nombres —y sobres— incompatibles.
    await t.casoAsync("carpeta v18.0.144 (2): dos equipos con claves distintas nombran distinto al mismo paciente", async () => {
      const original = await api._vglCarpetaClaveEquipo();
      try {
        api.__vglCarpetaResetClaveParaTest(HEX_A);
        const nA = await api.mtrNombreArchivoPaciente("71930455");   // inventada
        api.__vglCarpetaResetClaveParaTest(HEX_B);
        const nB = await api.mtrNombreArchivoPaciente("71930455");
        t.cierto(!!nA && !!nB && nA !== nB, "mismo paciente en dos equipos → dos archivos distintos");
        // El sobre que cifró A no lo abre B: la clave del equipo es la frontera.
        api.__vglCarpetaResetClaveParaTest(HEX_A);
        const disco = {}; const fs = fsDe(disco);
        const r = await api.vglCarpetaGuardarInstantanea("71930455", { fecha: "2026-09-01", riesgo: { categoria: "ALTO" } }, fs);
        t.cierto(r.ok, "el equipo A guarda");
        api.__vglCarpetaResetClaveParaTest(HEX_B);
        t.igual(await api._vglCarpetaDescifrar(disco[nA]), null, "el equipo B no puede abrir el sobre de A: se descarta, es un caché");
        t.igual(await api.vglCarpetaLeerHistorial("71930455", fs), null, "ni leerlo como historial");
      } finally {
        api.__vglCarpetaResetClaveParaTest(original);
      }
    });

    // (3) La cédula no vive en el contenido del archivo, ni cifrada de nombre ni en la cabecera.
    await t.casoAsync("carpeta v18.0.144 (3): la cédula no está en el contenido, ni en claro ni en la cabecera", async () => {
      const disco = {}; const fs = fsDe(disco);
      const r = await api.vglCarpetaGuardarInstantanea("71930455", { fecha: "2026-08-20", riesgo: { categoria: "ALTO" } }, fs);
      t.cierto(r.ok, "se guarda");
      const sobre = disco[r.archivo];
      t.cierto(!!sobre, "el archivo existe");
      t.falso(sobre.indexOf("71930455") >= 0, "la cédula no está en el sobre que queda en claro");
      t.igual(Object.keys(JSON.parse(sobre)).sort().join(","), "datos,iv,tipo,v",
        "la cabecera solo lleva versión, tipo e IV — nada más que decir");
      t.igual(JSON.parse(sobre).tipo, "cache-derivado-no-historia-clinica", "y se declara lo que es: caché derivado, no historia clínica");
      const claro = await api._vglCarpetaDescifrar(sobre);
      t.cierto(!!claro, "el equipo propio sí lo abre");
      t.falso(JSON.stringify(claro).indexOf("71930455") >= 0, "y el contenido descifrado tampoco la lleva: no hay campo doc");
    });

    // (4) El ancla que viaja al redactor de Enfermedad Actual no cambia NI UNA COMA.
    await t.casoAsync("carpeta v18.0.144 (4): el ancla de control anterior es EXACTAMENTE la misma tras migrar al formato cifrado", async () => {
      const hoy = "2026-09-04", cedula = "71930455";
      // Un control del formato VIEJO con todo lo que se retiró y todo lo que se conserva.
      const ctl = {
        fecha: "2026-03-10", edad: 66, sexo: "F", doc: cedula, medico: "INVENTADO",
        riesgo: { categoria: "ALTO", criterios: ["diabetes"], paso: 2 },
        renal: { crcl: 52, egfr: 55, estadioAdministrativo: "3a", estadioClinico: "G3a", egfrPrevio: 58, egfrPrevioFecha: "2025-11-02", sospechaIra: false, remitirNefrologia: false },
        metas: { ldl: 70, ldlActual: 132, ldlBasal: 180, reduccionPct: 26, hba1c: 7.8, hba1cMeta: 7 },
        laboratorios: { creatinina: 1.2, ldl: 132, hbA1c: 7.8 },
        series: { LDL: [{ fecha: "2025-01-01", valor: 180 }, { fecha: "2026-03-10", valor: 132 }] },
        medicamentos: ["LOSARTAN 50MG", "METFORMINA 850MG", "ATORVASTATINA 40MG"],
        duplicidades: [], uroanalisis: { proteina: "trace" },
        plan: { ordenar: [{ nombre: "HbA1c" }, { nombre: "Lipidograma" }] },
      };
      const disco = {};
      disco[cedula + ".json"] = JSON.stringify({ v: 1, doc: cedula, controles: [ctl] });
      const fs = fsDe(disco);
      const anclaVieja = api.mtrAnclaControlAnterior(api.mtrControlAnteriorDe(JSON.parse(disco[cedula + ".json"]), hoy), hoy);
      t.cierto(anclaVieja.length > 40, "el ancla del formato viejo dice algo (sanity)");
      const mig = await api._vglCarpetaMigrar(fs);
      t.igual(mig.migrados, 1, "el archivo viejo se migra");
      const leido = await api.vglCarpetaLeerHistorial(cedula, fs);
      t.cierto(!!leido && leido.controles.length === 1, "el caché cifrado se lee de vuelta");
      const anclaNueva = api.mtrAnclaControlAnterior(api.mtrControlAnteriorDe(leido, hoy), hoy);
      t.igual(anclaNueva, anclaVieja, "el ancla es EXACTAMENTE la misma, ni una coma");
      t.igual(api.mtrPrellenadoEnfermedadActual(leido, hoy).texto, anclaVieja, "y ese mismo texto es el que viaja al redactor");
    });

    // (5) La migración poda al esquema mínimo, cifra… y el original identificable DESAPARECE.
    await t.casoAsync("carpeta v18.0.144 (5): un archivo del formato viejo se migra, se poda, se cifra y el original desaparece", async () => {
      const cedula = "71930455";
      const disco = {};
      disco[cedula + ".json"] = JSON.stringify({
        v: 1, doc: cedula,
        controles: [{
          fecha: "2026-03-10", edad: 66, doc: cedula,
          riesgo: { categoria: "ALTO" }, renal: { egfr: 55, estadioClinico: "G3a" },
          metas: { ldl: 70, ldlActual: 132 }, medicamentos: ["LOSARTAN 50MG"],
          laboratorios: { ldl: 132 }, series: { LDL: [{ fecha: "2026-03-10", valor: 132 }] },
          plan: { ordenar: [{ nombre: "HbA1c" }] },
        }],
      });
      disco["9999988888.json"] = '{"otra":"cosa"}';      // nombre parece legado, contenido ajeno
      disco["leeme.txt"] = "no es del asistente";
      const fs = fsDe(disco);
      const mig = await api._vglCarpetaMigrar(fs);
      t.igual(mig.migrados, 1, "un migrado");
      t.igual(mig.pendientes.length, 0, "cero pendientes: la migración está completa");
      t.falso((cedula + ".json") in disco, "el archivo con la cédula en el nombre DESAPARECE");
      t.cierto("9999988888.json" in disco && "leeme.txt" in disco, "lo que no es del asistente no se toca");
      const nuevo = Object.keys(disco).find((n) => /^[0-9a-f]{64}\.json$/.test(n));
      t.cierto(!!nuevo, "queda un único caché con nombre seudonimizado");
      const podado = await api._vglCarpetaDescifrar(disco[nuevo]);
      t.cierto(!!podado && podado.controles.length === 1, "se descifra con el control dentro");
      t.igual(Object.keys(podado.controles[0]).sort().join(","), "fecha,medicamentos,metas,plan,renal,riesgo,v", "podado al esquema mínimo");
      t.cierto(podado.controles[0].laboratorios === undefined && podado.controles[0].series === undefined
        && podado.controles[0].doc === undefined && podado.controles[0].edad === undefined,
        "laboratorios, series, doc y edad se fueron sin volver");
      t.igual(podado.controles[0].renal.egfr, 55, "la TFG que el ancla sí lee se conserva");
    });

    // (6) Purga a 365 días: controles más viejos fuera; archivo vacío, afuera también.
    await t.casoAsync("carpeta v18.0.144 (6): purga a 365 días — el control de hace 366 días se va, el de 364 se queda", async () => {
      const disco = {}; const fs = fsDe(disco);
      const f366 = api._vglCarpetaFechaIsoHace(366), f364 = api._vglCarpetaFechaIsoHace(364);
      t.cierto(f366 < f364 && f366.length === 10, "las fechas de prueba son relativas a hoy (sanity)");
      await api.vglCarpetaGuardarInstantanea("41414141", { fecha: f366 }, fs);   // inventada
      await api.vglCarpetaGuardarInstantanea("41414141", { fecha: f364 }, fs);   // mismo paciente, control vigente
      await api.vglCarpetaGuardarInstantanea("52525252", { fecha: f366 }, fs);   // solo el viejo → archivo entero
      const r = await api._vglCarpetaPurgar(fs);
      t.igual(r.controles, 2, "los dos controles de hace 366 días se purgan (conteo, nunca cuáles)");
      t.igual(r.archivos, 1, "el archivo que quedó sin controles se elimina");
      const h = await api.vglCarpetaLeerHistorial("41414141", fs);
      t.cierto(!!h && h.controles.length === 1 && h.controles[0].fecha === f364, "el control de hace 364 días se conserva");
      t.igual(await api.vglCarpetaLeerHistorial("52525252", fs), null, "el paciente purgado entero ya no está");
    });

    // (7) Carpetas sincronizadas: rechazo, no advertencia.
    await t.casoAsync("carpeta v18.0.144 (7): una carpeta sincronizada con la nube se RECHAZA", async () => {
      const c = cargar({ silencioso: true });
      c.env.win.showDirectoryPicker = async () => ({ name: "OneDrive - Consultorio" });
      const r = await c.api.vglCarpetaElegir();
      t.cierto(!!r && r.ok === false && r.sincronizada === true, "se RECHAZA, no se advierte y sigue: " + JSON.stringify(r));
      t.falso(c.api.vglCarpetaElegida(), "la carpeta NO queda elegida: nada se escribiría ahí");
    });

    // (8) Sin clave de equipo (almacenamiento limpiado): el caché viejo se descarta
    //     sin romper nada y el asistente sigue; el redactor queda sin ancla, igual
    //     que cuando no hay carpeta elegida.
    await t.casoAsync("carpeta v18.0.144 (8): sin clave de equipo el caché viejo se descarta y el asistente sigue funcionando", async () => {
      const disco = {}; const fs = fsDe(disco);
      const hoy = "2026-09-04";
      const r0 = await api.vglCarpetaGuardarInstantanea("63636363", { fecha: "2026-08-30", riesgo: { categoria: "ALTO" } }, fs);
      t.cierto(r0.ok, "con clave de equipo se guarda (sanity)");
      t.cierto(api.mtrPrellenadoEnfermedadActual(await api.vglCarpetaLeerHistorial("63636363", fs), hoy).hay, "y hay ancla (sanity)");
      const original = await api._vglCarpetaClaveEquipo();
      try {
        api.__vglCarpetaResetClaveParaTest(null);      // se perdió la clave: perfil limpiado
        t.igual(await api.vglCarpetaLeerHistorial("63636363", fs), null, "el caché viejo ya no abre: se descarta, no rompe");
        const sinAncla = api.mtrPrellenadoEnfermedadActual(null, hoy);
        t.falso(sinAncla.hay, "el redactor se queda sin ancla, como sin carpeta elegida");
        const r1 = await api.vglCarpetaGuardarInstantanea("63636363", { fecha: "2026-09-01" }, fs);
        t.cierto(r1.ok, "el asistente SIGUE: con la clave nueva vuelve a guardar en su propio archivo");
      } finally {
        api.__vglCarpetaResetClaveParaTest(original);
      }
      const h = await api.vglCarpetaLeerHistorial("63636363", fs);
      t.cierto(!!h && h.controles.length === 1 && h.controles[0].fecha === "2026-08-30",
        "restaurada la clave, el caché original vuelve a leerse: se descartó, no se destruyó");
    });

    // (9) «Borrar todo lo guardado» deja la carpeta sin ningún archivo del asistente.
    await t.casoAsync("carpeta v18.0.144 (9): «Borrar todo lo guardado» deja la carpeta sin archivos del asistente", async () => {
      const disco = {}; const fs = fsDe(disco);
      await api.vglCarpetaGuardarInstantanea("74747474", { fecha: "2026-08-01" }, fs);
      await api.vglCarpetaGuardarInstantanea("85858585", { fecha: "2026-08-02", riesgo: { categoria: "MODERADO" } }, fs);
      const nombre74 = await api.mtrNombreArchivoPaciente("74747474");
      disco[nombre74.replace(/\.json$/, "") + ".roto-20260801.json"] = "basura {{{";
      disco["9696969696.json"] = JSON.stringify({ v: 1, doc: "9696969696", controles: [{ fecha: "2026-01-05" }] });  // legado del formato viejo
      disco["vacaciones.jpg"] = "datos ajenos";
      disco["9999888877.json"] = '{"otra":"cosa"}';   // nombre parece legado, contenido ajeno
      const conteo = await api._vglCarpetaContar(fs);
      t.cierto(!!conteo && conteo.archivos === 2, "Ajustes sabe cuántos archivos del caché hay: " + JSON.stringify(conteo));
      t.igual(conteo.controles, 2, "y cuántos controles");
      const r = await api.vglCarpetaBorrarTodo(fs);
      t.cierto(r.n >= 4, "borra caché cifrado, respaldo .roto y legado viejo: " + r.n);
      t.igual(r.fallos.length, 0, "sin fallos");
      t.cierto(disco["vacaciones.jpg"] === "datos ajenos" && disco["9999888877.json"] !== undefined, "lo ajeno queda intacto");
      // «Archivo del asistente» = nombre seudonimizado, respaldo .roto, o nombre legado cuyo
      // contenido ENTIENDE como historial nuestro. Un ajeno que solo PARECE legado no lo es.
      const restos = [];
      for (const n of Object.keys(disco)) {
        if (/^[0-9a-f]{64}/i.test(n) || /\.roto-/.test(n)) { restos.push(n); continue; }
        if (/^\d+\.json$/.test(n) && await api._vglCarpetaEntender(disco[n])) restos.push(n);
      }
      t.igual(restos.length, 0, "no queda NI UN archivo del asistente en la carpeta: " + restos.join(", "));
    });
  },
};
