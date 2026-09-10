// ══════════════════════════════════════════════════════════════════════
// Suite 110 — AB-3 (informe A/B): rage clicks sobre la UI del host con
// coordenada estructural ANÓNIMA y señal informativa. La hipótesis del
// experimento: los 1.616 ux.rage.host en 17 días (82-277/día de consulta)
// tienen causas identificables; el centinela avisa (SOLO informa — el
// médico decide) cuando una ráfaga cae sobre un elemento de Everest que no
// responde, y registra DÓNDE sin PHI: el tag (universo cerrado HTML) viaja
// en la clave del panel y el selector fino (tag + hasta 3 clases sin vgl-,
// saneadas, + nth-child) va a la bitácora local — sin id, sin texto, sin
// atributos. El umbral de siempre (3 clics en 600 ms) queda intacto y las
// ráfagas sobre la UI propia (etiquetas del catálogo) no avisan: no es
// nuestro botón el que no responde, es el sistema.
//
// v18.14.9 — MEDICIÓN QUE ORIGINÓ EL CAMBIO: de 5 gestos reales de
// consultorio, 3 pintaban el aviso y 2 de esos 3 eran gestos LEGÍTIMOS (el
// triple clic dentro de un textarea para seleccionar un párrafo, y el doble
// clic sobre una fila de la agenda más un tercero). La causa no era el umbral:
// el detector contaba clics y NO medía bloqueo — no tenía ni una señal de que
// Everest no respondiera. Ahora el aviso exige (a) que el elemento NO sea un
// campo de texto y (b) evidencia real de bloqueo: cortacircuitos del API
// abierto, agenda medida como lenta (≥6 s) o página todavía cargando. Sin
// evidencia la ráfaga se sigue contando y su coordenada se sigue registrando:
// se deja de molestar, no de medir. El aviso además deja de ser `persist`: se
// retira solo, que era el otro motivo de que resultara insoportable.
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const USERJS = path.join(__dirname, "..", "vigilante_agenda.user.js");

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const accionesUX = (c) => {
  try { c.api._uxVolcarBuffer(); return (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {}; } catch (e) { return {}; }
};
// filas de bitácora RageHost (la bitácora vive en vgl_flight_recorder_logs)
const filasRageHost = (c) => {
  try {
    const raw = JSON.parse(c.env.storage.getItem("vgl_flight_recorder_logs") || "[]");
    return Array.isArray(raw) ? raw.filter((f) => f && f.cat === "UX" && f.act === "RageHost") : [];
  } catch (e) { return []; }
};
// elemento falso del DOM de Everest (una celda de la agenda que no responde)
function celdaHost(clases, extra) {
  const el = {
    tagName: "TD",
    getAttribute: (a) => (a === "class" ? (clases || "") : null),
    className: clases || "",
    parentNode: { children: [] },       // se rellena abajo
    closest: () => null,                 // nada nuestro por encima: es host
  };
  el.parentNode.children = [{}, {}, el]; // índice 2 → nth-child(3)
  return Object.assign(el, extra || {});
}
// un botón NUESTRO de verdad: clase vgl- del catálogo (dock-btn)
function botonPropio() {
  return {
    tagName: "BUTTON",
    getAttribute: (a) => (a === "class" ? "vgl-dock-btn" : null),
    className: "vgl-dock-btn",
    closest: (s) => null,   // a propósito: el botón en sí NO matchea (lo matchea el target ya resuelto en el código real)
  };
}

module.exports = {
  nombre: "AB-3: rage clicks del host con selector anónimo y señal informativa (informe A/B)",
  cubre: ["_rageSelectorAnonimo", "_detectarRageClick"],

  async pruebas(t, api, env, cargar) {
    const base = () => {
      const c = cargar({ silencioso: true });
      c.api.__S.uxTelemetria = true;
      return c;
    };

    // ============ _rageSelectorAnonimo — el selector estructural sin PHI ============
    t.caso("selector anónimo: tag + hasta 3 clases saneadas + nth-child — sin id, sin texto", () => {
      const c = base();
      const el = celdaHost("fila-paciente celda-hora estado");
      t.igual(c.api._rageSelectorAnonimo(el), "td.fila-paciente.celda-hora.estado:nth-child(3)",
        "la estructura completa: dónde está, jamás qué contiene");
    });

    t.caso("solo 3 clases entran: el resto se descarta (el selector se queda corto y anónimo)", () => {
      const c = base();
      const el = celdaHost("aa bb cc dd ee");
      t.igual(c.api._rageSelectorAnonimo(el), "td.aa.bb.cc:nth-child(3)", "tres clases y nth-child; las demás no interesan");
    });

    t.caso("las clases vgl- (nuestras) y las que parecen cédulas se filtran del selector", () => {
      const c = base();
      const el = celdaHost("vgl-dock-btn 987654321 celda-hora");
      t.igual(c.api._rageSelectorAnonimo(el), "td.celda-hora:nth-child(3)",
        "ni nuestro prefijo ni un número de 6+ dígitos pueden colarse en la coordenada");
    });

    t.caso("sin clases ni padre: queda solo el tag — y body/html sin tagName no generan selector", () => {
      const c = base();
      const pelado = { tagName: "TD", getAttribute: () => null, className: "", closest: () => null };
      t.igual(c.api._rageSelectorAnonimo(pelado), "td", "un td pelado se describe como td, sin ruido");
      t.igual(c.api._rageSelectorAnonimo({ tagName: "BODY", closest: () => null }), "", "body no es una zona: sin selector");
      t.igual(c.api._rageSelectorAnonimo(null), "", "sin elemento: sin selector");
      t.igual(c.api._rageSelectorAnonimo({}), "", "sin tagName: sin selector");
    });

    // ============ _detectarRageClick — la ráfaga sobre el host que no responde ============
    t.caso("ráfaga de 3 clics sobre la UI del host: conteo intacto + señal informativa + coordenada", () => {
      const c = base();
      const el = celdaHost("fila-paciente celda-hora");
      const ev = { target: el };
      c.api._detectarRageClick(ev);
      c.api._detectarRageClick(ev);
      c.api._detectarRageClick(ev);
      const acc = accionesUX(c);
      t.igual(acc["ux.rage.host"], 1, "el conteo histórico queda intacto (métrica primaria del experimento)");
      t.igual(acc["ux.rage.host.tag.td"], 1, "la coordenada gruesa (tag, universo cerrado) viaja en la clave del panel");
      t.igual(acc["ux.rage.aviso"], 1, "la señal informativa se mostró (una por ráfaga)");
      const filas = filasRageHost(c);
      t.igual(filas.length, 1, "y la coordenada fina quedó en la bitácora local");
      t.igual(filas[0].det.sel, "td.fila-paciente.celda-hora:nth-child(3)", "con el selector anónimo completo — sin PHI por construcción");
    });

    t.caso("los clics siguientes de la MISMA ráfaga no duplican el aviso (=== 3, como siempre)", () => {
      const c = base();
      const el = celdaHost("fila-paciente celda-hora");
      const ev = { target: el };
      for (let i = 0; i < 6; i++) c.api._detectarRageClick(ev);   // 6 clics seguidos < 600 ms
      const acc = accionesUX(c);
      t.igual(acc["ux.rage.host"], 1, "la ráfaga completa cuenta UNA vez");
      t.igual(acc["ux.rage.aviso"], 1, "y el aviso no se repite en cada clic del martilleo");
      t.igual(filasRageHost(c).length, 1, "ni la bitácora se llena: una sola coordenada por ráfaga");
    });

    await t.casoAsync("una ráfaga NUEVA avisa otra vez pero el anti-spam de 30 s la frena", async () => {
      const c = base();
      const el = celdaHost("fila-paciente celda-hora");
      const ev = { target: el };
      c.api._detectarRageClick(ev); c.api._detectarRageClick(ev); c.api._detectarRageClick(ev);
      await esperar(650);   // > 600 ms: la ráfaga anterior murió (Date.now real)
      c.api._detectarRageClick(ev); c.api._detectarRageClick(ev); c.api._detectarRageClick(ev);
      const acc = accionesUX(c);
      t.igual(acc["ux.rage.host"], 2, "la segunda ráfaga también se cuenta (la métrica no miente)");
      t.igual(acc["ux.rage.aviso"], 1, "pero el aviso tiene enfriamiento: la segunda ráfaga llegó antes de 30 s");
      t.igual(filasRageHost(c).length, 2, "la coordenada fina sí se registra en cada ráfaga (diagnóstico, no ruido)");
    });

    // v18.12.1 (E-1) — el aviso «Everest no responde» se reimprimía toda la jornada: el
    // único freno (30 s) vivía en memoria de la pestaña y cada recarga lo ponía a cero.
    // Ahora pasa por el registro compartido del día (vgl_vistos): una ráfaga, un aviso.
    t.caso("E-1 (v18.12.1): el aviso del host NO reaparece al recargar — una vez por jornada", () => {
      const almacen = {};   // el localStorage que sobrevive a la recarga
      const c1 = cargar({ silencioso: true, almacen });
      c1.api.__S.uxTelemetria = true;
      const ev1 = { target: celdaHost("fila-paciente celda-hora") };
      c1.api._detectarRageClick(ev1); c1.api._detectarRageClick(ev1); c1.api._detectarRageClick(ev1);
      t.igual(accionesUX(c1)["ux.rage.aviso"], 1, "la primera ráfaga de la jornada sí avisa (una sola vez)");
      // Recarga real: mismo localStorage, memoria de módulo en cero (_rageAvisoHostAt = 0).
      const c2 = cargar({ silencioso: true, almacen });
      c2.api.__S.uxTelemetria = true;
      const ev2 = { target: celdaHost("fila-paciente celda-hora") };
      c2.api._detectarRageClick(ev2); c2.api._detectarRageClick(ev2); c2.api._detectarRageClick(ev2);
      const acc2 = accionesUX(c2);
      t.igual(acc2["ux.rage.host"], 2, "la ráfaga posterior a la recarga se sigue midiendo (no se deja de medir)");
      t.igual(acc2["ux.rage.aviso"], 1, "pero el aviso no se repite: es el mismo hecho del día, no un aviso nuevo");
    });

    t.caso("la ráfaga sobre NUESTRA UI se cuenta con su etiqueta del catálogo — y NO avisa: no es el sistema el que falla", () => {
      const c = base();
      const propio = botonPropio();
      const ev = { target: propio };
      c.api._detectarRageClick(ev);
      c.api._detectarRageClick(ev);
      c.api._detectarRageClick(ev);
      const acc = accionesUX(c);
      t.igual(acc["ux.rage.dock-btn"], 1, "la ráfaga propia se cuenta con la etiqueta del catálogo (ux.rage.dock-btn)");
      t.cierto(acc["ux.rage.host"] === undefined, "y no se atribuye al host: nuestro botón ya tiene feedback visual propio");
      t.cierto(acc["ux.rage.aviso"] === undefined, "sin aviso azul: el centinela no molesta cuando la culpa no es del sistema");
      t.cierto(acc["ux.rage.host.tag.button"] === undefined, "la coordenada de tag solo sale para el host");
      t.igual(filasRageHost(c).length, 0, "y la bitácora de host queda vacía");
    });

    t.caso("menos de 3 clics no disparan nada — y un target distinto resetea el contador", () => {
      const c = base();
      const propio = botonPropio();
      const el = celdaHost("fila-paciente celda-hora");
      c.api._detectarRageClick({ target: propio });   // clic 1 sobre NUESTRO botón…
      c.api._detectarRageClick({ target: propio });   // …clic 2: aún sin ráfaga…
      c.api._detectarRageClick({ target: el });       // …cambio de target: el contador se reinicia
      c.api._detectarRageClick({ target: el });
      c.api._detectarRageClick({ target: el });       // 3 clics seguidos sobre el host: ráfaga
      const acc = accionesUX(c);
      t.cierto(acc["ux.rage.dock-btn"] === undefined, "dos clics propios no son una ráfaga: el umbral de 3/600 ms sigue intacto");
      t.igual(acc["ux.rage.host"], 1, "el clic ajeno al llegar reinició el conteo: los 3 clics del host SÍ disparan");
      t.igual(acc["ux.rage.aviso"], 1, "y el aviso azul salió para la ráfaga del host");
      t.igual(filasRageHost(c).length, 1, "con su coordenada en la bitácora");
    });

    // ============ v18.14.9 — el aviso deja de ser «3 clics y ya» ============
    // Medido antes del cambio: de 5 gestos reales de consultorio, 3 pintaban el aviso y 2 de
    // esos 3 eran gestos LEGÍTIMOS (el triple clic para seleccionar un párrafo y el doble clic
    // sobre una fila de la agenda). El detector contaba clics, no medía bloqueo.
    t.caso("v18.14.9: el triple clic dentro de un CAMPO DE TEXTO de Everest NO avisa (es seleccionar un párrafo)", () => {
      const c = base();
      const campo = { tagName: "TEXTAREA", id: "txt-observacion", getAttribute: () => null, className: "", closest: () => null };
      const ev = { target: campo };
      c.api._detectarRageClick(ev); c.api._detectarRageClick(ev); c.api._detectarRageClick(ev);
      const acc = accionesUX(c);
      t.igual(acc["ux.rage.host"], 1, "la ráfaga se sigue midiendo: se deja de molestar, no de medir");
      t.igual(acc["ux.rage.host.texto"], 1, "y queda marcada como gesto de texto, para poder auditar el falso positivo");
      t.cierto(acc["ux.rage.aviso"] === undefined, "pero el centinela NO avisa: seleccionar un párrafo no es un bloqueo");
      t.igual(filasRageHost(c).length, 1, "la coordenada anónima sigue quedando en la bitácora local");
    });

    t.caso("v18.14.9: son campos de texto el textarea, el input, el select y el contenteditable — y no lo es una celda", () => {
      const c = base();
      t.cierto(c.api._rageEsCampoTexto({ tagName: "TEXTAREA" }), "textarea");
      t.cierto(c.api._rageEsCampoTexto({ tagName: "INPUT" }), "input");
      t.cierto(c.api._rageEsCampoTexto({ tagName: "SELECT" }), "select");
      t.cierto(c.api._rageEsCampoTexto({ tagName: "DIV", isContentEditable: true }), "contenteditable por propiedad");
      t.cierto(c.api._rageEsCampoTexto({ tagName: "DIV", getAttribute: (a) => (a === "contenteditable" ? "true" : null) }), "contenteditable por atributo");
      t.falso(c.api._rageEsCampoTexto(celdaHost("fila-paciente")), "una celda de la agenda NO es un campo de texto: ahí el martilleo sí es señal");
      t.falso(c.api._rageEsCampoTexto(null), "sin elemento, no hay campo de texto");
    });

    t.caso("v18.14.9: sin EVIDENCIA de bloqueo la ráfaga se mide, pero el aviso NO sale", () => {
      const c = base();
      c.env.doc.readyState = "complete";   // la página ya cargó
      c.api._apiCorteResetParaTest();      // el API no ha fallado
      c.api.__rageApiMsParaTest(1200);     // y la agenda no viene lenta
      const el = celdaHost("fila-paciente celda-hora");
      const ev = { target: el };
      c.api._detectarRageClick(ev); c.api._detectarRageClick(ev); c.api._detectarRageClick(ev);
      const acc = accionesUX(c);
      t.igual(acc["ux.rage.host"], 1, "la ráfaga se cuenta igual (la métrica no miente)");
      t.igual(acc["ux.rage.host.tag.td"], 1, "y su coordenada gruesa también viaja");
      t.cierto(acc["ux.rage.aviso"] === undefined, "pero sin evidencia el centinela calla: no afirma lo que no puede probar");
      t.igual(filasRageHost(c).length, 1, "la bitácora local sigue recogiendo el diagnóstico");
    });

    t.caso("v18.14.9: con el cortacircuitos del API abierto el aviso SÍ sale — y queda medido el motivo", () => {
      const c = base();
      c.env.doc.readyState = "complete";
      c.api._apiCorteResetParaTest();
      c.api._apiMarcarResultado(false); c.api._apiMarcarResultado(false); c.api._apiMarcarResultado(false);
      t.cierto(c.api._apiCorteAbierto(), "premisa: 3 fallos seguidos abren el freno del API");
      const el = celdaHost("fila-paciente celda-hora");
      const ev = { target: el };
      c.api._detectarRageClick(ev); c.api._detectarRageClick(ev); c.api._detectarRageClick(ev);
      const acc = accionesUX(c);
      t.igual(acc["ux.rage.aviso"], 1, "el caso legítimo del aviso sigue vivo: el sistema SÍ está fallando");
      t.igual(acc["ux.rage.aviso.motivo.api_caido"], 1, "y el motivo que lo justificó queda en la telemetría");
      c.api._apiCorteResetParaTest();
    });

    t.caso("v18.14.9: una agenda medida como lenta (≥6 s) también es evidencia — motivo api_lento", () => {
      const c = base();
      c.env.doc.readyState = "complete";
      c.api._apiCorteResetParaTest();
      c.api.__rageApiMsParaTest(6500);
      const el = celdaHost("fila-paciente celda-hora");
      const ev = { target: el };
      c.api._detectarRageClick(ev); c.api._detectarRageClick(ev); c.api._detectarRageClick(ev);
      const acc = accionesUX(c);
      t.igual(acc["ux.rage.aviso"], 1, "6,5 s de lectura es Everest lento de verdad: el aviso se justifica");
      t.igual(acc["ux.rage.aviso.motivo.api_lento"], 1, "con su motivo propio");
      c.api.__rageApiMsParaTest(0);
    });

    t.caso("v18.14.9: el umbral y el cooldown no se movieron — ráfaga de 3 clics y un aviso por jornada", () => {
      const c = base();
      c.env.doc.readyState = "complete";
      c.api._apiCorteResetParaTest();
      c.api.__rageApiMsParaTest(500);
      const el = celdaHost("fila-paciente celda-hora");
      const ev = { target: el };
      c.api._detectarRageClick(ev); c.api._detectarRageClick(ev);
      t.cierto(accionesUX(c)["ux.rage.host"] === undefined, "dos clics siguen sin ser ráfaga");
      c.api._detectarRageClick(ev);
      t.igual(accionesUX(c)["ux.rage.host"], 1, "y el tercero la cierra: el umbral de siempre, intacto");
      t.cierto(accionesUX(c)["ux.rage.aviso"] === undefined, "aunque sin evidencia no avise");
    });

    // ============ el enganche real en el código vivo ============
    t.caso("estructura: el helper existe, el aviso es SOLO informativo y el anti-spam está acotado", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      const iH = s.indexOf("function _rageSelectorAnonimo(t)");
      t.cierto(iH >= 0, "el helper de selector anónimo está declarado");
      t.cierto(s.indexOf("/^vgl-/.test(c)", iH) > iH, "las clases nuestras se filtran del selector");
      t.cierto(s.indexOf("uxClaveLimpia(c)", iH) > iH, "cada clase pasa por el saneador (mueren las cédulas)");
      t.cierto(s.indexOf("cero PHI por construcción") >= 0, "el comentario declara la regla: cero PHI por construcción");
      t.cierto(s.indexOf('if (etiqueta === "host")') > s.indexOf("uxTrack(\"ux.rage.\" + etiqueta)"), "la señal solo acompaña a las ráfagas del host");
      t.cierto(s.indexOf("> 30000") > s.indexOf("_rageAvisoHostAt"), "el anti-spam del aviso es de 30 s");
      t.cierto(s.indexOf('_avisoUnaVezPorNavegador("ragehost|aviso")') > 0, "v18.12.1: además pasa por el registro compartido del día (una vez por jornada)");
      t.cierto(s.indexOf('uxTrack("ux.rage.aviso")') >= 0, "la señal queda medida (se sabe cuándo se mostró)");
      t.cierto(s.indexOf("function _rageEsCampoTexto(t)") > 0, "v18.14.9: el detector reconoce los campos de texto (el triple clic ahí es seleccionar, no martillar)");
      t.cierto(s.indexOf("function _rageEvidenciaDeBloqueo()") > 0, "v18.14.9: el aviso exige EVIDENCIA real de bloqueo antes de molestar");
      t.cierto(s.indexOf('const motivo = esTexto ? "" : _rageEvidenciaDeBloqueo();') > 0, "y la ráfaga sin evidencia no llega al médico");
      t.cierto(s.indexOf("if (motivo && ahora - _rageAvisoHostAt > 30000") > 0, "el cooldown de 30 s sigue en pie, ahora junto a la evidencia");
    });

    t.caso("estructura: el texto del aviso es informativo — el centinela solo avisa, jamás actúa", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      const iToast = s.indexOf('showToast("AZUL", "Everest no responde"');
      t.cierto(iToast >= 0, "el aviso es un toast AZUL (informativo, no error)");
      t.cierto(s.indexOf("El centinela solo le avisa: usted decide", iToast) > iToast, "el mensaje se lo dice claro al médico");
      t.cierto(s.indexOf("recargue la consulta", iToast) > iToast, "y le da la salida práctica");
      t.cierto(s.indexOf("ux.rage.host.tag.") >= 0, "la coordenada de tag existe en el código vivo");
      t.cierto(s.indexOf("_rageClickCount === 3") >= 0, "el umbral de la ráfaga (3 clics) quedó intacto");
      t.cierto(s.indexOf("now - _lastClickTime) < 600") >= 0, "y la ventana de 600 ms también");
      const iPersist = s.indexOf("false);", iToast);
      t.cierto(iPersist > iToast && iPersist - iToast < 900, "v18.14.9: el aviso se pinta con persist=false — se retira solo, ya no se queda pegado en pantalla");
    });
  },
};
