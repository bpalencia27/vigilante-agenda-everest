// =====================================================================
//  SUITE 79 — AVISO DE PACIENTE NUEVO EN EL TURNO (v18.5.0)
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que «paciente nuevo» salga de
//  la FOTO DE LA LISTA INICIAL de cada turno (AM: 00–11 h, PM: 12–23 h),
//  nunca de una memoria de médico — la memoria de 90 días de v18.1.0/B5
//  clasificó «nuevo» a toda la agenda la mañana del 07-sep-2026 y fue
//  retirada junto con su botón/modal «NUEVOS».
//
//  Invariantes fijados aquí:
//   · FOTO DE ARRANQUE SILENCIOSA: la primera lectura del turno ES la
//     lista inicial — nadie es «nuevo» por estar en ella (el defecto
//     reportado queda imposible por diseño).
//   · GRACIA de 120 s tras la foto: absorbe lecturas incompletas.
//   · Toast FUCSIA (#E879F9) INMEDIATO por cada ingreso posterior, con
//     la MISMA estructura del canal showToast (mismo canal que los
//     toasts de cambio de leyenda); color exclusivo, no crítico, y sin
//     rebajar la gravedad al agruparse (mtrColorMasGrave).
//   · DEDUP por cita (cédula@hora) y entre pestañas (vgl_vistos).
//   · CERO PHI INNECESARIA EN DISCO: cédula y hora, jamás nombres; la
//     foto se barre al cambiar de turno o de día.
//   · La capacidad `aviso_paciente_nuevo` (capa a) sigue mandando:
//     PÚBLICO y BLOQUEADO no evalúan NADA ni aprenden NADA.
//   · El botón «👤 Nuevos», su modal y su contador ya NO EXISTEN.
// =====================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

const LISTA_OK = {
  version: "2026-09-04.1",
  emitida: "2026-09-04T08:00:00",
  perfiles: {
    COMPLETO: [{ uid: 101, nombre: "Brandon Jesús Palencia Martínez" }],
    LABORATORIOS: [{ uid: 201, nombre: "Maryuris Terán" }],
  },
  blocklist: [{ uid: 999, nombre: "Prueba Bloqueada", motivo: "banco" }],
};

function almPadron(extra) {
  const a = { vgl_acceso_lista: JSON.stringify(LISTA_OK) };
  if (extra) Object.assign(a, extra);
  return a;
}

function conDoctor(api, id, name) {
  api.__state.activeDoctor.id = id;
  api.__state.activeDoctor.name = name;
}

function cita(doc, nombre, hora) {
  return { doc_id: doc, nombre: nombre, hora_texto: hora, estado: "Pendiente" };
}

// Relojes deterministas: hoy a una hora fija del turno que la prueba necesita
// (el turno se deriva de `ahora`, no del reloj de pared del banco).
function hoyA(h) { const d = new Date(); d.setHours(h, 0, 0, 0); return d.getTime(); }

function grabadora() {
  const llamadas = [];
  return {
    llamadas: llamadas,
    toast: function (color, titulo, cuerpo, persist, key) {
      llamadas.push({ color: color, titulo: titulo, cuerpo: cuerpo, key: key });
    },
  };
}

function leer(almacen, k) {
  const v = almacen[k];
  return v === undefined ? null : JSON.parse(v);
}

module.exports = {
  nombre: "Aviso de paciente nuevo por turno (v18.5.0): foto inicial AM/PM, toast FUCSIA exclusivo, dedup doble, capa a, botón NUEVOS retirado",

  cubre: ["shiftNewPatientEval", "shiftOf", "shiftBaselineKey", "shiftCitaId", "shiftSweepOldBaselines"],

  async pruebas(t, api, env, cargar) {
    const AM8 = hoyA(8), AM8_05 = AM8 + 5 * 60000, AM8_10 = AM8 + 10 * 60000;

    t.caso("v18.5.0: los helpers existen y el turno AM/PM se decide por hora local", () => {
      for (const f of ["shiftNewPatientEval", "shiftOf", "shiftBaselineKey", "shiftCitaId", "shiftSweepOldBaselines"]) {
        t.cierto(typeof api[f] === "function", "falta " + f);
      }
      t.igual(api.shiftOf(new Date("2026-09-07T00:30:00")), "AM", "00:30 es AM");
      t.igual(api.shiftOf(new Date("2026-09-07T11:59:00")), "AM", "11:59 sigue siendo AM");
      t.igual(api.shiftOf(new Date("2026-09-07T12:00:00")), "PM", "12:00 ya es PM");
      t.igual(api.shiftOf(new Date("2026-09-07T23:30:00")), "PM", "23:30 es PM");
      t.igual(api.shiftCitaId("12345", "8:00"), "12345@8:00", "citaId = cédula@hora");
      t.igual(api.shiftBaselineKey(201, "2026-09-07", "AM"), "vgl_shift_base_201_2026-09-07_AM", "la foto es por médico + día + turno");
      t.igual(api.shiftBaselineKey(undefined, "2026-09-07", "AM"), "vgl_shift_base_0_2026-09-07_AM", "sin uid cae al balde 0");
    });

    t.caso("v18.5.0 capa a: PÚBLICO (sin padrón) no evalúa NI APRENDE nada", () => {
      const almacen = {};   // sin vgl_acceso_lista → identidad fuera del padrón → PÚBLICO
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 707, "Alguien Sin Padrón");
      const g = grabadora();
      const r = c.api.shiftNewPatientEval([cita("111", "Paciente Uno", "8:00")], { ahora: AM8, toast: g.toast });
      t.igual(r, null, "PÚBLICO no evalúa el aviso");
      t.igual(g.llamadas.length, 0, "PÚBLICO no dispara toasts");
      for (const k of Object.keys(almacen)) {
        t.falso(k.indexOf("vgl_shift_base_") === 0, "PÚBLICO no debe escribir " + k + " (la foto solo crece para quien puede usarla)");
      }
    });

    t.caso("v18.5.0 capa a: BLOQUEADO tampoco evalúa, ni siquiera con capacidad registrada", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 999, "Prueba Bloqueada");
      const g = grabadora();
      t.igual(c.api.shiftNewPatientEval([cita("111", "Paciente Uno", "8:00")], { ahora: AM8, toast: g.toast }), null, "BLOQUEADO no evalúa");
      t.igual(g.llamadas.length, 0, "BLOQUEADO no dispara toasts");
      t.falso(("vgl_shift_base_999_" + c.api.todayStamp() + "_AM" in almacen), "BLOQUEADO no aprende");
    });

    t.caso("v18.5.0 foto de arranque silenciosa (turno AM): NADIE es nuevo al iniciar la sesión", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");   // LABORATORIOS: tiene aviso_paciente_nuevo
      const g = grabadora();
      // EL DEFECTO RETIRADO: memoria vacía/caduca + bootstrap falso ⇒ todos nuevos.
      // Aquí la MISMA agenda completa entra de una vez a las 8:00 y nadie dispara.
      const r = c.api.shiftNewPatientEval(
        [cita("111", "Ana De Hoy", "8:00"), cita("222", "Beto De Hoy", "8:30"), cita("333", "Carla De Hoy", "9:00")],
        { ahora: AM8, toast: g.toast });
      t.cierto(!!r, "con capacidad SÍ evalúa");
      t.cierto(r.seed, "primera lectura del turno ⇒ foto");
      t.igual(r.turno, "AM", "a las 8:00 el turno es AM");
      t.igual(r.nuevos, 0, "la lista inicial no genera nuevos");
      t.igual(r.toasts, 0, "y no hay toasts");
      t.igual(g.llamadas.length, 0, "foto silenciosa: cero avisos");
      const reg = leer(almacen, "vgl_shift_base_201_" + c.api.todayStamp() + "_AM");
      t.cierto(!!reg && Object.keys(reg.docs).length === 3, "la foto quedó aprendida");
      t.igual(c.api.__state.avisoPacNuevos, undefined, "ya NO existe contador del dock retirado");
    });

    t.caso("v18.5.0 detección AM: el que entra DESPUÉS recibe toast FUCSIA inmediato; los iniciales jamás", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const g = grabadora();
      c.api.shiftNewPatientEval([cita("111", "Ana Inicial", "8:00"), cita("222", "Beto Inicial", "8:30")], { ahora: AM8, toast: g.toast });   // foto
      const r2 = c.api.shiftNewPatientEval(
        [cita("111", "Ana Inicial", "8:00"), cita("222", "Beto Inicial", "8:30"), cita("444", "María Nueva", "10:00"), cita("555", "Pedro Nuevo", "10:30")],
        { ahora: AM8_05, toast: g.toast });
      t.falso(r2.seed, "segunda pasada: ya no es foto");
      t.igual(r2.nuevos, 2, "detecta los 2 ingresos (y a ninguno de los iniciales)");
      t.igual(r2.toasts, 2, "un toast inmediato por cada nuevo, sin tope por hora");
      t.igual(g.llamadas.length, 2, "exactamente 2 avisos");
      t.igual(g.llamadas[0].color, "FUCSIA", "color exclusivo del aviso de paciente nuevo");
      t.cierto(g.llamadas[0].cuerpo.indexOf("María Nueva") >= 0, "el toast dice QUIÉN");
      t.cierto(g.llamadas[0].cuerpo.indexOf("10:00") >= 0, "el toast dice a qué hora");
      t.cierto(g.llamadas[0].cuerpo.indexOf("al iniciar este turno") >= 0, "el cuerpo explica la regla del turno");
      // PHI mínima: la foto guarda cédula y hora, NUNCA el nombre.
      const regBruto = almacen["vgl_shift_base_201_" + c.api.todayStamp() + "_AM"];
      t.cierto(regBruto.indexOf("María Nueva") < 0, "el nombre NO vive en disco");
      t.cierto(regBruto.indexOf("444") >= 0, "la cédula sí (es la foto)");
      // Re-leer la misma agenda no repite NI vuelve a contar.
      const g2 = grabadora();
      const r3 = c.api.shiftNewPatientEval(
        [cita("111", "Ana Inicial", "8:00"), cita("222", "Beto Inicial", "8:30"), cita("444", "María Nueva", "10:00"), cita("555", "Pedro Nuevo", "10:30")],
        { ahora: AM8_10, toast: g2.toast });
      t.igual(r3.nuevos, 2, "el conteo no crece al re-leer la misma agenda");
      t.igual(r3.toasts, 0, "y no vuelve a avisar");
      t.igual(g2.llamadas.length, 0, "cero toasts en la re-evaluación");
    });

    t.caso("v18.5.0 gracia de 120 s: lo que llega pegado a la foto se absorbe en silencio (lectura a medias no siembra falsos)", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const g = grabadora();
      c.api.shiftNewPatientEval([cita("111", "Ana Foto", "8:00")], { ahora: AM8, toast: g.toast });          // foto
      const rG = c.api.shiftNewPatientEval([cita("111", "Ana Foto", "8:00"), cita("777", "Catch Up", "8:20")], { ahora: AM8 + 90000, toast: g.toast });
      t.igual(rG.toasts, 0, "a los 90 s de la foto, en gracia: sin toast");
      t.igual(g.llamadas.length, 0, "cero avisos en la ventana de gracia");
      const g2 = grabadora();
      const rD = c.api.shiftNewPatientEval([cita("111", "Ana Foto", "8:00"), cita("777", "Catch Up", "8:20"), cita("888", "Ya Fuera", "8:40")], { ahora: AM8 + 180000, toast: g2.toast });
      t.igual(rD.toasts, 1, "a los 3 min la gracia acabó: solo el nuevo de verdad dispara");
      t.cierto(g2.llamadas.length === 1 && g2.llamadas[0].cuerpo.indexOf("Ya Fuera") >= 0, "y es «Ya Fuera», no el absorbido");
    });

    t.caso("v18.5.0 turno PM: mediodía re-fotografía en silencio; la agenda del mediodía NO dispara; la foto AM se barre", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const g = grabadora();
      c.api.shiftNewPatientEval([cita("111", "Ana Mañana", "8:00")], { ahora: hoyA(8), toast: g.toast });     // foto AM
      // 12:30: el turno PM trae SU lista (con pacientes que no estaban a las 8:00):
      // es la LISTA INICIAL del PM, no una avalancha de nuevos.
      const rPM = c.api.shiftNewPatientEval(
        [cita("111", "Ana Mañana", "8:00"), cita("901", "Tarde Uno", "14:00"), cita("902", "Tarde Dos", "14:30")],
        { ahora: hoyA(12) + 30000, toast: g.toast });
      t.cierto(rPM.seed, "mediodía = turno nuevo ⇒ nueva foto");
      t.igual(rPM.turno, "PM", "a las 12:30 el turno es PM");
      t.igual(rPM.toasts, 0, "la lista inicial del PM no dispara nada");
      t.igual(g.llamadas.length, 0, "cero avisos en el cambio de turno");
      const g2 = grabadora();
      const rPM2 = c.api.shiftNewPatientEval(
        [cita("111", "Ana Mañana", "8:00"), cita("901", "Tarde Uno", "14:00"), cita("902", "Tarde Dos", "14:30"), cita("903", "Tarde Nueva", "15:00")],
        { ahora: hoyA(12) + 600000, toast: g2.toast });
      t.igual(rPM2.toasts, 1, "el ingreso posterior del PM sí dispara");
      t.cierto(g2.llamadas.length === 1 && g2.llamadas[0].cuerpo.indexOf("Tarde Nueva") >= 0, "y es la de las 15:00");
      // La foto AM (turno agotado) se barrió al sembrar la PM.
      const hoy = c.api.todayStamp();
      for (const k of Object.keys(almacen)) {
        if (k.indexOf("vgl_shift_base_") === 0) {
          t.cierto(k.endsWith("_" + hoy + "_PM"), "tras el cambio de turno solo vive la foto vigente: " + k);
        }
      }
    });

    t.caso("v18.5.0 recarga a mitad del turno: la foto persistida evita falsos positivos sin perder detecciones", () => {
      const almacen = almPadron();
      const hoy = null;   // todayStamp() del api, calculado abajo
      const c1 = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c1.api, 201, "Maryuris Terán");
      c1.api.shiftNewPatientEval([cita("111", "Ana Inicial", "8:00"), cita("222", "Beto Inicial", "8:30")], { ahora: AM8, toast: grabadora().toast });
      // La página se recarga (nuevo contexto, MISMO localStorage): la foto sigue ahí.
      const c2 = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c2.api, 201, "Maryuris Terán");
      const g = grabadora();
      const r = c2.api.shiftNewPatientEval(
        [cita("111", "Ana Inicial", "8:00"), cita("222", "Beto Inicial", "8:30"), cita("666", "Nueva Tras Recarga", "11:00")],
        { ahora: AM8_10, toast: g.toast });
      t.falso(r.seed, "la recarga NO re-fotografía: la foto del turno persiste");
      t.igual(r.toasts, 1, "solo dispara al que entró de verdad");
      t.cierto(g.llamadas.length === 1 && g.llamadas[0].cuerpo.indexOf("Nueva Tras Recarga") >= 0, "y es la nueva, no los iniciales");
      t.cierto(hoy === null, "guarda anti-sombra (hoy no se usa en este caso)");
    });

    t.caso("v18.5.0 dedup entre pestañas: lo ya anunciado por el navegador no se repite", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const hoy = c.api.todayStamp();
      const c2 = cargar({ silencioso: true, almacen: almacen });   // foto ya hecha por la otra pestaña
      // Otra pestaña acaba de tostar esta cita (registro vgl_vistos del día).
      almacen["vgl_vistos"] = JSON.stringify({ _dia: hoy, "pacNuevoTurno|820@15:00": Date.now() - 5000 });
      const g = grabadora();
      const r = c2.api.shiftNewPatientEval([cita("820", "Ya Anunciado", "15:00")], { ahora: hoyA(12) + 600000, toast: g.toast });
      t.igual(r.toasts, 0, "el toast no se repite en esta pestaña");
      t.igual(g.llamadas.length, 0, "cero avisos duplicados");
    });

    t.caso("v18.5.0 por PACIENTE: la segunda cita del mismo turno no lo vuelve «nuevo»", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const g = grabadora();
      c.api.shiftNewPatientEval([cita("111", "Ana Dos Citas", "8:00")], { ahora: AM8, toast: g.toast });   // foto
      const r = c.api.shiftNewPatientEval(
        [cita("111", "Ana Dos Citas", "8:00"), cita("111", "Ana Dos Citas", "10:30")], { ahora: AM8_10, toast: g.toast });
      t.igual(r.toasts, 0, "el paciente ya estaba en la lista inicial del turno");
      t.igual(r.nuevos, 0, "y no cuenta como nuevo");
      t.igual(g.llamadas.length, 0, "cero avisos");
    });

    t.caso("v18.5.0 filas sin cédula: no se aprenden ni se avisan", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const g = grabadora();
      const r = c.api.shiftNewPatientEval([cita("", "Sin Documento", "8:00"), cita("   ", "Solo Espacios", "8:30")],
        { ahora: AM8, toast: g.toast });
      t.cierto(r.seed, "nada se aprendió de filas sin cédula");
      t.igual(r.nuevos, 0, "sin cédula no hay foto posible");
      t.igual(Object.keys(almacen).filter((k) => k.indexOf("vgl_shift_base_") === 0).length, 0, "ni siquiera escribió la foto");
    });

    t.caso("v18.5.0 barredura: fotos de otros días/turnos se van; la del turno vigente de OTRO médico sobrevive", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const hoy = c.api.todayStamp();
      almacen["vgl_shift_base_201_2000-01-01_AM"] = JSON.stringify({ dia: "2000-01-01", turno: "AM", ts: 1, docs: {}, avisados: {} });
      almacen["vgl_shift_base_202_" + hoy + "_AM"] = JSON.stringify({ dia: hoy, turno: "AM", ts: 1, docs: {}, avisados: {} });
      almacen["vgl_shift_base_101_" + hoy + "_PM"] = JSON.stringify({ dia: hoy, turno: "PM", ts: 1, docs: { x: true }, avisados: {} });
      c.api.shiftNewPatientEval([cita("960", "Dia Nuevo", "14:00")], { ahora: hoyA(14), toast: grabadora().toast });
      t.falso(("vgl_shift_base_201_2000-01-01_AM" in almacen), "la foto del día viejo se fue");
      t.falso(("vgl_shift_base_202_" + hoy + "_AM" in almacen), "la foto del turno AGOTADO de hoy (AM) también");
      t.cierto(("vgl_shift_base_101_" + hoy + "_PM" in almacen), "la foto del turno VIGENTE de otro médico sobrevive");
      t.cierto(("vgl_shift_base_201_" + hoy + "_PM" in almacen), "y la propia quedó");
    });

    t.caso("v18.5.0 color exclusivo: FUCSIA no se confunde con ningún otro color ni rebaja la gravedad", () => {
      const hex = api.__COLORS && api.__COLORS.FUCSIA;
      t.igual(hex, "#E879F9", "FUCSIA existe en COLORS con su hex exclusivo");
      for (const [k, v] of Object.entries(api.__COLORS || {})) {
        if (k !== "FUCSIA") t.falso(v === "#E879F9", "ningún otro color usa el hex de FUCSIA (" + k + ")");
      }
      t.igual(api.mtrColorMasGrave(["FUCSIA"]), "FUCSIA", "solo en un grupo no es tratado como «color nadie declaró» (= ROJO)");
      t.igual(api.mtrColorMasGrave(["FUCSIA", "AZUL"]), "FUCSIA", "gana a AZUL (más informativo)");
      t.igual(api.mtrColorMasGrave(["FUCSIA", "ROJO"]), "ROJO", "y jamás rebaja a un ROJO agrupado");
    });

    t.caso("v18.5.0 retiro: el botón/modal «NUEVOS» y su memoria de 90 días ya no existen en el código", () => {
      t.falso(FUENTE.includes("pacientes-nuevos"), "sin data-accion=pacientes-nuevos (la pastilla del dock)");
      t.falso(FUENTE.includes("avisoPacEval"), "sin el eval de la memoria de 90 días");
      t.falso(FUENTE.includes('"vgl_aviso_hist_"'), "sin el histórico de 90 días en localStorage (la clave como LITERAL de código)");
      t.falso(FUENTE.includes("vgl_aviso_pacientes_"), "sin el registro diario del sistema retirado");
      t.falso(FUENTE.includes('"PACN"'), "sin el contador en la firma del dock");
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      c.api.shiftNewPatientEval([cita("111", "Ana", "8:00")], { ahora: AM8, toast: grabadora().toast });
      t.igual(c.api.__state.avisoPacNuevos, undefined, "el estado del contador retirado no se escribe");
    });

    t.caso("v18.5.0 rodamiento del tick: evaluar tras una lectura vacía o fallida no rompe; el camino real responde", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      t.igual(c.api.shiftNewPatientEval([], { ahora: AM8, toast: grabadora().toast }), null, "agenda vacía: nada que hacer");
      t.igual(c.api.shiftNewPatientEval(null, { ahora: AM8, toast: grabadora().toast }), null, "lectura fallida (null): nada que hacer");
      // Sin opts (camino real de tickApi): no debe lanzar aunque el toast sea el de verdad.
      const r = c.api.shiftNewPatientEval([cita("970", "Camino Real", "17:00")]);
      t.cierto(r && typeof r.nuevos === "number", "el camino sin opts responde");
    });
  },
};
