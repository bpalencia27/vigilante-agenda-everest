"use strict";
// ══════════════════════════════════════════════════════════════════════
// Suite 99 — v18.8.0 · DeepSeek (deepseek-v4-flash) como PRIMARIO del
// redactor de IA, con z.ai de alternativo y Gemini de respaldo.
// La API oficial de DeepSeek (api.deepseek.com) es OpenAI-compatible:
//   POST /v1/chat/completions  { model, messages[{role:"system"}…,{role:"user"}],
//                                temperature, max_tokens } → choices[0].message.content
// A diferencia de z.ai (que exige UN solo turno con el system pegado al
// user), deepseek lee el system en su ROLE propio. La respuesta es la misma
// forma que ya parsea mtrRespuestaZai: se reutiliza como parseador.
// La suite 70 sigue protegiendo byte a byte a zai y gemini: esta suite NUNCA
// los toca, solo añade el tercer proveedor y la prioridad deepseek > zai > Gemini.
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

// Respuesta típica de deepseek (forma OpenAI — idéntica a la de z.ai).
const respDs = (texto, finish) => JSON.stringify({ choices: [{ message: { content: texto }, finish_reason: finish || "stop" }] });

function hojaDemo(api) {
  return api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F", diabetes: true, hta: true },
    erc: { egfr: 52, estadioClinico: "G3a" }, riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70 } } },
    { hoyIso: "2026-08-17", medicamentos: ["LOSARTAN 50 MG"], ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } } });
}

const accionesUX = (c) => {
  try { c.api._uxVolcarBuffer(); return (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {}; } catch (e) { return {}; }
};

module.exports = {
  nombre: "Suite 99 · v18.8.0: deepseek-v4-flash primario (z.ai alternativo, Gemini respaldo)",
  cubre: ["mtrProveedorIA", "mtrRespuestaZai", "mtrGeminiRedactar", "mtrGuardarClaveDeepseek", "mtrLeerClaveDeepseek", "mtrHayClaveIA", "mtrEsCuotaAgotada", "mtrEsModeloNoDisponible"],
  async pruebas(t, api, env, cargar) {

    t.caso("DS·1 — contrato del proveedor deepseek: URL, headers y cuerpo OpenAI con el system en ROLE propio", () => {
      const ds = api.mtrProveedorIA("deepseek");
      t.cierto(!!ds, "debe existir el proveedor deepseek");
      t.igual(JSON.stringify(ds.modelos), JSON.stringify(["deepseek-v4-flash"]), "el único modelo es deepseek-v4-flash (ID oficial de la API)");
      t.igual(ds.url(), "https://api.deepseek.com/v1/chat/completions", "endpoint OpenAI-compatible oficial");
      const cab = ds.headers("CLAVE-D");
      t.igual(cab["Authorization"], "Bearer CLAVE-D", "autorización Bearer, como exige la API");
      const cuerpo = JSON.parse(ds.cuerpo("deepseek-v4-flash", "SYS99", "USR99"));
      t.igual(JSON.stringify(Object.keys(cuerpo).sort()), JSON.stringify(["max_tokens", "messages", "model", "temperature"]), "mismas claves que la forma OpenAI");
      t.igual(cuerpo.model, "deepseek-v4-flash");
      t.igual(cuerpo.messages.length, 2, "DOS turnos: system y user por separado (a diferencia del único turno de z.ai)");
      t.igual(cuerpo.messages[0].role, "system", "el system viaja PRIMERO y con su role propio");
      t.igual(cuerpo.messages[0].content, "SYS99");
      t.igual(cuerpo.messages[1].role, "user");
      t.igual(cuerpo.messages[1].content, "USR99");
      t.igual(cuerpo.temperature, 0.2);
      t.igual(cuerpo.max_tokens, 8192);
      // Ancla literal byte-exacta (anti-tautología): si cambia una coma, es regresión.
      t.igual(ds.cuerpo("deepseek-v4-flash", "SYS99", "USR99"),
        '{"model":"deepseek-v4-flash","messages":[{"role":"system","content":"SYS99"},{"role":"user","content":"USR99"}],"temperature":0.2,"max_tokens":8192}');
      // Sin campos de razonamiento: el prompt de sistema ya ordena responder solo el texto final.
      t.cierto(!/thinking|reasoning/i.test(ds.cuerpo("deepseek-v4-flash", "S", "U")), "el cuerpo no lleva campos de razonamiento");
    });

    t.caso("DS·2 — parseo de la respuesta deepseek: reutiliza mtrRespuestaZai (misma forma OpenAI)", () => {
      const ds = api.mtrProveedorIA("deepseek");
      // El arnés envuelve las funciones del api para medir cobertura, así que la
      // identidad de referencia no es estable: se compara el COMPORTAMIENTO contra
      // el parseador de z.ai (misma salida, campo a campo) y el ancla en el fuente.
      const rDs = ds.parsear(respDs("Igual que zai."));
      const rZ = api.mtrRespuestaZai(respDs("Igual que zai."));
      t.cierto(!!rDs && rDs.ok === rZ.ok && rDs.texto === rZ.texto && rDs.finishReason === rZ.finishReason, "parsea exactamente igual que el de z.ai: choices[0].message.content");
      t.cierto(FUENTE.indexOf("parsear: (cruda) => mtrRespuestaZai(cruda)") >= 0, "en el fuente, el parseador de deepseek ES mtrRespuestaZai");
      const buena = ds.parsear(respDs("Borrador de DeepSeek sin cifras."));
      t.cierto(buena.ok, "respuesta 200 con stop es éxito");
      t.igual(buena.texto, "Borrador de DeepSeek sin cifras.", "el texto sale limpio");
      t.igual(buena.finishReason, "STOP", "finish_reason stop mapea a STOP interno");
      const cortada = ds.parsear(respDs("Se acabó el espacio", "length"));
      t.igual(cortada.finishReason, "MAX_TOKENS", "length mapea a MAX_TOKENS (aviso de borrador cortado)");
      const bloqueada = ds.parsear(respDs("No puedo responder", "content_filter"));
      t.cierto(bloqueada.ok && bloqueada.texto === "No puedo responder" && bloqueada.finishReason === "SAFETY", "content_filter CON texto = éxito marcado SAFETY (el médico decide, como en z.ai)");
      const bloqueadaSeca = ds.parsear(respDs("", "content_filter"));
      t.cierto(String(bloqueadaSeca.motivo).indexOf("bloqueado por el modelo") === 0, "content_filter SIN texto = bloqueado (mismo texto interno que z.ai/Gemini)");
      t.igual(ds.parsear("{}").motivo, api.mtrRespuestaZai("{}").motivo, "respuesta vacía = mismo motivo interno");
      const error = ds.parsear('{"error":{"code":500,"message":"server error"}}');
      t.cierto(!error.ok && error.motivo, "respuesta de error da no-ok con motivo, nunca texto inventado");
    });

    t.caso("DS·3 — clave deepseek: guardar/leer ofuscada (nunca en claro) y el gate combinado", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrLeerClaveDeepseek(), "", "sin clave guardada se lee cadena vacía, nunca null que rompa UI");
      t.cierto(!c.api.mtrHayClaveIA(), "sin ninguna clave, el gate combinado está cerrado");
      c.api.mtrGuardarClaveDeepseek("dsk-456");
      t.igual(c.api.mtrLeerClaveDeepseek(), "dsk-456", "la clave guardada se lee idéntica");
      t.cierto(String(c.env.storage.getItem("vgl_deepseek_key")).indexOf("dsk-456") < 0, "en el almacén la clave NO está en claro (ofuscada)");
      t.cierto(c.api.mtrHayClaveIA(), "con SOLO la clave de deepseek el gate combinado ya abre");
      c.api.mtrGuardarClaveDeepseek("");
      t.igual(c.api.mtrLeerClaveDeepseek(), "", "vaciar la clave la borra de verdad");
      // Regresión: con solo z.ai el gate sigue abriendo (comportamiento de siempre).
      c.api.mtrGuardarClaveZai("zk-123");
      t.cierto(c.api.mtrHayClaveIA(), "con solo la clave de z.ai el gate sigue abierto");
      c.api.mtrGuardarClaveZai("");
      t.cierto(!c.api.mtrHayClaveIA(), "sin claves el gate vuelve a cerrarse");
    });

    await t.casoAsync("DS·4a — con clave deepseek, la escalera llama SOLO a deepseek y queda registrado quién respondió", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => {
          if (o.url.indexOf("api.deepseek.com") >= 0) o.onload({ status: 200, responseText: respDs("Borrador de DeepSeek sin cifras.") });
          else o.onload({ status: 500, responseText: "{}" });   // nadie más debería recibir nada
        }, 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D"); c.api.mtrGuardarClaveZai("Z"); c.api.mtrGuardarClaveGemini("G");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 1, "exactamente UN disparo: deepseek responde a la primera");
      t.cierto(urls[0].indexOf("api.deepseek.com") >= 0, "el disparo fue a la API de DeepSeek");
      t.cierto(r.ok && r.texto === "Borrador de DeepSeek sin cifras.", "el borrador de deepseek llega íntegro");
      t.igual(r.finishReason, "STOP");
      const acc = accionesUX(c);
      t.igual(acc["ia.prov.deepseek"], 1, "queda registrado que respondió deepseek");
      t.cierto(acc["ia.prov.zai"] === undefined && acc["ia.prov.gemini"] === undefined, "ni z.ai ni gemini recibieron nada");
    });

    await t.casoAsync("DS·4b — agotada la cuota de deepseek (429), gemini entra UNA vez como respaldo", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => {
          if (o.url.indexOf("api.deepseek.com") >= 0) o.onload({ status: 429, responseText: '{"error":{"code":429,"message":"rate limit"}}' });
          else o.onload({ status: 200, responseText: JSON.stringify({ candidates: [{ content: { parts: [{ text: "Borrador de respaldo sin cifras." }] }, finishReason: "STOP" }] }) });
        }, 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D"); c.api.mtrGuardarClaveGemini("G");
      t.cierto(api.mtrEsCuotaAgotada(429, '{"error":{"code":429,"message":"rate limit"}}'), "429 de deepseek es cuota → merece rotar");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 2, "exactamente dos disparos: deepseek y UN respaldo");
      t.cierto(urls[0].indexOf("api.deepseek.com") >= 0, "el primero es deepseek");
      t.cierto(urls[1].indexOf("generativelanguage.googleapis.com") >= 0, "el segundo es gemini");
      t.cierto(r.ok && r.texto === "Borrador de respaldo sin cifras.");
      const acc = accionesUX(c);
      t.igual(acc["ia.prov.gemini"], 1, "queda registrado que respondió gemini");
      t.cierto(acc["ia.prov.deepseek"] === undefined, "deepseek no respondió: no se registra");
      t.igual(acc["ia.cuota.rota"], 1, "la rotación por cuota quedó medida");
      t.igual(acc["ia.ok"], 1);
    });

    await t.casoAsync("DS·4c — modelo deepseek no disponible (400) también rota a gemini", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => {
          if (o.url.indexOf("api.deepseek.com") >= 0) o.onload({ status: 400, responseText: '{"error":{"code":400,"message":"bad request"}}' });
          else o.onload({ status: 200, responseText: JSON.stringify({ candidates: [{ content: { parts: [{ text: "Respaldo." }] }, finishReason: "STOP" }] }) });
        }, 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D"); c.api.mtrGuardarClaveGemini("G");
      t.cierto(api.mtrEsModeloNoDisponible(400, '{"error":{"code":400,"message":"bad request"}}'), "400 de deepseek es no disponible → merece rotar");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 2, "400 de deepseek merece rotar (no falla en seco)");
      t.cierto(r.ok && r.texto === "Respaldo.");
    });

    await t.casoAsync("DS·4d — timeout de deepseek: mismo motivo interno que el de cualquier proveedor", async () => {
      const c = cargar({ silencioso: true, gmxhr: (o) => setTimeout(() => o.ontimeout(), 0) });
      c.api.mtrGuardarClaveDeepseek("D");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.cierto(!r.ok, "el timeout falla");
      t.cierto(String(r.motivo).indexOf("tiempo agotado") === 0, "el motivo interno del timeout es único entre proveedores");
    });

    await t.casoAsync("DS·4e — SIN clave deepseek, z.ai conserva su puesto de primario (prioridad deepseek > z.ai > Gemini)", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => {
          if (o.url.indexOf("api.z.ai") >= 0) o.onload({ status: 200, responseText: respDs("Borrador de GLM sin cifras.") });
          else o.onload({ status: 500, responseText: "{}" });
        }, 0);
      } });
      c.api.mtrGuardarClaveZai("Z"); c.api.mtrGuardarClaveGemini("G");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 1, "sin deepseek, z.ai responde a la primera y nadie más recibe nada");
      t.cierto(urls[0].indexOf("api.z.ai") >= 0, "el disparo fue a z.ai");
      t.cierto(r.ok && r.texto === "Borrador de GLM sin cifras.");
      const acc = accionesUX(c);
      t.igual(acc["ia.prov.zai"], 1, "queda registrado que respondió z.ai");
      t.cierto(acc["ia.prov.deepseek"] === undefined, "deepseek ni se asoma sin su clave");
    });

    t.caso("DS·5 — textos y piezas de UI de deepseek en el fuente (Ajustes, T-16, pie del modal, modelo inicial)", () => {
      t.cierto(/@connect\s+api\.deepseek\.com/.test(FUENTE), "sin @connect, Tampermonkey bloquearía la petición a DeepSeek");
      t.cierto(FUENTE.indexOf('id="c-deepseek-key"') >= 0, "campo de clave deepseek en Ajustes");
      t.cierto(FUENTE.indexOf("mtrGuardarClaveDeepseek(v)") >= 0, "el cambio del campo guarda la clave deepseek");
      t.cierto(FUENTE.indexOf("Clave de la IA (DeepSeek — principal)") >= 0, "el rótulo dice que deepseek es el principal");
      t.cierto(FUENTE.indexOf("z.ai — alternativo") >= 0, "z.ai pasa a rótulo de alternativo");
      t.cierto(FUENTE.indexOf("deepseek (deepseek-v4-flash)") >= 0 || FUENTE.indexOf("DeepSeek") >= 0, "el consentimiento T-16 menciona a DeepSeek");
      t.cierto(FUENTE.indexOf("DeepSeek, z.ai o Gemini, según la clave configurada") >= 0, "el pie del modal nombra a los tres proveedores");
      t.cierto(FUENTE.indexOf('mtrLeerClaveDeepseek() ? "deepseek-v4-flash"') >= 0, "el modelo inicial del título es deepseek-v4-flash si hay su clave");
      t.cierto(FUENTE.indexOf("if (claveDs && n === 0)") >= 0, "la escalera da el intento 0 a deepseek cuando hay su clave");
      t.cierto(FUENTE.indexOf("prioridad deepseek > z.ai > Gemini") >= 0, "la prioridad queda documentada en el comentario");
    });

    t.caso("DS·6 — el contrato de zai y gemini queda INTACTO (no-regresión cruzada con suite 70)", () => {
      const zai = api.mtrProveedorIA("zai");
      t.cierto(!!zai && zai.url("glm-5.3") === "https://api.z.ai/api/paas/v4/chat/completions", "z.ai sigue en su endpoint");
      t.igual(JSON.parse(zai.cuerpo("glm-5.3", "S", "U")).messages.length, 1, "z.ai sigue exigiendo UN solo turno (system pegado)");
      const gem = api.mtrProveedorIA("gemini");
      t.cierto(!!gem, "gemini sigue presente como respaldo");
      t.cierto(FUENTE.indexOf("const MTR_ZAI_KEY = \"vgl_zai_key\";") >= 0 && FUENTE.indexOf("const MTR_DEEPSEEK_KEY = \"vgl_deepseek_key\";") >= 0, "las llaves de almacenamiento de las claves son distintas");
    });

  },
};
