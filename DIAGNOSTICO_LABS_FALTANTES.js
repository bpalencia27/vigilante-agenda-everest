/* ===========================================================================
   DIAGNÓSTICO v2 — POR QUÉ FALTA UN ANALITO EN EL HISTORIAL DE PARACLÍNICOS
   ---------------------------------------------------------------------------
   POR QUÉ HAY UNA v2: la primera versión intentaba llamar a las funciones del
   Vigilante desde la consola, y NO se puede — el script vive encerrado en su
   propio ámbito y no publica nada al navegador. Por eso su archivo salió con
   todo en blanco ("seLeyoAlgo: false"). Fue error mío, no suyo.

   Esta versión no llama a nada: LEE LA TABLA QUE USTED YA TIENE EN PANTALLA,
   incluidos los analitos escondidos dentro del bloque "Uroanálisis" (los del
   botón 🔍). Ahí es exactamente donde sospecho que se está quedando la
   creatinina.

   ---------------------------------------------------------------------------
   PRIVACIDAD

   NO se guarda ningún resultado. De cada fila se anota el NOMBRE DEL EXAMEN,
   la fecha y la fuente; el valor se sustituye por "(hay valor)" o "(vacío)".
   Ni nombre, ni cédula, ni cifras del paciente.

   Aun así: ABRA EL ARCHIVO ANTES DE ENVIARLO.

   NO MODIFICA NADA. Solo lee lo que ya está pintado.

   ---------------------------------------------------------------------------
   MODO DE USO

   1. Abra el MÓDULO DE LABORATORIOS de esa paciente y espere a que la tabla
      termine de cargar (que ya no diga "Consultando...").
   2. SIN cerrar el módulo: F12 -> "Console". Pegue este archivo y pulse Enter.
   3. Se descarga un .json solo y la consola le dice en verde qué encontró.
   =========================================================================== */
(function () {
  "use strict";

  const valorTapado = (v) => {
    const s = String(v == null ? "" : v).trim();
    return s === "" || s === "—" ? "(vacío)" : "(hay valor)";
  };

  const modal = document.getElementById("vgl-labs-modal");
  if (!modal) {
    console.log("%c[Diag Labs] No veo el módulo de laboratorios abierto. Ábralo, espere a que cargue la tabla y vuelva a pegar esto.",
      "background:#b45309;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
    return;
  }

  const tabla = modal.querySelector(".vgl-labs-table");
  if (!tabla) {
    console.log("%c[Diag Labs] El módulo está abierto pero la tabla todavía no se pintó. Espere a que deje de decir «Consultando…» y vuelva a pegarlo.",
      "background:#b45309;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");
    return;
  }

  // --- 1. Las filas visibles de la tabla ---
  const filas = [];
  const trs = tabla.querySelectorAll("tbody tr");
  for (const tr of trs) {
    const tds = tr.querySelectorAll("td");
    if (!tds.length) continue;
    const texto = (i) => String((tds[i] && tds[i].textContent) || "").replace(/\s+/g, " ").trim();
    filas.push({
      fecha: texto(0),
      examen: texto(1).slice(0, 80),
      resultado: valorTapado(texto(2)),
      referencia: texto(3).slice(0, 40),
      fuente: texto(4).slice(0, 40),
    });
  }

  // --- 2. Lo que está ESCONDIDO dentro de cada bloque "Uroanálisis" ---
  // Es la hipótesis principal: un analito que no es de orina absorbido ahí dentro
  // deja de tener fila propia y solo vive en este acordeón.
  const bloquesUro = [];
  for (const panel of modal.querySelectorAll(".vgl-labs-uro-panel")) {
    const items = [];
    for (const it of panel.querySelectorAll(".vgl-labs-uro-i")) {
      const b = it.querySelector("b");
      const nombre = String((b && b.textContent) || "").trim();
      const resto = String(it.textContent || "").slice(nombre.length).replace(/^\s*:\s*/, "");
      if (nombre) items.push({ analito: nombre.slice(0, 60), resultado: valorTapado(resto) });
    }
    bloquesUro.push({ cuantos: items.length, analitos: items });
  }

  // --- 3. El aviso de lectura incompleta, si el script lo pintó (v17.7.1) ---
  const cont = modal.querySelector("#vgl-labs-content");
  const primerHijo = cont && cont.firstElementChild;
  const avisoIncompleto = (primerHijo && primerHijo.tagName === "DIV")
    ? String(primerHijo.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300)
    : null;

  // --- 4. Dónde está (o no) la creatinina ---
  const esCreat = (s) => /CREATIN/i.test(String(s || ""));
  const creatEnFilas = filas.filter((f) => esCreat(f.examen));
  const creatEnUro = [];
  bloquesUro.forEach((b, i) => b.analitos.forEach((a) => { if (esCreat(a.analito)) creatEnUro.push({ bloque: i, analito: a.analito }); }));

  const salida = {
    t: new Date().toISOString(),
    version: "diag-labs-v2 (lee la tabla pintada, no llama al script)",
    nota: "Solo nombres de examen, fechas y fuentes. Ningún resultado ni dato del paciente.",
    avisoDeLecturaIncompleta: avisoIncompleto,
    filasVisibles: filas.length,
    bloquesUroanalisis: bloquesUro.length,
    analitosEscondidosEnUro: bloquesUro.reduce((n, b) => n + b.cuantos, 0),
    creatininaComoFilaPropia: creatEnFilas,
    creatininaEscondidaEnUroanalisis: creatEnUro,
    filas: filas,
    detalleUroanalisis: bloquesUro,
  };

  try {
    const blob = new Blob([JSON.stringify(salida, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "diag_labs_v2_" + Date.now() + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(() => { try { a.remove(); URL.revokeObjectURL(a.href); } catch (e) {} }, 1000);
  } catch (e) {
    console.log("%c[Diag Labs] No se pudo descargar. Copie lo de abajo:", "color:#b45309;font-weight:bold");
    console.log(JSON.stringify(salida, null, 2));
  }

  console.log("%c[Diag Labs v2] " + filas.length + " filas visibles · " +
    salida.analitosEscondidosEnUro + " analitos escondidos dentro de Uroanálisis · " +
    "creatinina con fila propia: " + creatEnFilas.length + " · escondida en Uroanálisis: " + creatEnUro.length,
    "background:#16a34a;color:#fff;padding:6px 10px;border-radius:4px;font-weight:bold;font-size:13px");

  if (creatEnUro.length) {
    console.log("%cAHÍ ESTÁ: la creatinina se la está tragando el bloque «Uroanálisis». Es un fallo del script y lo arreglo con esto.", "color:#0891b2;font-weight:bold;font-size:13px");
  } else if (creatEnFilas.length) {
    console.log("%cLa creatinina SÍ tiene su fila. Mire su fecha: quizá es más vieja de lo que recuerda, o la tabla la ordenó lejos.", "color:#0891b2;font-weight:bold");
  } else if (avisoIncompleto) {
    console.log("%cNo llegó, y el propio módulo avisa de que la lectura de Athenea quedó incompleta. Vuelva a abrirlo para reintentar.", "color:#b45309;font-weight:bold");
  } else {
    console.log("%cNo aparece por ningún lado y Athenea no reportó fallos. Mándeme el archivo: la respuesta está en la lista completa de exámenes.", "color:#b45309;font-weight:bold");
  }

  window.__diagLabs = salida;
})();
