module.exports = {
  nombre: "Llamadas a Everest y clínicas",
  cubre: ["apiOrdenamientoGuardar", "apiAccesoAsignarTurno", "_pageFetchJsonCore", "pageFetchJson", "extractPatientId", "apiAccesoBuscarPaciente", "apiOrdenamientoObtenerDx", "apiOrdenamientoObtenerCup", "apiOrdenamientoBuscarPaciente", "fetchAtheneaLabs"],
  pruebas(t, api, env, cargar) {
    function conRed(mockRes) {
      let reqUrl = "", reqOpts = {}, reqCount = 0;
      const mockFetch = async (url, opts) => {
        reqUrl = url; reqOpts = opts || {}; reqCount++;
        return { ok: true, status: 200, json: async () => typeof mockRes === "function" ? mockRes(url, opts) : mockRes };
      };
      const c = cargar({ fetch: mockFetch });
      c.env.doc.querySelector = () => ({ getAttribute: () => "mock-token" });
      return { c, get reqUrl() { return reqUrl; }, get reqOpts() { return reqOpts; }, get reqCount() { return reqCount; } };
    }

    t.casoAsync("apiOrdenamientoGuardar construye payload correctamente y llama al endpoint", async () => {
      const red = conRed({ id: "ok" });
      red.c.api.__state.activeDoctor = { id: 777, name: "TEST DOCTOR" };
      const res = await red.c.api.apiOrdenamientoGuardar("pac123", "dx456", [{ Id: "cup1", Descripcion: "desc1" }]);
      t.cierto(res !== null);
      t.cierto(red.reqUrl.includes("GuardarOrdenamiento"));
      const payload = JSON.parse(red.reqOpts.body);
      t.igual(payload.UsuarioId, 777);
      t.igual(payload.DiagnosticoId, "dx456");
      t.igual(payload.paciente.Id, "pac123");
      t.igual(payload.ordenes[0].cup.Id, "cup1");
    });

    t.casoAsync("apiAccesoAsignarTurno aborta si no hay ID de médico (v12.0.0)", async () => {
      const red = conRed({});
      red.c.api.__state.activeDoctor = { id: 0, name: "" };
      red.c.api.__S.medicoId = 0;
      const res = await red.c.api.apiAccesoAsignarTurno("turno", "pac123", "2026-08-10", "obs");
      t.cierto(res.error);
      t.cierto(res.mensaje.includes("NO se creó la cita"));
    });

    t.casoAsync("apiAccesoAsignarTurno evalúa swPyM y SwProgramaEspecial basandose en el nombre del medico", async () => {
      const red = conRed({});
      red.c.api.__state.activeDoctor = { id: 777, name: "BRANDON PALENCIA" };
      await red.c.api.apiAccesoAsignarTurno("turnoId", "pac123", "2026-08-10", "obs");
      t.cierto(red.reqUrl.includes("swIsPyM=true"));
      t.cierto(red.reqUrl.includes("SwProgramaEspecial=true"));
    });

    t.caso("extractPatientId extrae el ID interno de Everest desde cualquier respuesta de la API", () => {
      t.igual(api.extractPatientId(123), 123);
      t.igual(api.extractPatientId("456"), 456);
      t.igual(api.extractPatientId([{ idPaciente: 789 }]), 789);
      t.igual(api.extractPatientId({ data: { pacienteId: 1011 } }), 1011);
      const trampa = { eps: { id: 2 }, sedes: { Id: 12 }, data: { paciente_id: 555 } };
      t.igual(api.extractPatientId(trampa), 555);
    });

    t.casoAsync("apiAccesoBuscarPaciente busca la data usando documento y extrae ID", async () => {
      const red = conRed([{ pacienteId: 999 }]);
      const res = await red.c.api.apiAccesoBuscarPaciente("12345678"); // fixed signature!
      t.cierto(red.reqUrl.includes("12345678"));
      t.igual(res, 999);
    });

    t.casoAsync("apiOrdenamientoObtenerDx busca diagnóstico en la API y lo cachea", async () => {
      const red = conRed([{ Codigo: "I10X", Id: "dx999" }]);
      const dxId = await red.c.api.apiOrdenamientoObtenerDx("I10X");
      t.igual(dxId, "dx999");
      t.igual(red.reqCount, 1);
      const dxId2 = await red.c.api.apiOrdenamientoObtenerDx("I10X");
      t.igual(dxId2, "dx999");
      t.igual(red.reqCount, 1);
    });

    t.casoAsync("apiOrdenamientoObtenerCup busca un CUPS para un paciente en la API y lo cachea", async () => {
      const red = conRed([{ Codigo: "902207", Id: "cup999", Descripcion: "Prueba" }]);
      const cup = await red.c.api.apiOrdenamientoObtenerCup("pac1", "902207");
      t.igual(cup.Id, "cup999");
      t.igual(cup.Descripcion, "Prueba");
      t.igual(red.reqCount, 1);
      const cup2 = await red.c.api.apiOrdenamientoObtenerCup("pac1", "902207");
      t.igual(cup2.Id, "cup999");
      t.igual(red.reqCount, 1);
    });

    t.casoAsync("apiOrdenamientoBuscarPaciente busca paciente por doc y extrae Id", async () => {
      const red = conRed({ Id: 111 });
      const pacId = await red.c.api.apiOrdenamientoBuscarPaciente("CC 123456");
      t.igual(pacId, 111);
    });

    t.casoAsync("fetchAtheneaLabs intenta multiples anos si no se especifica", async () => {
      const c = cargar();
      let fetchCalls = [];
      c.env.win.GM_xmlhttpRequest = (opts) => {
        const payload = JSON.parse(opts.data);
        fetchCalls.push(payload.ano);
        opts.onload({ status: 200, responseText: JSON.stringify({ dataObject: [] }) });
      };
      try { await c.api.fetchAtheneaLabs(5555); } catch (e) { }
      t.igual(fetchCalls.length, 3);
      t.cierto(fetchCalls.includes(new Date().getFullYear()));
    });
  }
};
