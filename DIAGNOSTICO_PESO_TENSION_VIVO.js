// DIAGNOSTICO_PESO_TENSION_VIVO.js
// ---------------------------------------------------------------------------
// Pégalo en la consola del navegador (F12 → pestaña "Console") MIENTRAS el
// Panel del paciente está abierto y las casillas de peso/tensión muestran
// "sin dato" pese a tener valor. Copia el resultado impreso — no expone
// cédula ni nombre, solo compara identidad de forma segura (longitud +
// últimos 2 dígitos).
// ---------------------------------------------------------------------------
(function () {
  function limpio(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function extractDoc(t) {
    if (!t) return "";
    const first = t.split(",")[0].replace(/[.\s]/g, "");
    let m = /^(\d{5,15})$/.exec(first);
    if (m) return m[1];
    m = /(\d{5,15})/.exec(t.replace(/[.\s]/g, ""));
    return m ? m[1] : "";
  }
  function redactado(doc) {
    if (!doc) return "(vacío)";
    return "***" + doc.slice(-2) + " (" + doc.length + " dígitos)";
  }
  function leerCampo(id) {
    const nodo = document.querySelector('input[name="' + id + '"]') || document.querySelector("#" + id);
    if (!nodo) return { existe: false };
    return { existe: true, valorCrudo: nodo.value, disabled: !!nodo.disabled, oculto: nodo.offsetParent === null };
  }

  const out = {};
  out["1_anamesis_presente"] = !!document.getElementById("anamesis");

  let candidatos = [];
  try {
    const contenedor = document.querySelector("app-index") || document;
    contenedor.querySelectorAll(".text-muted").forEach((el) => {
      if (el.closest("#vgl-root")) return;
      const doc = extractDoc(limpio(el.textContent));
      if (doc) candidatos.push(redactado(doc));
    });
  } catch (e) { out["2_error_leyendo_text_muted"] = String(e); }
  out["2_candidatos_de_identidad_encontrados"] = candidatos.length ? candidatos : "(NINGUNO — aquí está el problema si son 0)";

  out["3_peso"] = leerCampo("peso");
  out["4_talla"] = leerCampo("Talla");
  out["5_ta_sistolica"] = leerCampo("taSistolicaAcostado");
  out["6_ta_diastolica"] = leerCampo("taDiastolicaAcostado");

  console.log("=== DIAGNÓSTICO PESO/TENSIÓN (sin PHI) ===");
  console.log(JSON.stringify(out, null, 2));
  console.log("=== Copia TODO lo de arriba (entre las líneas ===) y pégalo en el chat ===");
})();
