module.exports = {
  nombre: "Función Renal y KDIGO",
  cubre: [
    "cockcroftGault",
    "ckdEpi2021",
    "estadioKDIGO",
    "evaluarDiscordanciaTFG",
    "checkFuncionRenal"
  ],
  pruebas(t, api) {
    t.caso("cockcroftGault: mujer obesa (peso real)", () => {
      // Vector del proyecto hermano: mujer 63 años, 113 kg, cr 0.55 -> 186.8
      const v = api.cockcroftGault(63, 113, 0.55, "F");
      t.igual(v, 186.8, "el resultado de la mujer obesa debe ser exactamente 186.8");
    });

    t.caso("cockcroftGault: valores fuera de rango o faltantes", () => {
      t.igual(api.cockcroftGault(0, 70, 1.0, "M"), 0, "edad 0 devuelve 0");
      t.igual(api.cockcroftGault(141, 70, 1.0, "M"), 0, "edad >= 140 devuelve 0");
      t.igual(api.cockcroftGault(50, 0, 1.0, "M"), 0, "peso 0 devuelve 0");
      t.igual(api.cockcroftGault(50, 70, 0, "M"), 0, "cr 0 devuelve 0");
    });

    t.caso("ckdEpi2021: hombre vs mujer (factores)", () => {
      const vM = api.ckdEpi2021(55, 1.1, "M");
      const vF = api.ckdEpi2021(55, 1.1, "F");
      t.cierto(vM > 0 && vF > 0 && vM !== vF, "los factores de sexo deben cambiar el resultado");
      // 142 * (1.1/0.9)^-1.200 * 0.9938^55
      t.cierto(Math.abs(vM - 79.3) < 0.5, "resultado hombre esperado aprox 79.3 (fue: " + vM + ")");
      t.cierto(Math.abs(vF - 60.1) < 2.0, "resultado mujer esperado aprox 60.1 (fue: " + vF + ")");
    });

    t.caso("ckdEpi2021: valores faltantes", () => {
      t.igual(api.ckdEpi2021(0, 1.1, "M"), 0, "edad 0 devuelve 0");
      t.igual(api.ckdEpi2021(55, 0, "M"), 0, "cr 0 devuelve 0");
    });

    t.caso("estadioKDIGO: fronteras exactas", () => {
      t.igual(api.estadioKDIGO(90), "G1", "90 es G1");
      t.igual(api.estadioKDIGO(89.9), "G2", "89.9 es G2");
      t.igual(api.estadioKDIGO(60), "G2", "60 es G2");
      t.igual(api.estadioKDIGO(59.9), "G3a", "59.9 es G3a");
      t.igual(api.estadioKDIGO(45), "G3a", "45 es G3a");
      t.igual(api.estadioKDIGO(44.9), "G3b", "44.9 es G3b");
      t.igual(api.estadioKDIGO(30), "G3b", "30 es G3b");
      t.igual(api.estadioKDIGO(29.9), "G4", "29.9 es G4");
      t.igual(api.estadioKDIGO(15), "G4", "15 es G4");
      t.igual(api.estadioKDIGO(14.9), "G5", "14.9 es G5");
    });

    t.caso("evaluarDiscordanciaTFG: dif 2 (sin alerta) y dif 3 (con alerta)", () => {
      // G1 = >90. G3a = 45-59.9
      const d1 = api.evaluarDiscordanciaTFG(95, 50); // diff 2
      t.igual(d1, null, "diferencia de 2 estadios no alerta");

      // G1 = >90. G3b = 30-44.9
      const d2 = api.evaluarDiscordanciaTFG(95, 35); // diff 3
      t.cierto(d2 !== null && d2.alerta === true, "diferencia de 3 estadios sí alerta");
      t.igual(d2.estadioCG, "G1", "el estadio CG debe ser G1");
      t.igual(d2.estadioCKD, "G3b", "el estadio CKD debe ser G3b");
      t.igual(d2.diferenciaEstadios, 3, "la diferencia debe ser 3");
    });

    t.caso("Integración: BuscarPacienteDetallado cache y checkFuncionRenal maneja datos faltantes", async () => {
      const { cargar } = require("./harness.js");
      let urlVistas = [];

      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          urlVistas.push(url);
          if (url.includes("BuscarPacienteDetallado")) {
            // Simulamos datos faltantes: fecha centinela, sin edad
            return { error: false, data: { fecha_Nacimiento: "0001-01-01T00:00:00", edad: null, edadAnos: 0, sexo: "F" } };
          }
          if (url.includes("ObtenerHistoricoSignosVitales")) {
            return []; // array vacio
          }
          return {};
        }
      });

      // Simulamos la caché vacía
      c.api._pacienteDetalladoCache = { pid: "123", edadAnos: null, sexo: "" };

      // Añadimos el DOM necesario para que `extractPacienteAbierto` no falle si es llamado
      const doc = c.env.doc;
      doc.body.innerHTML = `<div id="anamesis"></div><div class="text-muted">CC 12345</div>`;

      // Inyectamos a la caché los valores que vendrían de BuscarPacienteDetallado simulando la intercepción
      // Llamamos directo a checkFuncionRenal()
      await c.api.checkFuncionRenal();

      // Verificamos que se hicieron llamadas a ObtenerHistoricoSignosVitales si procedía,
      // pero como está ausente o mal, se manejó suavemente.
      t.cierto(urlVistas.filter(u => u.includes("ObtenerHistoricoSignosVitales")).length > 0, "debió intentar llamar a ObtenerHistoricoSignosVitales");
    });

  }
};
