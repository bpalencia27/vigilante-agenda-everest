// ==UserScript==
// @name         Vigilante de Agenda — Copiloto Everest PyM
// @namespace    vigilante-agenda-everest
// @version      8.2.1
// @description  Asistente clínico para la gestión fluida de la agenda médica y actividades de PyM en Everest.
// @author       bpalencia27
// @match        *://neps.everestintelligent.com/*
// @match        *://*.everestintelligent.com/*
// @match        *://viva1aips-my.sharepoint.com/*
// @run-at       document-start
// @noframes
// @connect      viva1aips-my.sharepoint.com
// @connect      sharepoint.com
// @connect      microsoftonline.com
// @connect      login.live.com
// @connect      svc.ms
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      googleusercontent.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt
// @downloadURL  https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt
// ==/UserScript==
// --- AUTOACTUALIZACIÓN -------------------------------------------------------
// Activada (v7.4.0): Tampermonkey revisa este Gist secreto solo y actualiza cada
// equipo cuando @version suba.
// ----------------------------------------------------------------------------
/*
v8.2.1 — CORRECCIÓN CRÍTICA DE CARGA DE PyM Y DESCARGA AUTOMÁTICA DE SHAREPOINT
- Reparada la canalización de descarga automática desde SharePoint (loadPymDiario + loadPymBase + schedulePymBase).
- Restaurado el captador ligero de SharePoint (bootSharepointLite) para sincronización anónima/nativa de la base de datos.
- Corregida la visualización en tarjetas de pacientes: "PyM sin cargar" vs "✓ Sin PyM pendiente (al día)" vs "ℹ No figura en base PyM".
- Carga manual mejorada en 1-clic con feedback visual claro e indexación en segundo plano por Web Worker.
*/
(function () {
  "use strict";

  if (window.top !== window.self) return; // Nunca correr dentro de un iframe

  const VERSION = "8.2.1";

  // Fetch ORIGINAL preservado en document-start
  const FETCH0 = (function () {
    try {
      const f = window.fetch;
      if (typeof f !== "function") return null;
      return (u, o) => f.call(window, u, o);
    } catch (e) {
      return null;
    }
  })();

  const PAGEWIN = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;

  // =====================================================================
  // CESIÓN DEL HILO POR PRESUPUESTO DE TIEMPO (MessageChannel)
  // =====================================================================
  const YIELD_MC = (typeof MessageChannel !== "undefined") ? new MessageChannel() : null;
  const yieldQueue = [];
  if (YIELD_MC) {
    YIELD_MC.port1.onmessage = () => {
      const r = yieldQueue.shift();
      if (r) r();
    };
  }

  function yieldNow() {
    if (YIELD_MC) {
      return new Promise((r) => {
        yieldQueue.push(r);
        YIELD_MC.port2.postMessage(0);
      });
    }
    return new Promise((r) => setTimeout(r, 0));
  }

  function makeYielder(budgetMs) {
    const budget = budgetMs || 15;
    let last = performance.now();
    return async function () {
      const now = performance.now();
      if (now - last < budget) return false;
      await yieldNow();
      last = performance.now();
      return true;
    };
  }

  function idleRun(fn, timeoutMs) {
    try {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => fn(), { timeout: timeoutMs || 4000 });
        return;
      }
    } catch (e) {}
    setTimeout(fn, 700);
  }

  // =====================================================================
  // AJUSTES Y CONFIGURACIÓN DEL USUARIO
  // =====================================================================
  const SETTINGS_KEY = "vgl_cfg";
  const DEFAULTS = {
    tolerancia: 6.0,
    refresco: 5,
    tema: "oscuro",
    sonido: true,
    volumen: 0.15,
    insistir: true,
    popup: false,
    cartel: false,
    parpadeo: false,
    excluir: "vdrl,sifilis,hepatitis,hepb,hepc,hvc,vhc,hbv,vhb",
    recordatorio: "07:30",
    baseAuto: true,
    respaldoId: "",
    reporte: true,
    equipo: "",
    reporteUrl: "",
    modoRendimiento: false,
    recordatorioPym: true,
    abandonoPES: true,
    agendamientoRapido: true,
    medicoNombre: "",
    medicoId: 0,
  };

  function readJSON(k, def) {
    try {
      const r = localStorage.getItem(k);
      return r ? JSON.parse(r) : def;
    } catch (e) {
      return def;
    }
  }

  function writeJSON(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  }

  const S = Object.assign({}, DEFAULTS, readJSON(SETTINGS_KEY, {}));

  const PROC_KEY = "vgl_proc_today";
  function getProcessedToday() {
    const today = todayStamp();
    const data = readJSON(PROC_KEY, null);
    if (!data || data.dia !== today) {
      const fresh = { dia: today, citas: [], ordenes: [] };
      writeJSON(PROC_KEY, fresh);
      return fresh;
    }
    return data;
  }

  function isCitaAgendadaHoy(docId) {
    if (!docId) return false;
    const p = getProcessedToday();
    return p.citas && p.citas.includes(String(docId));
  }

  function markCitaAgendadaHoy(docId) {
    if (!docId) return;
    const p = getProcessedToday();
    const sDoc = String(docId);
    if (!p.citas.includes(sDoc)) {
      p.citas.push(sDoc);
      writeJSON(PROC_KEY, p);
      state.lastSignature = "";
      repaint();
    }
  }

  function applySettings() {
    CONFIG.TOLERANCIA_MIN = clampNum(S.tolerancia, 0.5, 60, DEFAULTS.tolerancia);
    CONFIG.POLL_MS = clampNum(S.refresco, 2, 120, DEFAULTS.refresco) * 1000;
    CONFIG.EXCLUDE_PYM = String(S.excluir || "")
      .split(",")
      .map((x) => stripAccents(x.trim().toLowerCase()))
      .filter(Boolean);
    if (S.respaldoId && /\S/.test(S.respaldoId)) {
      const g = parseSpDocId(S.respaldoId);
      if (g) CONFIG.SP.respaldo = { id: g, name: "Base PyM (enlace personalizado)" };
    }
    applyTheme();
    restartPolling();
  }

  function clampNum(v, lo, hi, def) {
    const n = parseFloat(v);
    if (!isFinite(n)) return def;
    return Math.min(hi, Math.max(lo, n));
  }

  function darkPreferred() {
    try {
      return !PAGEWIN.matchMedia || PAGEWIN.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      return true;
    }
  }

  function isLight() {
    return S.tema === "claro" || (S.tema === "auto" && !darkPreferred());
  }

  function applyTheme() {
    try {
      const r = document.getElementById("vgl-root");
      if (r) {
        r.classList.toggle("light", isLight());
        r.classList.toggle("perf", !!S.modoRendimiento);
      }
      const d = document.getElementById("vgl-dock");
      if (d) {
        d.classList.toggle("light", isLight());
        d.classList.toggle("perf", !!S.modoRendimiento);
      }
      const t = document.getElementById("vgl-toasts");
      if (t) t.classList.toggle("light", isLight());
    } catch (e) {}
  }

  const CONFIG = {
    POLL_MS: 5000,
    TOLERANCIA_MIN: 6.0,
    EXCLUDE_PYM: ["vdrl", "sifilis", "hepatitis", "hepb", "hepc", "hvc", "vhc", "hbv", "vhb"],
    SP: {
      host: "viva1aips-my.sharepoint.com",
      web: "/personal/director_bello_viva1a_com_co",
      folder: "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM",
      respaldo: {
        id: "809a098b-69d1-44fe-9e51-b01f07290807",
        name: "BASE PILOTO DE CONSULTA BELLO MAYO.xlsx",
      },
      shareLink: "https://viva1aips-my.sharepoint.com/:f:/g/personal/director_bello_viva1a_com_co/IgCsGP_chaHvTKYH9v-QZ2Q1AQuJo3umR5gDLjKlkUqgPS4?e=jscdBl",
    },
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

  const COLORS = { VERDE: "#10B981", AMBAR: "#D97706", ROJO: "#E54D42", AZUL: "#2563EB", MORADO: "#9333EA" };
  const TINT = { VERDE: "rgba(16,185,129,.16)", AMBAR: "rgba(217,119,6,.16)", ROJO: "rgba(229,77,66,.16)", AZUL: "rgba(37,99,235,.16)", MORADO: "rgba(147,51,234,.16)" };

  const FRIENDLY = {
    VALORACION_INTEGRAL: "Valoración integral de salud",
    TAMIZACION_CMB: "Tamización de riesgo cardiometabólico",
    CITA_PF: "Remisión a Planificación Familiar",
    CITA_AV: "Remisión a Optometría",
    CITA_OD: "Remisión a Odontología",
    TAMIZACION_CERVIX: "Tamización de cérvix",
    TAMIZACION_PROSTATA: "Tamización de próstata",
    PRUEBA_CERVIX: "Tamización de cérvix",
    TAMIZACION_MAMA: "Tamización de mama (examen clínico + mamografía)",
    TAMIZACION_COLON: "Tamización de cáncer de colon (sangre oculta en materia fecal)",
    TAMIZACION_HEPC: "Tamización de Hepatitis C",
    TAMIZACION_HEPB: "Tamización de Hepatitis B",
    TAMIZACION_VDRL: "Tamización de Sífilis",
    TAMIZACION_HB: "Tamización de Hemoglobina",
    TAMIZACION_VIH: "Tamización de VIH",
    TAMIZACION_HTO: "Tamización de Hematocrito",
    "Último VIH": "Tamización de VIH",
    "Ultimo VIH": "Tamización de VIH",
    "Última SOMF": "Tamización de cáncer de colon",
    "Ultima SOMF": "Tamización de cáncer de colon",
  };

  function detalleTipoCervix(valorCrudo) {
    const s = stripAccents(String(valorCrudo || "").toLowerCase());
    if (s.includes("vph")) return "VPH";
    if (s.includes("ccu") || s.includes("citolog")) return "citología cervicouterina";
    return String(valorCrudo || "").trim();
  }

  const DOC_EXACT = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO", "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"];

  const GHOST = {
    promises: new Map(),
    hoverTimers: new Map(),
    listeners: new Set(),
    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    },
    notify(prop, val) {
      this.listeners.forEach((fn) => {
        try {
          fn(prop, val);
        } catch (e) {}
      });
    },
  };

  const rawState = {
    pym: new Map(),
    pymTodos: null,
    pymAbandono: new Set(),
    pymFile: "",
    pymMTime: "",
    pymFP: "",
    pymFallback: false,
    pymHoja: "",
    historical: new Map(),
    fraudWatch: new Set(),
    alertedFraud: new Set(),
    warnedTimes: new Set(),
    lastSignature: "",
    minimized: false,
    lastSnapshot: null,
    notified: new Map(),
    summarized: false,
    osNotif: false,
    lastVersionCheck: 0,
    versionCheckUrl: "https://script.google.com/macros/s/AKfycbwXwwQdSGGMyt4X6Wf5YbJVRZjB_z_cYEVVpRoebO_VrobIhtHKD3nAJs689kq3R7tC/exec",
    leader: false,
    shared: null,
    filtro: "todas",
    busqueda: "",
    muteUntil: 0,
    sheet: null,
    lastRefresh: null,
    apiCitas: null,
    apiEn: 0,
    autoDocked: false,
    userWinState: "full",
    activeDoctor: { id: 0, name: "" },
    sessionEpoch: Date.now(),
  };

  const state = new Proxy(rawState, {
    set(target, prop, val) {
      target[prop] = val;
      GHOST.notify(prop, val);
      return true;
    },
  });

  PAGEWIN.state = state;
  PAGEWIN.rawState = rawState;

  let pollTimer = null;
  function restartPolling() {
    if (!el || !el.root) return;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(tick, CONFIG.POLL_MS);
  }

  // Web Locks API Leader Election System
  state.leader = false;
  if (navigator.locks) {
    navigator.locks
      .request("vgl_leader_lock", { mode: "exclusive" }, () => {
        state.leader = true;
        return new Promise((resolve) => {
          window.addEventListener("beforeunload", () => {
            state.leader = false;
            resolve();
          });
        });
      })
      .catch(() => {
        state.leader = false;
      });
  } else {
    state.leader = true;
  }

  function heartbeat() {
    return state.leader;
  }

  const limpio = (s) => (s || "").replace(/\s+/g, " ").trim();

  function normalizeKey(val) {
    if (val === null || val === undefined) return "";
    let s = String(val).trim();
    if (s.endsWith(".0")) s = s.slice(0, -2);
    if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(s)) {
      const n = Number(s);
      if (isFinite(n)) s = n.toFixed(0);
    }
    return s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
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
    if (val === null || val === undefined || val === "") return false;
    const s = typeof val === "string" ? val : String(val);
    if (s.length > 32) return false;
    const t = s.trim().toLowerCase();
    return t === "susceptible" || t === "pendiente" || t.startsWith("tamizar");
  }

  function esSi(val) {
    if (val === null || val === undefined) return false;
    return stripAccents(String(val).trim().toLowerCase()) === "si";
  }

  function friendly(h) {
    if (FRIENDLY[h]) return FRIENDLY[h];
    const bruto = String(h == null ? "" : h).replace(/_/g, " ").trim();
    if (/[a-záéíóúñ]/.test(bruto)) return bruto;
    const t = bruto.toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function activityLabel(header, val) {
    const f = friendly(header);
    const s = String(val).trim().toLowerCase();
    if (s === "susceptible" || s === "pendiente") return f;
    return `${f} — ${String(val).trim()}`;
  }

  function stripAccents(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function isExcludedActivity(header, label) {
    const hay = stripAccents((header + " " + label).toLowerCase());
    if (hay.includes("vih")) return false;
    return CONFIG.EXCLUDE_PYM.some((k) => hay.includes(k));
  }

  function getActivities(docId) {
    return state.pym.get(normalizeKey(docId)) || [];
  }

  function makeIndexer(headersRaw) {
    const crudos = headersRaw || [];
    const headers = Array.from({ length: crudos.length }, (_, i) =>
      crudos[i] == null || crudos[i] === "" ? `COL_${i}` : String(crudos[i]).trim().toUpperCase()
    );
    const docIdx = findDocIdx(headers);
    if (docIdx < 0) {
      throw new Error("No se encontró la columna de identificación del paciente.");
    }
    const map = new Map();
    const todos = new Set();
    const memo = [];
    const cervixTamIdx = headers.indexOf("TAMIZACION_CERVIX");
    const cervixPruebaIdx = headers.indexOf("PRUEBA_CERVIX");
    const abandonoIdx =
      headers.indexOf("ABANDONADOS_PES") >= 0 ? headers.indexOf("ABANDONADOS_PES") : headers.indexOf("ABANDONADO_PES");
    const abandono = new Set();

    return {
      map,
      todos,
      abandono,
      push(row) {
        const docKey = normalizeKey(row[docIdx]);
        if (!docKey) return;
        todos.add(docKey);
        if (abandonoIdx >= 0 && esSi(row[abandonoIdx])) abandono.add(docKey);
        const bucket = map.get(docKey) || [];
        let detalleCervix = "",
          cervixYaAgregado = false;
        if (cervixPruebaIdx >= 0) {
          const pv = row[cervixPruebaIdx];
          if (isPending(pv)) detalleCervix = detalleTipoCervix(pv);
        }
        for (let i = 0; i < headers.length; i++) {
          if (i === docIdx || i === cervixPruebaIdx || i === abandonoIdx) continue;
          const celda = row[i];
          if (!isPending(celda)) continue;
          let label;
          if (i === cervixTamIdx && detalleCervix) {
            label = "Tamización cérvix — " + detalleCervix;
            cervixYaAgregado = true;
          } else {
            const clave = String(celda);
            let cm = memo[i] || (memo[i] = new Map());
            label = cm.get(clave);
            if (label === undefined) {
              const l = activityLabel((crudos && crudos[i]) || headers[i], celda);
              label = isExcludedActivity(headers[i], l) ? null : l;
              cm.set(clave, label);
            }
            if (label === null) continue;
            if (i === cervixTamIdx) cervixYaAgregado = true;
          }
          if (!bucket.includes(label)) bucket.push(label);
        }
        if (detalleCervix && !cervixYaAgregado) {
          const label = "Tamización cérvix — " + detalleCervix;
          if (!bucket.includes(label)) bucket.push(label);
        }
        if (bucket.length) map.set(docKey, bucket);
      },
    };
  }

  async function indexRowsAsync(headersRaw, rows, maybeYield) {
    const ix = makeIndexer(headersRaw);
    for (let i = 0; i < rows.length; i++) {
      ix.push(rows[i]);
      if (maybeYield && (i & 1023) === 0) await maybeYield();
    }
    return { map: ix.map, todos: ix.todos, abandono: ix.abandono };
  }

  function parseCSV(text) {
    return text
      .replace(/\r/g, "")
      .split("\n")
      .filter((l) => l.trim().length)
      .map((l) => l.split(","));
  }

  // =====================================================================
  // EXCEL PARSER STREAMING & WEB WORKER
  // =====================================================================
  const XLSX_LIMITS = { scanBytes: 300000, maxRows: 300000, maxBufChars: 8 * 1024 * 1024 };

  async function inflateRaw(bytes, maxBytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    if (!maxBytes) {
      const ab = await new Response(stream).arrayBuffer();
      return new Uint8Array(ab);
    }
    const reader = stream.getReader();
    const trozos = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        trozos.push(value);
        total += value.length;
        if (total >= maxBytes) break;
      }
    } finally {
      try {
        reader.cancel();
      } catch (e) {}
    }
    const out = new Uint8Array(total);
    let p = 0;
    for (const t of trozos) {
      out.set(t, p);
      p += t.length;
    }
    return out;
  }

  function colToIdx(ref) {
    const m = /^([A-Z]+)/.exec(ref || "");
    if (!m) return -1;
    let c = 0;
    for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return c - 1;
  }

  function unescXml(s) {
    if (s.indexOf("&") < 0) return s;
    return s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, "&");
  }

  async function* zipEntryChunks(zip, name) {
    const f = zip.files[name];
    if (!f) return;
    const lh = f.localOff;
    const start = lh + 30 + zip.dv.getUint16(lh + 26, true) + zip.dv.getUint16(lh + 28, true);
    const comp = zip.bytes.subarray(start, start + f.compSize);
    if (f.method === 0) {
      yield comp;
      return;
    }
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([comp]).stream().pipeThrough(ds);
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {}
    }
  }

  async function parseSharedStringsStream(zip, maybeYield) {
    const out = [];
    if (!zip.files["xl/sharedStrings.xml"]) return out;
    const td = new TextDecoder("utf-8");
    let buf = "";
    const siRe = /<si\b(?:\s*\/>|[^>]*>([\s\S]*?)<\/si>)/g;
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    for await (const chunk of zipEntryChunks(zip, "xl/sharedStrings.xml")) {
      buf += td.decode(chunk, { stream: true });
      siRe.lastIndex = 0;
      let m,
        consumed = 0;
      while ((m = siRe.exec(buf)) !== null) {
        const cuerpo = m[1] || "";
        let s = "";
        tRe.lastIndex = 0;
        let t;
        while ((t = tRe.exec(cuerpo)) !== null) s += t[1];
        out.push(unescXml(s));
        consumed = siRe.lastIndex;
        await maybeYield();
      }
      if (consumed) buf = buf.slice(consumed);
      if (buf.length > 4 * 1024 * 1024) throw new Error("El archivo contiene un volumen de datos superior al límite.");
    }
    return out;
  }

  const CELL_RE = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;
  function parseRowBody(cuerpo, shared) {
    const arr = [];
    if (cuerpo) {
      CELL_RE.lastIndex = 0;
      let cm,
        libre = 0;
      while ((cm = CELL_RE.exec(cuerpo)) !== null) {
        const attrs = cm[1] || "",
          body = cm[2] || "";
        const refM = /r="([A-Z]+)\d+"/.exec(attrs);
        let idx = refM ? colToIdx(refM[1]) : -1;
        if (idx < 0) idx = libre;
        libre = idx + 1;
        const tM = /t="([^"]+)"/.exec(attrs),
          tipo = tM ? tM[1] : "";
        let val = "";
        if (tipo === "inlineStr") {
          const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
          let t;
          while ((t = tRe.exec(body)) !== null) val += t[1];
          val = unescXml(val);
        } else {
          const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
          val = vM ? vM[1] : "";
          if (tipo === "s") {
            const i = parseInt(val, 10);
            val = shared && shared[i] !== undefined ? shared[i] : "";
          } else val = unescXml(val);
        }
        arr[idx] = val;
      }
    }
    for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = "";
    return arr;
  }

  function scanSheetRows(xml, shared, maxRows) {
    const filas = [];
    const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g;
    const cellRe = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;
    let rm;
    while ((rm = rowRe.exec(xml)) !== null) {
      const cuerpo = rm[2];
      const arr = [];
      if (cuerpo) {
        cellRe.lastIndex = 0;
        let cm,
          libre = 0;
        while ((cm = cellRe.exec(cuerpo)) !== null) {
          const attrs = cm[1] || "",
            body = cm[2] || "";
          const refM = /r="([A-Z]+)\d+"/.exec(attrs);
          let idx = refM ? colToIdx(refM[1]) : -1;
          if (idx < 0) idx = libre;
          libre = idx + 1;
          const tM = /t="([^"]+)"/.exec(attrs),
            tipo = tM ? tM[1] : "";
          let val = "";
          if (tipo === "inlineStr") {
            const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
            let t;
            while ((t = tRe.exec(body)) !== null) val += t[1];
            val = unescXml(val);
          } else {
            const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
            val = vM ? vM[1] : "";
            if (tipo === "s") {
              const i = parseInt(val, 10);
              val = shared && shared[i] !== undefined ? shared[i] : "";
            } else val = unescXml(val);
          }
          arr[idx] = val;
        }
      }
      for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = "";
      filas.push(arr);
      if (filas.length >= (maxRows || XLSX_LIMITS.maxRows)) break;
    }
    return filas;
  }

  function zipIndex(arrayBuffer) {
    const dv = new DataView(arrayBuffer),
      bytes = new Uint8Array(arrayBuffer),
      td = new TextDecoder();
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("El archivo seleccionado no tiene un formato Excel (.xlsx) válido.");
    let cdCount = dv.getUint16(eocd + 10, true),
      cdOffset = dv.getUint32(eocd + 16, true);
    if (cdOffset === 0xffffffff || cdCount === 0xffff) {
      for (let i = eocd - 20; i >= 0 && i > eocd - 200; i--) {
        if (dv.getUint32(i, true) === 0x07064b50) {
          const z64 = Number(dv.getBigUint64(i + 8, true));
          if (dv.getUint32(z64, true) === 0x06064b50) {
            cdCount = Number(dv.getBigUint64(z64 + 32, true));
            cdOffset = Number(dv.getBigUint64(z64 + 48, true));
          }
          break;
        }
      }
    }
    const files = {};
    let p = cdOffset;
    for (let n = 0; n < cdCount; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true),
        compSize = dv.getUint32(p + 20, true),
        uncSize = dv.getUint32(p + 24, true);
      const nameLen = dv.getUint16(p + 28, true),
        extraLen = dv.getUint16(p + 30, true),
        commentLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      files[td.decode(bytes.subarray(p + 46, p + 46 + nameLen))] = { method, compSize, uncSize, localOff };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return { dv, bytes, files };
  }

  async function zipRead(zip, name, maxBytes) {
    const f = zip.files[name];
    if (!f) return null;
    const lh = f.localOff;
    const start = lh + 30 + zip.dv.getUint16(lh + 26, true) + zip.dv.getUint16(lh + 28, true);
    const comp = zip.bytes.subarray(start, start + f.compSize);
    const raw = f.method === 0 ? (maxBytes ? comp.subarray(0, maxBytes) : comp) : await inflateRaw(comp, maxBytes);
    return new TextDecoder("utf-8").decode(raw);
  }

  function sheetOrder(wbXml, relsXml) {
    const rmap = {};
    if (relsXml) {
      const re = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*>/g;
      let m;
      while ((m = re.exec(relsXml)) !== null) rmap[m[1]] = m[2].replace(/^\/?xl\//, "").replace(/^\//, "");
    }
    const out = [];
    if (wbXml) {
      const re = /<sheet\b([^>]*)\/?>/g;
      let m;
      while ((m = re.exec(wbXml)) !== null) {
        const a = m[1];
        const nm = /name="([^"]*)"/.exec(a),
          rid = /r:id="([^"]*)"/.exec(a);
        const tgt = rid && rmap[rid[1]];
        if (tgt) out.push({ name: nm ? unescXml(nm[1]) : tgt, path: "xl/" + tgt });
      }
    }
    return out;
  }

  function scoreSheet(filas) {
    let mejor = { score: -1, headerRow: -1, pend: 0 };
    const tope = Math.min(filas.length, 15);
    for (let h = 0; h < tope; h++) {
      const cruda = filas[h] || [];
      const cab = Array.from({ length: cruda.length }, (_, i) =>
        String(cruda[i] == null ? "" : cruda[i]).trim().toUpperCase()
      );
      if (cab.filter(Boolean).length < 2) continue;
      if (findDocIdx(cab) < 0) continue;
      let pend = 0;
      for (let r = h + 1; r < Math.min(filas.length, h + 400); r++) {
        const fila = filas[r] || [];
        for (let c = 0; c < fila.length; c++) if (isPending(fila[c])) pend++;
      }
      const score = 100 + Math.min(300, pend) - h;
      if (score > mejor.score) mejor = { score, headerRow: h, pend };
    }
    return mejor;
  }

  function findDocIdx(headers) {
    const h = (headers || []).map((x) => String(x == null ? "" : x));
    for (const cand of DOC_EXACT) {
      const k = h.indexOf(cand);
      if (k >= 0) return k;
    }
    return h.findIndex((x) => x.includes("IDENT") || x.includes("CEDULA") || x.includes("DOCUMENTO"));
  }

  async function _readPymWorkbookStreamCore(arrayBuffer) {
    const maybeYield = makeYielder(15);
    const zip = zipIndex(arrayBuffer);
    const shared = await parseSharedStringsStream(zip, maybeYield);
    let hojas = sheetOrder(await zipRead(zip, "xl/workbook.xml"), await zipRead(zip, "xl/_rels/workbook.xml.rels"));
    if (!hojas.length)
      hojas = Object.keys(zip.files)
        .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
        .sort()
        .map((p) => ({ name: p, path: p }));
    if (!hojas.length) throw new Error("El libro no tiene hojas legibles.");

    const cand = [];
    for (const h of hojas) {
      const info = zip.files[h.path];
      if (!info) continue;
      try {
        const muestra = await zipRead(zip, h.path, XLSX_LIMITS.scanBytes);
        const filas = scanSheetRows(muestra || "", shared, 400);
        const sc = scoreSheet(filas);
        if (sc.score > 0) cand.push({ h, sc, size: info.uncSize || 0 });
      } catch (e) {}
      await maybeYield();
    }
    cand.sort((a, b) => b.sc.score - a.sc.score);
    const elegida = cand[0] || { h: hojas[0], sc: { headerRow: 0 } };
    const headerRow = Math.max(0, elegida.sc.headerRow || 0);

    progreso("Leyendo «" + elegida.h.name + "»…");
    const td = new TextDecoder("utf-8");
    const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g;
    let buf = "",
      nRow = 0,
      headers = null,
      indexer = null;
    for await (const chunk of zipEntryChunks(zip, elegida.h.path)) {
      buf += td.decode(chunk, { stream: true });
      rowRe.lastIndex = 0;
      let m,
        consumed = 0;
      while ((m = rowRe.exec(buf)) !== null) {
        const fila = parseRowBody(m[2], shared);
        if (nRow === headerRow) {
          headers = fila;
          indexer = makeIndexer(headers);
        } else if (nRow > headerRow && indexer) {
          indexer.push(fila);
        }
        nRow++;
        consumed = rowRe.lastIndex;
        if (nRow >= XLSX_LIMITS.maxRows) break;
        if (await maybeYield()) {
          if ((nRow & 8191) === 0) progreso("Leyendo el archivo… " + nRow.toLocaleString("es") + " filas");
        }
      }
      if (consumed) buf = buf.slice(consumed);
      if (nRow >= XLSX_LIMITS.maxRows) break;
      if (buf.length > XLSX_LIMITS.maxBufChars)
        throw new Error("La hoja «" + elegida.h.name + "» no se puede leer por filas.");
    }
    if (!indexer) throw new Error("No se encontró la fila de encabezados en «" + elegida.h.name + "».");
    return {
      headers,
      map: indexer.map,
      todos: indexer.todos,
      abandono: indexer.abandono,
      sheetName: elegida.h.name,
      rowCount: nRow,
      sheets: hojas.map((x) => x.name),
    };
  }

  async function readPymWorkbookStream(arrayBuffer) {
    return new Promise((resolve, reject) => {
      const code = `
const XLSX_LIMITS = ${JSON.stringify(XLSX_LIMITS)};
const DOC_EXACT = ${JSON.stringify(DOC_EXACT)};
const FRIENDLY = ${JSON.stringify(FRIENDLY)};
const CONFIG = { EXCLUDE_PYM: ${JSON.stringify(CONFIG.EXCLUDE_PYM)} };
function progreso(msg) { self.postMessage({ type: 'progress', msg }); }
function makeYielder(budgetMs) {
  let last = performance.now();
  return async function () {
    if (performance.now() - last < (budgetMs || 50)) return false;
    await new Promise(r => setTimeout(r, 0));
    last = performance.now();
    return true;
  };
}
${normalizeKey.toString()}
${isPending.toString()}
${esSi.toString()}
${stripAccents.toString()}
${friendly.toString()}
${activityLabel.toString()}
${isExcludedActivity.toString()}
${detalleTipoCervix.toString()}
${findDocIdx.toString()}
${makeIndexer.toString()}
${inflateRaw.toString()}
${colToIdx.toString()}
${unescXml.toString()}
${zipEntryChunks.toString()}
${parseSharedStringsStream.toString()}
${parseRowBody.toString()}
${scanSheetRows.toString()}
${zipIndex.toString()}
${zipRead.toString()}
${sheetOrder.toString()}
${scoreSheet.toString()}
${_readPymWorkbookStreamCore.toString()}
self.onmessage = async (e) => {
  try {
    const result = await _readPymWorkbookStreamCore(e.data);
    self.postMessage({ type: 'done', result });
  } catch(err) {
    self.postMessage({ type: 'error', error: err.message, stack: err.stack });
  }
};
`;
      const blob = new Blob([code], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      let watchdog;

      worker.onmessage = (e) => {
        const { type, msg, result, error, stack } = e.data;
        if (type === "progress") {
          if (typeof progreso === "function") progreso(msg);
        } else if (type === "done") {
          clearTimeout(watchdog);
          URL.revokeObjectURL(workerUrl);
          worker.terminate();
          resolve(result);
        } else if (type === "error") {
          clearTimeout(watchdog);
          URL.revokeObjectURL(workerUrl);
          worker.terminate();
          const err = new Error(error);
          err.stack = stack;
          reject(err);
        }
      };

      worker.onerror = (e) => {
        clearTimeout(watchdog);
        URL.revokeObjectURL(workerUrl);
        worker.terminate();
        reject(new Error("Error en el procesamiento en segundo plano: " + (e.message || "Fallo inesperado")));
      };

      watchdog = setTimeout(() => {
        URL.revokeObjectURL(workerUrl);
        worker.terminate();
        reject(new Error("El procesamiento del archivo excedió el tiempo límite (90s)."));
      }, 90000);

      worker.postMessage(arrayBuffer, [arrayBuffer]);
    });
  }

  function afterPymLoaded(fileName) {
    state.pymFile = fileName;
    if (state.lastSnapshot) {
      state.lastSnapshot.list.forEach((a) => {
        a.pym = getActivities(a.doc_id);
      });
    }
    state.lastSignature = "";
    repaint();
    setSummary(`Actividades preventivas cargadas: ${state.pym.size} paciente(s) — ${fileName}`);
  }

  function pymFP(name, mtime) {
    return String(name || "") + "|" + String(mtime || "");
  }

  async function packPym(map, todos, abandono, meta, maybeYield) {
    const labels = [];
    const lidx = new Map();
    const parts = new Array(map.size);
    let n = 0;
    for (const [k, arr] of map) {
      let ids = "";
      for (const l of arr) {
        let i = lidx.get(l);
        if (i === undefined) {
          i = labels.length;
          lidx.set(l, i);
          labels.push(l);
        }
        ids += (ids ? "." : "") + i;
      }
      parts[n++] = k + ":" + ids;
      if (maybeYield && (n & 4095) === 0) await maybeYield();
    }
    const p = parts.join("|");
    if (maybeYield) await maybeYield();
    const t = Array.from(todos || []).join(",");
    if (maybeYield) await maybeYield();
    const ab = Array.from(abandono || []).join(",");
    if (maybeYield) await maybeYield();
    return JSON.stringify(Object.assign({ v: 3, labels, p, t, ab }, meta || {}));
  }

  async function unpackPym(txt, maybeYield) {
    const o = JSON.parse(txt);
    if (o.v !== 3) return null;
    const labels = o.labels || [];
    const map = new Map();
    const parts = o.p ? o.p.split("|") : [];
    for (let i = 0; i < parts.length; i++) {
      const c = parts[i].indexOf(":");
      if (c < 0) continue;
      const ids = parts[i].slice(c + 1);
      const arr = ids ? ids.split(".").map((x) => labels[+x]).filter((x) => x !== undefined) : [];
      map.set(parts[i].slice(0, c), arr);
      if (maybeYield && (i & 2047) === 0) await maybeYield();
    }
    const todos = new Set();
    const t = o.t ? o.t.split(",") : [];
    for (let i = 0; i < t.length; i++) {
      if (t[i]) todos.add(t[i]);
      if (maybeYield && (i & 8191) === 0) await maybeYield();
    }
    const abandono = new Set();
    const ab = o.ab ? o.ab.split(",") : [];
    for (let i = 0; i < ab.length; i++) {
      if (ab[i]) abandono.add(ab[i]);
      if (maybeYield && (i & 8191) === 0) await maybeYield();
    }
    return { map, todos, abandono, meta: o };
  }

  function applyPymIdx(idx, fileName, mtime, nombreReal) {
    state.pym = idx.map;
    state.pymTodos = idx.todos;
    state.pymAbandono = idx.abandono || new Set();
    state.pymMTime = mtime || "";
    state.pymFP = pymFP(nombreReal || fileName, mtime);
    afterPymLoaded(fileName);
    savePymCache(fileName);
    try {
      localStorage.setItem("vgl_pym_dia", todayStamp());
    } catch (e) {}
  }

  async function savePymCache(fileName) {
    try {
      if (typeof GM_setValue === "undefined") return;
      const txt = await packPym(
        state.pym,
        state.pymTodos,
        state.pymAbandono,
        { date: todayStamp(), name: fileName, mtime: state.pymMTime, fp: state.pymFP, fb: !!state.pymFallback },
        makeYielder(15)
      );
      if (txt.length <= 12 * 1024 * 1024) {
        GM_setValue("vgl_pym", txt);
        GM_setValue("vgl_pym_dia", todayStamp());
        GM_setValue("vgl_pym_esfallback", state.pymFallback ? "1" : "");
      } else {
        GM_setValue("vgl_pym", "");
        GM_setValue("vgl_pym_dia", "");
        setSummary("La base indexada no cabe en la caché (" + Math.round(txt.length / 1048576) + " MB).", "warn");
      }
    } catch (e) {}
  }

  // =====================================================================
  // SHAREPOINT & DESCARGAS AUTOMÁTICAS (RESTAURADO Y MEJORADO)
  // =====================================================================
  function todayStamp() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function spBase() {
    return "https://" + CONFIG.SP.host + CONFIG.SP.web;
  }

  function todayTokens() {
    const d = new Date(),
      p = (n) => String(n).padStart(2, "0");
    const Y = d.getFullYear(),
      M = p(d.getMonth() + 1),
      D = p(d.getDate()),
      m = d.getMonth() + 1,
      day = d.getDate();
    const MES = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ][d.getMonth()];
    return [
      `${Y}${M}${D}`,
      `${Y}-${M}-${D}`,
      `${Y}_${M}_${D}`,
      `${D}${M}${Y}`,
      `${D}-${M}-${Y}`,
      `${D}_${M}_${Y}`,
      `${day}-${m}-${Y}`,
      `${day}/${m}/${Y}`,
      `${day} de ${MES}`,
      `${D} de ${MES}`,
      `${day} ${MES}`,
      `${D} ${MES}`,
    ];
  }

  function normName(s) {
    return String(s || "").replace(/[.\s_\-\/]/g, "").toLowerCase();
  }

  function nameHasToken(n, t) {
    let i = -1;
    while ((i = n.indexOf(t, i + 1)) >= 0) {
      const prev = n[i - 1];
      if (!(prev >= "0" && prev <= "9")) return true;
    }
    return false;
  }

  function esNombreDeHoy(name) {
    const toks = todayTokens().map(normName);
    const n = normName(name);
    return toks.some((t) => (/[a-z]/.test(t) ? nameHasToken(n, t) : n.includes(t)));
  }

  function pickTodaysFile(files) {
    const xls = (files || []).filter((f) => /\.(xlsx|xlsm|csv)$/i.test(f.Name || "") && !/^~\$/.test(f.Name || ""));
    if (!xls.length) return null;
    return xls.find((f) => esNombreDeHoy(f.Name)) || null;
  }

  function spListUrl(folder) {
    return (
      spBase() +
      "/_api/web/GetFolderByServerRelativeUrl('" +
      encodeURI(folder || CONFIG.SP.folder) +
      "')/Files?$select=Name,ServerRelativeUrl,TimeLastModified&$orderby=TimeLastModified%20desc&$top=60"
    );
  }

  const spRows = (j) => (j && (j.value || (j.d && j.d.results))) || [];
  function spDownloadUrl(sru) {
    return spBase() + "/_api/web/GetFileByServerRelativeUrl('" + encodeURI(sru) + "')/$value";
  }

  const gmJson = async (url) => {
    const r = await gmGet(url, "json", "application/json;odata=nometadata", 12000);
    return r.response || (r.responseText ? JSON.parse(r.responseText) : {});
  };

  let shareAccessAt = 0;
  async function primeShareAccess(force) {
    const link = CONFIG.SP.shareLink;
    if (!link || typeof GM_xmlhttpRequest === "undefined") return false;
    if (!force && Date.now() - shareAccessAt < 25 * 60 * 1000) return true;
    try {
      await gmGet(link, "", "", 15000);
      shareAccessAt = Date.now();
      return true;
    } catch (e) {
      return false;
    }
  }

  function parseSpDocId(u) {
    try {
      const s = decodeURIComponent(String(u || ""));
      const m =
        /sourcedoc=\{?([0-9a-fA-F-]{36})\}?/.exec(s) ||
        /\{([0-9a-fA-F-]{36})\}/.exec(s) ||
        /^\s*([0-9a-fA-F-]{36})\s*$/.exec(s);
      return m ? m[1].toLowerCase() : "";
    } catch (e) {
      return "";
    }
  }

  function spFallbackUrls(id) {
    const g = String(id || "").replace(/[{}]/g, "").toLowerCase();
    return [
      spBase() + "/_api/web/GetFileById('" + g + "')/$value",
      spBase() + "/_layouts/15/download.aspx?UniqueId=" + g,
    ];
  }

  async function readPym(name, buffer) {
    if (/\.csv$/i.test(name)) {
      const all = parseCSV(new TextDecoder().decode(new Uint8Array(buffer)));
      return indexRowsAsync(all[0] || [], all.slice(1), makeYielder(15));
    }
    const r = await readPymWorkbookStream(buffer);
    state.pymHoja = r.sheetName || "";
    return { map: r.map, todos: r.todos, abandono: r.abandono };
  }

  const T_DESCARGA = 120000;
  function gmGet(url, responseType, accept, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === "undefined") {
        reject(new Error("Permiso GM_xmlhttpRequest no concedido."));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: responseType || "",
        headers: accept ? { Accept: accept } : {},
        timeout: timeoutMs || 60000,
        onload: (r) => (r.status >= 200 && r.status < 300 ? resolve(r) : reject(new Error("HTTP " + r.status))),
        onerror: () => reject(new Error("Error de red/permiso.")),
        ontimeout: () => reject(new Error("Tiempo de espera agotado.")),
      });
    });
  }

  let cacheCargando = false;
  async function loadPymFromCache() {
    if (cacheCargando) return false;
    cacheCargando = true;
    try {
      if (typeof GM_getValue === "undefined") return false;
      const raw = GM_getValue("vgl_pym", "");
      if (!raw) return false;
      if (raw.lastIndexOf('{"v":3', 0) !== 0) return false;
      const u = await unpackPym(raw, makeYielder(15));
      if (!u || u.meta.date !== todayStamp()) return false;
      if (state.pymFile) return true;
      state.pym = u.map;
      state.pymTodos = u.todos;
      state.pymAbandono = u.abandono || new Set();
      state.pymMTime = u.meta.mtime || "";
      state.pymFP = u.meta.fp || "";
      state.pymFallback = !!u.meta.fb;
      afterPymLoaded((u.meta.name || "PyM") + " (auto)");
      return true;
    } catch (e) {
      return false;
    } finally {
      cacheCargando = false;
    }
  }

  function esLibroValido(buf, nombre) {
    if (!buf || !buf.byteLength) return false;
    if (/\.csv$/i.test(nombre || "")) return true;
    const u8 = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
    return u8[0] === 0x50 && u8[1] === 0x4b;
  }

  function esXlsxCifrado(buf) {
    if (!buf || buf.byteLength < 8) return false;
    const u8 = new Uint8Array(buf, 0, 8);
    return u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0;
  }

  let diarioEnCurso = false;
  let diarioFallosSesion = 0;

  async function loadPymDiario(silent) {
    if (diarioEnCurso || typeof GM_xmlhttpRequest === "undefined") return false;
    diarioEnCurso = true;
    try {
      await primeShareAccess();
      let filas;
      try {
        filas = spRows(await gmJson(spListUrl()));
        diarioFallosSesion = 0;
      } catch (eList) {
        try {
          await primeShareAccess(true);
          filas = spRows(await gmJson(spListUrl()));
          diarioFallosSesion = 0;
        } catch (eList2) {
          diarioFallosSesion++;
          filas = [];
          if (diarioFallosSesion === 3 && state.leader) {
            showToast(
              "AMBAR",
              "🔒 Sesión de SharePoint vencida",
              "Llevo media hora sin verificar la carpeta PyM. Recargue la sesión o use 'Cargar prevención'.",
              true
            );
          }
        }
      }

      const sel = pickTodaysFile(filas);
      if (!sel) {
        if (!silent)
          setSummary(
            "Aún no aparece el PyM de hoy en SharePoint. " +
              (state.pymFile ? "Conservando datos cargados." : "Buscando base piloto de respaldo..."),
            "warn"
          );
        return false;
      }

      if (state.pymFP === pymFP(sel.Name, sel.TimeLastModified)) return true;

      progreso("Descargando PyM del día (" + sel.Name + ")…");
      const dl = await gmGet(spDownloadUrl(sel.ServerRelativeUrl), "arraybuffer", "", T_DESCARGA);
      if (!esLibroValido(dl.response, sel.Name)) {
        throw new Error(esXlsxCifrado(dl.response) ? "El archivo tiene contraseña" : "Respuesta no válida");
      }

      const idx = await readPym(sel.Name, dl.response);
      const eraRespaldo = state.pymFallback;
      state.pymFallback = false;
      applyPymIdx(idx, sel.Name + " (PyM de hoy)", sel.TimeLastModified, sel.Name);
      showToast(
        "AZUL",
        eraRespaldo ? "📋 PyM Real de Hoy Cargado" : "📋 PyM del Día Cargado",
        `${sel.Name}\n${state.pym.size} paciente(s) con actividades preventivas pendientes.`,
        false
      );
      return true;
    } catch (e) {
      if (!silent) setSummary("No se pudo leer el PyM del día (" + ((e && e.message) || e) + ").", "warn");
      return false;
    } finally {
      diarioEnCurso = false;
    }
  }

  let baseIntentos = 0;
  async function loadPymBase(silent) {
    if (!S.baseAuto) return false;
    const fb = CONFIG.SP.respaldo;
    if (!fb || !fb.id || typeof GM_xmlhttpRequest === "undefined") return false;
    if (state.pymFile) return true;

    progreso("Bajando la base PyM de la sede (respaldo)...");
    const errores = [];
    let buf = null;
    for (const url of spFallbackUrls(fb.id)) {
      try {
        const dl = await gmGet(url, "arraybuffer", "", T_DESCARGA);
        if (!esLibroValido(dl.response, fb.name))
          throw new Error(esXlsxCifrado(dl.response) ? "el archivo tiene contraseña" : "no es un Excel");
        buf = dl.response;
        break;
      } catch (e) {
        errores.push((e && e.message) || "error");
      }
    }

    if (!buf) {
      if (!silent)
        setSummary(
          "No bajó la base PyM automática. Haz clic abajo en «📂 Cargar prevención» para elegir tu archivo .xlsx manualmente.",
          "warn"
        );
      return false;
    }

    if (state.pymFile && !state.pymFallback) return true;
    progreso("Leyendo base de respaldo...");
    const idx = await readPym(fb.name, buf);
    if (state.pymFile && !state.pymFallback) return true;

    state.pymFallback = true;
    applyPymIdx(idx, fb.name + " (base piloto referencia)", "", fb.name);
    showToast(
      "AMBAR",
      "📋 Usando Base Piloto de Respaldo",
      `${fb.name}\n${state.pym.size} paciente(s). Se actualizará automáticamente al subir la agenda del día.`,
      false
    );
    return true;
  }

  function schedulePymBase() {
    if (state.pymFile || baseIntentos >= 3) return;
    const espera = baseIntentos === 0 ? 1500 : baseIntentos === 1 ? 30000 : 90000;
    baseIntentos++;
    setTimeout(async () => {
      if (state.pymFile || (await loadPymFromCache())) return;
      if (!heartbeat()) {
        schedulePymBase();
        return;
      }
      const ok = await loadPymDiario(true).catch(() => false);
      if (!ok) {
        const okBase = await loadPymBase(baseIntentos < 3).catch(() => false);
        if (!okBase) schedulePymBase();
      }
    }, espera);
  }

  async function bootSharepointLite() {
    try {
      if (typeof GM_setValue === "undefined" || typeof GM_getValue === "undefined") return;
      if (!S.baseAuto) return;
      const yaListo =
        GM_getValue("vgl_pym_dia", "") === todayStamp() &&
        !GM_getValue("vgl_pym_esfallback", "1") &&
        String(GM_getValue("vgl_pym", "") || "").length > 100;
      if (yaListo) return;

      let nombre = "",
        buf = null,
        esFallback = true,
        mtime = "";
      try {
        const rl = await fetch(spListUrl(), { credentials: "include", headers: { Accept: "application/json;odata=nometadata" } });
        if (rl.ok) {
          const sel = pickTodaysFile(spRows(await rl.json()));
          if (sel) {
            const rd = await fetch(spDownloadUrl(sel.ServerRelativeUrl), { credentials: "include" });
            if (rd.ok) {
              const b = await rd.arrayBuffer();
              if (esLibroValido(b, sel.Name)) {
                buf = b;
                nombre = sel.Name;
                mtime = sel.TimeLastModified || "";
                esFallback = false;
              }
            }
          }
        }
      } catch (e) {}

      if (!buf) return;
      const idx = await readPym(nombre, buf);
      const txt = await packPym(
        idx.map,
        idx.todos,
        idx.abandono,
        { date: todayStamp(), name: nombre + (esFallback ? " (base piloto)" : " (PyM de hoy)"), mtime, fp: pymFP(nombre, mtime), fb: esFallback },
        makeYielder(15)
      );
      if (txt.length <= 12 * 1024 * 1024) {
        GM_setValue("vgl_pym", txt);
        GM_setValue("vgl_pym_dia", todayStamp());
        GM_setValue("vgl_pym_esfallback", esFallback ? "1" : "");
      }
    } catch (e) {}
  }

  // =====================================================================
  // CONTADORES DEL DÍA & AUDITORÍA
  // =====================================================================
  const STATS_KEY = "vgl_stats",
    KEEP_DAYS = 30;
  function allStats() {
    return readJSON(SETTINGS_KEY, {}) || {};
  }
  function statsToday() {
    const a = allStats();
    return a[todayStamp()] || { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 };
  }
  function bumpStat(kind) {
    const a = allStats(),
      d = todayStamp();
    a[d] = a[d] || { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 };
    a[d][kind] = (a[d][kind] || 0) + 1;
    purgeOld(a);
    writeJSON(STATS_KEY, a);
  }
  function purgeOld(obj) {
    const lim = new Date();
    lim.setDate(lim.getDate() - KEEP_DAYS);
    for (const k of Object.keys(obj)) {
      const d = new Date(k + "T00:00:00");
      if (!isFinite(d) || d < lim) delete obj[k];
    }
  }

  const evKey = (d) => "vgl_ev_" + (d || todayStamp());
  let evBuffer = [],
    evTimer = null,
    evDia = "";
  function evFlush() {
    evTimer = null;
    if (!evBuffer.length) return;
    try {
      const d = evDia || todayStamp(),
        k = evKey(d);
      const hoy = (readJSON(k, []) || []).concat(evBuffer);
      evBuffer = [];
      writeJSON(k, hoy.length > 3000 ? hoy.slice(-3000) : hoy);
    } catch (e) {
      evBuffer = [];
    }
  }
  function logEvent(ev) {
    try {
      const d = todayStamp();
      if (evDia && evDia !== d) evFlush();
      evDia = d;
      evBuffer.push(ev);
      if (evBuffer.length >= 200) {
        evFlush();
        return;
      }
      if (ev && ev.ev === "FRAUDE_EXTEMPORANEO") {
        if (evTimer) {
          clearTimeout(evTimer);
          evTimer = null;
        }
        evFlush();
        return;
      }
      if (!evTimer) evTimer = setTimeout(evFlush, 2000);
    } catch (e) {}
  }

  function eventsOf(day) {
    evFlush();
    return readJSON(evKey(day), []) || [];
  }

  function csvCell(v) {
    const s = String(v === undefined || v === null ? "" : v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadBlob(blob, filename) {
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1500);
    } catch (e) {}
  }

  function exportAudit(day) {
    const d = day || todayStamp(),
      evs = eventsOf(d),
      st = allStats()[d] || { fraude: 0, inasistencia: 0, atiempo: 0 };
    const head = ["Hora", "Evento", "Hora cita", "Documento", "Estado", "Estado previo", "Minutos", "Paciente"];
    const lines = [
      "REPORTE CLINICO DE ATENCION - VIGILANTE DE AGENDA v" + VERSION,
      "Fecha;" + d,
      "Confirmaciones extemporáneas;" + (st.fraude || 0),
      "Inasistencias registradas;" + (st.inasistencia || 0),
      "Ingresos a tiempo;" + (st.atiempo || 0),
      "Eventos registrados;" + evs.length,
      "",
      head.join(";"),
    ];
    for (const e of evs)
      lines.push(
        [e.t, e.ev, e.hora, e.doc, e.estado, e.previo || "", e.min === undefined ? "" : e.min, e.nombre || ""]
          .map(csvCell)
          .join(";")
      );
    downloadBlob(
      new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
      "auditoria_vigilante_" + d + ".csv"
    );
    setSummary("Reporte del " + d + " descargado (" + evs.length + " evento(s)).");
  }

  // =====================================================================
  // EXTRACCIÓN DOM & CLASIFICACIÓN DE CITAS
  // =====================================================================
  function firstMatch(root, selList) {
    const arr = Array.isArray(selList) ? selList : [selList];
    for (const s of arr) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function containerOf(elHora) {
    for (const s of CONFIG.SEL.contenedor) {
      const c = elHora.closest(s);
      if (c) return c;
    }
    const body = elHora.ownerDocument.body;
    let n = elHora.parentElement,
      saltos = 0;
    while (n && n !== body && saltos < 8) {
      if (n.querySelector(CONFIG.SEL.estado)) return n;
      n = n.parentElement;
      saltos++;
    }
    return null;
  }

  function extractAgenda(doc) {
    doc = doc || document;
    const horas = Array.from(doc.querySelectorAll(CONFIG.SEL.hora));
    if (horas.length === 0) return { visible: false, citas: [] };
    const citas = horas.map((h, i) => {
      const cont = containerOf(h);
      let estado = "",
        documento = "",
        nombre = "",
        modalidad = "";
      if (cont) {
        estado = limpio((cont.querySelector(CONFIG.SEL.estado) || {}).textContent);
        documento = limpio((firstMatch(cont, CONFIG.SEL.documento) || {}).textContent);
        nombre = limpio((firstMatch(cont, CONFIG.SEL.nombre) || {}).textContent);
        modalidad = limpio((cont.querySelector(CONFIG.SEL.modalidad) || {}).textContent);
      }
      return {
        hora_texto: limpio(h.textContent),
        doc_id: extractDoc(documento),
        nombre: nombre || "Paciente Everest",
        modalidad,
        estado: estado || "Pendiente",
        index: i,
      };
    });
    return { visible: true, citas };
  }

  function seccionActiva() {
    try {
      if (document.getElementById("anamesis")) return "historia";
      if (document.querySelector(CONFIG.SEL.hora) && document.querySelector(CONFIG.SEL.estado)) return "agenda";
      return "otra";
    } catch (e) {
      return "otra";
    }
  }

  function parseHoraMin(ts) {
    const s = String(ts == null ? "" : ts).trim();
    if (!s) return null;
    const m = /(\d{1,2}):(\d{2})(?::\d{2})?/.exec(s);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (!(h >= 0 && h <= 23) || !(mi >= 0 && mi <= 59)) return null;
    const ap = /([AaPp])\.?\s*[Mm]/.exec(s.slice(m.index + m[0].length));
    if (ap) {
      h = h % 12;
      if (/[Pp]/.test(ap[1])) h += 12;
    }
    return h * 60 + mi;
  }

  function horaBonita(min) {
    if (min == null) return "";
    const h24 = Math.floor(min / 60) % 24,
      mi = min % 60,
      h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return h12 + ":" + String(mi).padStart(2, "0") + (h24 < 12 ? " a. m." : " p. m.");
  }

  function elapsedMin(ts, now) {
    const min = parseHoraMin(ts);
    if (min == null) return 0;
    const apt = new Date(now);
    apt.setHours(0, min, 0, 0);
    return (now - apt) / 60000;
  }

  function apptKey(a) {
    return (a.doc_id ? a.doc_id : a.nombre + "|" + a.index) + "@" + (a.hora_texto || "");
  }

  let diaActual = "";
  function diaNuevo() {
    const d = todayStamp();
    if (!diaActual) {
      diaActual = d;
      state.sessionEpoch = Date.now();
      return;
    }
    if (diaActual === d) return;
    diaActual = d;
    state.sessionEpoch = Date.now();
    state.historical.clear();
    state.notified.clear();
    state.fraudWatch.clear();
    state.alertedFraud.clear();
    state.warnedTimes.clear();
    state.summarized = false;
    state.lastSignature = "";
    setSummary("Nuevo día: se reinició el seguimiento.");
  }

  function colorAndAlert(a, now) {
    const st = (a.estado || "").toLowerCase();
    const key = apptKey(a);
    const elapsed = elapsedMin(a.hora_texto, now);
    const pym = getActivities(a.doc_id);
    const prev = state.historical.get(key) || "";

    const grace = CONFIG.TOLERANCIA_MIN,
      prealert = CONFIG.TOLERANCIA_MIN - 1.0;
    let color = "AZUL",
      sound = false,
      reason = "",
      arrival = false;

    if (st.includes("en sala")) {
      if (state.fraudWatch.has(key)) {
        color = "ROJO";
        if (!state.alertedFraud.has(key)) {
          sound = true;
          state.alertedFraud.add(key);
        }
      } else {
        color = "VERDE";
        if (prev.includes("sin presentarse")) arrival = true;
      }
    } else if (st.includes("atendido")) {
      if (state.alertedFraud.has(key)) color = "ROJO";
      else if (state.fraudWatch.has(key)) {
        color = "ROJO";
        sound = true;
        state.alertedFraud.add(key);
      } else color = "VERDE";
    } else if (st.includes("sin presentarse")) {
      if (elapsed >= grace) {
        color = "AMBAR";
        state.fraudWatch.add(key);
      } else if (elapsed >= prealert) {
        color = "MORADO";
        reason = "tiempo";
      } else color = "AZUL";
    } else {
      if (elapsed >= prealert) {
        color = "MORADO";
        reason = "tiempo";
      } else if (pym.length >= 3) {
        color = "MORADO";
        reason = "pym";
      } else color = "AZUL";
    }

    const stamp = new Date().toLocaleTimeString(),
      mins = Math.round(elapsed * 10) / 10;
    if (!state.leader) {
      state.historical.set(key, st);
      return { ...a, key, color, reason, arrival, sound: false, elapsed: mins, pym };
    }

    if (sound) {
      logEvent({ t: stamp, ev: "FRAUDE_EXTEMPORANEO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, min: mins, nombre: a.nombre });
    } else if (st !== prev && prev !== "") {
      logEvent({ t: stamp, ev: "CAMBIO_ESTADO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, previo: prev, min: mins, nombre: a.nombre });
    }
    state.historical.set(key, st);
    return { ...a, key, color, reason, arrival, sound, elapsed: mins, pym };
  }

  let audioCtx = null;
  function beep(freq, ms, off) {
    try {
      if (!S.sonido || Date.now() < state.muteUntil) return;
      audioCtx = audioCtx || new (PAGEWIN.AudioContext || PAGEWIN.webkitAudioContext || window.AudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const o = audioCtx.createOscillator(),
        g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.value = freq;
      o.type = "square";
      const t0 = audioCtx.currentTime + off;
      g.gain.setValueAtTime(clampNum(S.volumen, 0.02, 0.6, 0.15), t0);
      o.start(t0);
      o.stop(t0 + ms / 1000);
    } catch (e) {}
  }

  let toastQueue = [];
  let toastFlushTimer = null;
  function _renderToast(color, title, body, persist) {
    try {
      const wrap = document.getElementById("vgl-toasts");
      if (!wrap) return;
      const col = COLORS[color] || COLORS.AZUL,
        tint = TINT[color] || TINT.AZUL;
      const icon = { ROJO: "⛔", MORADO: "⏳", AMBAR: "⚠", VERDE: "✅", AZUL: "🛡️" }[color] || "🛡️";
      const t = document.createElement("div");
      t.className = "vgl-toast";
      t.innerHTML = `<div class="vgl-toast-ic" style="background:${tint};color:${col}"></div><div class="vgl-toast-main"><div class="vgl-toast-title"></div><div class="vgl-toast-b"></div></div><span class="vgl-toast-x">×</span>`;
      t.querySelector(".vgl-toast-ic").textContent = icon;
      t.querySelector(".vgl-toast-title").textContent = title;
      t.querySelector(".vgl-toast-b").textContent = body;
      const cerrar = () => {
        t.classList.add("out");
        setTimeout(() => {
          try {
            t.remove();
          } catch (e2) {}
        }, 260);
      };
      t.addEventListener("click", cerrar);
      const critico = color === "ROJO" || color === "MORADO";
      t.__vglCritico = critico;
      if (critico) wrap.prepend(t);
      else {
        wrap.appendChild(t);
        setTimeout(cerrar, 9000);
      }
    } catch (e) {}
  }

  function showToast(color, title, body, persist) {
    toastQueue.push({ color, title, body, persist });
    if (!toastFlushTimer) {
      toastFlushTimer = setTimeout(() => {
        toastFlushTimer = null;
        if (toastQueue.length > 3) {
          const criticos = toastQueue.filter((t) => t.color === "ROJO" || t.color === "MORADO").length;
          _renderToast("AMBAR", `Alerta Múltiple (${toastQueue.length})`, `${criticos} alertas críticas y ${toastQueue.length - criticos} rutinarias recibidas.`, true);
        } else {
          toastQueue.forEach((t) => _renderToast(t.color, t.title, t.body, t.persist));
        }
        toastQueue = [];
      }, 500);
    }
  }

  // =====================================================================
  // AGENDAMIENTO EXPRÉS DE CONTROL Y PyM (v7.9 / v8.2)
  // =====================================================================
  function captureDoctorInfo(srcStr) {
    try {
      if (typeof PAGEWIN !== "undefined" && PAGEWIN) {
        if (PAGEWIN.UsuarioId && (!state.activeDoctor.id || state.activeDoctor.id === 0)) {
          const id = parseInt(PAGEWIN.UsuarioId, 10);
          if (id > 0) state.activeDoctor.id = id;
        }
        if (PAGEWIN.UsuarioNombreCompleto && !state.activeDoctor.name) {
          state.activeDoctor.name = String(PAGEWIN.UsuarioNombreCompleto).trim();
        }
      }
    } catch (e) {}
    if (!srcStr || typeof srcStr !== "string") return;
    try {
      const uIdM = /UsuarioId=(\d+)/i.exec(srcStr) || /"usuarioId":\s*(\d+)/i.exec(srcStr);
      if (uIdM && uIdM[1]) {
        const id = parseInt(uIdM[1], 10);
        if (id > 0) state.activeDoctor.id = id;
      }
      const uNameM = /UsuarioNombreCompleto=([^&]+)/i.exec(srcStr) || /"usuarioNombreCompleto":\s*"([^"]+)"/i.exec(srcStr);
      if (uNameM && uNameM[1]) {
        const name = decodeURIComponent(uNameM[1]).replace(/\+/g, " ").trim();
        if (name && name.length > 3) state.activeDoctor.name = name;
      }
    } catch (e) {}
  }

  function calcBusinessTargetDate(monthsToAdd, daysToAdd) {
    const d = new Date();
    const originalDay = d.getDate();
    if (monthsToAdd) {
      d.setMonth(d.getMonth() + monthsToAdd);
      if (d.getDate() !== originalDay) {
        d.setDate(0);
      }
    }
    if (daysToAdd) d.setDate(d.getDate() + daysToAdd);
    const day = d.getDay();
    if (day === 6) d.setDate(d.getDate() - 1);
    else if (day === 0) d.setDate(d.getDate() - 2);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      fmt: `${dd}/${mm}/${yyyy}`,
      lbl: d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      dateObj: d,
    };
  }

  async function _pageFetchJsonCore(url, options) {
    let delay = 300;
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let isError = false;
      try {
        const f = FETCH0 || window.fetch;
        if (typeof f === "function") {
          const fullUrl = url.indexOf("http") === 0 ? url : location.origin + (url[0] === "/" ? "" : "/") + url;
          const resp = await f(
            fullUrl,
            Object.assign({ headers: { "Content-Type": "application/json", Accept: "application/json" } }, options || {})
          );
          if (resp && resp.ok) {
            const data = await resp.json();
            if (data) return data;
          } else if (resp && resp.status >= 500) {
            isError = true;
          } else {
            return null;
          }
        } else {
          isError = true;
        }
      } catch (e) {
        isError = true;
      }
      if (isError) {
        if (typeof GM_xmlhttpRequest !== "undefined") {
          try {
            const result = await new Promise((resolve, reject) => {
              GM_xmlhttpRequest(
                Object.assign(
                  {
                    method: (options && options.method) || "GET",
                    url: url.indexOf("http") === 0 ? url : location.origin + (url[0] === "/" ? "" : "/") + url,
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    data: (options && options.body) || null,
                    timeout: 15000,
                    onload: (r) => {
                      if (r.status >= 500) reject(new Error("500"));
                      else {
                        try {
                          resolve(JSON.parse(r.responseText));
                        } catch (e) {
                          resolve(null);
                        }
                      }
                    },
                    onerror: () => reject(new Error("NetErr")),
                    ontimeout: () => reject(new Error("Timeout")),
                  },
                  options || {}
                )
              );
            });
            if (result) return result;
          } catch (e) {}
        }
        if (attempt < maxRetries) {
          const jitter = Math.random() * 500;
          await new Promise((r) => setTimeout(r, delay + jitter));
          delay *= 2;
        }
      }
    }
    return null;
  }

  async function pageFetchJson(url, options) {
    const key = url + "|" + (options ? JSON.stringify(options) : "");
    if (GHOST.promises.has(key)) return GHOST.promises.get(key);
    const p = _pageFetchJsonCore(url, options).finally(() => {
      GHOST.promises.delete(key);
    });
    GHOST.promises.set(key, p);
    return p;
  }

  function extractPatientId(res) {
    if (!res) return null;
    if (typeof res === "number" && res > 0) return res;
    if (typeof res === "string" && /^\d+$/.test(res)) return parseInt(res, 10);
    if (Array.isArray(res) && res.length > 0) return extractPatientId(res[0]);
    if (typeof res === "object") {
      const direct =
        res.idPaciente ||
        res.pacienteId ||
        res.id ||
        res.PacienteId ||
        res.IdPaciente ||
        res.id_paciente ||
        res.ID ||
        res.Id ||
        res.paciente_id;
      if (direct && typeof direct === "number" && direct > 0) return direct;
      if (direct && typeof direct === "string" && /^\d+$/.test(direct)) return parseInt(direct, 10);
      if (res.data) {
        const fromData = extractPatientId(res.data);
        if (fromData) return fromData;
      }
      for (const k of Object.keys(res)) {
        if (k !== "data" && (Array.isArray(res[k]) || (res[k] && typeof res[k] === "object"))) {
          const fromSub = extractPatientId(res[k]);
          if (fromSub) return fromSub;
        }
      }
    }
    return null;
  }

  async function apiAccesoBuscarPaciente(docId) {
    const uId = state.activeDoctor.id || S.medicoId || 515;
    const cleanDoc = String(docId || "").replace(/\D/g, "");
    if (!cleanDoc) return null;
    const paths = [
      `/apiviva/APIAcceso/api/Paciente/BuscarPaciente?identificacion=${encodeURIComponent(cleanDoc)}&TipoDocumento=CC&epsId=2&UsuarioId=${uId}`,
      `/apiviva/APIAcceso/api/Paciente/BuscarPaciente?identificacion=${encodeURIComponent(cleanDoc)}&UsuarioId=${uId}`,
      `/apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado?idPaciente=${encodeURIComponent(cleanDoc)}`,
    ];
    for (const path of paths) {
      try {
        const res = await pageFetchJson(path);
        const pid = extractPatientId(res);
        if (pid) return pid;
      } catch (e) {}
    }
    return null;
  }

  async function apiAccesoBuscarCitasDisponibles(pacienteId, fechaIso, especialidadId) {
    const uId = state.activeDoctor.id || S.medicoId || 515;
    const espId = especialidadId || 12;
    const path = `/apiviva/APIAcceso/api/Acceso/BuscarCitasDisponibles?PacienteId=${pacienteId}&EspecialidadId=${espId}&FechaDeseada=${fechaIso}&ProgramaId=0&PuntoAtencionId=12&PerfilCodigo=PROFESIONAL&swParticular=false&presupuestoId=0`;
    return pageFetchJson(path, { method: "POST", body: "{}" });
  }

  async function apiAccesoAgdValidarAgenda(agendaId, pacienteId) {
    const path = `/apiviva/APIAcceso/api/Acceso/AgdValidarAgenda?agendaId=${agendaId}&pacienteId=${pacienteId}&ordenMongo=null&cup=null&swParticular=false`;
    try {
      await pageFetchJson(path);
    } catch (e) {}
  }

  async function apiAccesoObtenerTurnos(agendaId, fechaFmt, pacienteId) {
    const path = `/apiviva/APIAcceso/api/Acceso/ObtenerTurnos?agendaid=${agendaId}&fecha=${encodeURIComponent(fechaFmt)}&pacienteId=${pacienteId}&ordenMongo=null&cup=null&swParticular=false`;
    return pageFetchJson(path);
  }

  async function apiAccesoAsignarTurno(turnoId, pacienteId, fechaIso, observacion, isPyM, marcacion) {
    const uId = state.activeDoctor.id || S.medicoId || 515;
    const docName = stripAccents(String(state.activeDoctor.name || S.medicoNombre || "").toUpperCase());
    const rcvDoctors = ["PALENCIA", "BPALENCIA", "PINO", "MPINO", "ESTRADA", "EESTRADA", "MIJARES", "SMIJARES"];
    const esMedicoRCV = rcvDoctors.some((p) => docName.includes(p));
    const swPyM = esMedicoRCV ? true : !!isPyM;
    const swProgEspecial = esMedicoRCV ? true : false;
    const marc = encodeURIComponent(marcacion || "Consulta");
    const obs = encodeURIComponent(observacion || "");
    const path = `/apiviva/APIAcceso/api/Acceso/AsignarTurno?OrdenMongoId=null&TurnoId=${turnoId}&Marcacion=${marc}&PacienteId=${pacienteId}&FechaDeseada=${fechaIso}&TipoConsulta=PRESENCIAL&Ip=192&UsuarioId=${uId}&CodigoCups=null&SwProgramaEspecial=${swProgEspecial}&swIsPac=false&swIsPyM=${swPyM}&ObservacionCita=${obs}&FechaMinimaConsultaOrden=null&Tratamiento=false&Consulta=true&Emergencia=false&PresupuestoId=0`;
    return pageFetchJson(path, { method: "POST", body: "{}" });
  }

  function extractAgendasList(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (typeof res === "object") {
      if (res.dtCitasDisponibles) return extractAgendasList(res.dtCitasDisponibles);
      if (res.agendas && Array.isArray(res.agendas)) return res.agendas;
      if (res.citas && Array.isArray(res.citas)) return res.citas;
      if (res.turnos && Array.isArray(res.turnos)) return res.turnos;
      if (res.Table && Array.isArray(res.Table)) return res.Table;
      if (res.Table1 && Array.isArray(res.Table1)) return res.Table1;
      if (res.data) return extractAgendasList(res.data);
      for (const k of Object.keys(res)) {
        if (Array.isArray(res[k]) && res[k].length > 0 && typeof res[k][0] === "object") return res[k];
      }
    }
    return [];
  }

  function calcTargetDateRange(monthsToAdd, daysToAdd) {
    const baseObj = calcBusinessTargetDate(monthsToAdd, daysToAdd);
    const baseDate = new Date(baseObj.dateObj);
    const pad = (n) => String(n).padStart(2, "0");
    const getInfo = (dt, isCenter) => {
      const yyyy = dt.getFullYear();
      const mm = pad(dt.getMonth() + 1);
      const dd = pad(dt.getDate());
      const dayShort = dt.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "");
      const dayCap = dayShort.charAt(0).toUpperCase() + dayShort.slice(1);
      return {
        iso: `${yyyy}-${mm}-${dd}`,
        fmt: `${dd}/${mm}/${yyyy}`,
        shortLbl: `${dayCap} ${dd}/${mm}`,
        lbl: dt.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        isCenter: !!isCenter,
        dateObj: new Date(dt),
      };
    };
    const prevDays = [];
    let curPrev = new Date(baseDate);
    while (prevDays.length < 3) {
      curPrev.setDate(curPrev.getDate() - 1);
      if (curPrev.getDay() !== 0 && curPrev.getDay() !== 6) {
        prevDays.unshift(getInfo(curPrev, false));
      }
    }
    const nextDays = [];
    let curNext = new Date(baseDate);
    while (nextDays.length < 3) {
      curNext.setDate(curNext.getDate() + 1);
      if (curNext.getDay() !== 0 && curNext.getDay() !== 6) {
        nextDays.push(getInfo(curNext, false));
      }
    }
    return [...prevDays, getInfo(baseDate, true), ...nextDays];
  }

  function openAgendamientoModal(apt) {
    if (!apt || !apt.doc_id) {
      setSummary("El paciente seleccionado no tiene documento legible.", "warn");
      return;
    }
    let existing = document.getElementById("vgl-agendar-modal");
    if (existing) existing.remove();

    const patientName = apt.nombre || apt.name || "Paciente Everest";
    const doctorName = state.activeDoctor.name || S.medicoNombre || "MÉDICO EN SESIÓN";

    const modal = document.createElement("div");
    modal.id = "vgl-agendar-modal";
    modal.className = isLight() ? "light" : "";

    let selectedEspId = 12;
    let selectedEspName = "Medicina General (Control)";

    modal.innerHTML = `
<div class="vgl-agm-card" style="max-width:650px">
  <div class="vgl-agm-head">
    <div>
      <div class="vgl-agm-title">📅 Programación de Cita / Remisión RCV</div>
      <div class="vgl-agm-sub">Paciente: <b>${escapeHtml(patientName)}</b> (${escapeHtml(apt.doc_id)})</div>
      <div class="vgl-agm-sub" style="opacity:.85">Médico: <b>${escapeHtml(doctorName)}</b></div>
    </div>
    <button class="vgl-agm-close" id="vgl-agm-x">✕</button>
  </div>
  <div class="vgl-agm-sec">
    <label class="vgl-agm-lbl">1. Seleccione la especialidad o servicio a agendar / remitir:</label>
    <div class="vgl-agm-presets" id="vgl-esp-presets" style="flex-wrap:wrap;gap:6px">
      <button class="vgl-agm-pbtn active" data-esp="12" data-name="Medicina General (Control)">🩺 Med. General (Control)</button>
      <button class="vgl-agm-pbtn" data-esp="55" data-name="Psicología">🧠 Psicología</button>
      <button class="vgl-agm-pbtn" data-esp="14" data-name="Odontología">🦷 Odontología</button>
    </div>
  </div>
  <div class="vgl-agm-sec">
    <label class="vgl-agm-lbl">2. Seleccione el plazo y explore la fecha objetivo (±3 días hábiles):</label>
    <div class="vgl-agm-presets" id="vgl-time-presets">
      <button class="vgl-agm-pbtn" data-m="0" data-d="15">15 días</button>
      <button class="vgl-agm-pbtn active" data-m="1" data-d="0">1 mes</button>
      <button class="vgl-agm-pbtn" data-m="2" data-d="0">2 meses</button>
      <button class="vgl-agm-pbtn" data-m="3" data-d="0">3 meses</button>
      <button class="vgl-agm-pbtn" data-m="4" data-d="0">4 meses</button>
      <button class="vgl-agm-pbtn" data-m="5" data-d="0">5 meses</button>
      <button class="vgl-agm-pbtn" data-m="6" data-d="0">6 meses</button>
    </div>
    <div id="vgl-day-chips" class="vgl-agm-presets" style="margin-top:8px;gap:5px;flex-wrap:wrap"></div>
    <div id="vgl-agm-date-info" class="vgl-agm-dinfo" style="margin-top:6px">Calculando fecha deseada...</div>
  </div>
  <div class="vgl-agm-sec">
    <label class="vgl-agm-lbl">3. Horarios disponibles en la agenda del servicio seleccionado:</label>
    <div id="vgl-agm-slots" class="vgl-agm-slots"><div class="vgl-agm-loading">Consultando horarios disponibles...</div></div>
  </div>
  <div class="vgl-agm-sec">
    <label class="vgl-agm-check-lbl">
      <input type="checkbox" id="vgl-agm-pym-chk" checked>
      <span>¿Es cita para actividades del programa RCV / Prevención?</span>
    </label>
    <textarea id="vgl-agm-obs" class="vgl-agm-input" placeholder="Observaciones de la cita (ej. REMISION RCV CON CONTROL)..." rows="2"></textarea>
  </div>
  <div class="vgl-agm-foot">
    <button id="vgl-agm-cancel" class="vgl-agm-btn sec">Cancelar</button>
    <button id="vgl-agm-confirm" class="vgl-agm-btn pri" disabled>✓ Confirmar y asignar cita</button>
  </div>
</div>
`;
    document.body.appendChild(modal);

    let selectedTimeframe = { m: 1, d: 0 };
    let selectedDateInfo = null;
    let pacienteIdAcceso = null;
    let selectedTurnoObj = null;

    const xBtn = modal.querySelector("#vgl-agm-x");
    const cancelBtn = modal.querySelector("#vgl-agm-cancel");
    const confirmBtn = modal.querySelector("#vgl-agm-confirm");
    const dateInfoEl = modal.querySelector("#vgl-agm-date-info");
    const slotsEl = modal.querySelector("#vgl-agm-slots");
    const dayChipsEl = modal.querySelector("#vgl-day-chips");

    const closeMod = () => modal.remove();
    xBtn.addEventListener("click", closeMod);
    cancelBtn.addEventListener("click", closeMod);

    let _cargarHorasToken = 0;
    async function cargarHoras() {
      if (!selectedDateInfo) return;
      const token = ++_cargarHorasToken;
      selectedTurnoObj = null;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "✓ Confirmar y asignar cita";

      dateInfoEl.innerHTML = `Servicio: <b>${escapeHtml(selectedEspName)}</b> · Fecha deseada: <b>${selectedDateInfo.fmt}</b> <span style="opacity:.75">(${selectedDateInfo.lbl})</span>`;
      slotsEl.innerHTML = `<div class="vgl-agm-loading">Buscando agendas de ${escapeHtml(selectedEspName)} para el ${selectedDateInfo.fmt}...</div>`;

      if (!pacienteIdAcceso) {
        pacienteIdAcceso = await apiAccesoBuscarPaciente(apt.doc_id);
      }
      if (token !== _cargarHorasToken) return;

      if (!pacienteIdAcceso) {
        slotsEl.innerHTML = `<div class="vgl-agm-err">⚠ No se encontró el paciente en el sistema de agenda con el documento ${escapeHtml(apt.doc_id)}.</div>`;
        return;
      }

      const resAgendas = await apiAccesoBuscarCitasDisponibles(pacienteIdAcceso, selectedDateInfo.iso, selectedEspId);
      if (token !== _cargarHorasToken) return;

      const agendas = extractAgendasList(resAgendas);
      if (!agendas || !agendas.length) {
        slotsEl.innerHTML = `<div class="vgl-agm-err">No hay agendas abiertas de ${escapeHtml(selectedEspName)} para el ${selectedDateInfo.fmt}. Prueba con otro día vecino arriba.</div>`;
        return;
      }

      let agendasFiltradas = agendas;
      if (selectedEspId === 12) {
        const normMedDoc = stripAccents(doctorName.toLowerCase());
        const miAgenda = agendas.find((a) => {
          const nm = stripAccents(String(a.medico || a.usuarioNombreCompleto || a.nombreMedico || a.profesional || a.nombre || "").toLowerCase());
          return nm.includes(normMedDoc) || normMedDoc.split(" ").every((tok) => tok.length > 2 && nm.includes(tok));
        });
        if (miAgenda) agendasFiltradas = [miAgenda];
      }

      slotsEl.innerHTML = `<div class="vgl-agm-loading">Consultando turnos en ${agendasFiltradas.length} agenda(s)...</div>`;

      const turnosAcumulados = [];
      for (const ag of agendasFiltradas.slice(0, 5)) {
        if (token !== _cargarHorasToken) return;
        const agendaId = ag.agendaId || ag.id || ag.AgendaId || ag.idAgenda || ag.IdAgenda;
        const nombreProf = ag.medico || ag.usuarioNombreCompleto || ag.nombreMedico || ag.profesional || ag.nombre || "Profesional";
        await apiAccesoAgdValidarAgenda(agendaId, pacienteIdAcceso);
        const resTurnos = await apiAccesoObtenerTurnos(agendaId, selectedDateInfo.fmt, pacienteIdAcceso);
        const turnos = extractAgendasList(resTurnos);
        if (turnos && turnos.length) {
          turnos.forEach((t) => turnosAcumulados.push({ turno: t, profesional: nombreProf }));
        }
      }

      if (token !== _cargarHorasToken) return;

      if (!turnosAcumulados.length) {
        slotsEl.innerHTML = `<div class="vgl-agm-err">Sin horas libres disponibles en ${escapeHtml(selectedEspName)} para el ${selectedDateInfo.fmt}.</div>`;
        return;
      }

      slotsEl.innerHTML = "";
      turnosAcumulados.forEach((item) => {
        const t = item.turno;
        const horaStr = t.horaInicio || t.hora || t.HoraInicio || t.Hora || "00:00";
        const btn = document.createElement("button");
        btn.className = "vgl-agm-sbtn";
        btn.textContent = `${horaStr} (${item.profesional.split(" ")[0]})`;
        btn.addEventListener("click", () => {
          slotsEl.querySelectorAll(".vgl-agm-sbtn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedTurnoObj = t;
          confirmBtn.disabled = false;
          confirmBtn.textContent = `✓ Asignar Cita (${horaStr})`;
        });
        slotsEl.appendChild(btn);
      });
    }

    function renderDayChips() {
      const range = calcTargetDateRange(selectedTimeframe.m, selectedTimeframe.d);
      dayChipsEl.innerHTML = "";
      range.forEach((dInfo) => {
        const chip = document.createElement("button");
        chip.className = "vgl-agm-pbtn" + (dInfo.isCenter ? " active" : "");
        chip.textContent = dInfo.shortLbl;
        chip.addEventListener("click", () => {
          dayChipsEl.querySelectorAll(".vgl-agm-pbtn").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          selectedDateInfo = dInfo;
          cargarHoras();
        });
        if (dInfo.isCenter) selectedDateInfo = dInfo;
        dayChipsEl.appendChild(chip);
      });
      cargarHoras();
    }

    modal.querySelectorAll("#vgl-esp-presets .vgl-agm-pbtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.querySelectorAll("#vgl-esp-presets .vgl-agm-pbtn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedEspId = parseInt(btn.dataset.esp, 10);
        selectedEspName = btn.dataset.name;
        renderDayChips();
      });
    });

    modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedTimeframe = { m: parseInt(btn.dataset.m, 10), d: parseInt(btn.dataset.d, 10) };
        renderDayChips();
      });
    });

    confirmBtn.addEventListener("click", async () => {
      if (!selectedTurnoObj || !pacienteIdAcceso || !selectedDateInfo) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "⏳ Creando cita...";
      const turnoId = selectedTurnoObj.turnoId || selectedTurnoObj.id || selectedTurnoObj.TurnoId;
      const isPyM = modal.querySelector("#vgl-agm-pym-chk").checked;
      const obs = modal.querySelector("#vgl-agm-obs").value;

      try {
        const res = await apiAccesoAsignarTurno(turnoId, pacienteIdAcceso, selectedDateInfo.iso, obs, isPyM, "Consulta");
        markCitaAgendadaHoy(apt.doc_id);
        showToast("VERDE", "✅ Cita Asignada con Éxito", `Cita de ${selectedEspName} agendada para el ${selectedDateInfo.fmt} a favor de ${patientName}.`, true);
        setSummary(`Cita agendada: ${selectedEspName} (${selectedDateInfo.fmt}) para ${patientName}.`);
        closeMod();
      } catch (e) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "✓ Reintentar Asignar Cita";
        alert("Error al asignar la cita: " + (e.message || "Fallo en servidor"));
      }
    });

    renderDayChips();
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =====================================================================
  // RENDER & REPAINT INTERFAZ PANEL
  // =====================================================================
  let el = {};
  let winState = "full";

  function setWinState(s, auto) {
    winState = s;
    if (!el.root) return;
    el.root.classList.toggle("min", s === "min");
    el.root.style.display = s === "dock" ? "none" : "flex";
    if (el.dock) el.dock.style.display = s === "dock" ? "flex" : "none";
    if (!auto) {
      state.userWinState = s;
      savePos();
    }
  }

  function savePos() {
    try {
      localStorage.setItem("vgl_pos", JSON.stringify({ state: state.userWinState }));
    } catch (e) {}
  }

  function restorePos() {
    try {
      const p = readJSON("vgl_pos", null);
      if (p && p.state) setWinState(p.state, true);
    } catch (e) {}
  }

  function setSummary(txt, mode) {
    if (!el.sum) return;
    el.sum.textContent = txt;
    el.sum.className = mode || "";
  }

  function repaint() {
    if (!el.list) return;
    const snap = state.lastSnapshot;
    if (!snap || !snap.list) {
      el.list.innerHTML = `<div id="vgl-empty">Ingrese a la vista de "Citas del día" para auditar la agenda.</div>`;
      return;
    }

    const q = state.busqueda;
    const f = state.filtro;
    const items = snap.list.filter((a) => {
      if (q) {
        const matchName = a.nombre.toLowerCase().includes(q);
        const matchDoc = a.doc_id.includes(q);
        if (!matchName && !matchDoc) return false;
      }
      if (f === "riesgo") return a.color === "ROJO" || a.color === "MORADO" || a.color === "AMBAR";
      if (f === "sinpres") return a.estado.toLowerCase().includes("sin presentar");
      if (f === "ensala") return a.estado.toLowerCase().includes("en sala");
      if (f === "pym") return a.pym && a.pym.length > 0;
      return true;
    });

    if (!items.length) {
      el.list.innerHTML = `<div id="vgl-empty">No se encontraron citas con el filtro activo.</div>`;
      return;
    }

    el.list.innerHTML = "";
    items.forEach((apt) => {
      const card = renderCard(apt);
      el.list.appendChild(card);
    });

    const st = statsToday();
    if (el.stats) {
      el.stats.innerHTML = `
<div class="vgl-stat hot"><span>Extemporáneas (Fraudes)</span><b>${st.fraude || 0}</b></div>
<div class="vgl-stat"><span>Inasistencias</span><b>${st.inasistencia || 0}</b></div>
<div class="vgl-stat"><span>Ingresos a tiempo</span><b>${st.atiempo || 0}</b></div>
`;
    }
  }

  function renderCard(apt) {
    const card = document.createElement("div");
    const isAgendada = isCitaAgendadaHoy(apt.doc_id);
    const colClass = apt.color.toLowerCase();
    card.className = `vgl-card ${colClass}` + (isAgendada ? " agendada" : "");

    let pymHTML = "";
    const key = normalizeKey(apt.doc_id);

    if (!state.pymFile) {
      pymHTML = `<div class="vgl-none falta">⚠️ PyM sin cargar — Clic en «📂 Cargar prevención» arriba a la izquierda</div>`;
    } else if (apt.pym && apt.pym.length > 0) {
      const chips = apt.pym.map((p) => `<span class="vgl-chip">${escapeHtml(p)}</span>`).join("");
      pymHTML = `<div class="vgl-pyms">${chips}</div>`;
    } else if (state.pymTodos && state.pymTodos.has(key)) {
      pymHTML = `<div class="vgl-none ok" style="color:var(--c-verde);font-style:normal;font-weight:600;margin-top:6px;font-size:12px">✓ Sin PyM pendiente (al día)</div>`;
    } else {
      pymHTML = `<div class="vgl-none info" style="color:var(--fg3);font-style:normal;margin-top:6px;font-size:12px">ℹ No figura en la base PyM cargada</div>`;
    }

    card.innerHTML = `
<div class="vgl-row">
  <span class="vgl-cdot" style="background:${COLORS[apt.color]}"></span>
  <span class="vgl-time">${escapeHtml(apt.hora_texto)}</span>
  <div class="vgl-name">
    <b>${escapeHtml(apt.nombre)}</b>
  </div>
  <span class="vgl-doc">${escapeHtml(apt.doc_id)}</span>
  <span class="vgl-badge" style="background:${TINT[apt.color]};color:${COLORS[apt.color]}">${escapeHtml(apt.estado)}</span>
  <div class="vgl-card-actions">
    ${
      S.agendamientoRapido
        ? `<button class="vgl-btn-agendar" title="Agendar / Remitir cita de control (1-Clic)">📅</button>`
        : ""
    }
  </div>
</div>
${pymHTML}
`;

    if (S.agendamientoRapido) {
      const agBtn = card.querySelector(".vgl-btn-agendar");
      if (agBtn) agBtn.addEventListener("click", () => openAgendamientoModal(apt));
    }

    return card;
  }

  function toggleSheet(name) {
    if (!el.sheet) return;
    if (state.sheet === name) {
      closeSheet();
      return;
    }
    state.sheet = name;
    el.root.classList.add("sheet");
    if (name === "resumen") renderResumenSheet();
    else if (name === "ajustes") renderAjustesSheet();
  }

  function closeSheet() {
    state.sheet = null;
    el.root.classList.remove("sheet");
  }

  function renderResumenSheet() {
    const st = statsToday();
    el.sheet.innerHTML = `
<div class="vgl-sh-h">
  <span class="vgl-sh-t">📊 Resumen de Atención del Día</span>
  <button class="vgl-btn" id="vgl-sh-close">Cerrar</button>
</div>
<div class="vgl-grp">
  <div class="vgl-fld"><label>Confirmaciones Extemporáneas (Fraudes):</label><b>${st.fraude || 0}</b></div>
  <div class="vgl-fld"><label>Inasistencias Registradas:</label><b>${st.inasistencia || 0}</b></div>
  <div class="vgl-fld"><label>Ingresos a Tiempo:</label><b>${st.atiempo || 0}</b></div>
</div>
<button class="vgl-btn primary" id="vgl-sh-exp">📥 Descargar Reporte CSV</button>
`;
    el.sheet.querySelector("#vgl-sh-close").onclick = closeSheet;
    el.sheet.querySelector("#vgl-sh-exp").onclick = () => exportAudit();
  }

  function renderAjustesSheet() {
    el.sheet.innerHTML = `
<div class="vgl-sh-h">
  <span class="vgl-sh-t">⚙ Configuración de Asistente</span>
  <button class="vgl-btn" id="vgl-sh-close">Cerrar</button>
</div>
<div class="vgl-grp">
  <div class="vgl-fld">
    <div><label>Modo de Tema Visual</label><span class="vgl-hint">Seleccione el esquema de color adecuado.</span></div>
    <select id="cfg-tema">
      <option value="oscuro" ${S.tema === "oscuro" ? "selected" : ""}>Oscuro</option>
      <option value="claro" ${S.tema === "claro" ? "selected" : ""}>Claro</option>
      <option value="auto" ${S.tema === "auto" ? "selected" : ""}>Sigue a Windows</option>
    </select>
  </div>
  <div class="vgl-fld">
    <div><label>Agendamiento Exprés en 1-Clic</label><span class="vgl-hint">Habilita el botón de agendamiento rápido en cada tarjeta.</span></div>
    <label class="vgl-sw"><input type="checkbox" id="cfg-agendar" ${S.agendamientoRapido ? "checked" : ""}><i></i></label>
  </div>
  <div class="vgl-fld">
    <div><label>Alertas Auditivas</label><span class="vgl-hint">Emitir señales sonoras ante fraudes e inasistencias.</span></div>
    <label class="vgl-sw"><input type="checkbox" id="cfg-sonido" ${S.sonido ? "checked" : ""}><i></i></label>
  </div>
  <div class="vgl-fld">
    <div><label>Modo Alto Rendimiento</label><span class="vgl-hint">Desactiva efectos de transparencia para equipos lentos.</span></div>
    <label class="vgl-sw"><input type="checkbox" id="cfg-perf" ${S.modoRendimiento ? "checked" : ""}><i></i></label>
  </div>
</div>
`;
    el.sheet.querySelector("#vgl-sh-close").onclick = closeSheet;
    el.sheet.querySelector("#cfg-tema").onchange = (e) => {
      S.tema = e.target.value;
      saveSettings();
    };
    el.sheet.querySelector("#cfg-agendar").onchange = (e) => {
      S.agendamientoRapido = e.target.checked;
      saveSettings();
    };
    el.sheet.querySelector("#cfg-sonido").onchange = (e) => {
      S.sonido = e.target.checked;
      saveSettings();
    };
    el.sheet.querySelector("#cfg-perf").onchange = (e) => {
      S.modoRendimiento = e.target.checked;
      saveSettings();
    };
  }

  function saveSettings() {
    writeJSON(SETTINGS_KEY, S);
    applySettings();
    repaint();
  }

  function makeDraggable(elRoot, elHead) {
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;
    elHead.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (e.target.closest("button")) return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
      elRoot.classList.add("vgl-dragging");
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      elRoot.style.top = elRoot.offsetTop - pos2 + "px";
      elRoot.style.left = elRoot.offsetLeft - pos1 + "px";
      elRoot.style.bottom = "auto";
      elRoot.style.right = "auto";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
      elRoot.classList.remove("vgl-dragging");
    }
  }

  function buildOverlay() {
    const style = document.createElement("style");
    style.textContent = `
#vgl-root,#vgl-dock,#vgl-toasts,#vgl-modal,#vgl-pym-modal,#vgl-pes-modal,#vgl-agendar-modal,#vgl-ordenar-modal{
  --bg:rgba(22,24,29,.94);--bg-sidebar:rgba(15,17,21,.80);--bg2:rgba(255,255,255,.06);--bg3:rgba(255,255,255,.10);--bg4:rgba(255,255,255,.18);
  --c-rojo:#e54d42;--c-morado:#9333ea;--c-ambar:#d97706;--c-verde:#10b981;--c-azul:#2563eb;--c-recordatorio:#0d9488;--c-pes:#be185d;
  --r-chip:10px;--r-card:14px;--r-surface:18px;--fg:#ffffff;--fg2:rgba(241,245,249,.88);--fg3:#94a3b8;--line:rgba(255,255,255,.09);--edge:rgba(255,255,255,.16);
  --toast:rgba(30,34,42,.97);--shadow-panel:0 4px 18px rgba(0,0,0,.22),0 28px 80px rgba(0,0,0,.65);--shadow-card:0 2px 8px rgba(0,0,0,.25);
  --font-stack:system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
#vgl-root.light,#vgl-dock.light,#vgl-toasts.light,#vgl-agendar-modal.light{
  --bg:rgba(248,250,252,.95);--bg-sidebar:rgba(241,245,249,.92);--bg2:rgba(0,0,0,.04);--bg3:rgba(0,0,0,.07);--bg4:rgba(0,0,0,.12);
  --c-rojo:#dc2626;--c-morado:#7e22ce;--c-ambar:#b45309;--c-verde:#059669;--c-azul:#1d4ed8;--fg:#0f172a;--fg2:rgba(30,41,59,.82);--fg3:#64748b;
  --line:rgba(0,0,0,.08);--edge:rgba(0,0,0,.14);--toast:rgba(255,255,255,.98);
}
#vgl-root{position:fixed;bottom:22px;right:22px;width:690px;max-width:calc(100vw - 28px);max-height:84vh;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--r-surface);background:var(--bg);backdrop-filter:blur(18px);border:1px solid var(--edge);box-shadow:var(--shadow-panel);color:var(--fg);font-family:var(--font-stack);font-size:14px;line-height:1.45;}
#vgl-root.min{height:48px !important;max-height:48px !important;min-height:48px !important;}
#vgl-root.min #vgl-body{display:none !important;}
#vgl-head{height:48px;display:flex;align-items:center;gap:12px;padding:0 16px;cursor:move;user-select:none;border-bottom:1px solid var(--line);}
#vgl-tls{display:flex;align-items:center;gap:8px;}
.vgl-tl{width:12px;height:12px;border-radius:50%;cursor:pointer;border:none;padding:0;}
.vgl-tl.close{background:#e54d42;}.vgl-tl.min{background:#d97706;}.vgl-tl.zoom{background:#10b981;}
#vgl-title{flex:1;text-align:center;font-weight:700;font-size:16px;}
#vgl-body{display:flex;flex:1 1 auto;overflow:hidden;}
#vgl-sidebar{width:195px;display:flex;flex-direction:column;border-right:1px solid var(--edge);padding:12px 10px;background:var(--bg-sidebar);}
#vgl-find{margin-bottom:10px;}
#vgl-q{width:100%;border:1px solid var(--edge);background:var(--bg3);color:var(--fg);border-radius:10px;padding:8px 12px;font-size:13px;outline:none;}
.vgl-fchip{cursor:pointer;font-size:13px;padding:8px 12px;border-radius:9px;background:transparent;color:var(--fg2);border:0;text-align:left;width:100%;}
.vgl-fchip.sel{background:rgba(37,99,235,.18);color:var(--c-azul);font-weight:700;}
#vgl-actions{margin-top:auto;display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--line);padding-top:12px;}
.vgl-sb-btn{border:0;border-radius:10px;padding:9px 12px;font-size:13px;cursor:pointer;color:var(--fg);background:var(--bg2);text-align:left;}
.vgl-sb-btn.primary{background:var(--c-azul);color:#fff;font-weight:600;}
#vgl-main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
#vgl-sum{font-size:12.5px;color:var(--fg3);padding:9px 14px;border-bottom:1px solid var(--line);}
#vgl-list{overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;flex:1;}
#vgl-empty{color:var(--fg3);text-align:center;padding:32px 16px;font-size:13px;}
.vgl-card{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-card);padding:12px 14px;box-shadow:var(--shadow-card);border-left:4px solid transparent;}
.vgl-card.rojo{border-left-color:var(--c-rojo);background:rgba(229,77,66,.14);}
.vgl-card.morado{border-left-color:var(--c-morado);background:rgba(147,51,234,.12);}
.vgl-card.ambar{border-left-color:var(--c-ambar);background:rgba(217,119,6,.12);}
.vgl-row{display:flex;align-items:center;gap:8px;}
.vgl-cdot{width:10px;height:10px;border-radius:50%;}
.vgl-time{font-weight:700;font-size:14px;}
.vgl-name{font-size:14px;flex:1;font-weight:600;}
.vgl-doc{color:var(--fg3);font-size:12px;}
.vgl-badge{font-size:12px;font-weight:700;padding:4px 10px;border-radius:var(--r-chip);}
.vgl-btn-agendar{border:1px solid var(--edge);background:var(--bg3);border-radius:8px;padding:4px 8px;cursor:pointer;font-size:14px;}
.vgl-pyms{margin-top:8px;display:flex;gap:6px;overflow-x:auto;}
.vgl-chip{font-size:12px;padding:3px 10px;border-radius:var(--r-chip);background:rgba(37,99,235,.16);color:#2563eb;}
#vgl-sheet{display:none;flex:1;overflow-y:auto;padding:16px;}
#vgl-root.sheet #vgl-list,#vgl-root.sheet #vgl-find{display:none;}
#vgl-root.sheet #vgl-sheet{display:block;}
#vgl-dock{position:fixed;bottom:22px;right:22px;z-index:2147483647;display:none;align-items:center;gap:10px;cursor:pointer;padding:10px 16px;border-radius:var(--r-surface);background:var(--bg);border:1px solid var(--edge);box-shadow:0 12px 34px rgba(0,0,0,.5);color:var(--fg);font-size:12.5px;font-weight:600;}
#vgl-toasts{position:fixed;top:16px;right:16px;z-index:2147483646;display:flex;flex-direction:column;gap:10px;max-width:390px;pointer-events:none;}
.vgl-toast{display:flex;gap:11px;padding:13px 14px;border-radius:var(--r-card);pointer-events:auto;color:var(--fg);background:var(--toast);border:1px solid var(--edge);box-shadow:0 16px 44px rgba(0,0,0,.5);cursor:pointer;}
.vgl-toast-ic{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;}
.vgl-toast-main{flex:1;}
.vgl-toast-title{font-weight:600;font-size:13px;}
.vgl-toast-b{font-size:12px;color:var(--fg2);margin-top:3px;}
/* Modales Agendamiento */
#vgl-agendar-modal{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.8);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);}
.vgl-agm-card{background:#1c1c1e;color:#ffffff;border:1px solid rgba(255,255,255,.18);border-radius:18px;width:92%;max-width:650px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.8);}
#vgl-agendar-modal.light .vgl-agm-card{background:#ffffff;color:#1c1c1e;border-color:rgba(0,0,0,.18);}
.vgl-agm-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,.13);padding-bottom:12px;}
.vgl-agm-title{font-size:18px;font-weight:800;color:#ffffff;}
.vgl-agm-close{background:transparent;border:0;color:#ffffff;font-size:22px;cursor:pointer;}
.vgl-agm-lbl{font-size:13px;font-weight:700;display:block;margin-bottom:8px;color:#60a5fa;}
.vgl-agm-presets{display:flex;gap:6px;flex-wrap:wrap;}
.vgl-agm-pbtn{background:rgba(255,255,255,.12);color:#ffffff;border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:7px 15px;font-size:12.5px;font-weight:600;cursor:pointer;}
.vgl-agm-pbtn.active{background:#2563eb;color:#ffffff;border-color:#2563eb;}
.vgl-agm-dinfo{font-size:12.5px;color:#10b981;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);border-radius:8px;padding:8px 12px;}
.vgl-agm-slots{display:flex;gap:8px;flex-wrap:wrap;max-height:140px;overflow-y:auto;background:rgba(0,0,0,.35);padding:10px;border-radius:12px;}
.vgl-agm-sbtn{background:rgba(37,99,235,.25);color:#60a5fa;border:1px solid rgba(96,165,250,.5);border-radius:16px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;}
.vgl-agm-sbtn.active{background:#10b981;color:#ffffff;border-color:#10b981;}
.vgl-agm-input{width:100%;background:#2c2c2e;color:#ffffff;border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:10px 12px;font-size:12.5px;font-family:inherit;}
.vgl-agm-foot{display:flex;justify-content:flex-end;gap:12px;margin-top:20px;border-top:1px solid rgba(255,255,255,.13);padding-top:14px;}
.vgl-agm-btn{border:0;border-radius:12px;padding:10px 20px;font-size:13.5px;font-weight:700;cursor:pointer;}
.vgl-agm-btn.sec{background:rgba(255,255,255,.15);color:#ffffff;}
.vgl-agm-btn.pri{background:linear-gradient(135deg,#10b981,#1b8a36);color:#ffffff;}
`;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "vgl-root";
    root.innerHTML = `
<div id="vgl-head">
  <div id="vgl-tls">
    <button class="vgl-tl close" id="vgl-tl-close" title="Ocultar"></button>
    <button class="vgl-tl min" id="vgl-tl-min" title="Minimizar"></button>
    <button class="vgl-tl zoom" id="vgl-tl-zoom" title="Restaurar"></button>
  </div>
  <div id="vgl-title">Asistente Clínico<small>v${VERSION}</small></div>
  <span id="vgl-dot" title="Origen de datos"></span>
</div>
<div id="vgl-body">
  <div id="vgl-sidebar">
    <div id="vgl-find">
      <input id="vgl-q" type="text" placeholder="🔍 Buscar por paciente...">
    </div>
    <nav id="vgl-filters">
      <button class="vgl-fchip sel" data-f="todas">Todas las citas</button>
      <button class="vgl-fchip" data-f="riesgo">⚠ Atención prioritaria</button>
      <button class="vgl-fchip" data-f="sinpres">Sin presentarse</button>
      <button class="vgl-fchip" data-f="ensala">En sala</button>
      <button class="vgl-fchip" data-f="pym">Con PyM</button>
    </nav>
    <div id="vgl-stats"></div>
    <div id="vgl-actions">
      <button class="vgl-sb-btn primary" id="vgl-load">📂 Cargar prevención</button>
      <button class="vgl-sb-btn" id="vgl-rep">📊 Resumen</button>
      <button class="vgl-sb-btn" id="vgl-cfg">⚙ Ajustes</button>
    </div>
  </div>
  <div id="vgl-main">
    <div id="vgl-sum">Iniciando asistente clínico...</div>
    <div id="vgl-list"></div>
    <div id="vgl-sheet"></div>
  </div>
</div>
<input type="file" id="vgl-file" accept=".xlsx,.xlsm,.csv" style="display:none">
`;
    document.body.appendChild(root);

    el = {
      root,
      sum: root.querySelector("#vgl-sum"),
      stats: root.querySelector("#vgl-stats"),
      list: root.querySelector("#vgl-list"),
      file: root.querySelector("#vgl-file"),
      dot: root.querySelector("#vgl-dot"),
      sheet: root.querySelector("#vgl-sheet"),
      q: root.querySelector("#vgl-q"),
    };

    root.querySelector("#vgl-load").addEventListener("click", () => el.file.click());
    root.querySelector("#vgl-rep").addEventListener("click", () => toggleSheet("resumen"));
    root.querySelector("#vgl-cfg").addEventListener("click", () => toggleSheet("ajustes"));

    el.q.addEventListener("input", () => {
      state.busqueda = el.q.value.trim().toLowerCase();
      repaint();
    });

    root.querySelectorAll(".vgl-fchip").forEach((c) =>
      c.addEventListener("click", () => {
        state.filtro = c.dataset.f;
        root.querySelectorAll(".vgl-fchip").forEach((x) => x.classList.toggle("sel", x === c));
        repaint();
      })
    );

    el.file.addEventListener("change", (e) => {
      if (e.target.files[0]) loadPymFile(e.target.files[0]);
      e.target.value = "";
    });

    root.querySelector("#vgl-tl-close").onclick = () => setWinState("dock");
    root.querySelector("#vgl-tl-min").onclick = () => setWinState(winState === "min" ? "full" : "min");
    root.querySelector("#vgl-tl-zoom").onclick = () => setWinState("full");

    const dock = document.createElement("div");
    dock.id = "vgl-dock";
    dock.innerHTML = `<span>🛡️ Asistente Clínico</span>`;
    dock.addEventListener("click", () => setWinState("full"));
    document.body.appendChild(dock);
    el.dock = dock;

    const toasts = document.createElement("div");
    toasts.id = "vgl-toasts";
    document.body.appendChild(toasts);

    makeDraggable(root, root.querySelector("#vgl-head"));
    restorePos();
    applyTheme();
  }

  function loadPymFile(file) {
    const name = file.name.toLowerCase();
    const reader = new FileReader();
    setSummary("⏳ Leyendo archivo seleccionado (" + file.name + ")…");
    reader.onerror = () => setSummary("No se pudo leer el archivo PyM.", "error");

    if (name.endsWith(".csv")) {
      reader.onload = async (e) => {
        try {
          const all = parseCSV(String(e.target.result));
          const idx = await indexRowsAsync(all[0] || [], all.slice(1), makeYielder(15));
          state.pymFallback = false;
          applyPymIdx(idx, file.name);
          showToast("VERDE", "📂 Archivo PyM Cargado", `Se cargaron ${idx.map.size} paciente(s) desde ${file.name}`, true);
        } catch (err) {
          setSummary("Error CSV: " + err.message, "error");
        }
      };
      reader.readAsText(file, "UTF-8");
    } else {
      reader.onload = async (e) => {
        try {
          const r = await readPymWorkbookStream(e.target.result);
          state.pymFallback = false;
          state.pymHoja = r.sheetName || "";
          applyPymIdx({ map: r.map, todos: r.todos, abandono: r.abandono }, file.name);
          showToast("VERDE", "📂 Archivo Excel Cargado", `Se cargaron ${r.map.size} paciente(s) desde ${file.name}`, true);
        } catch (err) {
          setSummary("Error .xlsx (" + err.message + "). Prueba con formato .csv", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  // =====================================================================
  // BUCLE DE VIGILANCIA (TICK)
  // =====================================================================
  let tickCount = 0;
  function tick() {
    diaNuevo();
    const sec = seccionActiva();

    if (sec === "otra") {
      if (!state.autoDocked && winState !== "dock") {
        state.autoDocked = true;
        setWinState("dock", true);
      }
      return;
    } else if (state.autoDocked) {
      state.autoDocked = false;
      setWinState(state.userWinState || "full", true);
    }

    const now = new Date();
    const snap = extractAgenda(document);

    // Si estamos en modo Base Piloto (state.pymFallback) o sin archivo, verificar SharePoint cada 24 ticks (~2 min).
    // Si ya tenemos el archivo real de hoy, verificar cada 120 ticks (~10 min).
    tickCount++;
    const checkIntervalTicks = (state.pymFallback || !state.pymFile) ? 24 : 120;
    if (tickCount % checkIntervalTicks === 0 && state.leader) {
      loadPymDiario(true).catch(() => {});
    }

    if (snap.visible && snap.citas.length) {
      const processed = snap.citas.map((a) => {
        const enriched = colorAndAlert(a, now);
        maybeNotify(enriched);
        return enriched;
      });

      state.lastSnapshot = { time: now, list: processed };
      if (el.dot) el.dot.className = "page";
      if (!state.pymFile) {
        setSummary(`Monitoreando ${processed.length} cita(s) · ⚠️ Clic en «📂 Cargar prevención» para cargar Excel de PyM.`, "warn");
      } else if (state.pymFallback) {
        setSummary(`Monitoreando ${processed.length} cita(s) · 📋 Usando Base Piloto de Respaldo (${state.pym.size} reg.) · Revisando SharePoint cada 2 min por Agenda_Dia_CMB...`, "warn");
      } else {
        setSummary(`Monitoreando ${processed.length} cita(s) en agenda activa (${state.pym.size} PyM cargados — ${state.pymFile}).`);
      }
      repaint();
    } else if (state.pymFile) {
      if (el.dot) el.dot.className = "bg";
      if (state.pymFallback) {
        setSummary(`Vigilancia lista · 📋 Usando Base Piloto · Revisando SharePoint cada 2 min por el PyM de hoy...`, "warn");
      } else {
        setSummary(`Vigilancia lista. Esperando apertura de agenda (${state.pym.size} PyM cargados).`);
      }
    } else {
      setSummary("Vigilancia lista. Clic en «📂 Cargar prevención» para cargar el Excel de PyM.", "warn");
    }
  }

  // =====================================================================
  // INICIALIZACIÓN
  // =====================================================================
  function init() {
    if (location.host.includes("sharepoint.com")) {
      idleRun(bootSharepointLite, 2000);
      return;
    }

    buildOverlay();

    // Intentar primero cargar desde la caché local del navegador
    loadPymFromCache().then((loaded) => {
      if (!loaded || state.pymFallback) {
        // Si no hay nada en caché o sólo había base piloto, programar la descarga desde SharePoint por el archivo real
        schedulePymBase();
      }
    });

    if (window.PerformanceObserver) {
      try {
        const po = new PerformanceObserver((l) => {
          l.getEntries().forEach((e) => captureDoctorInfo(e.name));
        });
        po.observe({ type: "resource", buffered: true });
      } catch (e) {}
    }

    restartPolling();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
