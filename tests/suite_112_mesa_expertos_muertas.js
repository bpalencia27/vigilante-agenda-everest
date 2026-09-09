// =====================================================================
//  SUITE 112 — Mesa de Expertos (v18.12.0): código muerto confirmado
//              por doble refutación adversarial, retirado sin cambio
//              de comportamiento observable.
//
//  Cada hallazgo pasó por el enjambre de auditoría (arqueóloga del código
//  muerto) y, específicamente para "muerta", por DOS refutadores
//  independientes que buscaron cualquier invocación real (directa,
//  indirecta, por string, desde tests) antes de confirmarlo. Esta suite
//  ancla la limpieza contra regresiones — que el residuo no reaparezca —
//  sin inventar comportamiento nuevo que verificar.
// =====================================================================

"use strict";

const fs = require("fs");
const path = require("path");

const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

module.exports = {
  nombre: "Mesa de Expertos (v18.12.0): código muerto confirmado, retirado sin cambio de comportamiento",
  cubre: ["_renderToast", "_equipoId"],

  async pruebas(t, api, env, cargar) {

    // ---- #9 [aviso_universal] _renderToast: la variable `tint` nunca se leía ----
    t.caso("estructura: _renderToast ya no calcula `tint` (nunca se leía)", () => {
      const i = FUENTE.indexOf("function _renderToast(color, title, body, persist, apptKey) {");
      t.cierto(i >= 0, "la función existe");
      const cierre = FUENTE.indexOf("\n  function ", i + 40);
      const cuerpo = FUENTE.slice(i, cierre > i ? cierre : i + 4000);
      t.falso(cuerpo.indexOf("tint = TINT[color]") >= 0, "sin la variable muerta `tint`");
      t.cierto(cuerpo.indexOf("const col = COLORS[color] || COLORS.AZUL;") >= 0, "`col` (la que sí se usa) sigue calculándose");
    });

    // ---- #10 [telemetria] EQUIPO_ID_KEY: constante huérfana desde la migración a obs* ----
    t.caso("estructura: EQUIPO_ID_KEY ya no se declara (huérfana desde la migración al módulo obs)", () => {
      t.falso(FUENTE.indexOf("const EQUIPO_ID_KEY") >= 0, "sin la constante muerta");
      t.cierto(FUENTE.indexOf('const OBS_EQUIPO_LS = "vgl_equipo_id"') >= 0, "la fuente de verdad real (módulo obs) sigue intacta");
      t.cierto(FUENTE.indexOf("function _equipoId() {") >= 0, "_equipoId sigue delegando en el módulo obs");
    });

    // ---- #8 [ordenamientos] CSS .vgl-agm-c5/.vgl-agm-c7: huérfanas, sin markup que las use ----
    t.caso("estructura: .vgl-agm-c5 y .vgl-agm-c7 ya no se definen (ningún markup real las usaba)", () => {
      t.falso(FUENTE.indexOf(".vgl-agm-c5{grid-column:span 5}") >= 0, "sin .vgl-agm-c5");
      t.falso(FUENTE.indexOf(".vgl-agm-c7{grid-column:span 7}") >= 0, "sin .vgl-agm-c7");
      t.cierto(FUENTE.indexOf("#vgl-agendar-modal .vgl-agm-c6{grid-column:span 6}") >= 0, ".vgl-agm-c6 (la que sí se usa en el markup) sigue viva");
      t.cierto(FUENTE.indexOf("#vgl-agendar-modal .vgl-agm-c12{grid-column:span 12}") >= 0, ".vgl-agm-c12 (la que sí se usa en el markup) sigue viva");
    });
  },
};
