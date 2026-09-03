// Medición para la auditoría UI/UX (02-sep-2026): ¿cuántas peticiones de agenda salen al
// ABRIR Agendar? (fricción UX #16: cargarHoras vía renderDayChips y otra vez en _rumTramo("agm.abrir")).
// Solo lectura del repositorio; datos sintéticos.
const path = require("path");
const fs = require("fs");
const REPO = "/home/user/vigilante-agenda-everest";
const { cargar } = require(path.join(REPO, "tests", "harness.js"));
const srcSuite = fs.readFileSync(path.join(REPO, "tests", "suite_15_interfaz_avanzada.js"), "utf8");
// enriquecerDom es local de suite_15: se extrae tal cual (misma función que usan las pruebas).
const ini = srcSuite.indexOf("function enriquecerDom(c) {");
const fin = srcSuite.indexOf("function disparar(nodo, tipo, evento) {");
const trozo = srcSuite.slice(ini, fin);
const enriquecerDom = eval("(" + trozo.slice(0, trozo.lastIndexOf("\n}") + 2).trim() + ")");
function respuestaJson(data) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => data, text: async () => JSON.stringify(data), clone() { return this; } };
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const iso2fmt = (iso) => iso.split("-").reverse().join("/");

(async () => {
  const urls = [];
  const c = cargar({
    silencioso: true,
    fetch: async (url) => {
      const u = String(url);
      urls.push({ t: Date.now(), u });
      if (u.includes("BuscarPacienteDetallado")) return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [] } });
      if (u.includes("BuscarPaciente")) return respuestaJson({ data: { id: 777 } });
      if (u.includes("BuscarCitasDisponibles")) {
        const iso = /FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(u)[1];
        return respuestaJson({ agendas: [{ agendaId: 61, medico: "ANA MARIA PEREZ", fechaAgenda: iso2fmt(iso), sede: "CMB" }] });
      }
      if (u.includes("AgdValidarAgenda")) return respuestaJson({ data: { isError: false } });
      if (u.includes("ObtenerTurnos")) return respuestaJson({ turnos: [{ id: 701, horaTexto: "07:00 AM", estado: "ACT" }] });
      return respuestaJson({});
    },
    gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
  });
  enriquecerDom(c);
  c.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
  const t0 = Date.now();
  c.api.openAgendamientoModal({ doc_id: "555111", nombre: "PACIENTE SINTETICO" });
  await esperar(400);
  const clas = (re) => urls.filter((x) => re.test(x.u));
  const citas = clas(/BuscarCitasDisponibles/);
  const porFecha = {};
  citas.forEach((x) => { const f = (/FechaDeseada=(\d{4}-\d{2}-\d{2})/.exec(x.u) || [])[1]; porFecha[f] = (porFecha[f] || 0) + 1; });
  const dup = Object.entries(porFecha).filter(([, n]) => n > 1);
  console.log(JSON.stringify({
    total_fetch: urls.length,
    BuscarPaciente_sinDetallado: clas(/BuscarPaciente(?!Detallado)/).length,
    BuscarPacienteDetallado: clas(/BuscarPacienteDetallado/).length,
    BuscarCitasDisponibles: citas.length,
    fechas_pedidas_mas_de_una_vez: dup,
    ObtenerTurnos: clas(/ObtenerTurnos(?!PorFecha)/).length,
    primeras_ms: urls.slice(0, 12).map((x) => (x.t - t0) + "ms " + x.u.replace(/^https?:\/\/[^/]+/, "").slice(0, 90)),
  }, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERROR", e); process.exit(1); });
