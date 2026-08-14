module.exports = {
  nombre: "Panel, ajustes, modales",
  cubre: ["renderStats", "fraudesHoy", "tieneAbandonoPES", "matchesSearch", "matchesFilter", "highlight", "countdown", "escapeHtml"],
  pruebas(t, api, env, cargar) {
    t.caso("tieneAbandonoPES chequea la cache de pymAbandono", () => {
      const c = cargar();
      c.api.__state.pymAbandono = new Set(["123"]);
      t.cierto(c.api.tieneAbandonoPES({ doc_id: "123" }));
      t.falso(c.api.tieneAbandonoPES({ doc_id: "456" }));
    });

    t.caso("matchesSearch filtra por documento o fuzzyName", () => {
      const c = cargar();
      const cita = { doc_id: "123456", nombre: "JUAN PEREZ" };
      t.cierto((c.api.__state.busqueda = "123456", c.api.matchesSearch(cita)));
      t.cierto((c.api.__state.busqueda = "juan pe", c.api.matchesSearch(cita)));
      t.falso((c.api.__state.busqueda = "maria", c.api.matchesSearch(cita)));
    });

    t.caso("matchesFilter filtra por estado", () => {
      const c = cargar();
      const cita1 = { color: "ROJO", estado: "En sala", pym: [] };
      const cita2 = { color: "VERDE", estado: "En sala", pym: ["a"] };

      t.cierto((c.api.__state.filtro = "todas", c.api.matchesFilter(cita1)));
      t.cierto((c.api.__state.filtro = "riesgo", c.api.matchesFilter(cita1)));
      t.falso((c.api.__state.filtro = "riesgo", c.api.matchesFilter(cita2)));
      t.cierto((c.api.__state.filtro = "pym", c.api.matchesFilter(cita2)));
      t.falso((c.api.__state.filtro = "pym", c.api.matchesFilter(cita1)));
    });

    t.caso("highlight envuelve la busqueda en marcas HTML", () => {
      const c = cargar();
      t.igual((c.api.__state.busqueda = "juan", c.api.highlight("JUAN PEREZ")), '<mark>JUAN</mark> PEREZ');
    });

    t.caso("countdown calcula tiempo faltante", () => {
      const c = cargar();
      const diff = 10 * 60000;
      t.igual(c.api.countdown({ hora_texto: "1", elapsed: -10, estado: "Sin presentarse" }), "<span class=\"vgl-cd\" title=\"Le quedan 16:00 para confirmar\">en 16:00</span>");
    });

    // =====================================================================
    // v12.6.6 — Reportado en consultorio con captura: el aviso "Laboratorios RCV sin
    // resultado vigente" salía como TEXTO SUELTO encima de la historia clínica —sin
    // tarjeta, sin fondo, en el azul de Everest— pese a tener su hoja de estilos completa.
    // Causa: #vgl-labsv-modal (y #vgl-postcita-panel, de v12.6.3) se cuelgan de
    // document.body, fuera de #vgl-root, y NO estaban en la lista de selectores donde se
    // declaran los tokens de diseño (--bg-solid, --fg, --r-surface, --font-stack...).
    // Sin tokens, cada declaración con var() es inválida y el navegador la descarta: queda
    // el texto desnudo. Esta prueba es estructural a propósito — mira la fuente, no el DOM
    // simulado, porque el arnés no aplica CSS y ninguna prueba de comportamiento puede ver
    // esto. Vale para CUALQUIER overlay futuro: si alguien agrega uno con su propio bloque
    // #id{...} y olvida la lista de tokens, aquí se cae.
    // =====================================================================
    t.caso("todo overlay con estilos propios hereda los tokens de diseño (si no, sale sin tarjeta sobre Everest)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      // La lista de tokens es el selector que abre el bloque de "Design tokens".
      const mTokens = /\n\s*(#vgl-root,[^\n{]*)\{\s*\n\s*\/\* Vidrio frost/.exec(src);
      t.cierto(!!mTokens, "debe existir el bloque de tokens de diseño encabezado por #vgl-root");
      const listaTokens = mTokens ? mTokens[1] : "";

      // Ids que el código crea de verdad (ov.id = "vgl-...").
      const idsCreados = new Set();
      const reId = /\bid\s*=\s*"(vgl-[a-z0-9-]+)"/g;
      let m;
      while ((m = reId.exec(src))) idsCreados.add(m[1]);
      t.cierto(idsCreados.has("vgl-labsv-modal"), "el aviso de labs vencidos sigue existiendo");
      t.cierto(idsCreados.has("vgl-postcita-panel"), "el panel post-cita sigue existiendo");

      // De esos, los que son OVERLAY de verdad: los que su propia regla CSS posiciona con
      // position:fixed. Ese es justo el conjunto que se cuelga del body y por tanto queda
      // fuera de #vgl-root; los hijos del panel (#vgl-head, #vgl-list...) heredan por estar
      // dentro y no necesitan estar en la lista.
      const fijosConEstilo = new Set();
      const reRegla = /([^{}]+)\{([^{}]*)\}/g;
      let r;
      while ((r = reRegla.exec(src))) {
        if (!/position\s*:\s*fixed/.test(r[2])) continue;
        for (const trozo of r[1].split(",")) {
          // El selector es la ÚLTIMA línea del trozo: lo anterior es el cierre de la regla
          // previa y sus comentarios, que este barrido plano arrastra.
          const sel = trozo.split("\n").pop();
          const mSel = /^\s*#(vgl-[a-z0-9-]+)(\.[a-z-]+)?\s*$/.exec(sel);   // raíz, no descendiente
          if (mSel && idsCreados.has(mSel[1])) fijosConEstilo.add(mSel[1]);
        }
      }
      t.cierto(fijosConEstilo.has("vgl-labsv-modal"), "el aviso de labs vencidos es un overlay fijo");
      t.cierto(fijosConEstilo.has("vgl-postcita-panel"), "el panel post-cita es un overlay fijo");

      const sinTokens = [...fijosConEstilo].filter((id) => !listaTokens.includes("#" + id)).sort();
      t.igual(sinTokens, [], "estos overlays viven fuera de #vgl-root y no heredan los tokens: saldrían sin tarjeta");
    });

    t.caso("tests extra para utilidades de stats y strings", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api.renderStats([]));
      t.noLanza(() => c.api.fraudesHoy());
      t.igual(c.api.escapeHtml("a < b & c > d"), "a &lt; b &amp; c &gt; d");
    });
  }
};
