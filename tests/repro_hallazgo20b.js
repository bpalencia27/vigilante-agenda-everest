// Reproducción v2 del hallazgo #20, contra el código REAL (vglCarpetaGuardarInstantanea).
// Secuencia exacta para que la poda golpee la clave de P en su TERCERA llamada,
// mientras la SEGUNDA sigue en vuelo:
//   1) 1er guardado de P (instantáneo)              -> clave P al FRENTE del Map
//   2) 199 pacientes distintos (instantáneo)         -> size=200, SIN podar todavía
//   3) 2do guardado de P arranca, LECTURA retenida   -> size=200, no poda (200 no es >200);
//                                                        set() sobre clave YA existente
//                                                        NO mueve su posición: P sigue al frente
//   4) 1 paciente distinto más (instantáneo)         -> size=201
//   5) 3er guardado de P arranca                     -> size=201>200: poda la MÁS VIEJA,
//                                                        que sigue siendo la de P (paso 3 no
//                                                        la movió) -> P.get() da undefined ->
//                                                        arranca SIN encadenar detrás del 2do
const { cargar } = require("./harness");

async function main() {
  const { api } = cargar({ silencioso: true });
  const disco = {};
  const orden = [];

  function fsInstant() {
    return {
      leer: async (n) => disco[n],
      escribir: async (n, txt) => { disco[n] = txt; return true; },
    };
  }

  let liberarLecturaP2 = null;
  const bloqueoLecturaP2 = new Promise((r) => { liberarLecturaP2 = r; });
  function fsLentoParaP2() {
    return {
      leer: async (n) => { orden.push("P2:leyendo"); await bloqueoLecturaP2; orden.push("P2:leyó"); return disco[n]; },
      escribir: async (n, txt) => { orden.push("P2:escribiendo"); disco[n] = txt; orden.push("P2:escribió"); return true; },
    };
  }
  function fsInstantParaP3() {
    return {
      leer: async (n) => { orden.push("P3:leyendo"); return disco[n]; },
      escribir: async (n, txt) => { orden.push("P3:escribiendo"); disco[n] = txt; orden.push("P3:escribió"); return true; },
    };
  }

  // 1) 1er guardado de P.
  const r1 = await api.vglCarpetaGuardarInstantanea("900000001", { fecha: "2026-08-01", laboratorios: { A: 1 } }, fsInstant());
  console.log("r1.ok =", r1.ok);

  // 2) 199 pacientes distintos.
  for (let i = 0; i < 199; i++) {
    await api.vglCarpetaGuardarInstantanea(String(20000000 + i), { fecha: "2026-08-01", laboratorios: { A: 1 } }, fsInstant());
  }
  console.log("sembrados 199 pacientes distintos además de P (size esperado = 200)");

  // 3) 2do guardado de P, con lectura retenida a mano.
  const p2 = api.vglCarpetaGuardarInstantanea("900000001", { fecha: "2026-08-02", laboratorios: { B: 1 } }, fsLentoParaP2());
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  console.log("orden tras arrancar el 2do guardado de P (debe estar colgado leyendo):", orden.join(" | "));

  // 4) Un paciente distinto MÁS, para cruzar el umbral de 200.
  await api.vglCarpetaGuardarInstantanea("30000000", { fecha: "2026-08-01", laboratorios: { A: 1 } }, fsInstant());
  console.log("sembrado 1 paciente distinto más (size esperado = 201, dispara la poda en la próxima llamada)");

  // 5) 3er guardado de P, MIENTRAS el 2do sigue colgado en su lectura.
  const p3 = api.vglCarpetaGuardarInstantanea("900000001", { fecha: "2026-08-03", laboratorios: { C: 1 } }, fsInstantParaP3());
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const p3EmpezoMientrasP2SeguiaColgado = orden.indexOf("P3:leyendo") >= 0 && orden.indexOf("P2:leyó") < 0;
  console.log("orden JUSTO ANTES de liberar la lectura del 2do:", orden.join(" | "));
  console.log("¿P3 ya arrancó ANTES de que P2 terminara de leer? ->", p3EmpezoMientrasP2SeguiaColgado);

  liberarLecturaP2();
  const [res2, res3] = await Promise.all([p2, p3]);
  console.log("orden FINAL de eventos:", orden.join(" | "));
  console.log("res2 =", JSON.stringify(res2));
  console.log("res3 =", JSON.stringify(res3));

  const historial = await api.vglCarpetaLeerHistorial("900000001", fsInstant());
  console.log("controles guardados para P al final:", historial.controles.length,
    JSON.stringify(historial.controles.map((c) => c.fecha)));

  if (p3EmpezoMientrasP2SeguiaColgado) {
    console.log("\n>>> RACE CONFIRMADA: la 3ra llamada arrancó su propia lectura ANTES de que la 2da (en vuelo) terminara.");
    console.log(">>> La cola NO serializó: la poda borró la clave de P a mitad de un guardado en curso.");
  } else {
    console.log("\n>>> No se reprodujo: la 3ra llamada esperó correctamente a la 2da.");
  }
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
