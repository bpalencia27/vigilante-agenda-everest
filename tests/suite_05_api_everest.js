module.exports = {
  nombre: "Llamadas a Everest y clínicas",
  cubre: ["apiOrdenamientoGuardar", "apiAccesoAsignarTurno", "_pageFetchJsonCore", "pageFetchJson", "extractPatientId", "apiAccesoBuscarPaciente", "apiOrdenamientoObtenerDx", "apiOrdenamientoObtenerCup", "apiOrdenamientoBuscarPaciente", "fetchAtheneaLabs"],
  pruebas(t, api, env, cargar) {
    t.casoAsync("apiOrdenamientoGuardar construye payload correctamente y llama al endpoint", async () => {
      const c = cargar();
      c.api.__state.activeDoctor = { id: 777, name: "TEST DOCTOR" };

      let fetchUrl, fetchOpts;
      // intercept _pageFetchJsonCore instead of pageFetchJson (which just wraps it)
      // Actually pageFetchJson wraps pageFetchJsonCore, let's inject a mock function on win
      c.env.win.fetch = async (url, opts) => {
        fetchUrl = url;
        fetchOpts = opts;
        return { ok: true, status: 200, json: async () => ({ id: "ok" }) };
      };
      // We also need to mock document since _pageFetchJsonCore accesses bearer tokens from DOM
      c.env.doc.querySelector = () => ({ getAttribute: () => "mock-token" });

      const res = await c.api.apiOrdenamientoGuardar("pac123", "dx456", [{ Id: "cup1", Descripcion: "desc1" }]);
      t.cierto(res !== null);
      t.cierto(fetchUrl.includes("/GuardarOrdenamiento"));

      const payload = JSON.parse(fetchOpts.body);
      t.igual(payload.UsuarioId, 777);
      t.igual(payload.DiagnosticoId, "dx456");
      t.igual(payload.paciente.Id, "pac123");
      t.igual(payload.ordenes[0].cup.Id, "cup1");
    });

    t.casoAsync("apiAccesoAsignarTurno aborta si no hay ID de médico (v12.0.0)", async () => {
      const c = cargar();
      c.api.__state.activeDoctor = { id: 0, name: "" };
      c.api.__S.medicoId = 0;

      const res = await c.api.apiAccesoAsignarTurno("turno", "pac123", "2026-08-10", "obs");
      t.cierto(res.error);
      t.cierto(res.mensaje.includes("NO se creó la cita"));
    });

    t.casoAsync("apiAccesoAsignarTurno evalúa swPyM y SwProgramaEspecial basandose en el nombre del medico", async () => {
      const c = cargar();
      c.api.__state.activeDoctor = { id: 777, name: "BRANDON PALENCIA" }; // RCV doctor!

      let fetchUrl;
      c.env.win.fetch = async (url, opts) => {
        fetchUrl = url;
        return { ok: true, status: 200, json: async () => ({ id: "ok" }) };
      };
      c.env.doc.querySelector = () => ({ getAttribute: () => "mock-token" });

      await c.api.apiAccesoAsignarTurno("turnoId", "pac123", "2026-08-10", "obs");
      t.cierto(fetchUrl.includes("swIsPyM=true"));
      t.cierto(fetchUrl.includes("SwProgramaEspecial=true"));
    });

    t.caso("extractPatientId extrae el ID interno de Everest desde cualquier respuesta de la API", () => {
      const c = cargar();
      t.igual(c.api.extractPatientId(123), 123);
      t.igual(c.api.extractPatientId("456"), 456);
      t.igual(c.api.extractPatientId([{ idPaciente: 789 }]), 789);
      t.igual(c.api.extractPatientId({ data: { pacienteId: 1011 } }), 1011);

      // Debe ignorar keys en la lista negra
      const trampa = {
        eps: { id: 2 },
        sedes: { Id: 12 },
        data: { paciente_id: 555 }
      };
      t.igual(c.api.extractPatientId(trampa), 555);
    });

    t.casoAsync("apiAccesoBuscarPaciente busca la data usando documento y extrae ID", async () => {
      const c = cargar();
      let fetchUrl;
      c.env.win.fetch = async (url, opts) => {
        fetchUrl = url;
        return { ok: true, status: 200, json: async () => ([{ pacienteId: 999 }]) };
      };
      c.env.doc.querySelector = () => ({ getAttribute: () => "mock-token" });

      const res = await c.api.apiAccesoBuscarPaciente("CC", "12345678");
      t.cierto(fetchUrl.includes("NumeroIdentificacion=12345678"));
      t.igual(res, 999);
    });
    t.casoAsync("apiOrdenamientoObtenerDx busca diagnóstico en la API y lo cachea", async () => {
      const c = cargar();
      let fetchCount = 0;
      c.env.win.fetch = async (url) => {
        fetchCount++;
        return { ok: true, status: 200, json: async () => ([{ Codigo: "I10X", Id: "dx999" }]) };
      };
      c.env.doc.querySelector = () => ({ getAttribute: () => "mock-token" });

      const dxId = await c.api.apiOrdenamientoObtenerDx("I10X");
      t.igual(dxId, "dx999");
      t.igual(fetchCount, 1);

      // Siguiente llamada debería usar la caché
      const dxId2 = await c.api.apiOrdenamientoObtenerDx("I10X");
      t.igual(dxId2, "dx999");
      t.igual(fetchCount, 1, "No debería llamar a fetch de nuevo");
    });
    t.casoAsync("apiOrdenamientoObtenerCup busca un CUPS para un paciente en la API y lo cachea", async () => {
      const c = cargar();
      let fetchCount = 0;
      c.env.win.fetch = async (url) => {
        fetchCount++;
        return { ok: true, status: 200, json: async () => ([{ Codigo: "902207", Id: "cup999", Descripcion: "Prueba" }]) };
      };
      c.env.doc.querySelector = () => ({ getAttribute: () => "mock-token" });

      const cup = await c.api.apiOrdenamientoObtenerCup("pac1", "902207");
      t.igual(cup.Id, "cup999");
      t.igual(cup.Descripcion, "Prueba");
      t.igual(fetchCount, 1);

      // Cache
      const cup2 = await c.api.apiOrdenamientoObtenerCup("pac1", "902207");
      t.igual(cup2.Id, "cup999");
      t.igual(fetchCount, 1);
    });
    t.casoAsync("apiOrdenamientoBuscarPaciente busca paciente por doc y extrae Id", async () => {
      const c = cargar();
      c.env.win.fetch = async (url) => {
        return { ok: true, status: 200, json: async () => ({ Id: 111 }) };
      };
      c.env.doc.querySelector = () => ({ getAttribute: () => "mock-token" });

      const pacId = await c.api.apiOrdenamientoBuscarPaciente("CC 123456");
      t.igual(pacId, 111);
    });
    // v12.3.3 — getAtheneaIdSolicitudAuto (bridge a localhost:5050) fue REEMPLAZADA por el
    // puente real getAtheneaSolicitudesAuto/getAtheneaLabsAuto (ver suite_18_athenea_sesion.js):
    // ese servidor nunca existió en el repo, era código muerto en todos los equipos.

    t.casoAsync("fetchAtheneaLabs intenta multiples anos si no se especifica", async () => {
      const c = cargar();
      let fetchCalls = [];
      c.env.win.GM_xmlhttpRequest = (opts) => {
        const payload = JSON.parse(opts.data);
        fetchCalls.push(payload.ano);
        opts.onload({ status: 200, responseText: JSON.stringify({ dataObject: [] }) }); // empty triggers retry
      };

      try {
        await c.api.fetchAtheneaLabs(5555);
      } catch (e) {
        // expected to reject if no data after trying all years
      }

      t.igual(fetchCalls.length, 3);
      t.cierto(fetchCalls.includes(new Date().getFullYear()));
    });
  }
};
