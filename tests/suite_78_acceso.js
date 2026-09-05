// =====================================================================
//  SUITE 78 — ACCESO POR MÉDICO (Misión B, arreglo B1: núcleo)
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que el perfil del médico en
//  sesión salga de UNA sola fuente de verdad (la lista `vgl_acceso_lista`,
//  respaldo local de la lista remota), con uid por delante del nombre,
//  blocklist que gana SIEMPRE y en silencio, gracia de 12 h sin identidad
//  y las capacidades públicas psic_odonto/pym (entrevista 1C/2B) al
//  alcance de todo médico NO bloqueado — incluida la generación de
//  órdenes PyM, que el mapeo de implementación demostró ser la misma
//  superficie que el modal L30103 (único escritor apiOrdenamientoGuardar).
//
//  Los NOMBRES del padrón NO viven en el userscript (7A): la suite los
//  siembra en `vgl_acceso_lista` como haría la lista remota (arreglo B2).
// =====================================================================

"use strict";

const LISTA_OK = {
  version: "2026-09-04.1",
  emitida: "2026-09-04T08:00:00",
  perfiles: {
    COMPLETO: [
      { uid: 101, nombre: "Brandon Jesús Palencia Martínez" },
      { uid: 102, nombre: "Eliseth Estrada" },
      { uid: 103, nombre: "María Edineth Pino" },
      { uid: 104, nombre: "Sinaí Mijares" },
    ],
    LABORATORIOS: [
      { uid: 201, nombre: "Maryuris Terán" },
      { uid: 202, nombre: "Daniela Zuluaga" },
      { uid: 203, nombre: "Moisés Carpio" },
    ],
  },
  blocklist: [
    { uid: 999, nombre: "Prueba Bloqueada Uno", motivo: "banco" },
  ],
};

const CAPS_LABS = ["centinela", "notificaciones", "agendar_labs", "laboratorios",
  "widget_examen_normal", "widget_examenes_autolabs", "aviso_paciente_nuevo"];
const CAPS_SOLO_COMPLETO = ["agendar_control", "panel_paciente", "redactor_ia", "rcv"];
const CAPS_PUBLICAS = ["psic_odonto", "pym"];

function conDoctor(api, id, name) {
  api.__state.activeDoctor.id = id;
  api.__state.activeDoctor.name = name;
}

function cargarCon(cargar, almacen) {
  return cargar({ silencioso: true, almacen: almacen });
}

function listaEnStorage(extra) {
  const almacen = { vgl_acceso_lista: JSON.stringify(LISTA_OK) };
  if (extra) Object.assign(almacen, extra);
  return almacen;
}

module.exports = {
  nombre: "Acceso por médico (B1+B2): perfil, blocklist, gracia, capacidades, lista remota y envoltorios",

  cubre: ["mtrEsMedicoAutorizado", "esMedicoRCVActivo", "mtrNormalizarNombre",
    "accesoPerfil", "accesoCap", "accesoLeerLista", "accesoListaValida",
    "accesoRefrescarLista", "repAccesoDiario", "accesoEscribirUrl",
    "openLaboratoriosModal", "openAgendamientoModal", "openLabSoloModal",
    "openPanelPacienteModal", "abrirRedactorTextoLibre", "mtrAbrirPanelRedaccion"],

  async pruebas(t, api, env, cargar) {
    t.caso("B1: el núcleo de acceso existe (accesoPerfil/accesoCap/accesoLeerLista/accesoListaValida)", () => {
      t.cierto(typeof api.accesoPerfil === "function", "falta accesoPerfil");
      t.cierto(typeof api.accesoCap === "function", "falta accesoCap");
      t.cierto(typeof api.accesoLeerLista === "function", "falta accesoLeerLista");
      t.cierto(typeof api.accesoListaValida === "function", "falta accesoListaValida");
    });

    t.caso("B1: uid en la lista COMPLETO → perfil COMPLETO, las 13 capacidades y ambos envoltorios", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 101, "Brandon Jesús Palencia Martínez");
      t.igual(c.api.accesoPerfil(), "COMPLETO");
      for (const cap of CAPS_LABS.concat(CAPS_SOLO_COMPLETO, CAPS_PUBLICAS)) {
        t.cierto(c.api.accesoCap(cap), "COMPLETO debe tener " + cap);
      }
      t.cierto(c.api.mtrEsMedicoAutorizado(), "envoltorio: COMPLETO autorizado");
      t.cierto(c.api.esMedicoRCVActivo(), "envoltorio: COMPLETO activo en RCV");
    });

    t.caso("B1: uid en LABORATORIOS → sus 7 capacidades + públicas; NADA de solo-COMPLETO (2B: pym SÍ)", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 201, "Maryuris Terán");
      t.igual(c.api.accesoPerfil(), "LABORATORIOS");
      for (const cap of CAPS_LABS) t.cierto(c.api.accesoCap(cap), "LABORATORIOS debe tener " + cap);
      for (const cap of CAPS_PUBLICAS) t.cierto(c.api.accesoCap(cap), "LABORATORIOS debe tener la pública " + cap + " (1C/2B)");
      for (const cap of CAPS_SOLO_COMPLETO) t.falso(c.api.accesoCap(cap), "LABORATORIOS NO debe tener " + cap);
      t.falso(c.api.mtrEsMedicoAutorizado(), "envoltorio: LABORATORIOS no es COMPLETO");
      t.falso(c.api.esMedicoRCVActivo(), "envoltorio: LABORATORIOS no es RCV");
    });

    t.caso("B1: uid vivo pero fuera del padrón → PÚBLICO: solo psic_odonto y pym", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 555, "Médico Nuevosur del Hospital");
      t.igual(c.api.accesoPerfil(), "PUBLICO");
      for (const cap of CAPS_PUBLICAS) t.cierto(c.api.accesoCap(cap), "PÚBLICO debe tener " + cap + " (1C)");
      for (const cap of CAPS_LABS.concat(CAPS_SOLO_COMPLETO)) t.falso(c.api.accesoCap(cap), "PÚBLICO NO debe tener " + cap);
      t.falso(c.api.mtrEsMedicoAutorizado(), "PÚBLICO no es autorizado");
      t.falso(c.api.esMedicoRCVActivo(), "PÚBLICO no es RCV");
    });

    t.caso("B1 (6A): blocklist por uid gana SIEMPRE — ni las capacidades públicas se montan", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 999, "Prueba Bloqueada Uno");
      t.igual(c.api.accesoPerfil(), "BLOQUEADO");
      for (const cap of CAPS_PUBLICAS) t.falso(c.api.accesoCap(cap), "BLOQUEADO NO debe tener ni la pública " + cap);
      for (const cap of CAPS_LABS.concat(CAPS_SOLO_COMPLETO)) t.falso(c.api.accesoCap(cap), "BLOQUEADO NO debe tener " + cap);
      t.falso(c.api.mtrEsMedicoAutorizado(), "BLOQUEADO jamás es autorizado");
    });

    t.caso("B1 (6A): blocklist por NOMBRE cuando no hay uid — identidad de nombre alcanza para bloquear", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 0, "Prueba Bloqueada Uno");
      t.igual(c.api.accesoPerfil(), "BLOQUEADO");
      t.falso(c.api.accesoCap("pym"), "bloqueado por nombre tampoco ve PyM");
    });

    t.caso("B1 (D1): sin uid, el NOMBRE normalizado respalda — minúsculas, tildes y espacios dobles no importan", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 0, "  brandon jesus   palencia martinez ");
      t.igual(c.api.accesoPerfil(), "COMPLETO");
      t.cierto(c.api.mtrEsMedicoAutorizado(), "el respaldo por nombre alimenta el envoltorio tal como hoy");
    });

    t.caso("B1 (D1): el uid MANDA sobre el nombre — uid de LABORATORIOS con nombre de COMPLETO", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 201, "Brandon Jesús Palencia Martínez");
      t.igual(c.api.accesoPerfil(), "LABORATORIOS");
      t.falso(c.api.accesoCap("rcv"), "el nombre no puede promover capacidades sobre el uid");
    });

    t.caso("B1: sin identidad y sin gracia → PÚBLICO con las públicas montadas (interpretación declarada 1C)", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 0, "");
      t.igual(c.api.accesoPerfil(), "PUBLICO");
      t.cierto(c.api.accesoCap("pym"), "sin identidad las públicas siguen montándose, como hoy");
      t.falso(c.api.accesoCap("laboratorios"), "las privadas cerradas");
    });

    t.caso("B1 (D2): gracia fresca (<12 h) sin identidad → último perfil confirmado", () => {
      const almacen = listaEnStorage({ vgl_acceso_ultimo_ok: JSON.stringify({ perfil: "LABORATORIOS", ts: Date.now() - 60 * 60 * 1000 }) });
      const c = cargarCon(cargar, almacen);
      conDoctor(c.api, 0, "");
      t.igual(c.api.accesoPerfil(), "LABORATORIOS");
      t.cierto(c.api.accesoCap("agendar_labs"), "la gracia restaura capacidades del perfil");
    });

    t.caso("B1 (D2): gracia VENCIDA (13 h) → PÚBLICO", () => {
      const almacen = listaEnStorage({ vgl_acceso_ultimo_ok: JSON.stringify({ perfil: "COMPLETO", ts: Date.now() - 13 * 60 * 60 * 1000 }) });
      const c = cargarCon(cargar, almacen);
      conDoctor(c.api, 0, "");
      t.igual(c.api.accesoPerfil(), "PUBLICO");
    });

    t.caso("B1 (D2): la gracia NO se aplica cuando SÍ hay identidad — uid desconocido con gracia COMPLETO fresca", () => {
      const almacen = listaEnStorage({ vgl_acceso_ultimo_ok: JSON.stringify({ perfil: "COMPLETO", ts: Date.now() - 60 * 60 * 1000 }) });
      const c = cargarCon(cargar, almacen);
      conDoctor(c.api, 555, "Médico Cualquiera");
      t.igual(c.api.accesoPerfil(), "PUBLICO", "el uid es definitivo: desconocido es PÚBLICO, no hereda la gracia del PC");
      t.falso(c.api.accesoCap("rcv"));
    });

    t.caso("B1 (D3): lista corrupta o con schema roto NO se aplica — se degrada a PÚBLICO sin reventar", () => {
      const c1 = cargarCon(cargar, { vgl_acceso_lista: "{esto no es json" });
      conDoctor(c1.api, 101, "");
      t.igual(c1.api.accesoPerfil(), "PUBLICO", "JSON roto → lista ignorada");

      const rota = JSON.parse(JSON.stringify(LISTA_OK));
      delete rota.perfiles.COMPLETO;
      const c2 = cargarCon(cargar, { vgl_acceso_lista: JSON.stringify(rota) });
      conDoctor(c2.api, 101, "");
      t.igual(c2.api.accesoPerfil(), "PUBLICO", "schema incompleto → lista ignorada");
      t.falso(c2.api.mtrEsMedicoAutorizado(), "nada se monta sobre una lista inválida");
    });

    t.caso("B1: accesoListaValida rechaza unidad por unidad los campos que D3 exige", () => {
      t.falso(api.accesoListaValida(null));
      t.falso(api.accesoListaValida("lista"));
      t.falso(api.accesoListaValida({ version: "", perfiles: LISTA_OK.perfiles, blocklist: [] }), "version vacía");
      t.falso(api.accesoListaValida({ version: "1", perfiles: { COMPLETO: [{ uid: 0, nombre: "X" }], LABORATORIOS: [] }, blocklist: [] }), "uid 0");
      t.falso(api.accesoListaValida({ version: "1", perfiles: { COMPLETO: [{ uid: 1, nombre: "" }], LABORATORIOS: [] }, blocklist: [] }), "nombre vacío");
      t.falso(api.accesoListaValida({ version: "1", perfiles: LISTA_OK.perfiles }), "sin blocklist");
      t.falso(api.accesoListaValida({ version: "1", perfiles: LISTA_OK.perfiles, blocklist: [{ uid: 1, nombre: "x" }, "basura"] }), "entrada corrupta en blocklist");
      t.cierto(api.accesoListaValida(LISTA_OK), "la lista buena pasa entera");
      t.cierto(api.accesoListaValida({ version: "1", perfiles: { COMPLETO: [], LABORATORIOS: [] }, blocklist: [] }), "lista VACÍA pero bien formada es válida: el dueño puede vaciar el padrón");
    });

    t.caso("B1: accesoLeerLista devuelve la lista vigente y null ante cualquier cosa inservible", () => {
      const c = cargarCon(cargar, listaEnStorage());
      const lista = c.api.accesoLeerLista();
      t.igual(lista && lista.version, "2026-09-04.1");
      const c2 = cargarCon(cargar, { vgl_acceso_lista: "no-json" });
      t.igual(c2.api.accesoLeerLista(), null);
      const c3 = cargarCon(cargar, {});
      t.igual(c3.api.accesoLeerLista(), null, "sin lista guardada → null, no excepción");
    });

    t.caso("B1 (D2): resolver con identidad ESCRIBE vgl_acceso_ultimo_ok; PÚBLICO no lo escribe", () => {
      const c = cargarCon(cargar, listaEnStorage());
      conDoctor(c.api, 201, "Maryuris Terán");
      c.api.accesoPerfil();
      const crudo = c.env.almacen["vgl_acceso_ultimo_ok"];
      t.cierto(!!crudo, "la resolución con identidad anota el último OK");
      const g = JSON.parse(crudo);
      t.igual(g.perfil, "LABORATORIOS");
      t.cierto(Math.abs(Date.now() - g.ts) < 5000, "ts es de ahora");

      const c2 = cargarCon(cargar, listaEnStorage());
      conDoctor(c2.api, 555, "Desconocido Total");
      c2.api.accesoPerfil();
      t.falso(!!c2.env.almacen["vgl_acceso_ultimo_ok"], "PÚBLICO no alimenta la gracia");
    });

    t.caso("B1: mtrNormalizarNombre se conserva estable (tildes, mayúsculas, espacios dobles)", () => {
      t.igual(api.mtrNormalizarNombre("  María  Edineth Pino "), "MARIA EDINETH PINO");
      t.igual(api.mtrNormalizarNombre(null), "");
    });

    // =====================================================================
    //  v18.1.0 — B2: LISTA REMOTA. El refresco NUNCA puede tumbar la caché
    //  vigente (misma regla D3 que B1): una respuesta inservible, rota o una
    //  red caída dejan todo como estaba, con el sello pesimista en false.
    // =====================================================================
    const REMOTA = {
      ok: true, version: "2026-09-04.9", emitida: "2026-09-04T12:00:00",
      perfiles: LISTA_OK.perfiles, blocklist: [],
    };
    const gmxhrOk = (r) => (o) => { o.onload({ status: 200, response: r }); };
    const versionCache = (c) => { try { return JSON.parse(c.env.almacen["vgl_acceso_lista"]).version; } catch (e) { return null; } };
    const selloOk = (c) => { try { return JSON.parse(c.env.almacen["vgl_acceso_fetch"]).ok; } catch (e) { return null; } };

    await t.casoAsync("B2: fetch útil actualiza la caché, sella ok y pregunta por listaAcceso", async () => {
      let url = "";
      const c = cargar({ silencioso: true, almacen: {}, gmxhr: (o) => { url = o.url; o.onload({ status: 200, response: REMOTA }); } });
      const r = await c.api.accesoRefrescarLista(true);
      t.cierto(!!r && r.version === "2026-09-04.9" && r.cambio === true, "sin caché previa: hay cambio");
      t.cierto(url.indexOf("?accion=listaAcceso&token=vgl-2026") > 0, "la URL lleva la acción y el token: " + url);
      t.igual(versionCache(c), "2026-09-04.9", "la caché quedó actualizada");
      t.cierto(selloOk(c) === true, "el sello pasa a ok");
    });

    await t.casoAsync("B2: respuesta inservible (ok:false) o con schema roto NO pisa la caché válida", async () => {
      const c1 = cargar({ silencioso: true, almacen: listaEnStorage(), gmxhr: gmxhrOk({ ok: false }) });
      t.igual(await c1.api.accesoRefrescarLista(true), null, "ok:false no sirve");
      t.igual(versionCache(c1), "2026-09-04.1", "la caché previa sigue en pie");

      const rota = { ok: true, version: "mala.1", perfiles: { COMPLETO: [{ uid: 0, nombre: "X" }], LABORATORIOS: [] }, blocklist: [] };
      const c2 = cargar({ silencioso: true, almacen: listaEnStorage(), gmxhr: gmxhrOk(rota) });
      t.igual(await c2.api.accesoRefrescarLista(true), null, "uid 0 en la respuesta: lista inválida, se ignora");
      t.igual(versionCache(c2), "2026-09-04.1");
      t.cierto(selloOk(c2) === false, "sello honesto: la respuesta no servía");
    });

    await t.casoAsync("B2: fallo de red deja el sello en false y NO toca la caché vigente", async () => {
      const c = cargar({ silencioso: true, almacen: listaEnStorage(), gmxhr: (o) => o.onerror(new Error("sin red")) });
      t.igual(await c.api.accesoRefrescarLista(true), null);
      t.igual(versionCache(c), "2026-09-04.1", "la caché sigue mandando");
      t.cierto(selloOk(c) === false, "sello pesimista");
    });

    await t.casoAsync("B2: misma versión → cambio:false y NO reescribe la caché local", async () => {
      const previa = {
        version: "2026-09-04.9",
        perfiles: { COMPLETO: LISTA_OK.perfiles.COMPLETO.concat([{ uid: 105, nombre: "Extra Que Debe Sobrevivir" }]), LABORATORIOS: LISTA_OK.perfiles.LABORATORIOS },
        blocklist: [],
      };
      const c = cargar({ silencioso: true, almacen: { vgl_acceso_lista: JSON.stringify(previa) }, gmxhr: gmxhrOk(REMOTA) });
      const r = await c.api.accesoRefrescarLista(true);
      t.cierto(!!r && r.version === "2026-09-04.9", "misma versión que la local");
      t.falso(r.cambio, "sin cambio declarado");
      conDoctor(c.api, 105, "Extra Que Debe Sobrevivir");
      t.igual(c.api.accesoPerfil(), "COMPLETO", "la caché local NO fue pisada: el extra sigue mandando");
    });

    await t.casoAsync("B2: sello fresco sin forzado NO toca la red; forzado pasa por encima", async () => {
      const fresco = listaEnStorage({ vgl_acceso_fetch: JSON.stringify({ ts: Date.now(), ok: true }) });
      let llamadas = 0;
      const c = cargar({ silencioso: true, almacen: fresco, gmxhr: (o) => { llamadas++; o.onload({ status: 200, response: REMOTA }); } });
      t.igual(await c.api.accesoRefrescarLista(false), null, "fresco y sin forzar: ni llama");
      t.igual(llamadas, 0);
      const r = await c.api.accesoRefrescarLista(true);
      t.igual(llamadas, 1, "forzado ignora el sello fresco");
      t.cierto(!!r && r.version === "2026-09-04.9" && r.cambio, "y actualiza a la remota");
    });

    const crearRed = () => {
      const red = { posts: [], status: 200, cuerpo: "ok", finalUrl: "" };
      red.gmxhr = (o) => { red.posts.push(o); o.onload({ status: red.status, responseText: red.cuerpo, finalUrl: red.finalUrl }); };
      return red;
    };

    await t.casoAsync("B2: repAccesoDiario reporta uid+nombre+perfil (dato de personal, sin PHI) con candado diario", async () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, almacen: listaEnStorage(), gmxhr: red.gmxhr });
      conDoctor(c.api, 201, "Maryuris Terán");
      c.api.repAccesoDiario();
      await new Promise((res) => setTimeout(res, 30));
      t.igual(red.posts.length, 1, "un solo POST");
      const cuerpo = JSON.parse(red.posts[0].data);
      t.igual(cuerpo.evento, "acceso");
      t.igual(cuerpo.uid, 201);
      t.igual(cuerpo.nombre, "Maryuris Terán");
      t.igual(cuerpo.perfil, "LABORATORIOS");
      t.igual(c.env.almacen["vgl_rep_acceso"], c.api.todayStamp(), "candado diario escrito");
      c.api.repAccesoDiario();
      await new Promise((res) => setTimeout(res, 30));
      t.igual(red.posts.length, 1, "el candado diario impide el segundo envío");
    });

    t.caso("B2: repAccesoDiario sin uid no reporta nada (ni gasta el candado)", () => {
      const red = crearRed();
      const c = cargar({ silencioso: true, almacen: listaEnStorage(), gmxhr: red.gmxhr });
      conDoctor(c.api, 0, "");
      c.api.repAccesoDiario();
      t.igual(red.posts.length, 0);
      t.falso(!!c.env.almacen["vgl_rep_acceso"], "el candado no se gastó");
    });

    // =====================================================================
    //  v18.1.0 — B3: CAPA b (compuerta de apertura). Cada punto de entrada
    //  de un módulo privado cierra EN SECO cuando el perfil no tiene la
    //  capacidad: ni modal montado, ni evento de embudo que cuente la
    //  apertura como ocurrida. El contexto se siembra TODO a favor del
    //  médico (bandera de redacción, clave IA, cosecha clínica y resumen
    //  ya en caché, red que solo falla): lo único capaz de frenar el flujo
    //  es la compuerta de acceso, no un dato faltante.
    //
    //  Puntos cubiertos (mapeo cap → open*):
    //    agendar_control → openAgendamientoModal      (vgl-agendar-modal)
    //    laboratorios    → openLaboratoriosModal      (vgl-labs-modal)
    //    agendar_labs    → openLabSoloModal libre     (vgl-agendar-modal, aria labsolo)
    //    panel_paciente  → openPanelPacienteModal     (vgl-panel-modal)
    //    redactor_ia     → abrirRedactorTextoLibre Y mtrAbrirPanelRedaccion (vgl-ia-modal)
    //  La doble puerta del redactor es deliberada (defense-in-depth): el
    //  dock entra por abrirRedactorTextoLibre, cualquier otro llamador
    //  termina en mtrAbrirPanelRedaccion.
    // =====================================================================
    const APT78 = { doc_id: "5150076", nombre: "PACIENTE PRUEBA" };
    const IDS_78 = ["vgl-agendar-modal", "vgl-labs-modal", "vgl-panel-modal", "vgl-ia-modal"];

    function RESUMEN_78() {
      return {
        programa: "HTA",
        factores: { edad: 61, sexo: "F", diabetes: true, hta: true },
        erc: { egfr: 52, estadioClinico: "G3a" },
        riesgo: { categoria: "alto" },
        meta: { metas: { ldl: 70 } },
        _docId: "5150076",
        _pacienteIdLabs: null,
        _ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } },
        _hoyIso: new Date().toISOString().slice(0, 10),
      };
    }

    // Copia LOCAL del parche DOM de suite_15 (norma de la casa: cada suite
    // repite el suyo) con la normalización de `:not()` de v18.0.24. Sin
    // esto los innerHTML de los modales no encuentran sus nodos y los
    // open* revientan por razones ajenas a la compuerta.
    function enriquecerDom78(c) {
      const doc = c.env.doc;
      const crearBase = doc.createElement;
      doc.createElement = function (tag) {
        const e = crearBase(tag);
        const memo = new Map();
        e.querySelector = (sel) => {
          const clave = String(sel).replace(/:not\([^)]*\)/g, "");
          if (!memo.has(clave)) memo.set(clave, doc.createElement("div"));
          return memo.get(clave);
        };
        e.querySelectorAll = () => [];
        return e;
      };
      doc.createDocumentFragment = () => {
        const f = doc.createElement("div");
        f._esFragmento = true;
        return f;
      };
    }

    const montado = (c, id) => Array.prototype.some.call(c.env.doc.body.children, (e) => e.id === id);
    const ningunModal = (t, c) => {
      for (const id of IDS_78) t.falso(montado(c, id), "no debe montarse " + id);
    };
    const uxClaves = (c) => {
      try {
        c.api._uxVolcarBuffer();
        const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
        return (w && w.acciones) ? Object.keys(w.acciones) : [];
      } catch (e) { return []; }
    };
    const sinEmbudo = (t, c, claves) => {
      const vistas = uxClaves(c);
      for (const k of claves) t.falso(vistas.indexOf(k) >= 0, "el embudo no debe contar '" + k + "' como apertura efectiva");
    };

    const ctxB3 = (uid, nombre) => {
      const c = cargar({ silencioso: true, almacen: listaEnStorage(), gmxhr: (o) => o.onerror(new Error("sin red")) });
      conDoctor(c.api, uid, nombre);
      enriquecerDom78(c);
      try { c.api.__S.iaRedaccion = true; } catch (e) {}
      try { c.api.mtrGuardarClaveGemini("CLAVE-DE-PRUEBA"); } catch (e) {}
      try { c.api._vglCosechaGuardar("5150076", { factores: { hta: { v: true, ts: 1 }, tabaquismo: { v: false, ts: 1 } } }); } catch (e) {}
      try { c.api.mtrCacheResumenGuardar("5150076", RESUMEN_78()); } catch (e) {}
      return c;
    };

    const ejercerPrivados = async (c) => {
      c.api.openAgendamientoModal(APT78);
      await c.api.openLaboratoriosModal(APT78);
      await c.api.openLabSoloModal(APT78, { libre: true });
      await c.api.openPanelPacienteModal(APT78);
      await c.api.abrirRedactorTextoLibre(APT78, { modo: "enfermedad_actual" });
      c.api.mtrAbrirPanelRedaccion(RESUMEN_78(), { modo: "enfermedad_actual" });
    };

    await t.casoAsync("B3 (capa b): BLOQUEADO no abre NINGUNO de los seis puntos — ni modal ni embudo", async () => {
      const c = ctxB3(999, "Prueba Bloqueada Uno");
      t.igual(c.api.accesoPerfil(), "BLOQUEADO", "precondición del contexto");
      await ejercerPrivados(c);
      ningunModal(t, c);
      sinEmbudo(t, c, ["fn.agendar.open", "fn.labs.open", "fn.panel.open", "fn.redactor.open", "fn.redactor.complete", "fn.ia.open"]);
    });

    await t.casoAsync("B3 (capa b): PÚBLICO (uid vivo fuera del padrón) tampoco abre nada privado", async () => {
      const c = ctxB3(555, "Médico Nuevosur del Hospital");
      t.igual(c.api.accesoPerfil(), "PUBLICO", "precondición del contexto");
      await ejercerPrivados(c);
      ningunModal(t, c);
      sinEmbudo(t, c, ["fn.agendar.open", "fn.labs.open", "fn.panel.open", "fn.redactor.open", "fn.redactor.complete", "fn.ia.open"]);
    });

    await t.casoAsync("B3 (capa b): LABORATORIOS abre lo suyo (laboratorios + agendar toma) y NADA más", async () => {
      const c = ctxB3(201, "Maryuris Terán");
      t.igual(c.api.accesoPerfil(), "LABORATORIOS", "precondición del contexto");
      // Lo que NO le corresponde: cerrado en seco.
      c.api.openAgendamientoModal(APT78);
      await c.api.openPanelPacienteModal(APT78);
      await c.api.abrirRedactorTextoLibre(APT78, { modo: "enfermedad_actual" });
      c.api.mtrAbrirPanelRedaccion(RESUMEN_78(), { modo: "enfermedad_actual" });
      t.falso(montado(c, "vgl-agendar-modal"), "agendar_control es de COMPLETO");
      t.falso(montado(c, "vgl-panel-modal"), "panel_paciente es de COMPLETO");
      t.falso(montado(c, "vgl-ia-modal"), "redactor_ia es de COMPLETO");
      sinEmbudo(t, c, ["fn.agendar.open", "fn.panel.open", "fn.redactor.open", "fn.redactor.complete", "fn.ia.open"]);
      // Lo suyo SÍ se abre, y el embudo lo sigue contando.
      await c.api.openLaboratoriosModal(APT78);
      t.cierto(montado(c, "vgl-labs-modal"), "laboratorios monta su modal de resultados");
      await c.api.openLabSoloModal(APT78, { libre: true });
      const solo = Array.prototype.find.call(c.env.doc.body.children, (e) => e.id === "vgl-agendar-modal");
      t.cierto(!!solo, "agendar_labs monta el modal de toma");
      t.igual(solo && solo.getAttribute("aria-labelledby"), "vgl-labsolo-title", "es el modal de toma de laboratorios, no el de control");
      const vistas = uxClaves(c);
      t.cierto(vistas.indexOf("fn.labs.open") >= 0, "el embudo propio sigue contando laboratorios");
    });

    await t.casoAsync("B3 (capa b): COMPLETO sigue abriendo todo — la compuerta no rompe al dueño del perfil", async () => {
      const c = ctxB3(101, "Brandon Jesús Palencia Martínez");
      t.igual(c.api.accesoPerfil(), "COMPLETO", "precondición del contexto");
      c.api.openAgendamientoModal(APT78);
      t.cierto(montado(c, "vgl-agendar-modal"), "agendar_control abierto");
      await c.api.openLaboratoriosModal(APT78);
      t.cierto(montado(c, "vgl-labs-modal"), "laboratorios abierto");
      await c.api.openPanelPacienteModal(APT78);
      t.cierto(montado(c, "vgl-panel-modal"), "panel_paciente abierto");
      await c.api.abrirRedactorTextoLibre(APT78, { modo: "enfermedad_actual" });
      t.cierto(montado(c, "vgl-ia-modal"), "redactor_ia abierto por la puerta del dock");
      const vistas = uxClaves(c);
      for (const k of ["fn.agendar.open", "fn.labs.open", "fn.panel.open", "fn.redactor.complete", "fn.ia.open"]) {
        t.cierto(vistas.indexOf(k) >= 0, "embudo presente: " + k);
      }
    });

    // =====================================================================
    //  v18.1.0 — B4: CAPA c (compuerta de escritura). La capa b decide qué
    //  se PUEDE ABRIR; esta decide qué se PUEDE ENVIAR. Los cuatro embudos
    //  de red del script (pageFetchJson, _fetchConTope, gmPostJsonEx y
    //  _gmReq) re-comprueban la capacidad JUSTO antes de que la petición
    //  salga, y apiRecordar no persiste la URL aprendida si el médico está
    //  BLOQUEADO. Las LECTURAS (URL fuera de la tabla de escrituras) pasan
    //  siempre: la compuerta es para escrituras, no para la telemetría ni
    //  las consultas de la página.
    //  Mapa familia → capacidad (única fuente de verdad: ACCESO):
    //    AsignarTurno / CancelarCita / EnviarSMS  → agendar_control
    //    AgendarCita AppCita / SMS laboratorio    → agendar_labs
    //    GuardarOrdenamiento / EnviarEmailOrden   → pym (pública)
    // =====================================================================
    const ORIGEN78 = "https://neps.everestintelligent.com";
    const U78 = {
      asignar: "/apiviva/APIAcceso/api/Acceso/AsignarTurno?TurnoId=1&PacienteId=2&UsuarioId=101",
      cancelar: "/apiviva/APIAcceso/api/Acceso/CancelarCita?CitaId=3",
      sms: ORIGEN78 + "/apiviva/APIAcceso/api/SMS/EnviarSMS?Telefono=3001234567&AgendaTurnoId=9",
      ordGuardar: "/apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento",
      ordCorreo: ORIGEN78 + "/apiviva/APIEnvioCorreo/api/EnvioCorreo/EnviarEmailOrdenamiento?Grupo=77",
      appAgendar: "https://appcita.viva1a.com.co:8051/apiLaboratorioV2/api/Agendamiento/AgendarCita?Sede=1",
      appSmsLab: "https://appcita.viva1a.com.co:8051/API/EnviarMensajeTextoLaboratorio?Telefono=300",
      lectura: "/apiviva/APIAcceso/api/Acceso/ObtenerConsultas?profesionalId=101",
    };
    const ctxC = (uid, nombre) => {
      const x = { red: { fetches: [], gmxhrs: [] } };
      const respOk = () => ({
        ok: true, status: 200, headers: { get: () => "application/json" },
        text: () => Promise.resolve('{"error":false,"data":{"radicado":777,"motivo":"Agendada Correctamente"}}'),
        json: () => Promise.resolve({ error: false, data: { radicado: 777 } }),
      });
      x.fetch = (url, init) => { x.red.fetches.push({ url: String(url), init: init || {} }); return Promise.resolve(respOk()); };
      x.gmxhr = (o) => { x.red.gmxhrs.push(o); o.onload({ status: 200, responseText: '{"error":false}' }); };
      x.c = cargar({ silencioso: true, almacen: listaEnStorage(), fetch: x.fetch, gmxhr: x.gmxhr });
      conDoctor(x.c.api, uid, nombre);
      return x;
    };
    const rechazaCon = async (p, patron) => {
      try { await p; return false; } catch (e) { return patron.test(String((e && e.message) || e)); }
    };

    await t.casoAsync("B4 (capa c): BLOQUEADO no despacha NINGUNA escritura por ningún embudo", async () => {
      const x = ctxC(999, "Prueba Bloqueada Uno");
      t.igual(x.c.api.accesoPerfil(), "BLOQUEADO", "precondición del contexto");
      t.igual(await x.c.api.pageFetchJson(U78.asignar, { method: "POST", body: "{}" }), null, "AsignarTurno: null y sin tocar la red");
      t.igual(await x.c.api.pageFetchJson(U78.ordGuardar, { method: "POST", body: "{}" }), null, "GuardarOrdenamiento (pym pública): BLOQUEADO gana igual");
      t.falso((await x.c.api._apiPostConDetalle(U78.cancelar, "{}")).ok, "CancelarCita: {ok:false} y sin tocar la red");
      t.cierto(await rechazaCon(x.c.api._fetchConTope(x.fetch, U78.sms, {}), /VGL_ACCESO|compuerta/), "EnviarSMS directo: rechazo de compuerta");
      const g = await x.c.api.gmPostJsonEx(U78.appAgendar, {});
      t.falso(g.ok, "AppCita AgendarCita: ok:false");
      t.igual(g.status, 0, "status 0 = la petición nunca salió");
      t.igual(g.data, null, "sin datos: la petición nunca salió");
      t.cierto(await rechazaCon(x.c.api._gmReq({ method: "GET", url: U78.appSmsLab }), /NetErr|compuerta/), "EnviarMensajeTextoLaboratorio: rechazo de compuerta");
      t.falso((await x.c.api.reenviarSmsRecordatorio("3001234567", "9")).ok, "reenviarSmsRecordatorio tampoco envía");
      t.igual(x.red.fetches.length, 0, "CERO llamadas de fetch");
      t.igual(x.red.gmxhrs.length, 0, "CERO llamadas de GM_xmlhttpRequest");
    });

    await t.casoAsync("B4 (capa c): PÚBLICO escribe lo público (pym) y NADA más", async () => {
      const x = ctxC(555, "Médico Nuevosur del Hospital");
      t.igual(x.c.api.accesoPerfil(), "PUBLICO", "precondición del contexto");
      const res = await x.c.api.pageFetchJson(U78.ordGuardar, { method: "POST", body: "{}" });
      t.cierto(!!res && res.error === false, "GuardarOrdenamiento SÍ sale: pym es pública");
      t.igual(x.red.fetches.length, 1, "exactamente la escritura permitida");
      t.igual(await x.c.api.pageFetchJson(U78.asignar, { method: "POST", body: "{}" }), null, "AsignarTurno: cerrado en seco");
      t.falso((await x.c.api._apiPostConDetalle(U78.cancelar, "{}")).ok, "CancelarCita: cerrado en seco");
      const g = await x.c.api.gmPostJsonEx(U78.appAgendar, {});
      t.falso(g.ok, "AppCita AgendarCita: cerrado en seco");
      t.cierto(await rechazaCon(x.c.api._fetchConTope(x.fetch, U78.sms, {}), /VGL_ACCESO|compuerta/), "EnviarSMS: cerrado en seco");
      t.igual(x.red.fetches.length, 1, "no salió ninguna escritura privada más");
      t.igual(x.red.gmxhrs.length, 0, "ni por GM_xmlhttpRequest");
    });

    await t.casoAsync("B4 (capa c): LABORATORIOS escribe agendar_labs y no las escrituras de control", async () => {
      const x = ctxC(201, "Maryuris Terán");
      t.igual(x.c.api.accesoPerfil(), "LABORATORIOS", "precondición del contexto");
      const g = await x.c.api.gmPostJsonEx(U78.appAgendar, {});
      t.cierto(g.ok, "AppCita AgendarCita SÍ sale");
      await x.c.api._gmReq({ method: "GET", url: U78.appSmsLab });
      t.igual(x.red.gmxhrs.length, 2, "AgendarCita + SMS de laboratorio salieron por GM");
      t.igual(await x.c.api.pageFetchJson(U78.asignar, { method: "POST", body: "{}" }), null, "AsignarTurno: es de COMPLETO");
      t.falso((await x.c.api._apiPostConDetalle(U78.cancelar, "{}")).ok, "CancelarCita: es de COMPLETO");
      t.cierto(await rechazaCon(x.c.api._fetchConTope(x.fetch, U78.sms, {}), /VGL_ACCESO|compuerta/), "EnviarSMS de control: cerrado");
      t.igual(x.red.fetches.length, 0, "CERO fetch: ni una escritura de control");
      const correo = await x.c.api.pageFetchJson(U78.ordCorreo, { method: "POST", body: "{}" });
      t.cierto(!!correo, "EnviarEmailOrdenamiento (pym pública) SÍ sale");
      t.igual(x.red.fetches.length, 1, "solo la escritura pública");
    });

    await t.casoAsync("B4 (capa c): COMPLETO escribe TODO — la compuerta no frena al dueño del perfil", async () => {
      const x = ctxC(101, "Brandon Jesús Palencia Martínez");
      t.igual(x.c.api.accesoPerfil(), "COMPLETO", "precondición del contexto");
      const res = await x.c.api.pageFetchJson(U78.asignar, { method: "POST", body: "{}" });
      t.cierto(!!res && res.error === false, "AsignarTurno sale");
      t.cierto((await x.c.api._apiPostConDetalle(U78.cancelar, "{}")).ok, "CancelarCita sale");
      const r = await x.c.api._fetchConTope(x.fetch, U78.sms, {});
      t.cierto(!!(r && r.ok), "EnviarSMS sale");
      const g = await x.c.api.gmPostJsonEx(U78.appAgendar, {});
      t.cierto(g.ok, "AppCita sale");
      t.igual(x.red.fetches.length, 3, "asignar + cancelar + sms");
      t.igual(x.red.gmxhrs.length, 1, "agendar labs por GM");
    });

    t.caso("B4 (capa c): apiRecordar solo aprende la URL del API para quien no está bloqueado", () => {
      const x = ctxC(999, "Prueba Bloqueada Uno");
      x.c.api.apiRecordar(U78.lectura);
      t.falso(!!x.c.env.storage.getItem("vgl_api_url"), "BLOQUEADO: no persiste vgl_api_url");
      const y = ctxC(555, "Médico Nuevosur del Hospital");
      y.c.api.apiRecordar(U78.lectura);
      t.cierto(!!y.c.env.storage.getItem("vgl_api_url"), "PÚBLICO: sí la persiste (pym es pública)");
    });

    await t.casoAsync("B4 (capa c): las LECTURAS (URL fuera de la tabla) pasan para todos, incluso BLOQUEADO", async () => {
      const x = ctxC(999, "Prueba Bloqueada Uno");
      const r = await x.c.api._fetchConTope(x.fetch, U78.lectura, { method: "GET" });
      t.cierto(!!(r && r.ok), "lectura de agenda sin compuerta");
      const res = await x.c.api.pageFetchJson(U78.lectura);
      t.cierto(!!res, "pageFetchJson de lectura sin compuerta");
      t.igual(x.red.fetches.length, 2, "las dos lecturas salieron");
    });

    t.caso("v18.1 (M2M f24): accesoEscribirUrl directo — las variantes de cancelación cierran y las URLs de impresión/impresión-orden no se catalogan como escritura", () => {
      const lab = ctxC(201, "Maryuris Terán");
      t.igual(lab.c.api.accesoPerfil(), "LABORATORIOS", "precondición del contexto");
      t.falso(lab.c.api.accesoEscribirUrl("/apiviva/APIAcceso/api/Acceso/AnularCita?CitaId=5"),
        "AnularCita es agendar_control: cerrada para LABORATORIOS");
      t.falso(lab.c.api.accesoEscribirUrl(ORIGEN78 + "/apiviva/APIAcceso/api/Acceso/CancelarTurno?TurnoId=6"),
        "CancelarTurno también: el regex cubre las tres grafías de cancelación");
      t.cierto(lab.c.api.accesoEscribirUrl(U78.ordCorreo),
        "EnviarEmailOrdenamiento (pym pública) abre para LABORATORIOS");

      const bloq = ctxC(999, "Prueba Bloqueada Uno");
      t.igual(bloq.c.api.accesoPerfil(), "BLOQUEADO", "precondición del contexto");
      t.cierto(bloq.c.api.accesoEscribirUrl("/apiviva/APIHCHealth/api/Morbilidad/GenerarLinksImpresionOrdenamientos?PacienteId=2&Agrupador=3"),
        "GenerarLinksImpresionOrdenamientos es LECTURA (links de impresión): pasa incluso BLOQUEADO");
      t.cierto(bloq.c.api.accesoEscribirUrl("/apiviva/APIImpresion/reportepdf/GenerarOrdenHC?Agrupador=3&idPaciente=2"),
        "GenerarOrdenHC (imprimir la orden) es navegación de lectura: pasa");
      t.cierto(bloq.c.api.accesoEscribirUrl("/apiviva/APIOrdenamientoHealth/api/Paciente/BuscarPaciente?Identificacion=1&TipoDocumento=CC&epsId=2"),
        "BuscarPaciente es lectura: la compuerta es control operativo de escrituras, no seguridad");
      t.falso(bloq.c.api.accesoEscribirUrl(U78.asignar),
        "y una escritura catalogada sigue cerrada para BLOQUEADO — no se abrió nada de paso");
    });
  },
};
