// =====================================================================
//  SUITE 105 — ORDEN #9: botón de actualización del panel del centinela
//
//  El botón «Consultar» de «Citas del día» NO recarga la página: dispara un
//  GET dinámico a ObtenerConsultas (evidencia: consultar.har, entradas
//  18/25 — sin navegación de documento). El botón #vgl-refresh del panel
//  replica ese comportamiento con dos ramas:
//    1. «Citas del día» delante → clic nativo del botón real de Everest
//       (el DOM de Angular se repinta solo; el panel se realimenta del DOM).
//    2. cualquier otra pantalla → la MISMA llamada, por la MISMA vía de
//       procesado que el sondeo (_procesarFuenteAgenda): nunca una segunda
//       lógica que pudiera divergir del tick.
//  Y NUNCA location.reload().
//
//  La extracción de _procesarFuenteAgenda fuera del tick dejó un
//  ReferenceError latente (la condición de pintado usaba la variable local
//  `enVistaVigilada` del tick, que este ámbito ya no ve); el fix recalcula
//  la vista con seccionActiva(). El grupo D prueba exactamente eso: con
//  forzarPintado=false y la vista en "otra", el panel NO se repinta; con
//  true (solo lo usa el botón), sí.
//
//  Cómo se lee la lista pintada: render() monta las tarjetas en un
//  DocumentFragment y lo anexa a #vgl-list con appendChild. El DOM falso
//  NO mueve los hijos del fragmento (el navegador real sí), así que la
//  lista queda con UN hijo — el propio fragmento — y las tarjetas viven
//  DENTRO. Patrón establecido de suite_15_interfaz_avanzada (v18.0.106):
//  tarjetasDe() mira dentro del fragmento cuando es el único hijo.
//
//  Y los casos que esperan promesas se declaran con `t.casoAsync` + await:
//  `t.caso` con una función async las suelta sin esperarlas — el runner
//  cuenta "ok" al instante y un fallo posterior mata el proceso al final
//  del banco como rechazo no capturado (lo cazó la primera corrida del
//  banco: la suite salía "13 ok" y el proceso moría tras la última suite,
//  con el assert de la lista evaluándose en un timer huérfano).
// =====================================================================
module.exports = {
  nombre: "ORDEN #9 — botón de actualización del panel (réplica de «Consultar»)",
  cubre: [
    "_esBotonConsultar", "_btnConsultarEn", "_vglRefrescarPulso",
    "refrescarAgendaAhora", "_procesarFuenteAgenda",
    "apiRecordar", "apiLeerAgenda", "apiParse", "colorAndAlert", "seccionActiva", "render", "setSummary",
  ],

  async pruebas(t, api, env, cargar) {
    // Botón de «Citas del día» con la pinta real del encargo de la orden:
    //   <button _ngcontent-oyh-c5="" class="button-medico"> Consultar </button>
    const BOTON_CONSULTAR = { tagName: "BUTTON", className: "button-medico", textContent: " Consultar " };
    // La llamada real que dispara ese botón (consultar.har), ya aprendida por el módulo API.
    const URL_AGENDA = "/apiviva/APIMedicoHealth/api/Medico/ObtenerConsultas?especialidadId=12&profesionalId=374";
    // Filas con la pinta real de la respuesta de Everest (mismo molde que suite_13).
    const FILAS = [
      { horaCita: "07:00", estado: "EN SALA", numeroDocumento: "12345678", nombrePaciente: "JUAN", apellidoPaciente: "PEREZ" },
      { horaCita: "07:20", estado: "SIN PRESENTAR", numeroDocumento: "87654321", nombrePaciente: "MARIA", apellidoPaciente: "GOMEZ" },
    ];

    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    // Espera CONDICIONAL: reintenta cada 15 ms hasta que la condición se cumpla o
    // venza el tope. Un esperar(90) fijo se quedaba corto con el banco completo
    // corriendo (la máquina ocupada con decenas de suites previas): el pipeline del
    // botón (fetch simulado → parse → procesado → render) tardaba más de 90 ms en
    // completarse y la aserción veía la lista aún vacía. En solitario pasaba porque
    // la máquina está descargada — justo la clase de falso determinismo que este
    // banco persigue.
    async function esperarHasta(fn, topeMs) {
      const tope = topeMs || 800;
      const t0 = Date.now();
      while (!fn()) {
        if (Date.now() - t0 > tope) return false;
        await esperar(15);
      }
      return true;
    }

    // DOM falso enriquecido para montar el panel real: cada elemento responde
    // querySelector con un memo propio (v18.0.24: normaliza `:not(...)` antes de
    // memoizar — este DOM falso tiene UN nodo por selector lógico).
    function enriquecerDom(c) {
      const doc = c.env.doc;
      const crearBase = doc.createElement; // la función original no usa `this`
      doc.createElement = function (tag) {
        const e = crearBase(tag);
        const memo = new Map();
        e.querySelector = (sel) => {
          const clave = String(sel).replace(/:not\([^)]*\)/g, "");
          if (!memo.has(clave)) memo.set(clave, doc.createElement("div"));
          return memo.get(clave);
        };
        e.querySelectorAll = () => [];
        return e;
      };
      doc.createDocumentFragment = () => {
        const f = doc.createElement("div");
        f._esFragmento = true;
        return f;
      };
    }

    // Dispara el primer listener registrado de un tipo en un nodo falso.
    function disparar(nodo, tipo, evento) {
      const ls = nodo._listeners && nodo._listeners[tipo];
      if (!ls || !ls.length) throw new Error("no hay listener '" + tipo + "' registrado");
      return ls[0](evento || {});
    }

    // Entorno con fetch intercambiable + registro de llamadas (molde de suite_13).
    function entorno() {
      const reg = { fetches: [] };
      let responderFetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => "" });
      const c = cargar({
        silencioso: true,
        fetch: (url, opt) => { reg.fetches.push({ url, opt }); return responderFetch(url, opt); },
      });
      return { c, reg, setFetch: (f) => { responderFetch = f; } };
    }
    const respuestaJson = (obj) => async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(obj) });
    const respuestaError = (status) => async () => ({ ok: false, status, headers: { get: () => null }, text: async () => "" });

    // Monta el panel real (buildOverlay) y devuelve las agarraderas del DOM.
    function montarPanel(e) {
      enriquecerDom(e.c);
      e.c.ctx.innerWidth = 1200;
      e.c.ctx.innerHeight = 800;
      e.c.api.buildOverlay();
      const raiz = e.c.env.doc.body.children.find((n) => n.id === "vgl-root");
      const q = (sel) => raiz.querySelector(sel);
      return { raiz, q };
    }
    const resumenDe = (q) => String(q("#vgl-sum").textContent || "");
    // La lista pintada por render() vive DENTRO del fragmento que el DOM falso
    // no resuelve al hacer appendChild (el navegador real sí mueve los hijos).
    // Si #vgl-list tiene un único hijo y es el fragmento, las tarjetas están
    // dentro de él (patrón establecido de suite_15_interfaz_avanzada).
    function tarjetasDe(q) {
      const lista = q("#vgl-list");
      const unica = lista.children.length === 1 ? lista.children[0] : null;
      return unica && unica._esFragmento ? unica.children : lista.children;
    }

    // =====================================================================
    // A. Reconocimiento del botón real de Everest (la célula de la rama 1)
    // =====================================================================
    t.caso("_esBotonConsultar: el botón del encargo (clase button-medico, rótulo Consultar) es reconocido", () => {
      const c = cargar({ silencioso: true });
      t.cierto(c.api._esBotonConsultar(BOTON_CONSULTAR) === true, "HTML real de la orden -> true");
    });

    t.caso("_esBotonConsultar: la clase button-medico con OTRO rótulo (Guardar) NO es Consultar", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api._esBotonConsultar({ tagName: "BUTTON", className: "button-medico", textContent: " Guardar " }));
    });

    t.caso("_esBotonConsultar: un rótulo Consultar SIN la clase button-medico no sirve (hay botones Consultar en otros módulos)", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api._esBotonConsultar({ tagName: "BUTTON", className: "btn-otro", textContent: " Consultar " }));
    });

    t.caso("_esBotonConsultar: lo que no es un BUTTON nunca califica, aunque lleve clase y rótulo", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api._esBotonConsultar({ tagName: "DIV", className: "button-medico", textContent: " Consultar " }));
      t.falso(c.api._esBotonConsultar(null));
      t.falso(c.api._esBotonConsultar(undefined));
      t.falso(c.api._esBotonConsultar({}));
    });

    t.caso("_esBotonConsultar: espacios, saltos y mayúsculas del rótulo real no engañan", () => {
      const c = cargar({ silencioso: true });
      t.cierto(c.api._esBotonConsultar({ tagName: "BUTTON", className: "button-medico", textContent: "  CONSULTAR\n" }) === true);
      t.cierto(c.api._esBotonConsultar({ tagName: "BUTTON", className: "button-medico", textContent: "Consultar" }) === true);
    });

    t.caso("_btnConsultarEn: entre varios botones devuelve el de la clase y el rótulo exactos (Consultas NO confunde)", () => {
      const c = cargar({ silencioso: true });
      const botones = [
        { tagName: "BUTTON", className: "button-medico", textContent: " Guardar " },
        { tagName: "BUTTON", className: "button-medico", textContent: " Consultas " },
        { tagName: "BUTTON", className: "button-otra", textContent: " Consultar " },
        BOTON_CONSULTAR,
      ];
      t.igual(c.api._btnConsultarEn(botones), BOTON_CONSULTAR, "devuelve el botón exacto del encargo");
      t.igual(c.api._btnConsultarEn([]), null, "lista vacía -> null");
      t.igual(c.api._btnConsultarEn(null), null);
      t.igual(c.api._btnConsultarEn(undefined), null);
    });

    // =====================================================================
    // B. Rama nativa: con «Citas del día» delante, el clic del botón real es
    //    la réplica exacta (Angular repinta solo) — cero llamadas propias.
    // =====================================================================
    t.caso("refrescarAgendaAhora rama 1: con el botón real en el DOM recibe el clic nativo y NO llama al API", () => {
      const e = entorno();
      let clics = 0;
      const botonReal = { tagName: "BUTTON", className: "button-medico", textContent: " Consultar ", click: () => { clics++; } };
      e.c.env.doc.querySelectorAll = (sel) => (sel === "button.button-medico" ? [botonReal] : []);
      e.c.api.refrescarAgendaAhora();
      t.igual(clics, 1, "el botón real de Everest recibió exactamente un clic");
      t.igual(e.reg.fetches.length, 0, "cero llamadas propias: el clic nativo es la réplica exacta");
    });

    // =====================================================================
    // C. Rama 2 — la misma llamada de Consultar, directa, con el panel real
    // =====================================================================
    t.caso("refrescarAgendaAhora rama 2 sin URL aprendida: avisa con honestidad y no inventa ni consulta nada", () => {
      const e = entorno();
      const { q } = montarPanel(e);
      e.c.api.__state.summarized = true;   // jornada ya sembrada (escenario real de mitad de turno)
      e.c.api.refrescarAgendaAhora();
      t.cierto(resumenDe(q).includes("Todavía no aprendí la llamada"), "explica por qué no puede refrescar: " + resumenDe(q));
      t.igual(e.reg.fetches.length, 0, "sin URL aprendida no sale a la red");
    });

    await t.casoAsync("refrescarAgendaAhora rama 2 feliz: lee ObtenerConsultas y pinta por la MISMA vía que el sondeo", async () => {
      const e = entorno();
      e.c.api.apiRecordar(URL_AGENDA);
      e.setFetch(respuestaJson(FILAS));
      const { q } = montarPanel(e);
      e.c.api.__state.summarized = true;
      e.c.api.__state.leader = false;      // silencioso: sin avisos ni relevos en esta prueba
      const st = e.c.api.__state;
      const boton = q("#vgl-refresh");
      t.cierto(!!boton, "el panel montado por buildOverlay lleva el botón #vgl-refresh");

      disparar(boton, "click");
      await esperarHasta(() => st.lastSnapshot && st.lastSnapshot.list.length === 2);

      t.igual(e.reg.fetches.length, 1, "una sola llamada (la del botón)");
      t.cierto(String(e.reg.fetches[0].url).includes("ObtenerConsultas"), "es la misma llamada que dispara «Consultar»");
      t.cierto(Array.isArray(st.apiCitas) && st.apiCitas.length === 2, "las citas del día quedaron actualizadas en state.apiCitas");
      t.cierto(!!st.apiEn, "el reloj de vigencia del API se selló");
      t.cierto(st.lastSnapshot && st.lastSnapshot.list.length === 2, "el snapshot se procesó (colorAndAlert por cita)");
      t.igual(st.lastSnapshot.source, "api");
      t.cierto(resumenDe(q).includes("Vigilando la agenda"), "el panel pasó a resumen de agenda viva: " + resumenDe(q));
      const tarjetas = tarjetasDe(q);
      t.cierto(tarjetas.length === 2, "la lista del panel se repintó con las dos citas (tarjetas reales de render)");
      t.cierto(tarjetas.every((x) => x.__vglKey !== undefined), "son tarjetas construidas por render (marcador __vglKey), no el fragmento sin resolver");
    });

    await t.casoAsync("refrescarAgendaAhora rama 2 con fallo del servidor: avisa en error y NO pisa el snapshot anterior", async () => {
      const e = entorno();
      e.c.api.apiRecordar(URL_AGENDA);
      const { q } = montarPanel(e);
      e.c.api.__state.summarized = true;
      e.c.api.__state.leader = false;
      const st = e.c.api.__state;

      // Primero una lectura feliz (deja snapshot y panel al día).
      e.setFetch(respuestaJson(FILAS));
      disparar(q("#vgl-refresh"), "click");
      await esperarHasta(() => st.lastSnapshot && st.lastSnapshot.list.length === 2);
      const atAntes = st.lastSnapshot.at;
      const listaAntes = st.lastSnapshot.list.length;

      // Ahora el servidor responde 500: el botón avisa y deja el estado intacto.
      e.setFetch(respuestaError(500));
      disparar(q("#vgl-refresh"), "click");
      await esperarHasta(() => resumenDe(q).includes("No se pudo refrescar"));

      t.cierto(resumenDe(q).includes("No se pudo refrescar"), "el médico sabe que esta pulsación no llegó: " + resumenDe(q));
      t.igual(st.lastSnapshot.at, atAntes, "el snapshot del último buen estado NO se pisa");
      t.igual(st.lastSnapshot.list.length, listaAntes);
      t.igual(e.reg.fetches.length, 2, "la pulsación fallida sí salió a la red (y falló), no se tragó en silencio");
    });

    await t.casoAsync("refrescarAgendaAhora rama 2 reentrante: mientras una lectura está en vuelo, una segunda pulsación avisa y NO duplica", async () => {
      const e = entorno();
      e.c.api.apiRecordar(URL_AGENDA);
      const { q } = montarPanel(e);
      e.c.api.__state.summarized = true;
      e.c.api.__state.leader = false;
      const st = e.c.api.__state;
      let resolverFetch = null;
      e.setFetch(() => new Promise((res) => { resolverFetch = res; }));

      disparar(q("#vgl-refresh"), "click");
      await esperarHasta(() => resumenDe(q).includes("Actualizando la agenda") && e.reg.fetches.length === 1);
      t.cierto(resumenDe(q).includes("Actualizando la agenda"), "la primera pulsación arrancó la lectura: " + resumenDe(q));

      disparar(q("#vgl-refresh"), "click");
      t.cierto(resumenDe(q).includes("Ya se está actualizando"), "la segunda pulsación avisa que ya hay una en vuelo");
      t.igual(e.reg.fetches.length, 1, "no salió una segunda llamada duplicada");

      resolverFetch({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(FILAS) });
      await esperarHasta(() => st.lastSnapshot && st.lastSnapshot.list.length === 2);
      t.cierto(st.lastSnapshot && st.lastSnapshot.list.length === 2, "la lectura en vuelo completó el refresco al resolverse");
      t.cierto(resumenDe(q).includes("Vigilando la agenda"), "el panel quedó en agenda viva");
    });

    // =====================================================================
    // D. _procesarFuenteAgenda — UNA sola vía de procesado para tick y botón.
    //    La extracción fuera del tick perdió la variable local enVistaVigilada
    //    (ReferenceError en runtime); el fix la recalcula con seccionActiva().
    //    Estos dos casos son la red que caza esa regresión.
    // =====================================================================
    t.caso("_procesarFuenteAgenda fuera de la vista (forzarPintado=false): procesa y guarda snapshot pero NO repinta el panel", () => {
      const e = entorno();
      const { q } = montarPanel(e);
      const st = e.c.api.__state;
      st.summarized = true;
      st.leader = false;
      e.c.api.__CONFIG.SEL = { hora: "", estado: "" };   // sección "otra" -> vista no vigilada
      const citas = [{ hora_texto: "08:00 AM", estado: "En sala", nombre: "JUAN", index: 1, doc_id: "123" }];
      e.c.api.setSummary("marca inicial");

      e.c.api._procesarFuenteAgenda({ visible: true, citas }, "api", new Date(), false);

      t.igual(resumenDe(q), "marca inicial", "el resumen del panel NO se tocó: fuera de la vista no se repinta");
      t.igual(tarjetasDe(q).length, 0, "la lista sigue vacía");
      t.cierto(st.lastSnapshot && st.lastSnapshot.list.length === 1, "pero el procesado SÍ corrió: el snapshot quedó listo para cuando el médico vuelva a la vista");
      t.igual(st.lastSnapshot.source, "api");
    });

    t.caso("_procesarFuenteAgenda con forzarPintado=true (el botón): pinta aunque la vista no sea la de agenda", () => {
      const e = entorno();
      const { q } = montarPanel(e);
      const st = e.c.api.__state;
      st.summarized = true;
      st.leader = false;
      e.c.api.__CONFIG.SEL = { hora: "", estado: "" };   // vista no vigilada, pero el médico acaba de pulsar el panel
      const citas = [{ hora_texto: "08:00 AM", estado: "En sala", nombre: "JUAN", index: 1, doc_id: "123" }];
      e.c.api.setSummary("marca inicial");

      e.c.api._procesarFuenteAgenda({ visible: true, citas }, "api", new Date(), true);

      t.cierto(resumenDe(q).includes("Vigilando la agenda"), "el panel se repintó pese a estar fuera de «Citas del día»: " + resumenDe(q));
      const tarjetas = tarjetasDe(q);
      t.igual(tarjetas.length, 1, "la tarjeta se pintó");
      t.cierto(tarjetas[0] && tarjetas[0].__vglKey !== undefined, "y es una tarjeta real de render (__vglKey), no el fragmento vacío ni el aviso de filtro");
      t.cierto(st.lastSnapshot.list.length === 1, "y el snapshot quedó al día");
    });
  },
};
