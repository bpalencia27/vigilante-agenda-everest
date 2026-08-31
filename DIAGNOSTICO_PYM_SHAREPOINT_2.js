// =====================================================================
//  DIAGNÓSTICO PyM — PASO 2: DESDE LA PESTAÑA DE SHAREPOINT — v2 (2026-08-25)
//
//  Por qué hace falta este segundo: el primero corrió en la pestaña de
//  EVEREST, y ahí el navegador bloquea por CORS toda llamada a SharePoint
//  ANTES de que la sesión importe. Por eso salió "Failed to fetch": eso NO
//  prueba que la sesión esté mal — solo que el navegador no deja preguntar
//  desde ese origen. (El script real usa GM_xmlhttpRequest, que sí puede,
//  por eso a él sí le funcionaba.)
//
//  Aquí, en la pestaña de SharePoint, la llamada es del MISMO origen: no
//  hay CORS y la respuesta es la verdad sobre la sesión y los permisos.
//
//  DÓNDE: abra SharePoint en una pestaña — esta carpeta:
//    https://viva1aips-my.sharepoint.com/personal/director_bello_viva1a_com_co/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fdirector%5Fbello%5Fviva1a%5Fcom%5Fco%2FDocuments%2FINTRANET%2FACTIVIDADES%20DE%20PYM
//  Con los archivos a la vista: F12 → Consola → pegar todo → Enter.
//
//  SOLO LECTURA. No descarga los 14 MB: del archivo solo mira los primeros
//  bytes para saber si es un Excel de verdad.
// =====================================================================
(async function () {
  const out = [];
  const w = (s) => out.push(s);
  const CARPETA = "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM";
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const HOY = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  const HOYC = HOY.replace(/-/g, "");

  w("======= DIAGNÓSTICO PyM · PASO 2 (desde SharePoint) · " + new Date().toISOString() + " =======");
  w("Origen actual: " + location.origin);
  if (location.hostname.indexOf("sharepoint.com") < 0) {
    w("\n✗ ESTA NO ES LA PESTAÑA DE SHAREPOINT. Ábrala allí y vuelva a pegar el script.");
    console.log(out.join("\n"));
    return;
  }
  w("Hoy: " + HOY + " · token esperado en el nombre: " + HOYC);

  const pedir = async (url, comoTexto) => {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { credentials: "include", headers: comoTexto ? {} : { Accept: "application/json;odata=nometadata" } });
      const cuerpo = await r.text().catch(() => "");
      return { ok: r.ok, status: r.status, cuerpo: cuerpo, ms: Date.now() - t0 };
    } catch (e) {
      return { ok: false, status: 0, err: String((e && e.message) || e), ms: Date.now() - t0 };
    }
  };

  // ---------- 1. ¿Quién soy para SharePoint? (prueba de sesión) ----------
  w("\n--- 1. SESIÓN: ¿con qué usuario me ve SharePoint? ---");
  const r1 = await pedir(location.origin + "/personal/director_bello_viva1a_com_co/_api/web/currentuser");
  w("estado: " + r1.status + " · " + r1.ms + " ms" + (r1.err ? " · " + r1.err : ""));
  if (r1.ok) {
    try {
      const j = JSON.parse(r1.cuerpo);
      const u = (j && (j.LoginName || j.Title || (j.d && (j.d.LoginName || j.d.Title)))) || "";
      const esAnonimo = /guest|anonymous|urn:spo:guest/i.test(String(u));
      w("usuario: " + (u ? String(u).replace(/[^@\w.:|-]/g, "") : "(sin nombre)") + (esAnonimo ? "  ← acceso ANÓNIMO (por enlace compartido)" : "  ← sesión con cuenta"));
    } catch (e) { w("respuesta no interpretable (primeros 120): " + r1.cuerpo.slice(0, 120)); }
  } else if (r1.status === 403 || r1.status === 401) {
    w("✗ SharePoint NO reconoce ninguna sesión con permiso en este sitio.");
  }

  // ---------- 2. Listar la carpeta (la llamada exacta del script) ----------
  w("\n--- 2. LISTAR LA CARPETA DEL PyM (la llamada exacta del script) ---");
  const urlLista = location.origin + "/personal/director_bello_viva1a_com_co/_api/web/GetFolderByServerRelativeUrl('"
    + encodeURI(CARPETA) + "')/Files?$select=Name,ServerRelativeUrl,TimeLastModified&$orderby=TimeLastModified%20desc&$top=60";
  const r2 = await pedir(urlLista);
  w("estado: " + r2.status + " · " + r2.ms + " ms" + (r2.err ? " · " + r2.err : ""));
  let candidato = null;
  if (r2.ok) {
    let filas = [];
    try {
      const j = JSON.parse(r2.cuerpo);
      filas = (j && (j.value || (j.d && j.d.results))) || [];
    } catch (e) { w("✗ la respuesta no es el JSON esperado: " + e.message); }
    w("✓ LISTAR FUNCIONA. Archivos que ve el script: " + filas.length);
    filas.slice(0, 25).forEach((f) => {
      const nom = String(f.Name || "");
      const esHoy = nom.replace(/[.\s_\-\/]/g, "").toLowerCase().indexOf(HOYC) >= 0;
      w("   " + (esHoy ? "★ " : "  ") + nom + "   (modificado: " + String(f.TimeLastModified || "?").slice(0, 16) + ")");
    });
    candidato = filas.find((f) => String(f.Name || "").replace(/[.\s_\-\/]/g, "").toLowerCase().indexOf(HOYC) >= 0
      && /\.(xlsx|xlsm|csv)$/i.test(f.Name || "") && !/^~\$/.test(f.Name || "")) || null;
    w(candidato ? "\n✓ ARCHIVO DE HOY: " + candidato.Name : "\n✗ ninguno con el token " + HOYC + " en el nombre.");
  } else {
    w("✗ NO SE PUEDE LISTAR con la sesión de este navegador.");
    if (r2.status === 403) w("  403 = la cuenta con la que entró NO tiene permiso sobre esa carpeta (o solo tiene el enlace, que ya no vale).");
    if (r2.status === 404) w("  404 = la RUTA cambió: la carpeta se movió o la renombraron.");
  }

  // ---------- 3. ¿Se puede descargar? ----------
  if (candidato) {
    w("\n--- 3. DESCARGA (solo los primeros bytes) ---");
    const r3 = await pedir(location.origin + "/personal/director_bello_viva1a_com_co/_api/web/GetFileByServerRelativeUrl('"
      + encodeURI(candidato.ServerRelativeUrl) + "')/$value", true);
    w("estado: " + r3.status + " · " + r3.ms + " ms" + (r3.err ? " · " + r3.err : ""));
    const cab = String(r3.cuerpo || "").slice(0, 8);
    if (r3.ok && cab.indexOf("PK") === 0) w("  ✓ es un Excel real: la DESCARGA FUNCIONA.");
    else if (r3.ok && /^\s*<|<!DOCTYPE|<html/i.test(cab)) w("  ✗ devolvió una PÁGINA HTML (pantalla de inicio de sesión), no el archivo.");
    else if (r3.ok) w("  ✗ 200 pero no parece .xlsx (primeros bytes: " + JSON.stringify(cab) + ").");
    else w("  ✗ no se pudo descargar.");
  }

  // ---------- 4. El enlace de compartir que usa el script ----------
  w("\n--- 4. ENLACE DE COMPARTIR CONFIGURADO EN EL SCRIPT ---");
  const r4 = await pedir("https://viva1aips-my.sharepoint.com/:f:/g/personal/director_bello_viva1a_com_co/IgCsGP_chaHvTKYH9v-QZ2Q1AQuJo3umR5gDLjKlkUqgPS4?e=jscdBl", true);
  w("estado: " + r4.status + " · " + r4.ms + " ms" + (r4.err ? " · " + r4.err : ""));
  if (/iniciar sesi|sign in|login\.microsoftonline/i.test(String(r4.cuerpo || "").slice(0, 4000))) {
    w("  ✗ el enlace lleva a INICIAR SESIÓN: como acceso anónimo ya NO sirve — hay que generar uno nuevo desde SharePoint (Compartir → copiar vínculo).");
  } else if (r4.ok) {
    w("  ✓ el enlace responde sin pedir inicio de sesión.");
  }

  w("\n======= FIN — copie TODO y páselo al chat =======");
  const informe = out.join("\n");
  console.log(informe);
  try { copy(informe); console.log("%c(copiado al portapapeles)", "color:#4a4"); } catch (e) {}
})();
