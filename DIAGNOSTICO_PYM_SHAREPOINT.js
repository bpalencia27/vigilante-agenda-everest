// =====================================================================
//  DIAGNÓSTICO — ¿POR QUÉ NO LLEGA EL PyM DE HOY? — v1 (2026-08-25)
//
//  Para qué: el script dejó de traer el Agenda_Dia_CMB de SharePoint y
//  todos los pacientes salen sin actividades de PyM. La lógica que ELIGE
//  el archivo ya se probó contra el nombre real y funciona, así que el
//  fallo está en uno de los cuatro pasos previos. Esto los prueba UNO POR
//  UNO y dice cuál falla y con qué código exacto.
//
//  Dónde: en la pestaña de EVEREST (la misma donde corre el Vigilante),
//  NO en la de SharePoint. F12 → Consola → pegar todo → Enter. Tarda unos
//  segundos (hace las mismas llamadas que el script, sin descargar los
//  14 MB completos).
//
//  SOLO LECTURA: no escribe nada en Everest ni en SharePoint, no cambia
//  ninguna configuración. De la respuesta solo mira códigos, tamaños y
//  nombres de archivo — jamás contenido de pacientes.
// =====================================================================
(async function () {
  const out = [];
  const w = (s) => { out.push(s); };
  const HOST = "viva1aips-my.sharepoint.com";
  const WEB = "/personal/director_bello_viva1a_com_co";
  const CARPETA = "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM";
  const SHARE = "https://viva1aips-my.sharepoint.com/:f:/g/personal/director_bello_viva1a_com_co/IgCsGP_chaHvTKYH9v-QZ2Q1AQuJo3umR5gDLjKlkUqgPS4?e=jscdBl";
  const base = "https://" + HOST + WEB;
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const HOY = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  const HOYC = HOY.replace(/-/g, "");

  w("======= DIAGNÓSTICO PyM / SHAREPOINT · " + new Date().toISOString() + " =======");
  w("Hoy (fecha local del equipo): " + HOY + "   ·   token esperado en el nombre: " + HOYC);
  w("Página actual: " + location.origin + location.pathname);

  // ---------- 0. ¿Tenemos el permiso de red del gestor de userscripts? ----------
  const gm = (typeof GM_xmlhttpRequest !== "undefined") ? GM_xmlhttpRequest
    : (typeof window.GM_xmlhttpRequest !== "undefined") ? window.GM_xmlhttpRequest : null;
  w("\n--- 0. PERMISO DE RED (GM_xmlhttpRequest) ---");
  if (!gm) {
    w("✗ NO disponible desde la consola.");
    w("  OJO: esto es NORMAL — Tampermonkey no expone GM_xmlhttpRequest a la consola de la página.");
    w("  El diagnóstico seguirá con fetch(), que usa las MISMAS cookies de sesión: si SharePoint");
    w("  responde bien aquí, el problema no es la sesión; si responde 401/403, sí lo es.");
  } else {
    w("✓ disponible");
  }

  const pedir = (url, tipo) => new Promise((resolve) => {
    const t0 = Date.now();
    if (gm) {
      try {
        gm({
          method: "GET", url: url, responseType: tipo || "", timeout: 20000,
          headers: tipo === "json" ? { Accept: "application/json;odata=nometadata" } : {},
          onload: (r) => resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, cuerpo: r.responseText, resp: r.response, ms: Date.now() - t0, via: "GM" }),
          onerror: () => resolve({ ok: false, status: 0, err: "error de red/permiso", ms: Date.now() - t0, via: "GM" }),
          ontimeout: () => resolve({ ok: false, status: 0, err: "tiempo agotado (20 s)", ms: Date.now() - t0, via: "GM" }),
        });
        return;
      } catch (e) { /* cae a fetch */ }
    }
    fetch(url, { credentials: "include", headers: tipo === "json" ? { Accept: "application/json;odata=nometadata" } : {} })
      .then(async (r) => resolve({ ok: r.ok, status: r.status, cuerpo: await r.text().catch(() => ""), ms: Date.now() - t0, via: "fetch" }))
      .catch((e) => resolve({ ok: false, status: 0, err: String((e && e.message) || e), ms: Date.now() - t0, via: "fetch" }));
  });

  // ---------- 1. El enlace compartido (lo que renueva la cookie de acceso) ----------
  w("\n--- 1. ENLACE COMPARTIDO (primeShareAccess) ---");
  const r1 = await pedir(SHARE, "");
  w("estado: " + r1.status + " · " + r1.ms + " ms · vía " + r1.via + (r1.err ? " · " + r1.err : ""));
  if (r1.status === 0) w("  → sin respuesta: proxy de la IPS, red caída, o el dominio no está permitido.");
  if (r1.status === 403 || r1.status === 401) w("  → ACCESO DENEGADO: el enlace de 'Compartir' pudo haber caducado o lo revocaron. HAY QUE GENERAR UNO NUEVO.");
  if (r1.ok) w("  → el enlace responde; la cookie de acceso debería estar renovada.");

  // ---------- 2. Listar la carpeta principal ----------
  w("\n--- 2. LISTAR LA CARPETA DEL PyM ---");
  const urlLista = base + "/_api/web/GetFolderByServerRelativeUrl('" + encodeURI(CARPETA)
    + "')/Files?$select=Name,ServerRelativeUrl,TimeLastModified&$orderby=TimeLastModified%20desc&$top=60";
  const r2 = await pedir(urlLista, "json");
  w("estado: " + r2.status + " · " + r2.ms + " ms · vía " + r2.via + (r2.err ? " · " + r2.err : ""));
  let filas = [];
  if (r2.ok) {
    try {
      const j = r2.resp && typeof r2.resp === "object" ? r2.resp : JSON.parse(r2.cuerpo || "{}");
      filas = (j && (j.value || (j.d && j.d.results))) || [];
    } catch (e) { w("  ✗ la respuesta NO es el JSON esperado: " + e.message); }
    w("archivos que ve el script en esa carpeta: " + filas.length);
    filas.slice(0, 25).forEach((f) => {
      const nom = String(f.Name || "");
      const esHoy = nom.replace(/[.\s_\-\/]/g, "").toLowerCase().indexOf(HOYC) >= 0;
      w("   " + (esHoy ? "★ " : "  ") + nom + "   (modificado: " + String(f.TimeLastModified || "?").slice(0, 16) + ")");
    });
    const candidato = filas.find((f) => String(f.Name || "").replace(/[.\s_\-\/]/g, "").toLowerCase().indexOf(HOYC) >= 0
      && /\.(xlsx|xlsm|csv)$/i.test(f.Name || "") && !/^~\$/.test(f.Name || ""));
    w(candidato
      ? "\n✓ ARCHIVO DE HOY DETECTADO: " + candidato.Name
      : "\n✗ NINGÚN archivo de esta carpeta lleva el token " + HOYC + " en el nombre (o no es .xlsx/.xlsm/.csv).");
    if (candidato) {
      // ---------- 3. ¿Se puede DESCARGAR? (solo los primeros bytes) ----------
      w("\n--- 3. DESCARGA DEL ARCHIVO DE HOY (solo se miran los primeros bytes) ---");
      const urlDown = base + "/_api/web/GetFileByServerRelativeUrl('" + encodeURI(candidato.ServerRelativeUrl) + "')/$value";
      const r3 = await pedir(urlDown, "");
      w("estado: " + r3.status + " · " + r3.ms + " ms · vía " + r3.via + (r3.err ? " · " + r3.err : ""));
      const cabeza = String(r3.cuerpo || "").slice(0, 8);
      if (r3.ok && cabeza.indexOf("PK") === 0) w("  ✓ es un Excel real (empieza por PK). La descarga FUNCIONA.");
      else if (r3.ok && /^\s*<|<!DOCTYPE|<html/i.test(cabeza)) w("  ✗ SharePoint devolvió una PÁGINA HTML (probable pantalla de inicio de sesión), no el archivo.");
      else if (r3.ok) w("  ✗ respondió 200 pero el contenido no parece un .xlsx (primeros bytes: " + JSON.stringify(cabeza) + ").");
      else w("  ✗ no se pudo descargar.");
    }
  } else {
    if (r2.status === 401 || r2.status === 403) w("  → ACCESO DENEGADO al listar: la sesión de SharePoint de este navegador no tiene permiso (o caducó).");
    if (r2.status === 404) w("  → 404: la RUTA de la carpeta cambió (¿la movieron o renombraron?).");
    if (r2.status === 0) w("  → sin respuesta: proxy, red, o permiso del gestor de userscripts.");
  }

  // ---------- 4. Qué tiene guardado el script ahora mismo ----------
  w("\n--- 4. ESTADO GUARDADO EN ESTE EQUIPO ---");
  try {
    const dia = localStorage.getItem("vgl_pym_dia");
    w("marca 'vgl_pym_dia' (día de la caché): " + (dia || "(vacía)") + (dia === HOY ? "  ← es de hoy" : "  ← NO es de hoy"));
  } catch (e) { w("no se pudo leer localStorage: " + e.message); }
  try {
    const e = JSON.parse(localStorage.getItem("vgl_rep_last_err") || "null");
    if (e) w("último error de envío al panel: " + JSON.stringify(e).slice(0, 200));
  } catch (e) {}

  w("\n======= FIN — copie TODO este texto y páselo al chat =======");
  const informe = out.join("\n");
  console.log(informe);
  try { copy(informe); console.log("%c(informe copiado al portapapeles)", "color:#4a4"); }
  catch (e) { console.log("(seleccione el texto de arriba y cópielo)"); }
})();
