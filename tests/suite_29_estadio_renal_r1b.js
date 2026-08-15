// =====================================================================
//  SUITE 29 — Estadio renal R1b: la plomería que faltaba
//
//  R1a (suite 27) probó las cuatro fórmulas puras. Esto prueba lo que las
//  conecta con el paciente real:
//    · apiHcObtenerSignosVitales — el endpoint del PESO, la única entrada
//      que no existía en el script y sin la cual Cockcroft-Gault no corre.
//    · _pesoDeSignosVitales      — leer el registro MÁS RECIENTE, sin rellenar.
//    · _labNumerico              — los LIS mandan "> 5,0"; Number() da NaN.
//    · estadioRenalDelPaciente   — el orquestador y sus guardas clínicas.
//
//  DECISIÓN DEL MÉDICO (14-ago-2026): la fórmula que gobierna el estadio es
//  COCKCROFT-GAULT, no CKD-EPI. CKD-EPI se calcula solo para contrastar.
//  Estas pruebas anclan esa decisión: si alguien cambia cuál manda, caen.
//
//  El invariante que más importa aquí: NUNCA un estadio a medias. Si falta
//  una entrada, el resultado dice cuál falta y `estadio` es null. De este
//  estadio cuelga qué exámenes se le piden a un paciente real.
// =====================================================================
module.exports = {
  nombre: "Estadio renal (R1b, plomería)",
  cubre: ["_labNumerico", "_pesoDeSignosVitales", "apiHcObtenerSignosVitales",
          "_creatininaDeLabs", "apiAccesoObtenerDemograficos",
          "calcularEstadioRenal", "_renderEstadioRenalHtml"],

  async pruebas(t, api, env, cargar) {
    const respuestaJson = (obj) => async () => ({ ok: true, status: 200, json: async () => obj });

    // ---------- apiAccesoObtenerDemograficos ----------
    await t.casoAsync("apiAccesoObtenerDemograficos: extrae edad y sexo si la peticion tiene éxito", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => respuestaJson({ data: { edad: 63, sexo: "F" } })(),
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      const res = await c.api.apiAccesoObtenerDemograficos(111);
      t.igual(res.edad, 63);
      t.igual(res.sexo, "F");
    });

    await t.casoAsync("apiAccesoObtenerDemograficos: cachea por paciente", async () => {
      let peticiones = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { peticiones++; return respuestaJson({ data: { edad: 60, sexo: "M" } })(); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });

      await c.api.apiAccesoObtenerDemograficos(111);
      await c.api.apiAccesoObtenerDemograficos(111);
      t.igual(peticiones, 1, "usa la caché en la segunda llamada");

      await c.api.apiAccesoObtenerDemograficos(222);
      t.igual(peticiones, 2, "paciente distinto dispara nueva petición");
    });

    await t.casoAsync("apiAccesoObtenerDemograficos: devuelve null si no hay pacienteId", async () => {
      const c = cargar({ silencioso: true });
      t.igual(await c.api.apiAccesoObtenerDemograficos(null), null);
      t.igual(await c.api.apiAccesoObtenerDemograficos(""), null);
    });

    await t.casoAsync("apiAccesoObtenerDemograficos: maneja respuesta inesperada o error devolviendo null", async () => {
      const c1 = cargar({
        silencioso: true,
        fetch: async () => respuestaJson({ data: null })(), // malformado
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      t.igual(await c1.api.apiAccesoObtenerDemograficos(111), null);

      const c2 = cargar({
        silencioso: true,
        fetch: async () => { throw new Error("Fallo de red"); }, // lanza error
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      t.igual(await c2.api.apiAccesoObtenerDemograficos(111), null);
    });

    // ---------- calcularEstadioRenal ----------
    await t.casoAsync("calcularEstadioRenal: orquesta extracciones y llamada a estadioRenalDelPaciente", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          if (String(url).includes("BuscarPacienteDetallado")) {
            return respuestaJson({ data: { edad: 65, sexo: "M" } })();
          }
          if (String(url).includes("ObtenerHistoricoSignosVitales")) {
            return respuestaJson([{ peso: 70.5, fechaRegistro: "2026-08-16T10:00:00.000Z" }])();
          }
          return respuestaJson({})();
        },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      const labs = [{ codigo: "903825", nombre: "CREATININA", Resultado: "1.2", fechaTomaMuestra: "2026-08-15" }];
      const res = await c.api.calcularEstadioRenal(111, labs);
      t.igual(res.entradas.edad, 65);
      t.igual(res.entradas.peso, 70.5);
      t.igual(res.entradas.creatinina, 1.2);
      t.igual(res.entradas.fechaCreatinina, "2026-08-15");
      t.cierto(res.tfg > 0);
      t.cierto(res.estadio != null);
    });

    await t.casoAsync("calcularEstadioRenal: devuelve faltantes si hay errores en la red", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => { throw new Error("Fallo de red"); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      const res = await c.api.calcularEstadioRenal(111, []);
      t.igual(res.estadio, null);
      t.cierto(res.faltan.includes("edad"));
      t.cierto(res.faltan.includes("peso"));
      t.cierto(res.faltan.includes("creatinina"));
    });

    // ---------- _renderEstadioRenalHtml ----------
    t.caso("_renderEstadioRenalHtml: devuelve html vacío si el argumento es nulo", () => {
      t.igual(api._renderEstadioRenalHtml(null), "");
    });

    t.caso("_renderEstadioRenalHtml: muestra mensaje de error si creatinina está fuera de rango", () => {
      const result = api._renderEstadioRenalHtml({ faltan: ["creatinina_fuera_de_rango"], entradas: { creatininaCruda: "88" } });
      t.cierto(result.includes("fuera del rango posible"));
      t.cierto(result.includes("88"));
    });

    t.caso("_renderEstadioRenalHtml: muestra mensaje de error indicando qué falta", () => {
      const result = api._renderEstadioRenalHtml({ faltan: ["edad", "peso"] });
      t.cierto(result.includes("falta la edad y el peso"));
      t.cierto(result.includes("El peso se toma de los signos vitales"));
    });

    t.caso("_renderEstadioRenalHtml: renderiza el estadio correctamente y fechas formateadas", () => {
      const result = api._renderEstadioRenalHtml({
        estadio: "G3a",
        tfg: "55.5",
        entradas: {
          peso: 70,
          edad: 65,
          creatinina: 1.2,
          fechaCreatinina: "2026-08-15T00:00:00Z",
          fechaPeso: "2026-08-16T10:00:00Z"
        }
      });
      t.cierto(result.includes("G3a"));
      t.cierto(result.includes("55.5 mL/min"));
      t.cierto(result.includes("(15/08/2026)")); // fechaCreatinina formateada
      t.cierto(result.includes("(16/08/2026)")); // fechaPeso formateada
    });

    // ---------- _creatininaDeLabs ----------
    t.caso("_creatininaDeLabs: extrae el valor y fecha correcta si hay CREATININA en el arreglo", () => {
      const labs = [
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "100", fechaTomaMuestra: "2026-08-01" },
        // Use the proper names and codes that _ultimaFechaPorAnalito recognizes for CREATININA
        { codigo: "903825", nombre: "CREATININA", Resultado: "1.2", fechaTomaMuestra: "2026-08-15" }
      ];
      const res = api._creatininaDeLabs(labs);
      t.igual(res.crudo, "1.2");
      t.igual(res.fechaIso, "2026-08-15");
    });

    t.caso("_creatininaDeLabs: devuelve null si no encuentra CREATININA", () => {
      const labs = [
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "100", fechaTomaMuestra: "2026-08-01" }
      ];
      t.igual(api._creatininaDeLabs(labs), null);
    });

    t.caso("_creatininaDeLabs: devuelve null si el input es basura o lanza error interno", () => {
      t.igual(api._creatininaDeLabs(null), null);
      t.igual(api._creatininaDeLabs("no-es-un-array"), null);
    });

    // ---------- _labNumerico ----------
    t.caso("_labNumerico: acepta número simple, coma decimal y desigualdades de los LIS", () => {
      t.igual(api._labNumerico("1.1"), 1.1);
      t.igual(api._labNumerico("1,1"), 1.1, "coma decimal (formato local) se normaliza a punto");
      t.igual(api._labNumerico("> 5.0"), 5, "el LIS reporta fuera de rango con desigualdad; Number('> 5.0') sería NaN");
      t.igual(api._labNumerico(">= 300"), 300);
      t.igual(api._labNumerico("  0.55 mg/dL "), 0.55, "unidades pegadas al valor no lo invalidan");
      t.igual(api._labNumerico(2.3), 2.3, "también acepta un número ya tipado");
    });

    t.caso("_labNumerico: devuelve null —nunca 0— cuando no hay número real", () => {
      // Un 0 aquí sería catastrófico: en una creatinina, `estadioKDIGO(0)` devuelve G5,
      // el estadio MÁS GRAVE. "No hay dato" jamás puede degradarse a "dato malo".
      t.igual(api._labNumerico(""), null);
      t.igual(api._labNumerico(null), null);
      t.igual(api._labNumerico(undefined), null);
      t.igual(api._labNumerico("PENDIENTE"), null, "texto sin dígitos");
      t.igual(api._labNumerico("no reactivo"), null);
      t.igual(api._labNumerico("0"), null, "un cero explícito tampoco es una creatinina válida");
      // Bug real encontrado por esta misma prueba: el saneo quita todo lo que no sea
      // dígito/coma/punto, así que "-1.2" salía convertido en 1.2 — basura disfrazada de
      // valor plausible. Ningún analito de la lista puede ser negativo: se rechaza.
      t.igual(api._labNumerico("-1.2"), null, "un negativo NO puede colarse como positivo válido");
      t.igual(api._labNumerico("- 0,8"), null, "tampoco con espacio y coma decimal");
    });

    // ---------- _pesoDeSignosVitales ----------
    t.caso("_pesoDeSignosVitales: toma el registro MÁS RECIENTE (primero del array), con su fecha", () => {
      const arr = [
        { fechaRegistro: "2026-08-12T18:56:06.535-05:00", peso: 65.0, talla: 152.0, imc: 28.13 },
        { fechaRegistro: "2024-01-05T10:00:00.000-05:00", peso: 88.0, talla: 152.0 },
      ];
      const r = api._pesoDeSignosVitales(arr);
      t.igual(r.peso, 65.0, "gana el primero (más reciente), no el más pesado ni el más viejo");
      t.igual(r.fechaRegistro, "2026-08-12T18:56:06.535-05:00");
    });

    t.caso("_pesoDeSignosVitales: si el registro más nuevo no trae peso, es null — NO se cae al anterior", () => {
      // Un peso de hace dos años no describe al paciente de hoy, y la fórmula no tiene
      // forma de saber que es viejo: entraría como si fuera actual.
      const arr = [
        { fechaRegistro: "2026-08-12T18:56:06.535-05:00", presionSistolica: 120 },
        { fechaRegistro: "2024-01-05T10:00:00.000-05:00", peso: 88.0 },
      ];
      t.igual(api._pesoDeSignosVitales(arr), null);
    });

    // v14.1.3 — El peso pasa por _labNumerico, no por Number() a secas. La captura real de
    // consultorio lo trae como número, pero si una instalación devolviera coma decimal o la
    // unidad pegada, Number() daría NaN y se descartaría un peso VÁLIDO — y sin peso no hay
    // Cockcroft-Gault, así que ese paciente se quedaría sin estadio por un formato.
    t.caso("_pesoDeSignosVitales: acepta coma decimal y unidad pegada, no solo número puro", () => {
      t.igual(api._pesoDeSignosVitales([{ peso: 65.0 }]).peso, 65, "el formato real capturado en consultorio (número)");
      t.igual(api._pesoDeSignosVitales([{ peso: "72,5" }]).peso, 72.5, "coma decimal");
      t.igual(api._pesoDeSignosVitales([{ peso: "70 kg" }]).peso, 70, "unidad pegada");
      t.igual(api._pesoDeSignosVitales([{ peso: "-70" }]), null, "un peso negativo es basura, no 70");
    });

    t.caso("_pesoDeSignosVitales: array vacío, no-array y peso inválido -> null, sin lanzar", () => {
      t.igual(api._pesoDeSignosVitales([]), null, "paciente sin signos vitales registrados");
      t.igual(api._pesoDeSignosVitales(null), null);
      t.igual(api._pesoDeSignosVitales("no soy un array"), null);
      t.igual(api._pesoDeSignosVitales([{ peso: 0 }]), null);
      t.igual(api._pesoDeSignosVitales([{ peso: "sin dato" }]), null);
      t.igual(api._pesoDeSignosVitales([null]), null);
    });

    // ---------- estadioRenalDelPaciente ----------
    t.caso("estadioRenalDelPaciente: manda COCKCROFT-GAULT (decisión del médico), no CKD-EPI", () => {
      // Vector elegido a propósito para que las DOS fórmulas den estadios distintos:
      // mujer de 63 años, 113 kg, creatinina 0.55.
      //   Cockcroft-Gault = 186.8 -> G1   (suite 27 ya ancla ese 186.8)
      //   CKD-EPI 2021    = 110.6 -> G1
      // Para separarlos de verdad se usa un caso de bajo peso más abajo; aquí se ancla
      // que el campo `formula` y el `tfg` devuelto son los de Cockcroft-Gault.
      const r = api.estadioRenalDelPaciente({ edad: 63, peso: 113, creatininaCruda: "0.55", sexo: "F" });
      t.igual(r.formula, "Cockcroft-Gault");
      t.igual(r.tfg, 186.8, "el tfg que se devuelve es el de Cockcroft-Gault, el mismo valor que ancla la suite 27");
      t.igual(r.estadio, "G1");
      t.igual(r.faltan, []);
    });

    t.caso("estadioRenalDelPaciente: en bajo peso, el estadio sigue el de Cockcroft-Gault aunque CKD-EPI diga otro", () => {
      // Mujer de 80 años, 42 kg, creatinina 1.3 — el caso clásico donde las fórmulas
      // divergen (poca masa muscular). CG castiga por el peso bajo; CKD-EPI no lo ve.
      const r = api.estadioRenalDelPaciente({ edad: 80, peso: 42, creatininaCruda: "1.3", sexo: "F" });
      const cg = api.cockcroftGault(80, 42, 1.3, "F");
      const ckd = api.ckdEpi2021(80, 1.3, "F");
      t.igual(r.tfg, cg, "devuelve la TFG de Cockcroft-Gault");
      t.igual(r.estadio, api.estadioKDIGO(cg), "y el estadio se deriva de ESA, no de CKD-EPI");
      t.igual(r.tfgCkdEpi, ckd, "CKD-EPI se calcula igual, pero solo para contrastar");
      t.cierto(api.estadioKDIGO(cg) !== api.estadioKDIGO(ckd),
        "precondición del vector: las dos fórmulas deben discrepar de estadio, si no la prueba no demuestra nada");
    });

    t.caso("estadioRenalDelPaciente: SIN PESO no hay estadio — dice 'peso' y devuelve null", () => {
      // Es el caso que bloqueaba todo hasta hoy: sin el endpoint de signos vitales, este
      // era el resultado de TODOS los pacientes.
      const r = api.estadioRenalDelPaciente({ edad: 63, peso: null, creatininaCruda: "0.55", sexo: "F" });
      t.igual(r.estadio, null, "jamás un estadio a medias");
      t.igual(r.tfg, null);
      t.igual(r.faltan, ["peso"]);
    });

    t.caso("estadioRenalDelPaciente: nombra TODAS las entradas que faltan, no solo la primera", () => {
      const r = api.estadioRenalDelPaciente({});
      t.igual(r.faltan, ["edad", "peso", "creatinina"], "el médico debe poder ver de un vistazo todo lo que falta");
      t.igual(r.estadio, null);
    });

    t.caso("estadioRenalDelPaciente: una creatinina no numérica NO se degrada a G5", () => {
      // El fallo más peligroso posible de esta función: Number("PENDIENTE") es NaN, las
      // fórmulas devuelven su centinela 0, y estadioKDIGO(0) devuelve G5 — el estadio MÁS
      // GRAVE. Un paciente sano quedaría clasificado en falla renal avanzada.
      const r = api.estadioRenalDelPaciente({ edad: 63, peso: 70, creatininaCruda: "PENDIENTE", sexo: "F" });
      t.igual(r.estadio, null, "NO puede salir G5 de un resultado no numérico");
      t.igual(r.faltan, ["creatinina"]);
    });

    // v14.1.3 — GUARDA DE UNIDADES (hallazgo de la auditoría de Gemini, verificado): las
    // fórmulas asumen mg/dL y el script descarta el campo `unidades` de Athenea desde
    // v12.0.0. Una creatinina normal reportada en µmol/L llega como 88 en vez de 1,0, y
    // Cockcroft-Gault daría una TFG ~88 veces menor: un paciente SANO saldría en falla renal
    // terminal. No se convierte (adivinar la unidad de un dato clínico es justo lo que este
    // proyecto prohíbe): se rechaza por rango de plausibilidad y se dice por qué.
    t.caso("estadioRenalDelPaciente: una creatinina en µmol/L (fuera del rango de mg/dL) se RECHAZA, no se calcula", () => {
      const r = api.estadioRenalDelPaciente({ edad: 60, peso: 70, creatininaCruda: "88", sexo: "M" });
      t.igual(r.estadio, null, "88 mg/dL es imposible en suero: casi seguro son µmol/L");
      t.igual(r.faltan, ["creatinina_fuera_de_rango"]);
      const r2 = api.estadioRenalDelPaciente({ edad: 60, peso: 70, creatininaCruda: "0.05", sexo: "M" });
      t.igual(r2.estadio, null, "por debajo de 0,1 mg/dL tampoco es plausible");
      t.igual(r2.faltan, ["creatinina_fuera_de_rango"]);
    });

    t.caso("estadioRenalDelPaciente: los extremos PLAUSIBLES en mg/dL sí se calculan", () => {
      // El rango tiene que dejar pasar la falla renal terminal real, que es justo el
      // paciente en quien el estadio más importa.
      t.cierto(!!api.estadioRenalDelPaciente({ edad: 60, peso: 70, creatininaCruda: "12", sexo: "M" }).estadio,
        "12 mg/dL es una falla renal avanzada real, no un error de unidades");
      t.cierto(!!api.estadioRenalDelPaciente({ edad: 60, peso: 70, creatininaCruda: "0.4", sexo: "F" }).estadio,
        "0,4 mg/dL es plausible en una mujer de poca masa muscular");
    });

    t.caso("estadioRenalDelPaciente: una creatinina '0' tampoco se degrada a G5", () => {
      const r = api.estadioRenalDelPaciente({ edad: 63, peso: 70, creatininaCruda: "0", sexo: "F" });
      t.igual(r.estadio, null);
      t.igual(r.faltan, ["creatinina"]);
    });

    t.caso("estadioRenalDelPaciente: la creatinina con desigualdad del LIS SÍ produce estadio", () => {
      const r = api.estadioRenalDelPaciente({ edad: 70, peso: 60, creatininaCruda: "> 5,0", sexo: "M" });
      t.igual(r.estadio, api.estadioKDIGO(api.cockcroftGault(70, 60, 5, "M")));
      t.igual(r.faltan, []);
      t.igual(r.entradas.creatinina, 5, "se usó el 5 saneado");
      t.igual(r.entradas.creatininaCruda, "> 5,0", "y se conserva el crudo para poder mostrárselo al médico");
    });

    t.caso("estadioRenalDelPaciente: el sexo ausente NO bloquea, pero se marca (sesga la TFG al alza en mujeres)", () => {
      const r = api.estadioRenalDelPaciente({ edad: 63, peso: 70, creatininaCruda: "1.0" });
      t.cierto(!!r.estadio, "sin sexo la fórmula corre igual: el factor 0.85 solo aplica a mujeres");
      t.igual(r.faltan, [], "el sexo no entra en la lista de bloqueantes");
      t.cierto(r.sexoAusente, "pero queda marcado para que el consumidor pueda advertirlo");
    });

    t.caso("estadioRenalDelPaciente: edad fuera de rango (0, negativa, >=140) cuenta como faltante", () => {
      t.igual(api.estadioRenalDelPaciente({ edad: 0, peso: 70, creatininaCruda: "1" }).faltan, ["edad"]);
      t.igual(api.estadioRenalDelPaciente({ edad: -3, peso: 70, creatininaCruda: "1" }).faltan, ["edad"]);
      t.igual(api.estadioRenalDelPaciente({ edad: 140, peso: 70, creatininaCruda: "1" }).faltan, ["edad"],
        "140 es el centinela de la propia fórmula: (140-edad) daría 0");
    });

    t.caso("estadioRenalDelPaciente: devuelve las entradas usadas y sus fechas, para que el médico pueda auditarlo", () => {
      const r = api.estadioRenalDelPaciente({
        edad: 63, peso: 113, creatininaCruda: "0.55", sexo: "F",
        fechaCreatinina: "2026-08-01", fechaPeso: "2026-08-12T18:56:06.535-05:00",
      });
      t.igual(r.entradas.edad, 63);
      t.igual(r.entradas.peso, 113);
      t.igual(r.entradas.creatinina, 0.55);
      t.igual(r.entradas.fechaCreatinina, "2026-08-01", "de cuándo es la creatinina que se usó");
      t.igual(r.entradas.fechaPeso, "2026-08-12T18:56:06.535-05:00", "y de cuándo el peso");
    });

    t.caso("estadioRenalDelPaciente: nunca devuelve null ni lanza, ni con basura de entrada", () => {
      t.noLanza(() => api.estadioRenalDelPaciente());
      t.noLanza(() => api.estadioRenalDelPaciente(null));
      t.cierto(!!api.estadioRenalDelPaciente(), "siempre un objeto: el consumidor no debe distinguir 'no se pudo' de 'se rompió'");
      t.cierto(Array.isArray(api.estadioRenalDelPaciente().faltan));
    });

    // ---------- apiHcObtenerSignosVitales ----------

    await t.casoAsync("apiHcObtenerSignosVitales: pega al endpoint correcto con el PacienteId", async () => {
      const urls = [];
      const c = cargar({
        silencioso: true,
        fetch: async (url) => { urls.push(String(url)); return respuestaJson([{ peso: 65.0 }])(); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      const r = await c.api.apiHcObtenerSignosVitales(636997);
      t.igual(r, [{ peso: 65.0 }]);
      t.cierto(urls[0].includes("/apiviva/APIHCHealth/api/Historicos/ObtenerHistoricoSignosVitales?PacienteId=636997"),
        "endpoint verificado en consultorio el 12-08-2026; obtuvo: " + urls[0]);
    });

    await t.casoAsync("apiHcObtenerSignosVitales: cachea por paciente e invalida al cambiar de paciente", async () => {
      let n = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { n++; return respuestaJson([{ peso: 65.0 }])(); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      await c.api.apiHcObtenerSignosVitales(111);
      await c.api.apiHcObtenerSignosVitales(111);
      t.igual(n, 1, "la segunda llamada del MISMO paciente se sirve de la caché");
      await c.api.apiHcObtenerSignosVitales(222);
      t.igual(n, 2, "un paciente DISTINTO sí dispara consulta nueva — nunca se mezclan pacientes");
      c.api._signosVitalesInvalidar();
      await c.api.apiHcObtenerSignosVitales(222);
      t.igual(n, 3, "tras invalidar, vuelve a consultar");
    });

    await t.casoAsync("apiHcObtenerSignosVitales: un array VACÍO es un resultado real y se cachea", async () => {
      let n = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { n++; return respuestaJson([])(); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      t.igual(await c.api.apiHcObtenerSignosVitales(333), [], "paciente sin signos vitales registrados");
      await c.api.apiHcObtenerSignosVitales(333);
      t.igual(n, 1, "se cachea igual: no es un fallo, es un 'no tiene'");
    });

    await t.casoAsync("apiHcObtenerSignosVitales: una respuesta que NO es array sube como null y no se cachea", async () => {
      let n = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { n++; return respuestaJson({ error: "algo raro" })(); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      t.igual(await c.api.apiHcObtenerSignosVitales(444), null, "una forma inesperada no se devuelve como si fuera válida");
      await c.api.apiHcObtenerSignosVitales(444);
      t.igual(n, 2, "y NO se cachea: se reintenta");
    });

    await t.casoAsync("apiHcObtenerSignosVitales: sin pacienteId no llama a nada", async () => {
      let n = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { n++; return respuestaJson([])(); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      t.igual(await c.api.apiHcObtenerSignosVitales(null), null);
      t.igual(await c.api.apiHcObtenerSignosVitales(0), null);
      t.igual(await c.api.apiHcObtenerSignosVitales(""), null);
      t.igual(n, 0, "cero peticiones inventadas");
    });

    // ---------- integración: la cadena completa con la respuesta REAL capturada ----------
    await t.casoAsync("cadena completa: respuesta real de consultorio -> peso -> estadio", async () => {
      // Cuerpo EXACTO capturado en vivo el 12-08-2026 (PROMPT_JULES_R1_TFG_KDIGO.md:139-141).
      const REAL = [{
        fechaRegistro: "2026-08-12T18:56:06.535-05:00", presionSistolica: 120, presionDiastolica: 80,
        frecuenciaCardiaca: 89, frecuenciaRespiratoria: 16, temperatura: 36.0, saturacionOxigeno: 96.0,
        peso: 65.0, talla: 152.0, imc: 28.13,
      }];
      const c = cargar({
        silencioso: true,
        fetch: async () => respuestaJson(REAL)(),
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      const sv = await c.api.apiHcObtenerSignosVitales(636997);
      const p = c.api._pesoDeSignosVitales(sv);
      t.igual(p.peso, 65.0, "el peso se extrae de la forma real que devuelve Everest");
      const r = c.api.estadioRenalDelPaciente({
        edad: 82, peso: p.peso, creatininaCruda: "1.4", sexo: "F", fechaPeso: p.fechaRegistro,
      });
      t.igual(r.tfg, c.api.cockcroftGault(82, 65, 1.4, "F"));
      t.cierto(!!r.estadio, "con las cuatro entradas reales, sí hay estadio");
      t.igual(r.entradas.fechaPeso, "2026-08-12T18:56:06.535-05:00", "la fecha del peso viaja hasta el resultado");
    });
  },
};
