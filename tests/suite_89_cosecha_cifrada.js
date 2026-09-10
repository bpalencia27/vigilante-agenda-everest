// =====================================================================
//  SUITE 89 — CIFRADO EN REPOSO DE LA MEMORIA CLÍNICA (H5, auditoría
//  integral del 06-sep-2026, v18.4.3)
//
//  vgl_cosecha (confirmaciones, programas, factores; cédulas como clave)
//  y vgl_nosh_hist (inasistencias por cédula) dejaban PHI en claro en el
//  localStorage de un PC de consultorio compartido. Ahora el disco guarda
//  un sobre AES-GCM ("VGLC1:{v,iv,datos}") cifrado con la MISMA clave de
//  equipo de la carpeta (v18.0.144) y el claro solo vive en memoria.
//
//  Esta suite fija de punta a punta:
//    - el disco nunca vuelve a ver una cédula o un hecho clínico en claro;
//    - la redonda disco→memoria funciona (hidratación) con la misma clave;
//    - la migración claro→sobre adopta el legado sin perder nada;
//    - un sobre de OTRO equipo se descarta con aviso, sin lanzar;
//    - una escritura en vuelo (PENDING) no puede ser pisada por una
//      hidratación que leyó el disco viejo — el memo fresco manda.
// =====================================================================
const HEX_A = "11".repeat(32);   // mismas claves sintéticas que suite_69
const HEX_B = "2e".repeat(32);

module.exports = {
  nombre: "Cifrado en reposo de la memoria clínica (H5)",
  cubre: ["_vglCosechaTodo", "_vglCosechaGuardar", "_vglCosechaLeer", "_vglCosechaHidratarKick",
          "_vglSobreCifrar", "_vglSobreDescifrar", "_noShowLeer", "_noShowGuardar", "_noShowHidratarKick"],
  async pruebas(t, api, env, cargar) {
    const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
    // Espera ROBUSTA a que el disco cambie (el cifrado vuela en async; con el banco a
    // plena carga 40 ms pueden no alcanzar): sondea hasta 4 s en vez de dormir fijo.
    const esperarDisco = (c, clave, distintoDe) => {
      return (async () => {
        for (let i = 0; i < 200; i++) {
          const raw = c.env.storage.getItem(clave) || "";
          if (raw && raw !== distintoDe) return raw;
          await dormir(20);
        }
        return c.env.storage.getItem(clave) || "";
      })();
    };

    await t.casoAsync("H5 — al guardar, el disco lleva el SOBRE cifrado: ni cédula ni hecho clínico en claro", async () => {
      const c = cargar({ silencioso: true });
      c.api._vglCosechaGuardar("111111", { factores: { hta: true } });
      await dormir(40);   // deja volar el cifrado asíncrono
      const raw = c.env.storage.getItem("vgl_cosecha") || "";
      t.cierto(raw.indexOf("VGLC1:") === 0, "el almacén empieza por el sobre VGLC1: " + raw.slice(0, 18) + "…");
      t.falso(raw.indexOf("111111") >= 0, "la cédula NO vive en claro en el disco");
      t.falso(raw.indexOf("hta") >= 0, "ni el hecho clínico");
      const leido = c.api._vglCosechaLeer("111111");
      t.cierto(!!(leido && leido.factores && leido.factores.hta === true),
        "y la memoria se sirve completa desde el memo tras la escritura");
    });

    await t.casoAsync("H5 — redonda por disco: un arranque nuevo con la MISMA clave recupera la memoria", async () => {
      const cA = cargar({ silencioso: true });
      cA.api.__vglCarpetaResetClaveParaTest(HEX_A);
      cA.api._vglCosechaGuardar("222222", { factores: { dm: true } });
      const sobre = await esperarDisco(cA, "vgl_cosecha", "");
      t.cierto(sobre.indexOf("VGLC1:") === 0, "montaje: el disco de A quedó cifrado");

      // Contexto NUEVO (memo vacío) que hereda el disco y la clave de equipo de A.
      const cB = cargar({ silencioso: true });
      cB.api.__vglCarpetaResetClaveParaTest(HEX_A);
      cB.env.storage.setItem("vgl_cosecha", sobre);
      t.igual(cB.api._vglCosechaLeer("222222"), null,
        "montaje: sin hidratar, el sobre no se sirve (el memo está vacío)");
      await cB.api._vglCosechaHidratarKick();
      const rec = cB.api._vglCosechaLeer("222222");
      t.cierto(!!(rec && rec.factores && rec.factores.dm === true),
        "tras hidratar, la memoria cifrada en disco vuelve íntegra — la redonda pasa por crypto de verdad");
      cB.api.__vglCarpetaResetClaveParaTest(null);
    });

    await t.casoAsync("H5 — MIGRACIÓN: el texto claro legado se adopta y se re-cifra sin perder nada", async () => {
      const c = cargar({ silencioso: true });
      c.env.storage.setItem("vgl_cosecha", JSON.stringify({ "333333": { factores: { hta: true }, ts: 1 } }));
      const semilla = c.env.storage.getItem("vgl_cosecha");
      await c.api._vglCosechaHidratarKick();
      const raw = await esperarDisco(c, "vgl_cosecha", semilla);
      t.cierto(raw.indexOf("VGLC1:") === 0, "el legado en claro quedó re-cifrado en disco");
      t.falso(raw.indexOf("333333") >= 0, "sin rastro de la cédula en claro");
      const leido = c.api._vglCosechaLeer("333333");
      t.cierto(!!(leido && leido.factores && leido.factores.hta === true),
        "y lo aprendido antes del cifrado sigue ahí: la migración no pierde memoria");
    });

    await t.casoAsync("H5 — un sobre de OTRO equipo se descarta con la memoria en vacío, sin lanzar", async () => {
      const cA = cargar({ silencioso: true });
      cA.api.__vglCarpetaResetClaveParaTest(HEX_A);
      cA.api._vglCosechaGuardar("444444", { factores: { hta: true } });
      await dormir(40);
      const sobre = cA.env.storage.getItem("vgl_cosecha") || "";

      const cB = cargar({ silencioso: true });
      cB.api.__vglCarpetaResetClaveParaTest(HEX_B);   // otro computador
      cB.env.storage.setItem("vgl_cosecha", sobre);
      let lanzo = false;
      try { await cB.api._vglCosechaHidratarKick(); } catch (e) { lanzo = true; }
      t.falso(lanzo, "descifrar con la clave equivocada no revienta: se degrada con aviso");
      t.igual(cB.api._vglCosechaLeer("444444"), null,
        "la memoria del otro equipo NO se sirve aquí — igual que la carpeta, se descarta");
      // Y el equipo nuevo puede escribir la suya sin heredar la ajena.
      cB.api._vglCosechaGuardar("555555", { factores: { dm: true } });
      await dormir(40);
      t.cierto(!!(cB.api._vglCosechaLeer("555555") || {}).factores, "la escritura propia del equipo nuevo funciona");
      cB.api.__vglCarpetaResetClaveParaTest(null);
      cA.api.__vglCarpetaResetClaveParaTest(null);
    });

    await t.casoAsync("H5 — CARRERA: una escritura en vuelo (PENDING) no puede ser pisada por una hidratación del disco viejo", async () => {
      // Disco con un sobre AJENO (como recién copiado de otro equipo) que aún no se ha
      // hidratado; el médico cosecha ANTES de que la hidratación corra.
      const cA = cargar({ silencioso: true });
      cA.api.__vglCarpetaResetClaveParaTest(HEX_A);
      cA.api._vglCosechaGuardar("666666", { factores: { hta: true } });
      await dormir(40);
      const sobreViejo = cA.env.storage.getItem("vgl_cosecha") || "";

      // FLAKY CAZADO (07-sep, banco v18.4.5 a plena carga): la carrera que este caso
      // quiere demostrar depende de que el CIFRADO de la escritura siga volando cuando
      // la hidratación haga su guarda. Con webcrypto real, cifrar (que además importa
      // la clave) y descifrar son dos operaciones de latencia comparable y el orden de
      // llegada es una moneda al aire según la carga del equipo: bajo carga, el cifrado
      // podía terminar ANTES de la guarda, el sello PENDIENTE ya no estaba y el caso
      // fallaba aunque el producto estuviera bien. Se fija el orden con un crypto
      // inyectado (opción del arnés) que RETRASA el encrypt 120 ms: la escritura queda
      // PENDING con garantía cuando llega la hidratación, y la redonda por disco la
      // sigue esperando esperarDisco (hasta 4 s) — el camino real se ejercita igual.
      const _realCrypto = (typeof crypto !== "undefined" && crypto.subtle ? crypto : require("crypto").webcrypto);
      const cB = cargar({ silencioso: true, crypto: {
        getRandomValues: _realCrypto.getRandomValues.bind(_realCrypto),
        randomUUID: _realCrypto.randomUUID ? _realCrypto.randomUUID.bind(_realCrypto) : undefined,
        subtle: {
          importKey: _realCrypto.subtle.importKey.bind(_realCrypto.subtle),
          digest: _realCrypto.subtle.digest.bind(_realCrypto.subtle),
          deriveKey: _realCrypto.subtle.deriveKey.bind(_realCrypto.subtle),
          deriveBits: _realCrypto.subtle.deriveBits.bind(_realCrypto.subtle),
          sign: _realCrypto.subtle.sign.bind(_realCrypto.subtle),
          decrypt: _realCrypto.subtle.decrypt.bind(_realCrypto.subtle),
          encrypt: async (...args) => { await dormir(120); return _realCrypto.subtle.encrypt(...args); },
        },
      } });
      cB.api.__vglCarpetaResetClaveParaTest(HEX_B);
      cB.env.storage.setItem("vgl_cosecha", sobreViejo);   // disco viejo sin hidratar
      cB.api._vglCosechaGuardar("777777", { factores: { dm: true } });   // escritura en vuelo
      await cB.api._vglCosechaHidratarKick();   // la hidratación llega TARDE, con el disco viejo
      await dormir(40);
      const fusion = cB.api._vglCosechaLeer("777777");
      t.cierto(!!(fusion && fusion.factores && fusion.factores.dm === true),
        "lo escrito por el médico sigue en pie: la hidratación tardía no lo pisó con el disco viejo");
      const raw = await esperarDisco(cB, "vgl_cosecha", sobreViejo);
      t.cierto(raw.indexOf("VGLC1:") === 0 && raw !== sobreViejo, "y el disco terminó con el sobre NUEVO de esta escritura");
      cB.api.__vglCarpetaResetClaveParaTest(null);
      cA.api.__vglCarpetaResetClaveParaTest(null);
    });

    await t.casoAsync("H5 — vgl_nosh_hist: mismo sobre cifrado, redonda por disco incluida", async () => {
      const c = cargar({ silencioso: true });
      c.api.__vglCarpetaResetClaveParaTest(HEX_A);
      c.api._noShowGuardar({ "8888888888": { ultima: "2026-09-06", veces: 3 } });
      const raw = await esperarDisco(c, "vgl_nosh_hist", "");
      t.cierto(raw.indexOf("VGLC1:") === 0, "el historial de inasistencias descansa cifrado");
      t.falso(raw.indexOf("8888888888") >= 0, "la cédula no vive en claro");
      t.igual((c.api._noShowLeer()["8888888888"] || {}).veces, 3, "y el badge se sirve desde el memo");

      const cB = cargar({ silencioso: true });
      cB.api.__vglCarpetaResetClaveParaTest(HEX_A);
      cB.env.storage.setItem("vgl_nosh_hist", raw);
      await cB.api._noShowHidratarKick();
      t.igual((cB.api._noShowLeer()["8888888888"] || {}).veces, 3,
        "un arranque nuevo con la misma clave lo recupera del disco cifrado");
      c.api.__vglCarpetaResetClaveParaTest(null);
      cB.api.__vglCarpetaResetClaveParaTest(null);
    });
  }
};
