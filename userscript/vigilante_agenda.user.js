// ==UserScript==
// @name         Vigilante de Agenda — Copiloto Everest PyM
// @namespace    vigilante-agenda-everest
// @version      4.2.0
// @description  Vigila "Citas del día" de Everest EN SEGUNDO PLANO, notifica por colores en Windows y trae automáticamente el PyM del día desde SharePoint. Sin .exe: no dispara antivirus.
// @author       bpalencia27
// @match        *://neps.everestintelligent.com/*
// @match        *://*.everestintelligent.com/*
// @match        *://viva1aips-my.sharepoint.com/*
// @run-at       document-start
// @noframes
// @connect      viva1aips-my.sharepoint.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

/*
  v3.5 — MONITOREO ASÍNCRONO EN SEGUNDO PLANO
  - Crea un iframe OCULTO fijado en "Citas del día" (misma sesión/cookies). El overlay
    lo lee cada 5 s, así SIGUE REFRESCANDO aunque estés dentro de una Historia Clínica.
  - Si por algo el clon no está listo, usa la página actual y, en último caso, conserva
    la última lectura (nunca se queda en blanco).
  - Colores de alto contraste. Lector de PyM (.xlsx/.csv) sin librerías externas.
  - Botón "Diag": diagnóstico DOM + endpoints de red (VALORES REDACTADOS) por si luego
    conviene pasar a polling directo del API.
  @noframes evita que el script se ejecute dentro del propio clon (sin recursión).
  PRIVACIDAD: nada sale del navegador; PyM en memoria; diagnóstico enmascarado.
*/

(function () {
  "use strict";
  if (window.top !== window.self) return; // nunca correr dentro de un frame (incl. el clon)
  const VERSION = "4.2.0"; // fuente única de la versión (título + diagnóstico)
  const PAGEWIN = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window; // ventana real de la página (sandbox de Tampermonkey)
  // Nombre del navegador, para dar instrucciones correctas (Chrome / Edge / Brave / Opera).
  const BROWSER_NAME = (function () {
    const u = navigator.userAgent;
    if (/Edg\//.test(u)) return "Microsoft Edge";
    if (/OPR\//.test(u)) return "Opera";
    if (/Brave/.test(u) || (navigator.brave && navigator.brave.isBrave)) return "Brave";
    if (/Chrome\//.test(u)) return "Google Chrome";
    return "su navegador";
  })();

  const CONFIG = {
    POLL_MS: 5000,
    CLONE_HEAL_MS: 60000,     // si el clon pierde la agenda, intenta recargarlo
    CLONE_REFRESH_MS: 30000,  // recarga periódica del clon: asegura datos frescos (stopgap hasta polling directo)
    TOLERANCIA_MIN: 6.0,
    AGENDA_PATH: "/viva/HCHealth/",
    // Actividades PyM a OCULTAR porque la meta ya está cumplida en la IPS (ETS: solo se
    // conserva VIH). Coincidencia por texto sin acentos/minúsculas contra encabezado+etiqueta.
    // VIH SIEMPRE se conserva. Edita esta lista si cambian las metas.
    EXCLUDE_PYM: ["vdrl", "sifilis", "hepatitis", "hepb", "hepc"],
    // SharePoint: carpeta del PyM diario (se elige el archivo cuyo nombre lleve la fecha de hoy).
    SP: {
      host: "viva1aips-my.sharepoint.com",
      web: "/personal/director_bello_viva1a_com_co",
      folder: "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM",
    },
    SEL: {
      hora: ".labelHora", estado: ".status-label", contenedor: [".card-body", ".card"],
      documento: ".text-muted", nombre: [".text-uppercase.fw-bold", ".text-uppercase"],
      modalidad: ".fw-bold.mb-0", fecha: ".fecha",
    },
  };
  // Paleta del sistema (estilo macOS, modo oscuro).
  const COLORS = { VERDE: "#30D158", AMBAR: "#FF9F0A", ROJO: "#FF453A", AZUL: "#0A84FF", MORADO: "#BF5AF2" };
  const TINT = { VERDE: "rgba(48,209,88,.20)", AMBAR: "rgba(255,159,10,.20)", ROJO: "rgba(255,69,58,.22)", AZUL: "rgba(10,132,255,.20)", MORADO: "rgba(191,90,242,.20)" };
  const FRIENDLY = {
    VALORACION_INTEGRAL: "Valoración integral", TAMIZACION_CMB: "Tamización CMB",
    CITA_PF: "Cita Planificación Familiar", CITA_AV: "Cita Agudeza Visual", CITA_OD: "Cita Odontología",
    TAMIZACION_CERVIX: "Tamización cérvix", TAMIZACION_PROSTATA: "Tamización próstata",
    PRUEBA_CERVIX: "Prueba cérvix", TAMIZACION_MAMA: "Tamización mama", TAMIZACION_COLON: "Tamización colon",
    TAMIZACION_HEPC: "Tamización Hepatitis C", TAMIZACION_HEPB: "Tamización Hepatitis B",
    TAMIZACION_VDRL: "Tamización VDRL (Sífilis)", TAMIZACION_HB: "Tamización Hemoglobina",
    TAMIZACION_VIH: "Tamización VIH", TAMIZACION_HTO: "Tamización Hematocrito",
  };
  const DOC_EXACT = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO", "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"];

  const state = {
    pym: new Map(), pymFile: "", historical: new Map(),
    fraudWatch: new Set(), alertedFraud: new Set(), warnedTimes: new Set(),
    lastSignature: "", events: [], minimized: false, lastSnapshot: null, netlog: [],
    notified: new Map(), summarized: false, osNotif: false,
    leader: false, shared: null,
  };
  // ---- Coordinación entre pestañas: SOLO UNA vigila y notifica (evita avisos repetidos) ----
  const TABID = String(Math.random()).slice(2) + Date.now();
  const LEADER_KEY = "vgl_leader", LEADER_TTL = 14000;
  let chan = null;
  try { chan = new BroadcastChannel("vgl"); chan.onmessage = (e) => { if (e.data && e.data.t) state.shared = e.data; }; } catch (e) {}
  function heartbeat() {
    try {
      const now = Date.now(), raw = localStorage.getItem(LEADER_KEY), o = raw ? JSON.parse(raw) : null;
      if (!o || o.id === TABID || now - (o.t || 0) > LEADER_TTL) { localStorage.setItem(LEADER_KEY, JSON.stringify({ id: TABID, t: now })); state.leader = true; }
      else state.leader = false;
    } catch (e) { state.leader = true; }
    return state.leader;
  }
  function share(list) { try { if (chan) chan.postMessage({ t: Date.now(), list }); } catch (e) {} }
  try { window.addEventListener("beforeunload", () => { try { const o = JSON.parse(localStorage.getItem(LEADER_KEY) || "{}"); if (o.id === TABID) localStorage.removeItem(LEADER_KEY); } catch (e) {} }); } catch (e) {}
  const CLONE = { frame: null, url: null };

  const limpio = (s) => (s || "").replace(/\s+/g, " ").trim();
  function normalizeKey(val) { if (val === null || val === undefined) return ""; let s = String(val).trim(); if (s.endsWith(".0")) s = s.slice(0, -2); return s.replace(/\D/g, ""); }
  function extractDoc(t) { if (!t) return ""; const first = t.split(",")[0].replace(/[.\s]/g, ""); let m = /^(\d{5,15})$/.exec(first); if (m) return m[1]; m = /(\d{5,15})/.exec(t.replace(/[.\s]/g, "")); return m ? m[1] : ""; }
  function isPending(val) { if (val === null || val === undefined) return false; const s = String(val).trim().toLowerCase(); return s === "susceptible" || s === "pendiente" || s.startsWith("tamizar"); }
  function friendly(h) { if (FRIENDLY[h]) return FRIENDLY[h]; const t = h.replace(/_/g, " ").trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }
  function activityLabel(header, val) { const f = friendly(header); const s = String(val).trim().toLowerCase(); if (s === "susceptible" || s === "pendiente") return f; return `${f} — ${String(val).trim()}`; }
  function stripAccents(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function isExcludedActivity(header, label) {
    const hay = stripAccents((header + " " + label).toLowerCase());
    if (hay.includes("vih")) return false; // VIH siempre se conserva
    return CONFIG.EXCLUDE_PYM.some((k) => hay.includes(k));
  }
  function getActivities(docId) { return state.pym.get(normalizeKey(docId)) || []; }

  function indexRows(headersRaw, rows) {
    const headers = headersRaw.map((h, i) => (h === null || h === undefined ? `COL_${i}` : String(h).trim().toUpperCase()));
    let docIdx = -1;
    for (const cand of DOC_EXACT) { const k = headers.indexOf(cand); if (k >= 0) { docIdx = k; break; } }
    if (docIdx < 0) docIdx = headers.findIndex((h) => h.includes("IDENT") || h.includes("CEDULA") || (h.includes("DOCUMENTO") && !h.includes("TIPO")));
    if (docIdx < 0) throw new Error("No se encontró columna de documento/cédula. Columnas: " + headers.join(", "));
    const map = new Map();
    for (const row of rows) {
      const docKey = normalizeKey(row[docIdx]); if (!docKey) continue;
      const bucket = map.get(docKey) || [];
      for (let i = 0; i < headers.length; i++) { if (i === docIdx) continue; if (isPending(row[i])) { const label = activityLabel(headers[i], row[i]); if (isExcludedActivity(headers[i], label)) continue; if (!bucket.includes(label)) bucket.push(label); } }
      map.set(docKey, bucket);
    }
    return map;
  }
  function parseCSV(text) { return text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length).map((l) => l.split(",")); }

  async function inflateRaw(bytes) { const ds = new DecompressionStream("deflate-raw"); const ab = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer(); return new Uint8Array(ab); }
  function colToIdx(ref) { const m = /^([A-Z]+)\d+$/.exec(ref || ""); if (!m) return -1; let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; }
  async function readXlsx(arrayBuffer) {
    const dv = new DataView(arrayBuffer), bytes = new Uint8Array(arrayBuffer), td = new TextDecoder();
    let eocd = -1; for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error("xlsx inválido (EOCD)");
    const cdCount = dv.getUint16(eocd + 10, true), cdOffset = dv.getUint32(eocd + 16, true);
    const files = {}; let p = cdOffset;
    for (let n = 0; n < cdCount; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      files[td.decode(bytes.subarray(p + 46, p + 46 + nameLen))] = { method, compSize, localOff };
      p += 46 + nameLen + extraLen + commentLen;
    }
    async function readEntry(name) { const f = files[name]; if (!f) return null; const lh = f.localOff; const start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true); const comp = bytes.subarray(start, start + f.compSize); const raw = f.method === 0 ? comp : await inflateRaw(comp); return new TextDecoder("utf-8").decode(raw); }
    const sharedXml = await readEntry("xl/sharedStrings.xml");
    let sheetKey = "xl/worksheets/sheet1.xml"; if (!files[sheetKey]) { const k = Object.keys(files).find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)); if (k) sheetKey = k; }
    const sheetXml = await readEntry(sheetKey); if (!sheetXml) throw new Error("xlsx: no se encontró la hoja");
    const shared = [];
    if (sharedXml) { const sdoc = new DOMParser().parseFromString(sharedXml, "application/xml"); const sis = sdoc.getElementsByTagNameNS("*", "si"); for (let i = 0; i < sis.length; i++) { const ts = sis[i].getElementsByTagNameNS("*", "t"); let s = ""; for (let j = 0; j < ts.length; j++) s += ts[j].textContent; shared.push(s); } }
    const doc = new DOMParser().parseFromString(sheetXml, "application/xml"); const rowsEl = doc.getElementsByTagNameNS("*", "row"); const rows = [];
    for (let r = 0; r < rowsEl.length; r++) {
      const cells = rowsEl[r].getElementsByTagNameNS("*", "c"); const arr = [];
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c]; let idx = colToIdx(cell.getAttribute("r")); if (idx < 0) idx = arr.length; const t = cell.getAttribute("t"); let val = "";
        if (t === "s") { const v = cell.getElementsByTagNameNS("*", "v")[0]; val = v ? (shared[parseInt(v.textContent, 10)] || "") : ""; }
        else if (t === "inlineStr") { const is = cell.getElementsByTagNameNS("*", "is")[0]; val = is ? is.textContent : ""; }
        else { const v = cell.getElementsByTagNameNS("*", "v")[0]; val = v ? v.textContent : ""; }
        arr[idx] = val;
      }
      rows.push(arr);
    }
    return rows;
  }

  function afterPymLoaded(fileName) {
    state.pymFile = fileName;
    if (state.lastSnapshot) state.lastSnapshot.list.forEach((a) => { a.pym = getActivities(a.doc_id); });
    state.lastSignature = ""; tick();
    setSummary(`PyM cargado: ${state.pym.size} paciente(s) — ${fileName}`);
  }
  function applyPym(headers, rows, fileName) {
    state.pym = indexRows(headers, rows);
    afterPymLoaded(fileName);
    try { if (typeof GM_setValue !== "undefined") GM_setValue("vgl_pym", JSON.stringify({ date: todayStamp(), name: fileName, map: Array.from(state.pym.entries()) })); } catch (e) {}
  }

  // ================== SharePoint: PyM del día automático ==================
  function todayStamp() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function normName(s) { return String(s || "").replace(/[.\s_\-\/]/g, "").toLowerCase(); }
  function todayTokens() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    const Y = d.getFullYear(), M = p(d.getMonth() + 1), D = p(d.getDate()), m = d.getMonth() + 1, day = d.getDate();
    return [`${Y}${M}${D}`, `${Y}-${M}-${D}`, `${Y}_${M}_${D}`, `${D}${M}${Y}`, `${D}-${M}-${Y}`, `${D}_${M}_${Y}`, `${day}-${m}-${Y}`, `${day}/${m}/${Y}`];
  }
  // Elige el archivo de HOY (soporta 20260803, 03-08-2026, 3-8-2026, 2026-08-03…).
  // Si hay varios del día, prefiere el que diga PYM/ACTIVIDAD. Si no hay ninguno de hoy,
  // cae al más reciente pero marca exact=false para avisar al usuario.
  function pickTodaysFile(files) {
    const xls = (files || []).filter((f) => /\.(xlsx|xlsm|csv)$/i.test(f.Name || ""));
    if (!xls.length) return null;
    const toks = todayTokens().map(normName);
    const isToday = (f) => { const n = normName(f.Name); return toks.some((t) => n.includes(t)); };
    const isPym = (f) => /pym|actividad/i.test(f.Name || "");
    const hoy = xls.filter(isToday);
    const hit = hoy.filter(isPym)[0] || hoy[0];
    if (hit) return { file: hit, exact: true };
    const rec = xls.filter(isPym).concat(xls).sort((a, b) => new Date(b.TimeLastModified || 0) - new Date(a.TimeLastModified || 0))[0];
    return rec ? { file: rec, exact: false } : null;
  }
  function spBase() { return "https://" + CONFIG.SP.host + CONFIG.SP.web; }
  function spListUrl() { return spBase() + "/_api/web/GetFolderByServerRelativeUrl('" + encodeURIComponent(CONFIG.SP.folder) + "')/Files?$select=Name,ServerRelativeUrl,TimeLastModified&$top=500"; }
  function spDownloadUrl(sru) { return spBase() + "/_api/web/GetFileByServerRelativeUrl('" + encodeURIComponent(sru) + "')/$value"; }
  async function bufferToPym(name, buffer) {
    if (/\.csv$/i.test(name)) { const all = parseCSV(new TextDecoder().decode(new Uint8Array(buffer))); return { headers: all[0] || [], rows: all.slice(1) }; }
    const r = await readXlsx(buffer); return { headers: r[0] || [], rows: r.slice(1) };
  }
  function gmGet(url, responseType, accept) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === "undefined") { reject(new Error("permiso GM_xmlhttpRequest no concedido")); return; }
      GM_xmlhttpRequest({ method: "GET", url, responseType: responseType || "", headers: accept ? { Accept: accept } : {}, timeout: 60000,
        onload: (r) => (r.status >= 200 && r.status < 300) ? resolve(r) : reject(new Error("HTTP " + r.status)),
        onerror: () => reject(new Error("error de red/permiso")), ontimeout: () => reject(new Error("timeout")) });
    });
  }
  function cacheIsToday() { try { if (typeof GM_getValue === "undefined") return false; const raw = GM_getValue("vgl_pym", ""); return !!raw && JSON.parse(raw).date === todayStamp(); } catch (e) { return false; } }
  function loadPymFromCache() {
    try {
      if (typeof GM_getValue === "undefined") return false;
      const raw = GM_getValue("vgl_pym", ""); if (!raw) return false;
      const o = JSON.parse(raw);
      // Purga de días anteriores: no conservamos datos de pacientes de jornadas pasadas.
      if (o.date !== todayStamp()) { try { GM_setValue("vgl_pym", ""); } catch (e2) {} return false; }
      if (!o.map) return false;
      state.pym = new Map(o.map); afterPymLoaded((o.name || "PyM") + " (auto)"); return true;
    } catch (e) { return false; } }
  // Desde Everest (cross-origin) con GM_xmlhttpRequest + tus cookies de SharePoint.
  async function autoPymFromSharepoint(silent) {
    try {
      if (!silent) setSummary("Buscando PyM del día en SharePoint…");
      const listR = await gmGet(spListUrl(), "json", "application/json;odata=nometadata");
      const j = listR.response || (listR.responseText ? JSON.parse(listR.responseText) : {});
      const sel = pickTodaysFile(j.value || (j.d && j.d.results) || []);
      if (!sel) throw new Error("la carpeta no tiene .xlsx/.csv");
      const dl = await gmGet(spDownloadUrl(sel.file.ServerRelativeUrl), "arraybuffer");
      const { headers, rows } = await bufferToPym(sel.file.Name, dl.response);
      applyPym(headers, rows, sel.file.Name + (sel.exact ? " (SharePoint)" : " (SharePoint · NO es de hoy)"));
      if (!sel.exact) setSummary("⚠ No encontré el PyM de HOY; cargué el más reciente: " + sel.file.Name, "warn");
    } catch (e) {
      if (!silent) setSummary("PyM auto no disponible (" + e.message + "). Abre la carpeta de SharePoint una vez, o usa 📂.", "warn");
    }
  }
  // En la pestaña de SharePoint (same-origin): descarga y cachea el PyM del día para que Everest lo use.
  function spToast(msg) {
    try { let t = document.getElementById("vgl-sp"); if (!t) { t = document.createElement("div"); t.id = "vgl-sp"; t.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;max-width:430px;background:#0B1220;color:#F1F5F9;border:1px solid #3B4B63;border-left:6px solid #10B981;border-radius:8px;padding:12px 14px;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.5)"; (document.body || document.documentElement).appendChild(t); } t.textContent = "🛡️ Vigilante PyM · " + msg; } catch (e) {}
  }
  async function runSharepointHarvester() {
    try {
      if (cacheIsToday()) { spToast("El PyM del día ya está capturado. Puedes volver a Everest."); return; }
      spToast("Buscando el PyM del día…");
      const listR = await fetch(spListUrl(), { credentials: "include", headers: { Accept: "application/json;odata=nometadata" } });
      if (!listR.ok) throw new Error("listar HTTP " + listR.status);
      const j = await listR.json();
      const sel = pickTodaysFile(j.value || (j.d && j.d.results) || []);
      if (!sel) { spToast("No encontré ningún .xlsx/.csv en la carpeta."); return; }
      const dlR = await fetch(spDownloadUrl(sel.file.ServerRelativeUrl), { credentials: "include" });
      if (!dlR.ok) throw new Error("descargar HTTP " + dlR.status);
      const { headers, rows } = await bufferToPym(sel.file.Name, await dlR.arrayBuffer());
      const map = indexRows(headers, rows);
      if (typeof GM_setValue !== "undefined") GM_setValue("vgl_pym", JSON.stringify({ date: todayStamp(), name: sel.file.Name, map: Array.from(map.entries()) }));
      spToast((sel.exact ? "✓ PyM de hoy capturado: " : "⚠ No hay archivo de HOY; tomé el más reciente: ") + sel.file.Name + " (" + map.size + " pacientes). Ya está disponible en Everest.");
    } catch (e) { spToast("No pude capturar el PyM: " + e.message + ". ¿Estás con sesión iniciada en SharePoint?"); }
  }
  // ================== fin SharePoint ==================

  function loadPymFile(file) {
    const name = file.name.toLowerCase(); const reader = new FileReader();
    reader.onerror = () => setSummary("No se pudo leer el archivo PyM.", "error");
    if (name.endsWith(".csv")) { reader.onload = (e) => { try { const all = parseCSV(String(e.target.result)); applyPym(all[0] || [], all.slice(1), file.name); } catch (err) { setSummary("Error CSV: " + err.message, "error"); } }; reader.readAsText(file, "UTF-8"); }
    else { reader.onload = async (e) => { try { if (typeof DecompressionStream === "undefined") throw new Error("Navegador sin soporte .xlsx; usa .csv."); const rows = await readXlsx(e.target.result); applyPym(rows[0] || [], rows.slice(1), file.name); } catch (err) { setSummary("Error .xlsx (" + err.message + "). Prueba .csv.", "error"); } }; reader.readAsArrayBuffer(file); }
  }

  // ---- Extracción del DOM (parametrizada por documento: sirve para la página o para el clon) ----
  function firstMatch(root, selList) { const arr = Array.isArray(selList) ? selList : [selList]; for (const s of arr) { const el = root.querySelector(s); if (el) return el; } return null; }
  function containerOf(elHora) {
    for (const s of CONFIG.SEL.contenedor) { const c = elHora.closest(s); if (c) return c; }
    const body = elHora.ownerDocument.body; let n = elHora.parentElement, saltos = 0;
    while (n && n !== body && saltos < 8) { if (n.querySelector(CONFIG.SEL.estado)) return n; n = n.parentElement; saltos++; }
    return null;
  }
  function extractAgenda(doc) {
    doc = doc || document;
    const horas = Array.from(doc.querySelectorAll(CONFIG.SEL.hora));
    if (horas.length === 0) return { visible: false, citas: [] };
    const citas = horas.map((h, i) => {
      const cont = containerOf(h); let estado = "", documento = "", nombre = "", modalidad = "";
      if (cont) {
        estado = limpio((cont.querySelector(CONFIG.SEL.estado) || {}).textContent);
        documento = limpio((firstMatch(cont, CONFIG.SEL.documento) || {}).textContent);
        nombre = limpio((firstMatch(cont, CONFIG.SEL.nombre) || {}).textContent);
        modalidad = limpio((cont.querySelector(CONFIG.SEL.modalidad) || {}).textContent);
      }
      return { hora_texto: limpio(h.textContent), doc_id: extractDoc(documento), nombre: nombre || "Paciente Everest", modalidad, estado: estado || "Pendiente", index: i };
    });
    return { visible: true, citas };
  }

  // ---- Color / alerta ----
  function elapsedMin(ts, now) {
    const m = /^(\d{1,2}):(\d{2})\s*([AaPp])[.\sMm]*$/.exec((ts || "").trim());
    if (!m) { if (!state.warnedTimes.has(ts)) { state.warnedTimes.add(ts); console.warn("[Vigilante] hora no interpretable:", ts); } return 0; }
    let h = parseInt(m[1], 10) % 12; if (/[Pp]/.test(m[3])) h += 12; const apt = new Date(now); apt.setHours(h, parseInt(m[2], 10), 0, 0); return (now - apt) / 60000;
  }
  function apptKey(a) { return a.doc_id ? a.doc_id : `${a.hora_texto}|${a.nombre}|${a.index}`; }
  function colorAndAlert(a, now) {
    const st = (a.estado || "").toLowerCase(); const key = apptKey(a); const elapsed = elapsedMin(a.hora_texto, now); const pym = getActivities(a.doc_id);
    const prev = state.historical.get(key) || "";
    const grace = CONFIG.TOLERANCIA_MIN, prealert = CONFIG.TOLERANCIA_MIN - 1.0; let color = "AZUL", sound = false, reason = "", arrival = false;
    if (st.includes("en sala")) {
      if (state.fraudWatch.has(key)) { color = "ROJO"; if (!state.alertedFraud.has(key)) { sound = true; state.alertedFraud.add(key); } }
      else { color = "VERDE"; if (prev.includes("sin presentarse")) arrival = true; } // llegada a tiempo tras estar "Sin presentarse"
    }
    else if (st.includes("atendido")) { color = state.alertedFraud.has(key) ? "ROJO" : "VERDE"; }
    else if (st.includes("sin presentarse")) { if (elapsed >= grace) { color = "AMBAR"; state.fraudWatch.add(key); } else if (elapsed >= prealert) { color = "MORADO"; reason = "tiempo"; } else color = "AZUL"; }
    else { if (elapsed >= prealert) { color = "MORADO"; reason = "tiempo"; } else if (pym.length >= 3) { color = "MORADO"; reason = "pym"; } else color = "AZUL"; }
    if (sound) state.events.push({ t: new Date().toLocaleString(), ev: "FRAUDE_EXTEMPORANEO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado });
    else if (st !== prev && prev !== "") state.events.push({ t: new Date().toLocaleString(), ev: "CAMBIO_ESTADO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, previo: prev });
    state.historical.set(key, st);
    return { ...a, key, color, reason, arrival, sound, elapsed: Math.round(elapsed * 10) / 10, pym };
  }

  let audioCtx = null;
  function beep(freq, ms, off) { try { audioCtx = audioCtx || new (PAGEWIN.AudioContext || PAGEWIN.webkitAudioContext || window.AudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value = freq; o.type = "square"; const t0 = audioCtx.currentTime + off; g.gain.setValueAtTime(0.15, t0); o.start(t0); o.stop(t0 + ms / 1000); } catch (e) {} }
  function fraudSound() { beep(1000, 400, 0); beep(1200, 400, 0.45); }

  // =====================================================================
  //  CANALES DE AVISO QUE **NO** DEPENDEN DE WINDOWS
  //  (para equipos donde la política de la empresa bloquea las
  //   notificaciones del sistema). Todos se apagan al "reconocer".
  // =====================================================================
  const TONE = { ROJO: [1000, 1240], MORADO: [900, 680], AMBAR: [760, 620], VERDE: [680, 1020], AZUL: [620, 820] };
  function playTone(color) { const t = TONE[color] || TONE.AZUL; beep(t[0], 380, 0); beep(t[1], 380, 0.42); }

  // (1) SONIDO INSISTENTE: el audio suena aunque el navegador esté minimizado o
  //     estés en Word. Se repite hasta que reconozcas la alerta.
  let nagTimer = null, nagLeft = 0, nagColor = "ROJO";
  function startNag(color) { stopNag(); nagColor = color; nagLeft = 40; playTone(color); nagTimer = setInterval(() => { if (nagLeft-- <= 0) { stopNag(); return; } playTone(nagColor); }, 9000); }
  function stopNag() { if (nagTimer) clearInterval(nagTimer); nagTimer = null; }

  // (2) PESTAÑA QUE PARPADEA: título + favicon. Visible en la barra de pestañas
  //     aunque estés en otra pestaña del navegador.
  let flashTimer = null, origTitle = null, origIcon = null, flashOn = false;
  function faviconUrl(color) {
    const c = COLORS[color] || COLORS.AZUL;
    return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="${c}"/></svg>`);
  }
  function setFavicon(href) {
    try {
      let l = document.querySelector("link[rel~='icon'][data-vgl]");
      if (!l) { l = document.createElement("link"); l.rel = "icon"; l.setAttribute("data-vgl", "1"); document.head.appendChild(l); }
      if (href) l.href = href; else l.remove();
    } catch (e) {}
  }
  function startFlash(text, color) {
    stopFlash();
    if (origTitle === null) origTitle = document.title;
    try { const cur = document.querySelector("link[rel~='icon']:not([data-vgl])"); origIcon = cur ? cur.href : null; } catch (e) {}
    flashTimer = setInterval(() => {
      flashOn = !flashOn;
      try { document.title = flashOn ? text : (origTitle || "Everest"); } catch (e) {}
      setFavicon(flashOn ? faviconUrl(color) : (origIcon || faviconUrl("AZUL")));
    }, 900);
  }
  function stopFlash() {
    if (flashTimer) clearInterval(flashTimer); flashTimer = null;
    try { if (origTitle !== null) document.title = origTitle; } catch (e) {}
    setFavicon(null);
  }

  // (3) VENTANA EMERGENTE REAL: es una ventana del navegador, así que aparece en la
  //     BARRA DE TAREAS de Windows y parpadea — se nota aunque estés en otra app.
  //     Requiere permitir ventanas emergentes para el sitio (permiso del sitio, no del SO).
  let popupWarned = false;
  function popupAlert(color, title, body) {
    if (localStorage.getItem("vgl_popup") !== "1") return;
    try {
      const w = window.open("", "vglAlerta", "width=470,height=290,menubar=no,toolbar=no,location=no,status=no");
      if (!w) {
        if (!popupWarned) { popupWarned = true; setSummary("Para la ventana emergente: permite «Ventanas emergentes» en el candado de la barra de direcciones.", "warn"); }
        return;
      }
      const c = COLORS[color] || COLORS.AZUL;
      w.document.open();
      w.document.write(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>
        <body style="margin:0;font-family:-apple-system,'Segoe UI',sans-serif;background:#0B1220;color:#f5f5f7;display:flex;align-items:center;justify-content:center;height:100vh">
        <div style="padding:24px;text-align:center;max-width:420px">
          <div style="width:16px;height:16px;border-radius:50%;background:${c};margin:0 auto 14px;box-shadow:0 0 16px ${c}"></div>
          <div style="font-size:17px;font-weight:700;margin-bottom:8px">${escapeHtml(title)}</div>
          <div style="font-size:14px;opacity:.85;white-space:pre-line;line-height:1.45">${escapeHtml(body)}</div>
          <button onclick="window.close()" style="margin-top:18px;background:${c};color:#001;border:0;border-radius:9px;padding:9px 20px;font-size:14px;font-weight:700;cursor:pointer">Entendido</button>
        </div></body>`);
      w.document.close();
      try { w.focus(); } catch (e) {}
    } catch (e) {}
  }

  // (4) CARTEL GRANDE dentro de Everest para el FRAUDE: imposible de ignorar
  //     cuando el navegador está a la vista.
  function bigAlert(color, title, body) {
    try {
      let ov = document.getElementById("vgl-modal");
      if (ov) ov.remove();
      const c = COLORS[color] || COLORS.AZUL;
      ov = document.createElement("div"); ov.id = "vgl-modal";
      ov.innerHTML = `<div class="vgl-modal-card" style="border-color:${c}">
          <div class="vgl-modal-dot" style="background:${c};box-shadow:0 0 22px ${c}"></div>
          <div class="vgl-modal-t"></div><div class="vgl-modal-b"></div>
          <button class="vgl-modal-ok" style="background:${c}">Entendido</button>
        </div>`;
      ov.querySelector(".vgl-modal-t").textContent = title;
      ov.querySelector(".vgl-modal-b").textContent = body;
      ov.querySelector(".vgl-modal-ok").addEventListener("click", () => { ov.remove(); acknowledge(); });
      document.body.appendChild(ov);
    } catch (e) {}
  }

  // Reconocer: apaga sonido insistente, parpadeo y cartel.
  function acknowledge() { stopNag(); stopFlash(); const m = document.getElementById("vgl-modal"); if (m) m.remove(); }

  // ---- NOTIFICACIONES POR COLORES (recuperado de la v2.5): toast en Windows + respaldo en la página ----
  function colorDot(color) {
    const c = COLORS[color] || COLORS.AZUL;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="${c}"/></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  // Anti-duplicado entre pestañas: si otra pestaña de Everest ya lanzó este aviso hace <12s, no repetir.
  function crossTabDup(id) { try { const k = "vgl_n_" + id, now = Date.now(), prev = +(localStorage.getItem(k) || 0); if (now - prev < 12000) return true; localStorage.setItem(k, String(now)); return false; } catch (e) { return false; } }
  function osNotify(color, title, body, persist) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") { showToast(color, title, body, persist); return; }
    if (crossTabDup("os|" + title)) return;
    let done = false; const fb = () => { if (done) return; done = true; showToast(color, title, body, persist); };
    try {
      const n = new Notification(title, { body, icon: colorDot(color), badge: colorDot(color), requireInteraction: true, tag: title, renotify: true });
      try { n.onshow = () => { done = true; }; n.onerror = fb; } catch (e) {}
      // Si Windows suprime el aviso (No molestar / política / navegador sin permiso en Windows),
      // 'show' no se dispara: a los 1.6s mostramos el aviso DENTRO del navegador como respaldo.
      setTimeout(fb, 1600);
    } catch (e) { fb(); }
  }
  function showToast(color, title, body, persist) {
    try {
      const wrap = document.getElementById("vgl-toasts"); if (!wrap) return;
      const col = COLORS[color] || COLORS.AZUL, tint = TINT[color] || TINT.AZUL;
      const icon = { ROJO: "⛔", MORADO: "⏳", AMBAR: "⚠", VERDE: "✅", AZUL: "🛡️" }[color] || "🛡️";
      const t = document.createElement("div"); t.className = "vgl-toast";
      t.innerHTML = `<div class="vgl-toast-ic" style="background:${tint};color:${col}"></div><div class="vgl-toast-main"><div class="vgl-toast-title"></div><div class="vgl-toast-b"></div></div><span class="vgl-toast-x">×</span>`;
      t.querySelector(".vgl-toast-ic").textContent = icon;
      t.querySelector(".vgl-toast-title").textContent = title;
      t.querySelector(".vgl-toast-b").textContent = body;
      t.querySelector(".vgl-toast-x").addEventListener("click", () => t.remove());
      wrap.appendChild(t);
      while (wrap.children.length > 6) wrap.removeChild(wrap.firstChild);
      // Sin auto-cierre: toda notificación permanece hasta cerrarla manualmente (× ).
    } catch (e) {}
  }
  // Solo Windows. El toast dentro de la página queda como RESPALDO únicamente si Windows
  // no está disponible (permiso no concedido/denegado), para no perder un aviso de fraude.
  function notify(color, title, body, persist) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") { osNotify(color, title, body, persist); }
    else { showToast(color, title, body, persist); }
  }
  const NOTIFY = {
    ROJO: { icon: "⛔", label: "Confirmación extemporánea (FRAUDE)", sound: true, persist: true },
    MORADO: { icon: "⏳", label: "Última llamada: ~1 min para confirmar o pierde la cita", persist: true },
    AMBAR: { icon: "⚠", label: "Inasistencia registrada", persist: true },
    VERDE: { icon: "✅", label: "Confirmado a tiempo (pasó a En Sala)", persist: true },
  };
  // Clave de notificación: el MORADO se distingue por motivo (tiempo vs 3+ PyM) para no confundirlos.
  function nkey(a) { return a.color === "MORADO" ? "MORADO:" + (a.reason || "") : a.color; }
  function maybeNotify(a) {
    const k = nkey(a); const prev = state.notified.get(a.key); if (prev === k) return; state.notified.set(a.key, k);
    if (a.color === "MORADO" && a.reason !== "tiempo") return; // el morado por "3+ PyM" no es urgente: no se notifica
    if (a.color === "VERDE" && !a.arrival) return; // solo la transición "Sin presentarse" -> "En Sala" (llegada a tiempo)
    const cfg = NOTIFY[a.color]; if (!cfg) return;
    const title = `${cfg.icon} ${a.hora_texto} · ${a.estado}`;
    const body = `${a.nombre}${a.doc_id ? " (" + a.doc_id + ")" : ""}\n${cfg.label}`;
    notify(a.color, title, body, cfg.persist);
    // Canales que no dependen de Windows (siempre activos):
    if (a.color === "ROJO") { startNag("ROJO"); bigAlert("ROJO", title, body); }   // fraude: insiste hasta reconocer
    else playTone(a.color);                                                        // resto: un tono propio por color
    startFlash(`${cfg.icon} ${a.estado} · ${a.hora_texto}`, a.color);              // pestaña parpadeando
    popupAlert(a.color, title, body);                                              // ventana en la barra de tareas (si está activada)
  }
  function updateBell() {
    const b = document.getElementById("vgl-bell"); if (!b) return;
    const perm = (typeof Notification !== "undefined") ? Notification.permission : "unsupported";
    b.classList.toggle("on", perm === "granted");
    b.classList.toggle("off", perm === "denied");
    b.textContent = perm === "granted" ? "Alertas ✓" : perm === "denied" ? "Alertas ✕" : "Alertas";
    b.title = perm === "granted" ? "Notificaciones de Windows activas" : perm === "denied" ? "BLOQUEADAS: candado de la barra de direcciones → Notificaciones → Permitir" : "Activar notificaciones de Windows";
  }
  // Prueba manual: dispara una de cada color para verificar que Windows las muestra.
  function testNotifications() {
    if (typeof Notification === "undefined") { setSummary("Este navegador no soporta notificaciones de escritorio.", "error"); return; }
    if (Notification.permission === "denied") {
      setSummary("Notificaciones BLOQUEADAS: clic en el candado de la barra de direcciones → Notificaciones → Permitir, y recarga.", "error");
      showToast("ROJO", "⛔ Prueba (solo navegador)", "Windows está bloqueado para este sitio. Actívalo en el candado de la barra de direcciones.", true);
      return;
    }
    if (Notification.permission !== "granted") { setSummary("Pulsa «Permitir» en el aviso del navegador…"); enableOsNotifications(); return; }
    // Permiso concedido: dispara en Windows Y muestra un aviso dentro del navegador (para comparar).
    const t = new Date().toLocaleTimeString();
    osNotify("ROJO", "⛔ Prueba " + t + " · En Sala", "PACIENTE DE PRUEBA\nConfirmación extemporánea (FRAUDE)", true);
    osNotify("MORADO", "⏳ Prueba " + t + " · Sin presentarse", "PACIENTE DE PRUEBA\nÚltima llamada: ~1 min para confirmar", true);
    showToast("AZUL", "🛡️ Respaldo activo (dentro del navegador)", "Si ves ESTE aviso pero no el de Windows, no pasa nada: seguirás recibiendo todas las alertas aquí.\n\nPara activar además las de Windows: Configuración → Sistema → Notificaciones → activa «No molestar: desactivado» y busca " + BROWSER_NAME + " en la lista de aplicaciones.", true);
    // Ejercita los canales que NO dependen de Windows.
    const pt = "⛔ PRUEBA " + t + " · En Sala", pb = "PACIENTE DE PRUEBA\nConfirmación extemporánea (FRAUDE)";
    startNag("ROJO"); bigAlert("ROJO", pt, pb); startFlash("⛔ PRUEBA de alerta", "ROJO"); popupAlert("ROJO", pt, pb);
    setSummary("Prueba enviada: cartel + sonido insistente + pestaña parpadeando. Pulsa «Entendido» para reconocer.");
  }
  function enableOsNotifications() {
    try {
      if (typeof Notification === "undefined") { setSummary("Este navegador no soporta notificaciones de escritorio.", "warn"); return; }
      Notification.requestPermission().then((p) => {
        state.osNotif = (p === "granted");
        if (p === "granted") notify("AZUL", "🔔 Avisos activados", "Recibirás fraude e inasistencia como notificación de Windows, aunque estés en otra ventana.", false);
        else setSummary("Permiso denegado: los avisos saldrán dentro del navegador.", "warn");
        updateBell();
      });
    } catch (e) {}
  }

  // ---- CLON INVISIBLE: iframe fijado en "Citas del día", misma sesión (cookies compartidas) ----
  function citasUrl() { return CLONE.url || (location.origin + CONFIG.AGENDA_PATH); }
  function ensureClone() {
    if (CLONE.frame || !document.body) return;
    const f = document.createElement("iframe");
    f.id = "vgl-clone"; f.setAttribute("aria-hidden", "true"); f.setAttribute("tabindex", "-1");
    // sandbox SIN allow-top-navigation: la copia puede renderizar y leerse (allow-same-origin),
    // pero NO puede redirigir tu ventana de trabajo aunque la app intente "romper" el iframe.
    f.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
    f.style.cssText = "position:fixed;left:-10000px;top:0;width:1366px;height:900px;opacity:0;pointer-events:none;border:0;";
    f.addEventListener("load", () => { try { installNetHooks(f.contentWindow); } catch (e) {} });
    f.src = citasUrl();
    document.body.appendChild(f); CLONE.frame = f;
    console.log("[Vigilante] clon invisible creado ->", f.src);
  }
  function cloneDoc() { try { const d = CLONE.frame && CLONE.frame.contentWindow && CLONE.frame.contentWindow.document; return (d && d.querySelectorAll(CONFIG.SEL.hora).length) ? d : null; } catch (e) { return null; } }
  function destroyClone() { try { if (CLONE.frame) { CLONE.frame.remove(); CLONE.frame = null; } } catch (e) {} }
  function reloadClone() { try { if (state.leader && CLONE.frame) CLONE.frame.src = citasUrl(); } catch (e) {} }
  function healClone() { if (state.leader && !cloneDoc()) reloadClone(); }

  // ---- Captura de red (para posible polling directo del API) ----
  function redact(v, depth) {
    if (depth > 4) return "…"; if (v === null) return null;
    if (Array.isArray(v)) return v.slice(0, 2).map((x) => redact(x, depth + 1));
    if (typeof v === "object") { const o = {}; let i = 0; for (const k in v) { if (i++ > 40) break; o[k] = redact(v[k], depth + 1); } return o; }
    if (typeof v === "string") return "···"; if (typeof v === "number") return 0; if (typeof v === "boolean") return false; return typeof v;
  }
  function logNet(method, url, status, ct, text) {
    try { if (state.netlog.length > 40 || !ct || !ct.includes("json") || !text) return; let shape = null; try { shape = redact(JSON.parse(text), 0); } catch (e) { return; } const base = (url || "").split("?")[0]; const hasQ = (url || "").includes("?"); state.netlog.push({ method: method || "GET", url: base + (hasQ ? "?…" : ""), status, muestra: shape }); } catch (e) {}
  }
  function installNetHooks(win) {
    win = win || window;
    try {
      const of = win.fetch;
      if (typeof of === "function" && !of.__vgl) {
        win.fetch = function (...a) { return of.apply(this, a).then((r) => { try { const ct = r.headers.get("content-type") || ""; if (ct.includes("json")) r.clone().text().then((t) => logNet((a[1] && a[1].method) || "GET", (typeof a[0] === "string" ? a[0] : a[0] && a[0].url) || "", r.status, ct, t)).catch(() => {}); } catch (e) {} return r; }); };
        win.fetch.__vgl = true;
      }
      const XHR = win.XMLHttpRequest && win.XMLHttpRequest.prototype;
      if (XHR && !XHR.__vgl) {
        const oo = XHR.open, os = XHR.send;
        XHR.open = function (m, u) { this.__vgl = { m, u }; return oo.apply(this, arguments); };
        XHR.send = function () { this.addEventListener("load", () => { try { const ct = this.getResponseHeader("content-type") || ""; if (ct.includes("json")) logNet(this.__vgl ? this.__vgl.m : "GET", this.__vgl ? this.__vgl.u : "", this.status, ct, this.responseText); } catch (e) {} }); return os.apply(this, arguments); };
        XHR.__vgl = true;
      }
    } catch (e) {}
  }

  // ---- Overlay ----
  let el = {};
  let winState = "full";
  // Controles de ventana estilo macOS: full / min (solo barra) / dock (pastilla flotante).
  function setWinState(s) { winState = s; if (!el.root) return; el.root.classList.toggle("min", s === "min"); el.root.style.display = (s === "dock") ? "none" : "flex"; if (el.dock) el.dock.style.display = (s === "dock") ? "flex" : "none"; }
  function buildOverlay() {
    const style = document.createElement("style");
    style.textContent = `
      #vgl-root{position:fixed;bottom:22px;right:22px;width:460px;max-height:74vh;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden;border-radius:18px;
        background:rgba(28,28,30,.72);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%);
        border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 70px rgba(0,0,0,.55),0 2px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08);
        color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-size:13px}
      #vgl-root *{box-sizing:border-box}
      #vgl-head{height:42px;display:flex;align-items:center;gap:10px;padding:0 14px;cursor:move;user-select:none;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(rgba(255,255,255,.05),rgba(255,255,255,0))}
      #vgl-tls{display:flex;align-items:center;gap:8px}
      .vgl-tl{width:13px;height:13px;border-radius:50%;cursor:pointer;border:0;padding:0;transition:filter .15s;font-size:10px;line-height:13px;text-align:center;color:transparent;font-weight:700;font-family:-apple-system,'Segoe UI',sans-serif}
      #vgl-tls:hover .vgl-tl{color:rgba(0,0,0,.55)}
      .vgl-tl:hover{filter:brightness(1.12)}
      .vgl-tl.close{background:#ff5f57}.vgl-tl.min{background:#febc2e}.vgl-tl.zoom{background:#28c840}
      #vgl-title{flex:1;text-align:center;font-weight:600;font-size:13px;letter-spacing:.2px;color:#f5f5f7;opacity:.95}
      #vgl-title small{opacity:.5;font-weight:500;margin-left:5px;font-size:11px}
      #vgl-dot{width:8px;height:8px;border-radius:50%;background:#8e8e93;flex:0 0 auto;transition:background .3s,box-shadow .3s}
      #vgl-dot.bg{background:#30d158;box-shadow:0 0 8px rgba(48,209,88,.85)}
      #vgl-dot.page{background:#0a84ff;box-shadow:0 0 8px rgba(10,132,255,.75)}
      #vgl-dot.stale{background:#ff9f0a;box-shadow:0 0 8px rgba(255,159,10,.75)}
      #vgl-tools{display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.07);flex-wrap:wrap}
      .vgl-btn{appearance:none;border:0;border-radius:9px;padding:6px 11px;font-size:12px;font-weight:500;cursor:pointer;color:#f5f5f7;background:rgba(255,255,255,.08);transition:background .15s,transform .1s;font-family:inherit;white-space:nowrap}
      .vgl-btn:hover{background:rgba(255,255,255,.15)}
      .vgl-btn:active{transform:scale(.96)}
      .vgl-btn.primary{background:#0a84ff;color:#fff;font-weight:600;box-shadow:0 2px 8px rgba(10,132,255,.4)}
      .vgl-btn.primary:hover{background:#3a9bff}
      .vgl-btn.on{background:rgba(48,209,88,.22);color:#30d158;font-weight:600}
      .vgl-btn.off{background:rgba(255,69,58,.20);color:#ff453a;font-weight:600}
      #vgl-sum{font-size:11.5px;color:rgba(245,245,247,.72);padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.06);font-weight:500;letter-spacing:.1px}
      #vgl-sum.warn{color:#ffd60a}#vgl-sum.error{color:#ff6961}
      #vgl-stats{display:flex;gap:6px;padding:0 12px 9px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.06)}
      #vgl-stats:empty{display:none}
      .vgl-stat{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:500;color:rgba(245,245,247,.62);background:rgba(255,255,255,.05);padding:3px 9px;border-radius:8px}
      .vgl-stat b{font-weight:700;color:#f5f5f7;font-variant-numeric:tabular-nums}
      .vgl-stat .d{width:7px;height:7px;border-radius:50%;flex:0 0 auto}
      @keyframes vglPulse{0%,100%{box-shadow:0 0 8px rgba(48,209,88,.85),0 0 0 0 rgba(48,209,88,.45)}50%{box-shadow:0 0 8px rgba(48,209,88,.85),0 0 0 6px rgba(48,209,88,0)}}
      #vgl-dot.bg{animation:vglPulse 2.4s ease-out infinite}
      @keyframes vglCardIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      .vgl-card{animation:vglCardIn .26s ease both}
      #vgl-list{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px}
      #vgl-list::-webkit-scrollbar{width:9px}
      #vgl-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:6px;border:2px solid transparent;background-clip:content-box}
      #vgl-list::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.32);background-clip:content-box}
      #vgl-root.stale #vgl-list{opacity:.75}
      .vgl-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);border-radius:13px;padding:9px 11px;transition:background .15s}
      .vgl-card:hover{background:rgba(255,255,255,.09)}
      .vgl-card.rojo{background:rgba(255,69,58,.10);border-color:rgba(255,69,58,.35);box-shadow:0 0 0 1px rgba(255,69,58,.15)}
      .vgl-row{display:flex;align-items:center;gap:9px}
      .vgl-cdot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
      .vgl-time{font-weight:600;font-size:13px;color:#f5f5f7;white-space:nowrap;font-variant-numeric:tabular-nums}
      .vgl-name{font-size:12.5px;color:rgba(245,245,247,.9);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
      .vgl-name b{font-weight:600;color:#fff}
      .vgl-doc{color:rgba(245,245,247,.45);font-weight:400}
      .vgl-badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:7px;white-space:nowrap;letter-spacing:.2px}
      .vgl-pyms{margin-top:7px;display:flex;flex-wrap:wrap;gap:4px}
      .vgl-chip{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;background:rgba(10,132,255,.16);color:#5aa9ff;white-space:nowrap}
      .vgl-none{margin-top:6px;font-size:11px;color:rgba(245,245,247,.4);font-style:italic}
      #vgl-empty{color:rgba(245,245,247,.5);text-align:center;padding:26px 10px;font-size:12px;line-height:1.5}
      #vgl-root.min #vgl-tools,#vgl-root.min #vgl-sum,#vgl-root.min #vgl-stats,#vgl-root.min #vgl-list{display:none}
      #vgl-dock{position:fixed;bottom:22px;right:22px;z-index:2147483647;display:none;align-items:center;gap:8px;cursor:pointer;padding:9px 14px;border-radius:14px;
        background:rgba(28,28,30,.72);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%);
        border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 34px rgba(0,0,0,.5);color:#f5f5f7;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;font-size:12.5px;font-weight:600;transition:transform .12s}
      #vgl-dock:hover{transform:translateY(-1px)}
      #vgl-dock-dot{width:9px;height:9px;border-radius:50%;background:#30d158;box-shadow:0 0 8px rgba(48,209,88,.85)}
      #vgl-toasts{position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;flex-direction:column;gap:10px;max-width:390px;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;pointer-events:none}
      .vgl-toast{display:flex;gap:11px;align-items:flex-start;padding:13px 14px;border-radius:16px;pointer-events:auto;
        background:rgba(40,40,44,.82);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%);
        border:1px solid rgba(255,255,255,.12);box-shadow:0 16px 44px rgba(0,0,0,.5);animation:vglIn .32s cubic-bezier(.2,.9,.3,1)}
      @keyframes vglIn{from{opacity:0;transform:translateX(24px) scale(.98)}to{opacity:1;transform:none}}
      .vgl-toast-ic{width:34px;height:34px;border-radius:9px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:18px}
      .vgl-toast-main{flex:1;min-width:0}
      .vgl-toast-title{font-weight:600;font-size:13px;color:#fff;letter-spacing:.1px}
      .vgl-toast-b{margin-top:3px;font-size:12px;color:rgba(245,245,247,.75);white-space:pre-line;line-height:1.4}
      .vgl-toast-x{cursor:pointer;color:rgba(245,245,247,.5);font-size:16px;line-height:1;padding:2px 5px;border-radius:6px}
      .vgl-toast-x:hover{background:rgba(255,255,255,.12);color:#fff}
      #vgl-modal{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:vglIn .25s ease}
      .vgl-modal-card{background:rgba(32,32,36,.96);border:2px solid #ff453a;border-radius:20px;padding:28px 32px;max-width:460px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.6);font-family:-apple-system,'Segoe UI',system-ui,sans-serif}
      .vgl-modal-dot{width:18px;height:18px;border-radius:50%;margin:0 auto 14px}
      .vgl-modal-t{font-size:18px;font-weight:700;color:#fff;margin-bottom:8px}
      .vgl-modal-b{font-size:14px;color:rgba(245,245,247,.82);white-space:pre-line;line-height:1.5}
      .vgl-modal-ok{margin-top:20px;border:0;border-radius:10px;padding:10px 26px;font-size:14px;font-weight:700;color:#001;cursor:pointer;font-family:inherit}
    `;
    document.head.appendChild(style);
    const root = document.createElement("div"); root.id = "vgl-root";
    root.innerHTML = `
      <div id="vgl-head">
        <div id="vgl-tls">
          <button class="vgl-tl close" id="vgl-tl-close" title="Ocultar (se colapsa a una pastilla)">×</button>
          <button class="vgl-tl min" id="vgl-tl-min" title="Minimizar (solo la barra)">−</button>
          <button class="vgl-tl zoom" id="vgl-tl-zoom" title="Restaurar tamaño completo">+</button>
        </div>
        <div id="vgl-title">Vigilante PyM<small>v${VERSION}</small></div>
        <span id="vgl-dot" title="origen de datos"></span>
      </div>
      <div id="vgl-tools">
        <button class="vgl-btn primary" id="vgl-sp" title="Traer el PyM de hoy desde SharePoint">PyM hoy</button>
        <button class="vgl-btn" id="vgl-load" title="Cargar PyM desde un archivo">Abrir</button>
        <button class="vgl-btn" id="vgl-bell" title="Activar notificaciones de Windows">Alertas</button>
        <button class="vgl-btn" id="vgl-pop" title="Ventana emergente de alerta (aparece en la barra de tareas de Windows)">Ventana</button>
        <button class="vgl-btn" id="vgl-test" title="Probar las notificaciones">Probar</button>
        <button class="vgl-btn" id="vgl-diag" title="Diagnóstico (sin datos de pacientes)">Diag</button>
      </div>
      <div id="vgl-sum">Iniciando monitoreo…</div>
      <div id="vgl-stats"></div>
      <div id="vgl-list"><div id="vgl-empty">Preparando copia en segundo plano…</div></div>
      <input type="file" id="vgl-file" accept=".xlsx,.xlsm,.csv" style="display:none">
    `;
    document.body.appendChild(root);
    el = { root, sum: root.querySelector("#vgl-sum"), stats: root.querySelector("#vgl-stats"), list: root.querySelector("#vgl-list"), file: root.querySelector("#vgl-file"), dot: root.querySelector("#vgl-dot") };
    root.querySelector("#vgl-load").addEventListener("click", () => el.file.click());
    root.querySelector("#vgl-diag").addEventListener("click", downloadDiagnostic);
    root.querySelector("#vgl-bell").addEventListener("click", enableOsNotifications);
    root.querySelector("#vgl-sp").addEventListener("click", () => autoPymFromSharepoint(false));
    root.querySelector("#vgl-test").addEventListener("click", testNotifications);
    const pop = root.querySelector("#vgl-pop");
    const paintPop = () => { const on = localStorage.getItem("vgl_popup") === "1"; pop.classList.toggle("on", on); pop.textContent = on ? "Ventana ✓" : "Ventana"; };
    pop.addEventListener("click", () => {
      const on = localStorage.getItem("vgl_popup") === "1";
      localStorage.setItem("vgl_popup", on ? "0" : "1"); paintPop();
      if (!on) { popupAlert("AZUL", "🛡️ Ventana de alerta activada", "Así se verá una alerta.\nAparece en la barra de tareas de Windows."); setSummary("Ventana emergente activada. Si no apareció, permite «Ventanas emergentes» en el candado de la barra."); }
      else setSummary("Ventana emergente desactivada.");
    });
    paintPop();
    // Al volver a la pestaña o hacer clic en el panel: reconocer (apaga sonido y parpadeo).
    root.addEventListener("click", acknowledge);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") stopFlash(); });
    el.file.addEventListener("change", (e) => { if (e.target.files[0]) loadPymFile(e.target.files[0]); e.target.value = ""; });
    root.querySelector("#vgl-tl-close").addEventListener("click", () => setWinState("dock"));
    root.querySelector("#vgl-tl-min").addEventListener("click", () => setWinState(winState === "min" ? "full" : "min"));
    root.querySelector("#vgl-tl-zoom").addEventListener("click", () => setWinState("full"));
    root.querySelector("#vgl-head").addEventListener("dblclick", (e) => { if (e.target.closest("button")) return; setWinState(winState === "min" ? "full" : "min"); });
    const dock = document.createElement("div"); dock.id = "vgl-dock"; dock.title = "Mostrar Vigilante PyM";
    dock.innerHTML = `<span id="vgl-dock-dot"></span><span>Vigilante PyM</span>`;
    dock.addEventListener("click", () => setWinState("full"));
    document.body.appendChild(dock); el.dock = dock;
    const toasts = document.createElement("div"); toasts.id = "vgl-toasts"; document.body.appendChild(toasts);
    makeDraggable(root, root.querySelector("#vgl-head"));
    updateBell();
  }
  function makeDraggable(root, handle) {
    let dx = 0, dy = 0, dragging = false;
    handle.addEventListener("mousedown", (e) => { if (e.target.closest("button")) return; dragging = true; const r = root.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; root.style.bottom = "auto"; root.style.right = "auto"; e.preventDefault(); });
    document.addEventListener("mousemove", (e) => { if (!dragging) return; root.style.left = Math.max(0, e.clientX - dx) + "px"; root.style.top = Math.max(0, e.clientY - dy) + "px"; });
    document.addEventListener("mouseup", () => { dragging = false; });
  }
  function setSummary(text, level) { if (!el.sum) return; el.sum.className = level || ""; el.sum.textContent = (level === "error" ? "⚠ " : level === "warn" ? "⏸ " : "") + text; }
  function signatureOf(list) { return list.map((a) => `${a.key}~${a.estado}~${a.color}~${a.pym.join("·")}`).join("||"); }
  // Barra de estadísticas: "En sala" = confirmadas del momento; "Atendidas" ya culminaron (no cuentan como actuales).
  function renderStats(list) {
    if (!el.stats) return;
    if (!list.length) { el.stats.innerHTML = ""; return; }
    let ensala = 0, pend = 0, atend = 0;
    for (const a of list) { const s = (a.estado || "").toLowerCase(); if (s.includes("en sala")) ensala++; else if (s.includes("sin presentarse")) pend++; else if (s.includes("atendido")) atend++; }
    el.stats.innerHTML =
      `<span class="vgl-stat"><span class="d" style="background:#30d158"></span>En sala <b>${ensala}</b></span>` +
      `<span class="vgl-stat"><span class="d" style="background:#ff9f0a"></span>Sin presentarse <b>${pend}</b></span>` +
      `<span class="vgl-stat"><span class="d" style="background:rgba(245,245,247,.4)"></span>Atendidas <b>${atend}</b></span>`;
  }

  function render(list, source, at) {
    const pymTxt = state.pymFile ? `PyM: ${state.pym.size}` : "PyM sin cargar";
    const hora = at ? at.toLocaleTimeString() : "—";
    if (el.dot) el.dot.className = source === "clon" ? "bg" : source === "pagina" ? "page" : source === "compartido" ? "page" : "stale";
    if (source === "clon") setSummary(`Vigilando (2.º plano) · ${list.length} cita(s) · act. ${hora} · ${pymTxt}`);
    else if (source === "pagina") setSummary(`En Citas del día · ${list.length} cita(s) · act. ${hora} · ${pymTxt}`);
    else if (source === "compartido") setSummary(`Espejo · ${list.length} cita(s) · act. ${hora} · ${pymTxt}`);
    else if (list.length) setSummary(`Última lectura ${hora} · reconectando copia… · ${pymTxt}`, "warn");
    else setSummary(`Preparando copia en segundo plano… · ${pymTxt}`);
    el.root.classList.toggle("stale", !source && list.length > 0);
    renderStats(list);

    const sig = (source || "C") + signatureOf(list);
    if (sig === state.lastSignature) return; state.lastSignature = sig;
    if (!list.length) { el.list.innerHTML = `<div id="vgl-empty">Aún sin citas.<br>Entra una vez a "Citas del día" para inicializar la copia.</div>`; return; }
    el.list.innerHTML = "";
    for (const a of list) {
      const col = COLORS[a.color] || COLORS.AZUL, tint = TINT[a.color] || TINT.AZUL;
      const card = document.createElement("div"); card.className = "vgl-card" + (a.color === "ROJO" ? " rojo" : "");
      const pyms = a.pym.length
        ? `<div class="vgl-pyms">${a.pym.map((p) => `<span class="vgl-chip">${escapeHtml(p)}</span>`).join("")}</div>`
        : `<div class="vgl-none">Sin PyM pendiente</div>`;
      card.innerHTML = `
        <div class="vgl-row">
          <span class="vgl-cdot" style="background:${col}"></span>
          <span class="vgl-time">${escapeHtml(a.hora_texto)}</span>
          <span class="vgl-name"><b>${escapeHtml(a.nombre)}</b>${a.doc_id ? ` <span class="vgl-doc">${escapeHtml(a.doc_id)}</span>` : ""}</span>
          <span class="vgl-badge" style="background:${tint};color:${col}">${escapeHtml(a.estado)}</span>
        </div>${pyms}`;
      el.list.appendChild(card);
    }
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // Saludo AZUL: UNA sola vez al día en todo el navegador (antes salía en cada pestaña/recarga).
  function helloOncePerDay(total, conf) {
    try { if (localStorage.getItem("vgl_hello") === todayStamp()) return; localStorage.setItem("vgl_hello", todayStamp()); } catch (e) {}
    notify("AZUL", "ℹ Vigilante activo", `${total} cita(s) en agenda · ${conf} en sala ahora`, false);
  }
  function tick() {
    try {
      const now = new Date();
      const leader = heartbeat();
      if (leader) ensureClone(); else destroyClone(); // una sola copia de fondo en todo el navegador
      let data = null, source = null;
      if (leader) { const cd = cloneDoc(); if (cd) { data = extractAgenda(cd); source = "clon"; } }
      if (!data || !data.citas.length) { const d2 = extractAgenda(document); if (d2.visible && d2.citas.length) { data = d2; source = "pagina"; CLONE.url = location.href; } }
      if (data && data.citas.length) {
        const processed = data.citas.map((a) => colorAndAlert(a, now));
        if (!state.summarized) {
          // Estado inicial: se SIEMBRA sin notificar (no-inferencia v2.5: solo eventos EN DIRECTO).
          state.summarized = true;
          processed.forEach((a) => state.notified.set(a.key, nkey(a)));
          if (leader) helloOncePerDay(processed.length, processed.filter((a) => /en sala/.test((a.estado || "").toLowerCase())).length);
        } else if (leader) {
          processed.forEach(maybeNotify);
        }
        state.lastSnapshot = { at: now, list: processed, source };
        if (leader) share(processed);
        render(processed, source, now);
      } else if (state.shared && Date.now() - state.shared.t < 60000) {
        render(state.shared.list, "compartido", new Date(state.shared.t));
      } else if (state.lastSnapshot) { render(state.lastSnapshot.list, null, state.lastSnapshot.at); }
      else { render([], null, null); }
    } catch (e) { console.error("[Vigilante] tick:", e); }
  }

  function downloadDiagnostic() {
    const ddoc = cloneDoc() || document; const KEEP = new Set(["class", "role", "routerlink", "type", "name"]); const out = [];
    const sels = [".labelHora", ".status-label", ".card", ".card-body", ".text-muted", ".text-uppercase", ".fw-bold.mb-0", ".fecha", ".text-uppercase.fw-bold"];
    const counts = {}; sels.forEach((s) => { try { counts[s] = ddoc.querySelectorAll(s).length; } catch (e) { counts[s] = "err"; } });
    const freq = {}; ddoc.querySelectorAll("*").forEach((n) => (n.classList ? [...n.classList] : []).forEach((c) => (freq[c] = (freq[c] || 0) + 1)));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 120);
    const san = (node) => { const c = node.cloneNode(true); const w = (x) => { if (x.nodeType === 3) { if (x.textContent && x.textContent.trim()) x.textContent = "···"; return; } if (x.nodeType !== 1) return; [...(x.attributes || [])].forEach((a) => { if (!KEEP.has(a.name) && !a.name.startsWith("data-")) x.removeAttribute(a.name); else if (a.name.startsWith("data-")) x.setAttribute(a.name, ""); }); [...x.childNodes].forEach(w); }; w(c); return c.outerHTML; };
    let card = ""; try { const h = ddoc.querySelector(".labelHora"); const c = h && containerOf(h); card = c ? san(c).slice(0, 15000) : "(no se encontró .labelHora)"; } catch (e) { card = "err: " + e; }
    out.push("===== DIAGNÓSTICO — VIGILANTE v" + VERSION + " =====", "Fecha: " + new Date().toISOString(), "Origen: " + (cloneDoc() ? "CLON" : "página"), "URL: " + location.href, "Título: " + document.title,
      "\n--- CONTEO DE SELECTORES ---", JSON.stringify(counts, null, 2),
      "\n--- CLASES MÁS FRECUENTES (top 120) ---", top.map(([c, n]) => n + "  ." + c).join("\n"),
      "\n--- PRIMERA TARJETA (HTML sanitizado) ---", card,
      "\n--- NOTIFICACIONES ---",
      "Soporte Notification: " + (typeof Notification !== "undefined"),
      "Permiso actual: " + (typeof Notification !== "undefined" ? Notification.permission : "n/a"),
      "Visibilidad de la pestaña: " + document.visibilityState,
      "\n--- RED: endpoints JSON vistos (VALORES REDACTADOS) ---", JSON.stringify(state.netlog.slice(0, 15), null, 2));
    const blob = new Blob([out.join("\n")], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "diagnostico_vigilante_SANITIZADO.txt"; document.body.appendChild(a); a.click(); a.remove();
    setSummary("Diagnóstico descargado. Revisa Descargas.");
  }

  function bootSharepoint() { runSharepointHarvester(); }

  function boot() {
    if (document.getElementById("vgl-root")) return;
    installNetHooks(window);
    buildOverlay();
    heartbeat();
    tick();
    setInterval(tick, CONFIG.POLL_MS);
    setInterval(healClone, CONFIG.CLONE_HEAL_MS);
    setInterval(reloadClone, CONFIG.CLONE_REFRESH_MS);
    // PyM del día: primero la caché de hoy; si no hay, se intenta traer de SharePoint en silencio.
    if (!loadPymFromCache()) autoPymFromSharepoint(true);
    // Re-chequeo: si cambia el día (turno que cruza medianoche) o aún no hay PyM, reintenta.
    setInterval(() => { if (!cacheIsToday() || !state.pymFile) { if (!loadPymFromCache()) autoPymFromSharepoint(true); } }, 15 * 60 * 1000);
    console.log("[Vigilante] userscript v" + VERSION + " activo (líder único + clon 2.º plano + PyM automático).");
  }

  const IS_SP = /sharepoint\.com$/i.test(location.hostname);
  if (!IS_SP) installNetHooks(window); // document-start: capturar endpoints JSON desde el arranque
  const start = IS_SP ? bootSharepoint : boot;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
