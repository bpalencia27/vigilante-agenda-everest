// DIAGNOSTICO_TENSION_CASILLAS.js  —  v18.0.54
// ---------------------------------------------------------------------------
// PARA QUÉ: el 1-sep el médico reportó una nota que decía «PRESIÓN ARTERIAL DE
// 110/70 MMHG» mientras su pantalla tenía **136/85** en «T.A:». Peso y cintura
// sí coincidían. La causa está en QUÉ CASILLA se lee: el lector pedía primero
// «T.A Acostado» (opcional, vacía) y su respaldo nunca leía la diastólica.
//
// Los ids de esta fila de Everest YA NOS ENGAÑARON UNA VEZ: cuatro campos de la
// fila antropométrica comparten dos ids entre sí y la circunferencia abdominal
// solo es alcanzable por su rótulo (ver DIAGNOSTICO_CINTURA.js). Así que los
// nombres nuevos NO se adivinan: se fijan con este diagnóstico, igual que
// entonces.
//
// CÓMO SE USA: abra la historia de un paciente CON la tensión ya escrita en
// «T.A:», pulse F12 → pestaña "Console", pegue todo esto y pulse Enter. Copie
// el resultado y páselo.
//
// CERO PHI: no lee nombres, ni cédulas, ni resultados de laboratorio. Solo mira
// las casillas de la fila de signos vitales: su rótulo, su id/name y si tienen
// algo escrito. Los VALORES de tensión, peso y talla no identifican a nadie por
// sí solos, y son justo lo que hay que comparar; aun así, cualquier cadena que
// parezca un documento (5+ dígitos seguidos) se tacha antes de imprimir.
// ---------------------------------------------------------------------------
(function () {
  const limpio = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  // Red de seguridad: nada con pinta de documento sale impreso.
  const seguro = (s) => limpio(s).replace(/\d{5,}/g, "[…]");

  function rotuloDe(el) {
    try {
      if (el.id) {
        const l = document.querySelector('label[for="' + String(el.id).replace(/"/g, '\\"') + '"]');
        if (l && limpio(l.textContent)) return limpio(l.textContent);
      }
    } catch (e) {}
    // Sin label[for]: se busca el texto más cercano a la izquierda/arriba, que es
    // como Everest maqueta esta fila.
    try {
      let n = el.parentElement, saltos = 0;
      while (n && saltos < 4) {
        const t = limpio(n.textContent || "");
        if (t && t.length < 60) return t;
        n = n.parentElement; saltos++;
      }
    } catch (e) {}
    return "(sin rótulo)";
  }

  const filas = [];
  try {
    document.querySelectorAll("input").forEach((el) => {
      if (el.closest && el.closest("#vgl-root")) return;          // nunca el propio panel
      const rot = rotuloDe(el);
      // Solo la fila de signos vitales y antropometría: lo demás no hace falta.
      if (!/T\.?A|tensi|presi|sist|diast|peso|talla|imc|circunferencia|cardiac|respirat|satur|temper/i.test(rot + " " + (el.id || "") + " " + (el.name || ""))) return;
      filas.push({
        rotulo: seguro(rot),
        id: el.id || "(sin id)",
        name: el.name || "(sin name)",
        tieneValor: !!limpio(el.value),
        valor: seguro(el.value),
        deshabilitado: !!el.disabled,
        visible: el.offsetParent !== null,
      });
    });
  } catch (e) {
    console.error("[DIAGNOSTICO_TENSION] error recorriendo el DOM:", e && e.message);
  }

  console.log("=== DIAGNÓSTICO DE CASILLAS DE TENSIÓN Y SIGNOS VITALES ===");
  console.log("Casillas encontradas: " + filas.length);
  console.table(filas);

  // Y lo que el script LEE hoy con los nombres que tiene cableados, para ver de
  // frente cuál acierta y cuál no.
  const prueba = ["sistolica", "diastolica", "taSistolica", "taDiastolica",
                  "presionSistolica", "presionDiastolica", "ta1", "ta2",
                  "taSistolicaAcostado", "taDiastolicaAcostado",
                  "presionSistolicaAcostado", "presionDiastolicaAcostado"];
  const intento = {};
  for (const n of prueba) {
    let nodo = null;
    try {
      nodo = document.querySelector('input[name="' + n + '"]') || document.querySelector("#" + n.replace(/[^\w-]/g, ""));
    } catch (e) {}
    intento[n] = nodo ? (limpio(nodo.value) ? seguro(nodo.value) : "(vacía)") : "(no existe)";
  }
  console.log("=== QUÉ ENCUENTRA EL SCRIPT CON CADA NOMBRE QUE TIENE CABLEADO ===");
  console.table(intento);
  console.log("Copie las DOS tablas y páselas. Con eso se fijan los nombres reales con evidencia, no adivinando.");
})();
