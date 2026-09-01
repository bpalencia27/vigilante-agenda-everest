// =====================================================================
//  SUITE 61 — v15.8.0: sugerencia por vigencias (N3), primer cupo (N1),
//             semáforo de salud (N2), vista previa del SMS (N4) y
//             tamaño de letra (N5)
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que la fecha que el asistente
//  propone respete SIEMPRE la elección del médico salvo cuando un examen
//  del programa rector vencería antes — y que entonces lo diga con nombre
//  propio, sin mover nada por su cuenta.
//
//  Las decisiones vienen de la entrevista del 20-08-2026:
//   · «toma al vencer + control después» (estilo FTL, CERO VENCIDOS);
//   · al abrir, la sugerencia llega preseleccionada (plazo incluido);
//   · el agendamiento calcula el análisis solo si falta;
//   · la vista previa del SMS jamás inventa redacción oficial.
// =====================================================================
module.exports = {
  nombre: "v15.8.0 — vigencias×plazo, primer cupo, semáforo, SMS y letra",
  cubre: [
    "mtrIsoAFechaAgenda", "mtrListaDiasBusquedaCupo", "mtrPlazoMasCercano",
    "mtrSugerenciaPorPlazo", "_smsVistaPrevia", "_fzZoomDe", "aplicarTamanoLetra",
    "_saludMarca", "_saludEstado", "_saludHayAlerta", "_saludGlobitoHtml",
    "_saludGlobitoToggle", "_getAtheneaLabsAutoNucleo",
  ],

  async pruebas(t, api, env, cargar) {
    // Instancia propia (por el cargador instrumentado del runner): las marcas de salud
    // y la hoja de estilo del tamaño de letra no deben contaminar a las otras suites.
    const c = cargar({ silencioso: true });
    const a = c.api;

    // ============ N3 · utilidades de fecha ============

    t.caso("mtrIsoAFechaAgenda: ISO -> dd/mm/yyyy CON ceros (el formato exacto de fechaAgenda)", () => {
      t.igual(a.mtrIsoAFechaAgenda("2026-08-25"), "25/08/2026", "fecha normal");
      t.igual(a.mtrIsoAFechaAgenda("2026-01-05"), "05/01/2026", "día y mes de un dígito conservan el cero");
      t.igual(a.mtrIsoAFechaAgenda("no-es-fecha"), "", "entrada rota devuelve cadena vacía, no basura");
    });

    t.caso("mtrListaDiasBusquedaCupo: arranca MAÑANA, salta domingos y festivos, incluye sábados", () => {
      // 2026-12-24 es jueves; el 25 (Navidad, festivo) debe saltarse; el 26 es sábado.
      const dias = a.mtrListaDiasBusquedaCupo("2026-12-24", 10);
      t.igual(dias.length, 10, "respeta el tope pedido");
      t.falso(dias.includes("2026-12-24"), "el propio día no cuenta: se busca desde mañana");
      t.falso(dias.includes("2026-12-25"), "Navidad (festivo) fuera");
      t.falso(dias.includes("2026-12-27"), "domingo fuera");
      t.cierto(dias.includes("2026-12-26"), "el sábado SÍ entra: su agenda propia decide si aplica");
      t.igual(dias[0], "2026-12-26", "el primer candidato es el primer día no-festivo desde mañana");
    });

    t.caso("mtrListaDiasBusquedaCupo: el tope se acota (nunca un barrido sin fin contra Everest)", () => {
      t.igual(a.mtrListaDiasBusquedaCupo("2026-08-20", 500).length, 60, "techo duro de 60");
      t.igual(a.mtrListaDiasBusquedaCupo("2026-08-20", 0).length, 1, "piso de 1");
      t.igual(a.mtrListaDiasBusquedaCupo("fecha-rota", 10).length, 0, "entrada rota = lista vacía, sin excepción");
    });

    t.caso("mtrPlazoMasCercano: la fecha sugerida se traduce al plazo del médico más próximo", () => {
      t.igual(a.mtrPlazoMasCercano("2026-11-19", "2026-08-20").m, 3, "a ~91 días le queda «3 meses»");
      const p15 = a.mtrPlazoMasCercano("2026-09-04", "2026-08-20");
      t.igual(p15.m, 0, "a 15 días le queda el plazo corto (m=0)");
      t.igual(p15.d, 15, "…con sus 15 días");
      t.igual(a.mtrPlazoMasCercano("2027-06-01", "2026-08-20").m, 6, "más allá de todo, el techo es «6 meses»");
      t.igual(a.mtrPlazoMasCercano("rota", "2026-08-20"), null, "entrada rota = null");
    });

    // ============ N3 · la regla completa: elección del médico × vigencias ============

    const planVigente = {
      ftl: "2026-11-20", ftlSinAjustar: "2026-11-20",
      control: { fecha: "2026-11-27", motivo: "primer día hábil a >=4 días de la toma" },
      vencidos: [], faltantes: [],
      drivers: [
        { clave: "CREATININA", nombre: "Creatinina sérica", estado: "D", vence: "2026-11-20" },
        { clave: "HBA1C", nombre: "Hemoglobina glicosilada", estado: "D", vence: "2027-01-10" },
      ],
      pasajeros: [],
    };

    t.caso("N3: si al plazo elegido TODO sigue vigente, se respeta el plazo del médico tal cual", () => {
      const s = a.mtrSugerenciaPorPlazo(planVigente, null, "2026-09-21", "2026-08-20", "ERC");
      t.cierto(!!s, "hay sugerencia");
      t.falso(s.ajustada, "sin ajuste: manda el médico");
      t.igual(s.iso, "2026-09-21", "la fecha es exactamente la del plazo elegido");
      t.cierto(s.motivo.includes("Se respeta su plazo"), "y el porqué lo dice en una frase");
      t.cierto(s.motivo.includes("programa ERC"), "nombrando el programa rector");
    });

    t.caso("N3: si un examen vencería antes del plazo, manda el sistema FTL — toma al vencer + control después", () => {
      const s = a.mtrSugerenciaPorPlazo(planVigente, null, "2027-01-15", "2026-08-20", "ERC");
      t.cierto(s.ajustada, "hay ajuste");
      t.igual(s.iso, "2026-11-27", "el control aterriza en la fecha de control del plan (tras la toma)");
      t.igual(s.ftl, "2026-11-20", "la toma va en el vencimiento más próximo (CERO VENCIDOS)");
      t.cierto(s.motivo.includes("Creatinina sérica"), "el porqué nombra al examen que manda");
      t.cierto(s.motivo.includes("llegaría vencido"), "…y explica la consecuencia en lenguaje de consultorio");
    });

    t.caso("N3: el día exacto del vencimiento todavía cuenta como vigente (borde inclusivo)", () => {
      const s = a.mtrSugerenciaPorPlazo(planVigente, null, "2026-11-20", "2026-08-20", "ERC");
      t.falso(s.ajustada, "objetivo == vencimiento más próximo: aún no hay nada vencido ese día");
    });

    t.caso("N3: con deuda YA (vencidos/faltantes), cualquier plazo se ajusta a labs-primero", () => {
      const planDeuda = Object.assign({}, planVigente, {
        ftl: "2026-09-03", control: { fecha: "2026-09-10" },
        vencidos: [{ clave: "RAC", nombre: "Relación albúmina/creatinina", estado: "A", subestado: "vencido" }],
      });
      const s = a.mtrSugerenciaPorPlazo(planDeuda, null, "2026-09-01", "2026-08-20", "DM2");
      t.cierto(s.ajustada, "aunque el plazo del médico sea más corto que la toma, la deuda manda");
      t.igual(s.iso, "2026-09-10", "control tras la toma");
      // v16.2.8 — El texto ya no dice solo "hay exámenes vencidos o sin resultado": ahora
      // los NOMBRA (reporte del médico: "sale que hay examen vencido pero no dice cuál").
      t.cierto(s.motivo.includes("exámenes pendientes"), "el porqué dice que hay deuda");
      t.cierto(/Vencido|Nunca se le ha/.test(s.motivo), "y dice de CUÁL se trata, no solo cuántos");
      t.cierto(Array.isArray(s.vencidosNombres) && Array.isArray(s.faltantesNombres),
        "los nombres también viajan en el objeto, para quien quiera pintarlos aparte");
      // Antes se comprobaba el conteo ("1 vencido"). Nombrarlos es estrictamente mejor:
      // el conteo obligaba al médico a abrir otro módulo para saber de cuál se trataba.
      t.igual(s.vencidosNombres.length + s.faltantesNombres.length >= 1, true, "…y hay al menos uno");
    });

    t.caso("N3: cuando labs-primero ya afinó la toma con cupos reales, la regla usa ESA toma", () => {
      const lp = { activa: true, labIso: "2026-09-07", labMinIso: "2026-09-03", labMaxIso: "2026-09-10" };
      const s = a.mtrSugerenciaPorPlazo(planVigente, lp, "2027-01-15", "2026-08-20", "ERC");
      t.igual(s.ftl, "2026-09-07", "manda la toma afinada");
      t.igual(s.iso, a.mtrControlDesdeLabs("2026-09-07"), "y el control cuelga de ella (+7 al hábil)");
    });

    t.caso("N3: sin exámenes que vigilar, el plazo del médico manda y se dice por qué", () => {
      const s = a.mtrSugerenciaPorPlazo({ ftl: null, vencidos: [], faltantes: [], drivers: [], pasajeros: [] },
        null, "2026-10-20", "2026-08-20", "HTA");
      t.falso(s.ajustada, "sin vigilables no hay ajuste posible");
      t.igual(s.iso, "2026-10-20", "fecha = plazo elegido");
      t.cierto(s.motivo.includes("no exige exámenes"), "el porqué es honesto");
      t.igual(a.mtrSugerenciaPorPlazo(null, null, "2026-10-20", "2026-08-20", ""), null, "sin plan = null (el modal muestra su pista honesta)");
    });

    t.caso("N3 de punta a punta: un plan REAL de mtrPlanParaclinicos pasa por la regla sin fisuras", () => {
      const plan = a.mtrPlanParaclinicos({
        hoyIso: "2026-08-20", programa: "ERC", estadioAdministrativo: "G3a", esDm2: true, edad: 66, rac: 12,
        ultimos: {
          CREATININA: { fecha: "2026-07-01", valor: 1.4 },
          HBA1C: { fecha: "2026-05-10", valor: 7.1 },
          COLESTEROL_LDL: { fecha: "2026-06-15", valor: 90 },
        },
      });
      t.cierto(!!plan && !!plan.ftl, "el plan real trae FTL");
      const s = a.mtrSugerenciaPorPlazo(plan, null, "2027-02-20", "2026-08-20", "ERC");
      t.cierto(!!s && s.ajustada, "a 6 meses, con vigencias G3a de por medio, la regla ajusta");
      t.cierto(s.iso >= plan.ftl, "el control nunca cae antes de la toma");
    });

    t.caso("N3 en el modal: al abrir con análisis en memoria, la sugerencia llega puesta y explicada", () => {
      const hoy = new Date();
      const p2 = (n) => String(n).padStart(2, "0");
      const isoHoy = hoy.getFullYear() + "-" + p2(hoy.getMonth() + 1) + "-" + p2(hoy.getDate());
      const c2 = cargar({ silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red"); } });
      const doc2 = c2.env.doc;
      // querySelector memoizado (mismo truco que la suite 15): el banner es inspeccionable.
      const crearBase = doc2.createElement;
      doc2.createElement = function (tag) {
        const e = crearBase(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, doc2.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      const ftl = c2.api.mtrSumarDias(isoHoy, 88);
      const control = c2.api.mtrSumarDias(isoHoy, 95);
      c2.api.mtrCacheResumenGuardar("424242", {
        programa: "ERC",
        plan: {
          ftl: ftl, control: { fecha: control, motivo: "primer día hábil a >=4 días de la toma" },
          vencidos: [], faltantes: [],
          drivers: [{ clave: "CREATININA", nombre: "Creatinina sérica", estado: "D", vence: ftl }],
          pasajeros: [],
        },
      });
      c2.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      c2.api.openAgendamientoModal({ doc_id: "424242", nombre: "CARLOS RUIZ" });
      const modal = doc2.body.children.find((n) => n.id === "vgl-agendar-modal");
      t.cierto(!!modal, "el modal se montó");
      const banner = modal.querySelector("#vgl-agm-sugerida");
      const html = String(banner.innerHTML || "");
      t.cierto(html.includes("Creatinina sérica"), "el banner nombra al examen que dicta la fecha");
      t.cierto(html.includes("llegaría vencido") || html.includes("Se respeta su plazo"), "…con el porqué en una frase (N3)");
      t.falso(html.includes("Abra primero"), "la vieja pista de «abra Laboratorios primero» ya no existe: el análisis viaja con el modal");
    });

    // ============ v17.5.0 · aviso de completitud en el banner de sugerencia ============
    // Orden del médico: "extiendo el mismo aviso al agendamiento" — la MISMA compuerta que
    // ya deshabilita el Panel del paciente (mtrFactoresPendientesNavegables sobre
    // hta/diabetes/tabaquismo), aquí como AVISO dentro del propio banner de sugerencia, sin
    // bloquear nada: agendar una cita no puede quedar imposibilitado por un dato que falta.

    t.caso("v17.5.0 — con la sugerencia puesta, si aún faltan factores por documentar, el banner suma el aviso (sin bloquear nada)", () => {
      const hoy = new Date();
      const p2 = (n) => String(n).padStart(2, "0");
      const isoHoy = hoy.getFullYear() + "-" + p2(hoy.getMonth() + 1) + "-" + p2(hoy.getDate());
      const c3 = cargar({ silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red"); } });
      const doc3 = c3.env.doc;
      const crearBase3 = doc3.createElement;
      doc3.createElement = function (tag) {
        const e = crearBase3(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, doc3.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      // extractPacienteAbierto() necesita las dos líneas de abajo para no cortarse en seco
      // ("el paciente ya no es el mismo" / "no estamos en historia clínica") — mismo truco
      // que mockPacienteDock en la suite 15. Sin _vglCosechaGuardar: hta/diabetes/tabaquismo
      // quedan sin documentar (con querySelectorAll devolviendo [] por defecto, ningún radio
      // SI/NO aparece).
      doc3.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      doc3.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 700444555", closest: () => null }] : []);
      const ftl = c3.api.mtrSumarDias(isoHoy, 88);
      const control = c3.api.mtrSumarDias(isoHoy, 95);
      c3.api.mtrCacheResumenGuardar("700444555", {
        programa: "ERC",
        plan: { ftl: ftl, control: { fecha: control, motivo: "primer día hábil a >=4 días de la toma" },
          vencidos: [], faltantes: [], drivers: [], pasajeros: [] },
      });
      c3.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      c3.api.openAgendamientoModal({ doc_id: "700444555", nombre: "PACIENTE DEMO" });
      const modal = doc3.body.children.find((n) => n.id === "vgl-agendar-modal");
      const banner = modal.querySelector("#vgl-agm-sugerida");
      const html = String(banner.innerHTML || "");
      t.cierto(html.includes("Fecha de control sugerida"), "la sugerencia sigue a la vista: esto es un AVISO, no un bloqueo");
      t.cierto(html.includes("⚠️") && html.includes("Hipertensión y Diabetes (Antecedentes)"), "avisa qué falta y dónde (banner: " + html + ")");
      t.cierto(html.includes("Tabaquismo (Hábitos y Gestión de Riesgo)"), "los dos grupos de factores pendientes, no solo uno");
      t.cierto(banner.classList.contains("vgl-agm-sugerida-incompleta"), "clase para el borde ámbar del banner");
    });

    t.caso("v17.5.0 — con los factores completos, la misma sugerencia NO lleva el aviso de completitud", () => {
      const hoy = new Date();
      const p2 = (n) => String(n).padStart(2, "0");
      const isoHoy = hoy.getFullYear() + "-" + p2(hoy.getMonth() + 1) + "-" + p2(hoy.getDate());
      const c4 = cargar({ silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red"); } });
      const doc4 = c4.env.doc;
      const crearBase4 = doc4.createElement;
      doc4.createElement = function (tag) {
        const e = crearBase4(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, doc4.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      doc4.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      doc4.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 700666777", closest: () => null }] : []);
      const ftl = c4.api.mtrSumarDias(isoHoy, 88);
      const control = c4.api.mtrSumarDias(isoHoy, 95);
      c4.api._vglCosechaGuardar("700666777", { factores: {
        hta: { v: true, ts: 1 }, diabetes: { v: false, ts: 1 }, tabaquismo: { v: false, ts: 1 },
      } });
      c4.api.mtrCacheResumenGuardar("700666777", {
        programa: "ERC",
        plan: { ftl: ftl, control: { fecha: control, motivo: "primer día hábil a >=4 días de la toma" },
          vencidos: [], faltantes: [], drivers: [], pasajeros: [] },
      });
      c4.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      c4.api.openAgendamientoModal({ doc_id: "700666777", nombre: "PACIENTE DEMO" });
      const modal = doc4.body.children.find((n) => n.id === "vgl-agendar-modal");
      const banner = modal.querySelector("#vgl-agm-sugerida");
      const html = String(banner.innerHTML || "");
      t.cierto(html.includes("Fecha de control sugerida"), "la sugerencia se sigue mostrando");
      t.falso(html.includes("⚠️"), "sin factores pendientes: sin aviso de completitud");
      t.falso(banner.classList.contains("vgl-agm-sugerida-incompleta"), "sin la clase de borde ámbar");
    });

    t.caso("v17.5.0 — sin ninguna sugerencia a la vista, el aviso de completitud tampoco aparece", () => {
      const c5 = cargar({ silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red"); } });
      const doc5 = c5.env.doc;
      const crearBase5 = doc5.createElement;
      doc5.createElement = function (tag) {
        const e = crearBase5(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, doc5.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      // Sin mtrCacheResumenGuardar: _sugeridaControl queda null. El primer pintado síncrono
      // muestra "sin sugerencia por ahora", pero el análisis en segundo plano de v15.8.0
      // (N3) arranca en el mismo instante y su placeholder ("Analizando…") corre ANTES del
      // primer await, así que pisa ese mensaje de forma síncrona — es lo que de verdad queda
      // a la vista al terminar openAgendamientoModal(). En ninguno de los dos hay una
      // sugerencia concreta que calificar de incompleta.
      c5.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" };
      c5.api.openAgendamientoModal({ doc_id: "700888999", nombre: "PACIENTE DEMO" });
      const modal = doc5.body.children.find((n) => n.id === "vgl-agendar-modal");
      const banner = modal.querySelector("#vgl-agm-sugerida");
      const html = String(banner.innerHTML || "");
      t.cierto(html.includes("Analizando los exámenes"), "el análisis automático en segundo plano ya tomó la posta (banner: " + html + ")");
      t.falso(html.includes("⚠️"), "sin sugerencia concreta, no se agrega el aviso de completitud encima");
    });

    // ============ N4 · vista previa del SMS ============

    t.caso("_smsVistaPrevia: con el texto real capturado, sustituye los comodines y lo marca como real", () => {
      const v = a._smsVistaPrevia("VIVA1A le recuerda su cita el {fecha} a las {hora} en {sede} con {profesional}.",
        { fecha: "25/08/2026", hora: "07:00 AM", sede: "CMB", profesional: "ANA PEREZ" });
      t.cierto(v.esReal, "marcada como texto real");
      t.igual(v.texto, "VIVA1A le recuerda su cita el 25/08/2026 a las 07:00 AM en CMB con ANA PEREZ.", "sustitución completa");
    });

    t.caso("_smsVistaPrevia: comodines sin dato quedan explicados, no vacíos", () => {
      const v = a._smsVistaPrevia("Cita: {fecha} {hora}", {});
      t.cierto(v.texto.includes("(la fecha elegida)"), "fecha pendiente se dice");
      t.cierto(v.texto.includes("(la hora elegida)"), "hora pendiente se dice");
    });

    t.caso("_smsVistaPrevia: SIN plantilla, describe el contenido y JAMÁS inventa redacción oficial", () => {
      const v = a._smsVistaPrevia("", { fecha: "25/08/2026", profesional: "ANA PEREZ" });
      t.falso(v.esReal, "no se hace pasar por el texto real");
      t.cierto(v.texto.includes("Everest"), "dice quién redacta el mensaje de verdad");
      t.cierto(v.texto.includes("25/08/2026"), "y aun así muestra los datos de ESTA cita");
      t.cierto(v.texto.includes("ANA PEREZ"), "incluido el profesional");
    });

    // ============ N5 · tamaño de letra ============

    t.caso("_fzZoomDe: tres tamaños, dos escalas, y lo desconocido no escala nada", () => {
      t.igual(a._fzZoomDe("normal"), null, "normal = sin escala");
      t.igual(a._fzZoomDe("grande"), "1.12", "grande");
      t.igual(a._fzZoomDe("muygrande"), "1.28", "muy grande");
      t.igual(a._fzZoomDe("gigante"), null, "un valor corrupto en ajustes no rompe la interfaz");
    });

    t.caso("aplicarTamanoLetra: escribe la hoja de estilo con el zoom y la limpia al volver a normal", () => {
      a.__S.tamanoLetra = "grande";
      a.aplicarTamanoLetra();
      const st = c.env.doc.getElementById("vgl-fz-style");
      t.cierto(!!st, "la hoja existe");
      t.cierto(String(st.textContent).includes("zoom:1.12"), "con la escala de «grande»");
      t.cierto(String(st.textContent).includes("#vgl-root"), "apunta al panel");
      t.cierto(String(st.textContent).includes(".vgl-agm-card"), "y a las TARJETAS de los modales (no a los velos de 100vw)");
      t.falso(String(st.textContent).includes("#vgl-agendar-modal{"), "el velo de pantalla completa NO se escala directo");
      a.__S.tamanoLetra = "muygrande";
      a.aplicarTamanoLetra();
      t.cierto(String(st.textContent).includes("zoom:1.28"), "muy grande re-escala en el mismo nodo");
      a.__S.tamanoLetra = "normal";
      a.aplicarTamanoLetra();
      t.igual(String(st.textContent), "", "normal deja la hoja vacía: cero rastro");
    });

    // v18.0.88 — HALLAZGO DE ENJAMBRE #40. Alto Contraste fijaba el zoom del panel en un
    // 1.12 sin mirar la letra que el médico ya eligió en Ajustes: con «letra muy grande»
    // (1.28) activo, encender Alto Contraste ENCOGÍA el panel a 1.12, mientras las demás
    // superficies del script (que sí siguen la hoja de S.tamanoLetra) se quedaban en 1.28
    // — dos tamaños de letra distintos a la vista en el mismo asistente, y justo lo
    // opuesto de lo que ambas opciones de accesibilidad prometen.
    t.caso("REGRESIÓN — _vglAlternarAltoContraste nunca reduce la letra que el médico ya eligió en Ajustes (hallazgo #40)", () => {
      const raiz = c.env.doc.createElement("div");
      raiz.id = "vgl-root";
      const getByIdOriginal = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-root" ? raiz : getByIdOriginal(id));
      try {
        a.__S.tamanoLetra = "muygrande";   // 1.28, elegido en Ajustes
        a._vglAlternarAltoContraste();      // enciende Alto Contraste
        t.igual(raiz.style.zoom, "1.28",
          "con letra muy grande ya elegida, Alto Contraste NUNCA la encoge — antes quedaba fijo en 1.12");
        a._vglAlternarAltoContraste();      // apaga
        t.igual(raiz.style.zoom, "", "al apagar, vuelve a mandar la hoja de S.tamanoLetra (sin estilo inline)");

        a.__S.tamanoLetra = "normal";       // sin escala propia
        a._vglAlternarAltoContraste();
        t.igual(raiz.style.zoom, "1.12", "con letra normal, Alto Contraste sigue dando su 1.12 de siempre");
        a._vglAlternarAltoContraste();      // se deja apagado para no ensuciar otras pruebas
      } finally {
        c.env.doc.getElementById = getByIdOriginal;
      }
    });

    // ============ N2 · semáforo de salud ============

    t.caso("_saludEstado: sin señales es «nd», con fallo fresco sigue «ok», y solo el fallo sostenido alarma", () => {
      const T0 = Date.now();
      t.igual(a._saludEstado({ ok: 0, fallo: 0, falloDesde: 0 }, T0), "nd", "sin actividad");
      t.igual(a._saludEstado(null, T0), "nd", "módulo desconocido no revienta");
      t.igual(a._saludEstado({ ok: 0, fallo: T0, falloDesde: T0 }, T0), "ok", "un parpadeo NO alarma");
      t.igual(a._saludEstado({ ok: 0, fallo: T0, falloDesde: T0 - 4 * 60000 }, T0), "alerta", "4 minutos de fallo sostenido SÍ");
      t.igual(a._saludEstado({ ok: T0, fallo: T0 - 1000, falloDesde: T0 - 10 * 60000 }, T0), "ok", "si la última lectura buena es más nueva que el último fallo, se está recuperando");
    });

    t.caso("_saludMarca + _saludHayAlerta: el registro real pasa a alerta con el tiempo y se limpia con una lectura buena", () => {
      const T = Date.now();
      a._saludMarca("labs", false);
      t.falso(a._saludHayAlerta(T), "recién fallado: todavía nada de alarmas");
      t.cierto(a._saludHayAlerta(T + 4 * 60000), "4 minutos después, sigue sin lectura buena: alerta");
      a._saludMarca("labs", true);
      t.falso(a._saludHayAlerta(T + 5 * 60000), "una lectura buena apaga la alerta al instante");
      a._saludMarca("modulo-fantasma", false);
      t.falso(a._saludHayAlerta(T + 9 * 60000), "un módulo desconocido se ignora sin romper nada");
    });

    t.caso("_saludGlobitoHtml: cuatro renglones en lenguaje llano, con el módulo caído señalado", () => {
      const T = Date.now();
      a._saludMarca("agenda", true);
      a._saludMarca("labs", false);
      const html = a._saludGlobitoHtml(T + 4 * 60000);
      t.cierto(html.includes("Estado del asistente"), "título");
      t.cierto(html.includes("Agenda del día"), "renglón de agenda");
      t.cierto(html.includes("Historia clínica"), "renglón de historia");
      t.cierto(html.includes("Laboratorios"), "renglón de laboratorios");
      t.cierto(html.includes("Lista de prevención (PyM)"), "renglón de prevención");
      t.cierto(html.includes("⚠") && html.includes("avise al administrador"), "el caído se señala y se dice qué hacer");
      t.cierto(html.includes("puede seguir su consulta normal"), "…sin alarmar la consulta");
      t.falso(html.includes("DOM") || html.includes("anclas") || html.includes("selector"), "cero jerga técnica");
      a._saludMarca("labs", true);
    });

    t.caso("_saludGlobitoToggle: pinta el globito dentro del panel y el tap lo registra", () => {
      const raiz = c.env.doc.createElement("div");
      c.env.doc.body.appendChild(raiz);
      a._saludGlobitoToggle(raiz);
      const globo = (raiz.children || []).find((n) => n.id === "vgl-salud-globo");
      t.cierto(!!globo, "el globito quedó colgado del panel (hereda tema y tokens)");
      t.cierto(String(globo.innerHTML).includes("Estado del asistente"), "con su contenido");
    });

    // ============ N2 · la envoltura de Athenea sigue siendo transparente ============

    await t.casoAsync("getAtheneaLabsAuto y su núcleo devuelven lo mismo (la envoltura solo anota salud)", async () => {
      // v16.2.8 — Sin credenciales ni red simulada, Athenea NO se puede leer, y desde
      // esta versión eso se dice con `null` en vez de con una lista vacía (que el resto
      // del asistente leía como "este paciente no tiene laboratorios"). Lo que esta
      // prueba protege sigue siendo lo mismo: que la envoltura no altere el contrato.
      const r1 = await a.getAtheneaLabsAuto("111111111");
      const r2 = await a._getAtheneaLabsAutoNucleo("111111111");
      t.igual(r1, null, "sin poder leer Athenea, la pública responde null («no pude»)");
      t.igual(r2, null, "y el núcleo responde lo mismo: la envoltura no cambia el contrato");
      t.cierto(a.atheneaLecturaIncompleta(r1), "y ambas se declaran como lectura incompleta");
    });
  },
};
