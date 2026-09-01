// =====================================================================
//  SUITE 68 — v17.0.0: toda la cola de decisiones, de una vez
//
//  El médico pidió construir de golpe lo que quedaba acordado y sin
//  hacer. Cada bloque de abajo defiende una de esas piezas, y varias
//  comparten la misma forma de defecto que ya se corrigió dos veces:
//  un dato que el motor necesitaba y que NADIE le suministraba, así que
//  la regla existía escrita y era inalcanzable. Pasó con el LDL basal
//  (v16.9.0), pasa aquí con la TFG previa, y es lo que estas pruebas
//  impiden que vuelva a pasar en silencio.
// =====================================================================

function labSerie(pares) {
  return pares.map(([fecha, valor]) => ({ fecha: fecha, valor: valor }));
}

// Un panel mínimo con cabecera, para las pruebas de minimizar.
function panelConNombre(doc, id, titulo, nombre) {
  const panel = doc.createElement("div");
  panel.id = id; panel.nodeType = 1;
  const head = doc.createElement("div"); head.className = "vgl-agm-head";
  const tit = doc.createElement("div"); tit.className = "vgl-agm-title"; tit.textContent = titulo;
  const nom = doc.createElement("div"); nom.className = "vgl-agm-patient"; nom.textContent = nombre;
  head.appendChild(tit); head.appendChild(nom); panel.appendChild(head);
  panel.querySelector = (sel) => {
    const clase = String(sel || "").replace(/^\./, "");
    const busca = (n) => {
      for (const h of n.children || []) {
        if (String(h.className || "").split(/\s+/).indexOf(clase) >= 0) return h;
        const d = busca(h); if (d) return d;
      }
      return null;
    };
    return busca(panel);
  };
  return panel;
}

// Un par de radios de Everest, con la anatomía que lee el script.
function radiosDe(nombre, marcado) {
  const mk = (valor) => ({
    type: "radio", name: nombre, value: valor,
    checked: marcado === valor,
    _listeners: {},
    dispatchEvent() { return true; },
    addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
  });
  return [mk("true"), mk("false")];
}

// DOM mínimo que responde por nombre de campo.
function domConCampos(mapa) {
  return {
    querySelectorAll(sel) {
      const m = /input\[name="([^"]+)"\]/.exec(String(sel || ""));
      if (!m) return [];
      const clave = m[1].trim();
      return mapa[clave] || [];
    },
    querySelector() { return null; },
  };
}

module.exports = {
  nombre: "v17.0.0 — la cola completa: IRA, metas, duplicidades, productividad, carpeta, prellenado, llenado y dead-man",
  cubre: [
    "mtrRecalcularConFactores", "mtrSospechaIra", "_vglEjecutarDeshacer", "_mtrInstantaneaAlMenosTanRica",
    "mtrSabadosHabilitados", "vglCarpetaRestaurar", "mtrPreguntaEmbarazo", "vglMinExcluido", "vglMinTituloDe", "mtrEgfrPrevioDeSerie", "_vglDeshacerFlotante", "_mtrRecortarPorItem", "_vglCarpetaGuardarAhora", "_vglCarpetaDb", "_vglCarpetaGuardarHandle", "_vglCarpetaRecuperarHandle",
    "mtrPenultimaCreatinina", "mtrEgfrPrevioDeSerie", "mtrPanelMetasHtml",
    "mtrDuplicidadesTerapeuticas", "mtrMedicamentosUnicos", "_mtrClaveDedupMedicamento", "mtrRenderDuplicidadesHtml", "_mtrClaveMedicamento",
    "mtrProductividadMeta", "mtrProdClaveCita", "mtrProdRegistrar", "mtrProdLeer", "mtrProdNombreHora",
    "mtrProdAtendidasDe", "mtrProductividadVistas", "mtrProductividadHtml", "mtrProductividadCsvSemana",
    "mtrInstantaneaDeResumen", "mtrHistorialAgregar", "mtrNombreArchivoPaciente",
    "vglCarpetaGuardarInstantanea", "vglCarpetaLeerHistorial", "vglCarpetaDisponible",
    "vglCarpetaElegida", "vglCarpetaElegir", "_vglCarpetaFsReal",
    "mtrControlAnteriorDe", "mtrAnclaControlAnterior", "mtrPrellenadoEnfermedadActual",
    "mtrCamposLlenables", "vglLlenarFactoresEnEverest", "_vglMarcarRadio", "mtrMensajeLlenado", "vglModalLlenarCampos",
    "mtrDeadmanEstado", "mtrDeadmanMensaje", "vglEscrituraPermitida",
    "_vglDeadmanSellar", "_vglDeadmanUltimoContacto", "_vglDeadmanRevisar",
  ],

  async pruebas(t, api, env, cargar) {

    // =================================================================
    //  v17.0.1 — LOS DEFECTOS QUE ENCONTRÓ LA AUDITORÍA DE LA PROPIA v17
    //  Cada caso de este bloque reproduce un fallo REAL que estuvo en la
    //  entrega. Van primero porque son los que no pueden volver.
    // =================================================================

    // ---- Segunda ronda de auditoría (v17.0.2): defectos de mis propios arreglos ----

    t.caso("REGRESIÓN — la pregunta de embarazo no puede dejar el Panel muerto", () => {
      // El defecto: la pregunta se entregaba con `titulo`/`porque`/`fuentes` y el modal
      // lee `etiqueta`/`porQue`/`afirman`. El .map sobre undefined reventaba dentro del
      // try del modal, que devolvía false; el llamador ignoraba ese false y hacía return.
      // En consulta: en TODA mujer fértil con parcial sugestivo, pulsar el botón no hacía
      // nada. Sin modal, sin aviso. El mismo síntoma que el médico ya reportó una vez.
      const q = api.mtrPreguntaEmbarazo();
      t.cierto(typeof q.etiqueta === "string" && q.etiqueta.length > 0, "trae etiqueta");
      t.cierto(typeof q.porQue === "string" && q.porQue.length > 0, "y porQue");
      t.cierto(Array.isArray(q.afirman) && Array.isArray(q.niegan), "y las dos listas de fuentes");
      t.noLanza(() => q.afirman.concat(q.niegan).map((x) => x.fuente + " (" + x.detalle + ")"),
        "la operación exacta que hace el modal no lanza");
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      t.cierto(/const mostrado = _vglModalConfirmarDatos/.test(src),
        "y si el emergente no se puede pintar, el Panel abre igual en vez de quedarse mudo");
    });

    t.caso("REGRESIÓN — «Decidir luego» y Escape en el reconciliador no dejan sin Panel", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      // v17.58.0 — la ventana creció de 6000 a 8000: `_vglModalConfirmarDatos` ganó el
      // bloque de las preguntas MEDIA de la escalera de adherencia (que se muestran pero
      // no retienen el flujo) justo antes de `_luego`, y la aserción dejó de alcanzarlo.
      const zona = src.slice(src.indexOf("function _vglModalConfirmarDatos"), src.indexOf("function _vglModalConfirmarDatos") + 8000);
      t.cierto(/const _luego = \(\) =>/.test(zona), "hay una salida común para la ✕ y Escape");
      t.cierto(/alContinuar\(\)/.test(zona), "y esa salida continúa el flujo: antes el médico se quedaba sin módulo");
    });

    t.caso("REGRESIÓN — los emergentes que piden una decisión no se pueden minimizar", () => {
      t.cierto(api.vglMinExcluido("vgl-llenar-modal"),
        "minimizar el emergente de antecedentes destruía las respuestas ya marcadas al reabrirlo");
      t.cierto(api.vglMinExcluido("vgl-confirma-modal"), "y el reconciliador tampoco");
      t.falso(api.vglMinExcluido("vgl-panel-modal"), "el Panel sí se minimiza, que para eso se hizo");
    });

    t.caso("REGRESIÓN — la pastilla de minimizado dice DE QUIÉN es el módulo", () => {
      // El nombre del paciente vive en .vgl-agm-patient, que antes no se leía: dos
      // pacientes daban dos pastillas idénticas, y al pulsar una salían los datos del otro.
      const p = panelConNombre(env.doc, "vgl-panel-modal", "🧾 Panel del paciente", "MARIA PEREZ");
      const t1 = api.vglMinTituloDe(p);
      t.cierto(/MARIA PEREZ/.test(t1), "la pastilla lleva el nombre: " + t1);
      t.cierto(t1.length <= 40, "sin desbordar la barra");
    });

    t.caso("REGRESIÓN — un módulo minimizado no recalcula ni retiene el reloj", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const zona = src.slice(src.indexOf("async function openPanelPacienteModal"));
      t.cierto(/const minimizado = \(\)/.test(zona), "el Panel sabe si está minimizado");
      t.cierto(/if \(minimizado\(\)\) return;/.test(zona),
        "y su vigilancia de 20 s no hace nada mientras lo esté: antes latía toda la jornada");
      t.cierto(/modal\.dataset\.vglDoc = String\(apt\.doc_id\)/.test(zona),
        "y el módulo queda sellado con la cédula de su paciente");
    });

    t.caso("REGRESIÓN — la reclasificación conserva sábado, uroanálisis y embarazo", () => {
      const previo = {
        _docId: "1093800", _hoyIso: "2026-08-21",
        _grupoSabado: { habilitado: true, observados: ["2026-08-01"] },
        _uroHallazgos: { nitritos: "++" }, _embarazo: true,
        _seriesLargas: { CREATININA: [{ fecha: "2026-04-01", valor: 0.9 }, { fecha: "2026-08-01", valor: 1.6 }] },
        factores: { edad: 66, sexo: "F", hta: true },
        erc: { entradas: { edad: 66, sexo: "F", peso: 70, creatinina: 1.6 } },
      };
      const nuevo = api.mtrRecalcularConFactores(previo, { hta: true }, "2026-08-21");
      // El sábado se perdía porque mtrResumenClinico no devuelve `grupoSabado`: el arreglo
      // de v17.0.1 vivía UN ciclo de 20 s y luego se tachaban todos los sábados otra vez.
      t.cierto(!!nuevo._grupoSabado && nuevo._grupoSabado.habilitado === true, "el sábado del médico sobrevive");
      t.cierto(!!nuevo._uroHallazgos, "y el uroanálisis, que se volvía null en cada reclasificación");
      t.igual(nuevo._embarazo, true, "y el embarazo confirmado");
      t.cierto(!!nuevo._seriesLargas, "y las series largas, de las que salen el LDL basal y la TFG previa");
    });

    t.caso("REGRESIÓN — la productividad no cuenta doble al cambiar de fuente la hora", () => {
      // La API normaliza la hora («8:00 a. m.») y el respaldo por DOM usa el texto crudo:
      // un solo failover a mitad de jornada duplicaba a TODOS los atendidos del día.
      const porApi = api.mtrProdClaveCita({ doc_id: "111", hora_texto: "08:00:00" });
      const porDom = api.mtrProdClaveCita({ doc_id: "111", hora_texto: "8:00" });
      t.igual(porApi, porDom, "la misma cita da la misma clave venga de donde venga (" + porApi + ")");
      t.falso(api.mtrProdClaveCita({ doc_id: "111", hora_texto: "08:00" }) === api.mtrProdClaveCita({ doc_id: "111", hora_texto: "09:00" }),
        "y dos horas distintas siguen siendo dos citas");
      t.igual(api.mtrProdClaveCita({ hora_texto: "08:00" }), null,
        "una cita sin nombre ni documento no se puede identificar: no se cuenta ni arriba ni abajo");
    });

    t.caso("REGRESIÓN — la TFG previa se calcula con la edad de ENTONCES", () => {
      const s2 = labSerie([["2026-04-01", 1.493], ["2026-08-01", 1.50]]);
      const prev = api.mtrEgfrPrevioDeSerie(s2, 41, "M", "2026-08-21");
      t.cierto(!!prev, "hay TFG previa");
      t.cierto(prev.edadUsada < 41, "se usa la edad que tenía en aquel control (" + prev.edadUsada + ")");
      // Con la edad de hoy, una creatinina casi idéntica podía cruzar la frontera G2/G3a
      // y fabricar una «sospecha de injuria» que era puro artefacto del atajo.
      // Y medio mililitro cruzando la frontera de los 60 NO es una injuria: las fronteras
      // KDIGO son números redondos y dos controles casi idénticos caen uno a cada lado.
      t.falso(api.mtrSospechaIra(59.6, 60.1), "60,1 → 59,6 es ruido de laboratorio, no deterioro");
      t.cierto(api.mtrSospechaIra(52, 61), "pero una caída del 15 % con cambio de estadio sí se avisa");
      t.cierto(api.mtrSospechaIra(45, 62), "y una del 27 % siempre");
    });

    t.caso("REGRESIÓN — el resumen reclasificado CONSERVA la identidad del paciente", () => {
      // El Panel reclasifica cada 20 s y guarda el resultado en caché; el redactor IA lee
      // esa caché y usa `_docId` como guarda antes de insertar en la historia. Al
      // perderse `_docId`, la guarda `if (docId && !_pacienteSigueAbierto(docId))` no se
      // evaluaba siquiera: la nota podía escribirse en la historia de otro paciente.
      const previo = {
        _docId: "1093800", _hoyIso: "2026-08-21",
        _ultimos: { CREATININA: { valor: 1.1, fecha: "2026-08-01" } },
        _series: { CREATININA: [{ fecha: "2026-04-01", valor: 0.9 }, { fecha: "2026-08-01", valor: 1.6 }] },
        medicamentos: ["LOSARTAN 50MG"],
        factores: { edad: 66, sexo: "F", hta: true },
        erc: { entradas: { edad: 66, sexo: "F", peso: 70, creatinina: 1.6 } },
      };
      const nuevo = api.mtrRecalcularConFactores(previo, { hta: true, diabetes: true }, "2026-08-21");
      t.igual(nuevo._docId, "1093800", "la cédula sobrevive a la reclasificación");
      t.cierto(!!nuevo._ultimos && !!nuevo._ultimos.CREATININA, "y los laboratorios leídos");
      t.cierto(!!nuevo._series, "y las series");
      t.igual(nuevo.medicamentos.length, 1, "y los medicamentos");
      t.cierto(nuevo.erc.sospechaIra === true,
        "la sospecha de injuria renal NO desaparece a los 20 segundos: antes se perdía con las series");
    });

    t.caso("REGRESIÓN — mtrSospechaIra NO se dispara cuando el paciente mejora", () => {
      // El defecto estaba latente (egfrPrevio llegaba null) y lo activó la v17.0.0 al
      // suministrar por fin el dato: bastaba con que CAMBIARA el estadio, en cualquier
      // dirección. Un paciente que mejora salía con «deterioro agudo», se le acortaban
      // todas las vigencias y el aviso viajaba a la hoja de hechos de la IA.
      t.falso(api.mtrSospechaIra(94.8, 83.5), "de G2 a G1 es MEJORAR: no hay injuria que sospechar");
      t.falso(api.mtrSospechaIra(61, 59), "y una subida pequeña de estadio tampoco");
      t.cierto(api.mtrSospechaIra(59.9, 83.5), "de G2 a G3a sí: eso es empeorar");
      t.cierto(api.mtrSospechaIra(60, 90), "y una caída del 33 % también, sin cambiar de estadio");
      t.falso(api.mtrSospechaIra(90, null), "sin dato previo no se opina");
    });

    t.caso("REGRESIÓN — el Deshacer del llenado DESMARCA el radio (antes no hacía nada)", () => {
      const par = radiosDe("AntecedentePatologicos.Hipertension", null);
      const dom = domConCampos({ "AntecedentePatologicos.Hipertension": par });
      const r = api.vglLlenarFactoresEnEverest({ hta: true }, null, dom);
      t.igual(r.escritas, 1, "se escribió");
      t.cierto(par[0].checked, "el «Sí» quedó marcado");
      t.igual(r.pares[0].checkedPrev, false, "la foto guarda que ANTES estaba sin marcar");
      t.igual(r.pares[0].clave, "hta", "y de qué campo es, para poder archivarlo solo si se escribió");
      const n = api._vglEjecutarDeshacer();
      t.igual(n, 1, "el Deshacer actuó sobre una casilla");
      t.falso(par[0].checked, "y de verdad la desmarcó: antes setNgValue le tocaba .value y la dejaba marcada");
      t.igual(par[0].value, "true", "sin corromper el value del radio, que dejaba el campo ilegible");
    });

    t.caso("REGRESIÓN — solo se archiva como confirmado lo que de verdad se escribió", () => {
      // Las confirmaciones mandan SOBRE lo leído en la historia, así que archivar una
      // respuesta que no se pudo escribir metía un dato invisible y sin auditoría en la
      // clasificación de riesgo, para esta cita y todas las siguientes.
      const documentado = radiosDe("AntecedentePatologicos.Diabetes", "false");
      const vacio = radiosDe("AntecedentePatologicos.Hipertension", null);
      const dom = domConCampos({
        "AntecedentePatologicos.Diabetes": documentado,
        "AntecedentePatologicos.Hipertension": vacio,
      });
      const r = api.vglLlenarFactoresEnEverest({ diabetes: true, hta: true }, null, dom);
      const claves = (r.pares || []).map((x) => x.clave);
      t.igual(claves, ["hta"], "solo la casilla que se llenó de verdad entra en la foto");
      t.falso(claves.indexOf("diabetes") >= 0,
        "la que Everest ya tenía documentada NO se archiva con el valor contrario");
    });

    t.caso("REGRESIÓN — el escritor exige radios de verdad, igual que el que ofrece", () => {
      // Asimetría real: la función que OFRECE exigía type=radio y la que ESCRIBE se
      // quedaba con el primer nodo que apareciera. Cuatro campos de Hábitos viven bajo el
      // nombre con espacio final, así que el que escribe podía coger el nodo equivocado.
      const falsos = [{ type: "hidden", name: "AntecedentePatologicos.Hipertension", value: "x" }];
      const buenos = radiosDe("AntecedentePatologicos.Hipertension ", null);   // con espacio
      const dom = {
        querySelectorAll(sel) {
          if (String(sel).indexOf('Hipertension "') >= 0 || String(sel).indexOf("Hipertension ") >= 0) return buenos;
          return falsos;
        },
        querySelector() { return null; },
      };
      const r = api.vglLlenarFactoresEnEverest({ hta: true }, null, dom);
      t.igual(r.escritas, 1, "escribió");
      t.cierto(buenos[0].checked, "y en los RADIOS de verdad, no en el input oculto que casaba antes");
    });

    t.caso("REGRESIÓN — mtrCamposLlenables no lee la historia de otro paciente", () => {
      const dom = domConCampos({
        "AntecedentePatologicos.Hipertension": radiosDe("AntecedentePatologicos.Hipertension", null),
      });
      // Con `doc` inyectado (distinto de `document`) la guarda no aplica: es el camino
      // del banco. Lo que se fija aquí es que la guarda EXISTE en el código.
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const fn = src.slice(src.indexOf("function mtrCamposLlenables"), src.indexOf("function vglLlenarFactoresEnEverest"));
      t.cierto(/_pacienteSigueAbierto/.test(fn),
        "la función comprueba de quién es la historia abierta antes de leerla");
      t.cierto(api.mtrCamposLlenables("555000", dom).length >= 1, "y con el DOM inyectado sigue funcionando");
    });

    t.caso("REGRESIÓN — una instantánea degradada NO pisa la buena del mismo día", () => {
      const buena = { fecha: "2026-08-21", laboratorios: { CREATININA: {}, HBA1C: {} }, riesgo: { categoria: "ALTO" }, medicamentos: ["A", "B"], renal: { egfr: 55 } };
      const pobre = { fecha: "2026-08-21", laboratorios: {}, riesgo: { categoria: null }, medicamentos: [], renal: {} };
      const h1 = api.mtrHistorialAgregar(null, buena);
      const h2 = api.mtrHistorialAgregar(h1, pobre);
      t.igual(Object.keys(h2.controles[0].laboratorios).length, 2,
        "la lectura sin laboratorios (red caída) no borra la completa de media hora antes");
      const mejor = { fecha: "2026-08-21", laboratorios: { CREATININA: {}, HBA1C: {}, RAC: {} }, riesgo: { categoria: "ALTO" }, medicamentos: ["A", "B"], renal: { egfr: 55 } };
      const h3 = api.mtrHistorialAgregar(h2, mejor);
      t.igual(Object.keys(h3.controles[0].laboratorios).length, 3, "pero una lectura MÁS completa sí actualiza");
    });

    t.caso("_vglDeshacerFlotante: el botón del llenado NO reusa la clase que quedaba tapada", () => {
      // El defecto: _vglOfrecerDeshacer(null) plantaba el botón con .vgl-exf-btn, que no
      // fija posición vertical y vive por debajo del velo de los módulos. El Panel se
      // abría encima y el médico no podía tocar el Deshacer que el toast le prometía.
      const b = api._vglDeshacerFlotante();
      // Sin lote vivo no se crea nada, que también es correcto.
      t.cierto(b === null || String(b.className).indexOf("vgl-exf-btn") < 0,
        "si se crea, no lleva la clase que quedaba debajo del velo");
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      t.cierto(/#vgl-deshacer-llenado/.test(src), "el botón tiene id propio, para poder posicionarlo por encima del modal");
      // (La única aparición del texto viejo es el comentario que documenta el arreglo.)
      const codigo = src.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
      t.falso(/_vglOfrecerDeshacer\(null\)/.test(codigo), "y ya nadie llama al ofrecedor sin ancla");
    });

    await t.casoAsync("la persistencia de la carpeta no lanza sin IndexedDB (el banco no lo tiene)", async () => {
      t.igual(await api._vglCarpetaDb(), null, "sin IndexedDB, sin base");
      t.falso(await api._vglCarpetaGuardarHandle({ name: "x" }), "guardar devuelve false, no lanza");
      t.igual(await api._vglCarpetaRecuperarHandle(), null, "y recuperar devuelve null");
    });

    t.caso("_mtrRecortarPorItem: el ancla se corta por ítem, no a mitad de un medicamento", () => {
      const txt = "venía con: LOSARTAN 50MG, ATORVASTATINA 40MG, METFORMINA 850MG, PARCIAL DE ORINA CON SEDIMENTO";
      const r = api._mtrRecortarPorItem(txt, 60);
      t.cierto(r.length <= 62, "respeta el límite");
      t.cierto(r.endsWith("…"), "y avisa de que hay más");
      t.falso(/PARCIAL DE ORINA CON$/.test(r), "no deja un fragmento que parezca una orden real");
      t.cierto(r.indexOf("ATORVASTATINA 40MG") >= 0, "conserva los ítems completos que caben");
      t.igual(api._mtrRecortarPorItem("corto", 700), "corto", "lo que cabe no se toca");
      t.igual(api._mtrRecortarPorItem(null, 700), "", "y null no lanza");
    });

    await t.casoAsync("_vglCarpetaGuardarAhora: dos guardados del mismo paciente se serializan, no chocan", async () => {
      const disco = {};
      let enVuelo = 0, maxSimultaneo = 0;
      const fs = {
        leer: async (n) => disco[n],
        escribir: async (n, txt) => {
          enVuelo++; maxSimultaneo = Math.max(maxSimultaneo, enVuelo);
          await new Promise((r) => setTimeout(r, 5));
          disco[n] = txt; enVuelo--; return true;
        },
      };
      // Los dos módulos del mismo paciente pueden guardar a la vez: Chrome lanzaría
      // NoModificationAllowedError sobre el mismo archivo y la instantánea se perdería.
      const [a, b] = await Promise.all([
        api.vglCarpetaGuardarInstantanea("1010", { fecha: "2026-08-21", laboratorios: { A: 1 } }, fs),
        api.vglCarpetaGuardarInstantanea("1010", { fecha: "2026-08-22", laboratorios: { A: 1 } }, fs),
      ]);
      t.cierto(a.ok && b.ok, "las dos se guardan");
      t.igual(maxSimultaneo, 1, "nunca hay dos escrituras a la vez sobre el mismo archivo");
      const h = await api.vglCarpetaLeerHistorial("1010", fs);
      t.igual(h.controles.length, 2, "y no se pierde ninguna de las dos");
      // La ruta directa también responde por sí misma.
      const r = await api._vglCarpetaGuardarAhora("", { fecha: "2026-08-21" }, fs);
      t.falso(r.ok, "sin cédula, no");
    });

    // v18.0.72 — HALLAZGO DE ENJAMBRE #20, reproducido antes de tocar nada. `Map.set()`
    // sobre una clave YA existente no cambia su posición de inserción: un paciente con
    // actividad solo al principio de la jornada quedaba SIEMPRE al frente del Map, «el
    // más viejo» para la poda por >200 pacientes, aunque tuviera un guardado en curso
    // AHORA MISMO. La poda lo podía elegir como víctima, y un guardado siguiente para ESE
    // MISMO paciente encontraba su propia clave ya borrada y arrancaba sin encadenar
    // detrás del que seguía en vuelo — la carrera exacta que la cola existe para impedir.
    await t.casoAsync("REGRESIÓN — la poda de la cola de carpeta NO puede desincronizar un guardado en curso (hallazgo #20)", async () => {
      const disco = {};
      const orden = [];
      const fsInstant = () => ({
        leer: async (n) => disco[n],
        escribir: async (n, txt) => { disco[n] = txt; return true; },
      });
      let liberarLectura2 = null;
      const bloqueoLectura2 = new Promise((r) => { liberarLectura2 = r; });
      const fsLentoParaGuardado2 = () => ({
        leer: async (n) => { orden.push("2:leyendo"); await bloqueoLectura2; orden.push("2:leyó"); return disco[n]; },
        escribir: async (n, txt) => { orden.push("2:escribiendo"); disco[n] = txt; orden.push("2:escribió"); return true; },
      });
      const fsInstantParaGuardado3 = () => ({
        leer: async (n) => { orden.push("3:leyendo"); return disco[n]; },
        escribir: async (n, txt) => { orden.push("3:escribiendo"); disco[n] = txt; orden.push("3:escribió"); return true; },
      });

      // 1) Primer guardado de P: siembra su clave AL FRENTE de la cola.
      const r1 = await api.vglCarpetaGuardarInstantanea("900000001", { fecha: "2026-08-01", laboratorios: { A: 1 } }, fsInstant());
      t.cierto(r1.ok, "primer guardado de P");

      // 2) 199 pacientes distintos se cuelan por delante: la cola llega a 200, justo bajo
      //    el umbral de poda, sin tocar todavía la clave de P.
      for (let i = 0; i < 199; i++) {
        await api.vglCarpetaGuardarInstantanea(String(20000000 + i), { fecha: "2026-08-01" }, fsInstant());
      }

      // 3) Segundo guardado de P, con su lectura retenida a mano (simula I/O lento real).
      //    Al arrancar la cola tiene 200 (no poda todavía): su clave se reutiliza sin
      //    moverse de posición — sigue siendo la más vieja.
      const p2 = api.vglCarpetaGuardarInstantanea("900000001", { fecha: "2026-08-02" }, fsLentoParaGuardado2());
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));

      // 4) Un paciente distinto más cruza el umbral de 200: la PRÓXIMA llamada poda.
      await api.vglCarpetaGuardarInstantanea("30000000", { fecha: "2026-08-01" }, fsInstant());

      // 5) Tercer guardado de P, MIENTRAS el segundo sigue colgado en su lectura. Antes del
      //    fix, la poda de esta misma llamada borraba la clave de P (la más vieja) y esta
      //    llamada arrancaba sin encadenar detrás del segundo: los dos leían/escribían el
      //    mismo archivo a la vez.
      const p3 = api.vglCarpetaGuardarInstantanea("900000001", { fecha: "2026-08-03" }, fsInstantParaGuardado3());
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));

      t.falso(orden.indexOf("3:leyendo") >= 0, "el tercer guardado NO arranca mientras el segundo sigue colgado en su lectura");

      liberarLectura2();
      const [res2, res3] = await Promise.all([p2, p3]);
      t.cierto(res2.ok && res3.ok, "los dos terminan bien");
      t.igual(orden.join(","), "2:leyendo,2:leyó,2:escribiendo,2:escribió,3:leyendo,3:escribiendo,3:escribió",
        "el tercero espera a que el segundo termine de punta a punta, no solo a que empiece: " + orden.join(","));

      const historial = await api.vglCarpetaLeerHistorial("900000001", fsInstant());
      t.igual(historial.controles.length, 3, "no se pierde ninguna de las tres instantáneas de P");
    });

    t.caso("_mtrInstantaneaAlMenosTanRica: qué cuenta como «no perder nada»", () => {
      const rica = { laboratorios: { A: 1, B: 1 }, riesgo: { categoria: "ALTO" }, medicamentos: ["x"], renal: { egfr: 55 } };
      const pobre = { laboratorios: {}, riesgo: {}, medicamentos: [], renal: {} };
      t.cierto(api._mtrInstantaneaAlMenosTanRica(rica, pobre), "de pobre a rica, se actualiza");
      t.falso(api._mtrInstantaneaAlMenosTanRica(pobre, rica), "de rica a pobre, NO");
      t.cierto(api._mtrInstantaneaAlMenosTanRica(rica, rica), "igual de completa, se actualiza (la última lectura manda)");
      t.cierto(api._mtrInstantaneaAlMenosTanRica(rica, null), "sin nada previo, siempre");
      t.falso(api._mtrInstantaneaAlMenosTanRica(null, rica), "y sin instantánea nueva no se pisa nada");
    });

    await t.casoAsync("vglCarpetaRestaurar: sin IndexedDB ni handle guardado, no revive nada y no lanza", async () => {
      t.falso(await api.vglCarpetaRestaurar(), "en el banco no hay carpeta que restaurar");
      t.falso(api.vglCarpetaElegida(), "y sigue sin carpeta");
    });

    await t.casoAsync("REGRESIÓN — si el respaldo no se puede escribir, el archivo original NO se toca", async () => {
      const disco = { "777.json": "{{{ corrupto" };
      const fs = {
        leer: async (n) => disco[n],
        escribir: async (n, txt) => {
          if (/roto/.test(n)) throw new Error("disco lleno");
          disco[n] = txt; return true;
        },
      };
      const r = await api.vglCarpetaGuardarInstantanea("777", { fecha: "2026-08-21" }, fs);
      t.falso(r.ok, "no se guarda");
      t.cierto(/no lo toco para no perderlo/.test(r.motivo), "y se dice por qué: " + r.motivo);
      t.igual(disco["777.json"], "{{{ corrupto", "el archivo original queda intacto — antes se borraba el historial entero");
    });

    await t.casoAsync("REGRESIÓN — un archivo con OTRA forma también se respalda, y sin pisar respaldos previos", async () => {
      const disco = { "888.json": JSON.stringify({ v: 9, otraCosa: [1, 2, 3] }) };
      const fs = { leer: async (n) => disco[n], escribir: async (n, txt) => { disco[n] = txt; return true; } };
      const r = await api.vglCarpetaGuardarInstantanea("888", { fecha: "2026-08-21" }, fs);
      t.cierto(r.ok);
      t.cierto(!!r.respaldo, "un JSON válido pero de otra forma también se respalda: antes se descartaba sin copia");
      t.cierto(/otraCosa/.test(String(disco[r.respaldo])), "con su contenido");
      // Segunda corrupción el mismo día: NO puede pisar el respaldo anterior.
      disco["888.json"] = JSON.stringify({ v: 9, otraCosa: ["distinto"] });
      const r2 = await api.vglCarpetaGuardarInstantanea("888", { fecha: "2026-08-21" }, fs);
      t.falso(r2.respaldo === r.respaldo, "el segundo respaldo tiene otro nombre: " + r2.respaldo);
      t.cierto(/otraCosa":\[1/.test(String(disco[r.respaldo])), "y el primero sigue intacto");
    });

    t.caso("REGRESIÓN — el dead-man siembra su sello en el primer arranque", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const fn = src.slice(src.indexOf("function _vglDeadmanRevisar"), src.indexOf("function _vglDeadmanRevisar") + 1600);
      t.cierto(/!_vglDeadmanUltimoContacto\(\)/.test(fn) && /_vglDeadmanSellar/.test(fn),
        "sin sello previo se siembra uno: antes el estado era «al día» para siempre y el interruptor quedaba inerte justo en el equipo que nunca habló con el servidor");
    });

    t.caso("REGRESIÓN — la regla única de sábado está CABLEADA, no solo escrita", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      t.cierto(/grupoSabado: \(typeof mtrSabadoTrabajaEsteMedico === "function"\)/.test(src),
        "el resumen recibe el estado de sábados observados, no el grupo deducido");
      // Con la deducción en «conflicto» el grupo es null y ANTES se tachaban todos los
      // sábados: justo al médico que más sábados trabaja.
      t.falso(api.mtrSabadosHabilitados(null), "un grupo nulo no habilita sábados…");
      t.cierto(api.mtrSabadosHabilitados({ observados: ["2026-08-01"], grupoDeducido: null }),
        "…pero una agenda propia observada SÍ, aunque la deducción del grupo esté en conflicto");
    });

    // ============ 1. LA PENÚLTIMA CREATININA (injuria renal) ============
    // Mismo defecto que tenía el LDL basal: `egfrPrevio` llegaba null SIEMPRE,
    // así que mtrSospechaIra no podía dispararse nunca, con los datos delante.
    t.caso("mtrPenultimaCreatinina: el control ANTERIOR al último, dentro de la ventana", () => {
      const s = labSerie([["2025-08-01", 0.8], ["2026-04-01", 0.9], ["2026-08-01", 1.6]]);
      const p = api.mtrPenultimaCreatinina(s, "2026-08-21", 180);
      t.igual(p.valor, 0.9, "el penúltimo, no el más antiguo ni el más alto");
      t.igual(p.fecha, "2026-04-01");
      t.cierto(p.diasAtras > 130 && p.diasAtras < 150, "y se dice cuánto hace (" + p.diasAtras + " días)");
      t.igual(api.mtrPenultimaCreatinina(labSerie([["2026-08-01", 1.6]]), "2026-08-21", 180), null,
        "con un solo control no hay «anterior»");
      t.igual(api.mtrPenultimaCreatinina(labSerie([["2020-01-01", 0.8], ["2026-08-01", 1.6]]), "2026-08-21", 180), null,
        "un control de hace seis años no dice nada del riñón de hoy");
      // v17.0.1 — la ventana bajó de 365 a 180 días: llamar «agudo» a un cambio de hace
      // once meses era un error de concepto (KDIGO define la injuria aguda en días).
      t.igual(api.mtrPenultimaCreatinina(labSerie([["2025-09-01", 0.8], ["2026-08-01", 1.6]]), "2026-08-21", 180), null,
        "y uno de hace once meses tampoco");
      t.igual(api.mtrPenultimaCreatinina(null, "2026-08-21", 180), null, "y null no lanza");

      // El punto atípico intermedio (muestra diluida, error de digitación) ya no manda.
      const conAtipico = labSerie([["2026-05-01", 1.15], ["2026-06-15", 0.60], ["2026-08-01", 1.10]]);
      const pa = api.mtrPenultimaCreatinina(conAtipico, "2026-08-21", 180);
      t.igual(pa.valor, 1.15, "se usa el control anterior al atípico: antes el 0,60 fabricaba una caída del 30 %");
    });

    t.caso("mtrEgfrPrevioDeSerie + resumen: la sospecha de injuria renal por fin se puede disparar", () => {
      const s = labSerie([["2026-04-01", 0.9], ["2026-08-01", 1.6]]);
      const prev = api.mtrEgfrPrevioDeSerie(s, 66, "F", "2026-08-21");
      t.cierto(prev.egfr > 65 && prev.egfr < 75, "la TFG de entonces se recalcula (" + prev.egfr + ")");
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-21", edad: 66, sexo: "F", creatinina: 1.6, pesoKg: 70,
        factores: { hta: true }, seriesCreatinina: s,
      });
      t.cierto(r.erc.sospechaIra === true, "caída de ~70 a ~35: ESTO es lo que no se podía detectar antes");
      t.igual(r.erc.egfrPrevioFecha, "2026-04-01", "y se dice contra qué control se comparó");
      const sinSerie = api.mtrResumenClinico({
        hoyIso: "2026-08-21", edad: 66, sexo: "F", creatinina: 1.6, pesoKg: 70, factores: { hta: true },
      });
      t.falso(sinSerie.erc.sospechaIra, "sin serie no se inventa una caída");
    });

    // ============ 2. METAS TERAPÉUTICAS EN EL PANEL ============
    t.caso("mtrPanelMetasHtml: LDL y HbA1c con su valor actual y si está en meta", () => {
      const d = {
        meta: { metas: { ldl: 70, reduccion: 50 }, ldlActual: 65, ldlBasal: 150, reduccionPct: 56.7 },
        hba1c: { actual: 6.5, meta: 7 }, esDm2: true,
      };
      const html = api.mtrPanelMetasHtml(d);
      t.cierto(html.indexOf("LDL") >= 0 && html.indexOf("&lt; 70 mg/dL") >= 0, "la meta de LDL");
      t.cierto(html.indexOf("65 mg/dL") >= 0, "con el valor actual al lado");
      t.cierto(html.indexOf("reducción 56.7 %") >= 0, "y la reducción, que antes no se podía calcular");
      t.cierto(html.indexOf("HbA1c") >= 0 && html.indexOf("6.5 %") >= 0, "la de HbA1c, que nunca se mostró en ninguna pantalla");
      t.igual((html.match(/vgl-meta-fila ok/g) || []).length, 2, "las dos en meta, en verde");
      const fuera = api.mtrPanelMetasHtml({ meta: { metas: { ldl: 70, reduccion: null }, ldlActual: 120 }, hba1c: { actual: 9, meta: 7 }, esDm2: true });
      t.igual((fuera.match(/vgl-meta-fila falla/g) || []).length, 2, "las dos fuera de meta, en ámbar");
      t.igual(api.mtrPanelMetasHtml({}), "", "sin metas no se pinta una sección vacía");
      t.igual(api.mtrPanelMetasHtml(null), "", "ni con null");
    });

    t.caso("mtrPanelMetasHtml: sin HbA1c medida NO se muestra meta de HbA1c", () => {
      const html = api.mtrPanelMetasHtml({ meta: { metas: { ldl: 100, reduccion: null }, ldlActual: 90 }, esDm2: true });
      t.cierto(html.indexOf("LDL") >= 0, "la de LDL sí");
      t.falso(html.indexOf("HbA1c") >= 0, "enseñar una meta de HbA1c a quien no tiene el examen invita a pedirlo sin indicación");
      t.falso(html.indexOf("editar-meta-hba1c") >= 0, "y sin fila de HbA1c, tampoco su botón de editar");
    });

    // v17.6.1 — HALLADO POR LA AUDITORÍA DE PRODUCCIÓN de v17.6.0: el comentario de
    // v17.0.0 ("HbA1c: solo se muestra cuando el paciente es diabético") nunca se
    // tradujo en código — la fila salía para CUALQUIER paciente con un valor medido,
    // diabético o no, exactamente lo que ese mismo comentario decía que no debía pasar.
    // Como la fila estuvo apagada (código muerto, por los tres eslabones que le
    // faltaban al dato) desde que se escribió, nadie lo notó hasta ahora. Mismo campo
    // (esDm2) y misma regla que ya usa mtrFueraDeMeta para la alerta de "fuera de meta".
    t.caso("mtrPanelMetasHtml: con HbA1c medida pero SIN diabetes, la fila NO se muestra (v17.6.1)", () => {
      const html = api.mtrPanelMetasHtml({ meta: { metas: { ldl: 100, reduccion: null }, ldlActual: 90 }, hba1c: { actual: 6.9 }, esDm2: false });
      t.cierto(html.indexOf("LDL") >= 0, "la de LDL sí, no depende de diabetes");
      t.falso(html.indexOf("HbA1c") >= 0, "un valor de HbA1c medido en un paciente sin diabetes no basta para mostrar la meta");
      t.falso(html.indexOf("editar-meta-hba1c") >= 0, "y tampoco su botón de editar");
      const sinCampo = api.mtrPanelMetasHtml({ meta: { metas: { ldl: 100, reduccion: null }, ldlActual: 90 }, hba1c: { actual: 6.9 } });
      t.falso(sinCampo.indexOf("HbA1c") >= 0, "y lo mismo si esDm2 ni siquiera viene en el objeto (undefined, no solo false)");
    });

    // v17.6.0 — La tubería para una meta de HbA1c individual quedó lista en v16.4.0
    // ("meta individual de este paciente" ya sabía mostrarse), pero nunca se construyó
    // el campo para fijarla — ver PROCEDE ítem 3. El botón ✏️ es ese campo.
    t.caso("mtrPanelMetasHtml: la fila de HbA1c trae el botón para fijar una meta individual — la de LDL no lo tiene (v17.6.0)", () => {
      const d = {
        meta: { metas: { ldl: 70, reduccion: null }, ldlActual: 65 },
        hba1c: { actual: 6.5, meta: 7 }, esDm2: true,
      };
      const html = api.mtrPanelMetasHtml(d);
      t.cierto(html.indexOf('id="vgl-meta-fila-hba1c"') >= 0,
        "la fila de HbA1c tiene un id fijo — openPanelPacienteModal lo usa para reemplazarla al editar");
      t.cierto(html.indexOf('data-accion="editar-meta-hba1c"') >= 0, "con su botón de editar");
      t.cierto(html.indexOf('aria-label="Fijar una meta de HbA1c individual para este paciente"') >= 0, "y su etiqueta accesible");
      t.igual((html.match(/data-accion="editar-meta-/g) || []).length, 1,
        "solo UN botón de editar meta en toda la sección: LDL todavía no lo tiene");
    });

    // ============ 3. DUPLICIDAD TERAPÉUTICA ============
    t.caso("mtrDuplicidadesTerapeuticas: dos del mismo grupo es duplicidad, y punto", () => {
      const d = api.mtrDuplicidadesTerapeuticas(["LOSARTAN 50MG", "VALSARTAN 80MG", "METFORMINA 850MG"]);
      t.igual(d.length, 1, "un hallazgo: los dos ARA II");
      t.igual(d[0].grupo, "ara2");
      t.igual(d[0].severidad, "alta");
      t.cierto(/hiperkalemia/.test(d[0].mensaje), "con el riesgo concreto, no un «revise»");
      t.falso(d[0].mismoTexto, "son dos moléculas distintas");
    });

    // v17.1.0 (#112) — ESTA PRUEBA CONSAGRABA UN FALSO POSITIVO. Decía que dos renglones
    // idénticos son una duplicidad terapéutica de severidad ALTA. El médico lo corrigió
    // con el sistema delante: en Everest es NORMAL que una sola fórmula genere dos o tres
    // renglones idénticos —dispensación postfechada, mes a mes— y también que el mismo
    // fármaco se renueve en dos controles dentro de la ventana de 15 meses. Ninguna de las
    // dos cosas es que el paciente tome dos estatinas. Y el falso positivo no se quedaba
    // en la pantalla: viajaba al archivo permanente del paciente en su carpeta.
    t.caso("mtrDuplicidadesTerapeuticas: el mismo renglón repetido NO es duplicidad — son fórmulas postfechadas", () => {
      t.igual(api.mtrDuplicidadesTerapeuticas(["ATORVASTATINA 40MG", "ATORVASTATINA 40MG"]).length, 0,
        "dos renglones idénticos son la misma fórmula escrita dos veces");
      t.igual(api.mtrDuplicidadesTerapeuticas(["LOSARTAN 50 MG (TABLETA)", "LOSARTAN 50 MG (TABLETA)", "LOSARTAN 50 MG (TABLETA)"]).length, 0,
        "ni tres: es una orden con cantMeses=3");
      t.igual(api.mtrDuplicidadesTerapeuticas(["losartan 50 mg (tableta)", "LOSARTÁN 50 MG (TABLETA)"]).length, 0,
        "las tildes y las mayúsculas no hacen dos medicamentos");
    });

    t.caso("mtrDuplicidadesTerapeuticas: la duplicidad REAL sobrevive a la deduplicación", () => {
      // El riesgo de deduplicar es apagar la alerta que sí importa. Estas tres la fijan.
      const dosMoleculas = api.mtrDuplicidadesTerapeuticas([
        "LOSARTAN 50MG", "LOSARTAN 50MG", "LOSARTAN 50MG",
        "VALSARTAN 80MG", "VALSARTAN 80MG", "VALSARTAN 80MG",
      ]);
      t.igual(dosMoleculas.length, 1, "dos ARA II distintos, cada uno postfechado ×3, siguen siendo una duplicidad");
      t.igual(dosMoleculas[0].medicamentos.length, 2, "y cada molécula se nombra UNA vez, no seis");

      const dosDosis = api.mtrDuplicidadesTerapeuticas(["LOSARTAN 50 MG", "LOSARTAN 100 MG"]);
      t.igual(dosDosis.length, 1, "dos concentraciones del mismo principio SÍ alertan: la clave conserva la dosis");

      const aines = api.mtrDuplicidadesTerapeuticas(["IBUPROFENO 400MG", "NAPROXENO 250MG"]);
      t.igual(aines.length, 1, "y los grupos que el filtro cardiovascular descarta —AINE— se siguen vigilando");
    });

    t.caso("mtrMedicamentosUnicos: agrupa conservando el orden y el texto del primer renglón", () => {
      const r = api.mtrMedicamentosUnicos(["LOSARTAN 50MG", "METFORMINA 850MG", "LOSARTAN 50MG", "LOSARTAN 100MG"]);
      t.igual(r.length, 3, "tres medicamentos distintos de cuatro renglones");
      t.igual(r[0], "LOSARTAN 50MG", "el orden de llegada manda");
      t.igual(r[1], "METFORMINA 850MG");
      t.igual(r[2], "LOSARTAN 100MG", "otra concentración es otro medicamento");
      t.igual(api.mtrMedicamentosUnicos(null).length, 0, "null no lanza");
      t.igual(api.mtrMedicamentosUnicos(["", "   ", null]).length, 0, "los renglones vacíos no cuentan");
      t.igual(api.mtrMedicamentosUnicos([{ descripcion: "LOSARTAN 50MG" }, { nombre: "LOSARTAN 50MG" }]).length, 1,
        "acepta objetos con nombre o descripcion, como el resto del módulo");
    });

    t.caso("_mtrClaveDedupMedicamento: conserva la concentración — es lo que la separa de _mtrClaveMedicamento", () => {
      t.igual(api._mtrClaveDedupMedicamento("LOSARTÁN 50 MG"), api._mtrClaveDedupMedicamento("losartan  50 mg"),
        "tildes, mayúsculas y espacios de más no cuentan");
      t.cierto(api._mtrClaveDedupMedicamento("LOSARTAN 50 MG") !== api._mtrClaveDedupMedicamento("LOSARTAN 100 MG"),
        "pero 50 mg y 100 mg tienen que seguir siendo dos: esconder eso escondería una duplicidad real");
      t.igual(api._mtrClaveMedicamento("LOSARTAN 50 MG"), api._mtrClaveMedicamento("LOSARTAN 100 MG"),
        "la OTRA clave sí las colapsa (borra los dígitos): por eso no se usa para deduplicar");
      t.igual(api._mtrClaveDedupMedicamento(null), "", "null no lanza");
    });

    t.caso("la pestaña Medicamentos y el «(N)» del Resumen cuentan LO MISMO — era el reporte del médico", () => {
      // Invariante cruzado: el médico veía «(3)» arriba y nueve renglones abajo.
      const crudos = [
        "LOSARTAN 50 MG (TABLETA)", "LOSARTAN 50 MG (TABLETA)", "LOSARTAN 50 MG (TABLETA)",
        "ATORVASTATINA 40 MG (TABLETA)", "ATORVASTATINA 40 MG (TABLETA)", "ATORVASTATINA 40 MG (TABLETA)",
        "METFORMINA 850 MG (TABLETA)", "METFORMINA 850 MG (TABLETA)", "METFORMINA 850 MG (TABLETA)",
      ];
      const html = api.mtrPanelMedicamentosHtml({ medicamentos: crudos });
      const veces = (t2) => (html.match(new RegExp(t2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      t.igual(veces("LOSARTAN 50 MG (TABLETA)"), 1, "el losartán se lista UNA vez, no tres");
      t.igual(veces("ATORVASTATINA 40 MG (TABLETA)"), 1);
      t.igual(veces("METFORMINA 850 MG (TABLETA)"), 1);
      t.cierto(/6 renglón\(es\) repetido\(s\)/.test(html),
        "y se dice cuántos se agruparon: esconderlos sin avisar sería mentir por omisión");
      t.igual(api.mtrMedicamentosRcv(crudos).length, 3, "el «(N)» del Resumen dice lo mismo: 3");
    });

    t.caso("mtrDuplicidadesTerapeuticas: lo que NO es duplicidad", () => {
      t.igual(api.mtrDuplicidadesTerapeuticas(["ENALAPRIL 10MG", "LOSARTAN 50MG"]).length, 0,
        "IECA + ARA II no entra aquí: ya tiene su propia alerta de interacción");
      t.igual(api.mtrDuplicidadesTerapeuticas(["INSULINA GLARGINA", "INSULINA CRISTALINA"]).length, 0,
        "basal + prandial es el esquema correcto, no un error");
      t.igual(api.mtrDuplicidadesTerapeuticas(["METFORMINA 850MG"]).length, 0, "uno solo no puede duplicar");
      t.igual(api.mtrDuplicidadesTerapeuticas([]).length, 0, "lista vacía");
      t.igual(api.mtrDuplicidadesTerapeuticas(null).length, 0, "null no lanza");
    });

    t.caso("mtrRenderDuplicidadesHtml y _mtrClaveMedicamento", () => {
      const html = api.mtrRenderDuplicidadesHtml(["LOSARTAN 50MG", "VALSARTAN 80MG"]);
      t.cierto(html.indexOf("duplicidad") >= 0, "se pinta el bloque");
      t.cierto(/No sustituye su criterio/.test(html), "y se declara que no reemplaza al médico");
      t.igual(api.mtrRenderDuplicidadesHtml(["METFORMINA 850MG"]), "", "sin duplicidad no se pinta nada");
      t.igual(api._mtrClaveMedicamento("ATORVASTATINA 40MG"), "atorvastatina mg", "la clave ignora dosis y signos");
      t.igual(api._mtrClaveMedicamento(null), "", "y null no lanza");
    });

    // ============ 4. PRODUCTIVIDAD ============
    t.caso("mtrProductividadMeta: 18 de lunes a viernes, 24 el sábado, +3 de sobreagenda", () => {
      const lu = api.mtrProductividadMeta("2026-08-17");   // lunes
      t.igual(lu.meta, 18);
      t.igual(lu.citadosEsperados, 21, "18 + 3 de sobreagenda");
      t.falso(lu.esSabado);
      const sa = api.mtrProductividadMeta("2026-08-22");   // sábado
      t.igual(sa.meta, 24);
      t.igual(sa.citadosEsperados, 27);
      t.cierto(sa.esSabado);
      const dom = api.mtrProductividadMeta("2026-08-23");
      t.igual(dom.meta, 0, "el domingo no tiene meta");
      t.cierto(dom.esDomingo);
      t.igual(api.mtrProductividadMeta("no es fecha"), null, "sin fecha, nada");
    });

    t.caso("mtrProdRegistrar: contar la MISMA cita cuarenta veces sigue siendo una cita", () => {
      const c = env;   // el entorno de esta suite basta: se escribe en su propio almacén
      const lista = [
        { doc_id: "111", hora: "07:00", estado: "Atendido" },
        { doc_id: "222", hora: "07:20", estado: "ATENDIDO" },
        { doc_id: "333", hora: "07:40", estado: "En sala" },
      ];
      t.igual(api.mtrProdRegistrar(lista, "2026-08-17"), 2, "dos atendidas de tres citas");
      t.igual(api.mtrProdRegistrar(lista, "2026-08-17"), 2, "segunda vuelta del reloj: sigue siendo 2");
      t.igual(api.mtrProdRegistrar(lista, "2026-08-17"), 2, "y la tercera también — ESTO era «ojo con las duplicaciones»");
      const conMas = lista.concat([{ doc_id: "444", hora: "08:00", estado: "Atendido" }]);
      t.igual(api.mtrProdRegistrar(conMas, "2026-08-17"), 3, "una atendida nueva sí suma");
      t.igual(api.mtrProdAtendidasDe(api.mtrProdLeer(), "2026-08-17"), 3, "y queda guardado");
      t.igual(api.mtrProdAtendidasDe(api.mtrProdLeer(), "2026-08-18"), 0, "otro día, cero");
      t.igual(api.mtrProdAtendidasDe(null, "2026-08-17"), 0, "sin almacén, cero y sin lanzar");
    });

    // v17.0.1 — la clave sale de apptKey, la que el resto del script ya usa. Antes leía
    // `hora`/`horaTexto`, campos que las citas NO tienen (son `hora_texto`), así que dos
    // citas del mismo paciente el mismo día contaban como una sola.
    // =====================================================================
    // v17.53.0 — EL HUECO QUE DEJÓ LA v17.48.0.
    // Aquella entrega hizo tolerantes a los ceros de relleno la memoria del paciente
    // (vgl_cosecha) y el registro del día (vgl_proc_today), y se dejó fuera TRES almacenes
    // más indexados por cédula. El peor es el historial de inasistencias: no caduca por día,
    // así que un paciente archivado bajo la forma rellenada perdía su historial ENTERO y
    // aparecía con cero — sin que nada lo dijera.
    // =====================================================================
    t.caso("v17.53.0: el historial de inasistencias reconoce al paciente con o sin ceros delante", () => {
      const c = cargar({ silencioso: true });
      c.api._noShowGuardar({ "0099900042": { total: 3, ultima: "2026-08-01" } });
      t.igual(c.api._noShowPrevia("0099900042"), 3, "precondición: archivado con ceros");
      t.igual(c.api._noShowPrevia("99900042"), 3, "y consultado sin ellos es el MISMO paciente");
    });

    t.caso("v17.53.0: registrar una inasistencia NO reinicia el contador ya archivado", () => {
      const c = cargar({ silencioso: true });
      c.api._noShowGuardar({ "0099900042": { total: 3, ultima: "2026-08-01" } });
      const total = c.api._noShowRegistrar("99900042");
      t.igual(total, 4, "sigue contando desde 3, no empieza de cero");
      const h = JSON.parse(c.env.almacen["vgl_nosh_hist"] || "{}");
      t.igual(Object.keys(h).length, 1, "y no se crea una segunda ficha para el mismo paciente");
    });

    t.caso("v17.53.0: dos pacientes DISTINTOS siguen sin cruzar su historial de inasistencias", () => {
      const c = cargar({ silencioso: true });
      c.api._noShowGuardar({ "99900042": { total: 5, ultima: "2026-08-01" } });
      t.igual(c.api._noShowPrevia("99900043"), 0, "una cédula vecina no hereda las inasistencias de otro");
      t.igual(c.api._noShowPrevia("199900042"), 0, "ni una que solo comparte el final");
    });

    t.caso("v17.53.0: la clave de productividad no se parte por los ceros de relleno", () => {
      t.igual(api.mtrProdClaveCita({ doc_id: "0099900042", hora_texto: "08:00" }),
              api.mtrProdClaveCita({ doc_id: "99900042", hora_texto: "08:00" }),
              "la misma atención da la misma clave, como promete el comentario de la función");
      t.falso(api.mtrProdClaveCita({ doc_id: "99900042", hora_texto: "08:00" })
              === api.mtrProdClaveCita({ doc_id: "99900043", hora_texto: "08:00" }),
              "y dos pacientes distintos siguen siendo dos");
    });

    t.caso("mtrProdClaveCita: dos citas del mismo paciente el mismo día son DOS citas", () => {
      const a = api.mtrProdClaveCita({ doc_id: "111", hora_texto: "07:00" });
      const b = api.mtrProdClaveCita({ doc_id: "111", hora_texto: "09:20" });
      t.cierto(!!a && !!b, "las dos tienen clave");
      t.falso(a === b, "y son distintas: ESTE era el defecto (" + a + " vs " + b + ")");
      t.igual(api.mtrProdClaveCita({ doc_id: "111", hora_texto: "07:00" }), a, "la misma cita da siempre la misma clave");
      const sinDoc = api.mtrProdClaveCita({ nombre: "PACIENTE X", index: 3, hora_texto: "08:00" });
      t.cierto(!!sinDoc, "sin documento legible la cita NO se pierde: cae en nombre+posición");
      t.igual(api.mtrProdClaveCita(null), null, "null no lanza");
    });

    t.caso("mtrProductividadVistas: día, semana y mes, y los días no trabajados NO cuentan en contra", () => {
      const todo = {
        "2026-08-17": { atendidas: { a: 1, b: 1, c: 1 } },      // lunes: 3
        "2026-08-18": { atendidas: {} },                         // martes: registrado pero vacío
        "2026-08-19": { atendidas: { d: 1, e: 1 } },             // miércoles: 2
      };
      const v = api.mtrProductividadVistas(todo, "2026-08-19");
      t.igual(v.diaria.atendidas, 2, "hoy, 2");
      t.igual(v.diaria.meta, 18);
      t.igual(v.diaria.faltan, 16, "y cuántas faltan para la meta");
      t.igual(v.semanal.atendidas, 5, "la semana suma lunes y miércoles");
      t.igual(v.semanal.dias, 2, "dos días trabajados: el martes sin ninguna atendida NO cuenta");
      // v18.0.64 — ORDEN DEL MÉDICO (01-sep, con captura): «¿CÓMO ASÍ QUE 23/36? ¿NO DEBERÍA
      // MÁS BIEN MOSTRAR CUÁNTOS PACIENTES HE VISTO DE LOS QUE TENGO QUE VER A LA SEMANA?».
      // El denominador pasa de «la meta de los días ya trabajados» a la meta COMPLETA del
      // periodo. Esta semana (17 al 23-ago), con hoy = miércoles 19:
      //   · lunes 17: FESTIVO en Colombia (Asunción, trasladado) -> no pone meta. El médico
      //     lo confirmó por escrito el 1-sep: «YO NO TRABAJO NI DOMINGOS NI FESTIVOS», así
      //     que un festivo nunca debe pedirle 18 pacientes.
      //   · sus 3 atendidas de ese día SÍ se cuentan igual. No porque se espere que trabaje
      //     un festivo, sino porque el numerador no puede depender de que nuestra tabla de
      //     festivos esté bien: ya tuvo un 2024-11-18 equivocado (ver esFestivo), y un error
      //     de esa tabla jamás puede borrarle pacientes que sí atendió.
      //   · martes 18: pasado y sin ninguna atendida -> no cuenta en contra (regla vieja,
      //     que se conserva: no reprochar un día que no le tocaba);
      //   · miércoles 19 (hoy) + jueves 20 + viernes 21 -> 3 × 18 = 54;
      //   · sábado 22: futuro Y ES DE LOS SUYOS. v18.0.66: el médico fijó el turno —«LOS
      //     SÁBADOS DE TRABAJO SON CADA 2 SEMANAS, ME TOCA ESTE SÁBADO NUEVAMENTE
      //     5/09/2026»—, y contando de dos en dos desde ese ancla, el 22-ago le toca (su
      //     propia telemetría lo confirma: trabajó el 22 y no el 29). Un sábado suyo son 24.
      t.igual(v.semanal.meta, 78, "3 × 18 de lunes a viernes + 24 del sábado que le toca");
      t.igual(v.semanal.faltan, 73, "y dice cuántos pacientes le quedan para cumplirla");
      t.igual(v.semanal.metaHastaHoy, 18, "el ritmo se mide contra lo que YA debería estar hecho");
      t.igual(v.semanal.ritmo, 27.8, "5 de 18 al día de hoy — este es el número que decide el color");
      t.igual(v.semanal.diasPorDelante, 3, "jueves, viernes y el sábado que sí le toca");
      // v18.0.66 — el turno de sábado, contra su historia real: el 22-ago trabajó (1.534
      // eventos en el tablero) y el 29-ago no (ni uno). El ancla que él dio reproduce las
      // dos cosas sin que nadie se lo diga al banco.
      t.cierto(api._prodEsSabadoDelMedico("2026-08-22"), "el 22-ago le tocaba, y trabajó");
      t.falso(api._prodEsSabadoDelMedico("2026-08-29"), "el 29-ago no le tocaba, y no trabajó");
      t.cierto(api._prodEsSabadoDelMedico("2026-09-05"), "el 5-sep le toca — es el ancla que él fijó");
      t.falso(api._prodEsSabadoDelMedico("2026-09-04"), "un viernes no es sábado de nadie");
      t.cierto(v.mensual.atendidas >= 5, "el mes acumula desde el día 1");
      t.igual(api.mtrProductividadVistas({}, "no es fecha"), null, "sin fecha no hay vistas");
    });

    // v18.0.68 — CORRECCIÓN DEL PROPIO MÉDICO SOBRE SU PEDIDO ANTERIOR: «no es lo mismo para
    // todos los médicos, toca indagar médico por médico cuál de todos los sábados le toca
    // laborar, pero el ancla de 5 septiembre me sirve a mí, a maría edineth pino, a sinai
    // mijares». El ancla no puede vivir como constante del script: cada médico la pone en
    // Ajustes (S.sabadoAncla), y el 5-sep queda solo como el valor predeterminado.
    t.caso("v18.0.68: el ancla de sábado es por médico, no una constante del script", () => {
      // Otro médico con turno desfasado una semana respecto al 5-sep.
      t.cierto(api._prodEsSabadoDelMedico("2026-09-12", "2026-09-12"), "su propio ancla, sí");
      t.falso(api._prodEsSabadoDelMedico("2026-09-05", "2026-09-12"), "el 5-sep no es suyo");
      t.cierto(api._prodEsSabadoDelMedico("2026-09-26", "2026-09-12"), "dos semanas después, sí");

      // Un médico que no trabaja sábados: ancla vacía, nunca cuenta ninguno.
      t.falso(api._prodEsSabadoDelMedico("2026-09-05", ""), "ancla vacía = no trabaja sábados");
      t.falso(api._prodEsSabadoDelMedico("2026-08-22", ""), "ningún sábado, sea cual sea");

      // Un ancla mal escrita (no cae en sábado) no se adivina: se ignora.
      t.falso(api._prodEsSabadoDelMedico("2026-09-05", "2026-09-08"), "el 8-sep es martes, no un ancla válida");

      // Sin argumento, cae al ajuste guardado (S.sabadoAncla) y, si tampoco existe, al
      // predeterminado del médico que pidió esta regla.
      t.cierto(api._prodEsSabadoDelMedico("2026-09-05"), "sin argumento, usa S.sabadoAncla o su default");
    });

    t.caso("mtrProductividadHtml: las tres filas, con el porcentaje y qué falta", () => {
      const v = api.mtrProductividadVistas({ "2026-08-17": { atendidas: { a: 1, b: 1 } } }, "2026-08-17");
      const html = api.mtrProductividadHtml(v);
      t.cierto(html.indexOf("Hoy") >= 0 && html.indexOf("Semana") >= 0 && html.indexOf("Mes") >= 0, "las tres vistas");
      t.cierto(html.indexOf("faltan 16") >= 0, "dice cuántas faltan");
      t.cierto(html.indexOf("2<i> / 18</i>") >= 0, "y el numerador sobre la meta");
      const dom = api.mtrProductividadHtml(api.mtrProductividadVistas({}, "2026-08-23"));
      t.cierto(dom.indexOf("Domingo: sin meta") >= 0, "el domingo se dice y no se reprocha");
      t.igual(api.mtrProductividadHtml(null), "", "sin datos no se pinta");
    });

    // v17.6.3 — D2 (decisión del médico, 22-ago): export semanal de productividad en CSV.
    // De lunes a hoy, una fila por día y un total; el día sin ninguna atendida no cuenta
    // meta en contra (misma regla que la vista semanal).
    t.caso("mtrProductividadCsvSemana: una fila por día + total, y los días no trabajados no meten meta", () => {
      const todo = {
        "2026-08-17": { atendidas: { a: 1, b: 1, c: 1 }, citados: 20 },   // lunes: 3/18
        "2026-08-18": { atendidas: {}, citados: 21 },                     // martes: nadie atendió
        "2026-08-19": { atendidas: { d: 1, e: 1 }, citados: 19 },         // miércoles: 2/18
      };
      const csv = api.mtrProductividadCsvSemana(todo, "2026-08-19");
      const lineas = csv.split("\r\n");
      t.cierto(lineas.length === 5, "cabecera + lunes + martes + miércoles + total = 5 líneas");
      t.cierto(/^Fecha,Atendidas,Meta,Cumplimiento %,Citados en agenda$/.test(lineas[0]), "cabecera exacta");
      t.cierto(/^2026-08-17,3,18,16.7,20$/.test(lineas[1]), "lunes: 3 de 18, cumplimiento 16,7 %");
      t.cierto(/^2026-08-18,0,,,21$/.test(lineas[2]), "martes: 0 atendidas, meta vacía (no trabajó — no cuenta en contra)");
      t.cierto(/^2026-08-19,2,18,11.1,19$/.test(lineas[3]), "miércoles: 2 de 18, 11,1 %");
      t.cierto(/^TOTAL SEMANA,5,36,13.9,60$/.test(lineas[4]), "totales: 5 atendidas sobre 36 de meta (13,9 %), 60 citados");
    });

    t.caso("mtrProductividadCsvSemana: fecha inválida o registro vacío no lanza y no inventa", () => {
      t.igual(api.mtrProductividadCsvSemana({}, "no es fecha"), "", "fecha inválida: CSV vacío");
      const csv = api.mtrProductividadCsvSemana({}, "2026-08-19");
      t.cierto(/^Fecha,Atendidas,Meta,Cumplimiento %,Citados en agenda\r\n/.test(csv), "con registro vacío sale la cabecera");
      const ultima = csv.split("\r\n").pop();
      t.cierto(/^TOTAL SEMANA,0,0,,0$/.test(ultima), "total sin meta: el cumplimiento del total queda vacío (no inventa un 0 %)");
    });

    // v17.6.2 — REPORTE EN VIVO (22-ago): «atendí a 10 y el Resumen dice 20». La misma cita
    // puede llegar con DOS claves distintas según la fuente del tick: el API trae el
    // documento y el DOM (o el fallback) no, o al revés. `porNombreHora` cuelga la identidad
    // estable (nombre+hora) al hueco ya usado para que la segunda aparición no sume.
    t.caso("mtrProdRegistrar: la misma cita vista por API (con doc) y por DOM (sin doc) NO cuenta dos veces", () => {
      const porApi = [
        { doc_id: "111", nombre: "PEREZ JUAN", hora_texto: "08:00", estado: "Atendido" },
        { doc_id: "222", nombre: "GOMEZ MARIA", hora_texto: "08:20", estado: "Atendido" },
      ];
      // Misma agenda, misma hora y mismo nombre, pero leída del DOM SIN documento legible.
      const porDom = [
        { nombre: "PEREZ JUAN", hora_texto: "8:00 a. m.", estado: "Atendido" },
        { nombre: "GOMEZ MARIA", hora_texto: "08:20 a. m.", estado: "Atendido" },
      ];
      t.igual(api.mtrProdRegistrar(porApi, "2026-08-22"), 2, "primero llega el API: 2 atendidas");
      t.igual(api.mtrProdRegistrar(porDom, "2026-08-22"), 2, "el DOM con la MISMA agenda (sin doc): sigue siendo 2, no 4 — ESTE era el doble conteo");
      t.igual(api.mtrProdAtendidasDe(api.mtrProdLeer(), "2026-08-22"), 2, "y el almacén guarda 2");
    });

    t.caso("mtrProdRegistrar: dos citas del MISMO nombre a horas distintas NO colapsan (la hora está en la identidad)", () => {
      const lista = [
        { nombre: "PEREZ JUAN", hora_texto: "08:00", estado: "Atendido" },
        { nombre: "PEREZ JUAN", hora_texto: "09:30", estado: "Atendido" },
      ];
      t.igual(api.mtrProdRegistrar(lista, "2026-08-25"), 2, "mismo nombre, horas distintas: son dos atenciones, no se fusionan");
    });

    t.caso("mtrProdClaveCita: sin documento, la clave ya NO depende de la posición en la lista", () => {
      const a = api.mtrProdClaveCita({ nombre: "PACIENTE X", index: 3, hora_texto: "08:00" });
      const b = api.mtrProdClaveCita({ nombre: "PACIENTE X", index: 7, hora_texto: "08:00" });
      t.cierto(!!a && !!b, "las dos tienen clave");
      t.igual(a, b, "y es la MISMA: el índice de la fila cambiaba entre API y DOM y duplicaba la misma cita (10→20 del reporte)");
      // La identidad auxiliar (la que cuelga API y DOM al mismo hueco) también se normaliza:
      t.igual(api.mtrProdNombreHora({ nombre: "  PEREZ  JUAN ", hora_texto: "8:00 a. m." }),
        api.mtrProdNombreHora({ nombre: "pereZ jUAN", hora_texto: "08:00" }),
        "nombre (espacios/mayúsculas) y hora (texto crudo) se normalizan igual en las dos fuentes");
      t.igual(api.mtrProdNombreHora({ hora_texto: "08:00" }), "", "sin nombre, no hay identidad auxiliar (no puede colgarse a nada)");
    });

    // ============ 5. CARPETA LOCAL ============
    await t.casoAsync("carpeta: un .json por cédula, historial completo, y un control por día", async () => {
      const disco = {};
      const fs = { leer: async (n) => disco[n], escribir: async (n, txt) => { disco[n] = txt; return true; } };
      const inst = (fecha, ldl) => api.mtrInstantaneaDeResumen({
        factores: { edad: 66, sexo: "F" }, riesgo: { categoria: "ALTO", criterios: ["diabetes"] },
        erc: { egfr: 55, estadioClinico: "G3a" }, meta: { metas: { ldl: 70 }, ldlActual: ldl },
        medicamentos: ["LOSARTAN 50MG"],
      }, {}, fecha);

      const r1 = await api.vglCarpetaGuardarInstantanea("1093800", inst("2026-02-01", 150), fs);
      t.cierto(r1.ok, "se guardó");
      t.igual(r1.archivo, "1093800.json", "un archivo por cédula");
      await api.vglCarpetaGuardarInstantanea("1093800", inst("2026-08-01", 90), fs);
      const r3 = await api.vglCarpetaGuardarInstantanea("1093800", inst("2026-08-01", 85), fs);
      t.igual(r3.controles, 2, "el mismo día se REEMPLAZA (abrir el panel cuatro veces no son cuatro controles)");

      const h = await api.vglCarpetaLeerHistorial("1093800", fs);
      t.igual(h.controles.length, 2);
      t.igual(h.controles[0].fecha, "2026-02-01", "ordenado del más viejo al más nuevo");
      t.igual(h.controles[1].metas.ldlActual, 85, "y del día repetido queda la última lectura");
      t.igual(h.controles[0].riesgo.categoria, "ALTO", "la instantánea trae el riesgo…");
      t.igual(h.controles[0].renal.egfr, 55, "…la función renal…");
      t.igual(h.controles[0].medicamentos.length, 1, "…y los medicamentos");
    });

    await t.casoAsync("carpeta: un archivo ilegible se conserva al lado en vez de pisarse", async () => {
      const disco = { "999.json": "esto no es json {{{" };
      const fs = { leer: async (n) => disco[n], escribir: async (n, txt) => { disco[n] = txt; return true; } };
      const r = await api.vglCarpetaGuardarInstantanea("999", { fecha: "2026-08-21" }, fs);
      t.cierto(r.ok, "se guarda igual: el médico no pierde el control de hoy");
      t.cierto(/^999\.roto-/.test(String(r.respaldo)), "y lo ilegible queda al lado con nombre único: " + r.respaldo);
      t.cierto(String(disco[r.respaldo]).indexOf("{{{") >= 0, "con su contenido intacto");
    });

    await t.casoAsync("carpeta: sin cédula y sin carpeta, se dice por qué", async () => {
      const r1 = await api.vglCarpetaGuardarInstantanea("", { fecha: "2026-08-21" }, { leer: async () => null, escribir: async () => true });
      t.falso(r1.ok);
      t.cierto(/cédula/.test(r1.motivo), "sin cédula no se puede nombrar el archivo");
      const r2 = await api.vglCarpetaGuardarInstantanea("123", { fecha: "2026-08-21" }, null);
      t.falso(r2.ok);
      t.cierto(/carpeta/i.test(r2.motivo), "y sin carpeta elegida se dice, no se falla en silencio (" + r2.motivo + ")");
      t.igual(await api.vglCarpetaLeerHistorial("123", null), null, "leer sin carpeta devuelve null");
      t.igual(await api.vglCarpetaLeerHistorial("", { leer: async () => "{}" }), null, "y sin cédula, también");
      // v17.0.2 — Un disco que no deja LEER ya no se toma por «archivo nuevo»: era la
      // cuarta forma de borrar el historial, y la más silenciosa porque devolvía ok:true.
      const fsRoto = { leer: async () => { throw new Error("disco"); }, escribir: async () => { throw new Error("disco"); } };
      const r3 = await api.vglCarpetaGuardarInstantanea("123", { fecha: "2026-08-21" }, fsRoto);
      t.falso(r3.ok, "un disco que falla se reporta");
      t.cierto(/NO lo sobrescribo/.test(r3.motivo), "y se dice que el historial se queda como está: " + r3.motivo);
      // Un archivo que de verdad no existe sí es un archivo nuevo, y se crea.
      const fsVacio = { leer: async () => { const e = new Error("no such file"); e.name = "NotFoundError"; throw e; }, escribir: async () => true };
      const r4 = await api.vglCarpetaGuardarInstantanea("124", { fecha: "2026-08-21" }, fsVacio);
      t.cierto(r4.ok, "el paciente sin archivo previo estrena el suyo");
      t.igual(await api.vglCarpetaLeerHistorial("123", fsRoto), null, "y la lectura rota no lanza");
    });

    t.caso("mtrHistorialAgregar y mtrNombreArchivoPaciente: las piezas sueltas", () => {
      const h1 = api.mtrHistorialAgregar(null, { fecha: "2026-08-01" });
      t.igual(h1.controles.length, 1, "sin historial previo se crea");
      const h2 = api.mtrHistorialAgregar(h1, { fecha: "2026-02-01" });
      t.igual(h2.controles[0].fecha, "2026-02-01", "una instantánea vieja se coloca en su sitio, no al final");
      t.igual(api.mtrHistorialAgregar(h2, {}).controles.length, 2, "sin fecha no se agrega nada");
      t.igual(api.mtrNombreArchivoPaciente("1.093.800"), "1093800.json", "el nombre sale de la cédula limpia");
      t.igual(api.mtrNombreArchivoPaciente("abc"), null, "sin dígitos no hay archivo");
      t.igual(api.mtrNombreArchivoPaciente(null), null, "ni con null");
    });

    t.caso("carpeta: el estado se puede consultar sin abrir ningún diálogo", () => {
      t.igual(typeof api.vglCarpetaDisponible(), "boolean", "se puede preguntar si el navegador la soporta");
      t.falso(api.vglCarpetaElegida(), "en el banco no hay carpeta elegida");
      t.igual(api._vglCarpetaFsReal(), null, "y sin carpeta no hay sistema de archivos que devolver");
    });

    await t.casoAsync("vglCarpetaElegir: sin soporte del navegador lo dice, no lanza", async () => {
      const r = await api.vglCarpetaElegir();
      t.falso(r.ok);
      t.cierto(/navegador|carpeta/i.test(r.motivo), "explica por qué: " + r.motivo);
    });

    // ============ 6. PRELLENADO DE ENFERMEDAD ACTUAL ============
    t.caso("mtrControlAnteriorDe y mtrAnclaControlAnterior: el control de hoy continúa el pasado", () => {
      const hist = { controles: [
        { fecha: "2026-02-01", riesgo: { categoria: "alto" }, renal: { egfr: 62, estadioClinico: "G2" },
          metas: { ldlActual: 130, ldl: 70, hba1c: 8.4, hba1cMeta: 7 },
          medicamentos: ["LOSARTAN 50MG", "ATORVASTATINA 40MG"], plan: { ordenar: ["Creatinina", "RAC"] } },
        { fecha: "2026-08-21", riesgo: { categoria: "alto" } },
      ] };
      const prev = api.mtrControlAnteriorDe(hist, "2026-08-21");
      t.igual(prev.fecha, "2026-02-01", "el anterior a hoy, no el de hoy");
      const txt = api.mtrAnclaControlAnterior(prev, "2026-08-21");
      t.cierto(/CONTROL ANTERIOR/.test(txt), "el bloque va rotulado");
      t.cierto(/hace 7 meses/.test(txt), "con el tiempo transcurrido en lenguaje de consulta");
      t.cierto(/LDL 130/.test(txt) && /HbA1c 8.4/.test(txt), "las cifras de entonces");
      t.cierto(/venía con 2 medicamento/.test(txt), "y con qué venía");
      t.falso(/\d{4}-\d{2}-\d{2}/.test(txt), "sin fechas absolutas: lo que viaja al modelo va relativizado");
    });

    t.caso("mtrPrellenadoEnfermedadActual: sin historial NO se inventa un control anterior", () => {
      const sin = api.mtrPrellenadoEnfermedadActual(null, "2026-08-21");
      t.falso(sin.hay, "sin carpeta ni historial, no hay ancla");
      t.igual(sin.texto, "", "y no se fabrica ninguna");
      const soloHoy = api.mtrPrellenadoEnfermedadActual({ controles: [{ fecha: "2026-08-21" }] }, "2026-08-21");
      t.falso(soloHoy.hay, "el control de hoy no es su propio antecedente");
      const conDatos = api.mtrPrellenadoEnfermedadActual({ controles: [{ fecha: "2026-02-01", metas: { ldlActual: 130 } }] }, "2026-08-21");
      t.cierto(conDatos.hay, "con un control previo con datos, sí");
      t.igual(conDatos.fecha, "2026-02-01", "y se sabe de cuándo, para poder decírselo al médico");
    });

    t.caso("el prompt de Enfermedad Actual usa el ancla solo cuando la hay", () => {
      const hoja = api.mtrHojaDeHechos({ factores: { edad: 60, sexo: "F" } }, { ultimos: {}, hoyIso: "2026-08-21" });
      const con = api.mtrRedaccionPrompt("enfermedad_actual", hoja, { anclaControlAnterior: "CONTROL ANTERIOR (hace 6 meses): LDL 130." });
      t.cierto(/CONTROL ANTERIOR/.test(con.user), "el bloque llega al modelo");
      t.cierto(/control anterior/i.test(con.user), "y la instrucción le dice que sitúe al paciente respecto de él");
      t.cierto(/si algo no está ahí, no lo afirmes/i.test(con.user), "con la guarda de no inventar");
      const sin = api.mtrRedaccionPrompt("enfermedad_actual", hoja, {});
      t.falso(/CONTROL ANTERIOR/.test(sin.user), "sin ancla, ni una palabra de un control que no se leyó");
    });

    // ============ 7. LLENAR EVEREST (fase 2 del Panel) ============
    t.caso("mtrCamposLlenables: solo lo VACÍO y solo lo que está en pantalla", () => {
      const dom = domConCampos({
        "AntecedentePatologicos.Hipertension": radiosDe("AntecedentePatologicos.Hipertension", null),
        "AntecedentePatologicos.Diabetes": radiosDe("AntecedentePatologicos.Diabetes", "true"),
      });
      const faltan = api.mtrCamposLlenables("555000", dom);
      const claves = faltan.map((f) => f.clave);
      t.cierto(claves.indexOf("hta") >= 0, "la hipertensión está en blanco: se puede ofrecer");
      t.falso(claves.indexOf("diabetes") >= 0, "la diabetes ya está marcada: NO se toca");
      t.falso(claves.indexOf("tabaquismo") >= 0, "el tabaquismo no está en esta pantalla: no se promete lo imposible");
      t.igual(api.mtrCamposLlenables("555000", null).length, 0, "sin DOM, nada");
    });

    t.caso("vglLlenarFactoresEnEverest: escribe lo respondido, respeta lo documentado y deja Deshacer", () => {
      const hta = radiosDe("AntecedentePatologicos.Hipertension", null);
      const dm = radiosDe("AntecedentePatologicos.Diabetes", "false");
      const dislip = radiosDe("AntecedentePatologicos.Dislipidemia", null);
      const dom = domConCampos({
        "AntecedentePatologicos.Hipertension": hta,
        "AntecedentePatologicos.Diabetes": dm,
        "AntecedentePatologicos.Dislipidemia": dislip,
      });
      const r = api.vglLlenarFactoresEnEverest(
        { hta: true, diabetes: true, dislipidemia: null }, null, dom);
      t.igual(r.escritas, 1, "solo la hipertensión: es la única vacía CON respuesta");
      t.igual(r.respetadas, 1, "la diabetes ya estaba documentada y NO se pisó");
      t.cierto(hta[0].checked, "quedó marcado el «Sí» que él respondió");
      t.falso(dislip[0].checked || dislip[1].checked, "lo que dejó en «no sé» sigue en blanco");
      t.falso(dm[0].checked, "y lo documentado sigue como estaba, aunque él dijera lo contrario");
      t.igual(r.pares.length, 1, "queda la foto para Deshacer");
      t.cierto(/1 casilla\(s\) llenadas/.test(api.mtrMensajeLlenado(r)), "y se dice qué se hizo");
      t.cierto(/respetadas/.test(api.mtrMensajeLlenado(r)), "incluido lo que NO se tocó");
    });

    t.caso("_vglMarcarRadio: marca como lo haría el médico y COMPRUEBA que quedó", () => {
      const r = radiosDe("X", null)[0];
      let clics = 0;
      r.click = function () { clics++; this.checked = true; };
      t.cierto(api._vglMarcarRadio(r), "quedó marcado");
      t.igual(clics, 1, "por un clic real, que es lo que Angular escucha");
      // Un radio que se niega a marcarse (Everest deshabilitado, por ejemplo) NO se
      // cuenta como escrito: cantar éxitos sin comprobar es el defecto de la auditoría #6.
      const terco = { checked: false, click() {}, dispatchEvent() { return true; } };
      Object.defineProperty(terco, "checked", { get: () => false, set: () => {}, configurable: true });
      t.falso(api._vglMarcarRadio(terco), "si no quedó marcado, no se cuenta");
      t.falso(api._vglMarcarRadio(null), "y null no lanza");
    });

    t.caso("vglLlenarFactoresEnEverest: sin respuestas y sin DOM no lanza ni escribe", () => {
      t.igual(api.vglLlenarFactoresEnEverest({}, null, domConCampos({})).escritas, 0);
      t.igual(api.vglLlenarFactoresEnEverest(null, null, null).escritas, 0);
      t.cierto(/No había ninguna casilla/.test(api.mtrMensajeLlenado({ escritas: 0, respetadas: 0 })), "y se explica");
      t.cierto(/ya no es la de este paciente/.test(api.mtrMensajeLlenado({ otroPaciente: true })), "el cambio de paciente tiene su mensaje");
    });

    t.caso("vglModalLlenarCampos: sin campos que pedir, no se muestra nada", () => {
      let llamado = false;
      t.falso(api.vglModalLlenarCampos({ doc_id: "1" }, [], () => { llamado = true; }), "no abre el emergente");
      t.cierto(llamado, "pero sí sigue el flujo: el Panel no se queda esperando");
      t.noLanza(() => api.vglModalLlenarCampos(null, null, null), "y con basura no lanza");
    });

    // ============ 8. DEAD-MAN SWITCH ============
    t.caso("mtrDeadmanEstado: se repliega por etapas, y solo si hay servidor de control", () => {
      const dia = 86400000, ahora = 1000 * dia;
      t.igual(api.mtrDeadmanEstado(ahora - 3 * dia, ahora, true).estado, "al_dia", "tres días es normal");
      t.igual(api.mtrDeadmanEstado(ahora - 8 * dia, ahora, true).estado, "avisar", "a los 7 se avisa");
      t.cierto(api.mtrDeadmanEstado(ahora - 8 * dia, ahora, true).escrituraPermitida, "pero se sigue pudiendo escribir");
      const cortado = api.mtrDeadmanEstado(ahora - 25 * dia, ahora, true);
      t.igual(cortado.estado, "sin_escritura", "a los 21 se corta la escritura");
      t.falso(cortado.escrituraPermitida, "y solo la escritura");
      t.igual(api.mtrDeadmanEstado(ahora - 90 * dia, ahora, false).estado, "sin_control",
        "sin servidor configurado no hay dead-man: no se castiga a quien nunca tuvo control remoto");
      t.cierto(api.mtrDeadmanEstado(null, ahora, true).escrituraPermitida,
        "un equipo recién instalado no se castiga por no haber hablado todavía");
    });

    t.caso("mtrDeadmanMensaje: dice cuántos días y qué se apagó exactamente", () => {
      const m = api.mtrDeadmanMensaje({ estado: "sin_escritura", dias: 25 });
      t.cierto(/25 días/.test(m), "el número");
      t.cierto(/dejo de escribir en la historia/.test(m), "qué se apagó");
      t.cierto(/todo lo demás sigue/.test(m), "y qué NO se apagó, que es lo que evita el susto");
      t.cierto(/21/.test(api.mtrDeadmanMensaje({ estado: "avisar", dias: 9 })), "el aviso anuncia el plazo");
      t.igual(api.mtrDeadmanMensaje({ estado: "al_dia" }), "", "al día no se dice nada");
      t.igual(api.mtrDeadmanMensaje(null), "", "y null no lanza");
    });

    await t.casoAsync("el sello del último contacto y la puerta de escritura", async () => {
      const c = await cargar({ silencioso: true });
      // Este script SÍ trae servidor de control configurado, así que el dead-man aplica.
      c.api._vglDeadmanSellar(Date.now());
      t.cierto(typeof c.api._vglDeadmanUltimoContacto() === "number", "el sello queda guardado");
      t.cierto(c.api.vglEscrituraPermitida(), "recién contactado: se puede escribir");
      t.falso(c.api._vglDeadmanRevisar(), "y no hay nada que avisar");
      c.api._vglDeadmanSellar(Date.now() - 40 * 86400000);
      t.falso(c.api.vglEscrituraPermitida(), "40 días sin contacto: se corta la escritura en la historia");
      t.cierto(c.api._vglDeadmanRevisar(), "y se avisa");
      t.igual(c.env.storage.getItem("vgl_deadman_aviso"), c.api.todayStamp(),
        "queda el sello del día: el aviso no se repite en la misma jornada");
      // Y con la escritura cortada, el llenado de antecedentes se niega y lo dice.
      const r = c.api.vglLlenarFactoresEnEverest({ hta: true }, null, { querySelectorAll: () => [] });
      t.cierto(r.bloqueadoDeadman, "el llenado en Everest queda bloqueado");
      t.cierto(/no escribe en la historia/.test(c.api.mtrMensajeLlenado(r)), "con su explicación al médico");
    });
  },
};
