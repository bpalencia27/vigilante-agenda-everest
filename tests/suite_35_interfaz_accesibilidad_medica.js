// =====================================================================
//  SUITE 35 — Interfaz, Accesibilidad Médica y Ergonomía Clínica (M5)
//
//  Cubre:
//    - R6.1: Escala tipográfica médica (--t-micro/body/lead/strong/title/hero)
//      y alturas de línea clínicas (1.4–1.55).
//    - R6.2: Lenguaje clínico claro y empático (sin concatenaciones crudas de
//      excepciones en toasts, alertas ni modales).
//    - R6.3: Contraste WCAG AA en estados de éxito y anillos de foco (:focus-visible).
//    - R6.4: Accesibilidad universal por teclado y ARIA (Escape, Focus Trap,
//      restauración de foco, role dialog/alertdialog, aria-modal, aria-live="polite",
//      dock con role="button", banner con role="region").
//    - R6.5: Modo rendimiento, reducción de movimiento y estabilidad visual.
// =====================================================================
const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Interfaz y Accesibilidad Médica (M5)",
  cubre: ["_activarAccesibilidadModal", "_mostrarAvisoPausaClinica"],

  async pruebas(t, api, env, cargar) {
    const RUTA_USERSCRIPT = path.join(__dirname, "..", "vigilante_agenda.user.js");
    const code = fs.readFileSync(RUTA_USERSCRIPT, "utf8");

    // ===================================================================
    //  1. TIPOGRAFÍA MÉDICA Y ESCALA DE TOKENS (R6.1)
    // ===================================================================

    t.caso("R6.1: Escala tipográfica médica completa definida en temas oscuro y claro", () => {
      const escalaOscura = /#vgl-root,[^{]+\{[^}]*--t-micro:12px;--t-body:14px;--t-lead:16px;--t-strong:15px;--t-title:18px;--t-hero:22px;/;
      const escalaClara = /#vgl-root\.light,[^{]+\{[^}]*--t-micro:12px;--t-body:14px;--t-lead:16px;--t-strong:15px;--t-title:18px;--t-hero:22px;/;

      t.cierto(escalaOscura.test(code), "Tokens tipográficos completos definidos en tema oscuro OLED");
      t.cierto(escalaClara.test(code), "Tokens tipográficos completos definidos en tema claro cerámica");
    });

    t.caso("R6.1: Alturas de línea clínicas (1.4 - 1.55) para legibilidad médica", () => {
      t.cierto(code.includes("line-height:1.5") || code.includes("line-height: 1.5"), "Toasts y bloques densos usan line-height 1.5");
    });

    // ===================================================================
    //  2. LENGUAJE CLÍNICO CLARO Y SIN EXCEPCIONES CRUDAS (R6.2)
    // ===================================================================

    t.caso("R6.2: Ausencia de concatenaciones crudas de excepciones en alert() y toasts", () => {
      const alertCrudoE = /alert\s*\(\s*["'`][^"'`]*\s*\+\s*e\s*\)/g;
      const alertCrudoErr = /alert\s*\(\s*["'`][^"'`]*\s*\+\s*err(?:\.message)?\s*\)/g;

      const matchesE = code.match(alertCrudoE) || [];
      const matchesErr = code.match(alertCrudoErr) || [];

      t.igual(matchesE.length, 0, `No debe haber alerts con concatenación cruda '+ e' (encontrados: ${matchesE.join(" | ")})`);
      t.igual(matchesErr.length, 0, `No debe haber alerts con concatenación cruda '+ err' (encontrados: ${matchesErr.join(" | ")})`);
    });

    // ===================================================================
    //  3. CONTRASTE WCAG AA Y ANILLOS DE FOCO VISIBLE (R6.3)
    // ===================================================================

    t.caso("R6.3: .vgl-bg-success declara color de texto de alto contraste contrastante", () => {
      const regSuccess = /\.vgl-bg-success\s*\{([^}]+)\}/;
      const match = regSuccess.exec(code);
      t.cierto(!!match, "Existe la regla .vgl-bg-success");
      t.cierto(match[1].includes("color:var(--bg-solid") || match[1].includes("color:#0b0e15") || match[1].includes("color: #0b0e15"),
        "El estado .vgl-bg-success define color de texto oscuro sobre fondo verde neón");
    });

    t.caso("R6.3: Anillos de foco :focus-visible definidos para controles interactivos", () => {
      t.cierto(code.includes(":focus-visible"), "Se definen selectores :focus-visible");
      t.cierto(code.includes("outline:2px solid var(--c-azul)") || code.includes("outline: 2px solid var(--c-azul)"),
        "Anillo de foco con borde contrastante azul");
    });

    // ===================================================================
    //  4. GESTOR UNIVERSAL DE ACCESIBILIDAD MODAL (_activarAccesibilidadModal) (R6.4)
    // ===================================================================

    t.caso("R6.4: _activarAccesibilidadModal cierra con Escape y ejecuta closeCallback", () => {
      let cerrado = false;
      const listeners = {};
      const mockModal = {
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k] || null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener(t, fn) { if (listeners[t] === fn) delete listeners[t]; },
        querySelectorAll() { return []; },
        contains() { return true; },
        focus() {}
      };

      const cleanup = api._activarAccesibilidadModal(mockModal, () => { cerrado = true; });
      t.cierto(typeof listeners.keydown === "function", "Registró listener keydown");

      let preventDefaultLlamado = false;
      listeners.keydown({
        key: "Escape",
        preventDefault() { preventDefaultLlamado = true; },
        stopPropagation() {}
      });

      t.cierto(cerrado, "Escape disparó el closeCallback");
      t.cierto(preventDefaultLlamado, "Escape previno el comportamiento por defecto");
      cleanup();
    });

    t.caso("R6.4: _activarAccesibilidadModal restaura el foco al elemento invocador al cerrar", () => {
      let focoRestaurado = false;
      const botonInvocador = {
        focus() { focoRestaurado = true; }
      };

      const c = cargar({ silencioso: true });
      c.env.doc.activeElement = botonInvocador;

      const listeners = {};
      const mockModal = {
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k] || null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener(t, fn) { if (listeners[t] === fn) delete listeners[t]; },
        querySelectorAll() { return []; },
        contains() { return true; },
        focus() {}
      };

      const cleanup = c.api._activarAccesibilidadModal(mockModal, () => {});
      cleanup();

      t.cierto(focoRestaurado, "Se restauró el foco al elemento previo");
    });

    t.caso("R6.4: _activarAccesibilidadModal atrapa el foco (Focus Trap) ciclando con Tab y Shift+Tab", () => {
      let focusedElem = null;
      const btnPrimero = { id: "primero", focus() { focusedElem = this; }, getAttribute() { return null; } };
      const btnUltimo = { id: "ultimo", focus() { focusedElem = this; }, getAttribute() { return null; } };

      const listeners = {};
      const mockModal = {
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k] || null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener(t, fn) { if (listeners[t] === fn) delete listeners[t]; },
        querySelectorAll(sel) { return [btnPrimero, btnUltimo]; },
        contains(el) { return el === btnPrimero || el === btnUltimo; },
        focus() {}
      };

      const c = cargar({ silencioso: true });
      c.api._activarAccesibilidadModal(mockModal, () => {});

      // Tab desde el último elemento -> debe saltar al primero
      c.env.doc.activeElement = btnUltimo;
      let preventDefaultTab = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: false,
        preventDefault() { preventDefaultTab = true; }
      });

      t.cierto(preventDefaultTab, "Previno salida de tabulación");
      t.igual(focusedElem && focusedElem.id, "primero", "Tab en el último elemento saltó al primero");

      // Shift+Tab desde el primer elemento -> debe saltar al último
      c.env.doc.activeElement = btnPrimero;
      let preventDefaultShift = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: true,
        preventDefault() { preventDefaultShift = true; }
      });

      t.cierto(preventDefaultShift, "Previno salida de tabulación invertida");
      t.igual(focusedElem && focusedElem.id, "ultimo", "Shift+Tab en el primer elemento saltó al último");
    });

    // ===================================================================
    //  5. SEMÁNTICA ARIA EN DIÁLOGOS Y CONTROLES (R6.4)
    // ===================================================================

    t.caso("R6.4: Alertas modales declaran role='alertdialog' o 'dialog' y aria-modal='true'", () => {
      const c = cargar({
        silencioso: true,
        almacen: { vgl_v73: "1", vgl_cfg: JSON.stringify({ cartel: true, reporte: true, uxTelemetria: true }) }
      });

      // bigAlert
      c.api.bigAlert("ROJO", "Alerta de fraude", "Detalle");
      const mAlert = c.env.doc.getElementById("vgl-modal");
      t.cierto(!!mAlert, "bigAlert insertó el modal");
      t.igual(mAlert.getAttribute("role"), "alertdialog", "bigAlert tiene role='alertdialog'");
      t.igual(mAlert.getAttribute("aria-modal"), "true", "bigAlert tiene aria-modal='true'");

      // pymAlert
      c.api.pymAlert("Paciente Prueba", ["VIH"], false, true);
      const mPym = c.env.doc.getElementById("vgl-pym-modal");
      t.cierto(!!mPym, "pymAlert insertó el modal");
      t.igual(mPym.getAttribute("role"), "dialog", "pymAlert tiene role='dialog'");
      t.igual(mPym.getAttribute("aria-modal"), "true", "pymAlert tiene aria-modal='true'");

      // abandonoPESAlert
      c.api.abandonoPESAlert("Paciente Prueba", true);
      const mPes = c.env.doc.getElementById("vgl-pes-modal");
      t.cierto(!!mPes, "abandonoPESAlert insertó el modal");
      t.igual(mPes.getAttribute("role"), "alertdialog", "abandonoPESAlert tiene role='alertdialog'");
      t.igual(mPes.getAttribute("aria-modal"), "true", "abandonoPESAlert tiene aria-modal='true'");

      // labsVencidosAlert
      c.api.labsVencidosAlert("Paciente Prueba", [{ nombre: "Creatinina" }], true);
      const mLabsv = c.env.doc.getElementById("vgl-labsv-modal");
      t.cierto(!!mLabsv, "labsVencidosAlert insertó el modal");
      t.igual(mLabsv.getAttribute("role"), "alertdialog", "labsVencidosAlert tiene role='alertdialog'");
      t.igual(mLabsv.getAttribute("aria-modal"), "true", "labsVencidosAlert tiene aria-modal='true'");
    });

    t.caso("R6.4: Regiones dinámicas declaran aria-live='polite' para lectores de pantalla", () => {
      t.cierto(code.includes('toasts.setAttribute("aria-live", "polite")'), "Contenedor de toasts tiene aria-live='polite'");
      t.cierto(code.includes('el.sum.setAttribute("aria-live", "polite")'), "Resumen de estado tiene aria-live='polite'");
      t.cierto(code.includes('id="vgl-labs-content" class="vgl-agm-slots" aria-live="polite"'), "Slots de laboratorios tienen aria-live='polite'");
      t.cierto(code.includes('slotsEl.setAttribute("aria-live", "polite")'), "Slots de agendamiento tienen aria-live='polite'");
    });

    t.caso("R6.4: Dock accesible como botón de teclado y Banner PyM como región accesible", () => {
      t.cierto(code.includes('dock.setAttribute("role", "button")'), "Dock tiene role='button'");
      t.cierto(code.includes('dock.setAttribute("tabindex", "0")'), "Dock es navegable por teclado (tabindex='0')");
      t.cierto(code.includes('banner.setAttribute("role", "region")'), "Banner PyM tiene role='region'");
      t.cierto(code.includes('banner.setAttribute("aria-expanded"'), "Banner PyM gestiona aria-expanded");
    });

    t.caso("R6.4: Hoja lateral (#vgl-sheet) y panel postcita responden a Escape", () => {
      t.cierto(code.includes('closeSheet()') && code.includes('e.key === "Escape"'), "Escape cierra #vgl-sheet");
      t.cierto(code.includes('panel.id = "vgl-postcita-panel"') && code.includes('e.key === "Escape"'), "Escape cierra #vgl-postcita-panel");
    });

    // ===================================================================
    //  6. RENDIMIENTO Y REDUCCIÓN DE MOVIMIENTO (R6.5)
    // ===================================================================

    t.caso("R6.5: @media (prefers-reduced-motion) desactiva transiciones y animaciones", () => {
      t.cierto(code.includes("@media (prefers-reduced-motion:reduce)"), "Media query de movimiento reducido presente");
      t.cierto(code.includes("transition:none!important") || code.includes("transition: none !important"), "Transiciones desactivadas bajo reduced-motion");
    });

    t.caso("R6.5: Selector de modo rendimiento (.perf) apaga sombras y efectos pesados", () => {
      t.cierto(code.includes("#vgl-root.perf"), "Modo rendimiento contemplado en CSS");
      t.cierto(code.includes("#vgl-root.perf #vgl-sheet"), "Efectos del sheet apagados en modo rendimiento");
    });

    t.caso("R5.1/R6.2: _mostrarAvisoPausaClinica renderiza aviso accesible y empático", () => {
      const c = cargar({ silencioso: true });
      c.api._mostrarAvisoPausaClinica("Mantenimiento programado");
      const elPausa = c.env.doc.getElementById("vgl-pausa-clinica");
      t.cierto(!!elPausa, "Aviso de pausa clínica insertado en document.body");
      t.cierto(elPausa.children.some(ch => (ch.textContent || "").includes("Pausa de seguridad remota activa")), "Mensaje empático de pausa de seguridad");
      t.cierto(elPausa.children.some(ch => (ch.textContent || "").includes("Mantenimiento programado")), "Incluye motivo especificado");
    });

    // ===================================================================
    //  7. PRUEBAS DE ESTRÉS ADVERSARIAL — ACCESIBILIDAD Y TECLADO (M5 Challenger)
    // ===================================================================

    t.caso("R6.4: [ESTRÉS ADVERSARIAL] Escape propaga stopPropagation, previene default y tolera callbacks ausentes o que lanzan", () => {
      const c = cargar({ silencioso: true });
      const listeners = {};
      const mockModal = {
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k] || null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener(t, fn) { if (listeners[t] === fn) delete listeners[t]; },
        querySelectorAll() { return []; },
        contains() { return true; },
        focus() {}
      };

      let stopPropagationCalled = false;
      let preventDefaultCalled = false;
      let callbackCalled = false;

      const cleanup = c.api._activarAccesibilidadModal(mockModal, () => {
        callbackCalled = true;
      });

      t.cierto(typeof listeners.keydown === "function", "Registró listener keydown");

      listeners.keydown({
        key: "Escape",
        preventDefault() { preventDefaultCalled = true; },
        stopPropagation() { stopPropagationCalled = true; }
      });

      t.cierto(stopPropagationCalled, "Escape llamó a stopPropagation para no fugar el evento al EHR host");
      t.cierto(preventDefaultCalled, "Escape llamó a preventDefault");
      t.cierto(callbackCalled, "Escape invocó el closeCallback");
      t.cierto(!listeners.keydown, "Cleanup desregistró el keydown listener tras Escape");
    });

    t.caso("R6.4: [ESTRÉS ADVERSARIAL] Restauración de foco tolerante a elementos deshabilitados, desconectados o con focus() fallido", () => {
      const c = cargar({ silencioso: true });

      // Elemento 1: lanza excepción en focus() (ej. elemento desmontado o deshabilitado)
      const disabledButton = {
        disabled: true,
        focus() { throw new Error("Simulated focus failure on detached/disabled DOM"); }
      };
      c.env.doc.activeElement = disabledButton;

      const mockModal1 = {
        attributes: {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener() {}, removeEventListener() {}, querySelectorAll() { return []; }, contains() { return true; }, focus() {}
      };
      const cleanup1 = c.api._activarAccesibilidadModal(mockModal1, () => {});
      t.noLanza(() => cleanup1(), "Cleanup no lanza excepción si activeElement previo lanza en focus()");

      // Elemento 2: activeElement nulo o indefinido
      c.env.doc.activeElement = null;
      const cleanup2 = c.api._activarAccesibilidadModal(mockModal1, () => {});
      t.noLanza(() => cleanup2(), "Cleanup tolera activeElement nulo sin romper el ciclo de vida");
    });

    t.caso("R6.4: [ESTRÉS ADVERSARIAL] Tab / Shift+Tab no previene navegación natural en elementos intermedios", () => {
      const c = cargar({ silencioso: true });
      let focusedElem = null;
      const btn0 = { id: "btn0", focus() { focusedElem = this; }, getAttribute() { return null; } };
      const btn1 = { id: "btn1", focus() { focusedElem = this; }, getAttribute() { return null; } };
      const btn2 = { id: "btn2", focus() { focusedElem = this; }, getAttribute() { return null; } };

      const listeners = {};
      const mockModal = {
        attributes: {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener() {},
        querySelectorAll() { return [btn0, btn1, btn2]; },
        contains(el) { return [btn0, btn1, btn2].includes(el); },
        focus() {}
      };

      c.api._activarAccesibilidadModal(mockModal, () => {});

      // En btn1 (intermedio) con Tab hacia adelante
      c.env.doc.activeElement = btn1;
      let preventDefaultCalled = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: false,
        preventDefault() { preventDefaultCalled = true; }
      });
      t.cierto(!preventDefaultCalled, "Tab en elemento intermedio NO previene default (navegación natural interna)");

      // En btn1 (intermedio) con Shift+Tab hacia atrás
      preventDefaultCalled = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: true,
        preventDefault() { preventDefaultCalled = true; }
      });
      t.cierto(!preventDefaultCalled, "Shift+Tab en elemento intermedio NO previene default (navegación natural interna)");
    });

    t.caso("R6.4: [ESTRÉS ADVERSARIAL] Focus Trap con 0 elementos enfocables previene fuga de foco sin fallar", () => {
      const c = cargar({ silencioso: true });
      const listeners = {};
      const mockModal = {
        attributes: {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener() {},
        querySelectorAll() { return []; },
        contains() { return false; },
        focus() {}
      };

      c.api._activarAccesibilidadModal(mockModal, () => {});

      let preventDefaultTab = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: false,
        preventDefault() { preventDefaultTab = true; }
      });
      t.cierto(preventDefaultTab, "Tab con 0 elementos enfocables previene fuga");

      let preventDefaultShift = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: true,
        preventDefault() { preventDefaultShift = true; }
      });
      t.cierto(preventDefaultShift, "Shift+Tab con 0 elementos enfocables previene fuga");
    });

    t.caso("R6.4: [ESTRÉS ADVERSARIAL] Focus Trap con 1 único elemento enfocable retiene foco en Tab y Shift+Tab", () => {
      const c = cargar({ silencioso: true });
      let focusCount = 0;
      const soloBtn = { id: "solo", focus() { focusCount++; }, getAttribute() { return null; } };

      const listeners = {};
      const mockModal = {
        attributes: {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener() {},
        querySelectorAll() { return [soloBtn]; },
        contains(el) { return el === soloBtn; },
        focus() {}
      };

      c.api._activarAccesibilidadModal(mockModal, () => {});
      c.env.doc.activeElement = soloBtn;

      // Tab
      let prevTab = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: false,
        preventDefault() { prevTab = true; }
      });
      t.cierto(prevTab, "Tab en elemento único previene salida");
      t.igual(focusCount, 1, "Tab reenfoca el único elemento");

      // Shift+Tab
      let prevShift = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: true,
        preventDefault() { prevShift = true; }
      });
      t.cierto(prevShift, "Shift+Tab en elemento único previene salida");
      t.igual(focusCount, 2, "Shift+Tab reenfoca el único elemento");
    });

    t.caso("R6.4: [ESTRÉS ADVERSARIAL] Focus Trap con 100 elementos enfocables cicla extremos y mantiene orden", () => {
      const c = cargar({ silencioso: true });
      const elements = [];
      let currentFocused = null;
      for (let i = 0; i < 100; i++) {
        elements.push({
          id: `elem_${i}`,
          index: i,
          focus() { currentFocused = this; },
          getAttribute() { return null; }
        });
      }

      const listeners = {};
      const mockModal = {
        attributes: {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener() {},
        querySelectorAll() { return elements; },
        contains(el) { return elements.includes(el); },
        focus() {}
      };

      c.api._activarAccesibilidadModal(mockModal, () => {});

      // Tab en elemento 99 cicla a elemento 0
      c.env.doc.activeElement = elements[99];
      let prevTab = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: false,
        preventDefault() { prevTab = true; }
      });
      t.cierto(prevTab, "Tab en elemento 99 previene salida");
      t.igual(currentFocused && currentFocused.id, "elem_0", "Tab en elemento 99 cicla a elemento 0");

      // Shift+Tab en elemento 0 cicla a elemento 99
      c.env.doc.activeElement = elements[0];
      let prevShift = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: true,
        preventDefault() { prevShift = true; }
      });
      t.cierto(prevShift, "Shift+Tab en elemento 0 previene salida");
      t.igual(currentFocused && currentFocused.id, "elem_99", "Shift+Tab en elemento 0 cicla a elemento 99");

      // Tab en elemento 50 no previene default
      c.env.doc.activeElement = elements[50];
      let prevMid = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: false,
        preventDefault() { prevMid = true; }
      });
      t.cierto(!prevMid, "Tab en elemento 50 permite propagación de tabulación interna");
    });

    t.caso("R6.4: [ESTRÉS ADVERSARIAL] Foco fuera del modal es recapturado inmediatamente al tabular", () => {
      const c = cargar({ silencioso: true });
      let focused = null;
      const first = { id: "first", focus() { focused = this; }, getAttribute() { return null; } };
      const last = { id: "last", focus() { focused = this; }, getAttribute() { return null; } };
      const outside = { id: "outside", focus() {}, getAttribute() { return null; } };

      const listeners = {};
      const mockModal = {
        attributes: {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener() {},
        querySelectorAll() { return [first, last]; },
        contains(el) { return el === first || el === last; },
        focus() {}
      };

      c.api._activarAccesibilidadModal(mockModal, () => {});

      // Foco activo fuera del modal
      c.env.doc.activeElement = outside;

      // Tab redirige al primer elemento
      let prevTab = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: false,
        preventDefault() { prevTab = true; }
      });
      t.cierto(prevTab, "Tab con foco externo previene salida");
      t.igual(focused && focused.id, "first", "Tab con foco externo redirige al primer elemento");

      // Shift+Tab redirige al último elemento
      c.env.doc.activeElement = outside;
      let prevShift = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: true,
        preventDefault() { prevShift = true; }
      });
      t.cierto(prevShift, "Shift+Tab con foco externo previene salida");
      t.igual(focused && focused.id, "last", "Shift+Tab con foco externo redirige al último elemento");
    });

    t.caso("R6.4: [ESTRÉS ADVERSARIAL] Filtro de elementos enfocables respeta aria-hidden='true'", () => {
      const c = cargar({ silencioso: true });
      let focused = null;
      const hiddenBtn = { id: "hidden", focus() { focused = this; }, getAttribute(k) { return k === "aria-hidden" ? "true" : null; } };
      const visibleBtn = { id: "visible", focus() { focused = this; }, getAttribute(k) { return null; } };

      const listeners = {};
      const mockModal = {
        attributes: {}, setAttribute() {}, getAttribute() { return null; },
        addEventListener(t, fn) { listeners[t] = fn; },
        removeEventListener() {},
        querySelectorAll() { return [hiddenBtn, visibleBtn]; },
        contains(el) { return el === visibleBtn; },
        focus() {}
      };

      c.api._activarAccesibilidadModal(mockModal, () => {});
      c.env.doc.activeElement = visibleBtn;

      let prevTab = false;
      listeners.keydown({
        key: "Tab",
        shiftKey: false,
        preventDefault() { prevTab = true; }
      });
      t.cierto(prevTab, "Tab previene salida");
      t.igual(focused && focused.id, "visible", "Foco se mantuvo en visibleBtn ignorando hiddenBtn");
    });
  }
};
