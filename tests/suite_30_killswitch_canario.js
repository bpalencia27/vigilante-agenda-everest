// =====================================================================
//  SUITE 30 — Red de Seguridad Remota, Kill-Switch y Canario (R5.1, R5.3)
// =====================================================================
const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Red de seguridad remota, Kill-Switch y Canario (R5.1, R5.3)",
  cubre: ["emergencyTeardown", "checkVersionMinimum"],

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

  }
};
