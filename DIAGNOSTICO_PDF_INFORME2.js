// v2 — corrige un descuido del diagnóstico anterior: NO asumas que el PDF está sin
// comprimir por no encontrar el texto "/Filter /FlateDecode" tal cual; muchos PDF lo
// declaran como "/Filter [/FlateDecode]" (con corchetes) y esa búsqueda no lo veía.
// Esta vez se intenta DESCOMPRIMIR cada uno de los streams encontrados, sin importar
// qué diga la declaración del filtro — y si algo tiene pinta de texto real (BT/Tj,
// marcadores de imagen escaneada, etc.) se reporta explícitamente.
//
// Pega esto en la consola (F12) de la pestaña de Athenea, con la página de resultados
// de un paciente abierta. No hace falta hacer clic en nada.
(async function () {
  try {
    const forms = [...document.querySelectorAll('form[action="/Resultados/Reporte"]')];
    if (!forms.length) { console.log("[VGL-PDF2] No se encontró el formulario del informe en esta página."); return; }
    const f = forms[0];
    const hash = f.querySelector('[name="hash"]')?.value || "";
    const modulo = f.querySelector('[name="modulo"]')?.value || "";
    const token = f.querySelector('[name="__RequestVerificationToken"]')?.value || "";
    const body = new URLSearchParams({ hash, modulo, __RequestVerificationToken: token });
    const res = await fetch("/Resultados/Reporte", { method: "POST", body, credentials: "include" });
    const buf = await res.arrayBuffer();
    console.log("[VGL-PDF2] status=" + res.status, "bytes=" + buf.byteLength);
    const raw = new TextDecoder("latin1").decode(buf);

    // Pistas estructurales, sin depender de compresión: si el PDF es una imagen
    // escaneada, casi siempre declara /Subtype /Image y NO tiene bloques BT (texto).
    console.log("[VGL-PDF2] ¿Contiene '/Subtype/Image' o '/Subtype /Image' (imagen incrustada)?",
      /\/Subtype\s*\/Image/i.test(raw));
    console.log("[VGL-PDF2] ¿Contiene bloques de texto 'BT' (Begin Text, contenido vectorial/texto real)?",
      /\bBT\b/.test(raw), "· ocurrencias de 'stream':", (raw.match(/\bstream\r?\n/g) || []).length);

    // Intentar descomprimir CADA stream encontrado, sin filtrar por si "parece" comprimido.
    const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let m, i = 0, exitos = 0;
    while ((m = re.exec(raw)) && i < 10) {
      i++;
      const txt = m[1];
      const bytes = new Uint8Array(txt.length);
      for (let k = 0; k < txt.length; k++) bytes[k] = txt.charCodeAt(k) & 0xff;
      // Probar zlib/deflate (estándar de FlateDecode) primero.
      let logrado = false;
      for (const formato of ["deflate", "deflate-raw"]) {
        if (logrado) break;
        try {
          const ds = new DecompressionStream(formato);
          const w = ds.writable.getWriter();
          w.write(bytes); w.close();
          const salida = new Uint8Array(await new Response(ds.readable).arrayBuffer());
          const texto = new TextDecoder("latin1").decode(salida);
          exitos++;
          logrado = true;
          const tieneTexto = /\bBT\b|\bTj\b|\bTJ\b/.test(texto);
          console.log(`[VGL-PDF2] stream #${i} (${bytes.length} bytes) → DESCOMPRIMIÓ con "${formato}" (${salida.length} bytes). ¿Tiene operadores de texto (BT/Tj/TJ)?`, tieneTexto);
          if (tieneTexto) {
            // Volcar el stream completo (suelen ser pocos KB) para poder leerlo con calma.
            window["__vglPdfStream" + i] = texto;
            console.log(`[VGL-PDF2] → guardado completo en window.__vglPdfStream${i}. Primeros 1500 caracteres:`, texto.slice(0, 1500));
          }
        } catch (e) { /* este formato no aplicó a este stream; se prueba el siguiente */ }
      }
      if (!logrado) console.log(`[VGL-PDF2] stream #${i} (${bytes.length} bytes) → no se pudo descomprimir con deflate/deflate-raw (puede ser una imagen JPEG/otro formato binario, o texto plano ya sin comprimir).`);
    }
    console.log(`[VGL-PDF2] Resumen: ${i} stream(s) revisados, ${exitos} descomprimidos con éxito.`);
  } catch (e) {
    console.log("[VGL-PDF2] Error:", String(e));
  }
})();
