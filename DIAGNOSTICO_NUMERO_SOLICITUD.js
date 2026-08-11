// Pega esto en la consola (F12) estando en la misma página de solicitudes que la
// captura (Bernarda). No hace falta clic ni recargar nada — solo mira lo que ya
// está en la página ahora mismo.
(function () {
  // Busca el elemento de texto más pequeño que contenga "Numero:" (o "Número:").
  const candidatos = [...document.querySelectorAll("body *")].filter(
    (el) => el.children.length === 0 && /n[uú]mero\s*:/i.test(el.textContent || "")
  );
  console.log("[VGL-NUM] elementos con 'Numero:' encontrados:", candidatos.length);
  candidatos.slice(0, 4).forEach((el, i) => {
    console.log(`[VGL-NUM] #${i} texto:`, JSON.stringify(el.textContent.trim()));
    // Sube hasta la tarjeta completa (el contenedor con la clase "card") para volcarla entera.
    let card = el.closest(".card") || el.closest(".card-body") || el.parentElement?.parentElement?.parentElement || el.parentElement;
    if (card) {
      console.log(`[VGL-NUM] #${i} tarjeta completa (outerHTML, primeros 3000 caracteres):`, card.outerHTML.slice(0, 3000));
    }
  });
  if (!candidatos.length) {
    console.log("[VGL-NUM] No se encontró ningún 'Numero:' como texto simple. Puede estar repartido en varios nodos (ej. <b>Numero</b>: <span>26051503125</span>). Volcando la sección completa de solicitudes en su lugar:");
    const sec = document.getElementById("solicitudes") || document.querySelector('[class*="tab-pane"]');
    if (sec) console.log("[VGL-NUM] sección solicitudes (primeros 4000 caracteres):", sec.outerHTML.slice(0, 4000));
  }
})();
