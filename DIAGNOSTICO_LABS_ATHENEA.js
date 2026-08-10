// =====================================================================
//  DIAGNÓSTICO PUENTE DE LABORATORIOS ATHENEA — v1 (2026-08-10)
//
//  Para qué: ver CÓMO el portal de Athenea incrusta el idSolicitud y la
//  cédula del paciente en la página DatosPaciente, para poder raspar el
//  idSolicitud sin el puente localhost:5050 (que no existe) y verificar
//  identidad antes de traer laboratorios.
//
//  Dónde: en la pestaña del PORTAL ATHENEA
//  (medicosviva1a.atheneasoluciones.com/Resultados/DatosPaciente), con la
//  página de resultados de un paciente ABIERTA. F12 -> Consola -> pegar
//  todo -> Enter. Copia el informe y pégalo de vuelta.
//
//  SOLO LECTURA. No vuelca resultados: de la cédula solo muestra los
//  últimos 3 dígitos; del HTML solo fragmentos alrededor de "idSolicitud".
// =====================================================================
(async function () {
  const out = [];
  const w = (s) => out.push(s);
  const mask = (c) => { const s = String(c || "").replace(/\D/g, ""); return s ? "…" + s.slice(-3) + " (" + s.length + " díg)" : "(vacío)"; };

  w("======= DIAGNÓSTICO LABS ATHENEA · " + location.href + " =======");

  const html = document.documentElement.innerHTML;

  // ---------- 1. ¿Dónde aparece idSolicitud en el DOM vivo? ----------
  w("\n--- 1. idSolicitud EN EL DOM ACTUAL ---");
  try {
    const ids = new Set();
    // a) atributos data-*
    document.querySelectorAll("*").forEach((el) => {
      for (const a of el.attributes || []) {
        if (/solicitud|idsol/i.test(a.name) && /\d{4,}/.test(a.value)) {
          ids.add(a.value.trim());
          if (out.filter((x) => x.startsWith("   attr")).length < 6) w("   attr " + el.tagName.toLowerCase() + "[" + a.name + "]=" + a.value.trim());
        }
      }
    });
    // b) cualquier "idSolicitud": N / idSolicitud=N / (N) en el HTML crudo
    const re = /idSolicitud["'\s:=\(]+(\d{4,})/gi;
    let m; let ctxShown = 0;
    while ((m = re.exec(html))) {
      ids.add(m[1]);
      if (ctxShown < 5) { w("   ctx …" + html.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, " ") + "…"); ctxShown++; }
    }
    w("idSolicitud únicos hallados en HTML: " + (ids.size ? [...ids].join(", ") : "(NINGUNO — quizá se cargan por JS tras un XHR)"));
  } catch (e) { w("ERROR idSolicitud DOM: " + e.message); }

  // ---------- 2. ¿Dónde aparece la cédula (para verificar identidad)? ----------
  w("\n--- 2. CÉDULA DEL PACIENTE EN LA PÁGINA ---");
  try {
    const txt = document.body.innerText || "";
    const ccVis = (txt.match(/\bCC\s*([\d.]{6,})/i) || [])[1] || (txt.match(/\b(\d{6,12})\b/) || [])[1];
    w("cédula visible en el texto: " + mask(ccVis));
    // ¿en un data-attr o input?
    const inp = document.querySelector('[id*="cedula" i],[name*="cedula" i],[id*="documento" i],[name*="documento" i]');
    if (inp) w("input de documento: <" + inp.tagName.toLowerCase() + " " + (inp.id ? "#" + inp.id : inp.name) + "> valor=" + mask(inp.value));
    // ¿en el HTML crudo cerca de "documento"/"identificacion"?
    const cm = /(?:documento|identificacion|cedula)["'\s:=>]+(\d{6,12})/i.exec(html);
    if (cm) w("crudo (documento/identificacion): " + mask(cm[1]));
  } catch (e) { w("ERROR cédula: " + e.message); }

  // ---------- 3. ¿Un GET simple de DatosPaciente trae ya el idSolicitud? ----------
  //  Esto decide si el userscript puede pedir la página con GM_xmlhttpRequest
  //  (misma sesión) y raspar, o si el idSolicitud solo llega por un XHR aparte.
  w("\n--- 3. GET /Resultados/DatosPaciente (misma sesión) ---");
  try {
    const r = await fetch("/Resultados/DatosPaciente", { headers: { Accept: "text/html" }, credentials: "include" });
    w("status: " + r.status + " · content-type: " + (r.headers.get("content-type") || "?"));
    const body = await r.text();
    w("longitud HTML: " + body.length);
    const ids2 = new Set();
    let m2; const re2 = /idSolicitud["'\s:=\(]+(\d{4,})/gi;
    while ((m2 = re2.exec(body))) ids2.add(m2[1]);
    // también atributos data-*solicitud en el HTML servido
    let m3; const re3 = /data-[a-z-]*solicitud[a-z-]*="(\d{4,})"/gi;
    while ((m3 = re3.exec(body))) ids2.add(m3[1]);
    w("idSolicitud en el HTML servido por GET: " + (ids2.size ? [...ids2].join(", ") : "(NINGUNO — el GET no trae el paciente de sesión, o llegan por JS)"));
    const cc2 = (body.match(/(?:documento|identificacion|cedula|>CC\s*)["'\s:=>]+(\d{6,12})/i) || [])[1];
    w("cédula en el HTML servido: " + mask(cc2));
    // ¿pide login? (por si el GET redirige a autenticación)
    w("¿parece pantalla de login?: " + (/name=["']?(usuario|password|clave)/i.test(body) || /iniciar sesi/i.test(body) ? "SÍ (ojo: el GET no conserva la sesión)" : "no"));
  } catch (e) { w("ERROR GET DatosPaciente: " + e.message); }

  // ---------- 4. Endpoints candidatos en el HTML (rutas /Resultados/...) ----------
  w("\n--- 4. RUTAS /Resultados/ REFERIDAS EN LA PÁGINA ---");
  try {
    const rutas = new Set();
    let m4; const re4 = /\/Resultados\/[A-Za-z0-9_]+/g;
    while ((m4 = re4.exec(html))) rutas.add(m4[0]);
    w([...rutas].join("\n") || "(ninguna)");
  } catch (e) { w("ERROR rutas: " + e.message); }

  w("\n======= FIN =======");
  const informe = out.join("\n");
  console.log(informe);
  try { copy(informe); console.log("%c(informe copiado al portapapeles)", "color:#4a4"); } catch (e) { console.log("(seleccione y copie el texto de arriba)"); }
})();
