// =====================================================================
//  PRUEBA ROJA 001: Ausencia de Kill-Switch en apiEnviarOrdenPorCorreo
//
//  Consecuencia clínica: En una situación de emergencia donde se activa
//  la pausa de seguridad remota (Kill-Switch) para proteger la historia
//  clínica del paciente, el script sigue permitiendo el envío de órdenes
//  médicas al exterior por correo electrónico.
// =====================================================================
const { cargar } = require("../harness.js");

async function test() {
  let fetchLlamado = false;
  const mockFetch = async (url) => {
    fetchLlamado = true;
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => "" };
  };

  const c = cargar({ silencioso: true, fetch: mockFetch });

  // 1. Activar kill-switch de emergencia
  c.api.emergencyTeardown("Pausa de seguridad remota por incidente");

  if (c.api.__state.killed !== true) {
    throw new Error("Precondición fallida: state.killed no está activo");
  }

  // 2. Intentar enviar una orden por correo bajo kill-switch activo
  const resultado = await c.api.apiEnviarOrdenPorCorreo("1226083463", "paciente@ejemplo.com", 801848);

  // 3. ASERCIÓN ROJA: Con kill-switch activo, la función DEBE abortar de inmediato,
  // retornar false y NO realizar ninguna llamada de red al exterior.
  if (fetchLlamado) {
    console.error("FAIL: apiEnviarOrdenPorCorreo disparó petición HTTP con el Kill-Switch activo.");
    process.exit(1);
  }

  if (resultado !== false) {
    console.error("FAIL: apiEnviarOrdenPorCorreo no devolvió false bajo Kill-Switch activo.");
    process.exit(1);
  }

  console.log("PASS: apiEnviarOrdenPorCorreo respeta el Kill-Switch.");
  process.exit(0);
}

test().catch((e) => {
  console.error("ERROR EN PRUEBA ROJA:", e);
  process.exit(1);
});
