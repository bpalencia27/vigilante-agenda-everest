const fs = require("fs");
const path = require("path");
// =====================================================================
//  SUITE 53 — Aviso de actualización + PERMANENCIA del retiro v15.7.0
//
//  Hasta v15.6 esta suite fijaba la maquinaria de "clic-en-Conducta"
//  (catálogos de <li>, buscador multiselect, colas de pendientes y su
//  drenado). En v15.7.0 el médico ordenó RETIRARLA POR COMPLETO: el
//  ordenamiento oficial es el módulo PyM (GuardarOrdenamiento) y el
//  script no escribe en la historia clínica. Lo que se fija ahora:
//   1. Que la maquinaria retirada NO reaparezca (pines de permanencia
//      sobre el fuente: ni funciones, ni catálogos, ni el botón).
//   2. Que el camino oficial (GuardarOrdenamiento) siga presente.
//   3. El comparador de versiones del aviso de actualización.
//   4. _deshacerOrdenesPyM sin las colas: revierte marcas y no lanza.
//
//  v17.35.0 — REVERSIÓN PUNTUAL, EXPLÍCITA Y DOCUMENTADA de UNA parte de
//  ese retiro: el botón "Ordenar pendientes" de Conducta (v17.32.0) creaba
//  una orden real por el módulo de Ordenamientos, pero esa orden no
//  aparecía en la tabla de Conducta como sí aparece con "Paquetes" — un
//  mecanismo distinto, confirmado con un diagnóstico en vivo. El médico,
//  viendo las dos alternativas restantes, pidió explícitamente lo
//  contrario de lo que decidió el 20-08: "quiero que simules exactamente
//  lo que hace ese botón de paquetes, tal cual... debes simular
//  exactamente lo que hace Everest". `_conductaBuscarYAgregarExamen` y
//  `CONDUCTA_LI_TEXTO_POR_ANALITO` (v14.0.3) SÍ volvieron — con el mismo
//  texto de <li> ya verificado entonces y RE-confirmado en vivo el
//  28-ago, 16 días después. Lo que causó el bug real de v15.3.0/v15.7.0
//  NO volvió: la cola que reintentaba en cada vuelta del reloj de sondeo
//  (`_PENDIENTE_MAX_INTENTOS`, `_pendienteAutoCompletarEn`,
//  `_pendienteAgregarEn`, `_conductaPendienteAgregar`,
//  `_dxPendienteAgregar`) sigue retirada — el gesto nuevo corre UNA sola
//  vez, por el clic explícito del médico, nunca desde el sondeo. Ver
//  la prueba "SOLO volvió el gesto..." más abajo, que fija exactamente
//  esa distinción.
// =====================================================================

module.exports = {
  nombre: "Aviso de actualización y permanencia del retiro (clic-en-Conducta)",
  cubre: [
    "mtrVersionEsMasNueva", "mtrCheckActualizacionGist",
    "_deshacerOrdenesPyM",
  ],

  async pruebas(t, api, env, cargar) {

    // ================= PERMANENCIA DEL RETIRO (v15.7.0) =================
    const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

    t.caso("v15.7.0: la maquinaria de COLA/REINTENTO del clic-en-Conducta sigue FUERA del código — la causa real del bug de entonces", () => {
      // v17.35.0 — esta lista YA NO incluye _conductaBuscarYAgregarExamen ni
      // CONDUCTA_LI_TEXTO_POR_ANALITO: esos dos volvieron a propósito (ver el encabezado
      // de esta suite). Lo que sigue prohibido es justo lo que causó el bug real: una
      // cola que reintentaba SOLA, en cada vuelta del reloj de sondeo, un clic que nunca
      // calzaba. El gesto nuevo de v17.35.0 corre UNA vez, por un clic explícito — nunca
      // desde una cola ni desde el sondeo — y esta prueba es la que lo fija.
      const declaraciones = [
        /function\s+_msBuscarCodigoYAgregar/,
        /function\s+_conductaBuscarPorCodigoYAgregar/, /function\s+_conductaLiMatch/,
        /function\s+_conductaInputBusqueda/, /function\s+_dxAgregarPorCodigo/,
        /function\s+_pendienteAutoCompletarEn/, /function\s+_pendienteAgregarEn/,
        /function\s+_conductaPendienteAgregar/, /function\s+_dxPendienteAgregar/,
        /function\s+mtrExamenesParaConducta/,
        /CIE10_DESC_PYM\s*=/, /CONDUCTA_CUPS_POR_ANALITO\s*=/,
        /_PENDIENTE_MAX_INTENTOS\s*=/,
      ];
      const vivas = declaraciones.filter((re) => re.test(src)).map(String);
      t.igual(vivas, [], "ninguna declaración de la maquinaria de cola/reintento puede volver al fuente");
    });

    // v17.35.0 — la reversión puntual, fijada por su nombre: SÍ debe existir, con el texto
    // de <li> real (no un catálogo distinto adivinado), y el gesto debe correr fuera de
    // cualquier cola — nunca enganchado al reloj de sondeo (tick/setInterval propio del
    // reloj de fondo, distinto del setTimeout interno del propio gesto).
    t.caso("v17.35.0: SOLO volvió el gesto <li>→Agregar, verificado y de un solo disparo — no la cola que causó el bug real", () => {
      t.cierto(/function\s+_conductaBuscarYAgregarExamen/.test(src), "el gesto restaurado sí existe");
      t.cierto(/CONDUCTA_LI_TEXTO_POR_ANALITO\s*=/.test(src), "con su catálogo de texto real de <li>");
      t.cierto(/function\s+mtrConductaAgregarPendientes/.test(src), "y su orquestador");
      t.falso(/function\s+_pendienteAutoCompletarEn/.test(src), "sin la cola que reintentaba sola");
      t.falso(/_PENDIENTE_MAX_INTENTOS/.test(src), "sin el contador de reintentos de esa cola");
      const c = cargar({ silencioso: true });
      t.cierto(typeof c.api._conductaBuscarYAgregarExamen === "function", "alcanzable en el API");
      t.cierto(typeof c.api.mtrConductaAgregarPendientes === "function", "alcanzable en el API");
    });

    t.caso("v15.7.0: el botón «Agregar a Conducta» del modal de Ordenamiento también se fue", () => {
      t.falso(src.includes('querySelector("#vgl-ord-conducta")'), "sin cableado del botón");
      t.falso(/id="vgl-ord-conducta"/.test(src), "sin el botón en la plantilla");
    });

    t.caso("v15.7.0: el camino OFICIAL de ordenar sigue completo (GuardarOrdenamiento del módulo PyM)", () => {
      t.cierto(src.includes("api/ordenamiento/GuardarOrdenamiento"), "el endpoint oficial está");
      t.cierto(src.includes("function apiOrdenamientoGuardar") || /apiOrdenamientoGuardar\s*=/.test(src), "y su función");
      const c = cargar({ silencioso: true });
      t.cierto(typeof c.api.apiOrdenamientoGuardar === "function", "alcanzable en el API");
    });

    // ================= COMPARADOR DE VERSIONES =================

    t.caso("compara versiones numéricamente por segmentos", () => {
      t.cierto(api.mtrVersionEsMasNueva("14.2.0", "14.1.9"), "14.2.0 > 14.1.9");
      t.cierto(api.mtrVersionEsMasNueva("14.10.0", "14.2.9"), "14.10 > 14.2 (alfabéticamente sería al revés)");
      t.cierto(api.mtrVersionEsMasNueva("15", "14.9.9"), "15 > 14.9.9 aunque tenga menos segmentos");
      t.falso(api.mtrVersionEsMasNueva("14.1.9", "14.1.9"), "igual no es más nueva");
      t.falso(api.mtrVersionEsMasNueva("14.1.8", "14.1.9"), "más vieja no es más nueva");
      t.falso(api.mtrVersionEsMasNueva("", "14.1.9"), "vacía no es más nueva y no lanza");
      t.falso(api.mtrVersionEsMasNueva("basura", "14.1.9"), "no numérica no es más nueva");
    });

    t.caso("el chequeo del Gist es best-effort: no lanza y se limita a una consulta por día", () => {
      t.noLanza(() => api.mtrCheckActualizacionGist(), "primera llamada del día");
      t.noLanza(() => api.mtrCheckActualizacionGist(), "segunda llamada: sale por el sello del día sin tocar la red");
      t.cierto(!!env.almacen["vgl_upd_gist_dia"], "dejó el sello del día para no repetir la consulta");
    });

    // ================= DESHACER ÓRDENES (sin colas) =================

    await t.casoAsync("_deshacerOrdenesPyM v15.7: revierte las marcas del paciente (puede volver a generar) sin colas de por medio", async () => {
      const c = cargar({ silencioso: true });
      c.api.markOrdenesCreadasHoy("111111111", ["Tamización VIH"]);
      t.cierto(c.api.isOrdenesCreadasHoy("111111111"), "la marca del día existe");
      const r = await c.api._deshacerOrdenesPyM({ doc_id: "111111111" });
      t.cierto(r, "la reversión se completa");
      t.falso(c.api.isOrdenesCreadasHoy("111111111"), "la marca quedó revertida: puede generar de nuevo");
      const r2 = await c.api._deshacerOrdenesPyM({});
      t.falso(r2, "sin documento no revierte nada y avisa (no lanza)");
    });
  },
};
