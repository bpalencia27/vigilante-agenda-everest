"use strict";
// ══════════════════════════════════════════════════════════════════════
// Suite 70 — v18.2.0 (P9) · Migración del redactor a GLM-5.3 (z.ai) con
// Gemini de RESPALDO + medición de 30 días (B1-B5).
// Cubre las 12 pruebas obligatorias del prompt 09_migracion_glm_y_medicion:
//   1·cuerpo gemini byte-exacto  2·zai messages (systemAparte:false)
//   3·sin campos de razonamiento 4·seis motivos, ambos proveedores
//   5·escalera zai→gemini + quién respondió  6·cinco textos literales
//   7·línea FUENTES jamás llega al médico  8·insertar frenado por avisos
//   9·umbral de edicion_fuerte  10·👍/👎 máx. una vez al día
//   11·canario de telemetría (cero texto del borrador)  12·mutaciones
//   (la 12 se documenta en tests/INFORME_MUTACIONES.md).
// El modal de redacción es DOM de Everest y no se monta en el arnés: sus
// cierres internos se protegen por TEXTO FUENTE (misma doctrina que las
// suites 12/15/23 usan para el resto del panel).
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

// Los 7 modelos de la rotación de Gemini, hardcodeados A PROPÓSITO: si la
// lista cambia, esta suite debe pedir revisión humana (el cuerpo exacto
// depende de qué prefijos 2.x/3.x haya).
const MODELOS_GEMINI = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite", "gemini-3-flash", "gemini-3.7-flash"];

// Respuestas simuladas de cada proveedor (forma REAL de cada API).
const respGemini = (texto) => JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] }, finishReason: "STOP" }] });
const respZai = (texto) => JSON.stringify({ choices: [{ message: { content: texto }, finish_reason: "stop" }] });

function hojaDemo(api) {
  return api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F", diabetes: true, hta: true },
    erc: { egfr: 52, estadioClinico: "G3a" }, riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70 } } },
    { hoyIso: "2026-08-17", medicamentos: ["LOSARTAN 50 MG"], ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } } });
}

// Cuerpo de Gemini RECONSTRUIDO desde las reglas documentadas (no desde el
// código bajo prueba): 2.x lleva temperature+maxOutputTokens; 3.x solo
// maxOutputTokens; casillas cortas apagan el razonamiento; el orden de
// claves es parte de la identidad serializada (test 1 del spec).
function esperadoGemini(modelo, system, user, modo) {
  const esCorta = (modo === "motivo_consulta" || modo === "recomendaciones") || modo === "consulta";
  let gen;
  if (/^gemini-2\./.test(modelo)) gen = { temperature: 0.2, maxOutputTokens: 8192 };
  else gen = { maxOutputTokens: 8192 };
  if (esCorta) {
    if (/^gemini-3/.test(modelo)) gen.thinkingConfig = { thinkingLevel: "minimal" };
    else if (/^gemini-2\.5-flash/.test(modelo)) gen.thinkingConfig = { thinkingBudget: 0 };
  }
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: gen,
  });
}

const accionesUX = (c) => {
  try { c.api._uxVolcarBuffer(); return (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {}; } catch (e) { return {}; }
};

module.exports = {
  nombre: "Suite 70 · v18.2.0 (P9): GLM-5.3 en z.ai con Gemini de respaldo + medición",
  cubre: ["mtrProveedorIA", "mtrRespuestaZai", "mtrGeminiRedactar", "mtrRecortarFuentes", "mtrVerificarFuentesIA", "mtrVerificarCifrasIA", "mtrCalcularDeltaEdicion", "mtrRedaccionPrompt", "mtrGuardarClaveZai", "mtrLeerClaveZai", "mtrHayClaveIA", "mtrEsCuotaAgotada", "mtrEsModeloSobrecargado", "mtrEsModeloNoDisponible", "mtrRespuestaGemini"],
  async pruebas(t, api, env, cargar) {

    t.caso("P9·1 — el cuerpo de gemini es byte-exacto al de v18.1 (matriz 7 modelos × 3 modos + 3 anclas literales)", () => {
      const gem = api.mtrProveedorIA("gemini");
      t.cierto(!!gem, "debe existir el proveedor gemini");
      t.igual(JSON.stringify(gem.modelos), JSON.stringify(MODELOS_GEMINI), "la lista de modelos de la rotación no puede cambiar sin revisión");
      const S70 = "SYSTEM70", U70 = "USER70";
      for (const modelo of gem.modelos) {
        for (const modo of ["motivo_consulta", "enfermedad_actual", "consulta"]) {
          t.igual(gem.cuerpo(modelo, S70, U70, modo), esperadoGemini(modelo, S70, U70, modo),
            "cuerpo gemini divergió en " + modelo + "/" + modo + " — si cambia una coma, es regresión");
        }
      }
      // Anclas literales (anti-tautología): tres combinaciones escritas a mano.
      t.igual(gem.cuerpo("gemini-2.5-flash-lite", S70, U70, "motivo_consulta"),
        '{"systemInstruction":{"parts":[{"text":"SYSTEM70"}]},"contents":[{"role":"user","parts":[{"text":"USER70"}]}],"generationConfig":{"temperature":0.2,"maxOutputTokens":8192,"thinkingConfig":{"thinkingBudget":0}}}');
      t.igual(gem.cuerpo("gemini-3.5-flash-lite", S70, U70, "consulta"),
        '{"systemInstruction":{"parts":[{"text":"SYSTEM70"}]},"contents":[{"role":"user","parts":[{"text":"USER70"}]}],"generationConfig":{"maxOutputTokens":8192,"thinkingConfig":{"thinkingLevel":"minimal"}}}');
      t.igual(gem.cuerpo("gemini-3.7-flash", S70, U70, "enfermedad_actual"),
        '{"systemInstruction":{"parts":[{"text":"SYSTEM70"}]},"contents":[{"role":"user","parts":[{"text":"USER70"}]}],"generationConfig":{"maxOutputTokens":8192}}');
    });

    t.caso("P9·2 — zai arma messages con el system COMPLETO pegado al inicio del user (systemAparte:false)", () => {
      const zai = api.mtrProveedorIA("zai");
      t.cierto(!!zai, "debe existir el proveedor zai");
      t.igual(zai.url("glm-5.3"), "https://api.z.ai/api/paas/v4/chat/completions");
      const cab = zai.headers("CLAVE-Z");
      t.igual(cab["Authorization"], "Bearer CLAVE-Z");
      const cuerpo = JSON.parse(zai.cuerpo("glm-5.3", "SYSTEM-Z", "USER-Z"));
      t.igual(JSON.stringify(Object.keys(cuerpo).sort()), JSON.stringify(["max_tokens", "messages", "model", "temperature"]));
      t.igual(cuerpo.model, "glm-5.3");
      t.igual(cuerpo.messages.length, 1, "zai recibe UN solo turno");
      t.igual(cuerpo.messages[0].role, "user");
      t.igual(cuerpo.messages[0].content, "SYSTEM-Z\n\nUSER-Z", "el prompt de sistema entra completo al inicio del mensaje de usuario");
      t.igual(cuerpo.temperature, 0.2);
      t.igual(cuerpo.max_tokens, 8192);
    });

    t.caso("P9·3 — con controlDeRazonamiento:false, el cuerpo de zai no lleva NINGÚN campo de razonamiento", () => {
      const crudo = api.mtrProveedorIA("zai").cuerpo("glm-5.3", "S", "U");
      t.cierto(!/thinking|reasoning/i.test(crudo), "el cuerpo serializado no puede mencionar thinking/reasoning");
      const cuerpo = JSON.parse(crudo);
      const claves = [];
      (function recolectar(o) { for (const k in o) { claves.push(k); if (o[k] && typeof o[k] === "object") recolectar(o[k]); } })(cuerpo);
      t.cierto(claves.every((k) => !/thinking|reasoning/i.test(k)), "ninguna clave anidada puede ser de razonamiento");
    });

    t.caso("P9·4 — los seis motivos de error se traducen al MISMO código interno desde ambos proveedores (clasificadores)", () => {
      const cuota = api.mtrEsCuotaAgotada, sat = api.mtrEsModeloSobrecargado, nod = api.mtrEsModeloNoDisponible;
      // cuota: 429 HTTP (ambos) + códigos z.ai 1113/1302 + cuerpo RESOURCE_EXHAUSTED de Gemini.
      t.cierto(cuota(429, ""), "429 es cuota para cualquiera de los dos");
      t.cierto(cuota(200, '{"error":{"code":1113,"message":"insufficient balance"}}'), "z.ai 1113 = saldo insuficiente");
      t.cierto(cuota(200, '{"error":{"code":"1302","message":"plan limit"}}'), "z.ai 1302 = límite de plan");
      t.cierto(cuota(429, '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), "RESOURCE_EXHAUSTED = cuota");
      t.cierto(!sat(200, '{"error":{"code":1113}}') && !nod(200, '{"error":{"code":1113}}'), "1113 no se mezcla con otros motivos");
      // saturado: 503 HTTP + UNAVAILABLE (Gemini) / "code":503 (z.ai).
      t.cierto(sat(503, ""), "503 es saturación");
      t.cierto(sat(200, '{"error":{"code":503,"message":"overloaded"}}'), "z.ai 503 en el cuerpo");
      t.cierto(!cuota(503, '{"error":{"code":503}}') && !nod(503, ""), "503 no se mezcla");
      // no disponible: 400/404/500/502/504 + NOT_FOUND (Gemini) / 1211 (z.ai: modelo inexistente).
      t.cierto(nod(404, ""), "404 es no disponible");
      t.cierto(nod(200, '{"error":{"code":1211,"message":"model not exists"}}'), "z.ai 1211 = modelo que no existe → rotar, no fallar en seco");
      t.cierto(nod(404, '{"error":{"code":404,"status":"NOT_FOUND"}}'), "NOT_FOUND de Gemini");
      t.cierto(!cuota(404, "") && !sat(404, ""), "404 no se mezcla");
    });

    t.caso("P9·4b — vacío y bloqueado devuelven el mismo TEXTO interno desde ambos parseadores", () => {
      t.igual(api.mtrRespuestaZai("{}").motivo, api.mtrRespuestaGemini("{}").motivo, "respuesta vacía = mismo motivo interno");
      t.cierto(String(api.mtrRespuestaZai('{"error":{"code":1301,"message":"content filter"}}').motivo).indexOf("bloqueado por el modelo") === 0, "z.ai 1301 = bloqueado");
      t.cierto(String(api.mtrRespuestaGemini('{"promptFeedback":{"blockReason":"SAFETY"}}').motivo).indexOf("bloqueado por el modelo") === 0, "Gemini SAFETY = bloqueado");
    });

    await t.casoAsync("P9·4c — timeout: mismo código interno venga de zai o de Gemini", async () => {
      const mk = async (zai, gem) => {
        const c = cargar({ silencioso: true, gmxhr: (o) => setTimeout(() => o.ontimeout(), 0) });
        c.api.mtrGuardarClaveZai(zai); c.api.mtrGuardarClaveGemini(gem);
        return await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      };
      const rz = await mk("Z", "");   // solo zai: 1 intento
      const rg = await mk("", "G");   // solo gemini: rotación completa
      t.cierto(!rz.ok && !rg.ok, "ambos fallan");
      t.igual(rz.motivo, rg.motivo, "el motivo interno del timeout es único");
      t.cierto(String(rg.motivo).indexOf("tiempo agotado") === 0, "y es el de timeout, no otro");
    });

    await t.casoAsync("P9·5 — agotada z.ai (429), gemini entra UNA vez, responde y queda registrado quién", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => {
          if (o.url.indexOf("api.z.ai") >= 0) o.onload({ status: 429, responseText: '{"error":{"code":429,"message":"rate limit"}}' });
          else o.onload({ status: 200, responseText: respGemini("Borrador de respaldo sin cifras.") });
        }, 0);
      } });
      c.api.mtrGuardarClaveZai("Z"); c.api.mtrGuardarClaveGemini("G");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 2, "exactamente dos disparos: zai y UN respaldo");
      t.cierto(urls[0].indexOf("api.z.ai") >= 0, "el primero es z.ai");
      t.cierto(urls[1].indexOf("generativelanguage.googleapis.com") >= 0, "el segundo es gemini");
      t.cierto(r.ok && r.texto === "Borrador de respaldo sin cifras.");
      const acc = accionesUX(c);
      t.cierto(Object.keys(acc).length > 0, "la telemetría de la escalera debe llegar al volcado");
      t.igual(acc["ia.prov.gemini"], 1, "queda registrado que respondió gemini");
      t.cierto(acc["ia.prov.zai"] === undefined, "zai no respondió: no se registra");
      t.igual(acc["ia.cuota.rota"], 1, "la rotación por cuota quedó medida");
      t.igual(acc["ia.ok"], 1);
    });

    await t.casoAsync("P9·5b — cuando z.ai responde en forma OpenAI, la escalera lo ACEPTA (parseo por proveedor)", async () => {
      const c = cargar({ silencioso: true, gmxhr: (o) => setTimeout(() => {
        if (o.url.indexOf("api.z.ai") >= 0) o.onload({ status: 200, responseText: respZai("Borrador de GLM sin cifras.") });
        else o.onload({ status: 500, responseText: "{}" });   // gemini NO debería recibir nada
      }, 0) });
      c.api.mtrGuardarClaveZai("Z"); c.api.mtrGuardarClaveGemini("G");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.cierto(r.ok && r.texto === "Borrador de GLM sin cifras.", "choices[0].message.content debe leerse como éxito");
      t.igual(r.finishReason, "STOP", "finish_reason stop mapea a STOP interno");
      const acc = accionesUX(c);
      t.igual(acc["ia.prov.zai"], 1, "queda registrado que respondió zai");
      t.cierto(acc["ia.prov.gemini"] === undefined, "el respaldo no entró: no había fallo");
    });

    t.caso("P9·6 — los textos añadidos aparecen LITERALMENTE en el prompt que se envía (mejoras 2, 3 y 4)", () => {
      const p = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {});
      const AUTOVERIF = "ANTES DE RESPONDER, RELEE TU BORRADOR Y COMPRUEBA: (1) cada cifra que escribiste aparece en alguno de los bloques recibidos; (2) cada afirmación clínica —incluidas las negativas, del tipo «NIEGA DOLOR TORÁCICO»— procede de un bloque, no de lo que suele pasar en pacientes parecidos; (3) no dejaste fuera ningún hallazgo relevante que sí estaba. Si algo no cumple, corrígelo antes de entregar. Entrega solo el texto final, sin mencionar esta revisión.";
      const RECUERDA = "RECUERDA: lo que no esté en los bloques anteriores NO EXISTE. Y no omitas nada relevante que sí esté.";
      t.cierto(p.system.indexOf(AUTOVERIF) >= 0, "la autoverificación viaja palabra por palabra en el system");
      t.cierto(p.system.indexOf("FUENTES: hecho1; hecho2; hecho3") >= 0, "la línea de fuentes se pide literalmente");
      t.cierto(p.user.trim().lastIndexOf(RECUERDA) === p.user.trim().length - RECUERDA.length, "las dos reglas duras cierran el user, después de la instrucción");
      // Y en el cuerpo REAL de zai (system pegado al user): las tres piezas al vuelo.
      const contenidoZai = JSON.parse(api.mtrProveedorIA("zai").cuerpo("glm-5.3", p.system, p.user)).messages[0].content;
      t.cierto(contenidoZai.indexOf(AUTOVERIF) >= 0 && contenidoZai.indexOf("FUENTES: hecho1") >= 0, "zai recibe autoverificación y fuentes");
      t.cierto(contenidoZai.trim().endsWith(RECUERDA), "zai recibe el RECUERDA al final del único turno");
    });

    t.caso("P9·6b — mejoras 1 y 5 (texto en el producto): «✓ la vi» y el aviso de indicaciones largas", () => {
      t.cierto(FUENTE.indexOf("✓ la vi") >= 0, "la marca de revisión individual existe");
      t.cierto(FUENTE.indexOf("_indLen > 1500") >= 0, "el umbral de indicaciones largas existe");
      t.cierto(FUENTE.indexOf("puede salir más lenta y menos fiel a los hechos") >= 0, "el aviso textual existe");
    });

    t.caso("P9·7 — la línea FUENTES jamás llega al texto del médico (unidad + extremo a extremo)", () => {
      const rf = api.mtrRecortarFuentes("Línea uno.\nFUENTES: TFG 52; LDL 118\nCierre.\nfuentes: segunda línea");
      t.igual(rf.texto, "Línea uno.\nCierre.", "toda línea FUENTES desaparece del texto");
      t.igual(rf.fuentes.length, 2, "y se conserva como corpus para el verificador");
      t.igual(rf.fuentes[0], "TFG 52; LDL 118");
      t.igual(rf.fuentes[1], "segunda línea");
      t.cierto(rf.texto.toUpperCase().indexOf("FUENTES") < 0);
    });

    await t.casoAsync("P9·7b — el conector recorta la línea FUENTES antes de devolver el borrador (zai real path)", async () => {
      const c = cargar({ silencioso: true, gmxhr: (o) => setTimeout(() => o.onload({ status: 200, responseText: respZai("Nota clínica sin cifras.\nFUENTES: hoja de hechos; control anterior") }), 0) });
      c.api.mtrGuardarClaveZai("Z"); c.api.mtrGuardarClaveGemini("");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.cierto(r.ok, "el borrador llegó bien");
      t.cierto(String(r.texto).toUpperCase().indexOf("FUENTES") < 0, "el texto que vería el médico no la contiene");
      t.cierto((r.fuentes || []).length === 1 && r.fuentes[0] === "hoja de hechos; control anterior", "el corpus sí la conserva");
    });

    t.caso("P9·8 — insertar frenado mientras haya avisos sin ver (fuente) y verificadores puros", () => {
      // El cierre del modal, por texto fuente (el arnés no monta el DOM de Everest):
      t.cierto(FUENTE.indexOf("btnIns.disabled = !(hay && puedeInsertar() && !_haySinVer());") >= 0, "habilitarPost exige cero avisos pendientes");
      t.cierto(FUENTE.indexOf("Hay avisos de cifras/afirmaciones sin revisar") >= 0 && FUENTE.indexOf("if (_haySinVer()) {") >= 0, "el clic de Insertar se frena con mensaje claro");
      t.cierto(FUENTE.indexOf("button[data-ver]") >= 0 && FUENTE.indexOf("_cifrasVistas.add(") >= 0, "cada marca «✓ la vi» habilita su hallazgo");
      // Los verificadores puros que alimentan esos avisos:
      const hz = api.mtrVerificarCifrasIA("PA 150/95 mmHg.", null, []);
      t.cierto(hz.length >= 1, "una cifra sin respaldo genera hallazgo");
      t.igual(api.mtrVerificarCifrasIA("PA 150/95 mmHg.", null, ["150/95"]).length, 0, "la misma cifra CON respaldo, ninguno");
      const v1 = api.mtrVerificarFuentesIA("NIEGA DOLOR TORÁCICO.", "", "");
      t.cierto(v1.length === 1 && v1[0].sintoma === "DOLOR TORÁCICO", "un negativo sin hecho detrás genera aviso");
      t.igual(api.mtrVerificarFuentesIA("NIEGA DOLOR TORÁCICO.", "", "niega dolor torácico").length, 0, "con respaldo del médico, ninguno");
      t.igual(api.mtrVerificarFuentesIA("NIEGA DOLOR TORÁCICO.", "dolor torácico", "").length, 0, "y también con la línea de fuentes del modelo");
    });

    t.caso("P9·9 — edicion_fuerte se dispara en la banda 0,8 < sim < 0,85 y NI ANTES NI DESPUÉS", () => {
      const w = (n) => Array.from({ length: n }, (_, i) => "palabra" + (i + 1)).join(" ");
      const partir = (s) => s.split(" ");
      // 41 de 50 compartidas → sim 0,82 → FUERTE.
      const editFuerte = partir(w(50)).slice(0, 41).concat(["nueva1", "nueva2", "nueva3", "nueva4", "nueva5", "nueva6", "nueva7", "nueva8", "nueva9"]).join(" ");
      t.igual(api.mtrCalcularDeltaEdicion(w(50), editFuerte), "edicion_fuerte");
      // 16 de 20 → sim 0,80 EXACTO → sigue leve (pin de suite_57: no dispara antes).
      const edit08 = partir(w(20)).slice(0, 16).concat(["otra"]).join(" ");
      t.igual(api.mtrCalcularDeltaEdicion(w(20), edit08), "edicion_leve");
      // 11 de 12 → sim ≈ 0,917 → leve (la banda no se pasa).
      const edit12 = partir(w(12)).slice(0, 11).concat(["otra"]).join(" ");
      t.igual(api.mtrCalcularDeltaEdicion(w(12), edit12), "edicion_leve");
      // 14 de 20 → sim 0,70 → reescritura (el corte viejo queda intacto).
      const editRe = partir(w(20)).slice(0, 14).concat(["x1", "x2", "x3", "x4", "x5", "x6"]).join(" ");
      t.igual(api.mtrCalcularDeltaEdicion(w(20), editRe), "reescritura");
    });

    t.caso("P9·10 — el 👍/👎 nace a lo sumo una vez al día y no bloquea nada (fuente)", () => {
      t.cierto(FUENTE.indexOf('const MTR_IA_FEEDBACK_DIA_KEY = "vgl_ia_feedback_dia"') >= 0, "la llave de una-vez-al-día existe");
      t.cierto(FUENTE.indexOf('GM_getValue(MTR_IA_FEEDBACK_DIA_KEY, "") === hoy) return;') >= 0, "si ya se preguntó hoy, vuelve sin hacer nada");
      t.cierto(FUENTE.indexOf('uxTrack("ia.feedback.bien")') >= 0 && FUENTE.indexOf('uxTrack("ia.feedback.mal")') >= 0, "la respuesta viaja como enum, no como texto");
      t.cierto(/const _preguntarFeedback = \(\) => \{\s*\n\s*try \{/.test(FUENTE), "todo el bloque va en try/catch: jamás rompe la inserción");
    });

    await t.casoAsync("P9·11 — canario: un nombre y una cédula en el borrador NO aparecen en NINGÚN evento de telemetría", async () => {
      const c = cargar({ silencioso: true, gmxhr: (o) => setTimeout(() => o.onload({ status: 200, responseText: respZai("Paciente MURILLO CAMARGO, documento 79.999.888, acude a control. FUENTES: hoja de hechos") }), 0) });
      c.api.mtrGuardarClaveZai("Z"); c.api.mtrGuardarClaveGemini("");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.cierto(r.ok && r.texto.indexOf("MURILLO CAMARGO") >= 0, "el canario viajó de verdad en el texto (si no, la prueba no mide nada)");
      const acc = accionesUX(c);
      t.cierto(Object.keys(acc).length > 0, "la generación produjo telemetría (evitar el verde vacío)");
      const malas = Object.keys(acc).filter((k) => /MURILLO|CAMARGO|79\.999|999888/i.test(k));
      t.igual(malas.length, 0, "ningún evento lleva nombre ni cédula: " + JSON.stringify(malas));
    });

    t.caso("P9·extra — la clave de z.ai vive en Ajustes y el dominio está declarado en @connect", () => {
      t.cierto(FUENTE.indexOf('id="c-zai-key"') >= 0, "campo de clave z.ai en Ajustes");
      t.cierto(FUENTE.indexOf("mtrGuardarClaveZai(v)") >= 0, "el cambio del campo guarda la clave");
      t.cierto(/@connect\s+api\.z\.ai/.test(FUENTE), "sin @connect, Tampermonkey bloquearía la petición");
      t.cierto((FUENTE.match(/mtrHayClaveIA\(\)/g) || []).length >= 4, "todos los gates de entrada (dock, inyectores, panel, Generar) preguntan por la clave de cualquiera de los dos proveedores");
    });

    t.caso("P9·extra·2 — guardar/leer la clave de z.ai y el gate combinado de claves", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrLeerClaveZai(), "", "sin clave guardada se lee cadena vacía, nunca null que rompa UI");
      t.cierto(!c.api.mtrHayClaveIA(), "sin ninguna clave, el gate combinado está cerrado");
      c.api.mtrGuardarClaveZai("zk-123");
      t.igual(c.api.mtrLeerClaveZai(), "zk-123", "la clave guardada se lee idéntica");
      t.cierto(c.api.mtrHayClaveIA(), "con solo la clave de z.ai el gate combinado ya abre");
      c.api.mtrGuardarClaveZai("");
      t.cierto(!c.api.mtrHayClaveIA(), "vaciar la clave de z.ai vuelve a cerrar el gate");
    });

  },
};
