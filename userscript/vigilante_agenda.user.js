// ==UserScript==
// @name         Vigilante de Agenda — Copiloto Everest PyM
// @namespace    vigilante-agenda-everest
// @version      3.3.0
// @description  Overlay que vigila "Citas del día" en Everest y muestra las actividades de PyM susceptibles por paciente. Corre DENTRO del navegador (sin .exe, sin puerto de depuración, SIN dependencias de internet): no dispara antivirus.
// @author       bpalencia27
// @match        *://neps.everestintelligent.com/*
// @match        *://*.everestintelligent.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
  v3.3 — SIN @require (autónomo): el .xlsx se lee con las APIs nativas del navegador
  (DecompressionStream + DOMParser), así que funciona aunque la red bloquee CDNs.
  También acepta .csv. Toda la lógica de colores/fraude/PyM es un puerto fiel de src/.
  PRIVACIDAD: nada sale del navegador; el PyM se procesa en memoria; la captura de
  diagnóstico va con nombres/cédulas enmascarados.
*/

(function () {
  "use strict";

  const CONFIG = {
    POLL_MS: 5000,
    TOLERANCIA_MIN: 6.0, // ÁMBAR desde 6:00; MORADO 5:00–5:59
    SEL: {
      hora: ".labelHora",
      estado: ".status-label",
      contenedor: [".card-body", ".card"],
      documento: ".text-muted",
      nombre: [".text-uppercase.fw-bold", ".text-uppercase"],
      modalidad: ".fw-bold.mb-0",
      fecha: ".fecha",
    },
  };

  const COLORS = { VERDE: "#10B981", AMBAR: "#F59E0B", ROJO: "#EF4444", AZUL: "#3B82F6", MORADO: "#8B5CF6" };

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
    lastSignature: "", events: [], minimized: false,
  };

  const limpio = (s) => (s || "").replace(/\s+/g, " ").trim();

  function normalizeKey(val) {
    if (val === null || val === undefined) return "";
    let s = String(val).trim();
    if (s.endsWith(".0")) s = s.slice(0, -2);
    return s.replace(/\D/g, "");
  }
  function extractDoc(t) {
    if (!t) return "";
    const first = t.split(",")[0].replace(/[.\s]/g, "");
    let m = /^(\d{5,15})$/.exec(first);
    if (m) return m[1];
    m = /(\d{5,15})/.exec(t.replace(/[.\s]/g, ""));
    return m ? m[1] : "";
  }
  function isPending(val) {
    if (val === null || val === undefined) return false;
    const s = String(val).trim().toLowerCase();
    return s === "susceptible" || s === "pendiente" || s.startsWith("tamizar");
  }
  function friendly(h) {
    if (FRIENDLY[h]) return FRIENDLY[h];
    const t = h.replace(/_/g, " ").trim().toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function activityLabel(header, val) {
    const f = friendly(header);
    const s = String(val).trim().toLowerCase();
    if (s === "susceptible" || s === "pendiente") return f;
    return `${f} — ${String(val).trim()}`;
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
      const docKey = normalizeKey(row[docIdx]);
      if (!docKey) continue;
      const bucket = map.get(docKey) || [];
      for (let i = 0; i < headers.length; i++) {
        if (i === docIdx) continue;
        if (isPending(row[i])) {
          const label = activityLabel(headers[i], row[i]);
          if (!bucket.includes(label)) bucket.push(label);
        }
      }
      map.set(docKey, bucket);
    }
    return map;
  }

  function parseCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
    return lines.map((l) => l.split(","));
  }

  // ---- Lector .xlsx AUTÓNOMO (ZIP + DEFLATE nativo + DOMParser). Sin librerías. ----
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const ab = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(ab);
  }
  function colToIdx(ref) {
    const m = /^([A-Z]+)\d+$/.exec(ref || "");
    if (!m) return -1;
    let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return c - 1;
  }
  async function readXlsx(arrayBuffer) {
    const dv = new DataView(arrayBuffer), bytes = new Uint8Array(arrayBuffer), td = new TextDecoder();
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("xlsx inválido (EOCD no encontrado)");
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
    async function readEntry(name) {
      const f = files[name]; if (!f) return null;
      const lh = f.localOff;
      const start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true);
      const comp = bytes.subarray(start, start + f.compSize);
      const raw = f.method === 0 ? comp : await inflateRaw(comp);
      return new TextDecoder("utf-8").decode(raw);
    }
    const sharedXml = await readEntry("xl/sharedStrings.xml");
    let sheetKey = "xl/worksheets/sheet1.xml";
    if (!files[sheetKey]) {
      const k = Object.keys(files).find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
      if (k) sheetKey = k;
    }
    const sheetXml = await readEntry(sheetKey);
    if (!sheetXml) throw new Error("xlsx: no se encontró la hoja de datos");

    const shared = [];
    if (sharedXml) {
      const sdoc = new DOMParser().parseFromString(sharedXml, "application/xml");
      const sis = sdoc.getElementsByTagNameNS("*", "si");
      for (let i = 0; i < sis.length; i++) {
        const ts = sis[i].getElementsByTagNameNS("*", "t");
        let s = ""; for (let j = 0; j < ts.length; j++) s += ts[j].textContent;
        shared.push(s);
      }
    }
    const doc = new DOMParser().parseFromString(sheetXml, "application/xml");
    const rowsEl = doc.getElementsByTagNameNS("*", "row");
    const rows = [];
    for (let r = 0; r < rowsEl.length; r++) {
      const cells = rowsEl[r].getElementsByTagNameNS("*", "c");
      const arr = [];
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        let idx = colToIdx(cell.getAttribute("r"));
        if (idx < 0) idx = arr.length;
        const t = cell.getAttribute("t");
        let val = "";
        if (t === "s") {
          const v = cell.getElementsByTagNameNS("*", "v")[0];
          val = v ? (shared[parseInt(v.textContent, 10)] || "") : "";
        } else if (t === "inlineStr") {
          const is = cell.getElementsByTagNameNS("*", "is")[0];
          val = is ? is.textContent : "";
        } else {
          const v = cell.getElementsByTagNameNS("*", "v")[0];
          val = v ? v.textContent : "";
        }
        arr[idx] = val;
      }
      rows.push(arr);
    }
    return rows;
  }

  function applyPym(headers, rows, fileName) {
    state.pym = indexRows(headers, rows);
    state.pymFile = fileName;
    state.lastSignature = "";
    setSummary(`PyM cargado: ${state.pym.size} paciente(s) — ${fileName}`);
    tick();
  }

  function loadPymFile(file) {
    const name = file.name.toLowerCase();
    const reader = new FileReader();
    reader.onerror = () => setSummary("No se pudo leer el archivo PyM.", true);
    if (name.endsWith(".csv")) {
      reader.onload = (e) => {
        try { const all = parseCSV(String(e.target.result)); applyPym(all[0] || [], all.slice(1), file.name); }
        catch (err) { setSummary("Error cargando CSV: " + err.message, true); }
      };
      reader.readAsText(file, "UTF-8");
    } else {
      reader.onload = async (e) => {
        try {
          if (typeof DecompressionStream === "undefined")
            throw new Error("Este navegador no soporta lectura de .xlsx; guarda el PyM como .csv.");
          const rows = await readXlsx(e.target.result);
          applyPym(rows[0] || [], rows.slice(1), file.name);
        } catch (err) { setSummary("Error cargando .xlsx (" + err.message + "). Prueba guardándolo como .csv.", true); }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  // ---- Extracción del DOM ----
  function firstMatch(root, selList) {
    const arr = Array.isArray(selList) ? selList : [selList];
    for (const s of arr) { const el = root.querySelector(s); if (el) return el; }
    return null;
  }
  function containerOf(elHora) {
    for (const s of CONFIG.SEL.contenedor) { const c = elHora.closest(s); if (c) return c; }
    let n = elHora.parentElement, saltos = 0;
    while (n && n !== document.body && saltos < 8) {
      if (n.querySelector(CONFIG.SEL.estado)) return n;
      n = n.parentElement; saltos++;
    }
    return null;
  }
  function extractAgenda() {
    const horas = Array.from(document.querySelectorAll(CONFIG.SEL.hora));
    if (horas.length === 0) return { visible: false, citas: [] };
    const citas = horas.map((h, i) => {
      const cont = containerOf(h);
      let estado = "", documento = "", nombre = "", modalidad = "";
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

  // ---- Lógica de color / alerta (puerto fiel de agenda_monitor.py) ----
  function elapsedMin(ts, now) {
    const m = /^(\d{1,2}):(\d{2})\s*([AaPp])[.\sMm]*$/.exec((ts || "").trim());
    if (!m) { if (!state.warnedTimes.has(ts)) { state.warnedTimes.add(ts); console.warn("[Vigilante] hora no interpretable:", ts); } return 0; }
    let h = parseInt(m[1], 10) % 12; if (/[Pp]/.test(m[3])) h += 12;
    const apt = new Date(now); apt.setHours(h, parseInt(m[2], 10), 0, 0);
    return (now - apt) / 60000;
  }
  function apptKey(a) { return a.doc_id ? a.doc_id : `${a.hora_texto}|${a.nombre}|${a.index}`; }
  function colorAndAlert(a, now) {
    const st = (a.estado || "").toLowerCase();
    const key = apptKey(a);
    const elapsed = elapsedMin(a.hora_texto, now);
    const pym = getActivities(a.doc_id);
    const grace = CONFIG.TOLERANCIA_MIN, prealert = CONFIG.TOLERANCIA_MIN - 1.0;
    let color = "AZUL", sound = false;
    if (st.includes("en sala")) {
      if (state.fraudWatch.has(key)) { color = "ROJO"; if (!state.alertedFraud.has(key)) { sound = true; state.alertedFraud.add(key); } }
      else color = "VERDE";
    } else if (st.includes("atendido")) {
      color = state.alertedFraud.has(key) ? "ROJO" : "VERDE";
    } else if (st.includes("sin presentarse")) {
      if (elapsed >= grace) { color = "AMBAR"; state.fraudWatch.add(key); }
      else if (elapsed >= prealert) color = "MORADO";
      else color = "AZUL";
    } else {
      color = (elapsed >= prealert || pym.length >= 3) ? "MORADO" : "AZUL";
    }
    const prev = state.historical.get(key) || "";
    if (sound) state.events.push({ t: new Date().toLocaleString(), ev: "FRAUDE_EXTEMPORANEO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado });
    else if (st !== prev && prev !== "") state.events.push({ t: new Date().toLocaleString(), ev: "CAMBIO_ESTADO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, previo: prev });
    state.historical.set(key, st);
    return { ...a, key, color, sound, elapsed: Math.round(elapsed * 10) / 10, pym };
  }

  let audioCtx = null;
  function beep(freq, ms, whenOffset) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = freq; o.type = "square";
      const t0 = audioCtx.currentTime + whenOffset;
      g.gain.setValueAtTime(0.15, t0); o.start(t0); o.stop(t0 + ms / 1000);
    } catch (e) { /* algunos navegadores exigen interacción previa */ }
  }
  function fraudSound() { beep(1000, 400, 0); beep(1200, 400, 0.45); }

  let el = {};
  function buildOverlay() {
    const style = document.createElement("style");
    style.textContent = `
      #vgl-root{position:fixed;bottom:20px;right:20px;width:440px;max-height:70vh;z-index:2147483647;
        background:#0F172A;border:1px solid #334155;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);
        font-family:'Segoe UI',system-ui,sans-serif;color:#F8FAFC;display:flex;flex-direction:column;overflow:hidden}
      #vgl-head{background:#1E293B;padding:8px 10px;display:flex;align-items:center;gap:6px;cursor:move;user-select:none}
      #vgl-title{font-weight:700;font-size:13px;flex:1}
      .vgl-btn{background:#0284C7;color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer}
      .vgl-btn:hover{background:#0369A1}
      .vgl-btn.sec{background:#334155}.vgl-btn.sec:hover{background:#475569}
      #vgl-sum{font-size:11px;color:#94A3B8;padding:6px 10px;border-bottom:1px solid #1E293B}
      #vgl-list{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px}
      .vgl-card{background:#1E293B;border-left:4px solid #3B82F6;border-radius:6px;padding:7px 9px}
      .vgl-row{display:flex;align-items:center;gap:6px}
      .vgl-time{font-weight:700;font-size:12px}
      .vgl-name{font-size:12px;color:#E2E8F0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vgl-badge{font-size:10px;font-weight:700;color:#fff;padding:2px 6px;border-radius:4px}
      .vgl-pym{font-size:11px;margin-top:4px;color:#38BDF8;font-weight:700}
      .vgl-pym.none{color:#64748B;font-weight:400;font-style:italic}
      #vgl-empty{color:#64748B;font-style:italic;text-align:center;padding:24px 8px;font-size:12px}
      #vgl-root.min #vgl-sum,#vgl-root.min #vgl-list{display:none}
    `;
    document.head.appendChild(style);
    const root = document.createElement("div");
    root.id = "vgl-root";
    root.innerHTML = `
      <div id="vgl-head">
        <span id="vgl-title">🛡️ Vigilante PyM v3.3</span>
        <button class="vgl-btn" id="vgl-load">Cargar PyM</button>
        <button class="vgl-btn sec" id="vgl-diag" title="Descarga una captura del DOM sanitizada">Diag</button>
        <button class="vgl-btn sec" id="vgl-min">_</button>
      </div>
      <div id="vgl-sum">● Iniciando monitoreo…</div>
      <div id="vgl-list"><div id="vgl-empty">Esperando "Citas del día"…</div></div>
      <input type="file" id="vgl-file" accept=".xlsx,.xlsm,.csv" style="display:none">
    `;
    document.body.appendChild(root);
    el = { root, sum: root.querySelector("#vgl-sum"), list: root.querySelector("#vgl-list"), file: root.querySelector("#vgl-file") };
    root.querySelector("#vgl-load").addEventListener("click", () => el.file.click());
    root.querySelector("#vgl-diag").addEventListener("click", downloadDiagnostic);
    root.querySelector("#vgl-min").addEventListener("click", () => { state.minimized = !state.minimized; root.classList.toggle("min", state.minimized); });
    el.file.addEventListener("change", (e) => { if (e.target.files[0]) loadPymFile(e.target.files[0]); e.target.value = ""; });
    makeDraggable(root, root.querySelector("#vgl-head"));
  }
  function makeDraggable(root, handle) {
    let dx = 0, dy = 0, dragging = false;
    handle.addEventListener("mousedown", (e) => { dragging = true; const r = root.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; root.style.bottom = "auto"; root.style.right = "auto"; e.preventDefault(); });
    document.addEventListener("mousemove", (e) => { if (!dragging) return; root.style.left = Math.max(0, e.clientX - dx) + "px"; root.style.top = Math.max(0, e.clientY - dy) + "px"; });
    document.addEventListener("mouseup", () => { dragging = false; });
  }
  function setSummary(text, isError) {
    if (el.sum) { el.sum.textContent = (isError ? "⚠ " : "● ") + text; el.sum.style.color = isError ? "#FCA5A5" : "#94A3B8"; }
  }
  function signatureOf(list) { return list.map((a) => `${a.key}~${a.estado}~${a.color}~${a.pym.join("·")}`).join("||"); }
  function render(list) {
    const sig = signatureOf(list);
    if (sig === state.lastSignature) return;
    state.lastSignature = sig;
    const pymFile = state.pymFile ? ` | PyM: ${state.pym.size}` : " | PyM sin cargar";
    setSummary(`Monitoreo activo (${CONFIG.POLL_MS / 1000}s) | ${list.length} cita(s)${pymFile}`);
    if (!list.length) { el.list.innerHTML = `<div id="vgl-empty">No se detectan citas aún.<br>El vigilante reintenta automáticamente.</div>`; return; }
    el.list.innerHTML = "";
    for (const a of list) {
      const hex = COLORS[a.color] || COLORS.AZUL;
      const card = document.createElement("div");
      card.className = "vgl-card"; card.style.borderLeftColor = hex;
      const pymTxt = a.pym.length ? a.pym.join(" | ") : "Sin actividades PyM pendientes";
      card.innerHTML = `
        <div class="vgl-row">
          <span class="vgl-time">${escapeHtml(a.hora_texto)}</span>
          <span class="vgl-name">${escapeHtml(a.nombre)} ${a.doc_id ? "(" + escapeHtml(a.doc_id) + ")" : ""}</span>
          <span class="vgl-badge" style="background:${hex}">${escapeHtml(a.estado)}</span>
        </div>
        <div class="vgl-pym ${a.pym.length ? "" : "none"}">📋 ${escapeHtml(pymTxt)}</div>`;
      el.list.appendChild(card);
    }
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function tick() {
    try {
      const data = extractAgenda();
      if (!data.visible) { render([]); return; }
      const now = new Date();
      const processed = data.citas.map((a) => colorAndAlert(a, now));
      if (processed.some((a) => a.sound)) fraudSound();
      render(processed);
    } catch (e) { console.error("[Vigilante] error en tick:", e); }
  }

  function downloadDiagnostic() {
    const KEEP = new Set(["class", "role", "routerlink", "type", "name"]);
    const out = [];
    const sels = [".labelHora", ".status-label", ".card", ".card-body", ".text-muted", ".text-uppercase", ".fw-bold.mb-0", ".fecha", ".text-uppercase.fw-bold"];
    const counts = {}; sels.forEach((s) => { try { counts[s] = document.querySelectorAll(s).length; } catch (e) { counts[s] = "err"; } });
    const freq = {}; document.querySelectorAll("*").forEach((n) => (n.classList ? [...n.classList] : []).forEach((c) => (freq[c] = (freq[c] || 0) + 1)));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 120);
    const nav = [], seen = new Set();
    document.querySelectorAll('nav,header,aside,[role="navigation"],.sidebar,.menu,.nav,[routerlink]').forEach((r) => {
      [r, ...r.querySelectorAll('a,button,[role="button"],li,span,.nav-link')].forEach((e2) => {
        const t = limpio(e2.textContent); if (!t || t.length > 40) return;
        const k = e2.tagName + "|" + t; if (seen.has(k)) return; seen.add(k);
        nav.push({ tag: e2.tagName, text: t, routerlink: (e2.getAttribute && e2.getAttribute("routerlink")) || "" });
      });
    });
    const san = (node) => {
      const c = node.cloneNode(true);
      const w = (x) => {
        if (x.nodeType === 3) { if (x.textContent && x.textContent.trim()) x.textContent = "···"; return; }
        if (x.nodeType !== 1) return;
        [...(x.attributes || [])].forEach((a) => { if (!KEEP.has(a.name) && !a.name.startsWith("data-")) x.removeAttribute(a.name); else if (a.name.startsWith("data-")) x.setAttribute(a.name, ""); });
        [...x.childNodes].forEach(w);
      };
      w(c); return c.outerHTML;
    };
    let card = "";
    try { const h = document.querySelector(".labelHora"); const c = h && containerOf(h); card = c ? san(c).slice(0, 15000) : "(no se encontró .labelHora)"; } catch (e) { card = "err: " + e; }
    out.push("===== DIAGNÓSTICO DOM SANITIZADO — VIGILANTE v3.3 =====",
      "Fecha: " + new Date().toISOString(), "URL: " + location.href, "Título: " + document.title,
      "\n--- CONTEO DE SELECTORES ---", JSON.stringify(counts, null, 2),
      "\n--- CLASES MÁS FRECUENTES (top 120) ---", top.map(([c, n]) => n + "  ." + c).join("\n"),
      "\n--- NAVEGACIÓN ---", JSON.stringify(nav, null, 2),
      "\n--- PRIMERA TARJETA (HTML sanitizado) ---", card);
    const blob = new Blob([out.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "diagnostico_dom_SANITIZADO.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setSummary("Diagnóstico descargado (revisa Descargas).");
  }

  function boot() {
    if (document.getElementById("vgl-root")) return;
    buildOverlay();
    tick();
    setInterval(tick, CONFIG.POLL_MS);
    console.log("[Vigilante] userscript v3.3 activo (autónomo, sin dependencias).");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
