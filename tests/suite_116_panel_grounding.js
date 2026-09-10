"use strict";
// =====================================================================
//  SUITE 116 — SINCRONIZACIÓN DEL PANEL DEL PACIENTE CON EL GROUNDING
//  (frente 2: la firma del DOM se consume AL RECONCILIAR, no al leerla)
//
//  El Panel del Paciente vigila la historia: cada vuelta compara una FIRMA
//  de lo que hay en pantalla + archivo (`_tableroFirmaDom`) y, si cambió,
//  reclasifica (`mtrPanelFactoresDePantalla` → `mtrRecalcularConFactores`)
//  y repinta. El adelanto por escritura del médico (v18.8.8 FASE A) hace
//  que esa vuelta corra también <1 s después de teclear.
//
//  EL DEFECTO QUE ESTA SUITE FIJA: la firma se guardaba en `_firma` ANTES
//  de reconciliar. Si la reconciliación no se podía cerrar en ese instante
//  —la cabecera de Everest re-renderizando, que es JUSTO el momento en que
//  dispara el flush, o un resumen cacheado sin con qué recalcular— el
//  cambio quedaba marcado como «ya visto» sin haberse aplicado, y la vuelta
//  siguiente salía por `ahora === _firma`: el Panel se quedaba con la
//  clasificación vieja el resto de la consulta, en silencio. Una
//  actualización de estado PERDIDA, que es exactamente la desincronía que
//  el encargo pide corregir.
// =====================================================================

const RESUMEN_DEMO = {
  programa: "HTA",
  factores: { edad: 66, sexo: "F", pesoKg: 70, diabetes: true, hta: true },
  erc: { crcl: 58, egfr: 55, estadioAdministrativo: "G3a", estadioClinico: "G3a" },
  riesgo: { categoria: "ALTO", criterios: ["diabetes"], paso: 2, fuente: "regla del programa" },
  ultimos: { CREATININA: { valor: 1.1, fecha: "2026-08-01" } },
  medicamentos: ["LOSARTAN 50MG", "METFORMINA 850MG"],
  plan: { vencidos: [], faltantes: [] },
};

module.exports = {
  nombre: "Suite 116 · Panel del Paciente ↔ grounding: la firma del DOM se consume al reconciliar",
  cubre: ["openPanelPacienteModal", "mtrPanelFactoresDePantalla", "mtrRecalcularConFactores", "mtrPanelResumenAlAbrir", "mtrLeerFactoresRcvDelDom"],
  async pruebas(t, api, env, cargar) {
    const DOC = "1001112223";
    const accionesUX = (c) => {
      try { c.api._uxVolcarBuffer(); return (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {}; } catch (e) { return {}; }
    };
    // Mismo andamiaje que suite_104: el guard de apertura exige perfil COMPLETO.
    const _cargarBase = cargar;
    cargar = (opciones) => {
      const opts = Object.assign({}, opciones || {});
      if (!opts.almacen) opts.almacen = {};
      if (!("vgl_acceso_lista" in opts.almacen)) {
        opts.almacen.vgl_acceso_lista = JSON.stringify({
          version: "test-116.acceso",
          perfiles: { COMPLETO: [{ uid: 707, nombre: "Brandon Jesús Palencia Martínez" }], LABORATORIOS: [] },
          blocklist: [],
        });
      }
      const c = _cargarBase(opts);
      if (c && c.api && c.api.__state && !c.api.__state.activeDoctor.id) {
        c.api.__state.activeDoctor = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
      }
      return c;
    };
    // Paciente abierto legible (gate de extractPacienteAbierto) con un interruptor
    // para simular la cabecera de Everest a medio re-renderizar.
    const montarHistoria = (c) => {
      const gEBI = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : gEBI(id));
      const qs = c.env.doc.querySelector;
      c.env.doc.querySelector = (sel) => (sel === "app-index" ? null : qs(sel));
      const est = { transitorio: false, lecturas: 0 };
      c.env.doc.querySelectorAll = (sel) => {
        if (sel !== ".text-muted") return [];
        est.lecturas++;
        // Transitorio: la PRIMERA lectura de la vuelta ve la cédula (la firma se puede
        // construir) y la segunda no (la cabecera ya se está re-renderizando) — el
        // instante exacto que dispara el flush de la escritura del médico.
        if (est.transitorio && est.lecturas > 1) return [];
        return [{ textContent: "CC " + DOC, closest: () => null }];
      };
      return est;
    };
    const abrirPanel = async (c) => {
      const base = c.env.doc.createElement;
      c.env.doc.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, base("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      await c.api.openPanelPacienteModal({ doc_id: DOC, nombre: "PACIENTE DE PRUEBA" }, { seccion: "resumen" });
      return c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal") || null;
    };

    await t.casoAsync("PANEL·1 — un cambio de grounding que no se puede reconciliar en el instante NO se marca como visto (se reintenta y SÍ repinta)", async () => {
      const c = await cargar({ silencioso: true });
      const est = montarHistoria(c);
      // Grounding: factores ARCHIVADOS (lo que el médico marcó en la historia).
      c.api._vglCosechaGuardar(DOC, { factores: { hta: { v: true, ts: 1 } } });
      c.api.mtrCacheResumenGuardar(DOC, RESUMEN_DEMO);
      const modal = await abrirPanel(c);
      t.cierto(!!modal, "montaje: el Panel abre");
      const vig = c.api._vglPanelVigilanteEstado();
      t.igual(typeof vig, "function", "montaje: el panel quedó registrado como vigilante");

      // El médico documenta un factor NUEVO en la historia → la firma cambia.
      c.api._vglCosechaGuardar(DOC, { factores: { hta: { v: true, ts: 1 }, tabaquismo: { v: true, ts: 1 } } });

      // Vuelta 1: la cabecera está a medio re-renderizar (la firma se lee, los factores no).
      est.transitorio = true;
      est.lecturas = 0;
      t.noLanza(() => vig(), "la vuelta con la cabecera a medio pintar no revienta");
      const trasFallida = accionesUX(c);
      t.cierto(trasFallida["fn.panel.reclasificado"] === undefined,
        "montaje: esa vuelta NO reclasificó (no había factores que leer) — si no, la prueba no mediría nada");

      // Vuelta 2: la cabecera ya está pintada. El cambio debe seguir PENDIENTE.
      est.transitorio = false;
      est.lecturas = 0;
      t.noLanza(() => vig(), "la vuelta siguiente corre sin lanzar");
      const acc = accionesUX(c);
      t.igual(acc["fn.panel.reclasificado"], 1,
        "el cambio se reconcilia en la vuelta siguiente: la firma se consumió al repintar, no al leerla");
    });

    await t.casoAsync("PANEL·2 — tras el reintento que sí repinta, la vigilancia se detiene: reintentar no es repintar de más", async () => {
      const c = await cargar({ silencioso: true });
      const est = montarHistoria(c);
      c.api._vglCosechaGuardar(DOC, { factores: { hta: { v: true, ts: 1 } } });
      c.api.mtrCacheResumenGuardar(DOC, RESUMEN_DEMO);
      await abrirPanel(c);
      const vig = c.api._vglPanelVigilanteEstado();
      c.api._vglCosechaGuardar(DOC, { factores: { hta: { v: true, ts: 1 }, sedentarismo: { v: true, ts: 1 } } });

      est.transitorio = true; est.lecturas = 0;
      vig();                                        // falla: no se pudo leer la pantalla
      est.transitorio = false; est.lecturas = 0;
      vig();                                        // reintenta y repinta
      t.igual(accionesUX(c)["fn.panel.reclasificado"], 1, "el reintento repinta UNA vez");
      vig(); vig();                                 // ya no hay nada nuevo que ver
      t.igual(accionesUX(c)["fn.panel.reclasificado"], 1,
        "y se detiene: la firma avanzó al repintar, así que reintentar no se vuelve un bucle de repintados");
    });
  },
};
