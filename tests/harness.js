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
    body, head, documentElement: elem("html"),
    createElement: elem,
    createTextNode: (t) => ({ textContent: t }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    _nodos: nodos,
  };
}

function crearEntorno(opciones) {
  const o = opciones || {};
  const almacen = {};
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
    clearTimeout, setInterval: () => 0, clearInterval: () => {},
    requestIdleCallback: () => 0,
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
    console: o.silencioso ? { log() {}, warn() {}, error() {}, info() {} } : console,
    DecompressionStream: undefined,
    Worker: undefined,
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  };
  win.top = win; win.self = win;             // no sale por el guard de frames
  win.unsafeWindow = win;
  win.window = win;
  win.globalThis = win;
  win.GM_getValue = (k, d) => (k in gm ? gm[k] : d);
  win.GM_setValue = (k, v) => { gm[k] = v; };
  win.GM_xmlhttpRequest = o.gmxhr || (() => {});
  return { win, storage, gm, doc, almacen };
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
    "\n;try{ globalThis.__VGL__.__FRIENDLY = FRIENDLY; }catch(e){}\n";

  // se inserta justo antes del cierre del IIFE
  const cierre = src.lastIndexOf("\n})();");
  if (cierre < 0) throw new Error("no se encontró el cierre del IIFE");
  src = src.slice(0, cierre) + exportar + src.slice(cierre);

  const ent = crearEntorno(opciones);
  const ctx = vm.createContext(ent.win);
  vm.runInContext(src, ctx, { filename: "vigilante_agenda.user.js", timeout: 20000 });

  const api = ctx.__VGL__ || {};
  return { api, env: ent, ctx, totalDeclaradas: nombres.length, expuestas: Object.keys(api).filter(k => !k.startsWith("__")).length };
}

module.exports = { cargar, crearEntorno, RUTA };
