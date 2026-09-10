// =====================================================================
//  SUITE 98 — v18.7.0 (M2): PESTAÑAS DE IMPRESIÓN DIAGNÓSTICA Y CONDUCTA
//  Pedido del médico: «pestañas de impresión diagnóstica y conducta».
//  En el dock de la historia clínica se ofrecen DOS accesos directos a
//  las pestañas que se imprimen al cerrar la consulta. Reglas:
//    · Solo se pintan si la pestaña YA está montada en el DOM de la nota
//      (el dock nace antes que el editor; la presencia entra en la firma
//      y el dock se repinta solo cuando aparecen).
//    · El gesto es el clic del propio enlace de pestaña de Everest
//      (anclas reales de VGL_PESTANAS: a#impDiagnostica y a#conducta).
//    · Si al clicar la pestaña ya no está, aviso ámbar y nada más —
//      fail-closed, jamás se inventa una pestaña.
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
  nombre: "M2: pestañas Impresión Diagnóstica y Conducta en el dock de la HC (v18.7.0)",
  cubre: ["createAccionesDockUI", "_vglClicablePestana", "showToast"],

  async pruebas(t, api, env, cargar) {
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    function montar(opts) {
      const c = cargar(Object.assign({ silencioso: true }, opts));
      instalarDomEnriquecido(c.env.doc);
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      return c;
    }
    const identidad = (c, id) => { c.api.__state.activeDoctor.id = id; c.api.__state.activeDoctor.name = "MEDICO " + id; };
    // v18.14.7 — Las dos pestañas están a medio hacer: se OCULTAN por completo en producción
    // y solo existen con Modo programador encendido + el perfil de desarrollo autorizado.
    // Los casos del gesto (nacimiento, firma, clic, fail-closed) siguen midiendo el MISMO
    // contrato de v18.7.0: para llegar a los botones hay que abrir esa compuerta primero.
    const identidadDesarrollo = (c) => {
      c.api.__state.activeDoctor.id = 707;
      c.api.__state.activeDoctor.name = "BRANDON JESUS PALENCIA MARTINEZ";
      c.api._vglAlternarModoProg();   // contexto nuevo: arranca apagado, así que esto lo enciende
    };
    const modalEn = (c, id) => c.env.doc.body.children.find((n) => n.id === id) || null;
    // Historia clínica mínima (patrón suite_93): gate de extractPacienteAbierto
    // (getElementById anamesis) + cédula sintética vía .text-muted.
    function mockHistoria(c) {
      const gEBI = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : gEBI(id));
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 1001112223", closest: () => null }] : []);
    }
    // Tablist de la nota con las dos pestañas (anclas REALES de VGL_PESTANAS:
    // a#impDiagnostica y a#conducta, capturadas del DOM de Everest).
    function montarPestanas(c) {
      const barra = c.env.doc.createElement("div");
      barra.setAttribute("role", "tablist");
      const tImp = c.env.doc.createElement("a");
      tImp.id = "impDiagnostica"; tImp.textContent = "Impresión Diagnóstica";
      const tCond = c.env.doc.createElement("a");
      tCond.id = "conducta"; tCond.textContent = "Conducta";
      barra.appendChild(tImp); barra.appendChild(tCond);
      c.env.doc.body.appendChild(barra);
      return { barra, tImp, tCond };
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

    t.caso("dock con las dos pestañas montadas: nacen los dos accesos directos con su etiqueta", () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      montarPestanas(c);
      identidadDesarrollo(c);
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = modalEn(c, "vgl-acciones-dock");
      t.cierto(!!dock, "el dock existe");
      const bImp = botonDe(dock, "pestana-impresion");
      const bCond = botonDe(dock, "pestana-conducta");
      t.cierto(!!bImp, "botón «Impresión Diagnóstica» presente");
      t.cierto(!!bCond, "botón «Conducta» presente");
      const rotulos = (b) => (b.children || []).map((x) => String(x.textContent || ""));
      t.cierto(rotulos(bImp).indexOf("Impresión Diagnóstica") !== -1, "la etiqueta dice «Impresión Diagnóstica»");
      t.cierto(rotulos(bCond).indexOf("Conducta") !== -1, "y la otra «Conducta»");
    });

    t.caso("sin pestañas montadas (módulo distinto del editor): los botones no nacen", () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      identidadDesarrollo(c);
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = modalEn(c, "vgl-acciones-dock");
      t.cierto(!!dock, "el dock existe igual");
      t.igual(!!botonDe(dock, "pestana-impresion"), false, "sin pestaña de impresión, sin botón");
      t.igual(!!botonDe(dock, "pestana-conducta"), false, "sin pestaña de conducta, sin botón");
    });

    // ---- v18.14.7: la compuerta de visibilidad (producción vs desarrollo) ----
    t.caso("v18.14.7: SIN Modo programador los dos botones NO existen, aunque sea el perfil de desarrollo", () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      montarPestanas(c);
      c.api.__state.activeDoctor.id = 707;
      c.api.__state.activeDoctor.name = "BRANDON JESUS PALENCIA MARTINEZ";
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = modalEn(c, "vgl-acciones-dock");
      t.cierto(!!dock, "el dock existe igual");
      t.igual(!!botonDe(dock, "pestana-impresion"), false, "sin Modo programador no se ve «Impresión Diagnóstica»");
      t.igual(!!botonDe(dock, "pestana-conducta"), false, "ni «Conducta»");
    });

    t.caso("v18.14.7: con Modo programador pero OTRO perfil, los dos botones tampoco existen", () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      montarPestanas(c);
      identidad(c, "102");            // el padrón autorizado, pero NO el perfil de desarrollo
      c.api._vglAlternarModoProg();
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = modalEn(c, "vgl-acciones-dock");
      t.igual(!!botonDe(dock, "pestana-impresion"), false, "el atajo de teclado por sí solo no abre el acceso");
      t.igual(!!botonDe(dock, "pestana-conducta"), false, "hacen falta LAS DOS condiciones");
    });

    t.caso("v18.14.7: encender el Modo programador repinta el dock y los botones nacen sin esperar al tick", () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      montarPestanas(c);
      c.api.__state.activeDoctor.id = 707;
      c.api.__state.activeDoctor.name = "BRANDON JESUS PALENCIA MARTINEZ";
      t.noLanza(() => c.api.createAccionesDockUI());
      t.igual(!!botonDe(modalEn(c, "vgl-acciones-dock"), "pestana-impresion"), false, "primero, sin modo: no hay botón");
      c.api._vglAlternarModoProg();   // el atajo Ctrl+Shift+D
      const dock = modalEn(c, "vgl-acciones-dock");
      t.cierto(!!botonDe(dock, "pestana-impresion"), "al encenderlo, el dock se repinta solo y el botón nace");
      t.cierto(!!botonDe(dock, "pestana-conducta"), "los dos");
      c.api._vglAlternarModoProg();   // apagarlo
      const dock2 = modalEn(c, "vgl-acciones-dock");
      t.igual(!!botonDe(dock2, "pestana-impresion"), false, "y al apagarlo desaparecen otra vez");
      t.igual(!!botonDe(dock2, "pestana-conducta"), false, "los dos");
    });

    t.caso("firma del dock: al MONTARSE la pestaña después, el botón aparece sin cambiar nada más", () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      identidadDesarrollo(c);
      t.noLanza(() => c.api.createAccionesDockUI());
      t.igual(botonDe(modalEn(c, "vgl-acciones-dock"), "pestana-impresion"), null, "primero no hay pestaña: sin botón");
      montarPestanas(c);   // el editor termina de montar la nota
      t.noLanza(() => c.api.createAccionesDockUI());
      t.cierto(!!botonDe(modalEn(c, "vgl-acciones-dock"), "pestana-impresion"),
        "la presencia entró en la firma: el dock se repinta y el botón nace");
    });

    t.caso("clic en el acceso directo: clica el enlace real de la pestaña y registra telemetría", () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      const { tImp, tCond } = montarPestanas(c);
      identidadDesarrollo(c);
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = modalEn(c, "vgl-acciones-dock");
      let clicsImp = 0, clicsCond = 0;
      tImp.click = () => { clicsImp++; };
      tCond.click = () => { clicsCond++; };
      armarClicReal(botonDe(dock, "pestana-impresion"));
      armarClicReal(botonDe(dock, "pestana-conducta"));
      botonDe(dock, "pestana-impresion").click();
      botonDe(dock, "pestana-conducta").click();
      t.igual(clicsImp, 1, "el enlace de «Impresión Diagnóstica» recibió el clic");
      t.igual(clicsCond, 1, "el enlace de «Conducta» recibió el clic");
      t.igual(accionUx(c, "hc.pestana.impresion.clic"), 1, "telemetría del clic en impresión");
      t.igual(accionUx(c, "hc.pestana.impresion.ok"), 1, "y su apertura lograda");
      t.igual(accionUx(c, "hc.pestana.conducta.clic"), 1, "telemetría del clic en conducta");
      t.igual(accionUx(c, "hc.pestana.conducta.ok"), 1, "y su apertura lograda");
    });

    await t.casoAsync("fail-closed: si la pestaña desapareció al momento del clic, aviso ámbar y cero clics inventados", async () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      const { barra, tImp } = montarPestanas(c);
      identidadDesarrollo(c);
      const bandeja = bandejaToasts(c);
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = modalEn(c, "vgl-acciones-dock");
      let clics = 0;
      tImp.click = () => { clics++; };
      barra.removeChild(tImp);   // el editor cambió de pantalla
      armarClicReal(botonDe(dock, "pestana-impresion"));
      botonDe(dock, "pestana-impresion").click();
      t.igual(clics, 0, "sin enlace no se clica nada");
      t.igual(accionUx(c, "hc.pestana.impresion.sin_pestana"), 1, "telemetría del fallo");
      await esperar(600);   // el flush de avisos corre a los 500 ms
      t.igual(bandeja.children.length, 1, "un aviso ámbar dice qué pasó");
      t.cierto(bandeja.children[0] && bandeja.children[0].__vglColor === "AMBAR", "en ámbar");
      t.cierto(String(bandeja.children[0].innerHTML).indexOf("Impresión Diagnóstica") !== -1, "y nombra la pestaña que falta");
    });

    // v18.14.1 — El DOM REAL de Everest envuelve cada pestaña en un <li> (capturado en el
    // mapa de grounding del 14-ago: `{ id: "conducta", etiqueta: "Conducta*" }`). Como
    // _vglClicablePestana barre `a, li, button…` en orden de documento, el <li> gana por
    // texto exacto ANTES que su <a>, y clicar el contenedor no navega: el botón parecía
    // muerto, sin acción y sin aviso. Esta prueba monta esa forma real y exige que el clic
    // caiga en el ANCLA. Los nodos falsos se acotan a mano (querySelectorAll/querySelector)
    // para que la prueba mida el gesto y no el motor de selectores del arnés.
    t.caso("v18.14.1: el clic cae en el ANCLA de la pestaña, no en el <li> que la envuelve", () => {
      const c = montar({ almacen: almacenAcceso98() });
      mockHistoria(c);
      const barra = c.env.doc.createElement("div");
      barra.setAttribute("role", "tablist");
      const li = c.env.doc.createElement("li");
      const a = c.env.doc.createElement("a");
      a.id = "impDiagnostica"; a.textContent = "";
      li.textContent = "Impresión Diagnóstica";   // el texto vive en el <li>: es el ÚNICO candidato que casa
      li.appendChild(a); barra.appendChild(li);
      barra.querySelectorAll = () => [li, a];          // orden de documento real
      c.env.doc.body.appendChild(barra);
      identidadDesarrollo(c);
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = modalEn(c, "vgl-acciones-dock");
      let clicsLi = 0, clicsA = 0;
      li.click = () => { clicsLi++; };
      a.click = () => { clicsA++; };
      armarClicReal(botonDe(dock, "pestana-impresion"));
      botonDe(dock, "pestana-impresion").click();
      t.igual(clicsA, 1, "el <a> de la pestaña recibió el clic");
      t.igual(clicsLi, 0, "el <li> contenedor NO recibió el clic (era el defecto)");
      t.igual(accionUx(c, "hc.pestana.impresion.ok"), 1, "y la apertura se registró como lograda");
    });

    t.caso("estructura: el bloque M2 no toca la red y solo clica enlaces ya anclados en VGL_PESTANAS", () => {
      // Ancla en el atributo del botón (ÚNICO en el fuente; el comentario del bloque
      // se repite también arriba, junto a la firma del dock): la ventana cubre desde
      // el guard de _tabImp hasta el cierre del segundo handler.
      const i = FUENTE.indexOf('data-accion", "pestana-impresion"');
      t.cierto(i > 0, "el bloque M2 existe en el fuente");
      const bloque = FUENTE.slice(Math.max(0, i - 1500), i + 2400);
      t.cierto(bloque.indexOf("GM_xmlhttpRequest") === -1, "sin GM_xmlhttpRequest");
      t.cierto(bloque.indexOf("pageFetchJson(") === -1 && bloque.indexOf("_pageFetchJsonCore(") === -1, "sin red directa");
      t.cierto(bloque.indexOf('_vglClicablePestana("impresion diagnostica")') !== -1, "impresión: busca el ancla real");
      t.cierto(bloque.indexOf('_vglClicablePestana("conducta")') !== -1, "conducta: busca el ancla real");
      t.cierto(bloque.indexOf("tab.click()") !== -1, "el gesto final es el clic del enlace de Everest");
      t.cierto(bloque.indexOf("hc.pestana.impresion.sin_pestana") !== -1, "telemetría del fallo presente");
    });
  },
};
