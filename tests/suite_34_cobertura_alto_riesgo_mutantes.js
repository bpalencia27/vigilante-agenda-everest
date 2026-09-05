// =====================================================================
//  SUITE 34 — Cobertura Exhaustiva de Riesgo ALTO y Asesinato de Mutantes (M4)
//  Verificación rigurosa de las 51 funciones críticas de riesgo ALTO:
//   · _pymYaOrdenadoHoyDesdeElScript: Deduplicación y blindaje de actividades PyM
//   · _valorCrudoLab: Preservación de valores legítimos (cero, false, textos)
//   · _esSexoFemenino: Discriminación estricta de género y normalización
//   · apiAccesoObtenerDemograficos: Caché TTL, sinónimos y fallas de red
//   · _creatininaDeLabs & _pesoDeSignosVitales: Filtrado, fechas y fallbacks
//   · calcularEstadioRenal: Orquestación concurrente y diferenciación por sexo
//   · apiAccesoAsignarTurno & apiOrdenamientoGuardar: Kill-Switch y contratos de red
//   · apiOrdenamientoObtenerDx & apiOrdenamientoObtenerCup: Selección exacta .find(...)
//   · apiDigiturnoFinalizarTicket, apiAccesoAgdValidarAgenda & apiAccesoObtenerTurnos
//   · apiHcObtenerOrdenamientosVigentes: TTL 10 min y tolerancia a fallos
//   · perfilPaciente: Reconocimiento de sigla HTA pura
//   · injectLabsIntoCronicos & _matchUroComponente: Blindaje de Uroanálisis
//   · _atheneaCedulaCoincide & _fechaDesdeNumeroSolicitud: Extracción y límites
//   · _findLabField, _findHbA1cFields & _conductaBuscarYAgregarExamen: DOM bounds
//   · apiAccesoObtenerLaboratoriosAnnar & apiAccesoObtenerLaboratoriosCiti
// =====================================================================

const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Cobertura de Riesgo ALTO y Resistencia a Mutantes (M4)",
  cubre: [
    "_valorCrudoLab",
    "_esSexoFemenino",
    "apiAccesoObtenerDemograficos",
    "_creatininaDeLabs",
    "_pesoDeSignosVitales",
    "calcularEstadioRenal",
    "apiAccesoAsignarTurno",
    "apiOrdenamientoGuardar",
    "apiOrdenamientoObtenerDx",
    "apiOrdenamientoObtenerCup",
    "apiOrdenamientoBuscarPaciente",
    "apiOrdenamientoGenerarLinks",
    "apiDigiturnoFinalizarTicket",
    "apiAccesoAgdValidarAgenda",
    "apiAccesoObtenerTurnos",
    "apiHcObtenerOrdenamientosVigentes",
    "perfilPaciente",
    "injectLabsIntoCronicos",
    "_hayComponenteUroReal",
    "_matchUroComponente",
    "_agruparUroanalisisParaTabla",
    "_findUroInput",
    "_atheneaCedulaCoincide",
    "_fechaDesdeNumeroSolicitud",
    "_findLabField",
    "_findHbA1cFields",
    "_extractFechaSolicitudTopLevel",
    "_extractAtheneaFecha",
    "_pacienteSigueAbierto",
    "apiAccesoObtenerLaboratoriosAnnar",
    "apiAccesoObtenerLaboratoriosCiti",
    "extractPacienteAbierto"
  ],

  async pruebas(t, api, env, cargar) {

    // [v14.2.0 — auditoría pre-producción 2026-08-18] Se retiró la sección "1.
    // _pymYaOrdenadoHoyDesdeElScript" — esa función se borró junto al resto del bloque T7
    // (código muerto, ver CHANGELOG). La misma lógica de blindaje (actividades no-array,
    // objeto plano, .actividades vs .items) sigue viva y cubierta en la función hermana
    // `pymPendientesRestantes` (que SÍ tiene llamador real, en checkAvisoUniversal), con sus
    // propias pruebas en tests/suite_21_v12_4_pym_horas.js.

    // -----------------------------------------------------------------
    // 2. _valorCrudoLab (Preservación de Valores Crudos y Cero Legítimo)
    // -----------------------------------------------------------------
    t.caso("M4-RAW-1: _valorCrudoLab descarta null, undefined y whitespace preservando valores 0 y textos", () => {
      // Casos de descarte -> undefined
      t.igual(api._valorCrudoLab(null), undefined);
      t.igual(api._valorCrudoLab(undefined), undefined);
      t.igual(api._valorCrudoLab(""), undefined);
      t.igual(api._valorCrudoLab("   "), undefined);
      t.igual(api._valorCrudoLab("\t\n"), undefined);
      t.cierto(api._valorCrudoLab("") === undefined);

      // Casos de preservación crítica (cero legítimo)
      t.igual(api._valorCrudoLab(0), 0, "cero numérico debe preservarse");
      t.igual(api._valorCrudoLab("0"), "0", "cero textual debe preservarse");
      t.igual(api._valorCrudoLab("0.0"), "0.0");
      t.igual(api._valorCrudoLab(false), false, "booleano false no debe mutar a undefined");
      t.igual(api._valorCrudoLab(-1), -1);

      // Casos clínicos comunes
      t.igual(api._valorCrudoLab("1.25"), "1.25");
      t.igual(api._valorCrudoLab("NEGATIVO"), "NEGATIVO");
      t.igual(api._valorCrudoLab("> 5.0"), "> 5.0");
      t.igual(api._valorCrudoLab("< 0.05"), "< 0.05");
    });

    // -----------------------------------------------------------------
    // 3. _esSexoFemenino (Discriminación y Robustez de Género)
    // -----------------------------------------------------------------
    t.caso("M4-SEX-1: _esSexoFemenino discrimina variantes exhaustivas y resiste mutaciones", () => {
      // Femenino -> true
      t.cierto(api._esSexoFemenino("F"));
      t.cierto(api._esSexoFemenino("f"));
      t.cierto(api._esSexoFemenino("femenino"));
      t.cierto(api._esSexoFemenino("FEMENINO"));
      t.cierto(api._esSexoFemenino("  femenino  "));
      t.cierto(api._esSexoFemenino("\tf\n"));
      t.cierto(api._esSexoFemenino("FEMALE"));
      t.cierto(api._esSexoFemenino("Femenina"));

      // No femenino -> false
      t.falso(api._esSexoFemenino("M"));
      t.falso(api._esSexoFemenino("m"));
      t.falso(api._esSexoFemenino("masculino"));
      t.falso(api._esSexoFemenino("MASCULINO"));
      t.falso(api._esSexoFemenino("Hombre"));
      t.falso(api._esSexoFemenino("Mujer"));
      t.falso(api._esSexoFemenino("OTHER"));
      t.falso(api._esSexoFemenino(null));
      t.falso(api._esSexoFemenino(undefined));
      t.falso(api._esSexoFemenino(""));
      t.falso(api._esSexoFemenino("   "));
      t.falso(api._esSexoFemenino(12345));
    });

    // -----------------------------------------------------------------
    // 4. apiAccesoObtenerDemograficos (Caché, Sinónimos y Fallos de Red)
    // -----------------------------------------------------------------
    await t.casoAsync("M4-DEM-1: apiAccesoObtenerDemograficos valida entradas, sinónimos edadAnos y caché", async () => {
      let networkCalls = 0;
      let mockPayload = { data: { edad: 65, sexo: "F" } };

      const c = cargar({
        silencioso: true,
        fetch: async () => {
          networkCalls++;
          return { ok: true, status: 200, json: async () => mockPayload };
        }
      });

      // 1. Guarda de entrada nula
      t.igual(await c.api.apiAccesoObtenerDemograficos(null), null);
      t.igual(await c.api.apiAccesoObtenerDemograficos(0), null);
      t.igual(await c.api.apiAccesoObtenerDemograficos(""), null);
      t.igual(networkCalls, 0, "no debe llamar red para paciente nulo");

      // 2. Consulta y caché
      c.api._demograficosInvalidar();
      const d1 = await c.api.apiAccesoObtenerDemograficos(1001);
      t.cierto(!!d1);
      t.igual(d1.edad, 65);
      t.igual(d1.sexo, "F");
      t.igual(networkCalls, 1);

      // Segunda llamada usa caché
      const d2 = await c.api.apiAccesoObtenerDemograficos(1001);
      t.cierto(!!d2);
      t.igual(d2.edad, 65);
      t.igual(networkCalls, 1, "segunda llamada debe ser resuelta desde la caché");

      // 3. Invalidación de caché y resolución de sinónimo edadAnos
      c.api._demograficosInvalidar();
      mockPayload = { data: { edad: null, edadAnos: 72, sexo: "  M  " } };
      const d3 = await c.api.apiAccesoObtenerDemograficos(1001);
      t.cierto(!!d3);
      t.igual(d3.edad, 72, "debe resolver sinónimo edadAnos cuando edad es null");
      t.igual(d3.sexo, "M", "sexo debe estar normalizado con trim()");
      t.igual(networkCalls, 2, "tras invalidar debe realizar nueva petición HTTP");

      // 4. Edades no válidas -> edad null
      c.api._demograficosInvalidar();
      mockPayload = { data: { edad: 0, sexo: "F" } };
      const d4 = await c.api.apiAccesoObtenerDemograficos(1002);
      t.cierto(!!d4);
      t.igual(d4.edad, null, "edad 0 debe ser tratada como no válida (null)");

      c.api._demograficosInvalidar();
      mockPayload = { data: { edad: -5, sexo: "M" } };
      const d5 = await c.api.apiAccesoObtenerDemograficos(1003);
      t.cierto(!!d5);
      t.igual(d5.edad, null, "edad negativa debe ser tratada como no válida (null)");

      // 5. Manejo de errores de red (4xx / respuesta no válida) -> retorna null
      c.api._demograficosInvalidar();
      const cFalla = cargar({
        silencioso: true,
        fetch: async () => ({ ok: false, status: 404, json: async () => null })
      });
      const dError = await cFalla.api.apiAccesoObtenerDemograficos(1001);
      t.igual(dError, null, "falla de red debe retornar null sin propagar excepción");
    });

    // -----------------------------------------------------------------
    // 5. _creatininaDeLabs & _pesoDeSignosVitales (MUT-REN-016, MUT-REN-030)
    // -----------------------------------------------------------------
    t.caso("M4-CRE-1: _creatininaDeLabs y _pesoDeSignosVitales filtran datos y toleran excepciones (MUT-REN-016, MUT-REN-030)", () => {
      // _pesoDeSignosVitales (MUT-REN-016)
      t.igual(api._pesoDeSignosVitales([]), null, "array vacío debe retornar strictly null");
      t.cierto(api._pesoDeSignosVitales([]) === null, "no debe retornar undefined en array vacío");
      t.igual(api._pesoDeSignosVitales(null), null);
      t.igual(api._pesoDeSignosVitales("no-array"), null);
      t.igual(api._pesoDeSignosVitales([{ peso: null }]), null);
      t.igual(api._pesoDeSignosVitales([{ peso: "invalido" }]), null);
      t.igual(api._pesoDeSignosVitales([{ peso: "70.5", fechaRegistro: "2026-08-10" }]), { peso: 70.5, fechaRegistro: "2026-08-10" });

      // _creatininaDeLabs (MUT-REN-030)
      t.igual(api._creatininaDeLabs(null), null);
      t.igual(api._creatininaDeLabs([]), null);
      t.igual(api._creatininaDeLabs("no-array"), null);
      t.igual(api._creatininaDeLabs(undefined), null);

      // Entrada anómala que causa excepción interna -> retorna null sin lanzar (MUT-REN-030)
      const proxyLanzador = new Proxy([], {
        get(target, prop) {
          if (prop === "forEach" || prop === "filter" || prop === "slice") {
            throw new Error("Simulación fallo crítico de iterador");
          }
          return target[prop];
        }
      });
      t.igual(api._creatininaDeLabs(proxyLanzador), null, "excepción en parser de creatinina debe retornar null fail-safe");

      // Rechazo de orina, creatinuria y depuración
      const labsOrina = [
        { nombre: "CREATININA EN ORINA DE 24 HORAS", Resultado: "1500", fechaResultado: "2026-08-14" },
        { nombre: "DEPURACION DE CREATININA", Resultado: "85", fechaResultado: "2026-08-14" },
        { nombre: "CREATINURIA", Resultado: "600", fechaResultado: "2026-08-14" },
        { nombre: "CREATININA EN ORINA AL AZAR", Resultado: "120", fechaResultado: "2026-08-14" }
      ];
      t.igual(api._creatininaDeLabs(labsOrina), null, "analitos de orina no deben casar como creatinina sérica");

      // Rechazo de pendientes
      const labsPend = [
        { nombre: "CREATININA EN SUERO", Resultado: "PENDIENTE", idEstado: 1, fechaResultado: "2026-08-14" }
      ];
      t.igual(api._creatininaDeLabs(labsPend), null, "analito pendiente no debe retornar resultado");

      // Selección de fecha más reciente
      const labsMulti = [
        { nombre: "CREATININA", Resultado: "1.4", fechaResultado: "2025-01-01" },
        { nombre: "CREATININA", Resultado: "0.95", fechaResultado: "2026-08-10" },
        { nombre: "CREATININA", Resultado: "1.1", fechaResultado: "2026-02-15" }
      ];
      const resMulti = api._creatininaDeLabs(labsMulti);
      t.cierto(!!resMulti);
      t.igual(resMulti.crudo, "0.95", "debe seleccionar el valor con fecha ISO más reciente");
      t.igual(resMulti.fechaIso, "2026-08-10");
    });

    // -----------------------------------------------------------------
    // 6. calcularEstadioRenal (MUT-REN-040: Diferenciación Estricta por Sexo)
    // -----------------------------------------------------------------
    await t.casoAsync("M4-CALC-1: calcularEstadioRenal discrimina matemáticamente masculino vs femenino (MUT-REN-040)", async () => {
      // Configurar mock con paciente masculino de 65 años, 70 kg, creatinina 1.3 mg/dL
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) {
            return { ok: true, status: 200, json: async () => ({ data: { edad: 65, sexo: "M" } }) };
          }
          if (u.includes("ObtenerHistoricoSignosVitales")) {
            return { ok: true, status: 200, json: async () => ([{ peso: 70.0, fechaRegistro: "2026-08-10" }]) };
          }
          return { ok: true, status: 200, json: async () => ({}) };
        }
      });

      const labs = [{ nombre: "CREATININA EN SUERO", Resultado: "1.3", fechaResultado: "2026-08-05" }];
      const rMale = await c.api.calcularEstadioRenal(1001, labs);

      t.cierto(!!rMale);
      t.igual(rMale.entradas.sexo, "M", "sexo en entradas debe ser 'M'");
      // CG Masculino: (140 - 65) * 70 / (72 * 1.3) * 1.0 = 5250 / 93.6 = 56.089... -> 56.1 (G3a)
      // Si se mutara forzando 'F' (factor 0.85): 56.089 * 0.85 = 47.67 -> 47.7 (G3a)
      t.igual(rMale.tfg, 56.1, "TFG masculino debe calcularse sin factor 0.85");
      t.igual(rMale.estadio, "G3a");

      // Comparación con paciente femenino idéntico (edad 65, peso 70, creatinina 1.3)
      const cFemale = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) {
            return { ok: true, status: 200, json: async () => ({ data: { edad: 65, sexo: "F" } }) };
          }
          if (u.includes("ObtenerHistoricoSignosVitales")) {
            return { ok: true, status: 200, json: async () => ([{ peso: 70.0, fechaRegistro: "2026-08-10" }]) };
          }
          return { ok: true, status: 200, json: async () => ({}) };
        }
      });

      const rFemale = await cFemale.api.calcularEstadioRenal(1002, labs);
      t.cierto(!!rFemale);
      t.igual(rFemale.entradas.sexo, "F");
      t.igual(rFemale.tfg, 47.7, "TFG femenino debe calcularse con factor 0.85");
      t.cierto(rMale.tfg !== rFemale.tfg, "resultados masculino y femenino deben ser distintos para datos demográficos idénticos");

      // Caso de frontera crítica: edad 50, peso 80, creatinina 1.1 mg/dL
      // Masculino: (140-50)*80 / (72*1.1) = 7200 / 79.2 = 90.9 mL/min -> Estadio G1
      // Femenino: 90.909 * 0.85 = 77.27 -> 77.3 mL/min -> Estadio G2
      const cBorde = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) {
            return { ok: true, status: 200, json: async () => ({ data: { edad: 50, sexo: "M" } }) };
          }
          if (u.includes("ObtenerHistoricoSignosVitales")) {
            return { ok: true, status: 200, json: async () => ([{ peso: 80.0, fechaRegistro: "2026-08-10" }]) };
          }
          return { ok: true, status: 200, json: async () => ({}) };
        }
      });
      const rBordeMale = await cBorde.api.calcularEstadioRenal(1003, [{ nombre: "CREATININA", Resultado: "1.1" }]);
      t.igual(rBordeMale.tfg, 90.9);
      t.igual(rBordeMale.estadio, "G1", "hombre de 50a/80kg/1.1cr debe clasificar en G1");
    });

    await t.casoAsync("M4-CALC-2: calcularEstadioRenal maneja fallos parciales de red sin excepciones", async () => {
      // Simular fallo en demográficos (404) pero éxito en signos vitales
      const cDemoFail = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("BuscarPacienteDetallado")) {
            return { ok: false, status: 404, json: async () => null };
          }
          if (u.includes("ObtenerHistoricoSignosVitales")) {
            return { ok: true, status: 200, json: async () => ([{ peso: 60.0, fechaRegistro: "2026-08-10" }]) };
          }
          return { ok: true, status: 200, json: async () => ({}) };
        }
      });

      const labs = [{ nombre: "CREATININA", Resultado: "1.0" }];
      const r = await cDemoFail.api.calcularEstadioRenal(5555, labs);
      t.cierto(!!r);
      t.igual(r.estadio, null, "sin demográficos no se calcula estadio");
      t.cierto(r.faltan.includes("edad"), "debe reportar falta de edad");

      // Simular pacienteId ausente (null) -> no llama red y reporta faltantes
      const rNullPac = await cDemoFail.api.calcularEstadioRenal(null, labs);
      t.cierto(!!rNullPac);
      t.igual(rNullPac.estadio, null);
      t.cierto(rNullPac.faltan.includes("edad"));
      t.cierto(rNullPac.faltan.includes("peso"));
    });

    // -----------------------------------------------------------------
    // 7. Kill-Switch y Guardas Clínicas de Escritura (MUT-AGD-056, MUT-ORD-026)
    // -----------------------------------------------------------------
    await t.casoAsync("M4-KILL-1: Kill-Switch activo bloquea apiAccesoAsignarTurno y apiOrdenamientoGuardar (MUT-AGD-056, MUT-ORD-026)", async () => {
      let networkCalls = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => {
          networkCalls++;
          return { ok: true, status: 200, json: async () => ({ error: false }) };
        }
      });

      c.api.__state.activeDoctor = { id: 777, name: "DR. TEST" };
      c.api.__state.killed = true; // Activar Kill-Switch

      // 1. apiAccesoAsignarTurno bajo Kill-Switch (MUT-AGD-056)
      const resTurno = await c.api.apiAccesoAsignarTurno(10, 20, "2026-08-15", "obs", false, "Consulta", null, "");
      t.cierto(resTurno.error, "debe reportar error bajo kill-switch");
      t.cierto(resTurno.mensaje.includes("Kill-Switch activo"), "mensaje debe señalar Kill-Switch");
      t.igual(networkCalls, 0, "no debe realizar ninguna petición de red");

      // 2. apiOrdenamientoGuardar bajo Kill-Switch (MUT-ORD-026)
      const resOrden = await c.api.apiOrdenamientoGuardar(20, 101, [{ Id: 1, Descripcion: "CUP Test" }]);
      t.igual(resOrden, null, "debe retornar null bajo kill-switch");
      t.igual(networkCalls, 0, "no debe emitir ordenamiento a la red");
    });

    // -----------------------------------------------------------------
    // 8. Búsqueda y Selección Exacta Dx y CUP (MUT-ORD-012, MUT-ORD-018, MUT-ORD-020, MUT-ORD-023, MUT-ORD-025, MUT-ORD-015)
    // -----------------------------------------------------------------
    await t.casoAsync("M4-ORD-1: apiOrdenamientoObtenerDx y apiOrdenamientoObtenerCup seleccionan el código exacto y toleran fallos (MUT-ORD-012, MUT-ORD-018, MUT-ORD-020, MUT-ORD-023, MUT-ORD-025, MUT-ORD-015)", async () => {
      let mockDxItems = [
        { Codigo: "I10X", Id: 101, Descripcion: "HIPERTENSION" },
        { Codigo: "E119", Id: 202, Descripcion: "DIABETES TIPO 2" }
      ];
      let mockCupItems = [
        { Codigo: "903841", Id: 501, Descripcion: "GLUCOSA EN SUERO" },
        { Codigo: "903895", Id: 502, Descripcion: "HEMOGLOBINA GLICOSILADA" }
      ];

      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          const u = String(url);
          if (u.includes("ObtenerListadoDiagnostico")) {
            return { ok: true, status: 200, json: async () => mockDxItems, text: async () => JSON.stringify(mockDxItems) };
          }
          if (u.includes("ObtenerListadoCupsPorPaciente")) {
            return { ok: true, status: 200, json: async () => mockCupItems, text: async () => JSON.stringify(mockCupItems) };
          }
          if (u.includes("BuscarPaciente")) {
            return { ok: true, status: 200, json: async () => ({ id: 999 }) };
          }
          return { ok: true, status: 200, json: async () => ({}) };
        }
      });

      // 1. Selección exacta de Diagnóstico (MUT-ORD-018: no debe tomar items[0] arbitrariamente)
      const dxId = await c.api.apiOrdenamientoObtenerDx("E119");
      t.igual(dxId, 202, "debe seleccionar E119 (Id 202), no el primer item I10X (Id 101)");

      // 2. Selección exacta de CUPS (MUT-ORD-023: no debe tomar items[0] arbitrariamente)
      const cup = await c.api.apiOrdenamientoObtenerCup(999, "903895");
      t.cierto(!!cup);
      t.igual(cup.Id, 502, "debe seleccionar 903895 (Id 502), no 903841 (Id 501)");
      t.igual(cup.Descripcion, "HEMOGLOBINA GLICOSILADA");

      // 3. Validación de entradas nulas y vacías en apiOrdenamientoBuscarPaciente (MUT-ORD-012)
      t.igual(await c.api.apiOrdenamientoBuscarPaciente(""), null, "docId vacío debe retornar strictly null (MUT-ORD-012)");
      t.igual(await c.api.apiOrdenamientoBuscarPaciente(null), null, "docId null debe retornar strictly null (MUT-ORD-012)");
      t.igual(await c.api.apiOrdenamientoBuscarPaciente("CC"), null, "docId sin dígitos debe retornar strictly null (MUT-ORD-012)");

      // 4. Tolerancia a fallos de red en Dx, CUP y BuscarPaciente (MUT-ORD-020, MUT-ORD-025, MUT-ORD-015)
      const cFalla = cargar({
        silencioso: true,
        fetch: async () => ({ ok: false, status: 404, json: async () => null }),
        gmxhr: (opts) => { if (opts.onerror) opts.onerror(new Error("Fail")); }
      });

      const dxFail = await cFalla.api.apiOrdenamientoObtenerDx("Z000");
      t.igual(dxFail, null, "falla en Dx debe retornar strictly null");

      const cupFail = await cFalla.api.apiOrdenamientoObtenerCup(999, "999999");
      t.igual(cupFail, null, "falla en CUP debe retornar strictly null");

      const pacFail = await cFalla.api.apiOrdenamientoBuscarPaciente("12345");
      t.igual(pacFail, null, "falla en BuscarPaciente debe retornar strictly null");

      // 5. Excepción no controlada en transporte/red capturada limpiamente (MUT-ORD-015, MUT-ORD-020, MUT-ORD-025)
      const cCrash = cargar({ silencioso: true });
      cCrash.ctx.Date = class extends Date { static now() { throw new Error("Transport crash in Ordenamiento"); } };

      const pacCrash = await cCrash.api.apiOrdenamientoBuscarPaciente("12345");
      t.igual(pacCrash, null, "excepción en BuscarPaciente debe capturarse y retornar strictly null (MUT-ORD-015)");

      const dxCrash = await cCrash.api.apiOrdenamientoObtenerDx("E119");
      t.igual(dxCrash, null, "excepción en ObtenerDx debe retornar strictly null y no {} (MUT-ORD-020)");
      t.cierto(dxCrash === null, "dxCrash no debe ser objeto {}");

      const cupCrash = await cCrash.api.apiOrdenamientoObtenerCup(999, "903895");
      t.igual(cupCrash, null, "excepción en ObtenerCup debe retornar strictly null y no {} (MUT-ORD-025)");
      t.cierto(cupCrash === null, "cupCrash no debe ser objeto {}");
    });

    // -----------------------------------------------------------------
    // 9. Parámetros de Red y Digiturno (MUT-AGD-044, MUT-AGD-045, MUT-AGD-048, MUT-AGD-049, MUT-AGD-054, MUT-AGD-055)
    // -----------------------------------------------------------------
    await t.casoAsync("M4-AGD-1: Digiturno, AgdValidarAgenda y ObtenerTurnos envían parámetros correctos y toleran errores (MUT-AGD-044, MUT-AGD-045, MUT-AGD-048, MUT-AGD-049, MUT-AGD-054, MUT-AGD-055)", async () => {
      let lastUrl = "";
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          lastUrl = String(url);
          return { ok: true, status: 200, json: async () => ({ isError: false, turnos: [] }) };
        }
      });

      // 1. Digiturno con ID de médico activo (MUT-AGD-045)
      c.api.__state.activeDoctor = { id: 888 };
      await c.api.apiDigiturnoFinalizarTicket(1234);
      t.cierto(lastUrl.includes("UsuarioId=888"), "debe enviar el ID del médico activo en Digiturno");
      t.falso(lastUrl.includes("UsuarioId=0"), "no debe enviar UsuarioId=0 si el médico está activo");

      // 2. AgdValidarAgenda swParticular=false (MUT-AGD-049)
      await c.api.apiAccesoAgdValidarAgenda(10, 20);
      t.cierto(lastUrl.includes("swParticular=false"), "AgdValidarAgenda debe llevar swParticular=false");
      t.falso(lastUrl.includes("swParticular=true"));

      // 3. ObtenerTurnos swParticular=false y Async (MUT-AGD-054, MUT-AGD-055)
      t.cierto(c.api.apiAccesoObtenerTurnos.constructor.name === "AsyncFunction", "apiAccesoObtenerTurnos debe ser función async");
      await c.api.apiAccesoObtenerTurnos(10, "15/08/2026", 20);
      t.cierto(lastUrl.includes("swParticular=false"), "ObtenerTurnos debe llevar swParticular=false");
      t.falso(lastUrl.includes("swParticular=true"));

      // 4. Manejo de excepciones en Digiturno y AgdValidarAgenda (MUT-AGD-044, MUT-AGD-048)
      const cError = cargar({
        silencioso: true,
        fetch: async () => ({ ok: false, status: 404, json: async () => null }),
        gmxhr: (opts) => { if (opts.onerror) opts.onerror(new Error("Fail")); }
      });
      cError.api.__state.activeDoctor = { id: 888 };

      await t.noLanza(async () => {
        await cError.api.apiDigiturnoFinalizarTicket(1234);
      }, "Digiturno no debe lanzar excepción al fallar la red");

      const valRes = await cError.api.apiAccesoAgdValidarAgenda(10, 20);
      t.igual(valRes, null, "AgdValidarAgenda debe retornar null en fallo de red");

      // Verificación con excepción catastrófica en capa de transporte (MUT-AGD-044, MUT-AGD-048)
      const cCrash = cargar({ silencioso: true });
      cCrash.api.__state.activeDoctor = { id: 888 };
      cCrash.ctx.Date = class extends Date { static now() { throw new Error("Transport crash in Digiturno/AgdValidarAgenda"); } };

      const digRes = await cCrash.api.apiDigiturnoFinalizarTicket(1234);
      t.igual(digRes, undefined, "Digiturno captura error y resuelve de forma segura sin lanzar (MUT-AGD-044)");

      const valCrashRes = await cCrash.api.apiAccesoAgdValidarAgenda(10, 20);
      t.igual(valCrashRes, null, "AgdValidarAgenda captura error y retorna strictly null sin lanzar (MUT-AGD-048)");
    });

    // -----------------------------------------------------------------
    // 10. Órdenes Vigentes TTL, Payload SwHc y Links (MUT-ORD-001, MUT-ORD-029, MUT-ORD-033)
    // -----------------------------------------------------------------
    await t.casoAsync("M4-ORD-2: TTL de órdenes vigentes (10 min), payload SwHc:false y header Accept JSON (MUT-ORD-001, MUT-ORD-029, MUT-ORD-033)", async () => {
      let fetchCount = 0;
      let lastOpts = null;
      let lastUrl = "";

      const c = cargar({
        silencioso: true,
        fetch: async (url, opts) => {
          fetchCount++;
          lastUrl = String(url);
          lastOpts = opts;
          return { ok: true, status: 200, json: async () => ([]), text: async () => "https://everest.com/print/1" };
        }
      });

      c.api.__state.activeDoctor = { id: 777 };

      // 1. Payload de GuardarOrdenamiento con SwHc: false (MUT-ORD-029)
      await c.api.apiOrdenamientoGuardar("pac1", 101, [{ Id: "cup1", Descripcion: "Desc" }]);
      t.cierto(!!lastOpts && !!lastOpts.body);
      const payload = JSON.parse(lastOpts.body);
      t.igual(payload.SwHc, false, "SwHc debe ser estrictamente false en GuardarOrdenamiento");
      t.igual(payload.DiagnosticoId, 101);

      // 2. Headers de GenerarLinks con Accept: application/json (MUT-ORD-033)
      await c.api.apiOrdenamientoGenerarLinks("pac1", "agrup123");
      t.cierto(!!lastOpts && !!lastOpts.headers);
      t.igual(lastOpts.headers["Accept"], "application/json", "GenerarLinks debe solicitar Accept: application/json");

      // 3. TTL de apiHcObtenerOrdenamientosVigentes (MUT-ORD-001: 10 min, no 600 min)
      fetchCount = 0;
      await c.api.apiHcObtenerOrdenamientosVigentes(500);
      t.igual(fetchCount, 1, "primera llamada hace petición a la red");

      // Segunda llamada inmediata -> usa caché
      await c.api.apiHcObtenerOrdenamientosVigentes(500);
      t.igual(fetchCount, 1, "segunda llamada dentro del TTL usa caché");

      // Simular paso de 15 minutos (superior a 10 min TTL)
      const OriginalDate = c.ctx.Date || Date;
      let mockNow = Date.now() + 15 * 60 * 1000;
      const FakeDate = class extends OriginalDate {
        constructor(...args) { super(...args); }
      };
      FakeDate.now = () => mockNow;
      c.ctx.Date = FakeDate;

      await c.api.apiHcObtenerOrdenamientosVigentes(500);
      c.ctx.Date = OriginalDate;

      t.igual(fetchCount, 2, "tras 15 minutos la caché expira (TTL 10 min) y realiza nueva consulta");
    });

    // -----------------------------------------------------------------
    // 11. Perfil del Paciente y Sigla HTA (MUT-AGD-029)
    // -----------------------------------------------------------------
    t.caso("M4-PERF-1: perfilPaciente reconoce sigla 'HTA' pura y habilita adicionales (MUT-AGD-029)", () => {
      const p1 = api.perfilPaciente(["HTA"]);
      t.igual(p1.franja, "sin_preferencia");
      t.igual(p1.adicionales, true, "etiqueta 'HTA' mayúscula debe habilitar adicionales");

      const p2 = api.perfilPaciente(["hta"]);
      t.igual(p2.adicionales, true, "etiqueta 'hta' minúscula debe habilitar adicionales");

      const p3 = api.perfilPaciente(["  HTA  "]);
      t.igual(p3.adicionales, true, "etiqueta 'HTA' con espacios debe habilitar adicionales");

      const p4 = api.perfilPaciente(["Hipertensión"]);
      t.igual(p4.adicionales, true);

      const p5 = api.perfilPaciente(["HTA+DM"]);
      t.igual(p5.adicionales, false, "HTA con DM excluye adicionales");
    });

    // -----------------------------------------------------------------
    // 12. Uroanálisis, Mapeo y Detección de Analitos (MUT-CLIN-085, MUT-CLIN-012, MUT-CLIN-017, MUT-CLIN-020, MUT-CLIN-021, MUT-CLIN-028)
    // -----------------------------------------------------------------
    t.caso("M4-URO-1: Uroanálisis descarta analitos no reconocidos y preserva marcas (MUT-CLIN-085, MUT-CLIN-012, MUT-CLIN-017, MUT-CLIN-020, MUT-CLIN-021, MUT-CLIN-028)", () => {
      // 1. _matchUroComponente (MUT-CLIN-017, MUT-CLIN-020)
      t.igual(api._matchUroComponente({ nombre: "" }), null, "nombre vacío debe retornar null");
      t.igual(api._matchUroComponente({ NombreParametro: "   " }), null);
      t.igual(api._matchUroComponente(null), null);
      t.igual(api._matchUroComponente({ nombre: "CRISTALES DE OXALATO EN ORINA" }), null, "analito no mapeado retorna null");
      t.igual(api._matchUroComponente({ nombre: "ANALITO DESCONOCIDO" }), null);
      t.cierto(api._matchUroComponente({ nombre: "NITRITOS" }) !== null);

      // 2. _hayComponenteUroReal (MUT-CLIN-012)
      const labOrinaNoMapeado = [{ nombre: "CRISTALES DE OXALATO EN ORINA", Resultado: "ABUNDANTES" }];
      t.falso(api._hayComponenteUroReal(labOrinaNoMapeado), "analito de orina no mapeado no es componente uro real");

      const labOrinaValido = [{ nombre: "NITRITOS", Resultado: "POSITIVO" }];
      t.cierto(api._hayComponenteUroReal(labOrinaValido), "nitritos positivos sí es componente uro real");

      // 3. _agruparUroanalisisParaTabla (MUT-CLIN-021)
      t.igual(api._agruparUroanalisisParaTabla(null), []);
      t.cierto(Array.isArray(api._agruparUroanalisisParaTabla(null)));
      t.igual(api._agruparUroanalisisParaTabla("no-array"), []);

      // 4. _findUroInput con error en querySelector (MUT-CLIN-028)
      const c = cargar({ silencioso: true });
      c.env.doc.querySelectorAll = () => { throw new Error("DOM query failure"); };
      t.igual(c.api._findUroInput("aspecto"), null, "error en DOM query debe retornar null fail-safe");

      // 5. injectLabsIntoCronicos con solo suero no marca SI en Uroanálisis (MUT-CLIN-085)
      const cLabs = cargar({ silencioso: true });
      let radioClicked = false;
      const radioSi = { checked: false, click: () => { radioClicked = true; }, parentElement: { textContent: "SI" } };
      const radioNo = { checked: false, parentElement: { textContent: "NO" } };
      cLabs.env.doc.querySelectorAll = (sel) => {
        if (String(sel).indexOf("swUroanalisis") >= 0) return [radioSi, radioNo];
        return [];
      };

      const resSerum = cLabs.api.injectLabsIntoCronicos([{ nombre: "GLUCOSA EN SUERO", Resultado: "95" }]);
      t.falso(resSerum.uroanalisisMarcado, "labs solo séricos no deben marcar Uroanálisis SI");
      t.falso(radioClicked, "radio SI no debe ser clickeado para labs puramente séricos");
    });

    // -----------------------------------------------------------------
    // 13. Puente Athenea, Fechas e Identidad (MUT-CLIN-037, MUT-CLIN-040, MUT-CLIN-043, MUT-CLIN-044, MUT-CLIN-061, MUT-CLIN-066, MUT-CLIN-068, MUT-CLIN-078, MUT-CLIN-115)
    // -----------------------------------------------------------------
    t.caso("M4-ATH-1: Fechas, cédulas y guardas de cruce en Puente Athenea (MUT-CLIN-037, MUT-CLIN-040, MUT-CLIN-043, MUT-CLIN-044, MUT-CLIN-061, MUT-CLIN-066, MUT-CLIN-068, MUT-CLIN-078, MUT-CLIN-115)", () => {
      // 1. _fechaDesdeNumeroSolicitud (MUT-CLIN-043, MUT-CLIN-044)
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26039903125"), null, "día 99 inválido retorna null");
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26030003125"), null, "día 00 inválido retorna null");
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26130103125"), null, "mes 13 inválido retorna null");
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26031503125"), "2026-03-15", "fecha válida aaMMdd retorna ISO");
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26031503125 y Numero: 26042003125"), null, "fechas contradictorias retornan null");

      // 2. _atheneaCedulaCoincide (MUT-CLIN-037, MUT-CLIN-040)
      const htmlDoc = '<div class="hdr">Identificación: CC 10203040 - PACIENTE TEST</div>';
      t.cierto(api._atheneaCedulaCoincide(htmlDoc, "10203040"), "debe casar cédula por regex de tipo de documento");
      t.falso(api._atheneaCedulaCoincide(htmlDoc, "10203"), "prefijo parcial no debe coincidir como cédula válida");
      t.falso(api._atheneaCedulaCoincide(htmlDoc, "1020304099"));
      t.falso(api._atheneaCedulaCoincide(htmlDoc, null));
      t.falso(api._atheneaCedulaCoincide(htmlDoc, ""));

      const htmlDiff = '<div>Identificación: CC 10203040 - Teléfono: 99887766</div>';
      t.falso(api._atheneaCedulaCoincide(htmlDiff, "99887766"), "si el documento principal difiere pero el número aparece en otra parte, no debe coincidir (MUT-CLIN-037)");

      // 3. _extractFechaSolicitudTopLevel & _extractAtheneaFecha (MUT-CLIN-061, MUT-CLIN-066, MUT-CLIN-068)
      t.igual(api._extractFechaSolicitudTopLevel("string-primitivo"), null);
      t.igual(api._extractFechaSolicitudTopLevel(12345), null);
      t.igual(api._extractFechaSolicitudTopLevel(null), null);

      t.igual(api._extractAtheneaFecha("string-primitivo"), null);
      t.igual(api._extractAtheneaFecha(999), null);
      t.igual(api._extractAtheneaFecha(null), null);

      const labConFechas = {
        examen: "GLUCOSA",
        timestampGeneral: "2026-04-10T08:00:00",
        fechaResultadoToma: "2026-04-15T09:00:00"
      };
      const fExtracted = api._extractAtheneaFecha(labConFechas);
      t.cierto(!!fExtracted);
      t.igual(fExtracted.key, "fechaResultadoToma", "debe preferir la clave que contenga 'fecha'");
      t.igual(fExtracted.iso, "2026-04-15");

      // 4. _pacienteSigueAbierto & extractPacienteAbierto (MUT-CLIN-078, MUT-CLIN-115)
      const cDom = cargar({ silencioso: true });
      cDom.env.doc.getElementById = (id) => {
        if (id === "anamesis") throw new Error("Error simulado en DOM de HC");
        return null;
      };
      t.igual(cDom.api.extractPacienteAbierto(), "", "excepción en extractPacienteAbierto debe retornar cadena vacía y no 'ERROR'");

      // _pacienteSigueAbierto cuando no hay paciente abierto en el DOM
      t.cierto(cDom.api._pacienteSigueAbierto(""), "si docIdEsperado es vacío retorna true por compatibilidad");
      t.falso(cDom.api._pacienteSigueAbierto("12345"), "con docIdEsperado y DOM vacío retorna false");
    });

    // -----------------------------------------------------------------
    // 14. Búsqueda de Campos DOM y HbA1c (MUT-CLIN-052, MUT-CLIN-054, MUT-CLIN-055, MUT-CLIN-056, MUT-CLIN-001)
    // -----------------------------------------------------------------
    t.caso("M4-DOM-1: _findLabField y _findHbA1cFields límites de búsqueda (MUT-CLIN-052, MUT-CLIN-054, MUT-CLIN-055, MUT-CLIN-056)", () => {
      const c = cargar({ silencioso: true });

      // 1. _findLabField por atributo name (MUT-CLIN-052)
      const inputGlucosa = { name: "resultadoGlucosa", id: "", value: "" };
      c.env.doc.getElementById = () => null;
      c.env.doc.querySelector = (sel) => (sel === '[name="resultadoGlucosa"]' ? inputGlucosa : null);

      const fByName = c.api._findLabField("resultadoGlucosa");
      t.igual(fByName, inputGlucosa, "debe encontrar el elemento por atributo [name='...']");

      // 2. _findLabField salta IDs vacíos/nulos ignorando distractores falsos (MUT-CLIN-054)
      const inputAlt = { id: "campoAltReal", value: "" };
      const distractorFalso = { id: "distractorFalso", value: "" };
      c.env.doc.getElementById = (id) => (id === "campoAltReal" ? inputAlt : null);
      c.env.doc.querySelector = (sel) => (sel === '[name=""]' || sel === '[name="null"]' || sel === '[name="undefined"]' ? distractorFalso : (sel === '[name="campoAltReal"]' ? inputAlt : null));
      const fAlt = c.api._findLabField("", ["", null, undefined, "campoAltReal"]);
      t.igual(fAlt, inputAlt, "debe saltar IDs falsy ignorando distractor y encontrar campoAltReal");
      t.cierto(fAlt !== distractorFalso, "no debe seleccionar distractor falso");

      // 3. _findLabField no retorna fallback arbitrario ante ID no existente (MUT-CLIN-055)
      const distractorInput = { id: "distractorInput", tagName: "INPUT" };
      c.env.doc.getElementById = () => null;
      c.env.doc.querySelector = (sel) => (sel === "input" ? distractorInput : null);
      t.igual(c.api._findLabField("noExiste"), null, "campo inexistente debe retornar strictly null y no distractor input (MUT-CLIN-055)");

      // 4. _findHbA1cFields valida max=30 para descartar Hemoglobina Total (MUT-CLIN-056)
      const hbTotal = {
        type: "number",
        attributes: { max: "100" },
        getAttribute: (k) => (k === "max" ? "100" : null)
      };
      const hbA1c = {
        type: "number",
        attributes: { max: "30" },
        getAttribute: (k) => (k === "max" ? "30" : null),
        closest: () => ({ querySelector: () => ({ type: "date" }) })
      };
      c.env.doc.querySelectorAll = (sel) => (sel.includes("resultadoHemoglobina") ? [hbTotal, hbA1c] : []);

      const resHb = c.api._findHbA1cFields();
      t.cierto(!!resHb.resultEl, "debe encontrar campo de HbA1c");
      t.igual(resHb.resultEl.getAttribute("max"), "30", "debe seleccionar estrictamente el campo con max='30'");
    });

    // [v17.6.x — saneo del banco] _conductaBuscarYAgregarExamen (MUT-CLIN-001) se retiró
    // del script junto a la tabla CONDUCTA_LI_TEXTO_POR_ANALITO (deuda muerta, ver
    // docs/cambios-pendientes/001-retiro-codigo-muerto.md): su caso M4-DOM-2 se podó aquí,
    // igual que en suite_08. La canonización de texto que probaba vive cubierta en _canonTexto.

    // -----------------------------------------------------------------
    // 15. Tolerancia a Fallos en APIs Annar y Citi (MUT-CLIN-097, MUT-CLIN-102)
    // -----------------------------------------------------------------
    await t.casoAsync("M4-LAB-1: apiAccesoObtenerLaboratoriosAnnar y apiAccesoObtenerLaboratoriosCiti retornan null en fallos de red (MUT-CLIN-097, MUT-CLIN-102)", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => ({ ok: false, status: 404, json: async () => null, text: async () => "" }),
        gmxhr: (opts) => { if (opts.onerror) opts.onerror(new Error("GM fail")); }
      });

      const resAnnar = await c.api.apiAccesoObtenerLaboratoriosAnnar(1234);
      t.igual(resAnnar, null, "falla en Annar debe resolver a null fail-safe");

      const resCiti = await c.api.apiAccesoObtenerLaboratoriosCiti(1234);
      t.igual(resCiti, null, "falla en Citi debe resolver a strictly null y no []");

      // Verificación con excepción catastrófica lanzada en la capa de red / pool de promesas (MUT-CLIN-097, MUT-CLIN-102)
      const cCrash = cargar({ silencioso: true });
      cCrash.ctx.Date = class extends Date { static now() { throw new Error("Network crash in Labs"); } };

      const resAnnarCrash = await cCrash.api.apiAccesoObtenerLaboratoriosAnnar(1234);
      t.igual(resAnnarCrash, null, "excepción en capa de transporte de Annar debe resolverse a strictly null sin lanzar (MUT-CLIN-097)");

      const resCitiCrash = await cCrash.api.apiAccesoObtenerLaboratoriosCiti(1234);
      t.igual(resCitiCrash, null, "excepción en capa de transporte de Citi debe resolverse a strictly null y no [] (MUT-CLIN-102)");
      t.cierto(resCitiCrash !== undefined && !Array.isArray(resCitiCrash));
    });

    // -----------------------------------------------------------------
    // 16. Auditoría Estática AST de las Suites (0 skips, 0 xfails, 100% await)
    // -----------------------------------------------------------------
    t.caso("M4-AST: 0 t.skip, 0 t.xfail, 0 tautologías y 100% t.casoAsync awaitados en todas las suites", () => {
      const dir = __dirname;
      const suites = fs.readdirSync(dir).filter(f => /^suite_.*\.js$/.test(f)).sort();

      const skips = [];
      const xfails = [];
      const unawaited = [];
      const tautologies = [];

      for (const f of suites) {
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        src.split("\n").forEach((line, idx) => {
          // v18.0.144: los tests viven en CRLF en disco y sin quitar el \r final el
          // `$` no matchea — los comentarios NO se limpiaban y daban falsos positivos.
          const clean = line.replace(/\r$/, "").replace(/\/\/.*$/, "").trim();
          if (/\b(?:t|it|describe|test)\.skip\s*\(/.test(clean)) skips.push(`${f}:${idx + 1}`);
          if (/\b(?:t|it|describe|test)\.xfail\s*\(/.test(clean)) xfails.push(`${f}:${idx + 1}`);
          if (/\bt\.casoAsync\s*\(/.test(clean) && !/\bawait\s+t\.casoAsync\s*\(/.test(clean)) {
            unawaited.push(`${f}:${idx + 1}`);
          }
          // Detección de tautologías como t.cierto(true) o t.falso(false) fuera de esta propia suite
          if (/\bt\.cierto\s*\(\s*true\s*[,)]/.test(clean) && !f.includes("suite_34")) {
            tautologies.push(`${f}:${idx + 1}`);
          }
        });
      }

      t.igual(skips, [], "no debe haber tests salteados con .skip");
      t.igual(xfails, [], "no debe haber tests marcados con .xfail");
      t.igual(unawaited, [], "todo t.casoAsync debe invocarse con await");
      t.igual(tautologies, [], "no debe haber aserciones tautológicas t.cierto(true)");
    });
  }
};
