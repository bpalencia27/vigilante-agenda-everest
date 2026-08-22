// =====================================================================
//  SUITE 58 — Inserción de la nota IA en la historia (el camino de escritura)
//
//  Aquí se escribe en la historia clínica, así que las reglas son duras:
//   · enfermedad actual va SOLO en el textarea name="UltimaEnfermedad" (Anamnesis);
//   · análisis va SOLO en el textarea con placeholder "Ingrese la descripción del
//     análisis y plan" (Impresión Diagnóstica) — el ancla capturada en los 4 mapas;
//   · JAMÁS sobrescribe una casilla con texto (la casilla del médico es sagrada);
//   · si no encuentra la casilla, lo dice, no inventa dónde escribir.
// =====================================================================

// DOM de prueba: casillas direccionables por name y por placeholder.
function domConCasillas(spec) {
  const areas = [];
  function ta(attrs) {
    const el = {
      tagName: "TEXTAREA", value: attrs.value || "", name: attrs.name || "", placeholder: attrs.placeholder || "",
      offsetParent: attrs.oculto ? null : {}, _setNg: 0,
      getAttribute(k) { return k === "placeholder" ? this.placeholder : (k === "name" ? this.name : null); },
      dispatchEvent() { return true; },  // setNgValue emite input/change tras fijar .value
    };
    areas.push(el); return el;
  }
  (spec || []).forEach(ta);
  return {
    _areas: areas,
    querySelector(sel) {
      const m = /\[name="([^"]+)"\]/.exec(sel || "");
      if (m) return areas.find((a) => a.name === m[1] && /textarea/i.test(sel)) || null;
      return null;
    },
    querySelectorAll(sel) { return /textarea/i.test(sel || "") ? areas.slice() : []; },
  };
}

module.exports = {
  nombre: "Inserción de la nota IA en la historia (solo casilla vacía, por ancla)",
  cubre: ["mtrCasillaPorNombre", "mtrCasillaAnalisis", "mtrInsertarSiVacia", "mtrInsertarNota"],

  pruebas(t, api) {
    // Nota: setNgValue del script hace el trabajo real; en el DOM de prueba basta con que
    // escriba .value. Comprobamos el efecto (value) y el resultado (booleanos).

    t.caso("encuentra la casilla de enfermedad actual por name=UltimaEnfermedad", () => {
      const doc = domConCasillas([{ name: "MotivoConsulta" }, { name: "UltimaEnfermedad" }]);
      const el = api.mtrCasillaPorNombre("UltimaEnfermedad", doc);
      t.cierto(!!el && el.name === "UltimaEnfermedad", "la halla por nombre exacto");
    });

    t.caso("encuentra la casilla de análisis por su placeholder capturado", () => {
      const doc = domConCasillas([
        { placeholder: "Ingrese las recomendaciones" },
        { placeholder: "Ingrese la descripción del análisis y plan" },
      ]);
      const el = api.mtrCasillaAnalisis(doc);
      t.cierto(!!el && /análisis y plan/.test(el.placeholder), "distingue el análisis de otras casillas de la historia");
    });

    t.caso("no confunde el análisis con otra textarea (recomendaciones, indicaciones)", () => {
      const doc = domConCasillas([{ placeholder: "Ingrese las recomendaciones" }, { placeholder: "Indicaciones" }]);
      t.igual(api.mtrCasillaAnalisis(doc), null, "sin la casilla real, null — no escribe en la equivocada");
    });

    t.caso("una casilla oculta (otra pestaña) no se elige", () => {
      const doc = domConCasillas([{ placeholder: "Ingrese la descripción del análisis y plan", oculto: true }]);
      t.igual(api.mtrCasillaAnalisis(doc), null, "offsetParent null -> no visible -> no se toca");
    });

    t.caso("mtrInsertarSiVacia respeta la casilla con texto (sagrada) y llena la vacía", () => {
      const vacia = { value: "", dispatchEvent() { return true; } };
      const llena = { value: "Ya escribí yo esto", dispatchEvent() { return true; } };
      t.cierto(api.mtrInsertarSiVacia(vacia, "texto nuevo"), "vacía: inserta");
      t.igual(vacia.value, "texto nuevo", "quedó el texto");
      t.falso(api.mtrInsertarSiVacia(llena, "no debe pisar"), "con texto: NO inserta");
      t.igual(llena.value, "Ya escribí yo esto", "el texto del médico intacto");
      t.falso(api.mtrInsertarSiVacia(vacia, ""), "texto vacío no inserta nada");
    });

    t.caso("mtrInsertarNota mete cada parte en su casilla y reporta con precisión", () => {
      const doc = domConCasillas([{ name: "UltimaEnfermedad" }, { placeholder: "Ingrese la descripción del análisis y plan" }]);
      const res = api.mtrInsertarNota({ enfermedadActual: "Evoluciona estable.", analisis: "Continuar manejo." }, doc);
      t.cierto(res.enfermedadActual && res.analisis, "ambas insertadas");
      t.igual(doc._areas[0].value, "Evoluciona estable.", "EA en UltimaEnfermedad");
      t.igual(doc._areas[1].value, "Continuar manejo.", "análisis en su casilla");
    });

    t.caso("si una casilla ya tiene texto, se inserta la otra y se avisa de la ocupada", () => {
      const doc = domConCasillas([{ name: "UltimaEnfermedad", value: "texto previo" }, { placeholder: "Ingrese la descripción del análisis y plan" }]);
      const res = api.mtrInsertarNota({ enfermedadActual: "nueva EA", analisis: "nuevo análisis" }, doc);
      t.falso(res.enfermedadActual, "EA no se insertó (estaba ocupada)");
      t.cierto(res.ea_ocupada, "y se reporta ocupada");
      t.cierto(res.analisis, "el análisis sí se insertó");
      t.igual(doc._areas[0].value, "texto previo", "el texto previo del médico intacto");
    });

    t.caso("si falta la casilla, se reporta sin casilla (no se inventa dónde escribir)", () => {
      const doc = domConCasillas([{ name: "UltimaEnfermedad" }]); // no hay casilla de análisis
      const res = api.mtrInsertarNota({ enfermedadActual: "EA", analisis: "análisis sin destino" }, doc);
      t.cierto(res.enfermedadActual, "EA insertada");
      t.cierto(res.an_sinCasilla, "análisis: sin casilla, reportado");
      t.falso(res.analisis, "y no se insertó en ningún lado");
    });
  },
};
