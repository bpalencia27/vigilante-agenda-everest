/* ===========================================================================
   DIAGNÓSTICO — POR QUÉ FALTA UN ANALITO EN EL HISTORIAL DE PARACLÍNICOS
   ---------------------------------------------------------------------------
   PARA QUÉ: usted reportó que a una paciente no le aparece la creatinina en el
   módulo de laboratorios, aunque se la tomaron en agosto. Hay tres formas
   distintas de que una fila desaparezca, y desde fuera se ven IGUAL:

     A) Athenea no devolvió una de las órdenes (se cae en silencio).
     B) La fila existe pero quedó absorbida dentro del bloque "Uroanálisis".
     C) La fila tiene más de 365 días y la tabla la esconde.

   Este diagnóstico dice CUÁL de las tres es. Sin eso, cualquier arreglo que yo
   escriba sería una conjetura — y este proyecto ya se llevó ese susto.

   ---------------------------------------------------------------------------
   PRIVACIDAD

   NO se guarda ningún resultado del paciente: ni cifras, ni nombre, ni cédula.
   De cada analito se anota solo el NOMBRE DEL EXAMEN (p. ej. "CREATININA EN
   SUERO"), el nombre del panel al que Athenea lo cuelga, la fecha, y un sí/no
   de si traía resultado. El valor se sustituye por "(hay valor)" o "(vacío)".

   Aun así, y como siempre: ABRA EL ARCHIVO ANTES DE ENVIARLO.

   NO MODIFICA NADA. Solo lee. Se descarga a su propio computador.

   ---------------------------------------------------------------------------
   MODO DE USO (un minuto)

   1. Abra la historia de LA PACIENTE del reporte (la de la creatinina).
   2. F12 -> "Console". Pegue este archivo entero y pulse Enter.
   3. Espere el aviso verde y el archivo .json que se descarga solo.
   =========================================================================== */
(function () {
  "use strict";

  const G = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
  const api = G.__vglDiag || G;   // el userscript no expone su interior: se usa la red directa

  function cedulaDeLaPantalla() {
    try {
      const nodos = document.querySelectorAll(".text-muted");
      for (const n of nodos) {
        const m = /(\d{5,15})/.exec(String(n.textContent || ""));
        if (m) return m[1];
      }
    } catch (e) {}
    return null;
  }

  const valorTapado = (v) => (v === null || v === undefined || String(v).trim() === "" ? "(vacío)" : "(hay valor)");

  async function correr() {
    const ced = cedulaDeLaPantalla();
    if (!ced) {
      console.log("%c[Diag Labs] No pude leer la cédula de la pantalla. Abra la historia del paciente y vuelva a pegarlo.",
        "background:#b45309;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold");
      return null;
    }

    // Se reutiliza el MISMO camino que usa el módulo, para que el diagnóstico no
    // conteste sobre un camino distinto del que falla.
    let solicitudes = null, labs = null, error = null;
    try {
      if (typeof G.getAtheneaSolicitudesAuto === "function") solicitudes = await G.getAtheneaSolicitudesAuto(ced);
      if (typeof G.getAtheneaLabsAuto === "function") labs = await G.getAtheneaLabsAuto(ced);
    } catch (e) { error = String(e && e.message || e); }

    const porSolicitud = (solicitudes && Array.isArray(solicitudes.solicitudes))
      ? solicitudes.solicitudes.map((s) => ({
          modulo: s.modulo, fecha: s.fechaIso || null, hora: s.horaTxt || null,
        }))
      : null;

    const filas = Array.isArray(labs) ? labs.map((l) => ({
      examen: l.NombreParametro || l.nombre || l.examen || "(sin nombre)",
      panel: l.NombreParametroPadre || l.nombreParametroPadre || "(sin panel)",
      fecha: l.__vglFechaSolicitud || l.FechaResultado || l.fecha || null,
      hora: l.__vglHoraSolicitud || null,
      resultado: valorTapado(l.Resultado != null ? l.Resultado : (l.resultado != null ? l.resultado : l.valor)),
      idEstado: l.idEstado != null ? l.idEstado : null,
    })) : null;

    const creatininas = (filas || []).filter((f) => /CREATIN/i.test(f.examen) || /CREATIN/i.test(f.panel));

    const salida = {
      t: new Date().toISOString(),
      nota: "Solo nombres de examen, paneles y fechas. Ningún resultado ni dato del paciente.",
      error: error,
      // (A) ¿faltaron órdenes?
      ordenesEnElPortal: porSolicitud ? porSolicitud.length : null,
      ordenesDeLaboratorio: porSolicitud ? porSolicitud.filter((s) => s.modulo === "LAB").length : null,
      ordenesQueNoRespondieron: (labs && labs.__vglIncompleto) || 0,
      seLeyoAlgo: Array.isArray(labs),
      // (B)/(C) ¿está la fila, y bajo qué panel?
      analitosRecibidos: filas ? filas.length : null,
      filasDeCreatinina: creatininas,
      // La lista entera, por si el nombre que Athenea usa no contiene "CREATIN".
      todosLosExamenes: filas,
      ordenes: porSolicitud,
    };

    try {
      const blob = new Blob([JSON.stringify(salida, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "diag_labs_faltantes_" + Date.now() + ".json";
      document.body.appendChild(a); a.click();
      setTimeout(() => { try { a.remove(); URL.revokeObjectURL(a.href); } catch (e) {} }, 1000);
    } catch (e) {
      console.log("%c[Diag Labs] No se pudo descargar. Copie lo de abajo:", "color:#b45309;font-weight:bold");
      console.log(JSON.stringify(salida, null, 2));
    }

    console.log("%c[Diag Labs] Listo. Órdenes que NO respondieron: " + salida.ordenesQueNoRespondieron +
      " · analitos recibidos: " + salida.analitosRecibidos +
      " · filas de creatinina encontradas: " + creatininas.length,
      "background:#16a34a;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
    if (creatininas.length) {
      console.log("%cLa creatinina SÍ llegó. Mire el campo 'panel' de cada una: si dice algo con ORINA/URINARIO, la tabla la está metiendo dentro del bloque Uroanálisis.", "color:#0891b2;font-weight:bold");
    } else if (salida.ordenesQueNoRespondieron > 0) {
      console.log("%cAthenea dejó órdenes sin responder: la creatinina probablemente iba en una de ellas.", "color:#b45309;font-weight:bold");
    }
    return salida;
  }

  G.__diagLabs = { correr: correr };
  correr();
})();
