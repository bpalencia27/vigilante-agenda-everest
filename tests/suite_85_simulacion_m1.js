// =====================================================================
//  SUITE 85 — SIMULACIÓN DE FLUJOS M1 (SF-02): ESCENARIO R0 DEL MÉDICO
// ---------------------------------------------------------------------
//  Primer caso del encargo SUPERPROMPT_SIMULACION_FLUJOS (§6, R0):
//  «accede al modal [de agendamiento], selecciona inicialmente las
//  opciones "control médico + labs", elige un plazo de 1 mes en el
//  calendario, luego retrocede en sus acciones, modifica su selección
//  para elegir solo "control médico", actualiza el plazo a 3 meses,
//  selecciona una fecha concreta y confirma la acción haciendo clic en
//  el botón de aceptar.»
//
//  Se simula contra el DOM REAL del arnés (enriquecedor compartido del
//  arnés, SF-01) y contra los rótulos REALES de la UI: la card dice
//  «Control Médico + Toma de Labs» (data-que="control_lab") y «SOLO
//  Control Médico» (data-que="control"); el botón de aceptar es
//  #vgl-agm-confirm. Las fechas parten de HOY con las funciones de
//  negocio (calcBusinessTargetDate, calcRangoSondeoIso).
//
//  La confirmación usa un mock de AsignarTurno con radicado > 0
//  (confirmación real según §5.1 F5) y cuenta las peticiones: la cita
//  se crea UNA sola vez y la marca antiduplicado solo se escribe tras
//  esa confirmación.
// =====================================================================

module.exports = {
  nombre: "Suite 85 · Simulación M1: R0 del médico",
  cubre: ["openAgendamientoModal", "calcBusinessTargetDate", "calcRangoSondeoIso", "isCitaAgendadaHoy"],
  async pruebas(t, api, env, cargar) {
    // v18.1.0 — B3.3: el guard de openAgendamientoModal exige perfil
    // COMPLETO. Se siembra vgl_acceso_lista + identidad (patrón suite_73).
    const _cargarAccesoBase = cargar;
    cargar = (opciones) => {
      const opts = Object.assign({}, opciones || {});
      if (!opts.almacen) opts.almacen = {};
      if (!("vgl_acceso_lista" in opts.almacen)) {
        opts.almacen.vgl_acceso_lista = JSON.stringify({
          version: "test-85.acceso",
          perfiles: {
            COMPLETO: [
              { uid: 707, nombre: "Brandon Jesús Palencia Martínez" },
              { uid: 102, nombre: "Eliseth Estrada" },
            ],
            LABORATORIOS: [],
          },
          blocklist: [],
        });
      }
      const c = _cargarAccesoBase(opts);
      if (c && c.api && c.api.__state && !c.api.__state.activeDoctor.id) {
        c.api.__state.activeDoctor = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
      }
      return c;
    };

    // Enriquecedor y disparador compartidos del arnés (SF-01).
    const { instalarDomEnriquecido, disparar: dispararComun } = require("./harness.js");
    const disparar = (nodo, tipo) => dispararComun(nodo, tipo, "[suite_85]");
    const esperar = (ms) => new Promise((res) => setTimeout(res, ms));

    const respuestaJson = (obj) => async () => ({
      ok: true, status: 200,
      headers: { get: () => null },
      json: async () => obj,
      text: async () => JSON.stringify(obj),
      clone() { return this; },
    });

    // Router de red de la simulación: los turnos son ESTABLES por fecha
    // (mismos turnoId en el sondeo inicial y en la verificación fresca
    // pre-confirmación — si los ids cambiaran entre llamadas, el modal
    // declararía "cupo perdido" y la cita no se crearía nunca).
    // AsignarTurno cuenta sus llamadas: R0 exige exactamente UNA.
    function routerFetch(cfg) {
      const c = cfg || {};
      const TURNOS_FIJOS = [
        { turnoId: 901, horaTexto: "08:00 AM", estado: "ACT" },
        { turnoId: 902, horaTexto: "08:30 AM", estado: "ACT" },
        { turnoId: 903, horaTexto: "09:00 AM", estado: "ACT" },
      ];
      return async (url) => {
        const u = String(url);
        c.llamadas = c.llamadas || {};
        c.llamadas[u.split("?")[0].split("/").pop() || u] = (c.llamadas[u.split("?")[0].split("/").pop() || u] || 0) + 1;
        if (u.includes("AsignarTurno")) {
          c.asignarCount = (c.asignarCount || 0) + 1;
          return respuestaJson({ error: false, data: { radicado: 4567, motivo: "Agendada Correctamente" } })();
        }
        if (u.includes("BuscarPacienteDetallado")) {
          return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [], eps: { nombre: "EPS" }, nombreCompleto: "PACIENTE PRUEBA" } })();
        }
        if (u.includes("BuscarPaciente")) {
          return respuestaJson({ data: { id: 777 } })();
        }
        if (u.includes("BuscarCitasDisponibles")) {
          const mF = u.match(/FechaDeseada=(\d{4}-\d{2}-\d{2})/);
          const iso = mF ? mF[1] : null;
          if (iso && Array.isArray(c.sinAgendaEn) && c.sinAgendaEn.includes(iso)) {
            return respuestaJson({ agendas: [] })();
          }
          const fechaAgenda = iso ? iso.split("-").reverse().join("/") : "01/01/2026";
          const medico = c.medicoPorIso ? c.medicoPorIso(iso) : "ANA MARIA PEREZ";
          return respuestaJson({ agendas: [{ agendaId: 55, medico: medico, fechaAgenda: fechaAgenda, sede: "CMB" }] })();
        }
        if (u.includes("AgdValidarAgenda")) {
          return respuestaJson({ data: { isError: false } })();
        }
        if (u.includes("ObtenerTurnos") && !u.includes("PorFecha")) {
          return respuestaJson({ turnos: TURNOS_FIJOS.slice() })();
        }
        return respuestaJson({ data: {} })();
      };
    }

    function routerGmxhr() {
      return (o) => {
        const u = String((o && o.url) || "");
        if (u.includes("ObtenerTurnosPorFecha")) {
          setTimeout(() => {
            try { o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ hora: "06:30:00" }] }) }); }
            catch (e) { console.error("[suite_85] onload simulado falló:", e && e.message); }
          }, 0);
          return;
        }
        setTimeout(() => {
          try { if (o && typeof o.onerror === "function") o.onerror(new Error("gmxhr: url no simulada")); }
          catch (e) { /* el router jamás propaga */ }
        }, 0);
      };
    }

    const montar = (cfg) => {
      const c = cargar({ silencioso: true, fetch: routerFetch(cfg), gmxhr: routerGmxhr() });
      instalarDomEnriquecido(c.env.doc);
      try { c.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" }; } catch (e) { /* forma del estado ya fijada */ }
      return c;
    };

    const abrir = async (r) => {
      r.api.openAgendamientoModal({ doc_id: "5150076", nombre: "PACIENTE PRUEBA" });
      await esperar(180);
      return r.env.doc.getElementById("vgl-agendar-modal");
    };

    // Invariante transversal (§5.3): marca única en cada eje de selección.
    const estadoCoherente = (t, modal, etiqueta) => {
      const qsa = (sel) => modal.querySelectorAll(sel);
      const plazosAct = qsa("#vgl-time-presets .vgl-agm-pbtn.active");
      t.cierto(plazosAct.length <= 1, etiqueta + ": a lo sumo un plazo activo (hubo " + plazosAct.length + ")");
      const dias = qsa("#vgl-day-chips .vgl-agm-pbtn");
      if (dias.length) {
        t.igual(dias.filter((d) => d.classList.contains("active")).length, 1, etiqueta + ": exactamente un día activo");
      }
      t.igual(qsa("#vgl-esp-presets .active").length, 1, etiqueta + ": exactamente una especialidad activa");
      t.igual(qsa("#vgl-agm-que .vgl-type-card.active").length, 1, etiqueta + ": exactamente un tipo de cita activo");
      const slotsAct = qsa("#vgl-agm-slots .vgl-agm-sbtn.active");
      t.cierto(slotsAct.length <= 1, etiqueta + ": a lo sumo un turno activo (hubo " + slotsAct.length + ")");
      const tomasAct = qsa("#vgl-lab-day-chips .vgl-agm-pbtn.active");
      t.cierto(tomasAct.length <= 1, etiqueta + ": a lo sumo un chip de toma activo (hubo " + tomasAct.length + ")");
    };

    const textoDe = (n) => String(n.textContent || "").trim();
    const chipsDia = (m) => [...m.querySelectorAll("#vgl-day-chips .vgl-agm-pbtn")];
    const activosDia = (m) => chipsDia(m).filter((c) => c.classList.contains("active"));
    const esperables = (items) => items.map((it) => it.isCenter ? it.shortLbl + " 🎯" : it.shortLbl).join(" | ");
    const chipDe = (m, item) => chipsDia(m).find((c) => textoDe(c) === item.shortLbl || textoDe(c) === item.shortLbl + " 🎯");
    const cardDe = (m, que) => m.querySelector('.vgl-type-card[data-que="' + que + '"]');
    const btnPlazo = (m, mm, dd) => [...m.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn")]
      .find((b) => b.getAttribute("data-m") === String(mm) && b.getAttribute("data-d") === String(dd));

    // ------------------------------------------------------------------
    //  R0 — EL ESCENARIO SEMILLA DEL MÉDICO, PALABRA POR PALABRA (§6)
    //  Clases encadenadas F2 (modificación) + F3 (retroceso) + F5
    //  (confirmación con mock de confirmación real, radicado > 0).
    // ------------------------------------------------------------------
    await t.casoAsync("R0 · control+labs → 1 mes → retroceder → solo control → 3 meses → fecha concreta → aceptar", async () => {
      const cfg = {};
      const r = montar(cfg);

      // PASO 1 · Abrir el modal: montado una sola vez, perfil COMPLETO,
      // sin selección previa residual.
      const modal = await abrir(r);
      t.cierto(!!modal, "R0.1: el modal quedó montado en el documento");
      if (!modal) return;
      // El querySelectorAll del document del arnés solo implementa el
      // selector especial [id^='vgl-']: se cuenta por ahí (nodos vivos,
      // con _parent — los desmontados quedan sin _parent).
      const modalesVivos = r.env.doc.querySelectorAll("[id^='vgl-']")
        .filter((n) => n.id === "vgl-agendar-modal" && n._parent);
      t.igual(modalesVivos.length, 1, "R0.1: montado exactamente una vez");
      t.cierto(r.api.accesoCap ? r.api.accesoCap("agendar_control") !== false : true,
        "R0.1: el perfil sembrado permite agendar_control");
      t.igual(modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn.active").length, 0,
        "R0.1: sin plazo residual de sesiones anteriores");
      t.falso(r.api.isCitaAgendadaHoy("5150076"), "R0.1: sin marca antiduplicado previa (casilla limpia)");
      estadoCoherente(t, modal, "R0.1 apertura");

      // PASO 2 · «control médico + labs»: la card real es
      // «Control Médico + Toma de Labs» (data-que="control_lab") y es la
      // que la UI trae activa por defecto; el médico la REAFIRMA con clic.
      const cardCL = cardDe(modal, "control_lab");
      t.cierto(!!cardCL, "R0.2: existe la card «Control Médico + Toma de Labs»");
      if (!cardCL) return;
      disparar(cardCL, "click");
      await esperar(120);
      t.cierto(cardCL.classList.contains("active"), "R0.2: «control médico + labs» queda activa");
      t.igual(modal.querySelectorAll("#vgl-agm-que .vgl-type-card.active").length, 1,
        "R0.2: exactamente una card activa tras el clic");
      estadoCoherente(t, modal, "R0.2 tipo control+labs");

      // PASO 3 · Plazo de 1 mes (en el paso 2, tras «Siguiente»).
      const step1Next = modal.querySelector("#vgl-step-1-next");
      t.cierto(!!step1Next, "R0.3: existe el botón «Siguiente» del paso 1");
      if (!step1Next) return;
      disparar(step1Next, "click");
      await esperar(200);
      const btn1m = btnPlazo(modal, 1, 0);
      t.cierto(!!btn1m, "R0.3: existe el plazo de 1 mes");
      if (!btn1m) return;
      disparar(btn1m, "click");
      await esperar(250);
      const rango1m = r.api.calcRangoSondeoIso(r.api.calcBusinessTargetDate(1, 0).iso);
      const centro1m = rango1m.find((it) => it.isCenter);
      t.igual(modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn.active").length, 1,
        "R0.3: exactamente un plazo marcado (1 mes)");
      t.cierto(btn1m.classList.contains("active"), "R0.3: la marca de plazo es la de 1 mes");
      t.igual(chipsDia(modal).length, rango1m.length,
        "R0.3: el rango de días es el que la función de negocio calcula para 1 mes desde hoy");
      const activos1m = activosDia(modal);
      t.igual(activos1m.length, 1, "R0.3: un solo día activo");
      if (centro1m && activos1m.length) {
        t.igual(textoDe(activos1m[0]), centro1m.shortLbl + " 🎯", "R0.3: el día activo es el centro del rango de 1 mes");
      }
      // Con control+labs, el eje toma debe estar presente (chips de toma).
      const chipsToma1m = modal.querySelectorAll("#vgl-lab-day-chips .vgl-agm-pbtn").length;
      t.cierto(chipsToma1m > 0, "R0.3: con control+labs hay chips de toma de muestras (eje labs visible)");

      // PASO 4 · RETROCEDER sin confirmar: «↩ Atrás» del paso 2 al 1.
      // Contrato observado: la elección de plazo/día VIVE en el closure del
      // modal (no se borra al volver); el paso 1 vuelve a mostrarse con sus
      // marcas intactas. Nada se confirma (§6: retroceso SIN confirmar).
      const step2Back = modal.querySelector("#vgl-step-2-back");
      t.cierto(!!step2Back, "R0.4: existe el botón «↩ Atrás» del paso 2");
      if (!step2Back) return;
      disparar(step2Back, "click");
      await esperar(150);
      const v1 = modal.querySelector("#vgl-step-view-1");
      const v2 = modal.querySelector("#vgl-step-view-2");
      t.igual(v1 && v1.style.display, "block", "R0.4: al retroceder se ve el paso 1");
      t.igual(v2 && v2.style.display, "none", "R0.4: el paso 2 queda oculto");
      t.igual(modal.querySelectorAll("#vgl-agm-que .vgl-type-card.active").length, 1,
        "R0.4: la card de tipo sigue siendo la única marca del paso 1");
      t.cierto(cardCL.classList.contains("active"), "R0.4: «control médico + labs» sigue activa tras el retroceso");
      t.falso(r.api.isCitaAgendadaHoy("5150076"), "R0.4: el retroceso NO confirmó nada (sin marca antiduplicado)");
      t.cierto((cfg.asignarCount || 0) === 0, "R0.4: cero peticiones AsignarTurno hasta aquí");

      // PASO 5 · Desmarcar «labs»: elegir «SOLO Control Médico». Contrato
      // REAL observado (L27894-27897 de producción): la sección de toma
      // (.vgl-lab-box) se OCULTA (display:none) — no se desmonta. El
      // literal del §6 pedía «desaparece de TODO el estado»; el eje labs
      // desaparece de la VISTA y de la confirmación (isLabChecked exige
      // control_lab), pero los chips ocultos quedan en el DOM con su
      // marca activa: se registra como DESV en el registro de
      // simulaciones (S-0005), no se tapa aquí.
      const cardC = cardDe(modal, "control");
      t.cierto(!!cardC, "R0.5: existe la card «SOLO Control Médico»");
      if (!cardC) return;
      disparar(cardC, "click");
      await esperar(120);
      t.cierto(cardC.classList.contains("active"), "R0.5: «SOLO Control Médico» queda activa");
      t.falso(cardCL.classList.contains("active"), "R0.5: «control médico + labs» queda desactivada");
      t.igual(modal.querySelectorAll("#vgl-agm-que .vgl-type-card.active").length, 1,
        "R0.5: exactamente una card activa (sin estados dobles)");
      disparar(step1Next, "click");
      await esperar(250);
      const labBox = modal.querySelector(".vgl-lab-box");
      t.cierto(!!labBox, "R0.5: existe la sección de toma (.vgl-lab-box)");
      if (labBox) {
        t.igual(labBox.style.display, "none",
          "R0.5: con solo-control la sección de toma queda OCULTA (contrato real de producción)");
      }

      // PASO 6 · Plazo → 3 meses. Recálculo total: la marca de «1 mes»
      // NO coexiste con la de «3 meses».
      const btn3m = btnPlazo(modal, 3, 0);
      t.cierto(!!btn3m, "R0.6: existe el plazo de 3 meses");
      if (!btn3m) return;
      disparar(btn3m, "click");
      await esperar(250);
      const rango3m = r.api.calcRangoSondeoIso(r.api.calcBusinessTargetDate(3, 0).iso);
      const centro3m = rango3m.find((it) => it.isCenter);
      const plazosMarcados = [...modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn.active")];
      t.igual(plazosMarcados.length, 1, "R0.6: exactamente un plazo activo (sin coexistencia 1 mes / 3 meses)");
      if (plazosMarcados.length) {
        t.igual(plazosMarcados[0].getAttribute("data-m"), "3", "R0.6: el plazo activo es 3 meses");
      }
      t.falso(btn1m.classList.contains("active"), "R0.6: la marca de «1 mes» NO sigue activa");
      t.igual(chipsDia(modal).map(textoDe).join(" | "), esperables(rango3m),
        "R0.6: los días se recalcularon al rango de 3 meses");

      // PASO 7 · Fecha concreta del rango de 3 meses (no centro, no
      // sábado): un solo día activo, dentro del rango recalculado.
      const objetivo = rango3m.find((it) => !it.isCenter && !it.esSabado);
      const chipObj = objetivo && chipDe(modal, objetivo);
      t.cierto(!!chipObj, "R0.7: hay una fecha concreta elegible en el rango de 3 meses");
      if (!chipObj) return;
      disparar(chipObj, "click");
      await esperar(350);
      const activos7 = activosDia(modal);
      t.igual(activos7.length, 1, "R0.7: un solo día activo tras elegir la fecha concreta");
      if (activos7.length) {
        t.igual(textoDe(activos7[0]), objetivo.shortLbl, "R0.7: el día activo es la fecha concreta elegida (sin 🎯: elección del médico)");
      }
      t.cierto(rango3m.some((it) => it.iso === objetivo.iso), "R0.7: la fecha elegida pertenece al rango recalculado de 3 meses");
      estadoCoherente(t, modal, "R0.7 fecha concreta");

      // PASO 8 · Clic en aceptar: elegir turno → #vgl-agm-confirm → UNA
      // sola AsignarTurno con radicado > 0; marca antiduplicado SOLO
      // ahora; cierre limpio; reabrir muestra el aviso de cita previa.
      const slot0 = modal.querySelector("#vgl-agm-slots .vgl-agm-sbtn");
      t.cierto(!!slot0, "R0.8: hay turnos disponibles para la fecha elegida");
      if (!slot0) return;
      disparar(slot0, "click");
      await esperar(120);
      const confirmBtn = modal.querySelector("#vgl-agm-confirm");
      t.cierto(!!confirmBtn, "R0.8: existe el botón de aceptar (#vgl-agm-confirm)");
      if (!confirmBtn) return;
      t.cierto(confirmBtn.disabled === false, "R0.8: aceptar habilitado con turno elegido");
      t.cierto(String(confirmBtn.textContent).includes("Crear Cita"), "R0.8: el botón de aceptar anuncia la creación de la cita");
      disparar(confirmBtn, "click");
      await esperar(600);
      t.igual(cfg.asignarCount || 0, 1, "R0.8: exactamente UNA petición AsignarTurno (sin duplicados)");
      t.cierto(r.api.isCitaAgendadaHoy("5150076"),
        "R0.8: la marca antiduplicado se escribió SOLO tras la confirmación real (radicado > 0)");
      t.cierto(String(confirmBtn.textContent).includes("Cita Creada") || !r.env.doc.getElementById("vgl-agendar-modal"),
        "R0.8: el acuse de cita creada es visible (botón o cierre del modal)");

      // Reapertura (F6): mismo paciente → el aviso de cita previa de hoy
      // aparece; la preferencia confirmada (solo control) se recuerda.
      const btnX = modal.querySelector("#vgl-agm-x");
      if (btnX) { disparar(btnX, "click"); await esperar(150); }
      const modal2 = await abrir(r);
      t.cierto(!!modal2, "R0.reapertura: el modal reabre");
      if (!modal2) return;
      const banner = modal2.querySelector("#vgl-agm-undo-banner");
      t.cierto(!!banner && banner.style.display === "flex",
        "R0.reapertura: el aviso «ya tiene una cita de control registrada hoy» es visible");
      const cardActivaReap = modal2.querySelector("#vgl-agm-que .vgl-type-card.active");
      t.cierto(!!cardActivaReap && cardActivaReap.getAttribute("data-que") === "control",
        "R0.reapertura: la preferencia confirmada (SOLO control) se recuerda al reabrir");
      estadoCoherente(t, modal2, "R0.reapertura");
      t.igual(cfg.asignarCount || 0, 1, "R0.reapertura: reabrir NO creó ninguna cita adicional (sigue 1 AsignarTurno)");
    });

  },
};
