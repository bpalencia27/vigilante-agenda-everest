// =====================================================================
//  SUITE 30 — Red de Seguridad Remota, Kill-Switch y Canario (R5.1, R5.3)
// =====================================================================
const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Red de seguridad remota, Kill-Switch y Canario (R5.1, R5.3)",
  cubre: ["emergencyTeardown", "checkVersionMinimum", "_mostrarAvisoPausaClinica"],

  async pruebas(t, api, env, cargar) {

    t.caso("R5.1: Cuádruple sincronización de versión (@version, const VERSION, package.json, GM_info)", () => {
      const rutaScript = path.join(__dirname, "..", "vigilante_agenda.user.js");
      const rutaPkg = path.join(__dirname, "..", "package.json");
      const srcScript = fs.readFileSync(rutaScript, "utf8");
      const pkg = JSON.parse(fs.readFileSync(rutaPkg, "utf8"));

      const matchHeader = srcScript.match(/\/\/\s*@version\s+([\d.]+)/);
      const matchFallback = srcScript.match(/const VERSION = [^;]*\|\|\s*"([\d.]+)"/);

      t.cierto(!!matchHeader, "@version hallado en encabezado del userscript");
      t.cierto(!!matchFallback, "const VERSION de respaldo hallada en userscript");
      t.cierto(!!pkg.version, "versión presente en package.json");

      const verHeader = matchHeader[1];
      const verFallback = matchFallback[1];
      const verPkg = pkg.version;

      t.igual(verFallback, verHeader, "const VERSION debe coincidir con @version");
      t.igual(verPkg, verHeader, "package.json version debe coincidir con @version");

      const c = cargar({ silencioso: true });
      t.cierto(!!c.env.win.GM_info, "GM_info está definido en el entorno");
      t.igual(c.env.win.GM_info.script.version, verHeader, "GM_info.script.version extrae dinámicamente @version");
    });

    // =====================================================================
    // v15.x — GUARDIA ESTRUCTURAL DEL KILL-SWITCH.
    // emergencyTeardown() solo puede cancelar lo que este registrado en state.timers.
    // Se colaron TRES setInterval de boot() sin referencia (los dos del PyM y la sonda de
    // pestañas): con el kill-switch tirado, la interfaz desaparecia y el cartel decia
    // "Pausa de seguridad remota activa" mientras la pestaña seguia consultando SharePoint
    // y desempacando el libro de PyM cada 10 min. Esta prueba lee el fuente y exige que
    // TODO setInterval de boot() quede guardado en una constante que llegue a state.timers,
    // para que el proximo que se agregue no se escape en silencio.
    // =====================================================================
    t.caso("R5.1-bis: todo setInterval creado en boot() queda registrado en state.timers (si no, el kill-switch no lo apaga)", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const iBoot = src.indexOf("\n  function boot() {");
      t.cierto(iBoot > 0, "se localiza boot() en el fuente");
      const cuerpo = src.slice(iBoot);

      // Todo lo que llega a state.timers, en cualquiera de los push de boot().
      const registrados = new Set();
      const rePush = /state\.timers\.push\(([^)]*)\)/g;
      let mp;
      while ((mp = rePush.exec(cuerpo))) {
        mp[1].split(",").forEach((n) => { const t2 = n.trim(); if (t2) registrados.add(t2); });
      }
      t.cierto(registrados.size > 0, "boot() registra temporizadores en state.timers");

      // Cada setInterval de boot(): o se guarda en una const registrada, o es una fuga.
      const fugas = [];
      const reInt = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*setInterval\(|(\bsetInterval\()/g;
      let mi;
      while ((mi = reInt.exec(cuerpo))) {
        const linea = cuerpo.slice(0, mi.index).split("\n").length;
        if (mi[1]) { if (!registrados.has(mi[1])) fugas.push(mi[1] + " (boot+" + linea + ")"); }
        else { fugas.push("setInterval anonimo (boot+" + linea + ")"); }
      }
      t.igual(fugas, [], "ningun setInterval de boot() puede quedar fuera de state.timers; sueltos: " + fugas.join(" | "));
    });

    t.caso("emergencyTeardown: desmantela DOM, limpia temporizadores y persiste estado de apagado", () => {
      const c = cargar({ silencioso: true });
      const doc = c.env.doc;
      const root = doc.createElement("div");
      root.id = "vgl-root";
      doc.body.appendChild(root);

      const modal = doc.createElement("div");
      modal.id = "vgl-modal-test";
      doc.body.appendChild(modal);

      c.api.__state.timers = [999];

      t.cierto(doc.body.children.length >= 2, "DOM contiene elementos inyectados");

      c.api.emergencyTeardown("Defecto crítico de prueba");

      t.cierto(c.api.__state.killed === true, "state.killed marcado como true");
      t.igual(c.api.__state.killReason, "Defecto crítico de prueba", "motivo de apagado registrado");
      t.igual(c.env.gm["vgl_kill_active"], true, "vgl_kill_active persistido en GM_setValue");
      t.igual(c.env.gm["vgl_kill_reason"], "Defecto crítico de prueba", "vgl_kill_reason persistido");
      t.igual(c.api.__state.timers.length, 0, "state.timers queda vacío tras emergencyTeardown");
      t.igual(doc.body.children.filter(e => e.id === "vgl-root" || e.id === "vgl-modal-test").length, 0, "elementos inyectados removidos del DOM");

      const banner = doc.body.children.find(e => e.id === "vgl-pausa-clinica");
      t.cierto(!!banner, "banner de pausa clínica insertado");
      t.cierto(banner.children.some(ch => (ch.textContent || "").includes("Defecto crítico de prueba")), "banner muestra motivo");
    });

    await t.casoAsync("emergencyTeardown: bloquea escrituras clínicas en injectLabs, asignación y ordenamiento", async () => {
      const c = cargar({ silencioso: true });
      c.api.emergencyTeardown("Apagado por seguridad");

      const resLabs = c.api.injectLabsIntoCronicos([{ nombre: "GLUCOSA", resultado: "100" }], "12345");
      t.cierto(resLabs.abortadoPorKillSwitch === true, "Auto-Labs aborta inmediatamente bajo kill-switch");
      t.igual(resLabs.count, 0, "0 casillas escritas");

      const resTurno = await c.api.apiAccesoAsignarTurno(1, 2, "2026-08-15", "", false);
      t.cierto(resTurno.error === true, "AsignarTurno aborta bajo kill-switch");

      const resOrden = await c.api.apiOrdenamientoGuardar(1, 2, [{ Id: 10 }]);
      t.igual(resOrden, null, "GuardarOrdenamiento aborta bajo kill-switch");
    });

    t.caso("checkVersionMinimum: tolerancia a fallos de red (Fail-Open)", () => {
      let gmxhrLlamado = false;
      const mockGmxhr = (opts) => {
        gmxhrLlamado = true;
        // Simular error de red o timeout
        if (opts.onerror) opts.onerror(new Error("Network connection lost"));
      };

      const c = cargar({ silencioso: true, gmxhr: mockGmxhr });
      c.api.__state.lastVersionCheck = 0;
      c.api.checkVersionMinimum();

      t.cierto(gmxhrLlamado, "GM_xmlhttpRequest fue invocado");
      t.cierto(c.api.__state.killed === false, "Fail-Open: el script permanece activo tras fallo de red");
    });

    t.caso("checkVersionMinimum: activa Kill-Switch remoto cuando el payload lo solicita para all", () => {
      const mockGmxhr = (opts) => {
        if (opts.onload) {
          opts.onload({
            status: 200,
            responseText: JSON.stringify({
              status: "ok",
              minVersion: "14.1.5",
              killSwitch: {
                active: true,
                reason: "EHR DOM breaking change detectado",
                scope: "all"
              }
            })
          });
        }
      };

      const c = cargar({ silencioso: true, gmxhr: mockGmxhr });
      c.api.__state.lastVersionCheck = 0;
      c.api.checkVersionMinimum();

      t.cierto(c.api.__state.killed === true, "Kill-switch activado tras respuesta remota");
      t.igual(c.api.__state.killReason, "EHR DOM breaking change detectado", "Motivo remoto registrado");
      t.igual(c.env.gm["vgl_kill_active"], true, "Bandera vgl_kill_active persistida");
    });

    t.caso("checkVersionMinimum: filtra Kill-Switch por scope de equipo (_equipoId)", () => {
      let c = cargar({
        silencioso: true,
        gmxhr: (opts) => {
          opts.onload({
            status: 200,
            responseText: JSON.stringify({
              killSwitch: {
                active: true,
                reason: "Prueba equipo ajeno",
                scope: ["eq-otro-consultorio-999"]
              }
            })
          });
        }
      });

      c.api.__state.lastVersionCheck = 0;
      c.api.checkVersionMinimum();
      t.cierto(c.api.__state.killed === false, "Kill-switch no afecta a equipo fuera de scope");

      c = cargar({
        silencioso: true,
        gmxhr: (opts) => {
          opts.onload({
            status: 200,
            responseText: JSON.stringify({
              killSwitch: {
                active: true,
                reason: "Prueba este equipo",
                scope: ["eq-consultorio-101"]
              }
            })
          });
        }
      });
      c.env.storage.setItem("vgl_equipo_id", "eq-consultorio-101");
      c.api.__state.lastVersionCheck = 0;
      c.api.checkVersionMinimum();
      t.cierto(c.api.__state.killed === true, "Kill-switch se activa cuando scope incluye este equipo");
    });

    t.caso("checkVersionMinimum: desactiva selectivamente características (disabledFeatures: autoLabs)", () => {
      const c = cargar({
        silencioso: true,
        gmxhr: (opts) => {
          opts.onload({
            status: 200,
            responseText: JSON.stringify({
              minVersion: "14.1.5",
              killSwitch: {
                active: false,
                disabledFeatures: ["autoLabs"]
              }
            })
          });
        }
      });

      c.api.__state.lastVersionCheck = 0;
      c.api.checkVersionMinimum();

      t.cierto(c.api.__state.disabledFeatures.has("autoLabs"), "autoLabs registrado en disabledFeatures");
      t.cierto(c.api.__state.killed === false, "script principal sigue vivo");

      const res = c.api.injectLabsIntoCronicos([{ nombre: "GLUCOSA", resultado: "90" }], "12345");
      t.cierto(res.desactivadoRemoto === true, "injectLabsIntoCronicos reconoce desactivación selectiva");
    });

    t.caso("Canario: activa versión o banderas experimentales solo en consultorios seleccionados", () => {
      const c = cargar({
        silencioso: true,
        gmxhr: (opts) => {
          opts.onload({
            status: 200,
            responseText: JSON.stringify({
              minVersion: "14.1.5",
              disabledFeatures: ["moduloExperimental"],
              canary: {
                enabled: true,
                allowedEquipos: ["eq-piloto-01"],
                enabledFeatures: ["moduloExperimental"]
              }
            })
          });
        }
      });

      c.env.storage.setItem("vgl_equipo_id", "eq-piloto-01");
      c.api.__state.lastVersionCheck = 0;
      c.api.checkVersionMinimum();

      t.falso(c.api.__state.disabledFeatures.has("moduloExperimental"), "canary habilitó la característica para eq-piloto-01");
    });

    // v18.13.0 (Mesa de Expertos, simplificable #1) — la comparación de versiones
    // ("14.1.6" vs "14.1.5") dejó de reimplementarse en línea y ahora delega en
    // mtrVersionEsMasNueva; esta prueba ancla que el candado de versión mínima SIGUE
    // disparándose igual que antes del refactor.
    t.caso("checkVersionMinimum (Mesa de Expertos): minVersion más nueva sigue disparando el candado de actualización (needsUpdate vía mtrVersionEsMasNueva)", () => {
      const c = cargar({
        silencioso: true,
        gmxhr: (opts) => {
          opts.onload({
            status: 200,
            responseText: JSON.stringify({ minVersion: "99.0.0" }),
          });
        },
      });
      c.api.__state.lastVersionCheck = 0;
      c.api.checkVersionMinimum();
      t.igual(c.env.win.sessionStorage.getItem("vgl_upd|99.0.0"), "1",
        "el camino de actualización obligatoria se tomó (needsUpdate=true) — la marca de recarga quedó puesta");
    });

    // =================================================================
    //  v18.0.53 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta:
    //  EL KILL-SWITCH SE ACTIVABA EN SILENCIO TOTAL.
    //
    //  El médico usa «modo oculto» (Ctrl+Shift+V) para trabajar sin la interfaz del
    //  Vigilante «sin apagar su trabajo de fondo» — es la promesa explícita de esa
    //  función, y el estado sobrevive recargas por diseño. Si el consultorio dispara el
    //  kill-switch remoto con el modo oculto encendido, `emergencyTeardown` para el reloj
    //  y borra la interfaz… y el ÚNICO aviso que lo delata (el cartel rojo de Pausa de
    //  seguridad) lo escondía nuestra propia hoja de estilos, porque su id estaba dentro
    //  del grupo que el modo oculto apaga.
    //
    //  Medido en Chromium con el CSS real (tools/verificar_pausa_modo_oculto.js): el
    //  cartel se pintaba sin la clase y desaparecía con ella.
    //
    //  El propio comentario de ese bloque de CSS ya tenía escrita la regla, dos líneas más
    //  arriba: «los sonidos críticos de fraude NO se apagan: son seguridad, no
    //  decoración». El cartel del kill-switch es exactamente eso.
    // =================================================================
    t.caso("v18.0.53 — el cartel del kill-switch es inmune al modo oculto (por diseño, en la hoja)", () => {
      const fs2 = require("fs"), path2 = require("path");
      const src = fs2.readFileSync(path2.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/body\.vgl-modo-oculto #vgl-pausa-clinica\b/.test(src),
        "el aviso de Pausa de seguridad no puede estar en la lista que el modo oculto esconde");
      // Y el modo oculto tiene que seguir escondiendo lo que sí es interfaz: si esta
      // comprobación cae, es que se vació la lista entera en vez de sacar un id.
      t.cierto(/body\.vgl-modo-oculto #vgl-root\b/.test(src),
        "el modo oculto sigue escondiendo el panel: no se rompió lo que sí debía seguir");
    });

    t.caso("v18.0.53 — y el kill-switch apaga el modo oculto: le gana a una preferencia de interfaz", () => {
      // Segunda capa, y no sobra: si mañana alguien añade otra regla que esconda cosas en
      // modo oculto, este aviso ya no depende de que se acuerde de excluirlo.
      const c = cargar({ silencioso: true });
      c.env.doc.body.classList.add("vgl-modo-oculto");
      t.cierto(c.env.doc.body.classList.contains("vgl-modo-oculto"), "montaje: el modo oculto está encendido");
      c.api._mostrarAvisoPausaClinica("Prueba");
      t.falso(c.env.doc.body.classList.contains("vgl-modo-oculto"),
        "al pintar el aviso de Pausa de seguridad, el modo oculto se apaga");
    });

    // =================================================================
    //  v18.3.4 — HIGIENE DEL KILL-SWITCH (frente T4 del enjambre).
    //
    //  (a) startNag/startFlash crean intervalos PROPIOS (nagTimer/flashTimer,
    //      fuera de state.timers): un kill durante un aviso ROJO activo dejaba el
    //      tono insistente sonando hasta ~6 min con la UI ya borrada y sin modal
    //      que permitiera reconocerlo (acknowledge() es inalcanzable tras retirar
    //      el DOM). emergencyTeardown ahora los apaga.
    //  (b) _vglInstalarVigilanciaDom dejaba su MutationObserver y sus 3 listeners
    //      de captura en variables LOCALES: el kill no podía recogerlos y el
    //      script "muerto" seguía observando el DOM. Las referencias ahora viven
    //      a nivel de módulo y el teardown las suelta (patrón B13).
    //  LIMITACIÓN del arnés: MutationObserver.disconnect y removeEventListener son
    //  no-ops aquí, así que lo observable es el ciclo de vida de las referencias
    //  (__vglDomVigilanciaParaTest) y de los intervalos (env.intervalos).
    // =================================================================
    await t.casoAsync("v18.3.4 — kill con aviso activo: nag y flash mueren con el script y la vigilancia de DOM queda suelta", async () => {
      const c = cargar({ silencioso: true });

      // Montaje: insistir y parpadeo van apagados de fábrica; se encienden solo aquí
      // y se disparan ambos canales como en un aviso ROJO real.
      c.api.__S.insistir = true;
      c.api.__S.parpadeo = true;
      const vivosBase = new Set([...c.env.intervalos.entries()].filter(([, r]) => r.vivo).map(([id]) => id));
      c.api.startNag("ROJO");
      c.api.startFlash("Atención extemporánea", "ROJO");
      const nuevos = [...c.env.intervalos.entries()].filter(([id, r]) => r.vivo && !vivosBase.has(id)).map(([id]) => id);
      t.cierto(nuevos.length >= 2, "montaje: nag y flash registraron sus intervalos propios (" + nuevos.length + " nuevos vivos)");

      // El observador de DOM se instala perezosamente desde la compuerta de cosecha.
      t.cierto(c.api._vglDomEstaSucia() === true, "la compuerta de cosecha responde (con ella se instala la vigilancia de DOM)");
      const vig = c.api.__vglDomVigilanciaParaTest();
      t.cierto(!!vig.obs, "montaje: el observer de DOM quedó referenciado a nivel de módulo");
      t.cierto(typeof vig.alTocar === "function", "montaje: los listeners de captura quedaron referenciados");
      t.cierto(vig.instalado === true, "montaje: el latch de instalación está en true");

      c.api.emergencyTeardown("Higiene T4 de prueba");

      const nuevosVivos = nuevos.filter((id) => { const r = c.env.intervalos.get(id); return r && r.vivo; });
      t.igual(nuevosVivos, [], "tras el kill no queda vivo ningún intervalo de nag/flash: el aviso murió con el script");
      const vig2 = c.api.__vglDomVigilanciaParaTest();
      t.igual(vig2.obs, null, "tras el kill el observer de DOM quedó desconectado y sin referencia");
      t.igual(vig2.alTocar, null, "tras el kill los listeners de captura quedaron retirados y sin referencia");
      t.cierto(vig2.instalado === true, "el latch de instalación sigue en true: una llamada tardía a la compuerta no reinstala el observador de un script muerto");
    });

  }
};
