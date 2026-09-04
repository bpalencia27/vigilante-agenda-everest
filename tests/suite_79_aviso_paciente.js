// =====================================================================
//  SUITE 79 — AVISO DE PACIENTE NUEVO (Misión B, arreglo B5)
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que «paciente nuevo» salga de
//  la MEMORIA PROPIA del médico (histórico por uid en el propio equipo),
//  con bootstrap silencioso el primer día, máx. 3 toasts por hora corrida,
//  dedup por cita (cédula@hora) y entre pestañas (vgl_vistos), contador
//  SOLO numérico para el dock y CERO PHI persistida más allá de cédula y
//  hora — jamás nombres en disco.
//
//  La capacidad `aviso_paciente_nuevo` ya estaba registrada desde B1 como
//  propia del perfil LABORATORIOS (y por tanto de COMPLETO); esta suite
//  fija que la CAPA a la respeta: PÚBLICO y BLOQUEADO no evalúan NADA ni
//  aprenden NADA.
// =====================================================================

"use strict";

const HORA_MS = 60 * 60 * 1000;

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

function sembrarDia(almacen, api, extraReg) {
  const hoy = api.todayStamp();
  const reg = { dia: hoy, avisados: {}, toasts: [], nuevos: [] };
  if (extraReg) extraReg(reg);
  almacen["vgl_aviso_pacientes_" + hoy] = JSON.stringify(reg);
  return reg;
}

module.exports = {
  nombre: "Aviso de paciente nuevo (B5): memoria por médico, bootstrap silencioso, 3 toasts/h, dedup doble, capa a",

  cubre: ["avisoPacEval", "avisoPacCitaId", "avisoPacToastsRecientes",
    "avisoPacHistKey", "avisoPacDiaKey", "avisoPacHistPodar", "_avisoPacLimpiarDiasViejos"],

  async pruebas(t, api, env, cargar) {
    const AHORA = Date.now();

    t.caso("B5: el módulo existe y sus helpers puros hacen lo que dice la caja", () => {
      for (const f of ["avisoPacEval", "avisoPacCitaId", "avisoPacToastsRecientes",
        "avisoPacHistKey", "avisoPacDiaKey", "avisoPacHistPodar", "_avisoPacLimpiarDiasViejos"]) {
        t.cierto(typeof api[f] === "function", "falta " + f);
      }
      t.igual(api.avisoPacCitaId("12345", "8:00"), "12345@8:00", "citaId = cédula@hora");
      t.igual(api.avisoPacHistKey(201), "vgl_aviso_hist_201", "histórico por uid");
      t.igual(api.avisoPacHistKey(undefined), "vgl_aviso_hist_0", "sin uid cae al balde 0");
      t.igual(api.avisoPacDiaKey(api.todayStamp()), "vgl_aviso_pacientes_" + api.todayStamp(), "clave datada del día");
      // Solo los toasts de la ÚLTIMA HORA consumen presupuesto.
      const ts = [AHORA - 10 * 60000, AHORA - 2 * HORA_MS, AHORA - 30 * 60000];
      t.igual(api.avisoPacToastsRecientes(ts, AHORA).length, 2, "de 3 toasts, 2 son de la última hora");
      t.igual(api.avisoPacToastsRecientes([], AHORA).length, 0, "sin toasts, presupuesto lleno");
      // La poda solo actúa sobre el máximo y conserva los más recientes.
      const muchos = {};
      for (let i = 0; i < 2001; i++) muchos["d" + i] = i;   // d2000 = el más reciente
      const podado = api.avisoPacHistPodar(muchos);
      t.cierto(!!podado, "con 2001 conocidos debe podar");
      t.igual(Object.keys(podado).length, 1500, "la poda deja 1500");
      t.cierto(podado["d2000"] !== undefined, "conserva los más recientes");
      t.falso(podado["d0"] !== undefined, "suelta los más viejos");
      t.igual(api.avisoPacHistPodar({ a: 1 }), null, "por debajo del máximo no toca nada");
    });

    t.caso("B5 capa a: PÚBLICO (sin padrón) no evalúa NI APRENDE nada", () => {
      const almacen = {};   // sin vgl_acceso_lista → identidad fuera del padrón → PÚBLICO
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 707, "Alguien Sin Padrón");
      const g = grabadora();
      const r = c.api.avisoPacEval([cita("111", "Paciente Uno", "8:00")], { ahora: AHORA, toast: g.toast });
      t.igual(r, null, "PÚBLICO no evalúa el aviso");
      t.igual(g.llamadas.length, 0, "PÚBLICO no dispara toasts");
      for (const k of Object.keys(almacen)) {
        t.falso(k.indexOf("vgl_aviso_") === 0, "PÚBLICO no debe escribir " + k + " (el histórico solo crece para quien puede usarlo)");
      }
    });

    t.caso("B5 capa a: BLOQUEADO tampoco evalúa, ni siquiera con capacidad registrada", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 999, "Prueba Bloqueada");
      const g = grabadora();
      t.igual(c.api.avisoPacEval([cita("111", "Paciente Uno", "8:00")], { ahora: AHORA, toast: g.toast }), null, "BLOQUEADO no evalúa");
      t.igual(g.llamadas.length, 0, "BLOQUEADO no dispara toasts");
      t.falso(("vgl_aviso_hist_999" in almacen), "BLOQUEADO no aprende");
    });

    t.caso("B5 bootstrap silencioso: histórico vacío SOLO aprende, jamás avisa", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");   // LABORATORIOS: tiene aviso_paciente_nuevo
      const g = grabadora();
      const r = c.api.avisoPacEval(
        [cita("111", "Ana Vieja", "8:00"), cita("222", "Beto Viejo", "8:30"), cita("333", "Carla Vieja", "9:00")],
        { ahora: AHORA, toast: g.toast });
      t.cierto(!!r, "con capacidad SÍ evalúa");
      t.cierto(r.bootstrap, "histórico vacío → bootstrap");
      t.igual(r.nuevos, 0, "el primer día NADIE es nuevo");
      t.igual(r.toasts, 0, "el primer día no hay toasts");
      t.igual(g.llamadas.length, 0, "bootstrap silencioso: cero avisos");
      const hist = leer(almacen, "vgl_aviso_hist_201");
      t.igual(Object.keys(hist.docs).length, 3, "pero la memoria quedó aprendida");
      t.igual(c.api.__state.avisoPacNuevos, 0, "el contador del dock arranca en 0");
    });

    t.caso("B5 detección: el paciente nuevo recibe toast; el conocido no; el disco no guarda nombres", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const g = grabadora();
      c.api.avisoPacEval([cita("111", "Ana Vieja", "8:00")], { ahora: AHORA, toast: g.toast });   // bootstrap
      const r2 = c.api.avisoPacEval(
        [cita("111", "Ana Vieja", "8:00"), cita("444", "María Nueva", "10:00"), cita("555", "Pedro Nuevo", "10:30")],
        { ahora: AHORA + 1000, toast: g.toast });
      t.falso(r2.bootstrap, "segunda pasada con memoria: ya no es bootstrap");
      t.igual(r2.nuevos, 2, "detecta los 2 nuevos (y no a la conocida)");
      t.igual(r2.toasts, 2, "un toast por cada nuevo");
      t.igual(g.llamadas.length, 2, "exactamente 2 avisos");
      t.cierto(g.llamadas[0].cuerpo.indexOf("María Nueva") >= 0, "el toast dice QUIÉN");
      t.cierto(g.llamadas[0].cuerpo.indexOf("10:00") >= 0, "el toast dice a qué hora");
      t.igual(g.llamadas[0].color, "VERDE", "informativo, no alarma");
      // PHI mínima: el registro del día lleva cédula y hora, NUNCA el nombre.
      const regBruto = almacen["vgl_aviso_pacientes_" + c.api.todayStamp()];
      t.cierto(regBruto.indexOf("María Nueva") < 0, "el nombre NO vive en disco");
      t.cierto(regBruto.indexOf("444") >= 0, "la cédula sí (es la memoria)");
      t.igual(c.api.__state.avisoPacNuevos, 2, "el contador del dock queda en 2");
    });

    t.caso("B5 dedup por cita: re-evaluar la misma agenda no repite NI cuenta", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const g = grabadora();
      const citas = [cita("111", "Ana Vieja", "8:00")];
      c.api.avisoPacEval(citas, { ahora: AHORA, toast: g.toast });                       // bootstrap
      c.api.avisoPacEval(citas.concat([cita("666", "Nueva Dos Veces", "11:00")]), { ahora: AHORA + 2000, toast: g.toast });
      const g2 = grabadora();
      const r3 = c.api.avisoPacEval(citas.concat([cita("666", "Nueva Dos Veces", "11:00")]), { ahora: AHORA + 3000, toast: g2.toast });
      t.igual(r3.nuevos, 1, "el contador no crece al re-leer la misma agenda");
      t.igual(r3.toasts, 0, "y no vuelve a avisar");
      t.igual(g2.llamadas.length, 0, "cero toasts en la re-evaluación");
    });

    t.caso("B5 presupuesto: máximo 3 toasts por hora corrida; los demás quedan contados", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      // Memoria ya caliente (sin bootstrap) y 2 toasts dados hace poco: presupuesto 1.
      almacen["vgl_aviso_hist_201"] = JSON.stringify({ docs: { "900": 1 } });
      sembrarDia(almacen, c.api, function (reg) { reg.toasts = [AHORA - 10 * 60000, AHORA - 20 * 60000]; });
      const g = grabadora();
      const r = c.api.avisoPacEval(
        [cita("801", "Llega Uno", "13:00"), cita("802", "Llega Dos", "13:05"), cita("803", "Llega Tres", "13:10")],
        { ahora: AHORA, toast: g.toast });
      t.igual(r.nuevos, 3, "los 3 quedan registrados");
      t.igual(r.toasts, 1, "pero solo 1 toast (presupuesto 1 de 3)");
      t.igual(g.llamadas.length, 1, "exactamente 1 aviso");
      const reg = leer(almacen, "vgl_aviso_pacientes_" + c.api.todayStamp());
      t.igual(reg.toasts.length, 3, "el toast dado consume presupuesto en disco");
      // Una hora después el presupuesto vuelve — pero estos ya no son nuevos.
      const g2 = grabadora();
      const r2 = c.api.avisoPacEval(
        [cita("801", "Llega Uno", "13:00"), cita("802", "Llega Dos", "13:05"), cita("803", "Llega Tres", "13:10")],
        { ahora: AHORA + 2 * HORA_MS, toast: g2.toast });
      t.igual(r2.toasts, 0, "aprendidos: no se re-avisa aunque haya presupuesto");
      t.igual(r2.nuevos, 3, "el contador del día sigue siendo el de la mañana");
    });

    t.caso("B5 presupuesto: los toasts de hace MÁS de una hora ya no cuentan", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      almacen["vgl_aviso_hist_201"] = JSON.stringify({ docs: { "900": 1 } });
      sembrarDia(almacen, c.api, function (reg) { reg.toasts = [AHORA - 2 * HORA_MS]; });
      const g = grabadora();
      const r = c.api.avisoPacEval([cita("810", "Presupuesto Lleno", "14:00")], { ahora: AHORA, toast: g.toast });
      t.igual(r.toasts, 1, "el toast de hace 2 h no consume presupuesto");
    });

    t.caso("B5 dedup entre pestañas: lo ya anunciado por el navegador no se repite", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const hoy = c.api.todayStamp();
      // Otra pestaña acaba de tostar esta cita (registro vgl_vistos del día).
      almacen["vgl_vistos"] = JSON.stringify({ _dia: hoy, "avisoPac|820@15:00": AHORA - 5000 });
      almacen["vgl_aviso_hist_201"] = JSON.stringify({ docs: { "900": 1 } });
      const g = grabadora();
      const r = c.api.avisoPacEval([cita("820", "Ya Anunciado", "15:00")], { ahora: AHORA, toast: g.toast });
      t.igual(r.nuevos, 1, "queda contado");
      t.igual(r.toasts, 0, "pero el toast no se repite en esta pestaña");
      t.igual(g.llamadas.length, 0, "cero avisos duplicados");
    });

    t.caso("B5 memoria por médico: lo que vio Maryuris no lo vuelve nuevo para Brandon", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      c.api.avisoPacEval([cita("111", "Ana Compartida", "8:00")], { ahora: AHORA, toast: grabadora().toast });
      // MISMO navegador, OTRO médico: su histórico está vacío → bootstrap.
      conDoctor(c.api, 101, "Brandon Jesús Palencia Martínez");
      const g2 = grabadora();
      const r2 = c.api.avisoPacEval([cita("111", "Ana Compartida", "8:00")], { ahora: AHORA + 1000, toast: g2.toast });
      t.cierto(r2.bootstrap, "el histórico de Brandon arranca vacío");
      t.igual(r2.toasts, 0, "y su primer día también es silencioso");
      t.cierto(!!almacen["vgl_aviso_hist_201"] && !!almacen["vgl_aviso_hist_101"], "dos memorias separadas");
    });

    t.caso("B5 filas sin cédula: no se aprenden ni se avisan", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const g = grabadora();
      const r = c.api.avisoPacEval([cita("", "Sin Documento", "8:00"), cita("   ", "Solo Espacios", "8:30")],
        { ahora: AHORA, toast: g.toast });
      t.cierto(r.bootstrap, "nada se aprendió de filas sin cédula");
      t.igual(r.nuevos, 0, "sin cédula no hay memoria posible");
      const hist = leer(almacen, "vgl_aviso_hist_201");
      t.igual(hist, null, "ni siquiera escribió el histórico");
    });

    t.caso("B5 poda: sobre 2000 conocidos, el histórico se queda en los 1500 más recientes", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      const docs = {};
      for (let i = 0; i < 2005; i++) docs["viejo" + i] = i;   // ordenados del más viejo al más nuevo
      almacen["vgl_aviso_hist_201"] = JSON.stringify({ docs: docs });
      const r = c.api.avisoPacEval([cita("950", "La Que Poda", "16:00")], { ahora: AHORA, toast: grabadora().toast });
      t.igual(r.nuevos, 1, "la nueva cuenta");
      const hist = leer(almacen, "vgl_aviso_hist_201");
      t.cierto(Object.keys(hist.docs).length <= 1500, "el histórico se podó");
      t.cierto(hist.docs["viejo2004"] !== undefined, "conserva lo más reciente");
      t.falso(hist.docs["viejo0"] !== undefined, "suelta lo más viejo");
    });

    t.caso("B5 limpieza: las claves datadas de días pasados se barren al empezar el día", () => {
      const almacen = almPadron({ "vgl_aviso_pacientes_2000-01-01": JSON.stringify({ dia: "2000-01-01", avisados: {}, toasts: [], nuevos: [] }) });
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      c.api.avisoPacEval([cita("960", "Dia Nuevo", "7:00")], { ahora: AHORA, toast: grabadora().toast });
      t.falso(("vgl_aviso_pacientes_2000-01-01" in almacen), "la clave del día viejo se fue");
      t.cierto(("vgl_aviso_pacientes_" + c.api.todayStamp()) in almacen, "la del día de hoy quedó");
    });

    t.caso("B5 rodamiento del tick: evaluar tras una lectura vacía o sin capacidad no rompe", () => {
      const almacen = almPadron();
      const c = cargar({ silencioso: true, almacen: almacen });
      conDoctor(c.api, 201, "Maryuris Terán");
      t.igual(c.api.avisoPacEval([], { ahora: AHORA, toast: grabadora().toast }), null, "agenda vacía: nada que hacer");
      t.igual(c.api.avisoPacEval(null, { ahora: AHORA, toast: grabadora().toast }), null, "lectura fallida (null): nada que hacer");
      // Sin opts (camino real de tickApi): no debe lanzar aunque el toast sea el de verdad.
      const r = c.api.avisoPacEval([cita("970", "Camino Real", "17:00")]);
      t.cierto(r && typeof r.nuevos === "number", "el camino sin opts responde");
    });
  },
};
