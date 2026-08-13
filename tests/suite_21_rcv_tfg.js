const { cargar } = require('./harness');

module.exports = {
  nombre: "RCV: Fórmulas de TFG y estadificación KDIGO",
  cubre: ["cockcroftGault", "ckdEpi2021", "estadioKDIGO", "evaluarDiscordanciaTFG", "checkTFGRCV"],
  pruebas: async (t) => {
    t.caso("cockcroftGault: paciente obesa (caso real referenciado 186.8 mL/min) y datos básicos", () => {
      const c = cargar();
      // Mujer 63 años, 113 kg, creatinina 0.55
      t.igual(c.api.cockcroftGault(63, 113, 0.55, "F"), 186.8);
      // Hombre
      t.igual(c.api.cockcroftGault(63, 113, 0.55, "M"), 219.7);
    });

    t.caso("ckdEpi2021: calcula correctamente para hombre y mujer y aplica factor edad", () => {
      const c = cargar();
      // Female, 63, 0.55 cr
      const fem = c.api.ckdEpi2021(63, 0.55, "F");
      // Male, 63, 0.55 cr
      const mal = c.api.ckdEpi2021(63, 0.55, "M");
      // Female, 30, 0.55 cr
      const femY = c.api.ckdEpi2021(30, 0.55, "F");

      t.cierto(fem > 0 && mal > 0 && femY > 0, "debe ser mayor a 0");
      t.cierto(fem !== mal, "el sexo afecta el cálculo");
      t.cierto(femY > fem, "0.9938^edad debería hacer que más joven = mayor TFG");
    });

    t.caso("estadioKDIGO: fronteras exactas probadas", () => {
      const c = cargar();
      t.igual(c.api.estadioKDIGO(90), "G1");
      t.igual(c.api.estadioKDIGO(89.9), "G2");
      t.igual(c.api.estadioKDIGO(60), "G2");
      t.igual(c.api.estadioKDIGO(59.9), "G3a");
      t.igual(c.api.estadioKDIGO(45), "G3a");
      t.igual(c.api.estadioKDIGO(44.9), "G3b");
      t.igual(c.api.estadioKDIGO(30), "G3b");
      t.igual(c.api.estadioKDIGO(29.9), "G4");
      t.igual(c.api.estadioKDIGO(15), "G4");
      t.igual(c.api.estadioKDIGO(14.9), "G5");
    });

    t.caso("evaluarDiscordanciaTFG: detecta saltos > 2 estadios", () => {
      const c = cargar();
      // diff 2 estadios
      const r1 = c.api.evaluarDiscordanciaTFG(90 /* G1 */, 45 /* G3a */);
      t.igual(r1, null, "G1 a G3a son 2 estadios (3 - 1 = 2) -> no alerta");

      // diff 3 estadios
      const r2 = c.api.evaluarDiscordanciaTFG(90 /* G1 */, 44.9 /* G3b */);
      t.cierto(r2 !== null, "G1 a G3b son 3 estadios (4 - 1 = 3) -> SÍ alerta");
      t.cierto(r2.alerta);
      t.igual(r2.diferenciaEstadios, 3);
      t.cierto(r2.mensaje.includes("G1") && r2.mensaje.includes("G3b"));
    });

    t.caso("Falta de datos en formulas: devuelve 0", () => {
      const c = cargar();
      t.igual(c.api.cockcroftGault(0, 70, 1.1, "M"), 0);
      t.igual(c.api.ckdEpi2021(0, 1.1, "M"), 0);
    });
  }
};

// To satisfy the missing test requirement about 0001-01-01 and empty sign array, we mock it.
// The tests for `checkTFGRCV` missing data require complex mocks, so we add a case here
module.exports.pruebasAsync = async (t) => {
  await t.casoAsync("checkTFGRCV: omite cálculo si falta algún dato o es 0001-01-01 (fecha centinela) / signos vacío", async () => {
    const DOC_ID = "123456";
    let requestEdadSexo = false;

    const gmxhr = (o) => {
      const url = String(o.url || "");
      if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: "<form><input name='__RequestVerificationToken' value='TOK-1' /></form>" });
      else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: "<input type='hidden' name='IdPaciente' value='999' /><input name='__RequestVerificationToken' value='TOK-2' />" });
      else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: "CC: " + DOC_ID + " <form id='5552026' data-modulo='LAB' action='/Resultados/Reporte'></form>" });
      else if (url.includes("consultaDetalleSolicitud")) o.onload({
        status: 200,
        responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "903895", NombreParametro: "CREATININA", Resultado: "1.1", Fecha: "2026-08-10" }]) })
      });
      else if (url.includes("BuscarPacienteDetallado")) {
        requestEdadSexo = true;
        o.onload({
          status: 200,
          responseText: JSON.stringify({ data: { fecha_Nacimiento: "0001-01-01T00:00:00", edadAnos: 0, edad: null, sexo: "M" } })
        });
      } else if (url.includes("ObtenerHistoricoSignosVitales")) {
        o.onload({ status: 200, responseText: JSON.stringify([]) });
      } else {
        o.onload({ status: 200, responseText: "" });
      }
    };

    const { cargar } = require('./harness');
    const c = cargar({ silencioso: true, gmxhr });
    c.env.doc.getElementById = (id) => (id === "anamesis" ? { textContent: "HC " + DOC_ID } : null);
    c.env.doc.querySelector = () => null;
    c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "C.C. " + DOC_ID }] : []);

    await c.api.autoFetchAtheneaLabsForActivePatient();

    const oldLog = c.env.win.console.log;
    let logs = [];
    c.env.win.console.log = (m) => logs.push(m);

    await c.api.checkTFGRCV();

    t.cierto(logs.some(l => typeof l === "string" && l.includes("sin dato válido de edad")), "Abortado por edad inválida/centinela");
  });


  await t.casoAsync("checkTFGRCV: omite cálculo si ObtenerHistoricoSignosVitales trae array vacío", async () => {
    const DOC_ID = "123456";
    let requestSignos = false;

    const gmxhr = (o) => {
      const url = String(o.url || "");
      if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: "<form><input name='__RequestVerificationToken' value='TOK-1' /></form>" });
      else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: "<input type='hidden' name='IdPaciente' value='999' /><input name='__RequestVerificationToken' value='TOK-2' />" });
      else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: "CC: " + DOC_ID + " <form id='5552026' data-modulo='LAB' action='/Resultados/Reporte'></form>" });
      else if (url.includes("consultaDetalleSolicitud")) o.onload({
        status: 200,
        responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "903895", NombreParametro: "CREATININA", Resultado: "1.1", Fecha: "2026-08-10" }]) })
      });
      else if (url.includes("BuscarPacienteDetallado")) {
        o.onload({
          status: 200,
          responseText: JSON.stringify({ data: { edadAnos: 60, sexo: "M" } })
        });
      } else if (url.includes("ObtenerHistoricoSignosVitales")) {
        requestSignos = true;
        o.onload({ status: 200, responseText: JSON.stringify([]) });
      } else {
        o.onload({ status: 200, responseText: "" });
      }
    };

    const { cargar } = require('./harness');
    const c = cargar({ silencioso: true, gmxhr });
    c.env.doc.getElementById = (id) => (id === "anamesis" ? { textContent: "HC " + DOC_ID } : null);
    c.env.doc.querySelector = () => null;
    c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "C.C. " + DOC_ID }] : []);

    await c.api.autoFetchAtheneaLabsForActivePatient();

    const oldLog = c.env.win.console.log;
    let logs = [];
    c.env.win.console.log = (m) => logs.push(m);

    await c.api.checkTFGRCV();

    t.cierto(requestSignos, "Llamó a signos vitales");
    t.cierto(logs.some(l => typeof l === "string" && l.includes("sin registro de signos vitales")), "Abortado por array vacío");
  });
};
