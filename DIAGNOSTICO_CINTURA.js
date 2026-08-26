/* ===========================================================================
   DIAGNÓSTICO — LA FILA ANTROPOMÉTRICA DEL EXAMEN FÍSICO
   (Circunferencia abdominal, Cintura pélvica y sus vecinos)
   ---------------------------------------------------------------------------
   PARA QUÉ: el motor RCV necesita la CIRCUNFERENCIA ABDOMINAL (la cintura) para
   calcular el síndrome metabólico, que es uno de los 10 factores de riesgo
   mayores del consenso y que hoy NUNCA cuenta porque nadie le pasa ese dato.

   POR QUÉ HACE FALTA ESTE DIAGNÓSTICO Y NO SE PUEDE ADIVINAR — dos razones, y la
   segunda es de seguridad del paciente:

   1. El mapa de campos de Everest que hay en el repositorio
      (grounding/mapas/MAPA_EVEREST_20260814_*.json) capturó SOLO 9 campos de esta
      pantalla, y "Circunferencia abdominal" NO está entre ellos. Faltan también
      Perímetro Cefálico, Perímetro Braquial y los dos pliegues cutáneos. O sea:
      hoy no sabemos su identificador interno.

   2. El script tiene una función `mtrLeerCinturaDelDom` que lee el campo
      `cinturaPelvica`. El médico confirmó (26-ago-2026) que **cintura pélvica es
      CADERAS**, y que la cintura de verdad es el campo rotulado "Circunferencia
      abdominal (cm)". Son dos casillas distintas de la misma pantalla. Como la
      cadera SIEMPRE mide más que la cintura, usar una por otra habría marcado
      obesidad central en casi todos los pacientes -> un factor de riesgo falso ->
      una meta de LDL más estricta -> más exámenes y más viajes. Esa función está
      muerta hoy (nadie la llama) y hay que corregirla antes de darle ningún uso.

   Regla de la casa que aplica aquí: casilla vacía antes que dato inventado. En
   v12.3.30 este proyecto ya supuso 4 nombres distintos para la fecha de un
   resultado de Athenea y NINGUNO existía en el objeto real.

   PRIVACIDAD: NO se guarda ningún valor. De cada casilla se anota solo su
   identificador, su rótulo y si está llena o vacía (un booleano) — nunca cuánto
   mide el paciente. Aun así, revise el archivo antes de enviarlo.

   NO MODIFICA NADA. Solo lee la pantalla. No guarda, no envía, no escribe.

   ---------------------------------------------------------------------------
   MODO DE USO (10 segundos)

   1. Abra la historia clínica de cualquier paciente y vaya a la pestaña
      "Revisión por sistema y Examen físico". No hace falta que tenga datos: la
      pantalla puede estar vacía.
   2. Pulse F12 -> pestaña "Console". Pegue este archivo entero y pulse Enter.
   3. Se descarga un .json de inmediato. Envíelo por el canal de siempre.
   =========================================================================== */
(function () {
  "use strict";

  // Los rótulos de la fila antropométrica, tal como se ven en pantalla. Se busca
  // por RÓTULO (no por id) precisamente porque el id es lo que no conocemos.
  const ROTULOS = /circunferencia\s+abdominal|cintura\s+p[ée]lvica|per[íi]metro\s+(cef[áa]lico|braquial|de\s+pantorrilla)|pliegue\s+cut[áa]neo|talla|peso|imc/i;

  // Rótulo de una casilla: <label for>, el label que la envuelve, el
  // aria-label, o el texto de la celda/columna anterior (Everest maqueta en dos
  // columnas: rótulo a la izquierda, casilla a la derecha).
  function etiquetaDe(el) {
    try {
      if (el.id) {
        const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l && l.textContent.trim()) return l.textContent.replace(/\s+/g, " ").trim();
      }
      const envuelve = el.closest("label");
      if (envuelve && envuelve.textContent.trim()) return envuelve.textContent.replace(/\s+/g, " ").trim();
      const aria = el.getAttribute("aria-label");
      if (aria && aria.trim()) return aria.replace(/\s+/g, " ").trim();
      // Vecino anterior con texto (la maqueta de dos columnas de Everest).
      let n = el.parentElement;
      for (let salto = 0; n && salto < 4; salto++, n = n.parentElement) {
        let prev = n.previousElementSibling;
        while (prev) {
          const t = (prev.innerText || prev.textContent || "").replace(/\s+/g, " ").trim();
          if (t && t.length < 80) return t;
          prev = prev.previousElementSibling;
        }
      }
    } catch (e) {}
    return "";
  }

  const todas = Array.prototype.slice.call(
    document.querySelectorAll('input, select, textarea')
  );

  const campos = todas.map(function (c) {
    const et = etiquetaDe(c);
    return {
      id: c.id || "",
      name: c.getAttribute("name") || "",
      tipo: (c.tagName || "").toLowerCase(),
      type: c.type || "",
      etiqueta: et,
      placeholder: c.placeholder || "",
      // NUNCA el valor: solo si hay algo escrito. Un perímetro es un dato
      // clínico del paciente y no hace falta para localizar el campo.
      tieneValor: !!(c.value && String(c.value).trim()),
      esDeLaFilaAntropometrica: ROTULOS.test(et + " " + (c.id || "") + " " + (c.getAttribute("name") || "")),
    };
  });

  const antropometricos = campos.filter(function (c) { return c.esDeLaFilaAntropometrica; });

  // Las dos que importan, resueltas explícitamente para que la respuesta se lea
  // de un vistazo sin abrir el JSON.
  function buscarPorRotulo(re) {
    const hit = campos.filter(function (c) { return re.test(c.etiqueta); });
    return hit.length ? hit.map(function (c) { return { id: c.id, name: c.name, etiqueta: c.etiqueta }; }) : null;
  }

  const resultado = {
    t: new Date().toISOString(),
    url: location.href,
    // LO QUE SE BUSCA:
    circunferenciaAbdominal: buscarPorRotulo(/circunferencia\s+abdominal/i),
    cinturaPelvica: buscarPorRotulo(/cintura\s+p[ée]lvica/i),
    // Contexto por si los rótulos no casan y hay que resolverlo por posición.
    totalCamposEnPantalla: campos.length,
    filaAntropometrica: antropometricos,
  };

  const est = "background:#1e3a5f;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold";
  console.log("%c[Diag Cintura] Campos antropométricos encontrados: " + antropometricos.length, est);
  if (resultado.circunferenciaAbdominal) {
    console.log("%c[Diag Cintura] CIRCUNFERENCIA ABDOMINAL (la cintura) ->", "color:#16a34a;font-weight:bold",
      resultado.circunferenciaAbdominal);
  } else {
    console.log("%c[Diag Cintura] NO se encontró 'Circunferencia abdominal' por su rótulo. " +
      "Revise que esté en la pestaña 'Revisión por sistema y Examen físico'; el JSON trae igualmente " +
      "toda la fila antropométrica para resolverlo por posición.", "color:#b45309;font-weight:bold");
  }
  if (resultado.cinturaPelvica) {
    console.log("%c[Diag Cintura] Cintura pélvica (CADERAS, no se usa para el síndrome metabólico) ->",
      "color:#64748b", resultado.cinturaPelvica);
  }
  console.table(antropometricos);

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(resultado, null, 1)], { type: "application/json" }));
  a.download = "diag_cintura_" + Date.now() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log("%c[Diag Cintura] Archivo descargado. Envíelo.", "color:#16a34a;font-weight:bold");
})();
