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
  }
};
