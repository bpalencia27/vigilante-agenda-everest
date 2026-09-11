// =====================================================================
//  SUITE 98 — v18.14.8: «FALTAN ANTECEDENTES» CUANDO LAS CASILLAS NO ESTÁN AQUÍ
//
//  Aquí vivía también el bloque M2 de v18.7.0 —los DOS accesos directos del dock a
//  «Impresión Diagnóstica» y «Conducta», con su compuerta de visibilidad de v18.14.7—.
//  Se RETIRÓ en v18.14.11 por orden del médico (10-sep-2026): la propuesta de terminarlos
//  se rechazó y los botones se eliminaron definitivamente. Las pestañas siguen existiendo
//  en Everest y el redactor de texto libre sigue resolviéndolas por VGL_PESTANAS.
//
//  Reporte del médico (10-sep-2026): al pulsar «📝 Faltan antecedentes» el asistente
//  solo dejaba un aviso ámbar que se desvanecía y decía «vaya a la pestaña indicada»
//  —sin decir cuál, cuando son DOS— y no ofrecía ninguna forma de ir.
//  Contrato que fijan los casos de abajo: un cuadro que no se desvanece, una fila por
//  pestaña con su botón «Ir a …», el porqué dicho en una frase, y —lo importante— que el
//  botón clica DE VERDAD el ancla de la pestaña de Everest y que, si esa pestaña no está
//  montada, avisa en ámbar sin inventar nada.
//  Identificadores 100 % sintéticos: cero PHI, regla del proyecto.
// =====================================================================
const fs = require("fs");
const path = require("path");
const { instalarDomEnriquecido } = require("./harness");

const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

const LISTA_ACCESO_98 = {
  version: "test-98.1",
  perfiles: {
    COMPLETO: [{ uid: 707, nombre: "Medico De Prueba Noventa Y Ocho" }],
    LABORATORIOS: [],
  },
  blocklist: [],
};
const almacenAcceso98 = () => ({ vgl_acceso_lista: JSON.stringify(LISTA_ACCESO_98) });

module.exports = {
  nombre: "Faltan antecedentes: el cuadro que lleva a la pestaña cuando las casillas no están aquí (v18.14.8)",
  cubre: ["createAccionesDockUI", "_vglClicablePestana", "_vglNodoNavegable", "showToast"],

  async pruebas(t, api, env, cargar) {
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    function montar(opts) {
      const c = cargar(Object.assign({ silencioso: true }, opts));
      instalarDomEnriquecido(c.env.doc);
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      return c;
    }
    const identidad = (c, id) => { c.api.__state.activeDoctor.id = id; c.api.__state.activeDoctor.name = "MEDICO " + id; };
    const modalEn = (c, id) => c.env.doc.body.children.find((n) => n.id === id) || null;
    // Historia clínica mínima (patrón suite_93): gate de extractPacienteAbierto
    // (getElementById anamesis) + cédula sintética vía .text-muted.
    function mockHistoria(c) {
      const gEBI = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : gEBI(id));
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 1001112223", closest: () => null }] : []);
    }
    const botonDe = (dock, accion) => {
      const btns = dock && dock.children.find((n) => n.className === "vgl-dock-btns");
      return (btns && btns.children.find((b) => b.getAttribute && b.getAttribute("data-accion") === accion)) || null;
    };
    // El click() del DOM falso es un noop (no despacha a los listeners guardados en
    // _listeners). Para probar el gesto REAL, el botón clica a sus propios listeners
    // con un evento mínimo — el mismo contrato que el navegador cumple con el ratón.
    const armarClicReal = (boton) => {
      const lis = (boton._listeners && boton._listeners.click) || [];
      boton.click = () => { lis.forEach((f) => f({ stopPropagation() {}, preventDefault() {} })); };
    };
    // Telemetría por el mecanismo oficial (patrón suite_23/97).
    const accionUx = (c, accion) => {
      try { c.api._uxVolcarBuffer(); } catch (e) {}
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      const k = String(accion).toLowerCase().replace(/[^a-z0-9.:_-]/g, "");
      return (w && w.acciones && w.acciones[k]) || 0;
    };
    // Bandeja de toasts real (patrón suite_15/97).
    function bandejaToasts(c) {
      const bandeja = c.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n._parent = bandeja; };
      const getOrig = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : getOrig(id));
      return bandeja;
    }

    // v18.14.11 — AQUÍ VIVÍAN los 10 casos del bloque M2 (v18.7.0): nacimiento de los dos
    // accesos directos del dock, la compuerta de visibilidad de v18.14.7 (Modo programador ×
    // perfil de desarrollo), su entrada en la firma del dock, el clic sobre el ancla real, el
    // fail-closed del aviso ámbar y la guarda estructural de que el bloque no tocaba la red.
    // Se retiraron con los botones: la propuesta se rechazó y el código ya no existe, así que
    // esos casos no tendrían nada que medir. El contrato de navegación que compartían con el
    // cuadro de «Faltan antecedentes» (_vglNodoNavegable + _vglClicablePestana) sigue vivo y
    // se mide en los casos de v18.14.8, más abajo.

    t.caso("v18.14.11: el dock ya NO ofrece «Impresión Diagnóstica» ni «Conducta» — retirados definitivamente", () => {
      const c = montar({ almacen: almacenAcceso98() });
      const dock = dockConFaltantes(c);
      // El PEOR caso para este guardián: el atajo de teclado encendido Y el perfil que antes
      // los autorizaba. Si alguien reintrodujera los botones con la compuerta vieja, aquí
      // aparecerían — y esta prueba se pone roja.
      c.api.__state.activeDoctor.name = "BRANDON JESUS PALENCIA MARTINEZ";
      c.api._vglAlternarModoProg();
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock2 = modalEn(c, "vgl-acciones-dock");
      t.cierto(!!dock2, "el dock sigue existiendo");
      t.igual(botonDe(dock2, "pestana-impresion"), null, "el acceso a «Impresión Diagnóstica» ya no existe");
      t.igual(botonDe(dock2, "pestana-conducta"), null, "ni el de «Conducta»");
      t.cierto(!!botonDe(dock2, "faltan"), "y el resto del dock sigue en su sitio (el botón «Faltan antecedentes»)");
      // Guarda de FUENTE: ni los botones ni la compuerta de visibilidad que los gobernaba.
      t.falso(FUENTE.includes('data-accion", "pestana-impresion"'), "no queda el botón de impresión en el fuente");
      t.falso(FUENTE.includes('data-accion", "pestana-conducta"'), "ni el de conducta");
      t.falso(FUENTE.includes("_vglPestanasEnDesarrolloVisibles"), "ni la compuerta de visibilidad de v18.14.7");
      t.falso(FUENTE.includes("VGL_DEV_TABS_NOMBRES"), "ni la lista de perfiles autorizados");
      t.falso(FUENTE.includes("_vglEsPerfilDeDesarrollo"), "ni su comprobación de identidad");
    });

    // =====================================================================
    //  v18.14.8 — EL CUADRO DE «FALTAN ANTECEDENTES» CUANDO LAS CASILLAS NO ESTÁN AQUÍ
    //
    //  Reporte del médico (10-sep-2026): al pulsar «📝 Faltan antecedentes» el asistente
    //  solo dejaba un aviso ámbar que se desvanecía y decía «vaya a la pestaña indicada»
    //  —sin decir cuál, cuando son DOS— y no ofrecía ninguna forma de ir. Medido con el
    //  driver del arnés (bitácora `debug-faltan-antecedentes-ux.md`): tras el clic el body
    //  quedaba con CERO nodos nuevos y ningún control enfocable.
    //
    //  Los casos de abajo fijan el contrato nuevo: un cuadro que no se desvanece, una fila
    //  por pestaña con su botón «Ir a …», el porqué dicho en una frase, y —lo importante—
    //  que el botón clica DE VERDAD el ancla de la pestaña de Everest (el mismo gesto de
    //  v18.7.0) y que, si esa pestaña no está montada, avisa en ámbar sin inventar nada.
    // =====================================================================
    // Tablist con las dos pestañas que el cuadro debe ofrecer. El id `impDiagnostica` es el
    // ancla REAL que _vglBarraPestanasPrincipal usa para localizar la barra principal; el
    // querySelectorAll de la barra se acota a mano, como en el caso de v18.14.1, para que la
    // prueba mida el gesto y no el motor de selectores del arnés.
    function montarPestanasFactores(c, opts) {
      const barra = c.env.doc.createElement("div");
      barra.setAttribute("role", "tablist");
      const ancla = c.env.doc.createElement("a");
      ancla.id = "impDiagnostica";
      barra.appendChild(ancla);
      const aAnt = c.env.doc.createElement("a");
      aAnt.textContent = "Antecedentes";
      const aHab = c.env.doc.createElement("a");
      aHab.textContent = "Hábitos y Gestión de Riesgo";
      barra.querySelectorAll = () => [aAnt, aHab];
      // `activa` permite fijar la pestaña ACTIVA que leerá _vglPestanaActiva (para medir la
      // verificación de los 300 ms sin depender del motor de selectores del arnés).
      if (opts && opts.activa) barra.querySelector = () => opts.activa;
      c.env.doc.body.appendChild(barra);
      return { barra, aAnt, aHab };
    }
    // Dock con el botón «📝 Faltan antecedentes» en su sitio: hay resumen cacheado (la
    // compuerta «leyendo…» no aplica) pero los tres tri-estados siguen sin dato, y ninguna
    // casilla es llenable desde esta pantalla (mockHistoria no monta radios).
    function dockConFaltantes(c) {
      mockHistoria(c);
      c.api.mtrCacheResumenGuardar("1001112223", { factores: { sexo: "M", edad: 60 } });
      identidad(c, "707");
      t.noLanza(() => c.api.createAccionesDockUI());
      return modalEn(c, "vgl-acciones-dock");
    }
    const nodosCon = (raiz, attr) => {
      const out = [];
      (function rec(n) {
        for (const h of (n.children || [])) {
          if (h && typeof h.getAttribute === "function" && h.getAttribute(attr)) out.push(h);
          rec(h);
        }
      })(raiz);
      return out;
    };

    t.caso("v18.14.8: el clic abre un CUADRO (no un aviso efímero) con una fila por pestaña", () => {
      const c = montar({ almacen: almacenAcceso98() });
      const dock = dockConFaltantes(c);
      const bF = botonDe(dock, "faltan");
      t.cierto(!!bF, "el dock pinta el botón «Faltan antecedentes»");
      armarClicReal(bF);
      bF.click();
      const modal = modalEn(c, "vgl-llenar-modal");
      t.cierto(!!modal, "el clic abre el cuadro (antes: un aviso ámbar que se desvanecía)");
      t.igual(modal.getAttribute("role"), "dialog", "es un diálogo de verdad, no un cartel suelto");
      t.igual(modal.getAttribute("aria-modal"), "true", "y modal para el lector de pantalla");
      t.igual(modal.getAttribute("aria-labelledby"), "vgl-faltan-t", "el título lo etiqueta");
      t.igual(modal.getAttribute("aria-describedby"), "vgl-faltan-d", "y el porqué lo describe");
      const filas = nodosCon(modal, "data-pestania");
      t.igual(filas.map((f) => f.getAttribute("data-pestania")).join(" | "),
        "Antecedentes | Hábitos y Gestión de Riesgo",
        "una fila por pestaña, en el orden de MTR_FACTORES_NAVEGABLES");
      t.igual(filas.length, 2, "y no una fila por factor: hipertensión y diabetes comparten pestaña");
      const html = String(modal.innerHTML);
      t.cierto(html.indexOf("Hipertensión y Diabetes") !== -1, "la fila de Antecedentes nombra los dos factores");
      t.cierto(html.indexOf("Tabaquismo") !== -1, "la fila de Hábitos nombra el suyo");
      t.cierto(/Everest solo monta la pestaña que tiene abierta/.test(html), "y el cuadro dice POR QUÉ no se pueden marcar aquí");
      // Regla del médico (01-sep): un hecho por elemento, sin repetir lo que otro ya dice. La
      // pestaña la nombra el BOTÓN, así que el rótulo de la izquierda no la repite entre
      // paréntesis (era lo que hacía el aviso viejo: «Hipertensión y Diabetes (Antecedentes)»).
      t.falso(/\(Antecedentes\)|\(Hábitos y Gestión de Riesgo\)/.test(html), "el rótulo no repite la pestaña: el botón ya la dice");
    });

    t.caso("v18.14.8: cada fila trae su botón «Ir a …», con el destino en el texto Y en el nombre accesible", () => {
      const c = montar({ almacen: almacenAcceso98() });
      const dock = dockConFaltantes(c);
      armarClicReal(botonDe(dock, "faltan"));
      botonDe(dock, "faltan").click();
      const modal = modalEn(c, "vgl-llenar-modal");
      const irs = nodosCon(modal, "data-ir");
      t.igual(irs.map((b) => String(b.textContent)).join(" | "),
        "Ir a Antecedentes | Ir a Hábitos y Gestión de Riesgo",
        "el botón dice a dónde lleva");
      t.igual(irs.map((b) => b.getAttribute("aria-label")).join(" | "),
        "Ir a la pestaña Antecedentes para documentar Hipertensión y Diabetes | Ir a la pestaña Hábitos y Gestión de Riesgo para documentar Tabaquismo",
        "y el nombre accesible dice el destino Y para qué: quien salta de botón en botón no ve el rótulo de la izquierda");
    });

    t.caso("v18.14.8: «Ir a …» clica el ANCLA REAL de su pestaña (una por botón) y cierra el cuadro", () => {
      const c = montar({ almacen: almacenAcceso98() });
      const dock = dockConFaltantes(c);
      const { aAnt, aHab } = montarPestanasFactores(c);
      let clicsAnt = 0, clicsHab = 0;
      aAnt.click = () => { clicsAnt++; };
      aHab.click = () => { clicsHab++; };
      armarClicReal(botonDe(dock, "faltan"));
      botonDe(dock, "faltan").click();
      const modal = modalEn(c, "vgl-llenar-modal");
      const irs = nodosCon(modal, "data-ir");
      armarClicReal(irs[0]);
      armarClicReal(irs[1]);
      irs[0].click();
      t.igual(clicsAnt, 1, "el botón de la primera fila clica el ancla de Antecedentes");
      t.igual(clicsHab, 0, "y no toca la otra");
      t.igual(accionUx(c, "hc.pestana.faltan.ir"), 1, "la navegación se registra");
      t.igual(!!modalEn(c, "vgl-llenar-modal"), false, "el cuadro se cierra para dejar ver la pestaña");
      irs[1].click();
      t.igual(clicsHab, 1, "el de la segunda fila clica la suya");
      t.igual(clicsAnt, 1, "sin clicar dos veces la primera");
      // El resolutor del nodo navegable es compartido con los botones del dock (se subió a
      // nivel de módulo en v18.14.8): se nombra aquí para dejar constancia de su contrato.
      t.cierto(typeof c.api._vglNodoNavegable === "function", "el resolutor del nodo navegable es alcanzable");
      const anclaSuelta = c.env.doc.createElement("a");
      t.igual(c.api._vglNodoNavegable(anclaSuelta), anclaSuelta, "un ancla se devuelve tal cual (no se empeora lo previo)");
    });

    await t.casoAsync("v18.14.8: si el clic NO mueve la pestaña, el asistente lo dice — mismo contrato que los botones del dock", async () => {
      const c = montar({ almacen: almacenAcceso98() });
      const dock = dockConFaltantes(c);
      // La pestaña activa NO cambia al clicar (Everest ignoró el gesto): mismo id y mismo
      // texto antes y después. La comparación tiene que ser por VALOR — _vglPestanaActiva()
      // devuelve un objeto nuevo en cada llamada, así que comparar referencias nunca daría
      // «igual» y el aviso no saldría jamás.
      const activa = c.env.doc.createElement("a");
      activa.textContent = "Anamnesis";
      const { aAnt } = montarPestanasFactores(c, { activa });
      const bandeja = bandejaToasts(c);
      aAnt.click = () => {};   // el ancla existe y recibe el clic, pero no navega
      armarClicReal(botonDe(dock, "faltan"));
      botonDe(dock, "faltan").click();
      const modal = modalEn(c, "vgl-llenar-modal");
      const irs = nodosCon(modal, "data-ir");
      armarClicReal(irs[0]);
      irs[0].click();
      t.igual(accionUx(c, "hc.pestana.faltan.ir"), 1, "el clic se registró como intento");
      await esperar(450);   // la verificación corre a los 300 ms
      t.igual(accionUx(c, "hc.pestana.faltan.no_abrio"), 1, "y la verificación notó que la pestaña no cambió");
      await esperar(600);   // el flush de avisos corre a los 500 ms
      t.cierto(bandeja.children.some((n) => n.__vglColor === "AMBAR"), "con un aviso ámbar, para que el médico no se quede sin saberlo");
    });

    await t.casoAsync("v18.14.8 fail-closed: sin la pestaña montada, «Ir a …» avisa en ámbar y NO clica nada", async () => {
      const c = montar({ almacen: almacenAcceso98() });
      const dock = dockConFaltantes(c);
      const bandeja = bandejaToasts(c);
      // Sin tablist: la pestaña no está en esta pantalla de la historia.
      armarClicReal(botonDe(dock, "faltan"));
      botonDe(dock, "faltan").click();
      const modal = modalEn(c, "vgl-llenar-modal");
      const irs = nodosCon(modal, "data-ir");
      t.igual(irs.length, 2, "el cuadro se pinta igual (dice qué falta y dónde)");
      armarClicReal(irs[0]);
      irs[0].click();
      t.igual(accionUx(c, "hc.pestana.faltan.sin_pestana"), 1, "telemetría del fallo");
      t.igual(accionUx(c, "hc.pestana.faltan.ir"), 0, "no se registra una navegación que no ocurrió");
      await esperar(600);   // el flush de avisos corre a los 500 ms
      t.igual(bandeja.children.length, 1, "un aviso ámbar lo dice");
      t.cierto(bandeja.children[0] && bandeja.children[0].__vglColor === "AMBAR", "en ámbar");
      t.cierto(String(bandeja.children[0].innerHTML).indexOf("Antecedentes") !== -1, "nombrando la pestaña que falta");
    });

    t.caso("v18.14.8: el cuadro reutiliza el id y las clases ya blindados (ni una regla CSS nueva)", () => {
      const c = montar({ almacen: almacenAcceso98() });
      const dock = dockConFaltantes(c);
      armarClicReal(botonDe(dock, "faltan"));
      botonDe(dock, "faltan").click();
      const modal = modalEn(c, "vgl-llenar-modal");
      // Mismo id que el cuadro de llenado: es el mismo ayudante en su otra mitad, así que
      // hereda tokens, posición fija y blindaje de color sin CSS propio. Un id nuevo habría
      // exigido reglas nuevas (y su censo) y habría dejado el cuadro sin el tratamiento de
      // los paneles pegados a document.body.
      t.cierto(/class="vgl-agm-card"/.test(String(modal.innerHTML)), "usa la tarjeta de los módulos");
      const filas = nodosCon(modal, "data-pestania");
      t.cierto(String(filas[0].className).indexOf("vgl-llenar-fila") !== -1, "y las clases de fila ya existentes");
      t.cierto(String(nodosCon(modal, "data-ir")[0].className).indexOf("vgl-agm-btn sec") !== -1, "el botón es el .vgl-agm-btn.sec de siempre");
      // Guarda de FUENTE: ninguna regla nueva apunta a un id propio de este cuadro.
      t.falso(/#vgl-faltan-modal/.test(FUENTE), "no se inventó un modal nuevo (ni su CSS)");
      t.cierto(/function vglModalFaltanIrAPestania\(apt, pendientes\) \{/.test(FUENTE), "la mitad «hay que ir a la pestaña» es su propia función");
      t.cierto(/if \(vglModalFaltanIrAPestania\(apt, pendientes\)\) return true;/.test(FUENTE), "y es la que se usa cuando las casillas no están en esta pantalla");
    });
  },
};
