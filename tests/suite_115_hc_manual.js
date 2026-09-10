"use strict";
// =====================================================================
//  SUITE 115 — INTEGRIDAD DE LA CONEXIÓN REDACTOR ↔ HISTORIA CLÍNICA
//  (frente 3: los datos que el médico digita/edita A MANO en Everest)
//
//  Lo que el médico escribe a mano en las casillas de Everest no pasa por
//  ningún evento del asistente: vive en el DOM. La cadena que lo lleva hasta
//  el redactor es
//    mtrCosecharHcDelDom (lee la pantalla)
//      → mtrHcAcumularDelDom (fusiona con lo ya cosechado, sella la fecha)
//        → _vglCosechaGuardar (disco, CIFRADO desde v18.4.3)
//          → mtrHcLeer → mtrHcTextoParaHoja → mtrHojaDeHechos → prompt
//
//  Esta suite fija las cuatro propiedades que el encargo pide: que se
//  REGISTRE, que sea PERSISTENTE, que NO SE PIERDA al cosechar otra pantalla,
//  y que llegue de verdad al redactor. Se prueba la cadena completa, no una
//  copia recortada: el DOM de entrada imita las casillas reales (`name`/
//  `type`/`value`) que barre `mtrCosecharHcDelDom`.
// =====================================================================
module.exports = {
  nombre: "Suite 115 · Redactor ↔ HC de Everest (lo digitado a mano, persistente y sin pérdida)",
  cubre: ["mtrCosecharHcDelDom", "mtrHcAcumularDelDom", "mtrHcLeer", "mtrHcTextoParaHoja", "mtrHojaDeHechos", "mtrHojaDeHechosTexto", "mtrRedaccionPrompt"],
  async pruebas(t, api, env, cargar) {
    const DOC = "80123456";
    const HOY = "2026-09-09";
    const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
    const esperarA = async (fn) => {
      for (let i = 0; i < 100; i++) { const v = fn(); if (v) return v; await dormir(20); }
      return fn();
    };
    // DOM falso con la forma real de las casillas de Everest.
    const pantalla = (campos) => ({ querySelectorAll: () => campos });

    await t.casoAsync("HC·1 — lo digitado a mano se cosecha, se acumula y NO se pierde al cosechar otra pestaña", async () => {
      const c = cargar({ silencioso: true });
      const r1 = c.api.mtrHcAcumularDelDom(DOC, pantalla([
        { name: "antecedentePatologicos.observaciones", type: "text", value: "HTA diagnosticada a los 50 años" },
      ]));
      t.cierto(!!r1 && r1.nuevos === 1, "el primer dato digitado se cosecha");
      // Otra vuelta de reloj, OTRA pantalla (el médico navegó): lo de antes debe seguir.
      const r2 = c.api.mtrHcAcumularDelDom(DOC, pantalla([
        { name: "revisionSistema.observaciones", type: "text", value: "Niega disnea" },
      ]));
      t.cierto(!!r2 && r2.nuevos === 1, "el segundo dato también entra");
      const guardado = c.api.mtrHcLeer(DOC) || {};
      t.igual(guardado.dom["antecedentePatologicos.observaciones"], "HTA diagnosticada a los 50 años",
        "lo cosechado antes SIGUE ahí: la fusión es aditiva, no un reemplazo");
      t.igual(guardado.dom["revisionSistema.observaciones"], "Niega disnea", "y lo nuevo convive con lo viejo");
    });

    await t.casoAsync("HC·2 — el dato digitado HOY se sella como de hoy y lo cosechado antes conserva su fecha", async () => {
      const c = cargar({ silencioso: true });
      c.api.mtrHcAcumularDelDom(DOC, pantalla([
        { name: "signosVitales.peso", type: "text", value: "72,5" },
      ]));
      const sello = (c.api.mtrHcLeer(DOC) || {}).domFechas || {};
      t.cierto(!!sello["signosVitales.peso"], "cada ruta vista en esta pantalla queda fechada");
      t.igual(sello["signosVitales.peso"], c.api.todayStamp(), "y la fecha es la de HOY (no una inventada)");
      // Un campo que NO está en esta pantalla conserva su fecha anterior.
      const antes = c.api.mtrHcLeer(DOC).domFechas["signosVitales.peso"];
      c.api.mtrHcAcumularDelDom(DOC, pantalla([
        { name: "revisionSistema.observaciones", type: "text", value: "Sin hallazgos" },
      ]));
      t.igual((c.api.mtrHcLeer(DOC) || {}).domFechas["signosVitales.peso"], antes,
        "la fecha del campo no visto se conserva: no se re-fecha lo que no se tocó");
    });

    await t.casoAsync("HC·3 — la cosecha aterriza en el disco CIFRADA y vuelve íntegra por mtrHcLeer", async () => {
      const c = cargar({ silencioso: true });
      c.api.mtrHcAcumularDelDom(DOC, pantalla([
        { name: "examenFisico.cabezaCuello", type: "text", value: "Sin adenopatías" },
      ]));
      const crudo = await esperarA(() => {
        const v = c.env.storage.getItem("vgl_cosecha") || "";
        return v.indexOf("VGLC1:") === 0 ? v : "";
      });
      t.cierto(crudo.indexOf("VGLC1:") === 0, "el disco guarda el sobre cifrado, no el texto de la historia");
      t.falso(crudo.indexOf("Sin adenopatías") >= 0, "lo que el médico digitó NO vive en claro en el disco");
      const vuelto = c.api.mtrHcLeer(DOC) || {};
      t.igual((vuelto.dom || {})["examenFisico.cabezaCuello"], "Sin adenopatías",
        "y la lectura devuelve el dato íntegro: persistir no lo deforma");
    });

    await t.casoAsync("HC·4 — lo digitado a mano llega al REDACTOR dentro de los HECHOS DEL PACIENTE", async () => {
      const c = cargar({ silencioso: true });
      const TEXTO = "Refiere cefalea occipital de tres días de evolución";
      c.api.mtrHcAcumularDelDom(DOC, pantalla([
        { name: "revisionSistema.observaciones", type: "text", value: TEXTO },
      ]));
      const hc = c.api.mtrHcLeer(DOC);
      const hoja = c.api.mtrHojaDeHechos(
        { programa: "HTA", factores: { edad: 61, sexo: "F", hta: true }, erc: { egfr: 52, estadioClinico: "G3a" }, riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70 } } },
        { hoyIso: HOY, hcEverest: hc });
      const texto = c.api.mtrHojaDeHechosTexto(hoja);
      t.cierto(texto.indexOf(TEXTO) >= 0, "la hoja de hechos lleva lo digitado en la historia de Everest");
      const p = c.api.mtrRedaccionPrompt("enfermedad_actual", hoja, { nombrePaciente: "Paciente De Prueba" });
      t.cierto(p.user.indexOf(TEXTO) >= 0, "y el prompt que sale del equipo lo entrega al modelo");
      t.cierto(p.user.indexOf("LO REGISTRADO EN LA HISTORIA CLÍNICA DE EVEREST") >= 0, "rotulado como lo registrado en la historia clínica");
    });

    t.caso("HC·5 — el examen físico de HOY y el cosechado antes viajan SEPARADOS (una cifra vieja no se lee como de hoy)", () => {
      const texto = api.mtrHcTextoParaHoja({
        dom: { "signosVitales.peso": 72.5, "revisionSistema.observaciones": "Niega disnea" },
        domFechas: { "signosVitales.peso": "2026-09-09", "revisionSistema.observaciones": "2026-09-09" },
      }, "2026-09-09");
      t.cierto(texto.indexOf("digitado HOY en la pantalla de Everest") >= 0, "lo de hoy va rotulado como de ESTA consulta");
      t.cierto(texto.indexOf("peso: 72.5") >= 0, "y el valor viaja tal como se digitó");
      const antes = api.mtrHcTextoParaHoja({
        dom: { "signosVitales.peso": 80 },
        domFechas: { "signosVitales.peso": "2026-08-12" },
      }, "2026-09-09");
      t.cierto(antes.indexOf("cosechado 2026-08-12") >= 0, "y el cosechado en otra consulta lleva su fecha, para que no se confunda con el de hoy");
    });
  },
};
