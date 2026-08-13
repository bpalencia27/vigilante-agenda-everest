const { JSDOM } = require("jsdom");

module.exports = {
  nombre: "Arranque de la interfaz (boot)",
  cubre: ["boot"],
  pruebas(t, api, env) {
    t.caso("boot se ejecuta sin lanzar excepción en un JSDOM limpio", () => {
      // Configuramos JSDOM para proporcionar un DOM real
      const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
        url: "https://neps.everestintelligent.com/viva/HCHealth/"
      });

      // Conectamos env.doc con jsdom para que las llamadas de boot interactúen con el DOM real
      env.doc.getElementById = (id) => dom.window.document.getElementById(id);
      env.doc.createElement = (tag) => dom.window.document.createElement(tag);
      env.doc.body = dom.window.document.body;
      env.doc.head = dom.window.document.head;
      env.doc.documentElement = dom.window.document.documentElement;
      env.doc.querySelector = dom.window.document.querySelector.bind(dom.window.document);
      env.doc.addEventListener = dom.window.document.addEventListener.bind(dom.window.document);

      // Guardamos para restaurar si es necesario, y exponemos la capacidad de arrojar error
      const err = [];
      env.win.setTimeout = (cb, ms) => {
        try { cb(); } catch(e) { err.push(e); }
        return 1;
      };
      env.win.setInterval = () => { return 1; };
      env.win.requestIdleCallback = (cb) => {
        try { cb(); } catch(e) { err.push(e); }
        return 1;
      };
      env.win.clearTimeout = () => {};

      t.noLanza(() => {
        api.boot();
      }, "boot() no debería lanzar ninguna excepción al arrancar");

      t.cierto(err.length === 0, "No debe haber errores asíncronos en los timeouts/callbacks");
      t.cierto(dom.window.document.getElementById("vgl-root") !== null, "Debe haber creado el contenedor vgl-root en el DOM");
    });
  }
};
