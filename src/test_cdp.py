from playwright.sync_api import sync_playwright

JS_EXTRAER_AGENDA = r"""
(marcaBase) => {
  const limpio = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const horas = Array.from(document.querySelectorAll('.labelHora'));
  if (horas.length === 0) return { visible: false, fecha: '', citas: [] };

  const etiquetaFecha = document.querySelector('.fecha');

  const contenedorDe = (elHora) => {
    const candidatos = [];
    const directo = elHora.closest('.card-body') || elHora.closest('.card');
    if (directo) candidatos.push(directo);
    let n = elHora.parentElement, saltos = 0;
    while (n && n !== document.body && saltos < 8) {
      if (n.querySelector('.status-label')) { candidatos.push(n); break; }
      n = n.parentElement; saltos++;
    }
    for (const c of candidatos) {
      if (c.querySelectorAll('.labelHora').length === 1 && c.querySelector('.status-label')) {
        return c;
      }
    }
    return null;
  };

  const estados = Array.from(document.querySelectorAll('.status-label'));
  const emparejarPorIndice = estados.length === horas.length;

  const citas = horas.map((elHora, i) => {
    const cont = contenedorDe(elHora);
    const marca = marcaBase + '-' + i;
    let estado = '';
    let documento = '', nombre = '', modalidad = '', aislada = false;

    if (cont) {
      aislada = true;
      cont.setAttribute('data-vgl-id', marca);
      const elEstado = cont.querySelector('.status-label');
      estado = limpio(elEstado && elEstado.textContent);
      const elDoc = cont.querySelector('.text-muted');
      documento = limpio(elDoc && elDoc.textContent);
      const elNombre = cont.querySelector('.text-uppercase.fw-bold, .text-uppercase');
      nombre = limpio(elNombre && elNombre.textContent);
      const elModo = cont.querySelector('.fw-bold.mb-0');
      modalidad = limpio(elModo && elModo.textContent);
    } else if (emparejarPorIndice) {
      estado = limpio(estados[i] && estados[i].textContent);
    }

    return {
      hora_texto: limpio(elHora.textContent),
      documento_crudo: documento,
      nombre: nombre,
      modalidad: modalidad,
      estado_dom: estado,
      indice: i,
      marca_dom: aislada ? marca : '',
      aislada: aislada
    };
  });

  return {
    visible: true,
    fecha: limpio(etiquetaFecha && etiquetaFecha.textContent),
    citas: citas
  };
}
"""

def test_cdp():
    with sync_playwright() as p:
        try:
            print("Conectando a Chrome en puerto 9222...")
            browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            context = browser.contexts[0]
            print(f"Pestañas encontradas: {len(context.pages)}")
            for page in context.pages:
                print(f"Pestaña URL: {page.url}")
                if "everestintelligent.com" in page.url or "HCHealth" in page.url:
                    datos = page.evaluate(JS_EXTRAER_AGENDA, "vgl-test")
                    print("Citas extraídas del DOM de Chrome:", datos)
        except Exception as e:
            print("Error conectando por CDP:", e)

if __name__ == "__main__":
    test_cdp()
