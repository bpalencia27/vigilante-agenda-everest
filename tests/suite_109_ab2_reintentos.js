// ══════════════════════════════════════════════════════════════════════
// Suite 109 — AB-2 (informe A/B): REINTENTO TRANSITORIO del MISMO slot en
// mtrGeminiRedactar. Cuando la escalera se rinde (timeout del ÚLTIMO
// eslabón o error de red del enlace), una bala por tipo re-dispara el
// mismo proveedor/modelo con backoff exponencial + jitter antes del fallo
// definitivo: el blip pasajero (proxy de la IPS, 25 s justos) deja de
// obligar al médico a pulsar Generar otra vez.
// Garantías bajo prueba: el reintento va al MISMO slot (misma URL) y NO
// consume intentos de la escalera (el «intento X de Y» repite su X); la
// bala de timeout solo se gasta en el último eslabón (los intermedios
// siguen rotando como siempre); red caída de verdad = bala única y fallo
// honesto; cancelar durante el backoff aborta el reintento; la latencia
// real de la primera respuesta útil viaja como ia.primera.ms (convenio
// RUM: la clave cuenta generaciones, .total suma ms).
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const USERJS = path.join(__dirname, "..", "vigilante_agenda.user.js");

// Respuesta típica de deepseek (forma OpenAI — idéntica a la de z.ai).
const respDs = (texto) => JSON.stringify({ choices: [{ message: { content: texto } }, { finish_reason: "stop" }] });
// Respuesta típica de Gemini (forma nativa: candidates[].content.parts[].text).
const respGem = (texto) => JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] }, finishReason: "STOP" }] });

function hojaDemo(api) {
  return api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F", diabetes: true, hta: true },
    erc: { egfr: 52, estadioClinico: "G3a" }, riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70 } } },
    { hoyIso: "2026-08-17", medicamentos: ["LOSARTAN 50 MG"], ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } } });
}

const accionesUX = (c) => {
  try { c.api._uxVolcarBuffer(); return (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {}; } catch (e) { return {}; }
};

module.exports = {
  nombre: "AB-2: reintento transitorio del mismo slot en la redacción IA (informe A/B)",
  cubre: ["mtrGeminiRedactar"],

  async pruebas(t, api, env, cargar) {
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

    // ===== red que falla UNA vez por red y luego responde: la bala re-dispara el MISMO slot =====
    await t.casoAsync("blip de red: el error de red reintenta UNA vez el mismo slot y la generación sale", async () => {
      const urls = [], progresos = [];
      let fallosRed = 1;
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => {
          if (fallosRed > 0) { fallosRed--; o.onerror(); }
          else o.onload({ status: 200, responseText: respDs("Borrador tras el blip de red.") });
        }, 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", { onProgreso: (pg) => progresos.push(pg) });
      t.igual(urls.length, 2, "dos disparos: el fallo de red y su reintento");
      t.cierto(urls[0].indexOf("api.deepseek.com") >= 0 && urls[1].indexOf("api.deepseek.com") >= 0,
        "el reintento fue al MISMO slot (misma URL, mismo proveedor): la red no distingue modelos");
      t.cierto(r.ok && r.texto === "Borrador tras el blip de red.", "el blip pasajero ya no mata la generación");
      const acc = accionesUX(c);
      t.igual(acc["ia.red.reintenta"], 1, "el reintento transitorio quedó medido");
      t.igual(acc["ia.fallo.red"], 1, "el fallo que lo provocó, también");
      t.igual(acc["ia.ok"], 1, "y el éxito final");
      t.igual(progresos.length, 2, "el reintento pasa por onProgreso otra vez…");
      t.igual(progresos[0].intento, 1, "…repitiendo el MISMO «intento X de Y» (insistencia, no avance)…");
      t.igual(progresos[1].intento, 1, "…y el X no avanzó: la bala NO consume la escalera (de sigue en 1)");
      t.igual(progresos[1].de, 1, "y Y (maxIntentos) tampoco cambió");
    });

    // ===== red caída de verdad: la bala es ÚNICA y el fallo final es el honesto de siempre =====
    await t.casoAsync("red caída: una sola bala; si persiste, el fallo de red honesto y sin disparos infinitos", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => o.onerror(), 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 2, "el error de red reintenta una única vez: sin red, no hay ráfaga");
      t.cierto(!r.ok && String(r.motivo).indexOf("error de red") === 0, "y el motivo final es el de siempre (proxy de la IPS)");
      const acc = accionesUX(c);
      t.igual(acc["ia.fallo.red"], 2, "los dos fallos de red quedan contados");
      t.igual(acc["ia.red.reintenta"], 1, "la bala se gastó una sola vez");
      t.cierto(acc["ia.primera.ms"] === undefined, "sin respuesta útil jamás se emite ia.primera.ms (cero inferencias)");
    });

    // ===== timeout del ÚLTIMO eslabón (maxIntentos=1): bala de timeout antes de rendirse =====
    await t.casoAsync("timeout del último eslabón: la bala lo re-dispara una vez antes del «tiempo agotado»", async () => {
      const urls = [], progresos = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => o.ontimeout(), 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D");   // sin gemini → maxIntentos = 1: el único eslabón es el último
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", { onProgreso: (pg) => progresos.push(pg) });
      t.igual(urls.length, 2, "dos disparos al mismo slot: el timeout agotado y su bala");
      t.cierto(urls[0].indexOf("api.deepseek.com") >= 0 && urls[1].indexOf("api.deepseek.com") >= 0, "ambos al MISMO slot");
      t.cierto(!r.ok && String(r.motivo).indexOf("tiempo agotado") === 0, "el motivo final sigue siendo el honesto de siempre");
      const acc = accionesUX(c);
      t.igual(acc["ia.timeout.reintenta"], 1, "la bala de timeout quedó medida");
      t.igual(acc["ia.fallo.timeout"], 2, "los dos timeouts contados");
      t.cierto(acc["ia.timeout.rota"] === undefined, "no hubo rotación: no había a dónde rotar");
      t.igual(progresos[1].intento, 1, "y el reintento repitió «1 de 1» — la escalera no avanzó a un «2» imposible");
    });

    // ===== timeout de un eslabón INTERMEDIO: rota como siempre, la bala NO se gasta =====
    await t.casoAsync("timeout de un eslabón intermedio: sigue rotando al respaldo (la bala solo es del último)", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => {
          if (o.url.indexOf("api.deepseek.com") >= 0) o.ontimeout();
          else o.onload({ status: 200, responseText: respGem("Respaldo que responde.") });   // el respaldo es Gemini: su forma nativa
        }, 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D"); c.api.mtrGuardarClaveGemini("G");   // maxIntentos = 2
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 2, "timeout del eslabón 0 → rota: deepseek y UN respaldo");
      t.cierto(urls[0].indexOf("api.deepseek.com") >= 0 && urls[1].indexOf("generativelanguage.googleapis.com") >= 0,
        "el segundo disparo fue al SIGUIENTE eslabón (gemini), no un reintento de deepseek");
      t.cierto(r.ok, "responde el respaldo");
      const acc = accionesUX(c);
      t.igual(acc["ia.timeout.rota"], 1, "la rotación de siempre quedó medida");
      t.cierto(acc["ia.timeout.reintenta"] === undefined, "la bala de timeout NO se gastó en un eslabón que aún podía rotar");
    });

    // ===== timeouts en TODOS los eslabones: rota, y solo el último gasta su bala =====
    await t.casoAsync("toda la escalera agotada: rota entre eslabones y la bala solo re-dispara al último", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => o.ontimeout(), 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D"); c.api.mtrGuardarClaveGemini("G");   // maxIntentos = 2
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 3, "deepseek (rota), gemini (último) y gemini otra vez (su bala)");
      t.cierto(urls[0].indexOf("api.deepseek.com") >= 0 && urls[1].indexOf("generativelanguage") >= 0 && urls[2].indexOf("generativelanguage") >= 0,
        "el orden fue eslabón 0 → rotación al 1 → bala sobre el mismo eslabón 1");
      t.cierto(!r.ok && String(r.motivo).indexOf("tiempo agotado") === 0, "agotadas las dos balas, el fallo final es el de siempre");
      const acc = accionesUX(c);
      t.igual(acc["ia.timeout.rota"], 1, "una rotación");
      t.igual(acc["ia.timeout.reintenta"], 1, "y una sola bala: el último eslabón no se re-dispara en cadena");
      t.igual(acc["ia.fallo.timeout"], 3, "los tres timeouts contados");
    });

    // ===== cancelación DURANTE el backoff: el reintento despierta y se retira =====
    await t.casoAsync("cancelar durante la espera del backoff: el reintento NO dispara", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        o.onerror();   // síncrono: deja la bala agendada y vuelve el control a la prueba
      } });
      c.api.mtrGuardarClaveDeepseek("D");
      const control = { cancelado: false };
      const p = c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", { control: control });
      t.cierto(typeof control.cancelar === "function", "el control del llamador quedó armado");
      control.cancelar();   // el médico cancela mientras el reintento espera su backoff
      const r = await p;
      t.igual(urls.length, 1, "el reintento despertó con cancelado=true y se retiró sin disparar");
      t.cierto(!r.ok && r.motivo === "cancelado", "la promesa se resolvió por la cancelación, no por un disparo fantasma");
      const acc = accionesUX(c);
      t.igual(acc["ia.cancelado"], 1, "la cancelación quedó medida");
      await esperar(20);   // margen: si el re-check faltara, el disparo 2 aparecería aquí
      t.igual(urls.length, 1, "y sigue sin haber disparo aunque los timers del backoff ya corrieron");
    });

    // ===== camino feliz intacto: sin fallo transitorio no hay bala ni medición de más =====
    await t.casoAsync("sin fallos transitorios: un solo disparo y la latencia real queda como ia.primera.ms", async () => {
      const urls = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => {
        urls.push(o.url);
        setTimeout(() => o.onload({ status: 200, responseText: respDs("Borrador limpio a la primera.") }), 0);
      } });
      c.api.mtrGuardarClaveDeepseek("D"); c.api.mtrGuardarClaveGemini("G");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "motivo_consulta", {});
      t.igual(urls.length, 1, "la respuesta a la primera sigue siendo UN solo disparo");
      t.cierto(r.ok && r.texto === "Borrador limpio a la primera.", "el borrador llega íntegro");
      const acc = accionesUX(c);
      t.igual(acc["ia.primera.ms"], 1, "la clave cuenta la generación respondida");
      t.cierto(typeof acc["ia.primera.ms.total"] === "number" && acc["ia.primera.ms.total"] >= 0,
        "y .total lleva los ms reales hasta esa primera respuesta (media = total/conteo)");
      t.cierto(acc["ia.red.reintenta"] === undefined && acc["ia.timeout.reintenta"] === undefined,
        "sin blips no hay balas: cero ruido nuevo en el camino feliz");
    });

    // ===== verificación estructural: el enganche real en el código vivo =====
    t.caso("estructura: las balas AB-2 viven junto a la escalera y el reintento no toca maxIntentos", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      t.cierto(s.indexOf("let ab2Paso = 0;") >= 0, "el contador del backoff existe");
      t.cierto(s.indexOf("let ab2BalaRed = true;") >= 0, "la bala de red existe y nace disponible");
      t.cierto(s.indexOf("let ab2BalaTimeout = true;") >= 0, "la bala de timeout existe y nace disponible");
      t.cierto(s.indexOf("const ab2Reintentar = (tipo) => {") >= 0, "el helper de reintento está declarado");
      t.cierto(s.indexOf("Math.min(2400, 600 * Math.pow(2, ab2Paso++))") >= 0,
        "el backoff es exponencial acotado (600·2ⁿ, tope 2400) más jitter, patrón VK-01 de SYNAPSE");
      t.cierto(s.indexOf('if (o.control && o.control.cancelado) return;') > s.indexOf("const ab2Reintentar"),
        "el re-check de cancelación corre DENTRO del helper, al despertar de la espera");
      t.cierto(s.indexOf('_tel("ia." + tipo + ".reintenta")') >= 0, "la telemetría del reintento distingue su tipo");
      t.cierto(s.indexOf('«intento X de Y» repite su X') >= 0, "el comentario documenta que la bala no avanza la escalera");
    });

    t.caso("estructura: la bala de timeout va DESPUÉS de la rotación y ANTES del fallo final; la de red, en su handler", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      const iRotacion = s.indexOf('_tel("ia.timeout.rota")');
      const iBalaT = s.indexOf('ab2BalaTimeout) { ab2BalaTimeout = false; ab2Reintentar("timeout")');
      const iFalloT = s.indexOf('motivo: "tiempo agotado en todos los proveedores configurados"');
      t.cierto(iRotacion >= 0 && iBalaT > iRotacion && iFalloT > iBalaT,
        "el orden dentro de ontimeout es: rotar si hay eslabones → bala del último → fallo honesto");
      const iRed = s.indexOf('ab2BalaRed) { ab2BalaRed = false; ab2Reintentar("red")');
      const iFalloRed = s.indexOf('motivo: "error de red (¿proxy de la IPS bloquea Gemini?)"');
      t.cierto(iRed >= 0 && iFalloRed > iRed, "en onerror: bala de red antes del fallo honesto");
      t.cierto(s.indexOf('_tel("ia.timeout.rota")') < s.indexOf("resolve({ ok: false, texto: \"\", motivo: \"tiempo agotado"),
        "el patrón histórico de rotación del timeout quedó intacto");
    });

    t.caso("estructura: la latencia de primera respuesta se emite solo en el éxito, medida desde _t0", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      const iOk = s.indexOf('_tel("ia.ok")');
      const iMs = s.indexOf('uxTrack("ia.primera.ms", { n: Date.now() - _t0 })');
      t.cierto(iMs > iOk && iMs < s.indexOf('resolve(r);', iOk), "ia.primera.ms se emite en la rama r.ok (antes del resolve del éxito)");
      const iFallo = s.indexOf("else { _tel(\"ia.fallo\")");
      t.cierto(iMs >= 0 && (iFallo < 0 || iMs < iFallo), "nunca en la rama de fallo: cero mediciones de una respuesta que no llegó");
    });
  },
};
