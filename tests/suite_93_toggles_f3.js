// =====================================================================
//  SUITE 93 — TOGGLES DE FUNCIONALIDAD (v18.6.1, F3)
//  Cubre el registro central de toggles por médico: defaults (fail-open
//  salvo restrictivos con `defecto: false`), persistencia por uid en
//  clave propia (vgl_tog_<uid>, dos médicos no se pisan), jerarquía
//  padre-hijo, y las compuertas que cuelgan de cada flujo: módulo de
//  agendamiento (capa a del modal + capa b del dock), sub-toggle de
//  solo-labs (desvío a openLabSoloModal), laboratorios, panel del
//  paciente, notificaciones (avisoUniversal y aviso del Anexo 5) y el
//  chip de la HC.
//
//  POR QUÉ el restrictivo nace apagado (regresión cazada por el banco):
//  el desvío de openAgendamientoModal es la PRIMERA línea tras la
//  compuerta del padre; con fail-open incondicional, el sub-toggle
//  habría desviado TODA la agenda a solo-labs sin que nadie lo pidiera
//  (53 comprobaciones en rojo). Un toggle que LIMITA el flujo histórico
//  solo puede activarse por decisión explícita del médico.
//
//  Identificadores 100 % sintéticos (DOC-1…DOC-5, 1001112223): cero
//  PHI, regla del proyecto.
// =====================================================================

const { instalarDomEnriquecido } = require("./harness");

// Padrón mínimo sintético: el uid 707 es COMPLETO (tiene agendar_control
// y agendar_labs). Mismo mecanismo que la suite 15.
const LISTA_ACCESO_93 = {
  version: "test-93.1",
  perfiles: {
    COMPLETO: [{ uid: 707, nombre: "Medico De Prueba Noventa Y Tres" }],
    LABORATORIOS: [],
  },
  blocklist: [],
};
const almacenAcceso93 = () => ({ vgl_acceso_lista: JSON.stringify(LISTA_ACCESO_93) });

module.exports = {
  nombre: "v18.6.1 (F3) — toggles de funcionalidad: registro, persistencia por médico y compuertas",
  cubre: [
    "togActiva", "togSet", "openAgendamientoModal", "openLabSoloModal",
    "openLaboratoriosModal", "openPanelPacienteModal", "avisoUniversal",
    "hcRenderChip", "_pendientesUniversales", "createAccionesDockUI",
  ],

  async pruebas(t, api, env, cargar) {
    function montar(opts) {
      const c = cargar(Object.assign({ silencioso: true }, opts));
      instalarDomEnriquecido(c.env.doc);
      return c;
    }
    // Selectores a nivel document (como la suite 91): el DOM enriquecido es una
    // lista plana de nodos y los open*Modal cablean con document.querySelector.
    function verSelectores(c) {
      const doc = c.env.doc;
      const matchea = (n, sel) => {
        if (!n || !n._parent || !n.tagName) return false;
        if (sel[0] === ".") return !!(n.classList && n.classList.contains(sel.slice(1)));
        if (sel[0] === "#") return n.id === sel.slice(1);
        return n.tagName === sel.toUpperCase();
      };
      doc.querySelector = (sel) => doc._nodos.find((n) => matchea(n, sel)) || null;
      doc.querySelectorAll = (sel) => doc._nodos.filter((n) => matchea(n, sel));
    }
    const identidad = (c, id) => {
      c.api.__state.activeDoctor.id = id;
      c.api.__state.activeDoctor.name = "MEDICO " + id;
    };
    const modalEn = (c, id) => c.env.doc.body.children.find((n) => n.id === id) || null;
    const APT = { doc_id: "1001112223", nombre: "PACIENTE DE PRUEBA NOVENTA Y TRES" };

    t.caso("togActiva: sin identidad todo nace activo SALVO el restrictivo (fail-open no aplica a limitaciones)", () => {
      const c = montar();
      t.cierto(c.api.togActiva("tog_agendar") === true, "agendar: activo");
      t.cierto(c.api.togActiva("tog_pacientes") === true, "panel del paciente: activo");
      t.cierto(c.api.togActiva("tog_laboratorios") === true, "laboratorios: activo");
      t.cierto(c.api.togActiva("tog_notif") === true, "notificaciones: activo");
      t.cierto(c.api.togActiva("tog_anexo5") === true, "aviso del Anexo 5: activo");
      t.cierto(c.api.togActiva("tog_hc_chip") === true, "chip de la HC: activo");
      t.cierto(c.api.togActiva("tog_agendar_labs") === false, "solo-labs (restrictivo): nace apagado");
      t.cierto(c.api.togActiva("clave_que_no_existe") === true, "clave inexistente: fail-open documentado");
    });

    t.caso("togSet/togActiva: persistencia por médico en clave propia — dos médicos no se pisan", () => {
      const c = montar();
      identidad(c, "DOC-1");
      t.cierto(c.api.togSet("tog_agendar", false) === true, "togSet confirma la escritura");
      t.cierto(c.api.readJSON("vgl_tog_DOC-1") && c.api.readJSON("vgl_tog_DOC-1").tog_agendar === false, "queda persistido bajo la clave del médico");
      t.cierto(c.api.togActiva("tog_agendar") === false, "el toggle apagado se respeta en caliente");
      identidad(c, "DOC-2");
      t.cierto(c.api.togActiva("tog_agendar") === true, "otro médico del equipo sigue con su default");
      t.cierto(!c.api.readJSON("vgl_tog_DOC-2"), "sin decisiones propias no hay clave escrita para él");
      identidad(c, "DOC-1");
      t.cierto(c.api.togSet("tog_agendar", true) === true && c.api.togActiva("tog_agendar") === true, "volver a encender restaura el flujo");
    });

    t.caso("togActiva (BOLT, rendimiento v18.13.1): memo por tick — misma lectura reutilizada dentro de tick(), invalidada por togSet, nunca fuera de la ventana", () => {
      const c = montar();
      identidad(c, "DOC-9");
      c.api.togSet("tog_agendar", true);
      t.cierto(c.api.togActiva("tog_agendar") === true, "arranca encendido");

      // Dentro de la ventana síncrona de un tick (state._enTickSync=true, calcada de
      // state._docTick): togActiva() memoiza el mapa de "vgl_tog_DOC-9".
      c.api.__state._enTickSync = true;
      t.cierto(c.api.togActiva("tog_agendar") === true, "primera lectura de la ventana: fresca");
      // Cambio DIRECTO del almacén sin pasar por togSet (simula otro proceso/pestaña
      // editando la clave): la memo NO debe verlo mientras dure la ventana del tick.
      c.api.writeJSON("vgl_tog_DOC-9", { tog_agendar: false });
      t.cierto(c.api.togActiva("tog_agendar") === true,
        "dentro de la MISMA ventana de tick, sigue viendo el valor memoizado, no el cambio directo del almacén");

      // togSet() SÍ invalida la memo — es el único punto de escritura legítimo.
      c.api.togSet("tog_agendar", false);
      t.cierto(c.api.togActiva("tog_agendar") === false, "togSet invalida la memo: la siguiente lectura ya ve su propio cambio");

      // Cierre de la ventana (equivalente al finally{} de tick()): fuera de ella, SIEMPRE fresco.
      c.api.__state._enTickSync = false;
      c.api.writeJSON("vgl_tog_DOC-9", { tog_agendar: true });
      t.cierto(c.api.togActiva("tog_agendar") === true, "fuera de la ventana de tick, togActiva vuelve a leer fresco siempre");
    });

    t.caso("jerarquía: un sub-toggle solo vive mientras su padre está encendido", () => {
      const c = montar();
      identidad(c, "DOC-3");
      t.cierto(c.api.togSet("tog_agendar_labs", true) === true, "el médico enciende la limitación");
      t.cierto(c.api.togActiva("tog_agendar_labs") === true, "con el padre activo, el hijo cuenta");
      t.cierto(c.api.togSet("tog_agendar", false) === true, "apaga el módulo completo");
      t.cierto(c.api.togActiva("tog_agendar_labs") === false, "el padre manda: el hijo no revive por su cuenta");
      t.cierto(c.api.readJSON("vgl_tog_DOC-3").tog_agendar_labs === true, "la decisión del hijo queda persistida para cuando el padre vuelva");
      t.cierto(c.api.togSet("tog_agendar", true) === true && c.api.togActiva("tog_agendar_labs") === true, "con el padre de vuelta, la decisión del hijo reaparece");
    });

    t.caso("openAgendamientoModal: con el módulo apagado corta en seco, sin modal y sin tocar capacidades", () => {
      const c = montar();
      identidad(c, "DOC-4");
      c.api.togSet("tog_agendar", false);
      t.igual(c.api.openAgendamientoModal(APT), false, "la compuerta devuelve false");
      t.falso(!!modalEn(c, "vgl-agendar-modal"), "no queda ningún modal montado");
    });

    await t.casoAsync("openAgendamientoModal: con el sub-toggle encendido desvía a la toma de muestras (solo-labs)", async () => {
      const c = montar({ almacen: almacenAcceso93() });
      identidad(c, "707");                                  // COMPLETO: agendar_control y agendar_labs
      c.api.togSet("tog_agendar_labs", true);
      c.api.markCitaAgendadaHoy("1001112223", "2026-08-20"); // sin cita agendada el flujo solo-labs avisa y no monta
      await t.noLanza(async () => await c.api.openAgendamientoModal(APT));
      const modal = modalEn(c, "vgl-agendar-modal");
      t.cierto(!!modal && modal.getAttribute("aria-labelledby") === "vgl-labsolo-title",
        "el modal montado es el ligero de solo-laboratorio, no el de agendamiento completo");
      t.cierto(!!modal && modal.innerHTML.indexOf('id="vgl-labsolo-title"') > 0, "el título de toma de muestras está pintado");
      // Invocación directa además del desvío: el `cubre` declara openLabSoloModal
      // y la cobertura por ejecución solo la anota si pasa por la api envuelta.
      await t.noLanza(async () => await c.api.openLabSoloModal(APT));
      const modal2 = modalEn(c, "vgl-agendar-modal");
      t.cierto(!!modal2 && modal2.getAttribute("aria-labelledby") === "vgl-labsolo-title",
        "la invocación directa monta el mismo modal ligero");
    });

    await t.casoAsync("openLaboratoriosModal y openPanelPacienteModal: compuertas apagadas cortan en seco", async () => {
      const c = montar();
      identidad(c, "DOC-5");
      c.api.togSet("tog_laboratorios", false);
      c.api.togSet("tog_pacientes", false);
      t.igual(await c.api.openLaboratoriosModal(APT), false, "laboratorios apagado: false sin leer nada");
      t.igual(await c.api.openPanelPacienteModal(APT), false, "panel del paciente apagado: false sin leer nada");
      t.falso(!!modalEn(c, "vgl-labs-modal") || !!modalEn(c, "vgl-ficha-modal"), "ningún modal quedó montado");
    });

    t.caso("avisoUniversal: con notificaciones apagadas no pinta nada", () => {
      const c = montar();
      identidad(c, "DOC-6");
      c.api.togSet("tog_notif", false);
      t.igual(c.api.avisoUniversal("PRUEBA", {}), false, "la compuerta corta antes de tocar el DOM");
    });

    t.caso("chip de la HC: con su toggle apagado se vacía y no pinta", () => {
      const c = montar();
      // El chip real vive DENTRO de #vgl-root (zona vgl-hc-zone); hcRenderChip
      // exige el root ANTES de la compuerta del toggle.
      const root = c.env.doc.createElement("div");
      root.id = "vgl-root";
      c.env.doc.body.appendChild(root);
      const zona = c.env.doc.createElement("div");
      zona.id = "vgl-hc-zone";
      root.appendChild(zona);
      const chip = c.env.doc.createElement("div");
      chip.id = "vgl-hc-chip";
      chip.innerHTML = "contenido viejo";
      zona.appendChild(chip);
      identidad(c, "DOC-7");
      c.api.togSet("tog_hc_chip", false);
      t.igual(c.api.hcRenderChip(), false, "el pintado queda apagado");
      t.igual(chip.innerHTML, "", "el chip viejo se vacía, no queda basura de otro turno");
    });

    t.caso("aviso del Anexo 5: con notificaciones apagadas el anexo no viaja en la vara (y con el sub-interruptor tampoco)", () => {
      // v18.14.3 (opción B del comité): el panel del anexo dentro de la HC se retiró. Lo
      // que el interruptor gobierna ahora es la sección del aviso de la jornada y su
      // repositorio 📋; la compuerta real vive en `_pendientesUniversales` (la vara única).
      const c = montar();
      verSelectores(c);
      identidad(c, "DOC-8");
      c.api.__state.pymAnexo5 = new Map([["1018888777", {
        prog: "HTA", ctrl: 46070, suma: 58, ekg: 0, m: [], v: [], rem: [],
      }]]);
      t.cierto(!!c.api._pendientesUniversales("1018888777").anexo5, "precondición: con los dos interruptores encendidos el anexo está en la vara");
      c.api.togSet("tog_notif", false);
      t.igual(c.api._pendientesUniversales("1018888777").anexo5, null, "el padre manda: sin notificaciones no hay anexo");
      c.api.togSet("tog_notif", true);
      c.api.togSet("tog_anexo5", false);
      t.igual(c.api._pendientesUniversales("1018888777").anexo5, null, "y con el sub-interruptor apagado tampoco");
      c.api.togSet("tog_anexo5", true);
      t.cierto(!!c.api._pendientesUniversales("1018888777").anexo5, "encendidos los dos, el anexo vuelve a la vara");
    });

    t.caso("capa b del dock: con el módulo apagado el botón Agendar ni se crea; al volver, reaparece", () => {
      const c = montar({ almacen: almacenAcceso93() });
      // Mock del módulo HCHealth (patrón de la suite 15): paciente visible por DOM.
      // Envolvemos el getElementById real (no lo reemplazamos): así el dock
      // existente se encuentra y se RE-PINTA en vez de crear un segundo dock.
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      const gEBI = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : gEBI(id));
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 1001112223", closest: () => null }] : []);
      identidad(c, "707");
      c.api.togSet("tog_agendar", false);
      t.noLanza(() => c.api.createAccionesDockUI());
      const dock = modalEn(c, "vgl-acciones-dock");
      t.cierto(!!dock, "el dock sigue existiendo");
      const btns = dock && dock.children.find((n) => n.className === "vgl-dock-btns");
      t.falso(!!(btns && btns.children.find((b) => b.getAttribute("data-accion") === "agendar")),
        "el botón Agendar no se crea con el módulo apagado");
      t.cierto(!!(btns && btns.children.find((b) => b.getAttribute("data-accion") === "labs")),
        "los demás botones del dock no dependen del toggle");
      c.api.togSet("tog_agendar", true);
      t.noLanza(() => c.api.createAccionesDockUI());
      const btns2 = modalEn(c, "vgl-acciones-dock").children.find((n) => n.className === "vgl-dock-btns");
      t.cierto(!!(btns2 && btns2.children.find((b) => b.getAttribute("data-accion") === "agendar")),
        "al volver a encenderlo, el botón reaparece");
    });
  },
};
