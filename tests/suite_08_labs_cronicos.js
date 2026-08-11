module.exports = {
  nombre: "Laboratorios Crónicos (Suite 08)",
  cubre: [
    "_matchLabInWhitelist", "_findLabField",
    "injectLabsIntoCronicos", "setNgValue"
  ],

  async pruebas(t, api, env, cargar) {
    const c = cargar();
    let mockDOM = {};
    let eventsDispatched = [];

    c.ctx.Event = class Event {
      constructor(type, init) {
        this.type = type;
        this.bubbles = init?.bubbles || false;
      }
    };

    c.env.doc.getElementById = (id) => {
      if (!mockDOM[id]) return null;
      return {
        id: id,
        tagName: "INPUT",
        dispatchEvent: (evt) => {
          eventsDispatched.push({ id, type: evt.type });
        },
        _val: mockDOM[id].value || "",
        set value(v) { this._val = v; mockDOM[id].value = v; },
        get value() { return this._val; }
      };
    };

    const testApi = c.api;

    t.caso("_matchLabInWhitelist: El código manda sobre el nombre (Incidente v11.0.1)", () => {
      const labHbA1c = { CodigoParametro: "903843", nombre: "GLUCOSA EN SUERO (TRUCO)" };
      const matched = testApi._matchLabInWhitelist(labHbA1c);
      t.cierto(!!matched, "Debería haber hecho match por código");
      t.igual(matched.key, "HBA1C");
    });

    t.caso("_matchLabInWhitelist: Exclusiones de Creatinina se respetan (CREATININA EN ORINA != suero)", () => {
      const orina = testApi._matchLabInWhitelist({ nombre: "CREATININA EN ORINA" });
      const creatinuria = testApi._matchLabInWhitelist({ nombre: "CREATINURIA" });
      const depuracion = testApi._matchLabInWhitelist({ nombre: "DEPURACION DE CREATININA 24 H" });
      t.igual(orina, null);
      t.igual(creatinuria, null);
      t.igual(depuracion, null);
      const creatininaSuero = testApi._matchLabInWhitelist({ nombre: "CREATININA" });
      t.cierto(!!creatininaSuero && creatininaSuero.key === "CREATININA");
    });

    t.caso("_matchLabInWhitelist: Triglicéridos CUPS 903868 no se confunde con RAC (Incidente v12.0.5)", () => {
      const trigli = testApi._matchLabInWhitelist({ codigo: "903868", nombre: "TRIGLICERIDOS" });
      t.cierto(!!trigli);
      t.igual(trigli.key, "TRIGLICERIDOS");
    });

    t.caso("_matchLabInWhitelist: Analito desconocido devuelve null", () => {
      const res = testApi._matchLabInWhitelist({ CodigoParametro: "999999", nombre: "LABORATORIO INVENTADO" });
      t.igual(res, null);
    });

    t.caso("_findLabField: encuentra el campo principal o los alternativos", () => {
      mockDOM = { "campoPrincipal": { value: "" } };
      t.igual(testApi._findLabField("campoPrincipal", ["alt1"]).id, "campoPrincipal");
      mockDOM = { "alt2": { value: "" } };
      t.igual(testApi._findLabField("campoPrincipal", ["alt1", "alt2"]).id, "alt2");
      mockDOM = {};
      t.igual(testApi._findLabField("campoPrincipal", []), null);
    });

    t.caso("setNgValue: escribe el valor y despacha eventos 'input' y 'change'", () => {
      let dispatched = [];
      const fakeInput = {
        value: "",
        dispatchEvent: (e) => dispatched.push(e.type)
      };
      testApi.setNgValue(fakeInput, "42.5");
      t.igual(fakeInput.value, "42.5");
      t.cierto(dispatched.includes("input"));
      t.cierto(dispatched.includes("change"));
    });

    t.caso("injectLabsIntoCronicos: PENDIENTE se cuenta como pendiente y no se escribe (Incidente v11.0.1)", () => {
      mockDOM = { "resultadoColesterolTotal": { value: "" } };
      const labs = [{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "PENDIENTE", idEstado: 1 }];
      const res = testApi.injectLabsIntoCronicos(labs);
      t.igual(res.pendientes, 1);
      t.igual(mockDOM["resultadoColesterolTotal"].value, "");
    });

    t.caso("injectLabsIntoCronicos: Primer valor gana en colisión", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "" },
        "fechaResultGlicemia": { value: "" }
      };
      const labs = [
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", Fecha: "2023-01-01" },
        { codigo: "903841", nombre: "GLUCOSA (Duplicado)", Resultado: "9.9", Fecha: "2023-01-02" }
      ];
      const res = testApi.injectLabsIntoCronicos(labs);
      t.igual(res.count, 1, "Solo debe inyectar uno");
      t.igual(mockDOM["resultadoGlicemia"].value, "7.1", "El primer valor debe prevalecer");
      t.igual(mockDOM["fechaResultGlicemia"].value, "2023-01-01", "Debe usar la fecha del primer resultado");
    });

    t.caso("injectLabsIntoCronicos: Sin fecha real, la casilla de fecha queda vacía", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "" },
        "fechaResultGlicemia": { value: "" }
      };
      const labs = [{ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1" }];
      testApi.injectLabsIntoCronicos(labs);
      t.igual(mockDOM["fechaResultGlicemia"].value, "", "No debe inventar la fecha de hoy");
    });

    t.caso("injectLabsIntoCronicos: sinCasilla acumula analitos válidos sin destino en el DOM", () => {
      mockDOM = {};
      const labs = [{ codigo: "903843", nombre: "HEMOGLOBINA GLICOSILADA", Resultado: "7.1", Fecha: "2023-01-01" }];
      const res = testApi.injectLabsIntoCronicos(labs);
      t.igual(res.count, 0);
      t.igual(res.sinCasilla.length, 1);
      t.cierto(res.sinCasilla[0].includes("HEMOGLOBINA GLICOSILADA") || res.sinCasilla[0].includes("HBA1C"));
    });

    t.caso("_matchLabInWhitelist: RAC casa por resultId 'resultadoRelacionAlbuminaCreatinina', y no debe confundirse con la otra casilla", () => {
      // Simular un RAC para asegurarnos de que la key de destino tiene el target principal que es resultadoRelacionAlbuminaCreatinina
      const rac = testApi._matchLabInWhitelist({ codigo: "8779", nombre: "RELACION MICROALBUMINURIA CREATININA" });
      t.cierto(!!rac);
      t.igual(rac.key, "RAC");
      t.igual(rac.resultId, "resultadoRelacionAlbuminaCreatinina", "Debe dirigirse a la casilla correcta");
      t.falso(rac.resultId === "resultadoMicroAlbuminuriaCreatinuria", "NO debe dirigirse a la casilla resultadoMicroAlbuminuriaCreatinuria");
    });
  }
};
