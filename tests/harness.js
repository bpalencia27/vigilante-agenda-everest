// =====================================================================
//  BANCO DE PRUEBAS DEL VIGILANTE — cargador
//
//  El userscript es un único IIFE, así que sus funciones son privadas y no
//  se pueden importar. Este cargador NO modifica el archivo de producción:
//  lo lee, simula un navegador completo y le añade al final una línea que
//  publica las funciones para poder probarlas.
//
//  Reglas para que la carga llegue hasta el final sin efectos secundarios:
//   · window.top === window.self          -> no sale por el guard de los frames
//   · hostname = neps.everestintelligent  -> no entra en la rama de Athenea ni
//                                            en la de SharePoint
//   · document.readyState = "loading"     -> boot() queda registrado en
//                                            DOMContentLoaded y NUNCA se ejecuta,
//                                            así no se construye la interfaz
// =====================================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RUTA = path.join(__dirname, "..", "vigilante_agenda.user.js");

// ---------- simulación mínima pero fiel del navegador ----------
function crearDom() {
  const nodos = [];
  function elem(tag) {
    const e = {
      tagName: String(tag || "div").toUpperCase(),
      style: { cssText: "", setProperty() {} },
      dataset: {},
      classList: { _s: new Set(), add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); }, toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      children: [], attributes: {}, _listeners: {},
      innerHTML: "", textContent: "", value: "", id: "", className: "", href: "", download: "", type: "text", name: "", checked: false, disabled: false,
      appendChild(c) { c._parent = this; this.children.push(c); return c; },
      // v17.58.2 — `append(...nodos)` (nativo en navegadores modernos): los renders en
      // lote del modal de agendamiento lo usan para hacer UNA sola actualización de árbol
      // en vez de un appendChild por nodo (rendimiento INP). El DOM falso lo imita.
      append(...ns) { ns.forEach((n) => { n._parent = this; this.children.push(n); }); return undefined; },
      insertBefore(c) { c._parent = this; this.children.unshift(c); return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c._parent = null; return c; },
      remove() { if (this._parent) this._parent.removeChild(this); },
      setAttribute(k, v) { this.attributes[k] = v; if (k === "id") this.id = v; },
      getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
      removeAttribute(k) { delete this.attributes[k]; },
      addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
      removeEventListener() {},
      dispatchEvent() { return true; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return null; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 40 }; },
      focus() {}, click() {}, insertAdjacentHTML() {},
    };
    nodos.push(e);
    return e;
  }
  const body = elem("body");
  const head = elem("head");
  return {
    readyState: "loading",           // clave: impide que boot() se ejecute
    visibilityState: "visible",      // v14.1.5 — el relevo de liderazgo lo consulta
    hasFocus: () => true,            // v17.40.0 — _pestanaSinAtencion() lo consulta; las pruebas lo pisan a () => false para simular ventana visible pero sin foco
    body, head, documentElement: elem("html"),
    createElement: elem,
    createTextNode: (t) => ({ textContent: t }),
    getElementById: (id) => nodos.find(n => n.id === id && n._parent) || null,
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (typeof sel === "string" && sel.startsWith("[id^='vgl-']")) {
        return nodos.filter(n => n.id && n.id.startsWith("vgl-") && n._parent);
      }
      return [];
    },
    addEventListener() {}, removeEventListener() {},
    _nodos: nodos,
  };
}

function crearEntorno(opciones) {
  const o = opciones || {};
  const almacen = o.almacen || {};
  if (!o.defaultOff && !("vgl_cfg" in almacen)) {
    almacen["vgl_cfg"] = JSON.stringify({ reporte: true, uxTelemetria: true });
  }
  // v14.2.0 — La migración de ESTRENO (vgl_v1420_estreno) enciende, una sola vez en el
  // despliegue real, motorPortado/iaRedaccion (y, hasta v17.58.2, uxTelemetria/reporte —
  // desde esa versión la telemetría nace encendida por política del dueño y se fuerza en
  // S, así que la migración ya no la gobierna). El banco verifica los valores de fábrica
  // y el comportamiento con cada bandera controlada a mano, así que aquí se marca como YA
  // aplicada: el arnés no debe re-encender banderas.
  if (!("vgl_v1420_estreno" in almacen)) almacen["vgl_v1420_estreno"] = "1";
  const storage = {
    getItem: (k) => (k in almacen ? almacen[k] : null),
    setItem: (k, v) => { almacen[k] = String(v); },
    removeItem: (k) => { delete almacen[k]; },
    clear: () => { for (const k in almacen) delete almacen[k]; },
    key: (i) => Object.keys(almacen)[i] || null,
    get length() { return Object.keys(almacen).length; },
  };
  const gm = {};
  const doc = crearDom();
  let _intervalSeq = 0;
  const _intervalos = new Map();

  const win = {
    location: { href: "https://neps.everestintelligent.com/viva/HCHealth/", hostname: "neps.everestintelligent.com", origin: "https://neps.everestintelligent.com", pathname: "/viva/HCHealth/", search: "", hash: "" },
    navigator: { userAgent: "node-test", locks: null },
    document: doc,
    localStorage: storage,
    sessionStorage: {
      _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
    setTimeout: (f, ms) => setTimeout(() => { try { f(); } catch (e) {} }, Math.min(ms || 0, 1)),
    clearTimeout,
    // Los intervalos NO disparan (igual que siempre: antes era `setInterval: () => 0`),
    // pero ahora devuelven un identificador REAL y se llevan en un registro. Sin esto no
    // se podia probar nada del reloj de segundo plano ni de state.timers: con un 0 de
    // vuelta, `if (loc.timer)` daba falso siempre y las pruebas no podian distinguir
    // "se creo un temporizador de pagina" de "no se creo ninguno".
    setInterval: (f, ms) => { const id = ++_intervalSeq; _intervalos.set(id, { f, ms, vivo: true }); return id; },
    clearInterval: (id) => { const r = _intervalos.get(id); if (r) r.vivo = false; },
    requestIdleCallback: () => 0,
    // v17.37.0 — sin esto, cualquier código que use requestAnimationFrame (p. ej. el
    // reposicionado de los widgets de Conducta al hacer scroll) revienta con
    // "requestAnimationFrame is not defined" en el arnés — los navegadores reales siempre
    // lo tienen. Mapeado al mismo setTimeout capado de la línea de abajo: un solo
    // "fotograma" por vuelta del bucle de eventos, suficiente para probar coalescencia.
    requestAnimationFrame: (f) => setTimeout(() => { try { f(Date.now()); } catch (e) {} }, Math.min(0, 1)),
    cancelAnimationFrame: clearTimeout,
    fetch: o.fetch || (async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "{}", clone() { return this; } })),
    XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.addEventListener = () => {}; },
    performance: { now: () => Date.now(), getEntriesByType: () => [] },
    PerformanceObserver: undefined,   // typeof null es "object": rompería los guards
    MessageChannel: undefined,       // sin él, yieldNow cae a setTimeout (ruta prevista)
    BroadcastChannel: undefined,
    Notification: undefined,
    AudioContext: undefined,
    alert: () => {}, confirm: () => true, prompt: () => null,
    open: () => null,
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    Blob: function (p) { this.parts = p; },
    btoa: (s) => Buffer.from(String(s), "binary").toString("base64"),
    atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
    TextEncoder: typeof TextEncoder !== "undefined" ? TextEncoder : require("util").TextEncoder,
    // v18.0.144 — el descifrado del caché de carpeta hace `new TextDecoder().decode(…)`. En un
    // contexto vm TextDecoder NO existe como global intrínseco, y el catch de _vglCarpetaDescifrar
    // tragaba el ReferenceError: TODO lo cifrado por el propio userscript se leía como null y las
    // pruebas de relectura/fusión daban "Cannot read properties of null". Un navegador real
    // siempre tiene TextDecoder junto a TextEncoder; el mock ya no será menos navegador que eso.
    TextDecoder: typeof TextDecoder !== "undefined" ? TextDecoder : require("util").TextDecoder,
    // v18.0.144 — la carpeta local ahora usa HMAC-SHA-256 y AES-GCM (crypto.subtle.importKey/
    // deriveKey/encrypt). El api principal del runner se carga con cargar({silencioso:true}) sin
    // inyección, así que el fallback por defecto debe ser el webcrypto REAL de Node (>=15),
    // no un digest suelto: sin esto, mtrNombreArchivoPaciente devuelve null y TODAS las pruebas
    // de carpeta rompen aunque el userscript esté bien.
    crypto: o.crypto || (typeof crypto !== "undefined" && crypto.subtle ? crypto : (() => { try { return require("crypto").webcrypto; } catch (e) { return { subtle: { digest: async (alg, buf) => { const h = require("crypto").createHash("sha256").update(Buffer.from(buf)).digest(); return h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength); } } }; } })()),
    console: o.silencioso ? { log() {}, warn() {}, error() {}, info() {} } : console,
    DecompressionStream: undefined,
    Worker: o.Worker,          // inyectable: sin el, el reloj cae al de la pagina (ruta por defecto)
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    // Un navegador real SIEMPRE tiene Event; el userscript lo usa sin guarda (setNgValue y
    // el autologin de Athenea hacen `new Event('input',…)`). Sin esto, cualquier prueba que
    // ejerza una escritura real por setNgValue caía en el catch y devolvía "no se pudo".
    Event: function (type, opts) { this.type = type; this.bubbles = !!(opts && opts.bubbles); this.cancelable = !!(opts && opts.cancelable); },
    CustomEvent: function (type, opts) { this.type = type; this.detail = opts ? opts.detail : undefined; this.bubbles = !!(opts && opts.bubbles); },
  };
  win.top = win; win.self = win;             // no sale por el guard de frames
  win.unsafeWindow = win;
  win.window = win;
  win.globalThis = win;
  let version = o.version;
  if (!version) {
    try {
      const cabecera = fs.readFileSync(RUTA, "utf8").slice(0, 2000);
      const m = cabecera.match(/\/\/\s*@version\s+(\S+)/);
      if (m) version = m[1];
    } catch (e) {}
  }
  if (!version) version = "14.1.5";

  win.GM_info = {
    script: {
      version: version,
      name: "Vigilante de Agenda — Copiloto Everest PyM",
    },
    scriptHandler: "Tampermonkey",
    version: "5.3.3",
    scriptSource: o.scriptSource || undefined,
  };
  win.GM_getValue = (k, d) => (k in gm ? gm[k] : d);
  win.GM_setValue = (k, v) => { gm[k] = v; };
  win.GM_listValues = () => Object.keys(gm);      // v18.0.108 — poda del espejo
  win.GM_deleteValue = (k) => { delete gm[k]; };
  // v14.1.9 — El stub por defecto NO puede ser un agujero negro.
  //
  // Era `() => {}`. Parece inofensivo, pero `_pageFetchJsonCore` usa GM_xmlhttpRequest como
  // segunda vía cuando `fetch` falla, y lo envuelve en `new Promise((resolve, reject) => …)`
  // que SOLO se cierra desde `onload`, `onerror` u `ontimeout`. Con un stub que no llama a
  // ninguno, esa promesa no se cierra jamás: la prueba se cuelga, `main()` se queda
  // esperando, el bucle de eventos se vacía y Node salía con código 0 — banco en verde sin
  // haber corrido las suites siguientes. Costó encontrarlo justamente porque era silencioso.
  //
  // Ahora el defecto simula lo que hace Tampermonkey de verdad ante un fallo de red: llamar
  // a `onerror`. En el navegador real esa promesa SIEMPRE se cierra (la llamada lleva
  // `timeout: 15000`), así que este defecto se parece más a la realidad que el anterior, no
  // menos. Una prueba que quiera otro comportamiento sigue pasando su propio `gmxhr`.
  win.GM_xmlhttpRequest = o.gmxhr || ((opts) => {
    setTimeout(() => {
      try { if (opts && typeof opts.onerror === "function") opts.onerror(new Error("gmxhr: sin mock en esta prueba")); }
      catch (e) { /* el stub jamás propaga */ }
    }, 0);
  });
  return { win, storage, gm, doc, almacen, intervalos: _intervalos };
}

// ---------- enriquecedor DOM compartido (SF-01, 2026-09-06) ----------
//
// El arnés trae nodos planos sin parser ni selectores, pero los modales de
// producción se construyen con innerHTML y se consultan con querySelector/
// querySelectorAll por todas partes. Este enriquecedor nació dentro de
// suite_73 (recorridos del modal de agendar) y se extrajo TAL CUAL al arnés
// para que sea la única fuente de verdad de todas las suites de simulación
// (encargo SUPERPROMPT_SIMULACION_FLUJOS, regla: nunca un segundo
// enriquecedor paralelo). MUTA los nodos del arnés: nunca toca el archivo
// de producción. Todo lo que añade imita al navegador real.

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodificarEntidades(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (todo, cuerpo) => {
    if (cuerpo[0] === "#") {
      const esHex = cuerpo[1] === "x" || cuerpo[1] === "X";
      const code = parseInt(cuerpo.slice(esHex ? 2 : 1), esHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : todo;
    }
    return Object.prototype.hasOwnProperty.call(ENTIDADES, cuerpo) ? ENTIDADES[cuerpo] : todo;
  });
}

// Nula el _parent de todo un subárbol: el getElementById del arnés
// solo ve nodos con _parent, así que esto es lo que hace que los
// internos de un modal cerrado desaparezcan de verdad.
function desconectar(sub) {
  sub._parent = null;
  for (const h of sub.children || []) desconectar(h);
}

function aplicarCssEnLinea(nodo, css) {
  const st = nodo.style;
  if (!st) return;
  st.cssText = css;
  String(css).split(";").forEach((decl) => {
    const ix = decl.indexOf(":");
    if (ix < 0) return;
    const prop = decl.slice(0, ix).trim();
    const val = decl.slice(ix + 1).trim();
    if (!prop) return;
    st[prop.replace(/-([a-z])/g, (x, c) => c.toUpperCase())] = val;
  });
}

// Parser de HTML: tags de apertura/cierre, autocierre, void elements
// (input es crítico aquí), atributos con comillas dobles, simples o
// sin comillas, comentarios multilínea y entidades básicas.
function parsearHtml(doc, padre, html) {
  const s = String(html);
  const pila = [padre];
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("<!--", i)) {
      const fin = s.indexOf("-->", i + 4);
      i = fin < 0 ? s.length : fin + 3;
      continue;
    }
    if (s[i] === "<" && s[i + 1] === "/") {
      const fin = s.indexOf(">", i);
      const tagCierre = s.slice(i + 2, fin).trim().toLowerCase();
      for (let k = pila.length - 1; k >= 1; k--) {
        if (pila[k].tagName && pila[k].tagName.toLowerCase() === tagCierre) { pila.length = k; break; }
      }
      i = fin < 0 ? s.length : fin + 1;
      continue;
    }
    if (s[i] === "<" && /[a-zA-Z]/.test(s[i + 1] || "")) {
      const finTag = s.indexOf(">", i);
      if (finTag < 0) break;
      let interior = s.slice(i + 1, finTag);
      const autocierre = interior.endsWith("/");
      if (autocierre) interior = interior.slice(0, -1);
      const mTag = interior.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
      const tag = mTag ? mTag[1].toLowerCase() : "div";
      const nodo = doc.createElement(tag);
      const restante = interior.slice(mTag ? mTag[0].length : 0);
      const reAtr = /([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let mA;
      while ((mA = reAtr.exec(restante))) {
        const nombre = mA[1];
        const crudo = mA[2] !== undefined ? mA[2] : (mA[3] !== undefined ? mA[3] : (mA[4] !== undefined ? mA[4] : ""));
        const valor = decodificarEntidades(crudo);
        nodo.setAttribute(nombre, valor);
        if (nombre === "class") nodo.className = valor;
        else if (nombre === "style") aplicarCssEnLinea(nodo, valor);
        else if (nombre === "value" && "value" in nodo) nodo.value = valor;
        else if (nombre === "checked") nodo.checked = true;
        else if (nombre === "disabled") nodo.disabled = true;
        else if (nombre === "type" && "type" in nodo) nodo.type = valor;
      }
      pila[pila.length - 1].appendChild(nodo);
      if (!autocierre && !VOID_TAGS.has(tag)) pila.push(nodo);
      i = finTag + 1;
      continue;
    }
    let finTexto = s.indexOf("<", i);
    if (finTexto < 0) finTexto = s.length;
    if (finTexto > i) {
      const tn = doc.createTextNode(decodificarEntidades(s.slice(i, finTexto)));
      pila[pila.length - 1].appendChild(tn);
    }
    i = finTexto === i ? i + 1 : finTexto;
  }
}

function serializar(nodo) {
  const partes = [];
  for (const h of nodo.children || []) {
    if (h.tagName) {
      const attrs = Object.keys(h.attributes || {}).map((k) => {
        const esc = String(h.attributes[k]).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return " " + k + '="' + esc + '"';
      }).join("");
      const tag = String(h.tagName).toLowerCase();
      if (VOID_TAGS.has(tag)) partes.push("<" + tag + attrs + ">");
      else partes.push("<" + tag + attrs + ">" + serializar(h) + "</" + tag + ">");
    } else {
      partes.push(String(h.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    }
  }
  return partes.join("");
}

function soloTexto(nodo) {
  let out = "";
  for (const h of nodo.children || []) out += h.tagName ? soloTexto(h) : String(h.textContent || "");
  return out;
}

// ----- motor de selectores: compuestos, :not(), [attr op valor],
// descendiente e hijo, listas con coma -----
function partirPorComas(sel) {
  const out = [];
  let actual = "", prof = 0, comilla = null;
  for (const c of String(sel)) {
    if (comilla) { actual += c; if (c === comilla) comilla = null; continue; }
    if (c === '"' || c === "'") { comilla = c; actual += c; continue; }
    if (c === "(" || c === "[") prof++;
    if (c === ")" || c === "]") prof--;
    if (c === "," && prof === 0) { out.push(actual); actual = ""; continue; }
    actual += c;
  }
  if (actual.trim()) out.push(actual);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseCompuesto(comp) {
  const partes = [];
  const s = comp.trim();
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (c === "*") { partes.push({ t: "tag", v: "*" }); i++; continue; }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9-]/.test(s[j])) j++;
      partes.push({ t: "tag", v: s.slice(i, j).toUpperCase() });
      i = j; continue;
    }
    if (c === "#") {
      let j = i + 1;
      while (j < s.length && /[\w-]/.test(s[j])) j++;
      partes.push({ t: "id", v: s.slice(i + 1, j) });
      i = j; continue;
    }
    if (c === ".") {
      let j = i + 1;
      while (j < s.length && /[\w-]/.test(s[j])) j++;
      partes.push({ t: "cls", v: s.slice(i + 1, j) });
      i = j; continue;
    }
    if (c === "[") {
      const fin = s.indexOf("]", i);
      if (fin < 0) break;
      const mA = s.slice(i + 1, fin).match(/^([^\s~^$*|=]+)(?:\s*([~^$*|]?=)\s*(.*))?$/);
      if (mA) {
        const valor = mA[3] !== undefined ? mA[3].replace(/^['"]|['"]$/g, "") : undefined;
        partes.push({ t: "attr", attr: mA[1].toLowerCase(), op: mA[2], v: valor });
      }
      i = fin + 1; continue;
    }
    if (s.startsWith(":not(", i)) {
      let prof = 1, j = i + 5;
      while (j < s.length && prof > 0) {
        if (s[j] === "(") prof++;
        else if (s[j] === ")") prof--;
        j++;
      }
      partes.push({ t: "not", sub: parseCompuesto(s.slice(i + 5, j - 1)) });
      i = j; continue;
    }
    i++;
  }
  return partes;
}

// La presencia de un atributo consulta también las propiedades que el
// navegador refleja: producción escribe btn.disabled como propiedad y
// luego pregunta por button:not([disabled]).
function atributoReflejado(n, attr) {
  if (Object.prototype.hasOwnProperty.call(n.attributes, attr)) return { tiene: true, valor: String(n.attributes[attr]) };
  if (attr === "disabled") return n.disabled === true ? { tiene: true, valor: "disabled" } : { tiene: false };
  if (attr === "checked") return n.checked === true ? { tiene: true, valor: "checked" } : { tiene: false };
  if (attr === "value") return (typeof n.value === "string" && n.value !== "") ? { tiene: true, valor: n.value } : { tiene: false };
  if (attr === "id") return n.id ? { tiene: true, valor: n.id } : { tiene: false };
  return { tiene: false };
}

function matchParte(n, p) {
  switch (p.t) {
    case "tag": return p.v === "*" || n.tagName === p.v;
    case "id": return n.id === p.v;
    case "cls": return !!(n.classList && n.classList._s.has(p.v));
    case "attr": {
      const r = atributoReflejado(n, p.attr);
      if (!r.tiene) return false;
      if (!p.op) return true;
      const val = r.valor;
      switch (p.op) {
        case "=": return val === p.v;
        case "^=": return p.v !== "" && val.startsWith(p.v);
        case "$=": return p.v !== "" && val.endsWith(p.v);
        case "*=": return p.v !== "" && val.includes(p.v);
        case "~=": return val.split(/\s+/).includes(p.v);
        case "|=": return val === p.v || val.startsWith(p.v + "-");
        default: return false;
      }
    }
    case "not": return !matchCompuesto(n, p.sub);
    default: return false;
  }
}
function matchCompuesto(n, partes) { return partes.every((p) => matchParte(n, p)); }

function partirCadena(sel) {
  const tokens = [];
  let actual = "", prof = 0, pendienteHijo = false;
  const empujar = () => {
    if (actual.trim()) {
      tokens.push({ rel: pendienteHijo ? ">" : " ", comp: parseCompuesto(actual.trim()) });
      pendienteHijo = false;
    }
    actual = "";
  };
  for (const c of sel) {
    if (c === "(" || c === "[") prof++;
    if (c === ")" || c === "]") prof--;
    if (prof === 0 && c === ">") { empujar(); pendienteHijo = true; continue; }
    if (prof === 0 && c === " ") { empujar(); continue; }
    actual += c;
  }
  empujar();
  return tokens;
}

function cumpleCadena(n, tokens) {
  if (!tokens.length) return false;
  if (!matchCompuesto(n, tokens[tokens.length - 1].comp)) return false;
  let idx = tokens.length - 2;
  let actual = n;
  while (idx >= 0) {
    const tk = tokens[idx];
    let padre = actual._parent;
    let hallado = false;
    while (padre && padre.tagName) {
      if (matchCompuesto(padre, tk.comp)) { hallado = true; break; }
      if (tk.rel === ">") break;
      padre = padre._parent;
    }
    if (!hallado) return false;
    actual = padre;
    idx--;
  }
  return true;
}

function matcheaSelector(n, sel) {
  return partirPorComas(sel).some((alt) => cumpleCadena(n, partirCadena(alt)));
}

function dfsNodos(raiz) {
  const out = [];
  (function rec(nodo) {
    for (const h of nodo.children || []) {
      if (h.tagName) out.push(h);
      if (h.children && h.children.length) rec(h);
    }
  })(raiz);
  return out;
}

function enriquecerDom(doc, n) {
  // toggle con semántica DOM: sin force explícito alterna (el del
  // arnés base borra la clase, lo que rompería irAPaso).
  n.classList.toggle = function (c, f) {
    const tiene = this._s.has(c);
    const nuevo = f === undefined ? !tiene : !!f;
    if (nuevo) this._s.add(c); else this._s.delete(c);
    return nuevo;
  };
  Object.defineProperty(n, "className", {
    configurable: true, enumerable: true,
    get() { return [...n.classList._s].join(" "); },
    set(v) {
      n.classList._s.clear();
      String(v == null ? "" : v).split(/\s+/).filter(Boolean).forEach((c) => n.classList._s.add(c));
    },
  });
  const attrDe = (k) => "data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  n.dataset = new Proxy({}, {
    get(_, k) {
      if (typeof k !== "string") return undefined;
      const v = n.getAttribute(attrDe(k));
      return v === null ? undefined : v;
    },
    set(_, k, v) {
      if (typeof k !== "string") return false;
      if (v === undefined || v === null) n.removeAttribute(attrDe(k));
      else n.setAttribute(attrDe(k), String(v));
      return true;
    },
    deleteProperty(_, k) { if (typeof k === "string") n.removeAttribute(attrDe(k)); return true; },
    has(_, k) { return typeof k === "string" && n.getAttribute(attrDe(k)) !== null; },
  });
  Object.defineProperty(n, "innerHTML", {
    configurable: true, enumerable: true,
    get() { return serializar(n); },
    set(v) {
      for (const h of n.children || []) desconectar(h);
      n.children.length = 0;
      parsearHtml(doc, n, String(v));
    },
  });
  Object.defineProperty(n, "textContent", {
    configurable: true, enumerable: true,
    get() { return soloTexto(n); },
    set(v) {
      for (const h of n.children || []) desconectar(h);
      n.children.length = 0;
      const tn = doc.createTextNode(String(v));
      tn._parent = n;
      n.children.push(tn);
    },
  });
  n.removeChild = function (c) {
    const ix = this.children.indexOf(c);
    if (ix >= 0) this.children.splice(ix, 1);
    desconectar(c);
    return c;
  };
  n.removeEventListener = function (ev, f) {
    const arr = this._listeners[ev];
    if (!arr) return;
    const ix = arr.indexOf(f);
    if (ix >= 0) arr.splice(ix, 1);
  };
  Object.defineProperty(n, "parentElement", { configurable: true, get() { return n._parent || null; } });
  n.contains = function (otro) {
    if (otro === this) return true;
    for (const h of this.children || []) if (h.contains && h.contains(otro)) return true;
    return false;
  };
  n.matches = (sel) => matcheaSelector(n, sel);
  n.closest = (sel) => {
    let cur = n;
    while (cur) {
      if (cur.tagName && matcheaSelector(cur, sel)) return cur;
      cur = cur._parent;
    }
    return null;
  };
  n.querySelectorAll = (sel) => dfsNodos(n).filter((x) => matcheaSelector(x, sel));
  n.querySelector = (sel) => dfsNodos(n).find((x) => matcheaSelector(x, sel)) || null;
  return n;
}

// Parchea el document del arnés para que TODOS los nodos que cree a
// partir de ahora vengan enriquecidos (parser, selectores, dataset,
// classList). Se llama UNA vez por contexto, justo después de cargar().
function instalarDomEnriquecido(doc) {
  const crearOriginal = doc.createElement;
  const textoOriginal = doc.createTextNode;
  doc.createElement = (tag) => enriquecerDom(doc, crearOriginal(tag));
  doc.createTextNode = (tx) => {
    const tn = textoOriginal(tx);
    tn.nodeType = 3;
    tn._parent = null;
    return tn;
  };
}

// Dispara TODOS los listeners del tipo en COPIA de la lista (un
// handler puede deregistrar a otro) y NO re-lanza sus errores: un
// listener roto no debe enmascarar lo que la prueba está midiendo.
// Los errores se guardan en el nodo y se loguean con el prefijo que
// cada suite pasa (así la salida del banco sigue diciendo quién fue).
function disparar(nodo, tipo, prefijo) {
  const arr = (nodo && nodo._listeners && nodo._listeners[tipo] ? nodo._listeners[tipo] : []).slice();
  for (const f of arr) {
    try { f({ type: tipo, target: nodo, currentTarget: nodo, preventDefault() {}, stopPropagation() {} }); }
    catch (e) {
      nodo._ultimoError = e;
      console.error((prefijo || "[simulacion]") + " listener de '" + tipo + "' lanzó:", e && e.message ? e.message : e);
    }
  }
}

// Detecta `const/let NOMBRE = ... =>` contando paréntesis en vez de con una sola
// regex de ancho fijo: la regex anterior (`[^;=\n]{0,90}?=>`) no podía cruzar el
// '=' de un parámetro por defecto (`(url, data = {}) =>`), así que gmPostJson y
// gmPostJsonEx nunca se detectaban ni se publicaban para las pruebas.
function encontrarNombresFlecha(src) {
  const nombres = [];
  const cabecera = /\n\s{0,4}(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?/g;
  let m;
  while ((m = cabecera.exec(src))) {
    let i = cabecera.lastIndex;
    let profundidad = src[i - 1] === "(" ? 1 : 0;   // ya se consumió el '(' de apertura, si lo había
    let hallado = false;
    const limite = Math.min(src.length, i + 500);   // cota de seguridad, no un parser real
    for (; i < limite; i++) {
      const c = src[i];
      if (c === "(") profundidad++;
      else if (c === ")") { profundidad--; if (profundidad < 0) break; }
      else if (profundidad <= 0 && (c === ";" || c === "\n")) break;   // fin de sentencia sin flecha
      else if (profundidad <= 0 && c === "=" && src[i + 1] === ">") { hallado = true; break; }
    }
    if (hallado) nombres.push(m[1]);
  }
  return nombres;
}

// ---------- carga: publica las funciones sin tocar el archivo ----------
function cargar(opciones) {
  let src = fs.readFileSync(RUTA, "utf8").replace(/\r\n/g, "\n");

  // Nombres a publicar: las declaraciones `function NOMBRE` y también las funciones
  // guardadas en const/let (limpio, gmPostJson, repUrl…), que son igual de importantes.
  const decl = [...src.matchAll(/\n\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  const flecha = encontrarNombresFlecha(src);
  const nombres = [...new Set(decl.concat(flecha))];

  // línea que publica lo alcanzable; las funciones anidadas lanzan y se omiten
  const exportar = "\n;globalThis.__VGL__ = {};\n" +
    nombres.map(n => `try{ if(typeof ${n}==="function") globalThis.__VGL__[${JSON.stringify(n)}] = ${n}; }catch(e){}`).join("\n") +
    "\n;try{ globalThis.__VGL__.__S = S; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__CONFIG = CONFIG; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__state = state; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__WHITELIST = WHITELIST_13_LABS; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__PYM_CATALOG = PYM_CATALOG; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO = CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__CONDUCTA_LI_TEXTO_POR_ANALITO = CONDUCTA_LI_TEXTO_POR_ANALITO; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__COLORS = COLORS; }catch(e){}" +
    // v18.0.8 — `_reloj` se publica para las pruebas del liderazgo. Desde v18.0.8 una
    // pestaña sin canal "tick" NO puede ser líder (quien no evalúa no manda): sin acceso a
    // esta estructura no habría forma de simular las dos caras —pestaña arrancada y
    // pestaña ciega— y el banco no podría fijar la regla.
    "\n;try{ globalThis.__VGL__.__reloj = _reloj; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__FRIENDLY = FRIENDLY; }catch(e){}" +
    // v18.0.98 — el alias nombre@hora → cédula@hora de `apptKey` mantiene la identidad de
    // la cita mientras la pestaña vive. Se publica para que las pruebas de v18.0.62 puedan
    // OLVIDARLO a propósito (como tras un reinicio del script o un día nuevo) y sigan
    // ejercitando la capa de lectura tolerante, que es el respaldo cuando el alias no existe.
    "\n;try{ globalThis.__VGL__.__apptAliasDoc = _apptAliasDoc; }catch(e){}" +
    // v18.0.104 — la implementación REAL de la carpeta (File System Access) solo se activa con
    // un handle; se publica un setter para probar `listar()` con un handle simulado.
    "\n;try{ globalThis.__VGL__.__setCarpetaHandleParaTest = function(h){ _vglCarpetaHandle = h; }; }catch(e){}" +
    // v18.0.144 — la clave de equipo (HMAC/AES) vive en GM_setValue y en dos cachés de módulo.
    // Sin este accessor no hay forma de probar "otro equipo" (dos claves → nombres distintos)
    // ni "almacenamiento limpiado" (clave perdida → caché ilegible): cada carga del userscript
    // fabricaría UNA clave y la retendría hasta el final de la prueba.
    "\n;try{ globalThis.__VGL__.__vglCarpetaResetClaveParaTest = function(nuevaHex){ _vglCarpetaClaveCache = nuevaHex ? String(nuevaHex).toLowerCase() : null; _vglCarpetaClaveAesCache = null; try{ if(nuevaHex){ GM_setValue(VGL_CARPETA_CLAVE_GM, _vglCarpetaClaveCache); } else { GM_deleteValue(VGL_CARPETA_CLAVE_GM); } }catch(e){} try{ GM_deleteValue(VGL_CARPETA_PURGA_GM); }catch(e){} }; }catch(e){}" +
    // Helpers de reloj SOLO para pruebas: las cachés (resumen, meds, tabla oficial)
    // caducan comparando Date.now() contra un `ts` guardado; sin esto, una prueba de
    // TTL tendría que esperar minutos reales. Se insertan dentro del IIFE, donde la
    // variable `_mtrCacheResumen` es alcanzable. (Mismo patrón que __uxVolcarBuffer.)
    "\n;try{ globalThis.__VGL__.__envejecerCacheResumen = function(msAtras){ _mtrCacheResumen.ts = Date.now() - msAtras; }; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__envejecerCacheMeds = function(msAtras){ _mtrMedsCache.ts = Date.now() - msAtras; }; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__envejecerTablaOficial = function(msAtras){ _tablaOficialVista.ts = Date.now() - msAtras; }; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.VGL_MODALES_CONSULTA = VGL_MODALES_CONSULTA; globalThis.__VGL__.VGL_MODALES_ESCRITURA = VGL_MODALES_ESCRITURA; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.VGL_ROTULOS = VGL_ROTULOS; }catch(e){}" +
    "\n;try{ globalThis.__VGL__.__setLabsPrefetchParaTest = function(docId, labs, ts){ _labsPrefetch = { docId: String(docId), labs: labs, ts: ts }; }; }catch(e){}" +
    // v18.14.9 — `API` es un objeto `const` de módulo (latencia de la última lectura de
    // agenda) y el autodescubrimiento no lo publica. Sin este accessor no se puede probar
    // la señal «agenda lenta» del aviso «Everest no responde» sin simular una lectura real
    // de 6 s contra un fetch falso.
    "\n;try{ globalThis.__VGL__.__rageApiMsParaTest = function(ms){ API.ms = Number(ms) || 0; }; }catch(e){}" +
    // v18.0.134 (M8) — `_vglLimpiarSesionDia` vacía tres estructuras de sesión que solo
    // son alcanzables dentro del IIFE (dos Set y un Map declarados con let). Sin este
    // accessor el banco no puede llenarlas para demostrar que la limpieza funciona.
    "\n;try{ globalThis.__VGL__.__sesionDiaParaTest = function(){ return { fechasLab: _diagLabFechaPorCasilla, contextoAvisado: _vglContextoAvisado, acompEntendido: _acompEntendidoEnMs }; }; }catch(e){}\n" +
    // v18.2 (P11) — las constantes de la compuerta de consentimiento se declaran como
    // `const` al nivel del IIFE, de modo que el autodescubrimiento de funciones no las
    // ve. Se publican a mano para que suite_82 pueda comparar el texto contra el repo.
    "\n;try{ globalThis.__VGL__.__TERMINOS_VERSION = TERMINOS_VERSION; globalThis.__VGL__.__TERMINOS_TEXTO = TERMINOS_TEXTO; globalThis.__VGL__.__TERMINOS_RESUMEN = TERMINOS_RESUMEN; }catch(e){}\n" +
    // v18.3.4 (T4) — las referencias de la vigilancia de DOM (_vglDomObs/_vglDomAlTocar) son
    // `let` de módulo, invisibles para el autodescubrimiento. Sin este accessor, suite_30 no
    // podría comprobar que emergencyTeardown las suelta: en el arnés MutationObserver.disconnect
    // y document.removeEventListener son no-ops, así que lo único observable es el ciclo de vida
    // de la referencia misma.
    "\n;try{ globalThis.__VGL__.__vglDomVigilanciaParaTest = function(){ return { obs: _vglDomObs, alTocar: _vglDomAlTocar, instalado: _vglDomObsInstalado }; }; }catch(e){}\n" +   // v18.0.110 (C21) + v18.0.134 (M8) + v18.2 (P11) + v18.3.4 (T4)
    // v18.14.1 (frente 4) — la BÓVEDA DE CREDENCIALES guarda el claro de las claves de IA en
    // un memo de módulo (`_vglSecretosMem`) y marca la hidratación con dos banderas. Sin este
    // accessor no se puede probar ni la MIGRACIÓN (legado ofuscado → sobre AES-GCM) ni el
    // arranque en frío (memo vacío + disco cifrado): cada carga del userscript hidrata una
    // sola vez y el memo quedaría servido para siempre. Mismo patrón que
    // __vglCarpetaResetClaveParaTest, que ya resuelve el mismo problema para la carpeta.
    "\n;try{ globalThis.__VGL__.__vglSecretosResetParaTest = function(){ try{ for (const k in _vglSecretosMem) delete _vglSecretosMem[k]; }catch(e){} _vglSecretosHidratado = false; _vglSecretosHidratando = false; _vglSecretosCola = Promise.resolve(); }; }catch(e){}\n";

  // se inserta justo antes del cierre del IIFE
  const cierre = src.lastIndexOf("\n})();");
  if (cierre < 0) throw new Error("no se encontró el cierre del IIFE");
  src = src.slice(0, cierre) + exportar + src.slice(cierre);

  const ent = crearEntorno(opciones);
  const ctx = vm.createContext(ent.win);
  vm.runInContext(src, ctx, { filename: "vigilante_agenda.user.js", timeout: 20000 });

  const api = ctx.__VGL__ || {};
  // v18.0.8 — POR DEFECTO, UNA PESTAÑA ARRANCADA. En el navegador, boot() construye el
  // panel y applySettings() -> restartPolling() registra el canal "tick", que es el reloj
  // que de verdad evalúa la agenda. El arnés impide a propósito que boot() corra (ver la
  // cabecera de este fichero), así que sin esto TODA pestaña de prueba parecería una
  // pestaña ciega y, desde v18.0.8, no podría liderar — rompiendo decenas de pruebas de
  // liderazgo que nada tienen que ver con eso. Se registra el canal SIN temporizador (se
  // escribe el mapa directamente, no se llama a _relojCada) para no dejar intervalos vivos
  // que mantengan node despierto. Las pruebas de la guarda lo BORRAN a propósito.
  try { if (api.__reloj && api.__reloj.canales && !api.__reloj.canales.has("tick")) api.__reloj.canales.set("tick", function () {}); } catch (e) {}
  return { api, env: ent, ctx, totalDeclaradas: nombres.length, expuestas: Object.keys(api).filter(k => !k.startsWith("__")).length };
}

module.exports = { cargar, crearEntorno, RUTA, enriquecerDom, instalarDomEnriquecido, disparar };
