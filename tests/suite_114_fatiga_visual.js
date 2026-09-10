// =====================================================================
//  SUITE 114 — F6 (Solicitud F): fatiga visual — silenciar rutina, central
//  de notificaciones
//
//  El agrupamiento de toasts (por paciente, y el tope de 3 por flush que
//  colapsa a "Alerta Múltiple") y el tope de visualización simultánea
//  (máximo 4 toasts vivos en pantalla, ver _renderToast) YA EXISTÍAN antes
//  de F6 (v17.6.9/v17.11.0) — esta suite protege lo que F6 SÍ añadió:
//
//   1. avisoEsCritico/_avisoRutinarioSilenciado: con la preferencia
//      "avisos rutinarios silenciados" activa, SOLO lo no crítico
//      (AZUL/VERDE/FUCSIA) se calla. ROJO/MORADO/AMBAR (confirmación
//      extemporánea, inasistencia, última llamada) JAMÁS se silencian,
//      pase lo que pase con la preferencia — invariante de seguridad
//      clínica, no una opción.
//   2. La central de notificaciones: una bitácora mínima (color + hora,
//      NUNCA título ni cuerpo — cero PHI) de los avisos ya pintados, con
//      su vista en Ajustes.
// =====================================================================

"use strict";

const { instalarDomEnriquecido } = require("./harness.js");
const esperar114 = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  nombre: "F6 — fatiga visual: silenciar rutina y central de notificaciones",
  cubre: ["avisoEsCritico", "_avisoRutinarioSilenciado", "avisoHistorialHtml",
    "_avisoHistorialLeer", "_avisoHistorialLimpiar", "showToast", "notify", "renderSettings",
    "mtrHaceTiempo", "_dispararAvisoAudible"],

  async pruebas(t, api, env, cargar) {
    // ============================ PURAS ============================
    t.caso("avisoEsCritico: ROJO/MORADO/AMBAR son críticos; VERDE/AZUL/FUCSIA no; cualquier otro color (incl. vacío/undefined) cae FAIL-CLOSED del lado crítico", () => {
      const c = cargar({ silencioso: true });
      t.cierto(c.api.avisoEsCritico("ROJO"));
      t.cierto(c.api.avisoEsCritico("MORADO"));
      t.cierto(c.api.avisoEsCritico("AMBAR"));
      t.falso(c.api.avisoEsCritico("VERDE"));
      t.falso(c.api.avisoEsCritico("AZUL"));
      t.falso(c.api.avisoEsCritico("FUCSIA"));
      // (revisión post-entrega) — fail-closed a propósito: un color que esta función
      // no reconoce (vacío, undefined, o un 7º color futuro sin clasificar) NUNCA
      // se silencia, en vez de silenciarse por defecto.
      t.cierto(c.api.avisoEsCritico(""), "sin color: fail-closed, nunca silenciable");
      t.cierto(c.api.avisoEsCritico(undefined), "undefined: fail-closed, nunca silenciable");
      t.cierto(c.api.avisoEsCritico("COLOR_INVENTADO"), "un color futuro sin clasificar: fail-closed también");
    });

    t.caso("_avisoRutinarioSilenciado: con la preferencia APAGADA (fábrica), nada se silencia", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.avisosRutinariosOff = false;
      for (const col of ["ROJO", "MORADO", "AMBAR", "VERDE", "AZUL", "FUCSIA"]) {
        t.falso(c.api._avisoRutinarioSilenciado(col), col + " no se silencia con la preferencia apagada");
      }
    });

    t.caso("_avisoRutinarioSilenciado: con la preferencia ENCENDIDA, SOLO lo rutinario se calla — lo crítico NUNCA (invariante de seguridad)", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.avisosRutinariosOff = true;
      t.falso(c.api._avisoRutinarioSilenciado("ROJO"), "ROJO jamás se silencia, ni con la preferencia encendida");
      t.falso(c.api._avisoRutinarioSilenciado("MORADO"), "MORADO jamás se silencia");
      t.falso(c.api._avisoRutinarioSilenciado("AMBAR"), "AMBAR jamás se silencia");
      t.cierto(c.api._avisoRutinarioSilenciado("VERDE"), "VERDE sí se calla con la preferencia encendida");
      t.cierto(c.api._avisoRutinarioSilenciado("AZUL"), "AZUL sí se calla");
      t.cierto(c.api._avisoRutinarioSilenciado("FUCSIA"), "FUCSIA sí se calla");
    });

    t.caso("avisoHistorialHtml: vacío avisa honesto; con entradas pinta un chip por color, NUNCA título ni cuerpo (cero PHI)", () => {
      const c = cargar({ silencioso: true });
      const vacio = c.api.avisoHistorialHtml([]);
      t.cierto(vacio.indexOf("Sin avisos todavía") >= 0, "sin entradas, mensaje honesto");
      const ahora = 1_000_000_000;
      const historial = [
        { ts: ahora - 60_000, color: "AZUL" },   // 1 min: bajo el umbral de 2, "hace un momento" (mtrHaceTiempo)
        { ts: ahora - 5 * 60_000, color: "ROJO" },
      ];
      const html = c.api.avisoHistorialHtml(historial, ahora);
      t.cierto(html.indexOf("vgl-avh-chip") >= 0, "pinta chips");
      t.igual((html.match(/vgl-avh-chip/g) || []).length, 2, "un chip por entrada");
      t.cierto(html.indexOf("var(--c-azul)") >= 0 && html.indexOf("var(--c-rojo)") >= 0, "cada chip usa el color de su aviso");
      // (revisión post-entrega) — mtrHaceTiempo (compartida con repUltOk en Ajustes)
      // usa el mismo umbral de <2 min para "hace un momento" que ya usaba repUltOk.
      t.cierto(html.indexOf("hace un momento") >= 0 && html.indexOf("hace 5 min") >= 0, "hora relativa correcta (misma regla que repUltOk)");
      // La bitácora NUNCA guarda título ni cuerpo — no hay forma de que aparezcan aquí,
      // pero se deja constancia explícita del contrato de datos.
      t.falso(html.indexOf("Programa") >= 0 || html.indexOf("paciente") >= 0, "ningún dato de paciente en el HTML de la central");
    });

    // (revisión post-entrega) — mtrHaceTiempo es ahora la ÚNICA fuente de "hace N
    // min/h/días": esta prueba fija sus límites (antes solo verificados a través de
    // repUltOk, un IIFE local en renderSettings que no se podía probar por separado).
    t.caso("mtrHaceTiempo: los mismos límites que ya usaba repUltOk en Ajustes — ahora fuente única", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrHaceTiempo(0), "hace un momento");
      t.igual(c.api.mtrHaceTiempo(1), "hace un momento", "bajo el umbral de 2 min");
      t.igual(c.api.mtrHaceTiempo(2), "hace 2 min", "en el umbral, ya cuenta en minutos");
      t.igual(c.api.mtrHaceTiempo(59), "hace 59 min");
      t.igual(c.api.mtrHaceTiempo(60), "hace 1 h", "en el umbral de la hora");
      t.igual(c.api.mtrHaceTiempo(1439), "hace 24 h", "un minuto antes del día, redondea a 24 h");
      t.igual(c.api.mtrHaceTiempo(1440), "hace 1 días", "en el umbral del día");
      t.igual(c.api.mtrHaceTiempo(2880), "hace 2 días");
      t.igual(c.api.mtrHaceTiempo(-5), "hace un momento", "nunca negativo: un reloj desincronizado no dice \"hace -5 min\"");
    });

    // =====================================================================
    // (revisión post-entrega) — EL HALLAZGO REAL: _avisoRutinarioSilenciado() se
    // había añadido solo a showToast()/notify(), pero el camino REAL de los avisos
    // de cita (colorAndAlert→maybeNotify→_dispararAvisoReal→_dispararAvisoAudible)
    // llama a _notificarSistema() DIRECTO cuando la pestaña está desatendida — el
    // caso más común durante una consulta — sin pasar por ninguno de los dos gates.
    // La preferencia "avisos rutinarios silenciados" no callaba NADA en ese camino.
    // Esta prueba ejercita _dispararAvisoAudible tal cual lo hace la producción.
    // =====================================================================
    t.caso("_dispararAvisoAudible: con la preferencia encendida y la pestaña desatendida (el camino REAL de los avisos de cita), un VERDE rutinario no sale por el sistema operativo; un ROJO SÍ, siempre", () => {
      const c = cargar({ silencioso: true });
      let os = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.doc.hasFocus = () => false;   // pestaña desatendida: _pestanaSinAtencion() === true
      c.api.__S.avisosRutinariosOff = true;

      const res1 = c.api._dispararAvisoAudible({ uid: "f6-verde-1", color: "VERDE", title: "t", body: "b", flashText: "f", persist: false });
      t.cierto(res1, "sigue devolviendo true (silenciado, no fallido)");
      t.igual(os, 0, "el VERDE rutinario NO salió por Windows");
      t.igual(c.api._avisoHistorialLeer().length, 0, "y tampoco quedó anotado en la central");

      const res2 = c.api._dispararAvisoAudible({ uid: "f6-rojo-1", color: "ROJO", title: "t", body: "b", flashText: "f", persist: true });
      t.cierto(res2, "se disparó");
      t.igual(os, 1, "el ROJO crítico SÍ salió por Windows, con la preferencia encendida");
      const hist = c.api._avisoHistorialLeer();
      t.igual(hist.length, 1, "y quedó anotado en la central — el canal del SO también anota (antes no lo hacía)");
      t.igual(hist[0].color, "ROJO");
    });

    t.caso("_dispararAvisoAudible: con la preferencia apagada (fábrica), el VERDE rutinario sale por el sistema operativo igual que siempre (comportamiento previo intacto)", () => {
      const c = cargar({ silencioso: true });
      let os = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.doc.hasFocus = () => false;   // desatendida: la exención propia de VERDE (M13) NO aplica aquí
      c.api.__S.avisosRutinariosOff = false;
      c.api._dispararAvisoAudible({ uid: "f6-verde-2", color: "VERDE", title: "t", body: "b", flashText: "f", persist: false });
      t.igual(os, 1, "sin la preferencia F6, el VERDE desatendido sigue saliendo por Windows como antes de este cambio");
    });

    // ============================ INTEGRACIÓN ============================
    function panel114(c) {
      instalarDomEnriquecido(c.env.doc);
      c.api.buildOverlay();
      const raiz = c.env.doc.body.children.find((n) => n.id === "vgl-root");
      const wrap = c.env.doc.getElementById("vgl-toasts");
      // El arnés base no trae prepend() (mismo hueco que ya resuelve montarBandejaToasts
      // en suite_42): los avisos CRÍTICOS lo usan para ir siempre al frente de la bandeja.
      if (wrap && !wrap.prepend) wrap.prepend = (hijo) => wrap.insertBefore(hijo);
      return { raiz, wrap };
    }

    await t.casoAsync("showToast: con la preferencia encendida, un AZUL rutinario NO se pinta ni queda en la central; un ROJO SÍ, siempre", async () => {
      const c = cargar({ silencioso: true });
      const { wrap } = panel114(c);
      c.env.win.location.pathname = "/viva/HCHealth/anamesis";
      c.env.doc.visibilityState = "visible";
      c.api.__S.avisosRutinariosOff = true;

      c.api.showToast("AZUL", "Informativo de prueba", "cuerpo", false, "f6-azul");
      await esperar114(600);   // el flush de avisos corre a los 500 ms
      t.igual(wrap.children.length, 0, "el AZUL rutinario no se pintó");
      t.igual(c.api._avisoHistorialLeer().length, 0, "y no quedó en la central de notificaciones");

      c.api.showToast("ROJO", "Crítico de prueba", "cuerpo", false, "f6-rojo");
      await esperar114(600);
      t.igual(wrap.children.length, 1, "el ROJO crítico SÍ se pintó, con la preferencia encendida");
      const hist = c.api._avisoHistorialLeer();
      t.igual(hist.length, 1, "y quedó anotado en la central");
      t.igual(hist[0].color, "ROJO");
      t.falso("title" in hist[0] || "body" in hist[0], "la central jamás guarda título ni cuerpo");
    });

    await t.casoAsync("showToast: con la preferencia apagada (fábrica), el AZUL rutinario se pinta igual que siempre", async () => {
      // Nota de arnés: los toasts NO críticos se autocierran a los 9 s (ver
      // _renderToast) y el arnés capa TODO setTimeout a ~1 ms (tests/harness.js:116)
      // — así que un AZUL no crítico ya se autocerró para cuando esta prueba
      // pudiera comprobar el DOM. La central de notificaciones (que no se borra
      // sola) es la prueba correcta de "sí se pintó"; el caso crítico de arriba
      // ya prueba el DOM en vivo porque lo crítico JAMÁS se autocierra.
      const c = cargar({ silencioso: true });
      panel114(c);
      c.env.win.location.pathname = "/viva/HCHealth/anamesis";
      c.env.doc.visibilityState = "visible";
      c.api.__S.avisosRutinariosOff = false;
      c.api.showToast("AZUL", "Informativo de prueba", "cuerpo", false, "f6-azul-on");
      await esperar114(600);
      const hist = c.api._avisoHistorialLeer();
      t.igual(hist.length, 1, "sin la preferencia, el rutinario se pinta (y queda anotado) normal");
      t.igual(hist[0].color, "AZUL");
    });

    t.caso("renderSettings: el interruptor de rutina silenciada y la central de notificaciones se pintan en Ajustes", () => {
      const c = cargar({ silencioso: true });
      instalarDomEnriquecido(c.env.doc);
      c.api.buildOverlay();
      const raiz = c.env.doc.body.children.find((n) => n.id === "vgl-root");
      c.api.toggleSheet("ajustes");
      const hoja = raiz.querySelector("#vgl-sheet");
      t.cierto(hoja.innerHTML.indexOf('id="c-avisos-rutina-off"') >= 0, "el interruptor de rutina silenciada existe");
      t.cierto(hoja.innerHTML.indexOf('id="c-avisos-historial"') >= 0, "la central de notificaciones existe");
      t.cierto(hoja.innerHTML.indexOf("Sin avisos todavía") >= 0, "turno recién cargado: la central avisa que está vacía");
    });

    // ==================== REGRESIÓN DE FUENTE ====================
    t.caso("fuente: notify() también respeta el silencio de rutina (no solo showToast)", () => {
      const fs = require("fs");
      const path = require("path");
      const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const iNotify = FUENTE.indexOf("function notify(color, title, body, persist, uid) {");
      const iShow = FUENTE.indexOf("function showToast(color, title, body, persist, apptKey) {");
      t.cierto(iNotify >= 0 && iShow >= 0, "ambas funciones existen");
      t.cierto(FUENTE.slice(iNotify, iNotify + 400).indexOf("_avisoRutinarioSilenciado(color)") >= 0, "notify() consulta el silencio de rutina");
      t.cierto(FUENTE.slice(iShow, iShow + 400).indexOf("_avisoRutinarioSilenciado(color)") >= 0, "showToast() también");
    });
  },
};
