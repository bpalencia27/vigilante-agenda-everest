// Pega esto en la consola (F12) de la pestaña de Athenea, con la página de resultados
// de un paciente abierta (la misma vista de antes, con los botones "Ver Informe").
// No abre pestañas ni descarga nada visible: pide el MISMO informe que "Ver Informe"
// pero por detrás, para poder inspeccionar sus bytes. Es de solo lectura.
(async function () {
  try {
    const forms = [...document.querySelectorAll('form[action="/Resultados/Reporte"]')];
    if (!forms.length) { console.log("[VGL-PDF] No se encontró ningún formulario de informe en esta página. Abre la página de resultados de un paciente primero."); return; }
    const f = forms[0];
    const hash = f.querySelector('[name="hash"]')?.value || "";
    const modulo = f.querySelector('[name="modulo"]')?.value || "";
    const token = f.querySelector('[name="__RequestVerificationToken"]')?.value || "";
    if (!hash || !token) { console.log("[VGL-PDF] Faltan campos en el formulario (hash o token). hash=", !!hash, "token=", !!token); return; }
    console.log("[VGL-PDF] pidiendo el informe con hash=" + hash.slice(0, 12) + "... modulo=" + modulo);
    const body = new URLSearchParams({ hash, modulo, __RequestVerificationToken: token });
    const res = await fetch("/Resultados/Reporte", { method: "POST", body, credentials: "include" });
    const ct = res.headers.get("Content-Type") || "";
    const buf = await res.arrayBuffer();
    console.log("[VGL-PDF] status=" + res.status, "tipo=" + ct, "bytes=" + buf.byteLength);
    const head = new TextDecoder("latin1").decode(new Uint8Array(buf, 0, Math.min(8, buf.byteLength)));
    if (!head.startsWith("%PDF")) {
      console.log("[VGL-PDF] La respuesta NO empieza con %PDF — primeros bytes:", JSON.stringify(head), "— puede que haya devuelto una página de error/login en vez del PDF.");
      const comoTexto = new TextDecoder("utf-8").decode(buf).slice(0, 1000);
      console.log("[VGL-PDF] Como texto (primeros 1000):", comoTexto);
      return;
    }
    const raw = new TextDecoder("latin1").decode(buf); // 1 byte = 1 char, para inspeccionar la estructura del PDF sin corromper nada
    const comprimido = /\/Filter\s*\/FlateDecode/i.test(raw);
    const numStreams = (raw.match(/\bstream\r?\n/g) || []).length;
    console.log("[VGL-PDF] ¿Usa compresión FlateDecode?", comprimido, "· streams encontrados:", numStreams);

    // Intento de descompresión real de UN stream con las mismas herramientas que ya usa
    // el script para leer los .xlsx (DecompressionStream nativo del navegador).
    if (comprimido && typeof DecompressionStream !== "undefined") {
      const m = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(raw);
      if (m) {
        const streamText = m[1];
        const streamBytes = new Uint8Array(streamText.length);
        for (let i = 0; i < streamText.length; i++) streamBytes[i] = streamText.charCodeAt(i) & 0xff;
        try {
          const ds = new DecompressionStream("deflate");
          const writer = ds.writable.getWriter();
          writer.write(streamBytes); writer.close();
          const salida = await new Response(ds.readable).arrayBuffer();
          const textoDescomprimido = new TextDecoder("latin1").decode(salida).slice(0, 800);
          console.log("[VGL-PDF] ✅ Se pudo DESCOMPRIMIR un stream con las herramientas nativas del navegador. Primeros 800 caracteres del contenido descomprimido:", textoDescomprimido);
        } catch (e) {
          console.log("[VGL-PDF] No se pudo descomprimir el primer stream con deflate (puede ser zlib con cabecera, o no ser el stream de texto). Error:", String(e));
        }
      } else {
        console.log("[VGL-PDF] Comprimido pero no se pudo aislar un bloque stream/endstream limpio para probar.");
      }
    } else if (!comprimido) {
      // Sin compresión: el texto debería verse directo. Buscar fechas a ojo.
      const fechas = [...new Set((raw.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g) || []))];
      console.log("[VGL-PDF] Sin compresión — fechas visibles directamente en el PDF:", fechas);
    }
    window.__vglPdfRaw = raw; // por si hace falta inspeccionar más a mano
    console.log("[VGL-PDF] Volcado guardado en window.__vglPdfRaw por si quieres buscar algo más ahí.");
  } catch (e) {
    console.log("[VGL-PDF] Error:", String(e));
  }
})();
