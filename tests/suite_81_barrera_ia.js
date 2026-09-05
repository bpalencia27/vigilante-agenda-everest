"use strict";
// ══════════════════════════════════════════════════════════════════════
// Suite 81 — v18.2.1 (P10) · Barrera cero-identificables en la salida
// hacia la IA (prompt 02_barrera_cero_identificables).
// Cubre:
//   1·los seis detectores, con tipo, canal y muestra acotada
//   2·daño cero: los prompts reales de los cinco modos pasan limpios
//   3·canarios (15) × canales saneados (6): o lo limpia el saneador o
//     lo detiene la barrera — nunca sale armado al prompt
//   4·el canal CRUDO (JSON v68) queda cubierto por la barrera
//   5·de punta a punta: si dispara, CERO disparos de red y telemetría
//     sin PHI
//   6·STRUCTURAL: un solo punto de salida y la barrera delante de él
// TODOS los nombres, cédulas, teléfonos, correos y direcciones de esta
// suite son DATOS INVENTADOS para canario (no PHI de nadie real).
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

function hojaDemo(api) {
  return api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F", diabetes: true, hta: true },
    erc: { egfr: 52, estadioClinico: "G3a" }, riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70 } } },
    { hoyIso: "2026-09-04", medicamentos: ["LOSARTAN 50 MG"], ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } } });
}

const accionesUX = (c) => {
  try { c.api._uxVolcarBuffer(); return (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {}; } catch (e) { return {}; }
};

module.exports = {
  nombre: "Suite 81 · v18.2.1 (P10): barrera cero-identificables antes de la red",
  cubre: ["mtrBarreraIdentificables", "mtrGeminiRedactar", "mtrRedaccionPrompt", "mtrSanearTextoLibreAI"],
  async pruebas(t, api, env, cargar) {
    const B = api.mtrBarreraIdentificables;
    t.cierto(typeof B === "function", "la barrera debe quedar expuesta al arnés (declaración function de nivel superior)");

    t.caso("P10·1 — los seis detectores disparan solos, con tipo, canal y muestra acotada", () => {
      const NOMBRE = "María Rodríguez";
      const casos = [
        ["numero_largo", "la cédula es 1020304050 en el sistema"],
        ["telefono", "llamar al 313 456 7890 hoy"],
        ["correo", "escribir a maria.rodriguez@example.com"],
        ["direccion", "vive en Cra 45 #12-34 desde hace años"],
        ["nombre_paciente", "refiere María en el texto libre"],
        ["nombre_con_honorifico", "el Sr. Gómez acompaña"],
      ];
      for (const [tipo, texto] of casos) {
        const r = B("", texto, NOMBRE);
        t.cierto(!r.ok, "dispara ante " + tipo);
        t.cierto(r.hallazgos.some((h) => h.tipo === tipo), "clasifica el hallazgo como " + tipo);
        t.cierto(String(r.motivo).indexOf("no se envió") >= 0, "el motivo dice que no se envió nada (" + tipo + ")");
      }
      // canal marcado y muestra acotada
      const r1 = B("en el system viaja 1020304050", "el user está limpio", NOMBRE);
      t.cierto(!r1.ok && r1.hallazgos[0].donde === "system", "marca en qué mitad del prompt estaba");
      t.cierto(r1.hallazgos.every((h) => String(h.muestra).length <= 24), "la muestra viaja acotada a 24 caracteres");
      // el honorífico solo con DR/DRA (que el saneador NO trae) también dispara
      t.cierto(!B("", "el DR. Pérez insiste", NOMBRE).ok, "DR. + nombre capitalizado dispara aunque el saneador no lo conozca");
      // y un texto clínico real sin identificadores pasa limpio
      const limpia = B("Paciente con HTA y DM2 de largo tiempo.", "HECHOS: EGFR 52 ML/MIN, LDL 118 MG/DL, CONTROL EN 3 MESES.", NOMBRE);
      t.cierto(limpia.ok && limpia.hallazgos.length === 0, "cifras clínicas cortas y prosa limpia no disparan nada");
    });

    t.caso("P10·2 — daño cero: los prompts REALES de los cinco modos pasan limpios por la barrera", () => {
      const ind = "Enfatizar adherencia al losartan; explicarle la meta de LDL menor a 70; control en 3 meses con laboratorio.";
      for (const modo of ["enfermedad_actual", "motivo_consulta", "analisis_plan", "recomendaciones", "consulta"]) {
        const opts = { nombrePaciente: "María Rodríguez", docId: "1020304050", indicaciones: ind };
        if (modo === "consulta") opts.pregunta = "¿Qué hallazgo del uroanálisis justifica remisión a urología?";
        if (modo === "analisis_plan") opts.jsonV68 = { riesgo: { categoria: "alto" }, renal: { egfr: 52 }, metas: { ldl: 70 }, plan: { ordenar: ["lab_perfil_lipidico"] } };
        const p = api.mtrRedaccionPrompt(modo, hojaDemo(api), opts);
        const r = B(p.system, p.user, "María Rodríguez");
        t.cierto(r.ok, modo + " debe pasar — hallazgos: " + (r.hallazgos.map((h) => h.tipo + "@" + h.donde + " «" + h.muestra + "»").join(", ") || "ninguno"));
      }
    });

    t.caso("P10·3 — canarios × canales saneados: el identificador nunca llega ARMADO al prompt", () => {
      const NOMBRE = "María Rodríguez";
      // [rótulo, texto inyectado, agujas que no pueden salir, nombre del paciente de ese canario]
      const canarios = [
        ["nombre minúscula", "maría rodríguez refiere dolor", ["maría rodríguez"], NOMBRE],
        ["nombre MAYÚSCULAS", "MARÍA RODRÍGUEZ refiere dolor", ["MARÍA RODRÍGUEZ"], NOMBRE],
        ["nombre sin tildes", "MARIA RODRIGUEZ refiere dolor", ["MARIA RODRIGUEZ"], NOMBRE],
        ["apellido de 2 letras", "la familia LI consultó anoche", ["familia LI"], "Li Wu"],
        ["acompañante con rótulo", "Acompañante: Jose Perez firma el consentimiento", ["Jose Perez"], NOMBRE],
        ["cédula pegada", "documento 1020304050 del paciente", ["1020304050"], NOMBRE],
        ["cédula con puntos", "documento 1.020.304.050 del paciente", ["1.020.304.050"], NOMBRE],
        ["teléfono pegado", "teléfono 3134567890 del paciente", ["3134567890"], NOMBRE],
        ["teléfono separado", "teléfono 313 456 7890 del paciente", ["313 456 7890"], NOMBRE],
        ["teléfono con indicativo", "teléfono +57 313 456 7890 del paciente", ["+57 313 456 7890"], NOMBRE],
        ["correo", "correo maria.rodriguez@example.com del paciente", ["maria.rodriguez@example.com"], NOMBRE],
        ["dirección", "domicilio Cra 45 #12-34 del paciente", ["Cra 45 #12-34"], NOMBRE],
        ["Paciente: Fulano", "Paciente: Fulano anoche descompensado", ["Fulano"], NOMBRE],
        ["Sr. + apellido", "el Sr. Perez insiste en el dolor", ["Sr. Perez", "Perez"], NOMBRE],
        ["DR. + apellido", "el DR. Perez insiste en el dolor", ["DR. Perez"], NOMBRE],
      ];
      let limpiados = 0, detenidos = 0, comprobados = 0;
      for (const [rotulo, texto, agujas, nom] of canarios) {
        // Cinco canales del modo enfermedad_actual + la pregunta del modo consulta.
        const variantes = [
          ["enfermedad_actual", { contextoLibre: texto }],
          ["enfermedad_actual", { indicaciones: texto }],
          ["enfermedad_actual", { anclaControlAnterior: texto }],
          ["enfermedad_actual", { datosExtra: { medicamentosAportados: texto } }],
          ["enfermedad_actual", { estiloEjemplos: [texto] }],
          ["consulta", { pregunta: texto }],
        ];
        for (const [modo, canal] of variantes) {
          const opts = Object.assign({ nombrePaciente: nom }, canal);
          const p = api.mtrRedaccionPrompt(modo, hojaDemo(api), opts);
          const todo = p.system + "\n" + p.user;
          const r = B(p.system, p.user, nom);
          const presente = agujas.some((n) => todo.indexOf(n) >= 0);
          comprobados++;
          t.cierto(!(presente && r.ok), rotulo + " × " + Object.keys(canal)[0] + ": o lo limpia el saneador o lo detiene la barrera — nunca sale y pasa");
          if (!presente) limpiados++;
          else if (!r.ok) detenidos++;
        }
      }
      // Guarda anti-silencio: si los saneadores se rompieran, todo sería «presente» y
      // esta cifra caería a cero — la disjunction de arriba seguiría en verde sin medir.
      t.cierto(comprobados === canarios.length * 6, "se ejecutaron los " + (canarios.length * 6) + " cruces del tablero");
      t.cierto(limpiados >= 14 * 6, "los saneadores limpiaron de verdad en " + limpiados + "/" + comprobados + " cruces (mínimo los canarios censurables)");
      t.cierto(detenidos >= 1, "al menos el canario DR. (que el saneador no conoce) es detenido por la barrera");
      // El saneador, invocado DIRECTO (el `cubre` de esta suite lo nombra): la primera
      // línea de defensa tacha el nombre del paciente en texto libre.
      t.cierto(typeof api.mtrSanearTextoLibreAI === "function", "el saneador queda expuesto al arnés para medirlo directo");
      if (typeof api.mtrSanearTextoLibreAI === "function") {
        const sanado = String(api.mtrSanearTextoLibreAI("maría rodríguez refiere dolor", NOMBRE));
        t.cierto(sanado.indexOf("maría rodríguez") < 0 && sanado.indexOf("NOMBRE_CENSURADO") >= 0, "el saneador tacha el nombre tal cual (sin depender del prompt)");
      }
    });

    t.caso("P10·4 — el canal CRUDO (JSON v68) queda cubierto: la barrera dispara donde el saneador no llega", () => {
      const NOMBRE = "María Rodríguez";
      const p = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), {
        nombrePaciente: NOMBRE,
        jsonV68: { acudiente: "María Rodríguez", telefono: "3134567890" },
      });
      t.cierto(p.user.indexOf("María Rodríguez") >= 0, "control del hueco: el JSON viaja crudo de verdad en el prompt");
      const r = B(p.system, p.user, NOMBRE);
      t.cierto(!r.ok, "la barrera detiene lo que el canal crudo lleva");
      t.cierto(r.hallazgos.some((h) => h.tipo === "nombre_paciente"), "clasifica el nombre del paciente");
      t.cierto(r.hallazgos.some((h) => h.tipo === "numero_largo" || h.tipo === "telefono"), "clasifica el número que viajaba crudo");
    });

    await t.casoAsync("P10·5 — de punta a punta: si la barrera dispara, NO sale ni una petición a ningún proveedor", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        // El cuerpo de la respuesta depende del proveedor al que fue la petición:
        // z.ai habla formato OpenAI (choices), Gemini habla candidates.
        const esZai = String(o.url).indexOf("api.z.ai") >= 0;
        const cuerpo = esZai
          ? '{"choices":[{"message":{"content":"x"}}]}'
          : '{"candidates":[{"content":{"parts":[{"text":"x"}]},"finishReason":"STOP"}]}';
        setTimeout(() => o.onload({ status: 200, responseText: cuerpo }), 0);
      } });
      c.api.mtrGuardarClaveZai("Z"); c.api.mtrGuardarClaveGemini("G");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "analisis_plan", { nombrePaciente: "María Rodríguez", jsonV68: { documento: "1020304050" } });
      t.cierto(!r.ok, "resuelve cerrado (fail-safe)");
      t.cierto(String(r.motivo).indexOf("no se envió") >= 0, "el motivo le dice al médico qué se detectó y qué hacer");
      t.igual(urls.length, 0, "CERO disparos de red: ni z.ai ni gemini recibieron nada");
      const acc = accionesUX(c);
      t.igual(acc["ia.barrera.bloqueo"], 1, "queda medido el bloqueo (conteo anónimo)");
      t.cierto(acc["ia.gen.analisis_plan"] === undefined, "lo bloqueado no cuenta como generación");
      const vol = String(c.env.storage.getItem("vgl_ux") || "");
      t.cierto(vol.indexOf("1020304050") < 0, "la telemetría del bloqueo no arrastra la cédula (cero PHI)");
      // y el mismo prompt SIN identificador sí sale: la barrera no rompe el flujo bueno.
      urls.length = 0;
      const r2 = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", { nombrePaciente: "María Rodríguez" });
      t.cierto(r2.ok, "sin identificadores el flujo normal sigue igual");
      t.igual(urls.length, 1, "dispara exactamente una vez (z.ai primario)");
    });

    t.caso("P10·6 — ESTRUCTURAL: un solo punto de salida hacia la IA y la barrera delante de él", () => {
      // 6a — las URLs reales de IA viven SOLO en la capa de proveedores.
      const urls = [...FUENTE.matchAll(/https:\/\/(?:api\.z\.ai|generativelanguage\.googleapis\.com)/g)];
      t.igual(urls.length, 2, "exactamente dos URLs de IA con esquema en todo el archivo (z.ai y gemini)");
      const iniProv = FUENTE.indexOf("const MTR_PROVEEDORES_IA = {");
      t.cierto(iniProv >= 0, "existe la capa de proveedores");
      for (const u of urls) t.cierto(u.index > iniProv && u.index < iniProv + 2500, "la URL vive dentro de MTR_PROVEEDORES_IA, no en un atajo particular");
      // 6b — dentro de mtrGeminiRedactar: prompt → barrera → red. Cualquier ruta nueva
      // que ensamble un cuerpo de IA y dispare GM_xmlhttpRequest sin pasar por la barrera
      // rompe esta cadena de índices.
      const iFn = FUENTE.indexOf("function mtrGeminiRedactar(hoja, modo, opts)");
      t.cierto(iFn >= 0, "existe mtrGeminiRedactar");
      const iP = FUENTE.indexOf("const p = mtrRedaccionPrompt(modo, hoja, o);", iFn);
      const iBar = FUENTE.indexOf("mtrBarreraIdentificables(p.system, p.user", iFn);
      const iGm = FUENTE.indexOf("GM_xmlhttpRequest({", iP);
      t.cierto(iP > iFn, "el prompt se arma dentro del conector");
      t.cierto(iBar > iP, "la barrera se evalúa DESPUÉS de armar el prompt");
      t.cierto(iGm > iBar, "y ANTES del único disparo GM_xmlhttpRequest");
      t.cierto(iGm - iFn < 8000, "el GM_xmlhttpRequest de IA sigue DENTRO de mtrGeminiRedactar (escalera de reintentos incluida)");
      // 6c — una sola definición, sin segundas copias.
      t.cierto(FUENTE.indexOf("function mtrBarreraIdentificables") === FUENTE.lastIndexOf("function mtrBarreraIdentificables"), "una sola definición de la barrera");
      t.cierto(FUENTE.indexOf("@connect      api.z.ai") >= 0 && FUENTE.indexOf("@connect      generativelanguage.googleapis.com") >= 0, "ambos dominios declarados en @connect");
    });
  }
};
