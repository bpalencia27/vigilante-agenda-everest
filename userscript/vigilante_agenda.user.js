// ==UserScript==
// @name         Vigilante de Agenda — Copiloto Everest PyM
// @namespace    vigilante-agenda-everest
// @version      3.8.1
// @description  Vigila "Citas del día" de Everest EN SEGUNDO PLANO (copia invisible que comparte la sesión), muestra PyM susceptibles y lanza notificaciones de Windows por colores (VERDE/ÁMBAR/ROJO/AZUL) que salen por encima de cualquier ventana. Sin .exe ni dependencias de internet: no dispara antivirus.
// @author       bpalencia27
// @match        *://neps.everestintelligent.com/*
// @match        *://*.everestintelligent.com/*
// @run-at       document-start
// @noframes
// @grant        none
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
  const VERSION = "3.8.1"; // fuente única de la versión (título + diagnóstico)

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
    SEL: {
      hora: ".labelHora", estado: ".status-label", contenedor: [".card-body", ".card"],
      documento: ".text-muted", nombre: [".text-uppercase.fw-bold", ".text-uppercase"],
      modalidad: ".fw-bold.mb-0", fecha: ".fecha",
    },
  };
  const COLORS = { VERDE: "#10B981", AMBAR: "#F59E0B", ROJO: "#EF4444", AZUL: "#3B82F6", MORADO: "#8B5CF6" };
  const BADGE = { VERDE: "#047857", AMBAR: "#B45309", ROJO: "#B91C1C", AZUL: "#1D4ED8", MORADO: "#6D28D9" };
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
  };
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

  function applyPym(headers, rows, fileName) {
    state.pym = indexRows(headers, rows); state.pymFile = fileName;
    if (state.lastSnapshot) state.lastSnapshot.list.forEach((a) => { a.pym = getActivities(a.doc_id); });
    state.lastSignature = ""; tick(); setSummary(`PyM cargado: ${state.pym.size} paciente(s) — ${fileName}`);
  }
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
    const grace = CONFIG.TOLERANCIA_MIN, prealert = CONFIG.TOLERANCIA_MIN - 1.0; let color = "AZUL", sound = false, reason = "";
    if (st.includes("en sala")) { if (state.fraudWatch.has(key)) { color = "ROJO"; if (!state.alertedFraud.has(key)) { sound = true; state.alertedFraud.add(key); } } else color = "VERDE"; }
    else if (st.includes("atendido")) { color = state.alertedFraud.has(key) ? "ROJO" : "VERDE"; }
    else if (st.includes("sin presentarse")) { if (elapsed >= grace) { color = "AMBAR"; state.fraudWatch.add(key); } else if (elapsed >= prealert) { color = "MORADO"; reason = "tiempo"; } else color = "AZUL"; }
    else { if (elapsed >= prealert) { color = "MORADO"; reason = "tiempo"; } else if (pym.length >= 3) { color = "MORADO"; reason = "pym"; } else color = "AZUL"; }
    const prev = state.historical.get(key) || "";
    if (sound) state.events.push({ t: new Date().toLocaleString(), ev: "FRAUDE_EXTEMPORANEO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado });
    else if (st !== prev && prev !== "") state.events.push({ t: new Date().toLocaleString(), ev: "CAMBIO_ESTADO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, previo: prev });
    state.historical.set(key, st);
    return { ...a, key, color, reason, sound, elapsed: Math.round(elapsed * 10) / 10, pym };
  }

  let audioCtx = null;
  function beep(freq, ms, off) { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value = freq; o.type = "square"; const t0 = audioCtx.currentTime + off; g.gain.setValueAtTime(0.15, t0); o.start(t0); o.stop(t0 + ms / 1000); } catch (e) {} }
  function fraudSound() { beep(1000, 400, 0); beep(1200, 400, 0.45); }

  // ---- NOTIFICACIONES POR COLORES (recuperado de la v2.5): toast en Windows + respaldo en la página ----
  function colorDot(color) {
    const c = COLORS[color] || COLORS.AZUL;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="${c}"/></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  // Anti-duplicado entre pestañas: si otra pestaña de Everest ya lanzó este aviso hace <12s, no repetir.
  function crossTabDup(id) { try { const k = "vgl_n_" + id, now = Date.now(), prev = +(localStorage.getItem(k) || 0); if (now - prev < 12000) return true; localStorage.setItem(k, String(now)); return false; } catch (e) { return false; } }
  function osNotify(color, title, body, persist) {
    try { if (typeof Notification === "undefined" || Notification.permission !== "granted") return; if (crossTabDup("os|" + title)) return; new Notification(title, { body, icon: colorDot(color), badge: colorDot(color), requireInteraction: !!persist, tag: title, renotify: true }); } catch (e) {}
  }
  function showToast(color, title, body, persist) {
    try {
      const wrap = document.getElementById("vgl-toasts"); if (!wrap) return;
      const c = COLORS[color] || COLORS.AZUL;
      const t = document.createElement("div"); t.className = "vgl-toast"; t.style.borderLeftColor = c;
      t.innerHTML = `<div class="vgl-toast-h"><span class="vgl-toast-dot" style="background:${c}"></span><span class="vgl-toast-title"></span><span class="vgl-toast-x">×</span></div><div class="vgl-toast-b"></div>`;
      t.querySelector(".vgl-toast-title").textContent = title;
      t.querySelector(".vgl-toast-b").textContent = body;
      t.querySelector(".vgl-toast-x").addEventListener("click", () => t.remove());
      wrap.appendChild(t);
      while (wrap.children.length > 6) wrap.removeChild(wrap.firstChild);
      if (!persist) setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 8000);
    } catch (e) {}
  }
  function notify(color, title, body, persist) { showToast(color, title, body, persist); osNotify(color, title, body, persist); }
  const NOTIFY = {
    ROJO: { icon: "⛔", label: "Confirmación extemporánea (FRAUDE)", sound: true, persist: true },
    MORADO: { icon: "⏳", label: "Última llamada: ~1 min para confirmar o pierde la cita", persist: true },
    AMBAR: { icon: "⚠", label: "Inasistencia registrada", persist: true },
  };
  // Clave de notificación: el MORADO se distingue por motivo (tiempo vs 3+ PyM) para no confundirlos.
  function nkey(a) { return a.color === "MORADO" ? "MORADO:" + (a.reason || "") : a.color; }
  function maybeNotify(a) {
    const k = nkey(a); const prev = state.notified.get(a.key); if (prev === k) return; state.notified.set(a.key, k);
    if (a.color === "MORADO" && a.reason !== "tiempo") return; // el morado por "3+ PyM" no es urgente: no se notifica
    const cfg = NOTIFY[a.color]; if (!cfg) return;
    notify(a.color, `${cfg.icon} ${a.hora_texto} · ${a.estado}`, `${a.nombre}${a.doc_id ? " (" + a.doc_id + ")" : ""}\n${cfg.label}`, cfg.persist);
    if (cfg.sound) fraudSound();
  }
  function updateBell() { const b = document.getElementById("vgl-bell"); if (!b) return; const g = (typeof Notification !== "undefined" && Notification.permission === "granted"); b.textContent = g ? "🔔" : "🔕"; b.title = g ? "Notificaciones de Windows activas" : "Activar notificaciones de Windows"; }
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
  function reloadClone() { try { if (CLONE.frame) CLONE.frame.src = citasUrl(); } catch (e) {} }
  function healClone() { if (!cloneDoc()) reloadClone(); }

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
  function buildOverlay() {
    const style = document.createElement("style");
    style.textContent = `
      #vgl-root{position:fixed;bottom:20px;right:20px;width:452px;max-height:72vh;z-index:2147483647;
        background:#0B1220;border:1px solid #3B4B63;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.55);
        font-family:'Segoe UI',system-ui,sans-serif;color:#F1F5F9;display:flex;flex-direction:column;overflow:hidden}
      #vgl-root *{box-sizing:border-box}
      #vgl-head{background:#182338;padding:8px 10px;display:flex;align-items:center;gap:6px;cursor:move;user-select:none}
      #vgl-title{font-weight:800;font-size:13px;flex:1;color:#FFFFFF!important}
      #vgl-dot{width:9px;height:9px;border-radius:50%;background:#64748B;flex:0 0 auto}
      #vgl-dot.bg{background:#22C55E;box-shadow:0 0 6px #22C55E}
      #vgl-dot.page{background:#38BDF8}
      #vgl-dot.stale{background:#F59E0B}
      .vgl-btn{background:#0284C7;color:#fff!important;border:none;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:700;cursor:pointer}
      .vgl-btn:hover{background:#0369A1}.vgl-btn.sec{background:#3B4B63}.vgl-btn.sec:hover{background:#4B5E7A}
      #vgl-sum{font-size:11px;color:#CBD5E1!important;padding:7px 10px;border-bottom:1px solid #1E293B;font-weight:600}
      #vgl-sum.warn{color:#FCD34D!important;background:#3a2e0a}#vgl-sum.error{color:#FCA5A5!important;background:#3a1414}
      #vgl-list{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;background:#0B1220}
      #vgl-root.stale #vgl-list{opacity:.8}
      .vgl-card{background:#1B2740;border-left:5px solid #3B82F6;border-radius:6px;padding:8px 10px}
      .vgl-row{display:flex;align-items:center;gap:8px}
      .vgl-time{font-weight:800;font-size:13px;color:#FFFFFF!important;white-space:nowrap}
      .vgl-name{font-size:12.5px;color:#F1F5F9!important;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
      .vgl-badge{font-size:10.5px;font-weight:800;color:#FFFFFF!important;padding:3px 8px;border-radius:5px;white-space:nowrap;letter-spacing:.2px}
      .vgl-pym{font-size:11.5px;margin-top:5px;color:#93E0FF!important;font-weight:700;line-height:1.35}
      .vgl-pym.none{color:#8CA0B8!important;font-weight:500;font-style:italic}
      #vgl-empty{color:#94A3B8;font-style:italic;text-align:center;padding:24px 8px;font-size:12px}
      #vgl-root.min #vgl-sum,#vgl-root.min #vgl-list{display:none}
      #vgl-toasts{position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;max-width:370px;font-family:'Segoe UI',system-ui,sans-serif;pointer-events:none}
      .vgl-toast{background:#0B1220;border:1px solid #3B4B63;border-left:6px solid #3B82F6;border-radius:8px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.55);transition:opacity .35s;pointer-events:auto}
      .vgl-toast-h{display:flex;align-items:center;gap:8px}
      .vgl-toast-dot{width:12px;height:12px;border-radius:50%;flex:0 0 auto}
      .vgl-toast-title{font-weight:800;font-size:13px;color:#FFFFFF!important;flex:1}
      .vgl-toast-x{cursor:pointer;color:#94A3B8;font-size:18px;line-height:1;padding:0 2px}
      .vgl-toast-b{margin-top:5px;font-size:12px;color:#E2E8F0!important;white-space:pre-line;line-height:1.35}
    `;
    document.head.appendChild(style);
    const root = document.createElement("div"); root.id = "vgl-root";
    root.innerHTML = `
      <div id="vgl-head">
        <span id="vgl-dot" title="origen de datos"></span>
        <span id="vgl-title">Vigilante PyM v${VERSION}</span>
        <button class="vgl-btn" id="vgl-load">Cargar PyM</button>
        <button class="vgl-btn sec" id="vgl-bell" title="Activar notificaciones de Windows">🔕</button>
        <button class="vgl-btn sec" id="vgl-diag" title="Diagnóstico DOM + red (redactado)">Diag</button>
        <button class="vgl-btn sec" id="vgl-min">_</button>
      </div>
      <div id="vgl-sum">● Iniciando monitoreo…</div>
      <div id="vgl-list"><div id="vgl-empty">Preparando copia en segundo plano…</div></div>
      <input type="file" id="vgl-file" accept=".xlsx,.xlsm,.csv" style="display:none">
    `;
    document.body.appendChild(root);
    el = { root, sum: root.querySelector("#vgl-sum"), list: root.querySelector("#vgl-list"), file: root.querySelector("#vgl-file"), dot: root.querySelector("#vgl-dot") };
    root.querySelector("#vgl-load").addEventListener("click", () => el.file.click());
    root.querySelector("#vgl-diag").addEventListener("click", downloadDiagnostic);
    root.querySelector("#vgl-min").addEventListener("click", () => { state.minimized = !state.minimized; root.classList.toggle("min", state.minimized); });
    el.file.addEventListener("change", (e) => { if (e.target.files[0]) loadPymFile(e.target.files[0]); e.target.value = ""; });
    root.querySelector("#vgl-bell").addEventListener("click", enableOsNotifications);
    const toasts = document.createElement("div"); toasts.id = "vgl-toasts"; document.body.appendChild(toasts);
    makeDraggable(root, root.querySelector("#vgl-head"));
    updateBell();
  }
  function makeDraggable(root, handle) {
    let dx = 0, dy = 0, dragging = false;
    handle.addEventListener("mousedown", (e) => { dragging = true; const r = root.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; root.style.bottom = "auto"; root.style.right = "auto"; e.preventDefault(); });
    document.addEventListener("mousemove", (e) => { if (!dragging) return; root.style.left = Math.max(0, e.clientX - dx) + "px"; root.style.top = Math.max(0, e.clientY - dy) + "px"; });
    document.addEventListener("mouseup", () => { dragging = false; });
  }
  function setSummary(text, level) { if (!el.sum) return; el.sum.className = level || ""; el.sum.textContent = (level === "error" ? "⚠ " : level === "warn" ? "⏸ " : "● ") + text; }
  function signatureOf(list) { return list.map((a) => `${a.key}~${a.estado}~${a.color}~${a.pym.join("·")}`).join("||"); }

  function render(list, source, at) {
    const pymTxt = state.pymFile ? `PyM: ${state.pym.size}` : "PyM sin cargar";
    if (el.dot) el.dot.className = source === "clon" ? "bg" : source === "pagina" ? "page" : "stale";
    if (source === "clon") setSummary(`Clon en 2.º plano · ${list.length} cita(s) · refresca ${CONFIG.POLL_MS / 1000}s · ${pymTxt}`);
    else if (source === "pagina") setSummary(`En Citas del día · ${list.length} cita(s) · refresca ${CONFIG.POLL_MS / 1000}s · ${pymTxt}`);
    else if (list.length) setSummary(`Última lectura ${at ? at.toLocaleTimeString() : "—"} · reconectando copia… · ${pymTxt}`, "warn");
    else setSummary(`Preparando copia en segundo plano… · ${pymTxt}`);
    el.root.classList.toggle("stale", !source && list.length > 0);

    const sig = (source || "C") + signatureOf(list);
    if (sig === state.lastSignature) return; state.lastSignature = sig;
    if (!list.length) { el.list.innerHTML = `<div id="vgl-empty">Aún sin citas.<br>Entra una vez a "Citas del día" para inicializar la copia.</div>`; return; }
    el.list.innerHTML = "";
    for (const a of list) {
      const border = COLORS[a.color] || COLORS.AZUL, badge = BADGE[a.color] || BADGE.AZUL;
      const card = document.createElement("div"); card.className = "vgl-card"; card.style.borderLeftColor = border;
      const pymTxt2 = a.pym.length ? a.pym.join(" · ") : "Sin actividades PyM pendientes";
      card.innerHTML = `
        <div class="vgl-row">
          <span class="vgl-time">${escapeHtml(a.hora_texto)}</span>
          <span class="vgl-name">${escapeHtml(a.nombre)} ${a.doc_id ? "(" + escapeHtml(a.doc_id) + ")" : ""}</span>
          <span class="vgl-badge" style="background:${badge}">${escapeHtml(a.estado)}</span>
        </div>
        <div class="vgl-pym ${a.pym.length ? "" : "none"}">📋 ${escapeHtml(pymTxt2)}</div>`;
      el.list.appendChild(card);
    }
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function tick() {
    try {
      const now = new Date();
      let data = null, source = null;
      const cd = cloneDoc();
      if (cd) { data = extractAgenda(cd); source = "clon"; }
      if (!data || !data.citas.length) { const d2 = extractAgenda(document); if (d2.visible && d2.citas.length) { data = d2; source = "pagina"; CLONE.url = location.href; } }
      if (data && data.citas.length) {
        const processed = data.citas.map((a) => colorAndAlert(a, now));
        if (!state.summarized) {
          // Estado inicial: se SIEMBRA sin notificar (política de no-inferencia de la v2.5;
          // solo se alerta de eventos que ocurran EN DIRECTO tras la activación).
          state.summarized = true;
          processed.forEach((a) => state.notified.set(a.key, nkey(a)));
          const conf = processed.filter((a) => /en sala|atendido/.test((a.estado || "").toLowerCase())).length;
          notify("AZUL", "ℹ Vigilante activo", `${processed.length} cita(s) en agenda · ${conf} ya confirmada(s)`, false);
        } else {
          processed.forEach(maybeNotify);
        }
        state.lastSnapshot = { at: now, list: processed, source }; render(processed, source, now);
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
      "\n--- RED: endpoints JSON vistos (VALORES REDACTADOS) ---", JSON.stringify(state.netlog.slice(0, 15), null, 2));
    const blob = new Blob([out.join("\n")], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "diagnostico_vigilante_SANITIZADO.txt"; document.body.appendChild(a); a.click(); a.remove();
    setSummary("Diagnóstico descargado. Revisa Descargas.");
  }

  function boot() {
    if (document.getElementById("vgl-root")) return;
    installNetHooks(window);
    buildOverlay();
    ensureClone();
    tick();
    setInterval(tick, CONFIG.POLL_MS);
    setInterval(healClone, CONFIG.CLONE_HEAL_MS);
    setInterval(reloadClone, CONFIG.CLONE_REFRESH_MS);
    console.log("[Vigilante] userscript v" + VERSION + " activo (clon 2.º plano + recarga periódica + captura temprana de red).");
  }
  installNetHooks(window); // document-start: capturar endpoints JSON desde el arranque de la app
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
