// =====================================================================
//  PRUEBA ROJA 002: Ausencia de Kill-Switch en apiLaboratorioAgendarAuto y SMS
//
//  Consecuencia clínica: En una situación de emergencia donde se activa
//  la pausa de seguridad remota (Kill-Switch) para proteger la historia
//  clínica, el script sigue permitiendo crear citas de toma de muestras
//  en AppCita y enviar SMS de confirmación al paciente.
// =====================================================================
const { cargar } = require("../harness.js");

async function test() {
  let gmxhrLlamado = false;
  let urlLlamada = "";

  const mockGmxhr = (opts) => {
    gmxhrLlamado = true;
    urlLlamada = opts.url || "";
    if (opts.onload) {
      opts.onload({
        status: 200,
        responseText: JSON.stringify({ error: false, data: [{ hora: "07:00", id: 100, AgendaId: 100 }] })
      });
    }
  };

  const c = cargar({ silencioso: true, gmxhr: mockGmxhr });

  // 1. Activar kill-switch de emergencia
  c.api.emergencyTeardown("Pausa de seguridad remota activa");

  if (c.api.__state.killed !== true) {
    throw new Error("Precondición fallida: state.killed no está activo");
  }

  // 2. Intentar agendar cita de laboratorio bajo kill-switch activo
  const resultado = await c.api.apiLaboratorioAgendarAuto("12345678", "2026-09-01", "07:00", "3001234567");

  // 3. ASERCIÓN ROJA: Con kill-switch activo, la función DEBE abortar de inmediato,
  // retornar false y NO realizar llamadas de agendamiento ni de SMS a AppCita.
  if (gmxhrLlamado) {
    console.error("FAIL: apiLaboratorioAgendarAuto disparó petición (" + urlLlamada + ") con el Kill-Switch activo.");
    process.exit(1);
  }

  if (resultado !== false) {
    console.error("FAIL: apiLaboratorioAgendarAuto no devolvió false bajo Kill-Switch activo.");
    process.exit(1);
  }

  console.log("PASS: apiLaboratorioAgendarAuto respeta el Kill-Switch.");
  process.exit(0);
}

test().catch((e) => {
  console.error("ERROR EN PRUEBA ROJA:", e);
  process.exit(1);
});
