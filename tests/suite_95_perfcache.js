// =====================================================================
//  SUITE 95 — CACHÉ DE CATÁLOGOS GLOBALES DE EVEREST (F-P3 de la delegación)
//
//  El HAR de producción (§9.4.4) confirma que ParDiagnosticos (2,6 MB) y
//  ParCiudades (303 KB) se bajan EN CADA apertura de historia clínica.
//  Este módulo los sirve desde caché local SOLO con el toggle encendido
//  (nace APAGADO: con el defecto OFF la red de Everest no se toca NADA),
//  y SOLO tras el protocolo de doble lectura: la 1.ª respuesta se observa
//  (huella FNV-1a), la 2.ª idéntica CONFIRMA y se guarda en IndexedDB;
//  desde ahí se sirve de caché. Si las lecturas difieren, jamás se cachea
//  mientras cambie — la inmutabilidad no se supone, se demuestra en vivo
//  (el HAR no trae cuerpos de respuesta con qué comparar: §2 del informe).
//
//  Partes:
//  A) CONTRATO: clasificación de URL (solo GET a los 2 catálogos globales;
//     lo por-cita/por-paciente jamás entra) y toggles por defecto.
//  B) FETCH: doble lectura → confirmación → servido sin red, bytes y
//     persistencia en IndexedDB. Restaurar al apagar.
//  C) XHR: mismo protocolo vía XMLHttpRequest (la vía real de Angular);
//     responseType "json" jamás se sirve de caché (fail-open a red).
//  D) CAMBIO: cuerpos que cambian entre lecturas jamás se cachean.
//  E) PERSISTENCIA: otra "sesión" del mismo día sirve desde la DB sin red.
//  F) BINARIO: content-type no textual pasa intacto, jamás se observa.
// =====================================================================
const { instalarDomEnriquecido } = require("./harness");

// URL con la forma real de los servicios del HAR (catálogos paramétricos
// de la IPS, jamás datos de paciente): APIParametrizacionGeneralHealth.
const URL_PD = "https://medicosviva1a.apiviva.com/apiviva/APIParametrizacionGeneralHealth/api/ParDiagnosticos?epsId=2";
const URL_PC = "https://medicosviva1a.apiviva.com/apiviva/APIParametrizacionGeneralHealth/api/ParCiudades";
// Cuerpos de prueba: catálogos FICTICIOS (jamás PHI: son listados de
// parámetros, no datos de ningún paciente real).
const CAT_PD = JSON.stringify([{ id: 1, nombre: "CATALOGO FICTICIO DE DIAGNOSTICOS" }]);
const CAT_PC = JSON.stringify([{ id: 2, nombre: "CATALOGO FICTICIO DE CIUDADES" }]);

// fetch simulado con la forma real de _pageFetchJsonCore, contando red.
function mockFetch(cuerpos, ctPorUrl) {
  const contador = { n: 0 };
  const f = async (input, init) => {
    const url = (typeof input === "string") ? input : (input && input.url) || "";
    contador.n++;
    const v = cuerpos[url];
    const cuerpo = (typeof v === "function") ? v() : v;
    if (cuerpo === undefined) {
      return { ok: false, status: 404, headers: { get: () => null }, text: async () => "", json: async () => null, clone() { return this; } };
    }
    const ct = (ctPorUrl && ctPorUrl[url]) || "application/json";
    return {
      ok: true, status: 200,
      headers: { get: (k) => (String(k || "").toLowerCase() === "content-type" ? ct : null) },
      text: async () => cuerpo, json: async () => JSON.parse(cuerpo), clone() { return this; },
    };
  };
  f.contador = contador;
  return f;
}

// XMLHttpRequest simulado (la vía real del HttpClient de Angular), con
// prototype compartido para que el interceptor pueda envolver open/send.
function FakeXHR(cuerpos, contador) {
  this.readyState = 0; this.status = 0; this.responseType = "";
  this.responseText = ""; this.response = null;
  this.onload = null; this.onreadystatechange = null;
  this._listeners = {}; this._url = "";
  // los parámetros no crean closure para los métodos del prototype: se guardan aquí
  this._cuerpos = cuerpos; this._contador = contador;
}
FakeXHR.prototype.open = function (metodo, url) { this._url = String(url == null ? "" : url); this.readyState = 1; };
FakeXHR.prototype.send = function (body) {
  const self = this;
  self._contador.n++;
  const v = self._cuerpos[self._url];
  const cuerpo = (typeof v === "function") ? v() : v;
  setTimeout(() => {
    self.status = (cuerpo === undefined) ? 404 : 200;
    self.responseText = (cuerpo === undefined) ? "" : cuerpo;
    self.response = self.responseText;
    self.readyState = 4;
    (self._listeners.readystatechange || []).forEach((fn) => fn({ type: "readystatechange", target: self, currentTarget: self }));
    if (self.onreadystatechange) self.onreadystatechange({ type: "readystatechange", target: self, currentTarget: self });
    (self._listeners.load || []).forEach((fn) => fn({ type: "load", target: self, currentTarget: self }));
    if (self.onload) self.onload({ type: "load", target: self, currentTarget: self });
  }, 0);
};
FakeXHR.prototype.addEventListener = function (tipo, fn) { (this._listeners[tipo] = this._listeners[tipo] || []).push(fn); };

// Constructor con PROTOTYPE PROPIO (Object.create) para que el interceptor del
// script tenga un `w.XMLHttpRequest.prototype` real que envolver: un
// Function#bind no tiene .prototype y el módulo (correctamente, fail-open)
// no instalaría nada — la red correría sin interceptar.
function fabricarCtorXHR(cuerpos, contador) {
  function Ctor() { FakeXHR.call(this, cuerpos, contador); }
  Ctor.prototype = Object.create(FakeXHR.prototype);
  return Ctor;
}

// IndexedDB simulado sobre un Map compartible entre "sesiones" de prueba.
function mockIDB(tienda) {
  return {
    open(nombre, ver) {
      const req = {};
      setTimeout(() => {
        try {
          req.result = {
            transaction(store, modo) {
              const pend = [];
              const tx = {};
              let oc = null, oe = null;
              Object.defineProperty(tx, "oncomplete", { set: (f) => { oc = f; }, get: () => oc });
              Object.defineProperty(tx, "onerror", { set: (f) => { oe = f; }, get: () => oe });
              tx.objectStore = (s) => ({
                put(v, k) { pend.push(() => { tienda.set(k, v); }); },
                get(k) { const rq = {}; pend.push(() => { rq.result = tienda.get(k); if (rq.onsuccess) rq.onsuccess(); }); return rq; },
                delete(k) { pend.push(() => { tienda.delete(k); }); },
              });
              setTimeout(() => { try { pend.forEach((f) => f()); if (oc) oc(); } catch (e) { if (oe) oe(); } }, 0);
              return tx;
            },
          };
          if (req.onsuccess) req.onsuccess();
        } catch (e) { if (req.onerror) req.onerror(); }
      }, 0);
      return req;
    },
  };
}

module.exports = {
  nombre: "Rendimiento: caché de catálogos globales bajo toggle (F-P3, doble lectura)",
  cubre: [
    "mtrPerfCacheClasificar", "mtrPerfCacheActivar", "mtrPerfCacheDesactivar",
    "mtrPerfCacheEstadisticas", "mtrPerfCacheActivo", "togActiva", "togSet",
  ],

  async pruebas(t, api, env, cargar) {
    // Identidad de médico real registrado (COMPLETO), como en producción.
    function sembrar707(c) {
      if (!("vgl_acceso_lista" in c.env.almacen)) {
        c.env.almacen.vgl_acceso_lista = JSON.stringify({
          version: "test-perfcache", perfiles: { COMPLETO: [{ uid: 707, nombre: "MEDICO PERF" }], LABORATORIOS: [] }, blocklist: [],
        });
      }
      c.api.__state.activeDoctor = { id: 707, name: "MEDICO PERF" };
    }
    async function esperar(cond, intentos) {
      intentos = intentos || 100;
      for (let i = 0; i < intentos; i++) {
        if (cond()) return true;
        await new Promise((r) => setTimeout(r, 5));
      }
      return !!cond();
    }

    // =====================================================================
    //  A — CONTRATO: clasificación de URL y toggles por defecto
    // =====================================================================
    t.caso("A/clasificacion: solo GET a los 2 catálogos globales; por-cita/por-paciente jamás", () => {
      const c = cargar({ silencioso: true });
      sembrar707(c);
      const K = c.api.mtrPerfCacheClasificar;
      t.igual(K("GET", URL_PD), "ParDiagnosticos", "ParDiagnosticos elegible con query");
      t.igual(K("GET", URL_PC), "ParCiudades", "ParCiudades elegible");
      t.igual(K("POST", URL_PD), null, "POST jamás");
      t.igual(K("GET", URL_PD + "&x=1"), "ParDiagnosticos", "parámetros extra no la sacan");
      t.igual(K("GET", "https://x/api/GetParDiagnosticoByCitaId/MTIy"), null, "por-cita jamás (nombre parecido)");
      t.igual(K("GET", URL_PC + "?citaId=123"), null, "defensa: query por-cita la excluye");
      t.igual(K("GET", "https://x/api/ParMedicamentos/MedicamentoPorPaciente?pacienteId=1"), null, "por-paciente jamás");
      t.igual(K("GET", ""), null, "URL vacía jamás");
      t.igual(K("", URL_PD), null, "método vacío jamás");
      t.falso(c.api.togActiva("tog_perf_cache"), "tog_perf_cache nace APAGADO (defecto:false)");
      t.falso(c.api.togActiva("tog_perf_informe"), "el sub-toggle no revive con su padre apagado (jerarquía F3)");
      const st = c.api.mtrPerfCacheEstadisticas();
      t.falso(st.activo, "sin toggle no hay interceptores (activo=false)");
      t.igual(st.servidas + st.observadas, 0, "cero actividad antes de activar");
    });

    // =====================================================================
    //  B — FETCH: doble lectura → confirmación → servido sin red
    // =====================================================================
    await t.casoAsync("B/fetch: 1.ª observa, 2.ª confirma, 3.ª sirve de caché sin red; apagar restaura", async () => {
      const c = cargar({ silencioso: true });
      sembrar707(c);
      const tienda = new Map();
      c.env.win.indexedDB = mockIDB(tienda);
      const f = mockFetch({ [URL_PD]: CAT_PD });
      c.env.win.fetch = f;
      t.cierto(c.api.togSet("tog_perf_cache", true), "togSet persiste y activa");
      t.cierto(c.api.mtrPerfCacheActivo(), "interceptores instalados en caliente");
      t.cierto(c.api.togActiva("tog_perf_informe"), "con el padre encendido, el sub-toggle revive");

      const r1 = await c.env.win.fetch(URL_PD);
      t.igual(await r1.text(), CAT_PD, "1.ª lectura: cuerpo intacto");
      t.igual(f.contador.n, 1, "1.ª lectura pasó por la red");
      let st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.observadas, 1, "1.ª solo se observó (huella pendiente)");
      t.igual(st.confirmaciones, 0, "sin confirmación todavía");
      t.igual(st.servidas, 0, "nada servido todavía");

      const r2 = await c.env.win.fetch(URL_PD);
      t.igual(await r2.text(), CAT_PD, "2.ª lectura: cuerpo intacto");
      t.igual(f.contador.n, 2, "2.ª lectura aún pasa por la red (protocolo de doble lectura)");
      st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.confirmaciones, 1, "2.ª idéntica CONFIRMA la inmutabilidad");
      t.igual(st.servidas, 0, "aún nada servido");

      const r3 = await c.env.win.fetch(URL_PD);
      t.igual(await r3.text(), CAT_PD, "3.ª lectura: mismo cuerpo, ya de caché");
      t.igual(f.contador.n, 2, "3.ª lectura NO tocó la red");
      st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.servidas, 1, "una servida");
      t.igual(st.bytesAhorrados, CAT_PD.length, "bytes ahorrados = longitud del catálogo");

      await esperar(() => tienda.has(URL_PD));
      t.igual(tienda.get(URL_PD).c, CAT_PD, "persistida en IndexedDB al confirmar");
      t.cierto(typeof tienda.get(URL_PD).h === "string" && tienda.get(URL_PD).h.length === 8, "con huella FNV-1a de 8 hex");

      // apagar restaura los originales y deja de interceptar
      t.cierto(c.api.togSet("tog_perf_cache", false), "apagado en caliente");
      t.falso(c.api.mtrPerfCacheActivo(), "interceptores retirados");
      t.igual(c.env.win.fetch, f, "fetch original restaurado tal cual");
      await c.env.win.fetch(URL_PD);
      t.igual(f.contador.n, 3, "con el toggle apagado, la red vuelve a ser red");
      st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.servidas, 1, "apagado: nada más servido");
    });

    // =====================================================================
    //  C — XHR: la vía real de Angular; responseType no textual jamás se sirve
    // =====================================================================
    await t.casoAsync("C/xhr: doble lectura y servido sintético; responseType json va a red (fail-open)", async () => {
      const c = cargar({ silencioso: true });
      sembrar707(c);
      const tienda = new Map();
      c.env.win.indexedDB = mockIDB(tienda);
      const contador = { n: 0 };
      c.env.win.XMLHttpRequest = fabricarCtorXHR({ [URL_PC]: CAT_PC }, contador);
      c.api.togSet("tog_perf_cache", true);

      const pedir = (rt) => new Promise((res) => {
        const x = new c.env.win.XMLHttpRequest();
        x.open("GET", URL_PC);
        if (rt) x.responseType = rt;
        x.onreadystatechange = () => { if (x.readyState === 4) res(x); };
        x.send();
      });

      const x1 = await pedir();
      t.igual(x1.responseText, CAT_PC, "xhr 1.ª: cuerpo intacto");
      t.igual(contador.n, 1, "xhr 1.ª pasó por la red");
      let st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.observadas, 1, "xhr 1.ª observada");
      t.igual(st.confirmaciones, 0, "sin confirmación aún");

      const x2 = await pedir();
      t.igual(contador.n, 2, "xhr 2.ª aún pasa por la red");
      st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.confirmaciones, 1, "xhr 2.ª idéntica confirma");

      const x3 = await pedir();
      t.igual(x3.responseText, CAT_PC, "xhr 3.ª: mismo cuerpo");
      t.igual(x3.readyState, 4, "sintético con readyState 4");
      t.igual(x3.status, 200, "sintético con status 200");
      t.igual(contador.n, 2, "xhr 3.ª NO tocó la red");
      st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.servidas, 1, "una servida vía xhr");
      t.igual(st.bytesAhorrados, CAT_PC.length, "bytes contados");

      // responseType "json": servirlo sintético podría romper la SPA → red original
      const x4 = await pedir("json");
      t.igual(x4.responseText, CAT_PC, "responseType json recibe el cuerpo por la red");
      t.igual(contador.n, 3, "responseType json pasó por la red");
      st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.servidas, 1, "responseType json jamás se sirvió de caché");
      await esperar(() => tienda.has(URL_PC));
      t.igual(tienda.get(URL_PC).c, CAT_PC, "persistida en IndexedDB");
    });

    // =====================================================================
    //  D — CAMBIO: cuerpos que cambian jamás se cachean
    // =====================================================================
    await t.casoAsync("D/cambio: lecturas distintas reinician la fase pendiente y jamás se cachea", async () => {
      const c = cargar({ silencioso: true });
      sembrar707(c);
      const tienda = new Map();
      c.env.win.indexedDB = mockIDB(tienda);
      const secuencia = [JSON.stringify({ v: 1 }), JSON.stringify({ v: 2 }), JSON.stringify({ v: 1 })];
      const f = mockFetch({ [URL_PC]: () => secuencia.shift() });
      c.env.win.fetch = f;
      c.api.togSet("tog_perf_cache", true);

      await c.env.win.fetch(URL_PC);   // v1 → pendiente h1
      await c.env.win.fetch(URL_PC);   // v2 ≠ h1 → pendiente reinicia con h2
      let st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.confirmaciones, 0, "cambio en la 2.ª lectura: jamás confirmó");
      t.igual(st.servidas, 0, "jamás sirvió");
      await c.env.win.fetch(URL_PC);   // v1 de nuevo: pendiente otra vez
      st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.confirmaciones, 0, "sigue sin confirmar mientras cambie");
      t.igual(st.servidas, 0, "sigue sin servir mientras cambie");
      t.igual(f.contador.n, 3, "las tres lecturas pasaron por la red");
      await new Promise((r) => setTimeout(r, 20));
      t.falso(tienda.has(URL_PC), "nada persistido para un catálogo cambiante");
    });

    // =====================================================================
    //  E — PERSISTENCIA: otra sesión del mismo día sirve desde la DB sin red
    // =====================================================================
    await t.casoAsync("E/persistencia: sesión nueva del mismo día sirve la 1.ª petición desde IndexedDB", async () => {
      const tienda = new Map();
      const c1 = cargar({ silencioso: true });
      sembrar707(c1);
      c1.env.win.indexedDB = mockIDB(tienda);
      const f1 = mockFetch({ [URL_PD]: CAT_PD });
      c1.env.win.fetch = f1;
      c1.api.togSet("tog_perf_cache", true);
      await c1.env.win.fetch(URL_PD);
      await c1.env.win.fetch(URL_PD);   // confirma
      await esperar(() => tienda.has(URL_PD));

      const c2 = cargar({ silencioso: true });
      sembrar707(c2);
      c2.env.win.indexedDB = mockIDB(tienda);   // misma "máquina": misma DB
      const f2 = mockFetch({ [URL_PD]: CAT_PD });
      c2.env.win.fetch = f2;
      c2.api.togSet("tog_perf_cache", true);
      const r = await c2.env.win.fetch(URL_PD);
      t.igual(await r.text(), CAT_PD, "cuerpo servido");
      t.igual(f2.contador.n, 0, "sesión nueva: 1.ª petición ya servida de la persistida HOY (cero red)");
      const st = c2.api.mtrPerfCacheEstadisticas();
      t.igual(st.servidas, 1, "contada como servida");
    });

    // =====================================================================
    //  F — BINARIO: content-type no textual pasa intacto, jamás se observa
    // =====================================================================
    await t.casoAsync("F/binario: content-type no textual pasa intacto y no se observa", async () => {
      const c = cargar({ silencioso: true });
      sembrar707(c);
      const tienda = new Map();
      c.env.win.indexedDB = mockIDB(tienda);
      const f = mockFetch({ [URL_PD]: "PDF-FICTICIO" }, { [URL_PD]: "application/pdf" });
      c.env.win.fetch = f;
      c.api.togSet("tog_perf_cache", true);
      const r = await c.env.win.fetch(URL_PD);
      t.igual(await r.text(), "PDF-FICTICIO", "respuesta original intacta");
      t.igual(f.contador.n, 1, "pasó por la red");
      const st = c.api.mtrPerfCacheEstadisticas();
      t.igual(st.observadas, 0, "binario jamás observado para cachear");
      t.igual(st.confirmaciones, 0, "binario jamás confirmado");
    });
  },
};
