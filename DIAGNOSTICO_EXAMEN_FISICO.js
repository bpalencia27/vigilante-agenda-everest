/* ===========================================================================
   DIAGNÓSTICO — CAMPOS REALES DE "Revisión por sistema y Examen físico"
   ---------------------------------------------------------------------------
   PARA QUÉ: se pidió un botón de autocompletado para esta pestaña, igual al
   de Auto-Labs (Athenea), que pegue en cada casilla el mismo texto (p. ej.
   "NO VALORADO"). Pero la grabación de clics mostró casi siempre el mismo
   id, "alert_message", como objetivo — eso no puede ser cada casilla de
   sistema (Piel, Oído, Boca, Corazón...), es casi seguro un elemento interno
   de Everest que quedó por encima del campo real. Construir el botón sobre
   ese id sería adivinar. Este script identifica los campos VERDADEROS.

   NO MODIFICA NADA. Solo lee la pantalla. No guarda, no envía, no escribe.

   MODO DE USO (10 segundos)
   1. Estando YA en la pestaña "Revisión por sistema y Examen físico" de un
      paciente (no hace falta que tenga datos reales; puede estar vacía).
   2. F12 -> pestaña "Console". Pegue este archivo entero y Enter.
   3. Se descargará un archivo .json de inmediato. Envíelo por el canal de
      siempre.
   =========================================================================== */
(function () {
  "use strict";

  // Palabras que delatan las secciones de este examen, tal cual las mostró
  // la grabación: "Piel y faneras: Oído: Boca: Corazón: Garganta: Pulmon:
  // Pelvis: Sistema Respiratorio: Sistema..."
  const PISTAS = /piel|faneras|o[íi]do|boca|coraz[óo]n|garganta|pulm[óo]n|pelvis|sistema|abdomen|neurol|cardiovascular|respiratorio|s[íi]ntomas? general/i;

  function etiquetaDe(campo) {
    try {
      if (campo.id) {
        const l = document.querySelector('label[for="' + CSS.escape(campo.id) + '"]');
        if (l) return (l.textContent || "").trim().slice(0, 80);
      }
      const l2 = campo.closest("label");
      if (l2) return (l2.textContent || "").trim().slice(0, 80);
      // Busca una etiqueta hermana o ancestro cercano (patrón típico de forms Angular)
      let n = campo.closest(".form-group,.form-row,.row,div");
      if (n) {
        const cand = n.querySelector("label,.form-label,strong,b");
        if (cand && cand !== campo) return (cand.textContent || "").trim().slice(0, 80);
      }
    } catch (e) {}
    return "";
  }

  // Contenedor de la pestaña activa. Se intenta encontrar el panel visible
  // más específico; si no se puede, se cae a document (mejor de más que nada).
  function contenedorActivo() {
    const candidatos = document.querySelectorAll('[role="tabpanel"]:not([hidden]), .tab-pane.active, .tab-pane.show');
    for (const c of candidatos) {
      if (c.offsetParent !== null) return c;
    }
    return document;
  }

  const raiz = contenedorActivo();
  const campos = [];
  raiz.querySelectorAll("input, select, textarea").forEach((c) => {
    if (c.type === "hidden") return;
    // Solo interesan campos visibles: los ocultos por CSS no son los que el
    // médico llena a mano.
    if (c.offsetParent === null && c !== document.activeElement) return;
    campos.push({
      id: c.id || "",
      name: c.name || "",
      tag: c.tagName.toLowerCase(),
      type: c.type || "",
      etiqueta: etiquetaDe(c),
      placeholder: c.placeholder || "",
      // Solo el LARGO del valor actual, nunca el texto: puede haber datos
      // clínicos ya escritos y no hace falta el contenido para este mapa.
      largoValorActual: (c.value || "").length,
      claseCoincideConSistema: PISTAS.test((c.id || "") + " " + (c.name || "") + " " + etiquetaDe(c)),
    });
  });

  // También se anota, aparte, cuántas veces aparece el id "alert_message" en
  // TODO el documento — para confirmar o descartar la sospecha de que es un
  // elemento compartido, no uno por casilla.
  const alertMessageCount = document.querySelectorAll("#alert_message, [id='alert_message']").length;

  const resultado = {
    t: new Date().toISOString(),
    url: location.href,
    totalCamposEncontrados: campos.length,
    alertMessageApareceNVeces: alertMessageCount,
    campos: campos,
  };

  console.log("%c[Diag Examen Físico] " + campos.length + " campos encontrados. #alert_message aparece " + alertMessageCount + " veces.",
    "background:#1e3a5f;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold");
  console.table(campos);

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(resultado, null, 1)], { type: "application/json" }));
  a.download = "diag_examen_fisico_" + Date.now() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log("%c[Diag Examen Físico] Archivo descargado. Envíelo.", "color:#16a34a;font-weight:bold");
})();
