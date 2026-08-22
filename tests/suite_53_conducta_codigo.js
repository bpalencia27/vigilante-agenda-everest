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

    t.caso("v15.7.0: la maquinaria de clic-en-Conducta está FUERA del código (funciones, catálogos y colas)", () => {
      const declaraciones = [
        /function\s+_msBuscarCodigoYAgregar/, /function\s+_conductaBuscarYAgregarExamen/,
        /function\s+_conductaBuscarPorCodigoYAgregar/, /function\s+_conductaLiMatch/,
        /function\s+_conductaInputBusqueda/, /function\s+_dxAgregarPorCodigo/,
        /function\s+_pendienteAutoCompletarEn/, /function\s+_pendienteAgregarEn/,
        /function\s+_conductaPendienteAgregar/, /function\s+_dxPendienteAgregar/,
        /function\s+mtrExamenesParaConducta/,
        /CONDUCTA_LI_TEXTO_POR_ANALITO\s*=/, /CIE10_DESC_PYM\s*=/, /CONDUCTA_CUPS_POR_ANALITO\s*=/,
        /_PENDIENTE_MAX_INTENTOS\s*=/,
      ];
      const vivas = declaraciones.filter((re) => re.test(src)).map(String);
      t.igual(vivas, [], "ninguna declaración de la maquinaria retirada puede volver al fuente");
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
