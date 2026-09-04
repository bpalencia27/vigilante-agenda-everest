// =====================================================================
//  SUITE 62 — v15.9.0: módulo de cierre de la cita (imprimir / correo /
//             recordatorio de la toma) y aviso de fecha que deja vencer
//             un examen
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que al terminar de agendar el
//  médico vea el MISMO cierre que ya conoce de Everest —con sus dos
//  salidas— y que ninguna fecha deje un examen vencido sin que se le diga.
//
//  Decisiones del médico (20-08-2026):
//   · la llamada de «enviar al correo» NO se adivina: se captura y se pega;
//     mientras tanto el botón lo dice de frente y ofrece la impresión;
//   · el recordatorio de la toma lleva SOLO datos de la cita (nada clínico
//     sin confirmar), porque en AppCita ese papel no existe;
//   · el aviso de vencimiento sale en los DOS momentos (al elegir y al
//     confirmar) y su referencia es SIEMPRE la fecha de la toma.
// =====================================================================

module.exports = {
  nombre: "v15.9.0 — cierre de cita (imprimir/correo/toma) y aviso de vencimiento",
  cubre: [
    "citaDetalleHoy", "abrirRecordatorioCita", "_cancelarCitaConPregunta",
    "markCitaAgendadaHoy", "vglNotificarCompletado", "_anularCitaMarcasLocales",
    "mtrAvisoVencimiento", "mtrLabsPrimeroVencimientoInevitable", "_recordatorioLabHtml", "imprimirRecordatorioLab",
    "mtrNotaTomaQuedoHtml", "mtrPegarNotaTomaQuedo", "mtrSedeIdLab",
    "_urlCorreoCita", "_correoValido", "enviarRecordatorioCitaPorCorreo",
    "mostrarPanelPostCita", "_celularValido", "reenviarSmsRecordatorio",
  ],

  async pruebas(t, api, env, cargar) {
    // v18.1.0 — B4 (Misión B, capa c): reenviarSmsRecordatorio y la anulación
    // ESCRIBEN en Everest (EnviarSMS/CancelarCita → agendar_control) y la capa c
    // re-comprueba el perfil justo antes de salir a la red; un contexto sin
    // padrón resuelve a PÚBLICO y el reenvío/cancelación no salen. Estas pruebas
    // corren «como el dueño del perfil»: se siembra en TODOS los contextos la
    // lista `vgl_acceso_lista` (uid 707 en COMPLETO, como la dejaría el fetch de
    // B2) y una identidad por defecto; un caso que fije SU doctor después de
    // cargar sigue mandando (la asignación posterior pisa este default).
    const _cargarAccesoBase = cargar;
    cargar = (opciones) => {
      const opts = Object.assign({}, opciones || {});
      if (!opts.almacen) opts.almacen = {};
      if (!("vgl_acceso_lista" in opts.almacen)) {
        opts.almacen.vgl_acceso_lista = JSON.stringify({
          version: "test-62.acceso-b4",
          perfiles: {
            COMPLETO: [{ uid: 707, nombre: "Brandon Jesús Palencia Martínez" }],
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
    const c = cargar({ silencioso: true });
    const a = c.api;

    // Nodos falsos con querySelector memoizado (mismo truco que la suite 15).
    const enriquecer = (car) => {
      const doc = car.env.doc;
      const base = doc.createElement;
      doc.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, doc.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
    };
    const disparar = (nodo, tipo) => {
      const ls = nodo && nodo._listeners && nodo._listeners[tipo];
      if (ls && ls.length) ls[0]({ preventDefault() {}, stopPropagation() {} });
    };

    // ============ EL AVISO DE VENCIMIENTO (motor puro) ============

    const plan = {
      ftl: "2026-11-20",
      control: { fecha: "2026-11-27" },
      vencidos: [], faltantes: [],
      drivers: [
        { clave: "CREATININA", nombre: "Creatinina sérica", estado: "D", vence: "2026-11-20" },
        { clave: "HBA1C", nombre: "Hemoglobina glicosilada", estado: "D", vence: "2027-01-10" },
        { clave: "RAC", nombre: "Relación albúmina/creatinina", estado: "R", vence: "2026-12-05" },
      ],
      pasajeros: [],
    };

    t.caso("aviso: una toma DENTRO de la vigencia no molesta a nadie", () => {
      t.igual(a.mtrAvisoVencimiento(plan, "2026-11-19"), null, "un día antes del vencimiento: nada que avisar");
      t.igual(a.mtrAvisoVencimiento(plan, "2026-11-20"), null, "el día EXACTO del vencimiento todavía sirve");
    });

    t.caso("aviso: una toma tardía nombra el examen, los días de más y el resto que también vence", () => {
      const av = a.mtrAvisoVencimiento(plan, "2026-12-10");
      t.cierto(!!av, "hay aviso");
      t.igual(av.analito, "Creatinina sérica", "nombra el que vence PRIMERO");
      t.igual(av.vence, "2026-11-20", "con su fecha de vencimiento");
      t.igual(av.diasDeMas, 20, "y cuántos días tarde quedaría la toma");
      t.igual(av.cuantos, 2, "cuenta también la RAC, que vence el 5 de diciembre");
      t.cierto(av.texto.includes("Creatinina sérica"), "el texto lo dice en lenguaje de consultorio");
      t.cierto(av.texto.includes("llegaría vencido"), "…y explica la consecuencia");
      t.falso(av.texto.includes("driver") || av.texto.includes("estado"), "cero jerga interna");

      // v18.0.65 — ORDEN DEL MÉDICO (01-sep): «SOLO QUIERO SIMPLIFICAR LO MÁS POSIBLE EL
      // MÓDULO YA QUE MUY POCO LO USAN Y SI LO ABARROTAMOS DE TEXTO MENOS LO USARÍAN». El
      // aviso decía en tres frases lo que cabe en una, y repetía la fecha de la toma que el
      // recuadro de arriba ya mostraba — el médico lo leyó como dos textos contradictorios.
      t.falso(av.texto.includes("Con esa fecha"),
        "ya no abre repitiendo la fecha que el recuadro de arriba acaba de decir");
      t.falso(av.texto.includes("toma de laboratorios quedaría"),
        "ni repite la fecha de la toma: era la mitad de la contradicción que él reportó");
      t.cierto(av.texto.length <= 160,
        "y cabe en una línea: " + av.texto.length + " caracteres — " + av.texto);
      t.cierto(av.texto.includes("20 día"), "sin perder el dato que le sirve para decidir: cuántos días de más");
    });

    t.caso("aviso: sin plan, sin fecha o sin exámenes vigilados NO se inventa nada", () => {
      t.igual(a.mtrAvisoVencimiento(null, "2026-12-10"), null, "sin plan");
      t.igual(a.mtrAvisoVencimiento(plan, ""), null, "sin fecha");
      t.igual(a.mtrAvisoVencimiento(plan, "fecha-rota"), null, "fecha ilegible");
      t.igual(a.mtrAvisoVencimiento({ drivers: [] }, "2026-12-10"), null, "nada que vigilar");
      t.igual(a.mtrAvisoVencimiento({ drivers: [{ clave: "RAC", nombre: "RAC", estado: "A", vence: "2026-01-01" }] }, "2026-12-10"),
        null, "un examen que YA está vencido no es un aviso de esta fecha: eso ya lo maneja labs-primero");
    });

    t.caso("aviso: la referencia es la TOMA, no la consulta (decisión del médico)", () => {
      // Misma consulta (10-dic) pero la toma se adelanta: el aviso desaparece.
      t.cierto(!!a.mtrAvisoVencimiento(plan, "2026-12-10"), "con la toma tardía, avisa");
      t.igual(a.mtrAvisoVencimiento(plan, "2026-11-18"), null, "con la toma a tiempo, la misma consulta ya no genera aviso");
    });

    // =====================================================================
    // v17.0.3 — REPORTE DE CAMPO: "EL MISMO ME SUGIRIÓ 11 DE SEPTIEMBRE Y AHORA ME DICE
    // QUE PARA ESA FECHA YA LA GLICEMIA ESTÁ VENCIDA, YO DE VERDAD NO ENTIENDO ESTE
    // DESORDEN". En modo labs-primero la toma no puede agendarse antes de 14 días desde
    // hoy (mtrPlanLabsPrimero.labMinIso) ni después de 21 (labMaxIso). Si un examen
    // vigilado ya venció (o vence) ANTES de esos 14 días, NINGUNA fecha dentro de esa
    // ventana puede evitarlo — el botón "Pasar a la fecha sugerida" del modal prometía
    // arreglarlo mudando la fecha de CONTROL, que nunca fue la causa del aviso. Esta suite
    // fija la propiedad de la que depende el arreglo: mtrAvisoVencimiento es monótona en la
    // fecha (cuantos más días pasen, más exámenes caen vencidos, nunca menos), así que basta
    // revisar la fecha MÁS TEMPRANA posible (labMinIso) para saber si hay alguna salida.
    // =====================================================================
    t.caso("mtrLabsPrimeroVencimientoInevitable (v17.0.3): si la fecha más temprana permitida YA deja vencer un examen, ninguna fecha posterior dentro de la ventana lo evita", () => {
      // Caso real reportado: hoy 2026-08-21, Glicemia vence 2026-08-24 (a solo 3 días),
      // pero la toma no puede agendarse antes de labMinIso = 2026-09-04 (14 días).
      const planGlicemia = {
        ftl: "2026-08-24", vencidos: [], faltantes: [],
        drivers: [{ clave: "GLICEMIA", nombre: "Glicemia", estado: "D", vence: "2026-08-24", subestado: "vigente", diasParaVencer: 3 }],
        pasajeros: [],
      };
      const lp = a.mtrPlanLabsPrimero(planGlicemia, "2026-08-21");
      // v17.1.0 (#137) — las aserciones se mudan a `pisoNormalIso`: `labMinIso` ya NO es
      // el piso de 14 días cuando el vencimiento lo hace imposible. La función que se
      // prueba aquí sigue significando lo mismo — «¿el piso NORMAL deja vencer algo?» —,
      // lo que cambió es que ahora alguien actúa sobre su respuesta en vez de solo
      // informarla. Ver el caso #137 en suite_24, que fija el comportamiento nuevo.
      t.igual(lp.pisoNormalIso, "2026-09-04", "fijamos el fixture: el piso de 14 días cae el 4 de sep");
      t.igual(lp.labMaxIso, "2026-09-11", "y el techo de 21 días cae el 11 de sep — la fecha que el modal ofrecía como «arreglo»");
      t.cierto(a.mtrLabsPrimeroVencimientoInevitable(planGlicemia, lp.pisoNormalIso),
        "inevitable EN EL PISO NORMAL: Glicemia ya venció 11 días antes de esa fecha");
      t.cierto(lp.pisoRelajado, "y por eso el piso cede");
      // v18.0.130 — decisión del médico (reporte en vivo del 02-sep): el piso urgente nunca baja
      // de 7 días calendario, porque «por lo general en esos casos no hay citas de exámenes».
      // Antes esto era "2026-08-24" —el vencimiento mismo, a 3 días—; ahora es el día 7. Lo que
      // se pierde es real y él lo decidió sabiéndolo: una fecha sin cupo no salva ningún examen.
      t.igual(lp.labMinIso, "2026-08-28", "la toma se adelanta hasta donde la deja el piso de 7 días, no más");
      const _d = Math.round((new Date(lp.labMinIso + "T00:00:00") - new Date("2026-08-21T00:00:00")) / 86400000);
      t.cierto(_d >= 7 && _d <= 14, "y cae dentro de la ventana urgente [7,14]: " + _d + " d");
      // La propiedad de monotonía en la que se apoya el arreglo: TODA fecha dentro de la
      // ventana (no solo el techo) sigue mostrando el aviso — nunca "se arregla sola".
      for (const d of ["2026-09-05", "2026-09-08", lp.labMaxIso]) {
        t.cierto(!!a.mtrAvisoVencimiento(planGlicemia, d), "sigue vencido en " + d + ": ninguna fecha de la ventana escapa");
      }
    });

    t.caso("mtrLabsPrimeroVencimientoInevitable: cuando SÍ hay una fecha dentro de la ventana que evita el vencimiento, no se declara inevitable", () => {
      // Un examen que vence bien adentro de la ventana (o después): labMinIso todavía sirve.
      const planSano = {
        ftl: "2026-09-10", vencidos: [], faltantes: [],
        drivers: [{ clave: "GLICEMIA", nombre: "Glicemia", estado: "D", vence: "2026-09-10", subestado: "vigente", diasParaVencer: 20 }],
        pasajeros: [],
      };
      const lp = a.mtrPlanLabsPrimero(planSano, "2026-08-21");
      t.falso(a.mtrLabsPrimeroVencimientoInevitable(planSano, lp.labMinIso),
        "labMinIso (4 sep) es ANTES de que venza Glicemia (10 sep): sí hay salida, no es inevitable");
    });

    t.caso("mtrLabsPrimeroVencimientoInevitable: sin plan o sin aviso, no inventa un problema", () => {
      t.falso(a.mtrLabsPrimeroVencimientoInevitable(null, "2026-09-04"), "sin plan");
      t.falso(a.mtrLabsPrimeroVencimientoInevitable({ drivers: [] }, "2026-09-04"), "nada que vigilar");
    });

    // ============ EL RECORDATORIO DE LA TOMA (lo que AppCita no imprime) ============

    t.caso("recordatorio de la toma: lleva los datos de la cita y NADA clínico inventado", () => {
      const html = a._recordatorioLabHtml({
        nombre: "PACIENTE DE PRUEBA", documento: "111111111",
        fechaLegible: "mar 25 ago", hora: "07:00 AM", sede: "Sede Norte", radicado: "13525848",
      });
      t.cierto(html.includes("Recordatorio de toma de laboratorio"), "título");
      t.cierto(html.includes("PACIENTE DE PRUEBA") && html.includes("111111111"), "paciente y documento");
      t.cierto(html.includes("mar 25 ago") && html.includes("07:00 AM"), "fecha y hora");
      t.cierto(html.includes("Sede Norte") && html.includes("13525848"), "sede y número de la cita");
      t.cierto(html.includes("Consulte en el laboratorio la preparación"), "la preparación se consulta: no se inventa");
      t.falso(/ayuno de \d/.test(html), "ninguna instrucción clínica concreta sin confirmar");
    });

    t.caso("recordatorio de la toma: sin sede confirmada, dice el lugar de forma honesta y no deja filas vacías", () => {
      const html = a._recordatorioLabHtml({ nombre: "X", fechaIso: "2026-08-25" });
      t.cierto(html.includes("Laboratorio de la IPS"), "lugar por defecto, sin inventar una dirección");
      t.falso(html.includes("<th>Hora</th>"), "una fila sin dato simplemente no se imprime");
    });

    t.caso("recordatorio de la toma: el nombre del paciente va escapado (nunca se ejecuta lo que traiga)", () => {
      const html = a._recordatorioLabHtml({ nombre: '<img src=x onerror="alert(1)">' });
      t.falso(html.includes("<img"), "la etiqueta quedó neutralizada");
      t.cierto(html.includes("&lt;img"), "…escapada, no borrada");
    });

    await t.casoAsync("imprimir la toma: abre una pestaña, escribe el documento y manda a imprimir", async () => {
      const c2 = cargar({ silencioso: true });
      const abiertas = [];
      c2.env.win.open = () => {
        const w = { escrito: "", impreso: 0, focus() {}, print() { this.impreso++; },
          document: { open() {}, close() {}, write(t2) { w.escrito += t2; } } };
        abiertas.push(w); return w;
      };
      const ok = c2.api.imprimirRecordatorioLab({ nombre: "PACIENTE DE PRUEBA", fechaIso: "2026-08-25" });
      t.cierto(ok, "reporta que abrió");
      t.igual(abiertas.length, 1, "una sola pestaña");
      t.cierto(abiertas[0].escrito.includes("Recordatorio de toma"), "con el documento dentro");
      await new Promise((r) => setTimeout(r, 420));
      t.igual(abiertas[0].impreso, 1, "y lanza la impresión del navegador");
    });

    t.caso("imprimir la toma: si el navegador bloquea la pestaña, se dice que no (no se finge éxito)", () => {
      const c3 = cargar({ silencioso: true });
      c3.env.win.open = () => null;
      t.falso(c3.api.imprimirRecordatorioLab({ nombre: "X" }), "sin pestaña, no hay impresión");
    });

    // ============ EL ENVÍO POR CORREO (nunca se adivina la llamada) ============

    t.caso("_correoValido: filtra lo que claramente no es un correo", () => {
      t.cierto(a._correoValido("paciente@correo.com"), "correo normal");
      t.falso(a._correoValido("paciente@correo"), "sin dominio completo");
      t.falso(a._correoValido("paciente correo.com"), "sin arroba");
      t.falso(a._correoValido(""), "vacío");
    });

    t.caso("_urlCorreoCita: arma la llamada capturada por el administrador, con todo codificado", () => {
      const u = a._urlCorreoCita(
        "https://neps.ejemplo/api/EnviarEmailCita?CitaId={citaId}&Correo={correo}&Eps={eps}&Usuario={usuarioId}",
        { citaId: 7813686, correo: "paciente@correo.com", eps: "NUEVA EPS ", usuarioId: 123 });
      t.cierto(u.includes("CitaId=7813686"), "el número de la cita");
      t.cierto(u.includes("Correo=paciente%40correo.com"), "el correo, codificado");
      t.cierto(u.includes("Eps=NUEVA%20EPS%20"), "la EPS, codificada tal cual");
      t.falso(u.includes("{"), "no queda ningún comodín sin reemplazar");
    });

    t.caso("_urlCorreoCita: sin plantilla capturada NO se inventa ninguna dirección", () => {
      t.igual(a._urlCorreoCita("", { citaId: 1 }), "", "vacío");
      t.igual(a._urlCorreoCita("   ", { citaId: 1 }), "", "solo espacios");
    });

    t.caso("_urlCorreoCita: una ruta relativa se cuelga del propio Everest, no de un tercero", () => {
      const u = a._urlCorreoCita("/apiviva/APIEnvioCorreo/api/EnvioCorreo/X?CitaId={citaId}", { citaId: 5 });
      t.cierto(u.indexOf("http") === 0, "queda absoluta");
      t.cierto(u.includes("/apiviva/APIEnvioCorreo/"), "conservando la ruta capturada");
    });

    await t.casoAsync("enviar por correo: sin configurar avisa «sin_configurar» y no llama a nadie", async () => {
      const c4 = cargar({ silencioso: true, gmxhr: () => { throw new Error("no debería llamarse"); } });
      c4.api.__S.correoCitaUrl = "";
      const r = await c4.api.enviarRecordatorioCitaPorCorreo({ citaId: 1, correo: "p@correo.com" });
      t.falso(r.ok, "no se envió");
      t.igual(r.motivo, "sin_configurar", "y se dice por qué");
    });

    await t.casoAsync("enviar por correo: con la llamada capturada, un 200 es éxito y un 500 NO se canta como enviado", async () => {
      const vistas = [];
      const c5 = cargar({
        silencioso: true,
        gmxhr: (o) => { vistas.push(o.url); o.onload({ status: vistas.length === 1 ? 200 : 500, responseText: "" }); },
      });
      c5.api.__S.correoCitaUrl = "https://neps.ejemplo/api/EnviarEmailCita?CitaId={citaId}&Correo={correo}";
      const ok = await c5.api.enviarRecordatorioCitaPorCorreo({ citaId: 99, correo: "p@correo.com" });
      t.cierto(ok.ok, "el 200 sí es envío");
      t.cierto(vistas[0].includes("CitaId=99"), "llamó con los datos de ESTA cita");
      const mal = await c5.api.enviarRecordatorioCitaPorCorreo({ citaId: 99, correo: "p@correo.com" });
      t.falso(mal.ok, "el 500 no se anuncia como enviado");
      t.cierto(mal.motivo.includes("500"), "y el motivo dice el estado real");
    });

    await t.casoAsync("enviar por correo: un correo mal escrito se detiene ANTES de llamar al servicio", async () => {
      const vistas = [];
      const c6 = cargar({ silencioso: true, gmxhr: (o) => { vistas.push(o.url); o.onload({ status: 200, responseText: "" }); } });
      c6.api.__S.correoCitaUrl = "https://neps.ejemplo/api/X?Correo={correo}";
      const r = await c6.api.enviarRecordatorioCitaPorCorreo({ citaId: 1, correo: "no-es-correo" });
      t.falso(r.ok, "no se envía");
      t.igual(r.motivo, "correo_invalido", "se dice qué revisar");
      t.igual(vistas.length, 0, "y no se molestó al servidor");
    });

    // ============ EL MÓDULO DE CIERRE (gemelo del de Everest) ============

    // v16.1.0 — CORRECCIÓN DEL MÉDICO: «las citas de control Everest no las envía al
    // correo sino al teléfono celular». El segundo botón es el mensaje de texto, y esa
    // llamada sí está capturada (la misma que se usa al crear la cita).

    t.caso("_celularValido: acepta un celular colombiano y rechaza lo que no lo es", () => {
      t.cierto(a._celularValido("3001112223"), "celular normal");
      t.cierto(a._celularValido("300 111 2223"), "con espacios también");
      t.falso(a._celularValido("31050"), "demasiado corto");
      t.falso(a._celularValido(""), "vacío");
    });

    await t.casoAsync("reenviar el mensaje: usa la llamada REAL de Everest, con el turno de esta cita", async () => {
      const vistas = [];
      const cSms = cargar({ silencioso: true, fetch: async (url) => { vistas.push(String(url)); return { ok: true, status: 200 }; } });
      const r = await cSms.api.reenviarSmsRecordatorio("300 111 2223", 4335812);
      t.cierto(r.ok, "se envió");
      t.cierto(vistas[0].indexOf("/apiviva/APIAcceso/api/SMS/EnviarSMS") >= 0, "el endpoint capturado de siempre");
      t.cierto(vistas[0].indexOf("Telefono=3001112223") >= 0, "el número, solo dígitos");
      t.cierto(vistas[0].indexOf("AgendaTurnoId=4335812") >= 0, "y el turno de ESTA cita");
    });

    await t.casoAsync("reenviar el mensaje: sin turno o con número malo NO se molesta al servidor", async () => {
      const vistas = [];
      const cSms = cargar({ silencioso: true, fetch: async (url) => { vistas.push(String(url)); return { ok: true, status: 200 }; } });
      const sinTurno = await cSms.api.reenviarSmsRecordatorio("3001112223", "");
      t.igual(sinTurno.motivo, "sin_turno", "sin turno se dice por qué");
      const malCel = await cSms.api.reenviarSmsRecordatorio("123", 4335812);
      t.igual(malCel.motivo, "celular_invalido", "número incompleto se detiene antes");
      t.igual(vistas.length, 0, "ninguna de las dos llamó al servicio");
    });

    await t.casoAsync("reenviar el mensaje: una respuesta de error NO se canta como enviada", async () => {
      const cSms = cargar({ silencioso: true, fetch: async () => ({ ok: false, status: 500 }) });
      const r = await cSms.api.reenviarSmsRecordatorio("3001112223", 4335812);
      t.falso(r.ok, "no se anuncia como enviado");
      t.cierto(r.motivo.indexOf("500") >= 0, "y el motivo trae el estado real");
    });

    // v17.0.3 — REPORTE DE CAMPO: el médico probó este botón con su propio celular y el
    // mensaje no llegó. No hay captura real de un cuerpo de fallo de este endpoint (ver el
    // comentario junto a la función), así que el criterio de éxito no cambia — pero ahora
    // se lee y registra el cuerpo de la respuesta para poder diagnosticar la próxima vez.
    // Estas pruebas protegen que esa lectura nueva no rompa nada, con o sin `.text()`.
    await t.casoAsync("reenviar el mensaje: si el servidor SÍ trae cuerpo legible, se lee sin romper el resultado", async () => {
      const cSms = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, text: async () => '{"resultado":"ok"}' }) });
      const r = await cSms.api.reenviarSmsRecordatorio("3001112223", 4335812);
      t.cierto(r.ok, "se sigue anunciando como enviado (2xx)");
    });

    await t.casoAsync("reenviar el mensaje: un cuerpo que revienta al leerse no tumba la función", async () => {
      const cSms = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, text: async () => { throw new Error("stream roto"); } }) });
      const r = await cSms.api.reenviarSmsRecordatorio("3001112223", 4335812);
      t.cierto(r.ok, "el estado 2xx manda igual, aunque el cuerpo no se pueda leer");
    });

    await t.casoAsync("reenviar el mensaje: sin `.text()` en la respuesta (como los mocks de siempre) tampoco rompe nada", async () => {
      const cSms = cargar({ silencioso: true, fetch: async () => ({ ok: false, status: 500 }) });
      const r = await cSms.api.reenviarSmsRecordatorio("3001112223", 4335812);
      t.falso(r.ok, "sigue sin anunciarse como enviado");
      t.cierto(r.motivo.indexOf("500") >= 0, "con el estado real en el motivo");
    });

    // =====================================================================
    // v17.6.2 — CRITERIO DE ÉXITO REAL DEL SMS. Reporte del médico del 22-ago:
    // «el paciente dice que no le llega». La captura del 2026-08-10
    // (captura_agendamiento_oficial_20260810.json) muestra que EnviarSMS responde
    // {"error":false,"mensaje":"Se ha enviado un SMS con pasos de redirección"} —
    // el éxito es error:false en el CUERPO, no solo el estado HTTP. Un 200 con
    // error:true es un rechazo del proveedor que hasta aquí se anunciaba como
    // «enviado». El cuerpo manda cuando trae `error` explícito; sin cuerpo legible
    // o sin campo error, se conserva el 2xx de siempre (cautela v17.0.3).
    // =====================================================================
    await t.casoAsync("reenviar el mensaje: un 200 con error:true en el cuerpo NO se canta como enviado (la captura real lo rechaza)", async () => {
      const cSms = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, text: async () => '{"error":true,"mensaje":"El proveedor rechazó el envío","data":null}' }) });
      const r = await cSms.api.reenviarSmsRecordatorio("3001112223", 4335812);
      t.falso(r.ok, "el estado 200 solo no basta: error:true en el cuerpo es rechazo");
      t.cierto(r.motivo.indexOf("rechazado por el proveedor") >= 0, "y el motivo dice qué pasó");
      t.cierto(r.motivo.indexOf("proveedor rechazó") >= 0, "con el mensaje real del servidor");
    });

    await t.casoAsync("reenviar el mensaje: el cuerpo EXACTO de la captura real (error:false) sí se anuncia como enviado", async () => {
      const cSms = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, text: async () => '{"error":false,"mensaje":"Se ha enviado un SMS con pasos de redirección","data":null,"imprimir":false,"valor":0,"link":null}' }) });
      const r = await cSms.api.reenviarSmsRecordatorio("3009876543", 4335812);
      t.cierto(r.ok, "con error:false explícito, se anuncia como enviado");
      t.igual(r.motivo, "", "sin motivo de error");
    });

    await t.casoAsync("reenviar el mensaje: un cuerpo que no es JSON conserva el criterio 2xx (no inventa un rechazo)", async () => {
      const cSms = cargar({ silencioso: true, fetch: async () => ({ ok: true, status: 200, text: async () => "texto plano raro" }) });
      const r = await cSms.api.reenviarSmsRecordatorio("3001112223", 4335812);
      t.cierto(r.ok, "sin JSON legible no hay cómo saber que falló: se conserva el 2xx");
    });

    t.caso("v17.6.2 — el panel post-cita SÍ tiene dónde escribir el feedback del botón «Enviar mensaje» (reporte del 22-ago: botón muerto)", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      // Antes el feedback del botón de SMS se escribía en #vgl-postcita-mailnota, un id
      // retirado con el botón de correo (v17.1.0 #147): el clic hacía la llamada pero nada
      // se veía. Ahora el panel trae un nodo propio en la caja de SMS y el botón escribe ahí.
      t.cierto(/id="vgl-postcita-smsnota"/.test(src), "el panel trae el nodo de nota del SMS");
      t.cierto(/querySelector\("#vgl-postcita-smsnota"\)/.test(src), "y el botón de SMS escribe ahí, no en el id muerto del correo");
      // El bloque de correo retirado (v17.1.0) queda deliberadamente inerte y aparte — con
      // su propio id muerto — para el día que exista la captura de esa llamada. Lo que esta
      // prueba fija es que la nota del botón de SMS no pase por ahí.
      const posSmsGo = src.indexOf("smsGo.addEventListener");
      const posNotaSms = src.indexOf("querySelector(\"#vgl-postcita-smsnota\")");
      t.cierto(posSmsGo > 0 && posNotaSms > 0 && posNotaSms < posSmsGo + 400,
        "la nota del botón de SMS está cableada dentro de su propio bloque, cerca del botón");
    });

    t.caso("cierre: tras crear la cita salen las DOS salidas que el médico ya conoce", () => {
      const c7 = cargar({ silencioso: true });
      enriquecer(c7);
      c7.api.mostrarPanelPostCita(7813686, "NUEVA EPS", "PACIENTE DE PRUEBA", "respaldo", {
        cita: { fechaLegible: "25/08/2026", hora: "07:00 AM", servicio: "Medicina General (Control)" },
        pacienteId: 777, documento: "111111111",
        // v16.2.4 — el turnoId ahora decide si el control de mensaje se DIBUJA (antes se
        // dibujaba siempre y solo al pulsarlo se descubría que no servía). Esta prueba es
        // la ruta feliz: la cita sí dejó su número interno.
        turnoId: 4335812,
      });
      const panel = c7.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.cierto(!!panel, "el módulo aparece");
      const html = panel.innerHTML;
      t.cierto(html.includes("Imprimir recordatorio"), "salida 1: imprimir");
      t.cierto(html.includes("celular"), "salida 2: el mensaje de texto al celular, que es lo que Everest usa");
      t.falso(html.includes("Enviar al correo del paciente"), "el correo NO se le ofrece al médico: Everest no manda estas citas por correo");
      t.cierto(html.includes("25/08/2026") && html.includes("07:00 AM"), "con el contexto de la cita, como en Everest");
      t.cierto(html.includes("Medicina General"), "y el servicio");
    });

    t.caso("cierre: si la cita no dejó su número interno, el mensaje no se ofrece a ciegas", () => {
      const c8 = cargar({ silencioso: true });
      enriquecer(c8);
      c8.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE", "respaldo", {});   // sin turnoId
      const panel = c8.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      // v16.2.4 — Antes había que PULSAR el botón para enterarse de que no servía. Ahora
      // el control sencillamente no se dibuja y el aviso ya está puesto: el médico no
      // gasta un clic en una salida muerta.
      const htmlSin = panel.innerHTML;
      t.falso(htmlSin.includes("vgl-postcita-smsgo"), "no se ofrece un botón que no puede funcionar");
      t.falso(htmlSin.includes("Reenviar el recordatorio"), "ni su rótulo");
      t.cierto(htmlSin.includes("vgl-postcita-smsnota"), "en su lugar queda el aviso");
      t.cierto(htmlSin.includes("recordatorio impreso"), "remite a la salida que sí funciona");
      t.falso(htmlSin.includes("turnoId") || htmlSin.includes("null"), "sin jerga técnica");
    });

    t.caso("cierre: el celular usado al crear la cita llega escrito en el campo", () => {
      const c8b = cargar({ silencioso: true });
      enriquecer(c8b);
      c8b.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE", "respaldo", { turnoId: 4335812, celular: "3001112223" });
      const panel = c8b.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.cierto(panel.innerHTML.includes("3001112223"), "el número ya viene puesto: no hay que volver a escribirlo");
    });

    t.caso("cierre: cuando también se agendó la toma, aparece su recordatorio imprimible", () => {
      const c9 = cargar({ silencioso: true });
      enriquecer(c9);
      const abiertas = [];
      c9.env.win.open = () => {
        const w = { escrito: "", focus() {}, print() {}, document: { open() {}, close() {}, write(x) { w.escrito += x; } } };
        abiertas.push(w); return w;
      };
      c9.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE DE PRUEBA", "respaldo", {
        documento: "111111111",
        lab: { fechaIso: "2026-08-25", fechaLegible: "25/08/2026", hora: "07:00 AM", radicado: "13525848" },
      });
      const panel = c9.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.cierto(panel.innerHTML.includes("Toma de laboratorio"), "la sección de la toma está");
      disparar(panel.querySelector("#vgl-postcita-labprint"), "click");
      t.igual(abiertas.length, 1, "imprime el recordatorio de la toma");
      t.cierto(abiertas[0].escrito.includes("13525848"), "con el número que devolvió AppCita");
      t.cierto(abiertas[0].escrito.includes("111111111"), "y el documento del paciente");
    });

    t.caso("cierre en SOLO Laboratorios: solo la toma — sin botones de una cita que no existe", () => {
      const c10 = cargar({ silencioso: true });
      enriquecer(c10);
      c10.api.mostrarPanelPostCita("lab-13525848", "", "PACIENTE", "respaldo", {
        soloLab: true, documento: "111111111",
        lab: { fechaIso: "2026-08-25", fechaLegible: "25/08/2026", hora: "07:00 AM", radicado: "13525848" },
      });
      const panel = c10.env.doc.body.children.find((n) => n.id === "vgl-postcita-panel");
      t.cierto(panel.innerHTML.includes("Toma de muestras agendada"), "el título habla de la toma");
      t.cierto(panel.innerHTML.includes("Imprimir recordatorio de la toma"), "con su recordatorio");
      t.falso(panel.innerHTML.includes("Enviar al correo"), "sin el correo de una cita que aquí no se creó");
      t.falso(panel.innerHTML.includes("recordatorio de cita"), "ni la impresión de la cita");
    });

    // ============ v17.1.0 (#147) — VOLVER AL RECORDATORIO DE UNA CITA YA ASIGNADA ============
    // Reporte del médico del 21-ago con capturas: «ya le asigné la cita y quiero regresar
    // al módulo para imprimirle el recordatorio, pero ya solamente aparece el de agendar
    // labs». El módulo de cierre existía desde la v15.9.0, pero solo se abría en el
    // instante de crear la cita, desde una variable en memoria que moría con el modal.
    t.caso("citaDetalleHoy: devuelve el detalle solo si hay radicado guardado", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.citaDetalleHoy("123"), null, "sin cita agendada, nada");
      c.api.markCitaAgendadaHoy("123", "2026-09-03", { hora: "07:00 AM", eps: "X", nombre: "N", fechaLegible: "03/09/2026" });
      t.igual(c.api.citaDetalleHoy("123"), null, "una cita SIN radicado tampoco: no se puede reabrir lo que Everest no reconoce");
      c.api.markCitaAgendadaHoy("456", "2026-09-03", { citaId: "R-99", pacienteId: "P1", hora: "07:00 AM", eps: "X", nombre: "N", fechaLegible: "03/09/2026" });
      const d2 = c.api.citaDetalleHoy("456");
      t.cierto(!!d2 && d2.citaId === "R-99", "con radicado sí");
      t.igual(d2.hora, "07:00 AM", "y con todo lo que el recordatorio necesita");
      t.igual(c.api.citaDetalleHoy(""), null, "sin documento no lanza");
    });

    // v17.6.70 — [reportado en consultorio, 26-ago-2026] BUG REAL: el flujo real de
    // agendamiento (openAgendamientoModal) llama a markCitaAgendadaHoy DOS veces para la
    // MISMA cita — primero con el `extra` completo (citaId/pacienteId/…), y enseguida
    // otra vez vía vglNotificarCompletado("cita_control", …), que NO pasa `extra`. Antes
    // del fix, la segunda llamada REEMPLAZABA el registro entero y borraba el citaId recién
    // guardado — citaDetalleHoy volvía a null y el médico se quedaba sin ninguna vía para
    // reabrir el recordatorio (ni para cancelar/reagendar), justo el bug reportado: con
    // solo la cita de control agendada (sin laboratorio), el dock solo ofrecía «Agendar
    // labs», sin ningún botón de vuelta.
    t.caso("markCitaAgendadaHoy + vglNotificarCompletado: la llamada de notificación (SIN extra) que sigue a la de creación (CON extra) no debe borrar el citaId/pacienteId ya guardados (bug real reportado en consultorio)", () => {
      const c = cargar({ silencioso: true });
      // 1) igual que openAgendamientoModal línea ~20759: se guarda el detalle completo.
      c.api.markCitaAgendadaHoy("999888777", "2026-08-26", {
        citaId: "R-500", pacienteId: "P-500", eps: "EPS X", hora: "08:00 AM",
        nombre: "N", fechaLegible: "26/08/2026",
      });
      t.cierto(!!c.api.citaDetalleHoy("999888777"), "recién creada, el recordatorio SÍ es reabrible");
      // 2) igual que la línea ~20788: vglNotificarCompletado("cita_control", …) SIN extra,
      // disparada inmediatamente después en el mismo flujo de creación.
      c.api.vglNotificarCompletado("cita_control", { doc: "999888777", fechaIso: "2026-08-26", hora: "08:00 AM" });
      const det = c.api.citaDetalleHoy("999888777");
      t.cierto(!!det, "tras la notificación posterior, el recordatorio SIGUE siendo reabrible (antes: se perdía)");
      t.igual(det.citaId, "R-500", "el citaId sobrevive a la segunda llamada");
      t.igual(det.pacienteId, "P-500", "el pacienteId también sobrevive (lo exige _anularCitaAsignadaReal para poder cancelar)");
      t.igual(det.eps, "EPS X", "y el resto del detalle guardado no se pierde");
    });

    t.caso("markCitaAgendadaHoy: una llamada posterior CON extra sigue pudiendo ACTUALIZAR/corregir un campo (fusiona, no ignora lo nuevo)", () => {
      const c = cargar({ silencioso: true });
      c.api.markCitaAgendadaHoy("1111", "2026-08-26", { citaId: "R-1", pacienteId: "P-1", hora: "08:00 AM" });
      c.api.markCitaAgendadaHoy("1111", "2026-08-26", { citaId: "R-1", pacienteId: "P-1", hora: "09:00 AM" });
      t.igual(c.api.citaDetalleHoy("1111").hora, "09:00 AM", "el extra nuevo sigue ganando sobre el viejo, no se queda pegado al primero");
    });

    t.caso("_anularCitaMarcasLocales: tras anular, el detalle viejo SÍ se borra (no queda colgado para la próxima cita del mismo paciente)", () => {
      const c = cargar({ silencioso: true });
      c.api.markCitaAgendadaHoy("2222", "2026-08-26", { citaId: "R-2", pacienteId: "P-2" });
      t.cierto(!!c.api.citaDetalleHoy("2222"));
      c.api._anularCitaMarcasLocales("2222");
      t.igual(c.api.citaDetalleHoy("2222"), null, "anulada, el registro desaparece del todo — la fusión de arriba no deja basura pegada");
    });

    t.caso("abrirRecordatorioCita: sin radicado guardado NO abre un panel vacío", () => {
      const c = cargar({ silencioso: true });
      let abierto = 0;
      c.env.doc.body.appendChild = () => { abierto++; };
      c.api.abrirRecordatorioCita({ doc_id: "999" });
      t.igual(abierto, 0, "no se pinta un recordatorio que no se puede llenar");
    });

    t.caso("el panel reabierto ofrece CANCELAR y ya NO ofrece «enviar al correo»", () => {
      // Decisión del médico del 21-ago: imprimir, reenviar SMS, ver los datos y cancelar.
      // «Enviar al correo» se retira: nunca funcionó (falta capturar la llamada real de
      // Everest) y un botón que solo puede avisar de que le falta configuración es ruido
      // en la ventana donde se está cerrando la cita.
      const c = cargar({ silencioso: true });
      let html = "";
      c.env.doc.body.appendChild = (n) => { html = String(n.innerHTML || ""); };
      c.api.mostrarPanelPostCita("R-1", "EPS X", "PACIENTE", "PACIENTE", {
        cita: { fechaLegible: "03/09/2026", hora: "07:00 AM", servicio: "CONTROL" },
        turnoId: "T1", celular: "3001112233", reabierto: true, onCancelar: () => true,
      });
      t.cierto(/vgl-postcita-cancelar/.test(html), "el botón de cancelar está");
      t.cierto(/Recordatorio de la cita/.test(html), "y el título dice que es un recordatorio, no una cita recién creada");
      t.cierto(/vgl-postcita-print/.test(html), "imprimir sigue");
      t.cierto(/vgl-postcita-smsgo/.test(html), "reenviar el mensaje también");
      t.cierto(html.indexOf("03/09/2026") >= 0 && html.indexOf("07:00 AM") >= 0, "y los datos de la cita a la vista");
      t.falso(html.indexOf('id="vgl-postcita-mail"') >= 0, "el de correo ya no se emite");
    });

    t.caso("el panel recién creado NO ofrece cancelar: ahí la cita se acaba de hacer", () => {
      const c = cargar({ silencioso: true });
      let html = "";
      c.env.doc.body.appendChild = (n) => { html = String(n.innerHTML || ""); };
      c.api.mostrarPanelPostCita("R-1", "EPS X", "PACIENTE", "PACIENTE", {
        cita: { fechaLegible: "03/09/2026", hora: "07:00 AM" }, turnoId: "T1", celular: "3001112233",
      });
      t.falso(html.indexOf("vgl-postcita-cancelar") >= 0, "cancelar solo aparece al REABRIR");
      t.cierto(html.indexOf("Cita creada") >= 0);
    });

    await t.casoAsync("_cancelarCitaConPregunta: si la anulación falla, no se promete nada", async () => {
      const c = cargar({ silencioso: true });
      const r = await c.api._cancelarCitaConPregunta({ doc_id: "555" });
      t.falso(r, "devuelve false: sin radicado no hay anulación que confirmar");
    });

    // =====================================================================
    // v18.0.131 (barrido por recorridos, hallazgo 12) — REPORTE DEL BARRIDO: si el panel
    // post-cita se quedaba abierto (reabierto con «🖨 Recordatorio») y cruzaba la medianoche,
    // «Cancelar esta cita» no llamaba a Everest y el aviso mentía sobre por qué («versión
    // anterior del asistente»). Causa: _anularCitaAsignadaReal buscaba citaId/pacienteId en
    // getProcessedToday() EN EL INSTANTE DEL CLIC, y esa función reinicia `citasDetalle`
    // entero en cuanto cambia el día. abrirRecordatorioCita YA tenía esos datos en su propio
    // `det` al abrir el recordatorio; ahora los pasa explícitos como `opciones`, que
    // _anularCitaAsignadaReal prefiere sobre lo que diga el almacén en ese momento.
    // =====================================================================
    await t.casoAsync("v18.0.131 (hallazgo 12): citaId/pacienteId explícitos permiten cancelar aunque getProcessedToday() ya no los tenga (cruce de medianoche)", async () => {
      let cuerpoEnviado = "";
      const c = cargar({
        silencioso: true,
        fetch: async (url, opts) => {
          if (!/CancelarCita/.test(String(url))) return { ok: true, status: 200, headers: { get: () => null }, text: async () => "{}", json: async () => ({}), clone() { return this; } };
          cuerpoEnviado = String((opts && opts.body) || "");
          return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ isError: false, mensaje: "Cancelado Correctamente" }), json: async () => ({ isError: false }), clone() { return this; } };
        },
      });
      c.api.__state.activeDoctor = { id: 707, name: "MEDICO PRUEBA" };
      // getProcessedToday() no conoce esta cita — el mismo estado que deja un cruce de
      // medianoche entre abrir el recordatorio y pulsar «Cancelar».
      t.igual(c.api.citaAgendadaFechaHoy("999"), null, "control: sin marca local para este documento");
      const ok = await c.api._anularCitaAsignadaReal({ doc_id: "999" }, { citaId: "7813686", pacienteId: "5150" });
      t.cierto(ok, "SÍ se anula: los datos que trajo el llamador bastan, sin depender de getProcessedToday()");
      t.cierto(/7813686/.test(cuerpoEnviado), "el radicado que viajó a Everest es el que se pasó explícitamente: " + cuerpoEnviado);
      // Y _cancelarCitaConPregunta (la que llama el botón) reenvía esos `opciones` tal cual.
      const c2 = cargar({
        silencioso: true,
        fetch: async (url, opts) => {
          if (!/CancelarCita/.test(String(url))) return { ok: true, status: 200, headers: { get: () => null }, text: async () => "{}", json: async () => ({}), clone() { return this; } };
          cuerpoEnviado = String((opts && opts.body) || "");
          return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ isError: false, mensaje: "Cancelado Correctamente" }), json: async () => ({ isError: false }), clone() { return this; } };
        },
      });
      c2.api.__state.activeDoctor = { id: 707, name: "MEDICO PRUEBA" };
      const ok2 = await c2.api._cancelarCitaConPregunta({ doc_id: "999" }, { citaId: "8000000", pacienteId: "6000" });
      t.cierto(ok2, "_cancelarCitaConPregunta también anula con los `opciones` que le pasen");
      t.cierto(/8000000/.test(cuerpoEnviado), "y los reenvía tal cual a _anularCitaAsignadaReal");
      // Y el punto de origen (abrirRecordatorioCita) de verdad los pasa, en vez de dejar que
      // se busquen otra vez en getProcessedToday() al momento del clic.
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/onCancelar: \(\) => _cancelarCitaConPregunta\(apt \|\| \{ doc_id: docId \}, \{ citaId: det\.citaId, pacienteId: det\.pacienteId \}\)/.test(src),
        "abrirRecordatorioCita pasa det.citaId/det.pacienteId (capturados AL ABRIR el recordatorio) como opciones");
    });

    // v17.6.3 — BUG 3 (reporte del médico): la lista «toma quedó» del banner de
    // agendamiento salía DUPLICADA o EN DESORDEN. Cada clic en un chip de día de toma
    // hacía `innerHTML +=` sin quitar la nota anterior: el segundo clic apilaba otra
    // nota (y el tercero, otra), en orden de clic, no de fecha. La nota vive ahora bajo
    // un id FIJO y mtrPegarNotaTomaQuedo la REEMPLAZA a nivel de cadena: una sola nota,
    // siempre con la fecha del último clic.
    t.caso("v17.6.3 — la nota «toma quedó» se reemplaza, nunca se acumula (un clic por chip = una sola nota)", () => {
      const isoA = "2026-08-24", ctrlA = "2026-08-31";
      const isoB = "2026-08-26", ctrlB = "2026-09-02";
      const primero = a.mtrPegarNotaTomaQuedo("", isoA, ctrlA);
      t.cierto(primero.indexOf("La toma quedó el <b>" + isoA + "</b>") >= 0, "la primera nota trae la fecha del primer clic");
      const segundo = a.mtrPegarNotaTomaQuedo(primero, isoB, ctrlB);
      const apariciones = segundo.split("La toma quedó el").length - 1;
      t.igual(apariciones, 1, "segundo clic: UNA sola nota — la anterior se reemplazó, no se sumó (era el duplicado)");
      t.cierto(segundo.indexOf("La toma quedó el <b>" + isoB + "</b>") >= 0 && segundo.indexOf(isoA) < 0,
        "y muestra la fecha del ÚLTIMO clic, no la acumulación en orden de clic (era el desorden)");
      t.cierto(segundo.indexOf("vgl-agm-toma-nota") >= 0, "la nota conserva su id fijo (el contrato del reemplazo)");
    });

    t.caso("v17.6.3 — la nota «toma quedó» escapa el HTML y conserva el botón de mover control", () => {
      const html = a.mtrNotaTomaQuedoHtml('2026-08-24"><script>', "2026-08-31");
      t.cierto(html.indexOf("<script>") < 0, "sin inyección (la fecha se escapa)");
      t.cierto(html.indexOf("vgl-agm-mover-ctrl") >= 0 && html.indexOf("Mover control a esa fecha") >= 0, "el botón de mover control sigue en la nota");
    });

    // v17.6.3 — A1 (decisión del médico, 22-ago): la sede del laboratorio (378) vivía
    // escrita a mano en 5 URLs de AppCita. Una sola fuente de verdad, con 378 de fábrica.
    t.caso("v17.6.3 — la sede del laboratorio tiene UNA sola fuente (mtrSedeIdLab, 378 de fábrica)", () => {
      t.igual(a.mtrSedeIdLab(), 378, "la sede de instalación es 378");
      t.igual(typeof a.mtrSedeIdLab(), "number", "y es un número usable en las URLs de AppCita");
    });

    // =====================================================================
    // v18.0.69 — BÚSQUEDA DE CUPO DE LABORATORIO, LAS 4 REGLAS DEL MÉDICO (01-sep)
    // Reporte con fecha real: «hoy 01/09 me está sugiriendo un examen para mañana 02/09
    // porque X examen ya está vencido, pero para mañana ya no hay citas de laboratorio».
    // Ver docs/REGLAS_MEDICO_20260901.md.
    // =====================================================================
    const _disp = (mapa) => async (iso) => (Object.prototype.hasOwnProperty.call(mapa, iso) ? mapa[iso] : null);

    await t.casoAsync("v18.0.69: la fecha ideal SÍ tiene cupo — ni se mueve ni se pregunta nada más", async () => {
      const r = await a.mtrBuscarCupoLaboratorio("2026-09-10", "2026-09-01", "2026-09-21", 5,
        _disp({ "2026-09-10": true }));
      t.cierto(r.encontrada, "se encuentra");
      t.igual(r.iso, "2026-09-10");
      t.cierto(r.esIdeal, "es la propia fecha ideal — no se movió nada");
      t.igual(r.desplazadaDias, 0);
    });

    await t.casoAsync("v18.0.69: sin cupo en la ideal, se busca hacia ATRÁS — nunca después (regla 1)", async () => {
      // 2026-09-10 es jueves. Sin cupo; miércoles 9 sí tiene.
      const r = await a.mtrBuscarCupoLaboratorio("2026-09-10", "2026-09-01", "2026-09-21", 5,
        _disp({ "2026-09-10": false, "2026-09-09": true, "2026-09-11": true }));
      t.igual(r.iso, "2026-09-09", "se prefiere el día ANTERIOR con cupo");
      t.igual(r.desplazadaDias, -1, "desplazada hacia atrás, no hacia adelante");
      t.falso(r.esIdeal);
    });

    await t.casoAsync("v18.0.69 — EL REPORTE EXACTO DEL MÉDICO: mañana es el piso (examen vencido) y no tiene cupo", async () => {
      // Hoy 01-sep, examen vencido -> ideal = piso = mañana 02-sep (martes). Sin cupo.
      // No hay ningún día ANTES de mañana que probar (es el piso absoluto: no se agenda
      // en el pasado ni el mismo día). La regla 1 no tiene dónde aplicarse.
      const consultados = [];
      const disp = async (iso) => { consultados.push(iso); return iso === "2026-09-02" ? false : null; };
      const r = await a.mtrBuscarCupoLaboratorio("2026-09-02", "2026-09-02", "2026-09-21", 5, disp);
      t.igual(consultados.join(","), "2026-09-02",
        "SOLO se consulta el piso: no hay ningún día anterior que probar, y NO se inventa un permiso para buscar después");
      t.falso(r.encontrada, "no se decide solo");
      t.igual(r.motivo, "sin_cupo_en_margen", "AppCita respondió que no — es un hecho, no una duda");
    });

    await t.casoAsync("v18.0.69: agotado el margen de 5 días hábiles hacia atrás, se detiene y pregunta (regla 2)", async () => {
      const consultados = [];
      const disp = async (iso) => { consultados.push(iso); return false; };
      const r = await a.mtrBuscarCupoLaboratorio("2026-09-10", "2026-08-01", "2026-09-21", 5, disp);
      t.falso(r.encontrada, "sin cupo en los 5 días hábiles: el módulo no sigue decidiendo solo");
      t.igual(r.motivo, "sin_cupo_en_margen");
      // Ideal + 5 hacia atrás = 6 días consultados (jueves 10, y los 5 hábiles anteriores;
      // sept 7 es lunes, sept 6/5 fin de semana no cuentan como hábiles).
      t.igual(consultados.length, 6, "ideal + 5 días hábiles hacia atrás, ni uno más: " + consultados.join(","));
      t.falso(consultados.some((d) => d > "2026-09-10"), "ninguna consulta cruza al lado de 'después'");
      t.cierto(r.probados.length === 6, "y el detalle de lo consultado queda para mostrárselo al médico");
    });

    await t.casoAsync("v18.0.69: nunca cruza el piso ni el techo, aunque el margen alcanzaría para hacerlo", async () => {
      const consultados = [];
      const disp = async (iso) => { consultados.push(iso); return false; };
      // Piso a solo 2 días hábiles antes de la ideal: el margen de 5 se corta ahí.
      await a.mtrBuscarCupoLaboratorio("2026-09-10", "2026-09-08", "2026-09-21", 5, disp);
      t.falso(consultados.some((d) => d < "2026-09-08"), "nunca antes del piso: " + consultados.join(","));
    });

    await t.casoAsync("v18.0.69: AppCita no responde — se avisa que no se pudo verificar, nunca se inventa disponibilidad (regla 4)", async () => {
      const r = await a.mtrBuscarCupoLaboratorio("2026-09-10", "2026-09-01", "2026-09-21", 5, async () => null);
      t.falso(r.encontrada);
      t.igual(r.motivo, "sin_verificar", "distinto de 'sin_cupo_en_margen': aquí no se sabe, no se afirma que no haya");
    });

    await t.casoAsync("v18.0.69: una mezcla de 'no' reales y 'no se pudo verificar' se cuenta como SÍ hubo respuesta real", async () => {
      // Si AppCita respondió aunque sea una vez con un NO real, el motivo es el hecho
      // (sin cupo), no la falta de verificación — no se puede decir "no se sabe" cuando
      // sí se sabe de al menos un día.
      const r = await a.mtrBuscarCupoLaboratorio("2026-09-10", "2026-09-01", "2026-09-21", 5,
        _disp({ "2026-09-10": false, "2026-09-09": null, "2026-09-08": false }));
      t.igual(r.motivo, "sin_cupo_en_margen");
    });

    // =====================================================================
    // v18.0.69 — mtrVerificarCupoLab: el verificador REAL, y por qué reemplaza a la
    // extracción vieja de `_afinarLabsPrimeroConCupos` (`r.turnos || r.data || r`, luego
    // `Array.isArray(...)`). Esa extracción solo reconocía la lista si vivía en
    // `r.turnos` o `r.data` como ARRAY — cualquier otra forma real de envolverla (las que
    // `extractAgendasList` sí reconoce, porque se observaron en otros endpoints de esta
    // misma API: `dtCitasDisponibles`, `agendas`, `citas`, `Table`, `Table1`) hacía que
    // `turnos = r` (el objeto entero, no un array), `Array.isArray(turnos)` saliera
    // `false`, y ese día se leyera SIEMPRE como «sin cupo» aunque sí lo tuviera. Con
    // `mtrSedeIdLab()` real (378) y `gmxhr` mockeado, se reproduce con el arnés.
    // =====================================================================
    const _gmxhrLab = (mapaPorFecha) => (o) => {
      const m = /fechaBuscar=([\d-]+)/.exec(String(o.url) || "");
      const iso = m ? m[1] : null;
      const cuerpo = (iso && Object.prototype.hasOwnProperty.call(mapaPorFecha, iso)) ? mapaPorFecha[iso] : { turnos: [] };
      if (o.onload) o.onload({ status: 200, responseText: JSON.stringify(cuerpo) });
    };

    await t.casoAsync("v18.0.69: mtrVerificarCupoLab reconoce las formas reales de AppCita (dtCitasDisponibles, agendas, Table…)", async () => {
      const formas = {
        "directo (array)": [{ hora: "08:00" }],
        "envuelto en turnos": { turnos: [{ hora: "08:00" }] },
        "envuelto en data": { data: [{ hora: "08:00" }] },
        "dtCitasDisponibles (forma real de otro endpoint de esta API)": { dtCitasDisponibles: [{ hora: "08:00" }] },
        "agendas": { agendas: [{ hora: "08:00" }] },
        "Table (SQL crudo)": { Table: [{ hora: "08:00" }] },
      };
      for (const [nombre, cuerpo] of Object.entries(formas)) {
        const c = cargar({ silencioso: true, gmxhr: (o) => { if (o.onload) o.onload({ status: 200, responseText: JSON.stringify(cuerpo) }); } });
        const r = await c.api.mtrVerificarCupoLab("2026-09-10");
        t.cierto(r === true, "forma «" + nombre + "»: debe verse como CON cupo, salió " + JSON.stringify(r));
      }
    });

    await t.casoAsync("v18.0.69: día sin turnos reales — false, no null", async () => {
      const c = cargar({ silencioso: true, gmxhr: _gmxhrLab({ "2026-09-10": { turnos: [] } }) });
      t.igual(await c.api.mtrVerificarCupoLab("2026-09-10"), false, "AppCita respondió y la lista viene vacía: SÍ se sabe, es un NO");
    });

    await t.casoAsync("v18.0.69: sin red o con error del servidor — null, nunca se afirma disponibilidad ni su ausencia", async () => {
      const cSinRed = cargar({ silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red simulada"); } });
      t.igual(await cSinRed.api.mtrVerificarCupoLab("2026-09-10"), null, "sin red: no se sabe");
      const c500 = cargar({ silencioso: true, gmxhr: (o) => { if (o.onload) o.onload({ status: 500, responseText: "error interno" }); } });
      t.igual(await c500.api.mtrVerificarCupoLab("2026-09-10"), null, "un 500 del servidor no es lo mismo que 'cero turnos reales'");
    });

    t.caso("v18.0.69: mtrDiasParaSondearCupo ordena ideal primero y luego alterna hacia atrás — nunca repite un día", () => {
      const dias = a.mtrDiasParaSondearCupo("2026-09-10", "2026-09-01", "2026-09-21", 3);
      t.igual(dias[0], "2026-09-10", "la ideal siempre va primero");
      t.igual(new Set(dias).size, dias.length, "sin días repetidos");
      t.cierto(dias.every((d) => d >= "2026-09-01" && d <= "2026-09-21"), "todos dentro de [piso, techo]");
      t.cierto(dias.slice(1).every((d) => d < "2026-09-10"), "todo lo que sigue a la ideal es ANTERIOR a ella");
    });

    t.caso("v18.0.117 (UI/UX #3): el panel post-cita dice el desenlace del SMS de la TOMA, y calla si no lo sabe", () => {
      const c = cargar({ silencioso: true });
      const conSms = () => {
        c.env.doc.body.children.length = 0;
        c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE SINTETICO", "", { cita: { fechaLegible: "01/10/2026" }, lab: { fechaIso: "2026-09-10", fechaLegible: "10/09/2026", hora: "06:20 AM", sms: "enviado al 3001112233" } });
        return c.env.doc.body.children.filter((n) => n.id === "vgl-postcita-panel").pop();
      };
      const panel = conSms();
      t.cierto(/SMS de la toma: enviado al 3001112233/.test(panel.innerHTML), "con desenlace, lo dice: " + (panel.innerHTML.match(/SMS de la toma[^<]*/) || [""])[0]);
      c.env.doc.body.children.length = 0;
      c.api.mostrarPanelPostCita(7813686, "EPS", "PACIENTE SINTETICO", "", { cita: { fechaLegible: "01/10/2026" }, lab: { fechaIso: "2026-09-10", fechaLegible: "10/09/2026", hora: "06:20 AM" } });
      const sinSms = c.env.doc.body.children.filter((n) => n.id === "vgl-postcita-panel").pop();
      t.cierto(/Toma de laboratorio/.test(sinSms.innerHTML), "el bloque de la toma sigue ahí");
      t.falso(/SMS de la toma/.test(sinSms.innerHTML), "sin dato NO se pinta ninguna línea (casilla vacía antes que dato inventado)");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/sms: \(labOk && labOk\.smsEnviado\)\s*\n\s*\? "enviado al "/.test(src), "Agendar rellena el desenlace desde smsEnviado, que la API ya devolvía");
      t.cierto(/sms: "no se envió: este cuadro no maneja celular"/.test(src), "y el cuadro de la toma sola dice la verdad: no maneja celular");
    });

  },
};
