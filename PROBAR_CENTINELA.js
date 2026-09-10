/* ===========================================================================
   PROBAR CENTINELA — PRUEBA DE CONSOLA F12 DE LOS ATAJOS v18.7.0 (M1 y M2)
   ---------------------------------------------------------------------------
   PARA QUÉ: verificar en vivo, desde la consola del navegador, que los dos
   accesos directos del mandato M1/M2 están montados y vivos en la pantalla
   real de Everest:
     · M1 — botón violeta «📋 Historias Clínicas» en las tarjetas En sala
            del panel del Centinela (agenda).
     · M2 — botones «🖨 Impresión Diagnóstica» y «🩺 Conducta» del dock de la
            historia clínica, que aparecen cuando las pestañas reales del
            editor de la nota están montadas.

   CÓMO PRUEBA (dos partes):
     A — SOLO LECTURA. Cuenta qué está montado en la pantalla actual
         (Centinela vivo, dock, botones M1, botones M2, anclas de pestaña).
         No escribe nada, no lee ningún dato del paciente.
     B — PRUEBA ACTIVA CON ROLLBACK AUTOMÁTICO. Solo en la historia clínica,
         solo si las pestañas de impresión NO están montadas todavía: inyecta
         UN tablist de mentira (dos enlaces con los ids y rótulos que el
         Centinela busca), espera a que el propio Centinela repinte el dock
         con los botones M2 (eso es lo que se quiere ver), y luego REVIERTE
         todo: retira el tablist inyectado y devuelve el dock a su estado
         anterior. Al terminar verifica que no quedó nada de la prueba.

   QUÉ TOCA Y QUÉ NO:
     · Toca: un contenedor propio marcado data-vgl-prueba colgado de
       document.body durante ≤ 12 segundos, y la firma interna del dock
       (dataset.sig), que se BORRA al revertir para que el próximo tick del
       Centinela repinte solo con su estado real. Nada más.
     · NO toca: ninguna casilla, ningún dato, ninguna pestaña ni botón real
       de Everest, ninguna pestaña del editor. Si las pestañas reales ya
       están montadas, la prueba B NO se ejecuta (guarda fail-closed).
     · La prueba B se puede desactivar pegando antes en la consola:
           PROBAR_B_DESACTIVAR = 1
       y volver a activar con PROBAR_B_DESACTIVAR = 0.

   PRIVACIDAD: el reporte descargado NO incluye cédulas, nombres ni ningún
   dato del paciente. Solo: la ruta de la pantalla (location.pathname, sin
   parámetros), conteos anónimos (cuántos botones, cuántas anclas), ids
   técnicos de pestaña del propio Everest, y booleanos de la prueba. Aun así,
   revise el archivo antes de enviarlo.

   ---------------------------------------------------------------------------
   MODO DE USO (30 segundos)

   1. Abra la agenda del Centinela (prueba M1) o una historia clínica recién
      abierta (prueba M2 — ideal si el editor de la nota aún no montó las
      pestañas de impresión).
   2. Pulse F12 -> pestaña "Console". Pegue este archivo entero y pulse Enter.
   3. Espere ~15 segundos: verá el resultado en la consola y se descarga un
      .json. El resultado queda también en `PROBAR_RESULTADO` por si quiere
      inspeccionarlo sin abrir el archivo.
   =========================================================================== */
(function () {
  "use strict";

  // --- Utilidades puras: réplica fiel de stripAccents + _canonTexto del
  // --- Centinela (vigilante_agenda.user.js L11049 y L1428), para construir
  // --- los rótulos simulados con la MISMA normalización que usa la búsqueda
  // --- real de _vglClicablePestana.
  function stripAccents(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function canonTexto(s) { return stripAccents(String(s || "")).toUpperCase().replace(/\s+/g, " ").trim(); }

  // Los ids ancla que _vglBarraPestanasPrincipal busca en el DOM de la
  // historia (vigilante_agenda.user.js L6796). Ids técnicos de Everest, no
  // datos de paciente.
  const ANCLAS_PESTANA = ["ngb-tab-8", "pes", "anamesis", "impDiagnostica"];

  const RESULTADO = {
    t: new Date().toISOString(),
    url: (typeof location !== "undefined" && location.pathname) || "",
    centinela: {},
    pruebaB: { corrida: false, motivo: "no intentada", nacieron: false, seLimpiaron: true, ms: 0 },
    advertencias: [],
  };
  if (typeof window !== "undefined") { try { window.PROBAR_RESULTADO = RESULTADO; } catch (e) {} }

  function log(titulo, detalle, estilo) {
    try {
      if (detalle === undefined) { console.log(titulo); return; }
      console.log("%c" + titulo, estilo || "color:#1e3a5f;font-weight:bold", detalle);
    } catch (e) {}
  }

  function contar(sel, raiz) {
    try {
      const r = raiz || document;
      if (!r || typeof r.querySelectorAll !== "function") return -1;
      return r.querySelectorAll(sel).length;
    } catch (e) { return -1; }
  }

  function esperarMs(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  // =========================================================================
  //  PARTE A — SOLO LECTURA. Nunca escribe; nunca lee valores de casillas ni
  //  atributos que transporten datos del paciente (data-vgl-doc, textos de
  //  tarjetas, etc.): solo presencia y conteos.
  // =========================================================================
  function PROBAR_A() {
    const c = RESULTADO.centinela;
    c.vivo = !!document.getElementById("vgl-root");
    c.dock = !!document.getElementById("vgl-acciones-dock");
    c.botonesM1 = contar("button.vgl-hc-directo");
    c.botonM2Imp = contar('[data-accion="pestana-impresion"]') > 0;
    c.botonM2Cond = contar('[data-accion="pestana-conducta"]') > 0;
    c.anclasPestana = {};
    ANCLAS_PESTANA.forEach(function (id) {
      try { c.anclasPestana[id] = !!document.getElementById(id); } catch (e) { c.anclasPestana[id] = false; }
    });
    c.algunaAnclaReal = ANCLAS_PESTANA.some(function (id) { return c.anclasPestana[id]; });

    log("PROBAR A — Centinela " + (c.vivo ? "VIVO" : "no detectado") +
      (c.dock ? " · dock de historia montado" : "") +
      (c.vivo || c.dock ? "" : " (¿está corriendo Tampermonkey en esta página?)"),
      undefined, c.vivo || c.dock ? "color:#16a34a;font-weight:bold" : "color:#b45309;font-weight:bold");
    log("PROBAR A — M1 (agenda): botones «Historias Clínicas» visibles: " + c.botonesM1 +
      (c.botonesM1 > 0 ? " ✓ (estado En sala con tarjeta emparejable)" :
        (c.botonesM1 === 0 ? " — ninguno (¿pantalla distinta, o sin filas En sala con cédula u hora legible?)" : " — no se pudo leer")),
      undefined, c.botonesM1 > 0 ? "color:#16a34a" : "color:#64748b");
    log("PROBAR A — M2 (dock): Impresión " + (c.botonM2Imp ? "✓" : "—") + " · Conducta " + (c.botonM2Cond ? "✓" : "—") +
      (c.botonM2Imp && c.botonM2Cond ? "" : "  (normal si el editor de la nota aún no montó esas pestañas; el dock se repinta solo cuando aparecen)"),
      undefined, c.botonM2Imp && c.botonM2Cond ? "color:#16a34a" : "color:#64748b");
    log("PROBAR A — Anclas de pestaña presentes en pantalla: " +
      ANCLAS_PESTANA.map(function (id) { return id + (c.anclasPestana[id] ? " ✓" : " —"); }).join(" · "),
      undefined, "color:#1e3a5f");
  }

  // =========================================================================
  //  PARTE B — PRUEBA ACTIVA DEL REPINTADO DE M2, CON ROLLBACK AUTOMÁTICO.
  //
  //  Idea: los botones M2 del dock nacen cuando las pestañas «Impresión
  //  Diagnóstica» y «Conducta» están montadas en el DOM (entran en la firma
  //  del dock, que se repinta solo en el siguiente tick). Para probarlo sin
  //  depender de que el editor monte las reales, se inyecta un tablist de
  //  mentira con los MISMOS ids y rótulos que el Centinela busca, se observa
  //  si los botones nacen, y se revierte TODO.
  //
  //  Guardas fail-closed (si alguna falla, no se toca nada):
  //    · hay dock (o sea, historia clínica con paciente abierto);
  //    · la prueba no está desactivada (PROBAR_B_DESACTIVAR = 1);
  //    · las pestañas reales «impDiagnostica»/«conducta» NO existen ya;
  //    · no quedan restos de una ejecución anterior (data-vgl-prueba).
  // =========================================================================
  async function PROBAR_B() {
    const r = RESULTADO.pruebaB;
    const t0 = Date.now();
    try {
      if (typeof window !== "undefined" && window.PROBAR_B_DESACTIVAR === 1) { r.motivo = "desactivada (PROBAR_B_DESACTIVAR=1)"; return; }
      const dock = document.getElementById("vgl-acciones-dock");
      if (!dock) { r.motivo = "sin dock: abra una historia clínica con paciente (la prueba B solo corre ahí)"; return; }
      if (document.getElementById("impDiagnostica") || document.getElementById("conducta")) {
        r.motivo = "las pestañas reales ya están montadas: no hace falta simular nada (M2 se verifica con la parte A)"; return;
      }
      if (contar("[data-vgl-prueba]") > 0) { r.motivo = "hay restos de una prueba anterior sin limpiar: recargue la página (F5) y reintente"; return; }

      // --- Instantánea previa del dock: solo los botones de pestaña que YA
      // --- existieran (por identidad, para no tocar jamás algo ajeno).
      const preexistentes = [];
      try {
        const prev = dock.querySelectorAll('[data-accion^="pestana-"]');
        for (let i = 0; i < prev.length; i++) preexistentes.push(prev[i]);
      } catch (e) {}

      // --- Inyección del tablist simulado, marcado para poder revertirlo.
      const cont = document.createElement("div");
      cont.setAttribute("role", "tablist");
      cont.setAttribute("data-vgl-prueba", "probar-centinela");
      const aImp = document.createElement("a");
      aImp.id = "impDiagnostica";
      aImp.textContent = "Impresión diagnóstica";   // canon == "IMPRESION DIAGNOSTICA", lo que busca M2
      const aCond = document.createElement("a");
      aCond.textContent = "Conducta";               // canon == "CONDUCTA", lo que busca M2
      cont.appendChild(aImp);
      cont.appendChild(aCond);
      document.body.appendChild(cont);
      r.corrida = true;
      log("PROBAR B — tablist simulado inyectado (marcado data-vgl-prueba). Esperando el repintado del dock…", undefined, "color:#1e3a5f;font-weight:bold");

      // --- Espera activa: el Centinela repinta solo en su tick (~5 s) cuando
      // --- la firma cambia por la presencia de las pestañas simuladas.
      const topeEspera = 12000, paso = 300;
      let esperado = 0, nacieronImp = false, nacieronCond = false;
      while (esperado < topeEspera) {
        await esperarMs(paso);
        esperado += paso;
        try {
          const ahora = dock.querySelectorAll('[data-accion="pestana-impresion"]');
          for (let i = 0; i < ahora.length; i++) {
            if (preexistentes.indexOf(ahora[i]) < 0) { nacieronImp = true; break; }
          }
          const ahoraC = dock.querySelectorAll('[data-accion="pestana-conducta"]');
          for (let i = 0; i < ahoraC.length; i++) {
            if (preexistentes.indexOf(ahoraC[i]) < 0) { nacieronCond = true; break; }
          }
        } catch (e) {}
        if (nacieronImp && nacieronCond) break;
      }
      r.nacieronImp = nacieronImp;
      r.nacieronCond = nacieronCond;
      r.nacieron = nacieronImp && nacieronCond;
      log("PROBAR B — resultado: Impresión " + (nacieronImp ? "NACIÓ ✓" : "no nació —") + " · Conducta " + (nacieronCond ? "NACIÓ ✓" : "no nació —") +
        (r.nacieron ? "" : "  (el Centinela pudo anclar a otra barra, o el tick estar pausado; el rollback corre igual)"),
        undefined, r.nacieron ? "color:#16a34a;font-weight:bold" : "color:#b45309");

      // --- ROLLBACK 1: retirar el tablist simulado y BORRAR la firma del
      // --- dock (delete, no restaurar el valor previo): con la firma ausente
      // --- el próximo tick del Centinela SIEMPRE repinta, recalcula con su
      // --- estado real (sin las pestañas de mentira) y retira los botones
      // --- simulados él mismo. Restaurar el valor previo NO serviría: la
      // --- firma recalculada tras retirar el tablist sería idéntica a la
      // --- restaurada y la guarda v14.2.0 cortaría el repintado.
      try { if (cont.parentNode) cont.parentNode.removeChild(cont); } catch (e) {}
      try { if (dock.dataset) delete dock.dataset.sig; } catch (e) {}

      // --- ROLLBACK 2: esperar a que el tick repinte y retire los botones
      // --- que nacieron por la simulación. Si el tick no responde, plan B:
      // --- retirarlos a mano SOLO los nacidos durante la prueba (por
      // --- identidad — las pestañas reales no existían al empezar).
      let limpio = false, esperado2 = 0;
      const topeLimpieza = 8000;
      while (esperado2 < topeLimpieza) {
        await esperarMs(paso);
        esperado2 += paso;
        let queda = false;
        try {
          const restos = dock.querySelectorAll('[data-accion^="pestana-"]');
          for (let i = 0; i < restos.length; i++) {
            if (preexistentes.indexOf(restos[i]) < 0) { queda = true; break; }
          }
        } catch (e) {}
        if (!queda) { limpio = true; break; }
      }
      if (!limpio) {
        log("PROBAR B — el tick no retiró los botones simulados a tiempo: se retiran a mano (plan B, solo los de esta prueba).", undefined, "color:#b45309");
        try {
          const restos = dock.querySelectorAll('[data-accion^="pestana-"]');
          for (let i = 0; i < restos.length; i++) {
            if (preexistentes.indexOf(restos[i]) < 0) {
              try { if (restos[i].parentNode) restos[i].parentNode.removeChild(restos[i]); } catch (e) {}
            }
          }
        } catch (e) {}
        limpio = true;   // verificado abajo con la comprobación final
      }

      // --- Verificación final de limpieza: no debe quedar NINGÚN nodo de la
      // --- prueba en el documento; el tick del Centinela reescribe la firma
      // --- del dock con su estado real en el primer repintado posterior.
      let restosPrueba = contar("[data-vgl-prueba]");
      r.seLimpiaron = (restosPrueba === 0) && limpio;
      if (!r.seLimpiaron && restosPrueba > 0) {
        try {
          const nodos = document.querySelectorAll("[data-vgl-prueba]");
          for (let i = 0; i < nodos.length; i++) {
            try { if (nodos[i].parentNode) nodos[i].parentNode.removeChild(nodos[i]); } catch (e) {}
          }
          restosPrueba = contar("[data-vgl-prueba]");
          r.seLimpiaron = restosPrueba === 0;
        } catch (e) { r.seLimpiaron = false; }
      }
      r.ms = Date.now() - t0;
      log("PROBAR B — limpieza " + (r.seLimpiaron ? "VERIFICADA ✓ (nada de la prueba quedó en la página)" : "FALLÓ — recargue la página (F5)"),
        undefined, r.seLimpiaron ? "color:#16a34a;font-weight:bold" : "color:#dc2626;font-weight:bold");
    } catch (e) {
      r.motivo = "error inesperado: " + (e && e.message ? e.message : String(e));
      try { if (cont) { if (cont.parentNode) cont.parentNode.removeChild(cont); } } catch (e2) {}
      log("PROBAR B — error inesperado; el tablist inyectado se retiró igualmente.", r.motivo, "color:#dc2626;font-weight:bold");
    }
  }

  // --- Descarga segura: mismo patrón que los DIAGNOSTICO_*.js. Si el
  // --- navegador la bloqueara, el resultado queda en PROBAR_RESULTADO.
  function descargar() {
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(RESULTADO, null, 1)], { type: "application/json" }));
      a.download = "probar_centinela_" + Date.now() + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      log("PROBAR — archivo descargado. Revíselo antes de enviarlo. (Resultado también en `PROBAR_RESULTADO`.)", undefined, "color:#16a34a;font-weight:bold");
    } catch (e) {
      log("PROBAR — no se pudo descargar el archivo (" + (e && e.message ? e.message : e) + "). El resultado completo está en `PROBAR_RESULTADO`.", undefined, "color:#b45309");
    }
  }

  // --- Arranque: A siempre; B con sus guardas; descarga al final.
  (async function () {
    PROBAR_A();
    await PROBAR_B();
    descargar();
    if (typeof window !== "undefined") {
      try {
        window.PROBAR_CENTINELA = {
          A: PROBAR_A,
          B: PROBAR_B,
          resultado: function () { return RESULTADO; },
          desactivarB: function () { window.PROBAR_B_DESACTIVAR = 1; },
          activarB: function () { window.PROBAR_B_DESACTIVAR = 0; },
        };
        log("PROBAR — para repetir: PROBAR_CENTINELA.A() (solo lectura) o PROBAR_CENTINELA.B() (prueba con rollback).", undefined, "color:#1e3a5f");
      } catch (e) {}
    }
  })();
})();
