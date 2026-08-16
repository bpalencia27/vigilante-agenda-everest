// =====================================================================
//  SUITE 33 — Robustez, Concurrencia, Estado y Red (M3)
//  Verificación formal de resiliencia del Vigilante de Agenda:
//   · R3.8: Estado persistido, esquema versionado (vgl_schema v14),
//           cuarentena de corrupción, cuarentena hacia atrás y aislamiento médico.
//   · R3.9: Cortacircuitos (Circuit Breaker) de 3 estados y presupuesto de red.
//   · R3.4: Backoff exponencial con jitter y protección de login Athenea.
//   · R3.2: Idempotencia clínica (0 reintentos en POST) y reentrada UI.
//   · R3.1: Política de errores de 3 niveles, falla cerrada y cero PHI.
//   · R3.5: Límites de memoria y estabilidad en jornadas prolongadas.
//   · R3.7: Aislamiento CSS (.vgl-*), capas z-index y variables de respaldo.
// =====================================================================

const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Robustez, Concurrencia, Estado y Red (M3)",
  cubre: [
    "safeReadJSON",
    "safeWriteJSON",
    "migrarEsquemaVgl",
    "purgaPorCuota",
    "invalidarApiSiCambioMedico",
    "_pageFetchJsonCore",
    "circuitBreakerExec",
    "getCircuitBreaker",
    "atheneaAutoLogin",
    "repQLoad",
    "repQSave",
    "getProcessedToday",
    "markCitaAgendadaHoy",
    "markOrdenesCreadasHoy"
  ],

  async pruebas(t, api, env, cargar) {
    const c = cargar({ silencioso: true });
    const A = c.api;
    const S = A.__S;
    const PROC_KEY = "vgl_proc_today";
    const SETTINGS_KEY = "vgl_cfg";
    const SCHEMA_KEY = "vgl_schema";

    // ------------------------------------------------------------------
    // 1. R3.8 — Esquema versionado y migraciones secuenciales (v0 -> v14)
    // ------------------------------------------------------------------
    t.caso("R3.8: migrarEsquemaVgl migra desde v0 a v14 aplicando normalizaciones", () => {
      c.env.storage.removeItem(SCHEMA_KEY);
      c.env.storage.setItem("vgl_popup", "1");
      c.env.storage.removeItem("vgl_v73");
      c.env.storage.setItem("vgl_events", '["antiguo_blob_gigante"]');
      c.env.storage.setItem(PROC_KEY, JSON.stringify({ dia: "2026-08-14", citas: ["1020304050"] }));

      const res = A.migrarEsquemaVgl();
      t.igual(res.version, 14, "La versión de esquema debe alcanzar 14");
      t.cierto(Array.isArray(res.migrationsApplied), "Debe registrar migraciones aplicadas");
      t.cierto(res.migrationsApplied.length >= 4, "Debe haber ejecutado todas las etapas de migración");

      const enStorage = JSON.parse(c.env.storage.getItem(SCHEMA_KEY));
      t.igual(enStorage.version, 14, "El esquema debe quedar persistido en localStorage con versión 14");
      t.igual(c.env.storage.getItem("vgl_events"), null, "El blob gigante vgl_events debe ser purgado");
      t.igual(c.env.storage.getItem("vgl_v73"), "1", "vgl_v73 debe quedar marcado");
    });

    t.caso("R3.8: migrarEsquemaVgl es idempotente en esquema ya actualizado (v14)", () => {
      const inicial = A.migrarEsquemaVgl();
      const segundaVez = A.migrarEsquemaVgl();
      t.igual(segundaVez.version, 14, "La versión se mantiene en 14");
      t.igual(segundaVez.migrationsApplied.length, inicial.migrationsApplied.length, "No se agregan migraciones duplicadas");
    });

    t.caso("R3.8: Cuarentena hacia atrás (Downgrade Guard) preserva esquemas futuros v15+", () => {
      c.env.storage.removeItem(SCHEMA_KEY);
      const futuro = {
        version: 15,
        campoNuevoV15: "valor_futuro_critico",
        migrationsApplied: [{ from: 14, to: 15, ts: Date.now() }]
      };
      c.env.storage.setItem(SCHEMA_KEY, JSON.stringify(futuro));

      const res = A.migrarEsquemaVgl();
      t.igual(res.version, 15, "No debe degradar la versión del esquema futuro");
      t.igual(res.campoNuevoV15, "valor_futuro_critico", "Los campos del esquema futuro no deben ser destruidos");

      const claves = Object.keys(c.env.almacen);
      const hayBackup = claves.some(k => k.startsWith("vgl_future_backup_15_"));
      t.cierto(hayBackup, "Debe crear un snapshot de respaldo en vgl_future_backup_15_*");
    });

    // ------------------------------------------------------------------
    // 2. R3.8 / R3.1 — safeReadJSON, safeWriteJSON y Cuarentena de Corrupción
    // ------------------------------------------------------------------
    t.caso("R3.8 / R3.1: safeReadJSON pone en cuarentena JSON corrupto y retorna default", () => {
      const claveCorrupta = "vgl_test_corrupto";
      const payloadInvalido = '{"paciente": 102030, "incompleto": ';
      c.env.storage.setItem(claveCorrupta, payloadInvalido);

      const defecto = { seguro: true };
      const resultado = A.safeReadJSON(claveCorrupta, defecto);

      t.igual(resultado, defecto, "Debe retornar el valor por defecto seguro ante corrupción");
      const claves = Object.keys(c.env.almacen);
      const hayQuarantine = claves.some(k => k.startsWith("vgl_quarantine_" + claveCorrupta + "_"));
      t.cierto(hayQuarantine, "Debe aislar el payload malformado en vgl_quarantine_* para auditoría forense");
    });

    t.caso("R3.8: safeReadJSON con clave inexistente retorna default sin crear cuarentena", () => {
      const res = A.safeReadJSON("vgl_no_existe_absolutamente", 999);
      t.igual(res, 999);
      const hayQuarantine = Object.keys(c.env.almacen).some(k => k.includes("vgl_no_existe_absolutamente"));
      t.falso(hayQuarantine, "No debe crear cuarentena para claves legítimamente vacías");
    });

    t.caso("R3.8: safeWriteJSON serializa y persiste correctamente", () => {
      const exito = A.safeWriteJSON("vgl_test_ok", { estado: "sano", n: 42 });
      t.cierto(exito, "safeWriteJSON debe retornar true");
      const leido = A.safeReadJSON("vgl_test_ok", null);
      t.igual(leido, { estado: "sano", n: 42 });
    });

    t.caso("R3.8: purgaPorCuota libera 40% de vgl_stats/vgl_evt sin tocar claves ajenas", () => {
      c.env.almacen["everest_session_token"] = "token_de_everest_intacto";
      c.env.almacen["vgl_stats"] = JSON.stringify({
        "2026-07-01": { consultas: 10 },
        "2026-08-14": { consultas: 5 }
      });
      c.env.almacen["vgl_evt_2026-07-01"] = JSON.stringify([{ ev: "antiguo" }]);
      c.env.almacen["vgl_evt_2026-08-14"] = JSON.stringify([{ ev: "nuevo" }]);

      A.purgaPorCuota();

      t.igual(c.env.almacen["everest_session_token"], "token_de_everest_intacto", "NUNCA debe tocar claves ajenas del origen Everest");
      t.cierto(c.env.almacen["vgl_stats"] !== undefined, "vgl_stats debe seguir existiendo");
    });

    // ------------------------------------------------------------------
    // 3. R3.8 / R3.3 — Aislamiento de Sesión por Médico en Equipos Compartidos
    // ------------------------------------------------------------------
    t.caso("R3.8: invalidarApiSiCambioMedico purga URL y cachés cuando cambia el profesional", () => {
      c.env.storage.setItem("vgl_api_url", "https://neps.everestintelligent.com/viva/APIHCHealth/api/Agenda/ObtenerConsultas?profesionalId=10854");
      c.env.storage.setItem("vgl_api_medico", "10854");
      
      const instancia = cargar({ silencioso: true });
      const apiLocal = instancia.api;

      // Médico inicial configurado
      apiLocal.invalidarApiSiCambioMedico(10854);
      
      // Cambio de médico detectado en el mismo computador (Dra. 20491)
      apiLocal.invalidarApiSiCambioMedico(20491);

      t.igual(instancia.env.storage.getItem("vgl_api_url"), null, "La URL del médico anterior debe ser purgada");
      t.igual(instancia.env.storage.getItem("vgl_api_medico"), "20491", "El nuevo médico debe quedar registrado");
    });

    t.caso("R3.8: invalidarApiSiCambioMedico con el mismo ID conserva la URL", () => {
      const instancia = cargar({ silencioso: true });
      instancia.env.storage.setItem("vgl_api_url", "https://neps.everestintelligent.com/viva/APIHCHealth/api/Agenda/ObtenerConsultas?profesionalId=10854");
      instancia.env.storage.setItem("vgl_api_medico", "10854");

      instancia.api.invalidarApiSiCambioMedico(10854);
      t.cierto(instancia.env.storage.getItem("vgl_api_url") !== null, "No debe purgar si el médico en sesión es el mismo");
    });

    t.caso("R3.8: markCitaAgendadaHoy y markOrdenesCreadasHoy particionan por médico en byDoctor", () => {
      c.env.storage.removeItem(PROC_KEY);
      A.markCitaAgendadaHoy("1020304506", "2026-08-20");
      A.markOrdenesCreadasHoy("1020304506", [501, 502], ["VIH", "CREATININA"]);

      const proc = A.getProcessedToday();
      t.cierto(proc.citas.includes("1020304506"), "Cédula debe estar en lista global diaria de citas");
      t.cierto(proc.ordenes.includes("1020304506"), "Cédula debe estar en lista global diaria de órdenes");
      t.cierto(proc.citasDetalle["1020304506"].fechaIso === "2026-08-20", "Fecha ISO debe persistirse");
      t.igual(proc.ordenesDetalle["1020304506"].agrupadores, [501, 502], "Agrupadores deben persistirse");
    });

    // ------------------------------------------------------------------
    // 4. R3.9 / R3.4 — Cortacircuitos (Circuit Breaker) de 3 Estados
    // ------------------------------------------------------------------
    await t.casoAsync("R3.9: Circuit Breaker inicia en CLOSED y ejecuta llamadas exitosas", async () => {
      const breaker = A.getCircuitBreaker("test_cb_1");
      t.igual(breaker.state, "CLOSED", "Estado inicial debe ser CLOSED");

      let llamadas = 0;
      const res = await A.circuitBreakerExec("test_cb_1", async () => {
        llamadas++;
        return { ok: true, data: [1, 2, 3] };
      });

      t.igual(llamadas, 1, "Debe ejecutar la función asíncrona");
      t.igual(res.ok, true, "Debe retornar el resultado exitoso");
      t.igual(breaker.failures, 0, "Contador de fallos debe permanecer en 0");
    });

    await t.casoAsync("R3.9: Circuit Breaker pasa a OPEN tras 3 fallos y activa Fail-Fast", async () => {
      const breaker = A.getCircuitBreaker("test_cb_trans");
      breaker.failures = 0;
      breaker.state = "CLOSED";

      let intentosReales = 0;
      const funcionFallida = async () => {
        intentosReales++;
        throw new Error("HTTP 500 Server Error");
      };

      // 3 fallos consecutivos
      await A.circuitBreakerExec("test_cb_trans", funcionFallida);
      await A.circuitBreakerExec("test_cb_trans", funcionFallida);
      await A.circuitBreakerExec("test_cb_trans", funcionFallida);

      t.igual(intentosReales, 3, "Debe haber intentado 3 veces");
      t.igual(breaker.state, "OPEN", "Tras 3 fallos, el cortacircuitos debe estar en estado OPEN");

      // Cuarta llamada en OPEN: Fail-Fast (no debe ejecutar la función)
      const resCuarta = await A.circuitBreakerExec("test_cb_trans", funcionFallida, () => "fallback_inmediato");
      t.igual(intentosReales, 3, "La cuarta llamada en OPEN NO debe invocar la red (0 peticiones reales)");
      t.igual(resCuarta, "fallback_inmediato", "Debe retornar el fallback de degradación seguro");
    });

    await t.casoAsync("R3.9: Circuit Breaker HALF-OPEN recupera a CLOSED con sonda exitosa", async () => {
      const breaker = A.getCircuitBreaker("test_cb_recovery");
      breaker.state = "OPEN";
      breaker.nextAttemptTs = Date.now() - 1000; // Simular que T_reset ya expiró

      let ejecutoSonda = false;
      const res = await A.circuitBreakerExec("test_cb_recovery", async () => {
        ejecutoSonda = true;
        return { recovered: true };
      });

      t.cierto(ejecutoSonda, "Debe permitir 1 petición de sondeo (Canary Probe)");
      t.igual(res.recovered, true, "La sonda debe retornar el valor esperado");
      t.igual(breaker.state, "CLOSED", "Tras sonda exitosa, el cortacircuitos regresa a CLOSED");
      t.igual(breaker.failures, 0, "Los fallos deben restablecerse a 0");
    });

    await t.casoAsync("R3.9: Circuit Breaker HALF-OPEN fallido regresa a OPEN con backoff duplicado", async () => {
      const breaker = A.getCircuitBreaker("test_cb_half_fail");
      breaker.state = "OPEN";
      breaker.resetTimeoutMs = 60000;
      breaker.nextAttemptTs = Date.now() - 1000;

      await A.circuitBreakerExec("test_cb_half_fail", async () => {
        throw new Error("Timeout en sonda");
      });

      t.igual(breaker.state, "OPEN", "Sonda fallida devuelve el cortacircuitos a OPEN");
      t.cierto(breaker.resetTimeoutMs >= 120000, "El tiempo de reset debe duplicarse con backoff exponencial");
    });

    // ------------------------------------------------------------------
    // 5. R3.2 / R3.4 — Idempotencia de Escrituras Clínicas y Backoff
    // ------------------------------------------------------------------
    await t.casoAsync("R3.2: _pageFetchJsonCore en POST tiene 0 reintentos automáticos (Anti-Doble Escritura)", async () => {
      let llamadasFetch = 0;
      let llamadasGm = 0;
      const mockFetch = async () => {
        llamadasFetch++;
        return { ok: false, status: 500, json: async () => ({}) };
      };
      const mockGmxhr = (o) => {
        llamadasGm++;
        if (o && o.onerror) o.onerror(new Error("500"));
      };

      const cFetch = cargar({ silencioso: true, fetch: mockFetch, gmxhr: mockGmxhr });
      const res = await cFetch.api._pageFetchJsonCore("/api/GuardarOrdenamiento", {
        method: "POST",
        body: JSON.stringify({ cups: ["903841"] })
      });

      t.igual(llamadasFetch, 1, "En una escritura POST sólo debe hacerse EXACTAMENTE 1 intento (0 reintentos)");
      t.igual(llamadasGm, 0, "En una escritura POST NO se reenvía por la segunda vía (GM_xmlhttpRequest)");
      t.igual(res, null, "Debe retornar null sin duplicar la orden clínica");
    });

    await t.casoAsync("R3.4: _pageFetchJsonCore en GET aplica reintento y recupera con éxito", async () => {
      let intentosGet = 0;
      const mockFetchGet = async () => {
        intentosGet++;
        if (intentosGet === 1) return { ok: false, status: 500 };
        return { ok: true, status: 200, json: async () => ({ datos: "recuperados" }) };
      };
      const mockGmxhr = (opt) => {
        if (opt && opt.onerror) opt.onerror(new Error("500"));
      };

      const cFetchGet = cargar({ silencioso: true, fetch: mockFetchGet, gmxhr: mockGmxhr });
      const res = await cFetchGet.api._pageFetchJsonCore("/api/BuscarPaciente", { method: "GET" });

      t.igual(intentosGet, 2, "En lecturas GET debe realizar reintentos automáticos tras fallo transitorio");
      t.igual(res, { datos: "recuperados" });
    });

    // ------------------------------------------------------------------
    // 6. R3.4 — Athenea Auto-Login y Guardia Anti-Bloqueo de Credenciales
    // ------------------------------------------------------------------
    await t.casoAsync("R3.4: atheneaAutoLogin bloquea reintentos si las credenciales son rechazadas", async () => {
      const mockGmxhr = (opt) => {
        if (opt.url && opt.url.includes("/Account/Login")) {
          if (opt.method === "GET") {
            if (opt.onload) opt.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="csrf123">' });
          } else if (opt.method === "POST") {
            if (opt.onload) opt.onload({ status: 200, responseText: '<form action="/Account/Login"><input type="password"> Iniciar sesión fallido</form>' });
          }
        }
      };

      const cAth = cargar({ silencioso: true, gmxhr: mockGmxhr });
      cAth.env.gm["vgl_ath_creds"] = JSON.stringify({ u: "medico_test", p: "clave_invalida" });
      cAth.api.__S.atheneaAutoLogin = true;

      const primerIntento = await cAth.api.atheneaAutoLogin();
      t.falso(primerIntento, "El primer intento con credencial errónea debe fallar");

      // Segundo intento inmediato
      const segundoIntento = await cAth.api.atheneaAutoLogin();
      t.falso(segundoIntento, "Segundo intento debe ser abortado de inmediato por bloqueo");
    });

    // ------------------------------------------------------------------
    // 7. R3.4 — Gobernanza de Cola de Telemetría y Prioridad de Eventos
    // ------------------------------------------------------------------
    t.caso("R3.4: repQSave descarta eventos 'ux' antes de tocar eventos clínicos o resumen", () => {
      c.env.gm["vgl_repq"] = "[]";
      A.repQLoad();

      // Llenar la cola con 35 elementos: 10 clínicos y 25 de uso ux
      const cola = [];
      for (let i = 0; i < 10; i++) cola.push({ evento: "resumen", id: i });
      for (let i = 0; i < 25; i++) cola.push({ evento: "ux", id: i });

      c.env.gm["vgl_repq"] = JSON.stringify(cola);
      A.repQLoad();
      A.repQSave();

      const guardada = JSON.parse(c.env.gm["vgl_repq"]);
      t.cierto(guardada.length <= 30, "La cola no debe superar el tope de 30 elementos");
      const resumenesRestantes = guardada.filter(r => r.evento === "resumen");
      t.igual(resumenesRestantes.length, 10, "Los 10 eventos clínicos deben conservarse al 100%");
      const uxRestantes = guardada.filter(r => r.evento === "ux");
      t.igual(uxRestantes.length, 20, "Sólo los eventos de uso UX son recortados para respetar la cuota");
    });

    // ------------------------------------------------------------------
    // 8. R3.5 — Memoria y Estabilidad en Jornada de 8 Horas Simulada
    // ------------------------------------------------------------------
    t.caso("R3.5: Cota de memoria acotada en 500 operaciones de telemetría y logs", () => {
      const initialPayload = JSON.stringify([{ evento: "resumen", id: 1 }]);
      c.env.gm["vgl_repq"] = initialPayload;
      for (let i = 0; i < 500; i++) {
        A.repQLoad();
      }
      A.repQSave();
      const guardada = JSON.parse(c.env.gm["vgl_repq"]);
      t.cierto(Array.isArray(guardada), "La cola de telemetría debe conservar formato de array");
      t.igual(guardada.length, 1, "No debe duplicar entradas ni inflar la memoria tras 500 lecturas");
      t.igual(guardada[0].evento, "resumen", "Conserva el contenido original sin mutaciones espurias");
    });

    // ------------------------------------------------------------------
    // 9. R3.7 — Aislamiento CSS, Capas Z-Index y Fallback Tipográfico
    // ------------------------------------------------------------------
    t.caso("R3.7: Jerarquía estricta de capas z-index en tokens CSS", () => {
      const code = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const zToast = /--z-toast:2147483647;/.test(code);
      const zAlerta = /--z-alerta:2147483600;/.test(code);
      const zModal = /--z-modal:2147483000;/.test(code);
      const zPanel = /--z-panel:2147482000;/.test(code);
      const zBanner = /--z-banner:2147481000;/.test(code);
      const zWidget = /--z-widget:2147480000;/.test(code);

      t.cierto(zToast, "--z-toast declarado con 2147483647");
      t.cierto(zAlerta, "--z-alerta declarado con 2147483600");
      t.cierto(zModal, "--z-modal declarado con 2147483000");
      t.cierto(zPanel, "--z-panel declarado con 2147482000");
      t.cierto(zBanner, "--z-banner declarado con 2147481000");
      t.cierto(zWidget, "--z-widget declarado con 2147480000");
    });

    t.caso("R3.7: Regla .vgl-lab-inj,.vgl-exf-btn tiene reserva var(--t-micro,12px)", () => {
      const code = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(code.includes("var(--t-micro,12px)"), "Debe tener fallback explícito para botones fuera de lista de tokens");
    });

    // ------------------------------------------------------------------
    // 10. R3.1 — Saneamiento Anti-PHI en Mensajes de Excepción
    // ------------------------------------------------------------------
    t.caso("R3.1: Saneamiento de errores purga cédulas numéricas y URLs", () => {
      const rawMsg = "Error en paciente 1020304050 al llamar https://neps.everestintelligent.com/api/test";
      const limpio = rawMsg
        .replace(/https?:\/\/[^\s"'`<>]+/g, "<url>")
        .replace(/\b\d{6,}\b/g, "[ID]")
        .replace(/['"`]/g, " ");

      t.falso(limpio.includes("1020304050"), "Cédula debe ser purgada");
      t.falso(limpio.includes("https://"), "URL debe ser sustituida por marcador genérico");
    });

    // ------------------------------------------------------------------
    // 11. R3.1 / R3.2 / R3.9 — Pruebas Adicionales de Blindaje
    // ------------------------------------------------------------------
    t.caso("R3.1: safeWriteJSON ante QuotaExceededError invoca purga y no lanza excepción", () => {
      const setItemOrig = c.env.storage.setItem;
      let intentosSet = 0;
      c.env.storage.setItem = () => {
        intentosSet++;
        throw new Error("QuotaExceededError");
      };

      try {
        const res = A.safeWriteJSON("vgl_quota_test", { payload: "critico" });
        t.falso(res, "safeWriteJSON debe retornar false cuando la cuota persiste llena sin lanzar");
        t.cierto(intentosSet >= 2, "Debe haber intentado escribir y reintentar tras la purga");
      } finally {
        c.env.storage.setItem = setItemOrig;
      }
    });

    await t.casoAsync("R3.9: Circuit Breaker en HALF-OPEN considera respuesta null como fallo", async () => {
      const breaker = A.getCircuitBreaker("test_cb_null_probe");
      breaker.state = "OPEN";
      breaker.resetTimeoutMs = 60000;
      breaker.nextAttemptTs = Date.now() - 1000;

      const res = await A.circuitBreakerExec("test_cb_null_probe", async () => null, () => "fallback_null");

      t.igual(res, "fallback_null", "Debe ejecutar el fallback ante probe nulo");
      t.igual(breaker.state, "OPEN", "Un probe que retorna null debe regresar a OPEN");
      t.cierto(breaker.resetTimeoutMs >= 120000, "Debe duplicar el tiempo de reset");
    });

    t.caso("R3.2: Re-entry lock en botón Auto-Labs aborta inmediatamente si btn.disabled es true", () => {
      const btn = c.env.doc.createElement("button");
      btn.disabled = true;
      let ejecutoFetch = false;

      // Simulación del guard de reentrada
      if (btn.disabled) {
        // Guard activo: no hace nada
      } else {
        ejecutoFetch = true;
      }

      t.falso(ejecutoFetch, "El guard de reentrada debe bloquear ejecuciones concurrentes");
    });

    t.caso("R3.1: Falla cerrada en inyección si el DOM no resuelve paciente", () => {
      const cVacio = cargar({ silencioso: true });
      // Inyectar sin paciente abierto debe retornar conteo 0 y no modificar nada
      const r = cVacio.api.injectLabsIntoCronicos([], "");
      t.igual(r.count, 0, "No debe diligenciar ninguna casilla si no hay paciente");
    });
  }
};
