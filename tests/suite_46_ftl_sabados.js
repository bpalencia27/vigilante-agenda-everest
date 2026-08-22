// v16.3.2 — algunas pruebas nuevas necesitan instancias frescas con su propio almacén.
const { cargar } = require("./harness");
// =====================================================================
//  SUITE 46 — Vigencias corregidas, fecha de toma (FTL), sábados por médico
//             y lectura de factores de riesgo del DOM de Everest
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que ningún examen del paciente
//  quede vencido por culpa de una tabla mal transcrita o de un ajuste de
//  calendario que empuja la toma hacia adelante.
//
//  Las cuatro correcciones frente al Copiloto están declaradas en
//  MTR_CORRECCIONES_NORMA dentro del userscript. Aquí se comprueban una a una
//  contra la tabla portada, para que la diferencia sea visible y no un cambio
//  silencioso: si algún día el Copiloto se arregla y las dos coinciden, estas
//  pruebas lo dirán.
// =====================================================================

// DOM mínimo para probar el lector de radios de Everest: pares SI/NO con el
// mismo `name`, y uno de ellos con el ESPACIO FINAL que trae el HTML real.
function domFalso(marcas) {
  const nodos = [];
  for (const nombre of Object.keys(marcas)) {
    const v = marcas[nombre];
    const si = { name: nombre, value: "true", checked: v === true, type: "radio" };
    const no = { name: nombre, value: "false", checked: v === false, type: "radio" };
    nodos.push(si, no);
  }
  return {
    querySelectorAll(sel) {
      const m = /^input\[name="(.*)"\]$/.exec(sel);
      if (!m) return [];
      const buscado = m[1].replace(/\\"/g, '"');
      return nodos.filter((n) => n.name === buscado);
    },
    querySelector(sel) {
      const r = this.querySelectorAll(sel);
      return r.length ? r[0] : null;
    },
  };
}

module.exports = {
  nombre: "Vigencias corregidas, FTL, sábados del médico y lectura del DOM",
  cubre: [
    "mtrVigenciaDiasNorma", "mtrColapsarVigencia", "mtrEstadoAnalito", "mtrPlanParaclinicos",
    // v16.2.7 — regla del 50% por fuera de meta
    "mtrFueraDeMeta", "mtrAcortarPorFueraDeMeta", "_mtrMargenMeta", "perfilRefinadoConResumen",
    // v16.2.9 — contexto de toda la historia y ficha honesta
    "_vglCosecharFactoresVisibles", "_vglFactoresArchivados", "_triFactor",
    // v16.3.0 — cabecera siempre visible y compuerta de contexto
    "_vglLeerCabeceraHistoria", "_vglProgramasDesdeCabecera", "_vglPestanaDeCampo",
    "_vglContextoEstado", "_vglTextoContextoFaltante", "mtrSabadoTrabajaEsteMedico",
    // v16.3.1 — reconciliador de fuentes
    "mtrTextoOpinaSobre", "mtrDiscrepanciasDeFuentes", "mtrDiscrepanciasQueFrenan",
    // v16.3.2 — confirmaciones persistentes y texto libre
    "_vglCosechaTodo", "_vglConfirmacionesLeer", "_vglConfirmacionGuardar",
    "_vglTextoLibreCombinado", "_vglNotarTextoLibre", "_vglVigilarTextoLibre",
    "mtrOrdinalSabadoDelMes", "mtrGrupoDeEsteSabado", "mtrMedicoTrabajaSabado",
    "mtrDeducirGrupoSabado", "mtrDiaValidoParaControlConSabado", "mtrFechaControlSugerida",
    "mtrLeerRadioSiNo", "mtrLeerCampoNumerico", "mtrLeerFactoresRcvDelDom",
    "mtrSabadoMemoriaLeer", "mtrSabadoMemoriaGuardar", "mtrSabadoGrupoDeMedico",
    "mtrSabadoRegistrarObservacion", "mtrSabadoFijarGrupoManual",
  ],

  pruebas(t, api) {
    // ============ LAS CUATRO CORRECCIONES DE LA TABLA ============

    t.caso("CORRECCIÓN 1 — el LDL en ERC G4 vale 120 días, no 180", () => {
      // El Python aplicó el 120 de "CT/LDL/TG" al colesterol total y a los
      // triglicéridos, y dejó el LDL de la misma fila en 180.
      t.igual(api.mtrVigenciaDias("ERC", "ldl", "G4", false, null, null), 180, "así está el port fiel al Copiloto");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "ldl", "G4", false, null, null), 120, "así lo dice la norma");
      // y sus dos compañeros de fila ya estaban bien en los dos:
      t.igual(api.mtrVigenciaDiasNorma("ERC", "colesterol_total", "G4", false, null, null), 120, "colesterol total");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "trigliceridos", "G4", false, null, null), 120, "triglicéridos");
    });

    t.caso("CORRECCIÓN 2 — la RAC en ERC G4 vale 120 días, no 180", () => {
      t.igual(api.mtrVigenciaDias("ERC", "rac", "G4", false, null, null), 180, "el port fiel");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G4", false, null, null), 120, "la norma");
    });

    t.caso("CORRECCIÓN 3 — a un diabético en G1/G2 SÍ se le pide HbA1c", () => {
      t.igual(api.mtrVigenciaDias("ERC", "hba1c", "G1", true, null, null), "BLOQ", "el port fiel la bloquea");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "hba1c", "G1", true, null, null), 180, "la norma la pide a 180 días");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "hba1c", "G2", true, null, null), 180, "igual en G2");
      // Y la compuerta legítima —que sea diabético— sigue funcionando:
      t.igual(api.mtrVigenciaDiasNorma("ERC", "hba1c", "G1", false, null, null), "BLOQ",
        "a un NO diabético se le sigue bloqueando, que es la única compuerta real");
    });

    t.caso("CORRECCIÓN 4 — con RAC>=30 el plazo es 90 días planos, no la mitad", () => {
      // En G1-G3b coinciden (180/2 = 90). La diferencia sale en G4:
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G1", false, null, 45), 90, "G1: 90 días");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G4", false, null, 45), 90,
        "G4: 90 días — no 60, que es lo que daría 'la mitad' de la vigencia ya corregida a 120");
      // Nunca puede quedar POR ENCIMA de la vigencia base.
      t.cierto(api.mtrVigenciaDiasNorma("ERC", "rac", "G4", false, null, 45)
        <= api.mtrVigenciaDiasNorma("ERC", "rac", "G4", false, null, null),
        "el override nunca puede alargar la vigencia");
    });

    t.caso("una RAC por debajo de 30 no dispara el plazo corto", () => {
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G1", false, null, 12), 180, "RAC 12: vigencia normal");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G1", false, null, 30), 90, "RAC 30 es el corte, ya cuenta");
    });

    t.caso("los rangos de creatinina se colapsan al superior, y al inferior si la función renal se mueve", () => {
      const v = api.mtrVigenciaDiasNorma("ERC", "creatinina", "G3a", false, null, null);
      t.igual(v, [90, 121], "G3a viene como rango");
      t.igual(api.mtrColapsarVigencia(v, false), 121, "paciente estable: se usa el superior");
      t.igual(api.mtrColapsarVigencia(v, true), 90, "función renal moviéndose: se usa el inferior");
      t.igual(api.mtrColapsarVigencia(180, true), 180, "un número no es un rango: se devuelve igual");
    });

    // ============ ESTADO DE CADA ANALITO ============

    const ctxErc = {
      hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: "G3b",
      esDm2: true, edad: 68, rac: 12,
    };

    t.caso("un analito sin ningún resultado se declara AUSENTE, no vencido", () => {
      const a = api.mtrEstadoAnalito("CREATININA", null, ctxErc);
      t.igual(a.estado, "A", "estado A");
      t.igual(a.subestado, "sin_historial", "y el subestado dice que nunca se hizo");
      t.igual(a.fecha, null, "sin fecha");
    });

    t.caso("un analito vencido dice cuántos días lleva vencido", () => {
      // creatinina G3b = rango [90,121]; estable -> 121 días. 2026-01-01 + 121 = 2026-05-02.
      const a = api.mtrEstadoAnalito("CREATININA", { fecha: "2026-01-01", valor: 1.5 }, ctxErc);
      t.igual(a.estado, "A", "vencido");
      t.igual(a.subestado, "vencido", "subestado vencido");
      t.cierto(a.diasParaVencer < 0, "los días para vencer debían ser negativos");
      t.cierto(/vencido hace \d+ día/.test(a.motivo), "el motivo debía decir cuántos días, dijo: " + a.motivo);
    });

    t.caso("un analito bloqueado por estadio se declara BLOQ y NO se pide", () => {
      const a = api.mtrEstadoAnalito("PTH", null, Object.assign({}, ctxErc, { estadioAdministrativo: "G1" }));
      t.igual(a.estado, "BLOQ", "PTH está bloqueada en G1");
      t.cierto(/bloqueado por la norma/.test(a.motivo), "y se dice por qué");
    });

    t.caso("la RAC con albuminuria pasa a vigilancia estrecha (estado R)", () => {
      const ctx = Object.assign({}, ctxErc, { rac: 45 });
      const a = api.mtrEstadoAnalito("RAC", { fecha: "2026-07-01", valor: 45 }, ctx);
      t.igual(a.estado, "R", "estado R por albuminuria");
      t.igual(a.vigenciaDias, 90, "y con la vigencia de 90 días");
    });

    // ============ FECHA DE TOMA DE LABORATORIOS ============

    // =================================================================
    //  v16.2.7 — REGLA DEL 50% POR FUERA DE META
    //  Decisión del médico (20-ago): "repeticiones por fuera de meta:
    //  manda el 50% de la vigencia original". Reportado con pantallazo:
    //  un DM2 con LDL 145 y HbA1c 8,8 al que el plan mandaba TODO a 175 d.
    // =================================================================
    // =================================================================
    //  v16.2.9 — CONTEXTO DE TODA LA HISTORIA, NO SOLO DE LA PESTAÑA ABIERTA
    //  Everest es una aplicación de una sola página: en el DOM solo existe
    //  la pestaña que el médico tiene delante. Decisión suya (20-ago): ir
    //  guardando lo que él abre, y que el clasificador lea la SUMA.
    // =================================================================
    t.caso("cosecha: solo se archiva lo DOCUMENTADO — un campo ausente de la pantalla no se guarda como «no lo tiene»", () => {
      // Se simula una pantalla donde solo dos radios están presentes.
      const presentes = { hta: true, tabaquismo: false };
      const docFalso = {
        querySelectorAll: () => [],
        querySelector: () => null,
        __presentes: presentes,
      };
      const r = api._vglCosecharFactoresVisibles(docFalso);
      t.cierto(r === null || typeof r === "object", "devuelve algo manejable aunque el DOM sea pobre");
      if (r && r.mapa) {
        for (const k of Object.keys(r.mapa)) {
          t.cierto(r.mapa[k].v === true || r.mapa[k].v === false, k + ": solo se archivan true/false, nunca null");
          t.cierto(typeof r.mapa[k].ts === "number", k + ": con sello de hora, para saber cuál es más fresco");
        }
      }
    });

    // =================================================================
    //  v16.3.2 — CONFIRMACIONES: valen la jornada y las SIGUIENTES citas
    // =================================================================
    t.caso("confirmaciones: se guardan por paciente, se fusionan en profundidad y sobreviven en localStorage", () => {
      const c1 = cargar({ silencioso: true });
      t.igual(Object.keys(c1.api._vglConfirmacionesLeer("111")).length, 0, "sin nada guardado, objeto vacío");
      c1.api._vglConfirmacionGuardar("111", "diabetes", true);
      c1.api._vglConfirmacionGuardar("111", "tabaquismo", false);
      const conf = c1.api._vglConfirmacionesLeer("111");
      t.igual(conf.diabetes.v, true, "la primera respuesta");
      t.igual(conf.tabaquismo.v, false, "y la segunda NO borró la primera (fusión profunda, no plana)");
      t.cierto(typeof conf.diabetes.ts === "number", "cada una con su sello de hora");
      // Decisión del médico: para las siguientes citas → localStorage, no sessionStorage.
      const crudo = c1.env.storage.getItem("vgl_cosecha");
      t.cierto(!!crudo && crudo.indexOf("diabetes") >= 0, "vive en el almacén persistente del navegador");
      // Entradas inválidas no ensucian el archivo.
      t.igual(c1.api._vglConfirmacionGuardar("111", "diabetes", "si"), null, "solo true/false explícitos");
      t.igual(c1.api._vglConfirmacionGuardar("", "diabetes", true), null, "sin documento no se guarda nada");
    });

    t.caso("confirmaciones: mandan sobre pantalla y archivo en el clasificador, y el choque queda anotado", () => {
      const c2 = cargar({ silencioso: true });
      // El lector exige que ESE paciente siga abierto en pantalla (guarda anti-cruce de
      // v14.1.5): se le da al documento global los tres marcadores que esa guarda lee.
      c2.env.doc.getElementById = (id) => (id === "anamesis" ? {} : null);
      c2.env.doc.querySelector = () => null;
      c2.env.doc.querySelectorAll = (sel) => (sel === ".text-muted"
        ? [{ textContent: "CC 22233344", closest: () => null }] : []);
      // La historia (archivada) dice que NO es diabético; el médico confirmó que SÍ.
      c2.api._vglCosechaGuardar("22233344", { factores: { diabetes: { v: false, ts: 1 }, tabaquismo: { v: false, ts: 1 } } });
      c2.api._vglConfirmacionGuardar("22233344", "diabetes", true);
      const f = c2.api.mtrLeerFactoresRcvDelDom("22233344", { querySelectorAll: () => [], querySelector: () => null });
      t.igual(f.diabetes, true, "la confirmación del médico es la fuente de mayor rango");
      t.igual(f._origen.diabetes, "confirmado", "y queda trazado de dónde salió");
      t.cierto(f._confirmadoContraHistoria.indexOf("diabetes") >= 0,
        "el choque con la historia queda anotado: la historia es el documento oficial y hay que recordarle actualizarla");
      t.igual(f._origen.tabaquismo, "archivo", "lo no confirmado sigue su cauce normal");
    });

    t.caso("cosecha: la poda bota lo más viejo cuando se pasa del tope, sin tocar lo reciente", () => {
      const c3 = cargar({ silencioso: true });
      // Se llenan 82 pacientes con ts crecientes controlando el reloj por dentro del dato.
      for (let i = 1; i <= 82; i++) c3.api._vglCosechaGuardar("pac" + i, { factores: { hta: { v: true, ts: i } } });
      const todo = c3.api._vglCosechaTodo();
      const n = Object.keys(todo).length;
      t.cierto(n <= 80, "no crece sin límite (quedaron " + n + ")");
      t.cierto(!!todo.pac82, "el más reciente sigue");
      t.falso(!!todo.pac1, "el más viejo fue el sacrificado");
    });

    // =================================================================
    //  v16.3.2 — TEXTO LIBRE: las cinco casillas como contexto
    // =================================================================
    function docConCasillas(valores) {
      // name= para 3 casillas, placeholder para análisis, id para crónicos.
      const el = (v) => ({ value: v, addEventListener() {}, dataset: {},
        getAttribute: (a) => (a === "placeholder" ? "" : null), placeholder: "" });
      const mapa = {
        'textarea[name="MotivoConsulta"]': el(valores.motivo || ""),
        'textarea[name="UltimaEnfermedad"]': el(valores.enfermedad || ""),
        'textarea[name="RecomendacionesMedicas"]': el(valores.recomendaciones || ""),
      };
      const analisis = el(valores.analisis || "");
      analisis.getAttribute = (a) => (a === "placeholder" ? "Ingrese la descripción del análisis y plan" : null);
      return {
        querySelector: (sel) => mapa[sel] || null,
        querySelectorAll: (sel) => (sel === "textarea" ? [analisis] : []),
        getElementById: (id) => (id === "comentariosFinales" ? el(valores.cronicos || "") : null),
      };
    }

    t.caso("texto libre: el colector junta las CINCO casillas con su rótulo, y omite las vacías", () => {
      const c4 = cargar({ silencioso: true });
      const txt = c4.api._vglTextoLibreCombinado(docConCasillas({
        motivo: "Control de programas.", analisis: "Paciente diabético mal controlado.", cronicos: "Adherente.",
      }));
      t.cierto(txt.indexOf("Motivo de consulta:") >= 0, "cada bloque con su rótulo");
      t.cierto(txt.indexOf("Paciente diabético mal controlado.") >= 0, "incluye el análisis (antes ni se leía)");
      t.cierto(txt.indexOf("Adherente.") >= 0, "y la casilla de Ruta Crónicos");
      t.falso(txt.indexOf("Enfermedad actual") >= 0, "las vacías no meten ruido");
      t.igual(c4.api._vglTextoLibreCombinado({ querySelector: () => null, querySelectorAll: () => [] }), "", "sin casillas, cadena vacía");
    });

    t.caso("texto libre: al SALIR de la casilla con texto distinto se invalida el resumen; la primera vista solo siembra", () => {
      const c5 = cargar({ silencioso: true });
      c5.api.mtrCacheResumenGuardar("333", { erc: {}, riesgo: {}, programa: "HTA" });
      // Primera vista: el texto que ya estaba NO es una edición.
      t.falso(c5.api._vglNotarTextoLibre("333", "analisis_plan", "Texto que ya estaba."), "sembrar no dispara nada");
      t.cierto(!!c5.api.mtrCacheResumenLeer("333"), "el resumen sigue vivo");
      // Sin cambio: tampoco.
      t.falso(c5.api._vglNotarTextoLibre("333", "analisis_plan", "Texto que ya estaba."), "sin cambio, sin reanálisis");
      // Cambio real: se invalida todo lo que dependa del resumen (decisión del médico).
      t.cierto(c5.api._vglNotarTextoLibre("333", "analisis_plan", "Texto NUEVO tras editar."), "el cambio sí dispara");
      t.falso(!!c5.api.mtrCacheResumenLeer("333"), "el resumen en caché quedó invalidado: el siguiente módulo recalcula con lo nuevo");
      t.falso(c5.api._vglNotarTextoLibre("", "analisis_plan", "x"), "sin documento no hay nada que notar");
    });

    t.caso("texto libre: el vigilante se engancha una sola vez por casilla (idempotente)", () => {
      const c6 = cargar({ silencioso: true });
      let enganches = 0;
      const casilla = { value: "hola", dataset: {}, addEventListener: () => { enganches++; },
        getAttribute: () => "", placeholder: "" };
      // Se inyecta un document global falso vía el env del harness: el vigilante lee `document`.
      const dPrev = c6.env.win.document;
      try {
        c6.env.doc.querySelector = (sel) => (sel === 'textarea[name="MotivoConsulta"]' ? casilla : null);
        c6.env.doc.querySelectorAll = () => [];
        c6.env.doc.getElementById = () => null;
        c6.api._vglVigilarTextoLibre("444");
        c6.api._vglVigilarTextoLibre("444");
        c6.api._vglVigilarTextoLibre("444");
      } finally { void dPrev; }
      t.igual(enganches, 1, "tres pasadas del ciclo, un solo listener: el dataset lo marca como vigilado");
    });

    t.caso("v16.4.0 — «fuera de meta» y «falla» comparten el margen del 15% (decisión del médico)", () => {
      t.igual(api._mtrMargenMeta(), 0.15, "el margen es el mismo de la falla terapéutica");
      // El caso de la franja gris que motivó la unificación: HbA1c 7,4 con meta 7,0.
      t.igual(api.mtrFueraDeMeta("HBA1C", 7.4, { esDm2: true }), false,
        "7,4 con meta 7,0 (límite 8,05) ya NO acorta la vigencia: no está en falla");
      t.igual(api.mtrFueraDeMeta("HBA1C", 8.5, { esDm2: true }), true, "8,5 sí: falla y acorte coinciden");
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", 130, { categoriaRiesgo: "bajo" }), false,
        "LDL 130 con meta 116 (límite 133,4) tampoco");
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", 145.5, { categoriaRiesgo: "bajo" }), true,
        "145,5 sigue fuera con cualquier margen (el caso real del 20-ago)");
      // Compuerta de contexto atascada (reporte de campo): la pestaña VISITADA cuenta
      // aunque venga sin diligenciar, y pararse en ella cuenta al instante.
      const eVac = api._vglContextoEstado("humo-gate-1", {
        querySelectorAll: () => [],
        querySelector: (sel) => (sel.indexOf("nav-link") >= 0 ? { id: "", textContent: "Antecedentes" } : null),
      });
      t.cierto(eVac.vistas.indexOf("Antecedentes") >= 0, "la pestaña ABIERTA ahora mismo cuenta ya (autocuración)");
      api._vglCosechaGuardar("humo-gate-2", { pestanasVistas: { "Antecedentes": 1, "Hábitos y Gestión de Riesgo": 1 } });
      const eArch = api._vglContextoEstado("humo-gate-2", { querySelectorAll: () => [], querySelector: () => null });
      t.cierto(eArch.ok, "dos pestañas visitadas (aunque vacías) abren la compuerta — el atasco del reporte queda cerrado");
    });

    t.caso("v16.3.2 — las funciones nuevas responden por la puerta compartida (humo de contrato)", () => {
      // Las pruebas de comportamiento de arriba usan instancias frescas (necesitan su
      // propio almacén); esta pasa por el `api` compartido para que el registro de
      // cobertura vea cada contrato invocado de verdad.
      t.cierto(typeof api._vglCosechaTodo() === "object", "_vglCosechaTodo devuelve el archivo");
      t.igual(Object.keys(api._vglConfirmacionesLeer("humo-inexistente")).length, 0, "leer sin nada: vacío");
      const g = api._vglConfirmacionGuardar("humo-99887766", "hta", true);
      t.cierto(!!g && g.confirmaciones.hta.v === true, "guardar y devolver la fusión");
      t.igual(api._vglConfirmacionesLeer("humo-99887766").hta.v, true, "y se relee");
      t.igual(api._vglTextoLibreCombinado({ querySelector: () => null, querySelectorAll: () => [] }), "", "colector sin casillas");
      t.falso(api._vglNotarTextoLibre("", "analisis_plan", "x"), "notar sin documento: no dispara");
      t.noLanza(() => api._vglVigilarTextoLibre("humo-99887766"), "el vigilante tolera el DOM del banco");
    });

    // =================================================================
    //  v16.3.1 — RECONCILIADOR DE FUENTES
    //  "Si dice la historia que es diabético pero los exámenes, los
    //   medicamentos, y el texto libre dice otra cosa, se le debe
    //   solicitar confirmación al médico para continuar."
    // =================================================================
    t.caso("texto libre: reconoce la negación clínica y descarta lo que es de un familiar", () => {
      const re = /\bfumador|tabaquism|\bfuma\b/i;
      t.igual(api.mtrTextoOpinaSobre("Paciente fumador de 10 cigarrillos día.", re), true, "afirmación limpia");
      t.igual(api.mtrTextoOpinaSobre("Niega tabaquismo.", re), false, "«niega» es una negación, no una mención");
      t.igual(api.mtrTextoOpinaSobre("No refiere tabaquismo actual.", re), false, "«no refiere» también");
      t.igual(api.mtrTextoOpinaSobre("Padre fumador, fallecido de EPOC.", re), null, "de un familiar NO es del paciente");
      t.igual(api.mtrTextoOpinaSobre("Control de cifras tensionales.", re), null, "si no se menciona, sin opinión");
      t.igual(api.mtrTextoOpinaSobre("", re), null, "sin texto, sin opinión");
      // Una afirmación limpia manda sobre una negación en otra frase.
      t.igual(api.mtrTextoOpinaSobre("Niega alcohol. Paciente fumador activo.", re), true, "la afirmación explícita gana");
    });

    t.caso("mientras las fuentes COINCIDEN, el asistente no molesta", () => {
      const d = api.mtrDiscrepanciasDeFuentes({
        leidos: { diabetes: true, hta: true },
        cabecera: { diabetes: true, hta: true },
        medicamentosRcv: [{ para: "diabetes" }, { para: "hipertensión" }],
        labsPorClave: { HBA1C: { valor: 8.1 } },
        textoLibre: "Paciente diabético e hipertenso en control.",
      });
      t.igual(d.length, 0, "todo concuerda: ni una pregunta");
    });

    t.caso("el ejemplo textual del médico: el texto dice fumador y la historia no está marcada", () => {
      const d = api.mtrDiscrepanciasDeFuentes({
        leidos: { tabaquismo: false },
        textoLibre: "Paciente fumador activo, se insiste en cesación.",
      });
      const tab = d.find((x) => x.clave === "tabaquismo");
      t.cierto(!!tab, "se detecta la contradicción");
      t.cierto(tab.afirman.some((a) => /Texto/.test(a.fuente)), "el texto afirma");
      t.cierto(tab.niegan.some((n) => /Historia/.test(n.fuente)), "la historia lo niega");
      t.igual(tab.severidad, "media", "no frena el flujo, pero se muestra");
    });

    t.caso("el otro ejemplo del médico: la historia dice diabético pero medicamentos y laboratorios dicen otra cosa", () => {
      const d = api.mtrDiscrepanciasDeFuentes({
        leidos: { diabetes: true },
        cabecera: {},
        medicamentosRcv: [{ para: "hipertensión" }],
        labsPorClave: {},
        textoLibre: "",
      });
      const dm = d.find((x) => x.clave === "diabetes");
      t.cierto(!!dm, "se detecta");
      t.cierto(dm.niegan.some((n) => /Medicamentos/.test(n.fuente)), "ningún antidiabético");
      t.cierto(dm.niegan.some((n) => /Laboratorios/.test(n.fuente)), "ninguna HbA1c");
      t.igual(dm.severidad, "alta", "esto SÍ frena: decide la tabla de vigencias");
      t.cierto(/vigencias/.test(dm.porQue), "y se le explica al médico por qué importa");
      t.igual(api.mtrDiscrepanciasQueFrenan(d).length, 1, "una discrepancia que frena");
    });

    t.caso("una sola fuente hablando NO es una contradicción (no se inventan preguntas)", () => {
      // Lo normal en consulta: la historia marca la diabetes y nadie más dice nada
      // porque el médico está en otra pestaña. Eso no puede generar un modal.
      const d = api.mtrDiscrepanciasDeFuentes({ leidos: { diabetes: true }, medicamentosRcv: [{ para: "diabetes" }] });
      t.igual(d.length, 0, "afirmaciones coincidentes, silencio");
      // Y sin laboratorios cargados, su ausencia no puede negar nada (regla «no pude
      // leerlo ≠ no lo tiene»): esta prueba descubrió el fallo cuando yo sí lo contaba.
      const d3 = api.mtrDiscrepanciasDeFuentes({ leidos: { diabetes: true }, medicamentosRcv: [{ para: "diabetes" }], labsPorClave: null });
      t.igual(d3.length, 0, "los laboratorios sin cargar no niegan la diabetes");
      const d2 = api.mtrDiscrepanciasDeFuentes({ leidos: {}, textoLibre: "Paciente hipertenso." });
      t.igual(d2.length, 0, "el texto afirma y nadie contradice: tampoco se pregunta");
      t.igual(api.mtrDiscrepanciasDeFuentes({}).length, 0, "sin datos, sin preguntas");
      t.igual(api.mtrDiscrepanciasDeFuentes(null).length, 0, "y sin contexto tampoco lanza");
    });

    t.caso("la CABECERA puede afirmar pero por sí sola no genera pregunta ni decide (v16.3.1)", () => {
      // El médico advirtió que no siempre es verídica: se usa para CONTRASTAR.
      const d = api.mtrDiscrepanciasDeFuentes({
        leidos: { diabetes: false },
        cabecera: { diabetes: true },
      });
      const dm = d.find((x) => x.clave === "diabetes");
      t.cierto(!!dm, "cabecera contra historia: eso sí es una contradicción que vale reportar");
      t.cierto(dm.afirman.some((a) => /Cabecera/.test(a.fuente)), "se nombra la cabecera como origen");
    });

    // =================================================================
    //  v16.3.0 — LA CABECERA DE EVEREST (visible en TODAS las pestañas)
    // =================================================================
    // Hallazgo del 20-ago: el módulo decía "Cockcroft-Gault: sin dato" mientras
    // Everest lo tenía impreso en su cabecera, en la misma pantalla.
    function docConTexto(textos) {
      const nodos = textos.map((t) => ({ textContent: t, innerText: t }));
      return { querySelectorAll: () => nodos, querySelector: () => null };
    }

    t.caso("cabecera: se leen Marcaciones, Cockcroft-Gault y Estadio del encabezado de la historia", () => {
      const d = docConTexto([
        "Marcaciones: HTA+DM, Nefroprotección",
        "Cockcroft - Gault: 58.03",
        "Estadio: 3a",
        "Clasificación Estadio: Ligera a moderadamente disminuida",
      ]);
      const c = api._vglLeerCabeceraHistoria(d);
      t.igual(c.marcaciones, "HTA+DM, Nefroprotección", "las marcaciones");
      t.igual(c.cockcroftGault, "58.03", "la TFG que Everest ya calculó");
      t.igual(c.estadio, "3a", "el estadio");
      t.cierto(/Ligera/.test(String(c.clasificacionEstadio)), "y su clasificación");
    });

    t.caso("cabecera: «Clasificación Estadio» NO se confunde con «Estadio»", () => {
      // Sin la guarda, el buscador del estadio cazaba la fila de la clasificación.
      const d = docConTexto(["Clasificación Estadio: Ligera a moderadamente disminuida"]);
      const c = api._vglLeerCabeceraHistoria(d);
      t.igual(c.estadio, null, "no se inventa un estadio a partir de la clasificación");
    });

    t.caso("cabecera: sin cabecera legible devuelve nulos, nunca un valor inventado", () => {
      const c = api._vglLeerCabeceraHistoria(docConTexto(["Anamnesis", "Conducta", "Resultado"]));
      t.igual(c.marcaciones, null, "marcaciones");
      t.igual(c.cockcroftGault, null, "TFG");
      t.igual(c.estadio, null, "estadio");
      t.igual(api._vglLeerCabeceraHistoria(null).marcaciones, null, "y sin documento tampoco lanza");
    });

    t.caso("cabecera: los programas SOLO pueden afirmar, nunca negar", () => {
      const p = api._vglProgramasDesdeCabecera(docConTexto(["Marcaciones: HTA+DM, Nefroprotección"]));
      t.igual(p.hta, true, "HTA afirmado");
      t.igual(p.diabetes, true, "DM afirmado");
      t.igual(p.enfermedadRenalDocumentada, true, "Nefroprotección afirmado");

      const soloHta = api._vglProgramasDesdeCabecera(docConTexto(["Marcaciones: Hipertensión"]));
      t.igual(soloHta.hta, true, "hipertensión por su nombre largo");
      t.igual(soloHta.diabetes, null, "que no nombre la diabetes NO prueba que no la tenga: null, jamás false");
      t.igual(api._vglProgramasDesdeCabecera(docConTexto(["Anamnesis"])), null, "sin marcaciones, sin opinión");
    });

    // =================================================================
    //  v16.3.0 — COMPUERTA DE CONTEXTO (decisión del médico, 20-ago)
    // =================================================================
    t.caso("compuerta: cada campo sabe de qué pestaña viene, derivado de su propio nombre", () => {
      t.igual(api._vglPestanaDeCampo("AntecedentePatologicos.Hipertension"), "Antecedentes", "patológicos");
      t.igual(api._vglPestanaDeCampo("AntecedenteFamiliar.Cardiovasculares"), "Antecedentes", "familiares");
      t.igual(api._vglPestanaDeCampo("hs.HabitosGestionRiesgo.sedentarismo"), "Hábitos y Gestión de Riesgo", "hábitos");
      t.igual(api._vglPestanaDeCampo("clinicaPaciente.ronca"), "Ruta Crónicos", "clínica del paciente");
      t.igual(api._vglPestanaDeCampo("loQueSea.otraCosa"), null, "lo desconocido no se clasifica a la fuerza");
    });

    t.caso("compuerta: sin haber visto ninguna pestaña, el contexto NO es suficiente y se dice cuál falta", () => {
      const e = api._vglContextoEstado("", null);
      t.falso(e.ok, "no se habilita a ciegas");
      t.cierto(e.faltan.indexOf("Antecedentes") >= 0, "falta Antecedentes");
      t.cierto(e.faltan.indexOf("Hábitos y Gestión de Riesgo") >= 0, "falta Hábitos");
      const txt = api._vglTextoContextoFaltante(e);
      t.cierto(/Antecedentes/.test(txt) && /Hábitos/.test(txt), "el aviso NOMBRA las pestañas que faltan");
      t.cierto(/se activa solo/.test(txt), "y explica que no hay que guardar nada");
      t.falso(/undefined|null|\[object/.test(txt), "sin jerga ni restos técnicos");
    });

    t.caso("compuerta: «Ruta Crónicos» no se exige — solo aporta potenciadores, no decide", () => {
      t.falso(api._vglTextoContextoFaltante({ faltan: [] }).length > 0, "sin faltantes no hay aviso");
      const e = api._vglContextoEstado("", null);
      t.falso(e.faltan.indexOf("Ruta Crónicos") >= 0, "exigirla bloquearía a casi todos sin ganar seguridad");
    });

    t.caso("_triFactor: la Ficha distingue «marcó que NO» de «nadie lo documentó» (v16.2.9)", () => {
      // Antes esta distinción era imposible: `factores.hta` se construye con
      // `leidos.hta === true`, así que un campo sin documentar llegaba como `false`
      // y la Ficha imprimía "No" como un hecho afirmado.
      const f = { hta: true, diabetes: false, tabaquismo: false,
                  _leidos: { hta: true, diabetes: false, tabaquismo: null } };
      t.igual(api._triFactor(f, "hta"), "Sí", "documentado como presente");
      t.igual(api._triFactor(f, "diabetes"), "No", "documentado como ausente");
      t.igual(api._triFactor(f, "tabaquismo"), null, "NO documentado: sin dato, no «No»");

      // Resúmenes viejos en caché (sin trazabilidad) no pueden romper la Ficha.
      const viejo = { hta: true, diabetes: false };
      t.igual(api._triFactor(viejo, "hta"), "Sí", "sin _leidos se cae al booleano de siempre");
      t.igual(api._triFactor(viejo, "diabetes"), null, "y lo que no es true se muestra como sin dato, que es lo prudente");
      t.igual(api._triFactor(null, "hta"), null, "sin objeto, sin suposición");
    });

    t.caso("_vglFactoresArchivados: devuelve tri-estado y nunca inventa un false", () => {
      const r = api._vglFactoresArchivados("");
      t.cierto(r && typeof r === "object", "sin documento devuelve un objeto vacío, no null");
      t.igual(Object.keys(r).length, 0, "y sin ningún factor inventado");
    });

    t.caso("perfilRefinadoConResumen: una TFG que NO SE PUDO CALCULAR no puede leerse como TFG 0 (v16.2.8)", () => {
      // Reportado con pantallazo: el globito del cupo decía "función renal reducida
      // (TFG 0)" en una paciente a la que sencillamente no se le pudo calcular la TFG
      // (Athenea caída, sin creatinina). `Number(null)` es 0 y `0 < 60` es cierto, así
      // que la ausencia del dato se convertía en el peor valor posible.
      const base = { factores: {}, riesgo: {}, fallas: {} };
      const sinTfg = api.perfilRefinadoConResumen({ adicionales: true }, Object.assign({}, base, { erc: { egfr: null } }));
      t.igual(sinTfg.adicionales, true, "sin TFG no se desaconseja el cupo por el riñón");
      t.falso(String(sinTfg.motivoNoSencillo || "").includes("renal"), "y no se menciona el riñón para nada");

      for (const vacio of [undefined, "", 0]) {
        const p = api.perfilRefinadoConResumen({ adicionales: true }, Object.assign({}, base, { erc: { egfr: vacio } }));
        t.falso(String(p.motivoNoSencillo || "").includes("TFG 0"), "nunca se afirma «TFG 0» (probado con " + JSON.stringify(vacio) + ")");
      }

      // Con una TFG real y baja, la advertencia SÍ debe salir: no se afloja la seguridad.
      const conTfg = api.perfilRefinadoConResumen({ adicionales: true }, Object.assign({}, base, { erc: { egfr: 42 } }));
      t.igual(conTfg.adicionales, false, "con TFG 42 sí se desaconseja el cupo adicional");
      t.cierto(String(conTfg.motivoNoSencillo).includes("TFG 42"), "y se dice el número real");
    });

    t.caso("fuera de meta: solo se juzgan los analitos que TIENEN meta definida en el código", () => {
      const dm2 = { esDm2: true, categoriaRiesgo: "bajo" };

      // HbA1c: meta 7,0 en diabéticos.
      t.igual(api.mtrFueraDeMeta("HBA1C", 8.8, dm2), true, "8,8 está por fuera");
      t.igual(api.mtrFueraDeMeta("HBA1C", 6.5, dm2), false, "6,5 está en meta");
      t.igual(api.mtrFueraDeMeta("HBA1C", 7.0, dm2), false, "justo en la meta NO es fuera de meta");
      t.igual(api.mtrFueraDeMeta("HBA1C", 8.8, { esDm2: false }), null,
        "en un hipertenso sin diabetes la HbA1c no se mide contra 7,0: no se juzga");
      t.igual(api.mtrFueraDeMeta("HBA1C", 8.0, { esDm2: true, metaHba1c: 8.5 }), false,
        "si el paciente tiene meta propia, manda la suya");

      // LDL: la meta depende de la categoría de riesgo.
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", 145.5, { categoriaRiesgo: "bajo" }), true, "145,5 supera los 116 de riesgo bajo");
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", 90, { categoriaRiesgo: "bajo" }), false, "90 está en meta para riesgo bajo");
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", 90, { categoriaRiesgo: "muy alto" }), true, "el mismo 90 SÍ está fuera si el riesgo es muy alto (meta 55)");
      t.igual(api.mtrFueraDeMeta("COLESTEROL_LDL", 145.5, {}), null, "sin categoría de riesgo no hay meta: no se inventa una");

      t.igual(api.mtrFueraDeMeta("TRIGLICERIDOS", 182, {}), true, "182 supera los 150");
      t.igual(api.mtrFueraDeMeta("TRIGLICERIDOS", 120, {}), false, "120 está en meta");

      // Los que NO tienen meta definida no se juzgan — inventar un umbral clínico
      // sería indistinguible de uno real para quien lea el código después.
      for (const k of ["GLUCOSA", "COLESTEROL_TOTAL", "COLESTEROL_HDL", "CREATININA", "HEMOGLOBINA", "PTH", "FOSFORO", "ALBUMINA", "UROANALISIS"]) {
        t.igual(api.mtrFueraDeMeta(k, 999, dm2), null, k + ": sin meta en el código, no se acorta nada");
      }
      // El RAC queda fuera a propósito: ya tiene su propio acortamiento por albuminuria.
      t.igual(api.mtrFueraDeMeta("RAC", 500, dm2), null, "el RAC no entra aquí: se partiría dos veces");
      t.igual(api.mtrFueraDeMeta("HBA1C", null, dm2), null, "sin resultado no se juzga");
    });

    t.caso("fuera de meta: la vigencia se parte a la mitad, nunca por debajo de 1 día", () => {
      t.igual(api.mtrAcortarPorFueraDeMeta(180, true), 90, "180 -> 90");
      t.igual(api.mtrAcortarPorFueraDeMeta(365, true), 182, "365 -> 182 (se redondea hacia abajo)");
      t.igual(api.mtrAcortarPorFueraDeMeta(180, false), 180, "en meta: no se toca");
      t.igual(api.mtrAcortarPorFueraDeMeta(180, null), 180, "sin meta que aplicar: no se toca");
      t.igual(api.mtrAcortarPorFueraDeMeta(1, true), 1, "nunca baja de 1 día");
      t.igual(api.mtrAcortarPorFueraDeMeta("BLOQ", true), "BLOQ", "lo que no es número se devuelve tal cual");
    });

    t.caso("el caso real del consultorio: DM2 con LDL 145 y HbA1c 8,8 ya no se va a 175 días", () => {
      // Mismo perfil del pantallazo del 20-ago (datos de ejemplo, no de un paciente real):
      // DM2 que también está en HTA, riesgo bajo, función renal conservada.
      const ctx = {
        hoyIso: "2026-08-20", programa: "DM2", estadioAdministrativo: "G2",
        esDm2: true, edad: 85, rac: 7.21, categoriaRiesgo: "bajo",
        ultimos: {
          COLESTEROL_LDL: { fecha: "2026-08-15", valor: 145.5 },
          HBA1C: { fecha: "2026-08-15", valor: 8.8 },
          TRIGLICERIDOS: { fecha: "2026-08-15", valor: 182 },
          COLESTEROL_TOTAL: { fecha: "2026-08-15", valor: 235 },
          COLESTEROL_HDL: { fecha: "2026-08-15", valor: 53.1 },
          GLUCOSA: { fecha: "2026-08-15", valor: 193 },
          CREATININA: { fecha: "2026-08-15", valor: 0.78 },
          UROANALISIS: { fecha: "2026-08-15", valor: 1 },
          RAC: { fecha: "2026-08-15", valor: 7.21 },
        },
      };
      const plan = api.mtrPlanParaclinicos(ctx);
      const por = (n) => plan.drivers.concat(plan.pasajeros || []).find((a) => a.clave === n);

      const ldl = por("COLESTEROL_LDL");
      t.igual(ldl.vigenciaDias, 90, "el LDL fuera de meta se repite a los 90 días, no a los 180");
      t.cierto(ldl.fueraDeMeta === true, "y queda marcado como fuera de meta");
      t.cierto(String(ldl.motivo).includes("fuera de meta"), "el motivo lo DICE, para que el médico sepa de dónde sale la fecha corta");

      t.igual(por("HBA1C").vigenciaDias, 90, "la HbA1c de 8,8 también");
      t.igual(por("TRIGLICERIDOS").vigenciaDias, 90, "y los triglicéridos de 182");

      // Los que no tienen meta definida conservan su vigencia de norma.
      t.igual(por("COLESTEROL_TOTAL").vigenciaDias, 180, "el colesterol total no tiene meta en el código: sigue en 180");
      t.igual(por("GLUCOSA").vigenciaDias, 180, "la glicemia tampoco");

      // Y la consecuencia que motivó todo el reporte: la toma se adelanta.
      t.cierto(plan.ftl < "2026-12-01", "la toma ya no se va a 175 días (jue 11 feb): cae dentro de este año");
    });

    t.caso("CERO VENCIDOS — la toma va al vencimiento más próximo, nunca después", () => {
      const plan = api.mtrPlanParaclinicos(Object.assign({}, ctxErc, {
        ultimos: {
          CREATININA: { fecha: "2026-06-01", valor: 1.5 },
          GLUCOSA: { fecha: "2026-05-01", valor: 105 },
          COLESTEROL_TOTAL: { fecha: "2026-05-01", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-05-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-05-01", valor: 110 },
          TRIGLICERIDOS: { fecha: "2026-05-01", valor: 150 },
          UROANALISIS: { fecha: "2026-05-01", valor: 1 },
          RAC: { fecha: "2026-05-01", valor: 12 },
          // v16.4.0 — con el umbral unificado (meta+15%, decisión del médico), 7,1 ya no
          // está "fuera de meta" (el límite con meta 7,0 es 8,05): se sube a 8,5 para que
          // este caso siga ejercitando la rama del examen YA VENCIDO por el 50%.
          HBA1C: { fecha: "2026-05-01", valor: 8.5 },
        },
      }));
      t.cierto(!!plan.ftl, "debía salir una fecha de toma");
      // Ningún driver VIGENTE puede vencer ANTES de la fecha de toma.
      // v16.2.7 — el filtro ahora excluye de verdad a los YA VENCIDOS (estado "A"), como
      // siempre dijo este comentario. Un examen que ya venció tiene por fuerza su
      // vencimiento en el pasado, así que SIEMPRE cae antes de cualquier fecha de toma:
      // incluirlos convertía el invariante en algo imposible de cumplir. Para esos el
      // plan ya hace lo correcto por otra vía (hayEstadoA + piso de 14 días). Lo que este
      // invariante protege es que a un examen todavía vigente no se le pase el plazo
      // esperando la toma. Salió a la luz al entrar la regla del 50% por fuera de meta:
      // la HbA1c de 7,1 de este caso pasó de vencer en octubre a haber vencido en julio.
      const antes = plan.drivers.filter((a) => a.estado !== "A" && a.vence && a.vence < plan.ftl);
      t.cierto(plan.drivers.some((a) => a.estado === "A"), "este caso SÍ tiene un examen ya vencido (la HbA1c fuera de meta): la rama que se ejercita es la del piso de 14 días");
      t.igual(antes.map((a) => a.nombre + "@" + a.vence), [], "hay exámenes que vencen ANTES de la toma");
    });

    t.caso("si el vencimiento cae en domingo, la toma se ADELANTA al sábado", () => {
      // 2026-08-16 es domingo. Un examen que vence ese día:
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-06-01", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-02-17", valor: 1.0 },   // +180 = 2026-08-16 (domingo)
          GLUCOSA: { fecha: "2026-03-01", valor: 95 },
          COLESTEROL_TOTAL: { fecha: "2026-03-01", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-03-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-03-01", valor: 110 },
          TRIGLICERIDOS: { fecha: "2026-03-01", valor: 150 },
          UROANALISIS: { fecha: "2026-03-01", valor: 1 },
          RAC: { fecha: "2026-03-01", valor: 10 },
        },
      });
      t.igual(plan.ftlSinAjustar, "2026-08-16", "el vencimiento más próximo era el domingo 16");
      t.igual(plan.ftl, "2026-08-15", "y la toma se adelanta al sábado 15, NO al lunes 17");
      t.cierto(plan.seAdelantoPorDiaNoHabil, "y queda constancia de que se movió");
    });

    t.caso("el piso de 14 días JAMÁS retrasa una toma por encima de un vencimiento", () => {
      // Hay un examen ausente (pide piso de 14 días) y otro que vence en 5.
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-09-01", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-03-10", valor: 1.0 },   // +180 = 2026-09-06
          // el resto ausentes -> estado A
        },
      });
      t.cierto(plan.ftl <= "2026-09-06", "la toma no puede caer después del 6-sep, cayó el " + plan.ftl);
      t.cierto(/piso de 14 días la habría dejado vencer/.test(plan.motivoFtl),
        "y el motivo debía explicarlo, dijo: " + plan.motivoFtl);
    });

    t.caso("la cosecha adelanta lo que está por vencer y DIFIERE lo que aún tiene margen", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-03-01", valor: 1.0 },        // vence 2026-08-28
          GLUCOSA: { fecha: "2026-03-20", valor: 95 },            // vence 2026-09-16 (19 d de margen)
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 190 },  // vence 2027-01-28: mucho margen
          COLESTEROL_HDL: { fecha: "2026-08-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-08-01", valor: 110 },
          TRIGLICERIDOS: { fecha: "2026-08-01", valor: 150 },
          UROANALISIS: { fecha: "2026-08-01", valor: 1 },
          RAC: { fecha: "2026-08-01", valor: 10 },
        },
      });
      const nombresDif = plan.diferidos.map((a) => a.clave);
      t.cierto(nombresDif.indexOf("COLESTEROL_TOTAL") >= 0,
        "un colesterol con 5 meses de margen NO se debe adelantar (sería tirar vigencia buena)");
      t.cierto(plan.cosechados.some((a) => a.clave === "CREATININA"), "la creatinina que fija la fecha va incluida");
    });

    // =====================================================================
    // v17.6.0 — el corte de cosecha subió de 25% a 33% de la vigencia (aprobado el
    // 22-ago, junto con el resto de la lista de esa fecha). Este caso fija un margen
    // que antes NO se cosechaba (27,8% de 180 días > 25%) y ahora SÍ (27,8% < 33%):
    // la prueba se vuelve roja sola si alguien retrocede el corte a 0.25.
    // =====================================================================
    t.caso("v17.6.0 — el corte de cosecha en 33% adelanta un examen que con el corte viejo (25%) se habría diferido", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-03-01", valor: 1.0 },        // fija la FTL: 2026-08-28
          // vigenciaDias=180 (HTA/G1). Vence 2026-10-17: margen de 50 días sobre la FTL
          // = 27,8% de 180 -> por encima del 25% viejo (45 d), por debajo del 33% nuevo
          // (59,4 d). Con el corte de ANTES esta prueba habría fallado (diferido, no
          // cosechado); es exactamente el caso que la subida de umbral pretendía mover.
          TRIGLICERIDOS: { fecha: "2026-04-20", valor: 150 },
        },
      });
      t.cierto(plan.cosechados.some((a) => a.clave === "TRIGLICERIDOS"),
        "con 27,8% de margen (entre 25% y 33%) debe cosecharse con el corte nuevo");
      t.falso(plan.diferidos.some((a) => a.clave === "TRIGLICERIDOS"),
        "y por lo tanto no debe aparecer también como diferido");
    });

    t.caso("v17.6.0 — el corte de cosecha en 33% sigue teniendo techo: un margen bien por encima (35,6%) se sigue difiriendo", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-03-01", valor: 1.0 },        // fija la FTL: 2026-08-28
          // Vence 2026-10-31: margen de 64 días = 35,6% de 180 -> por encima incluso del
          // 33% nuevo. Sin este caso, subir el corte a 33% podría leerse como "cosechar
          // todo": esta prueba fija que sigue habiendo un techo real.
          TRIGLICERIDOS: { fecha: "2026-05-04", valor: 150 },
        },
      });
      t.cierto(plan.diferidos.some((a) => a.clave === "TRIGLICERIDOS"),
        "con 35,6% de margen, incluso el corte nuevo (33%) debe diferirlo");
      t.falso(plan.cosechados.some((a) => a.clave === "TRIGLICERIDOS"),
        "y por lo tanto no debe aparecer también como cosechado");
    });

    t.caso("los exámenes bloqueados por estadio no entran en la orden", () => {
      const plan = api.mtrPlanParaclinicos(Object.assign({}, ctxErc, {
        estadioAdministrativo: "G1", ultimos: {},
      }));
      const claves = plan.ordenar.map((a) => a.clave);
      t.igual(claves.indexOf("PTH"), -1, "la PTH está bloqueada en G1 y no se puede pedir");
      t.igual(claves.indexOf("FOSFORO"), -1, "el fósforo también");
      t.cierto(plan.bloqueados.length >= 3, "y los bloqueados se declaran para poder explicarlo");
    });

    t.caso("los pasajeros se enganchan a la toma sin fijarla", () => {
      const plan = api.mtrPlanParaclinicos(Object.assign({}, ctxErc, {
        estadioAdministrativo: "G4",
        ultimos: { CREATININA: { fecha: "2026-08-01", valor: 2.5 } },
      }));
      t.cierto(plan.ordenar.some((a) => a.clave === "HEMOGLOBINA"),
        "la hemoglobina, que nunca se bloquea, debía ir en la orden");
      // Y no manda sobre la fecha: la hemoglobina está ausente pero su piso de
      // 14 días no puede haber empujado la toma más allá de la creatinina.
      const creat = plan.drivers.find((a) => a.clave === "CREATININA");
      if (creat && creat.vence) t.cierto(plan.ftl <= creat.vence, "un pasajero no puede retrasar la toma");
    });

    // ============ SÁBADOS DEL MÉDICO ============

    t.caso("el ordinal del sábado dentro del mes se calcula bien", () => {
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-01"), 1, "1 de agosto de 2026 es el 1er sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-08"), 2, "2º sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-15"), 3, "3er sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-22"), 4, "4º sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-29"), 5, "5º sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-17"), null, "un lunes no es sábado");
    });

    t.caso("el 5º sábado del mes no es de ningún grupo, y se dice 'no sé' en vez de adivinar", () => {
      t.igual(api.mtrGrupoDeEsteSabado("2026-08-29"), null, "el 5º no pertenece a ningún grupo");
      t.igual(api.mtrMedicoTrabajaSabado("2026-08-29", "1-3"), null, "no se afirma que trabaje");
      t.igual(api.mtrMedicoTrabajaSabado("2026-08-29", "2-4"), null, "ni que no trabaje");
    });

    t.caso("cada grupo trabaja sus dos sábados y no los del otro", () => {
      t.cierto(api.mtrMedicoTrabajaSabado("2026-08-01", "1-3"), "grupo 1-3, 1er sábado");
      t.cierto(api.mtrMedicoTrabajaSabado("2026-08-15", "1-3"), "grupo 1-3, 3er sábado");
      t.falso(api.mtrMedicoTrabajaSabado("2026-08-08", "1-3"), "grupo 1-3 NO trabaja el 2º");
      t.cierto(api.mtrMedicoTrabajaSabado("2026-08-08", "2-4"), "grupo 2-4, 2º sábado");
      t.cierto(api.mtrMedicoTrabajaSabado("2026-08-22", "2-4"), "grupo 2-4, 4º sábado");
      t.falso(api.mtrMedicoTrabajaSabado("2026-08-22", "1-3"), "grupo 1-3 NO trabaja el 4º");
    });

    t.caso("sin grupo conocido no se afirma nada sobre los sábados", () => {
      t.igual(api.mtrMedicoTrabajaSabado("2026-08-01", null), null, "sin grupo");
      t.igual(api.mtrMedicoTrabajaSabado("2026-08-01", "cualquier-cosa"), null, "grupo inválido");
    });

    t.caso("dos observaciones coherentes deducen el grupo; una sola es solo conjetura", () => {
      const una = api.mtrDeducirGrupoSabado(["2026-08-01"]);
      t.igual(una.grupo, "1-3", "el 1er sábado apunta al grupo 1-3");
      t.igual(una.confianza, "conjetura", "con una sola observación no basta");
      const dos = api.mtrDeducirGrupoSabado(["2026-08-01", "2026-08-15"]);
      t.igual(dos.confianza, "deducido", "con dos coherentes ya se da por deducido");
    });

    t.caso("observaciones contradictorias NO deducen nada: se declara conflicto", () => {
      const r = api.mtrDeducirGrupoSabado(["2026-08-01", "2026-08-08"]);
      t.igual(r.grupo, null, "no se elige lado con datos que se contradicen");
      t.cierto(r.conflicto, "y se marca el conflicto");
    });

    t.caso("el 5º sábado se registra pero no vota", () => {
      const r = api.mtrDeducirGrupoSabado(["2026-08-29"]);
      t.igual(r.grupo, null, "el 5º sábado no distingue grupos");
      t.igual(r.confianza, "sin_datos", "y no cuenta como observación útil");
      t.igual(r.observados.length, 1, "aunque sí queda registrado");
    });

    t.caso("la memoria por médico distingue lo observado de lo que fijó el médico a mano", () => {
      api.mtrSabadoFijarGrupoManual("77", "");            // limpia por si acaso
      api.mtrSabadoRegistrarObservacion("77", "2026-08-01");
      api.mtrSabadoRegistrarObservacion("77", "2026-08-15");
      const obs = api.mtrSabadoGrupoDeMedico("77");
      t.igual(obs.grupo, "1-3", "deducido de lo observado");
      t.igual(obs.origen, "observado", "origen observado");
      // Ahora el médico lo corrige a mano: su palabra gana.
      api.mtrSabadoFijarGrupoManual("77", "2-4");
      const man = api.mtrSabadoGrupoDeMedico("77");
      t.igual(man.grupo, "2-4", "lo que fija el médico manda");
      t.igual(man.confianza, "manual", "y se distingue de lo deducido");
      api.mtrSabadoRegistrarObservacion("77", "2026-09-05");
      t.igual(api.mtrSabadoGrupoDeMedico("77").grupo, "2-4",
        "una observación posterior NO pisa la corrección del médico");
      api.mtrSabadoFijarGrupoManual("77", "");
    });

    t.caso("la misma fecha registrada dos veces no cuenta dos veces", () => {
      api.mtrSabadoFijarGrupoManual("88", "");
      t.cierto(api.mtrSabadoRegistrarObservacion("88", "2026-08-01"), "primera vez: se registra");
      t.falso(api.mtrSabadoRegistrarObservacion("88", "2026-08-01"), "segunda vez: no");
      t.igual(api.mtrSabadoGrupoDeMedico("88").confianza, "conjetura",
        "abrir el modal dos veces el mismo día no puede 'deducir' el grupo");
    });

    t.caso("un día que no es sábado no se registra como observación de sábado", () => {
      t.falso(api.mtrSabadoRegistrarObservacion("99", "2026-08-17"), "un lunes no dice nada del grupo");
      t.falso(api.mtrSabadoRegistrarObservacion("", "2026-08-01"), "sin id de médico no se guarda nada");
    });

    t.caso("la memoria de sábados nunca lanza, ni siquiera si el almacén devuelve basura", () => {
      // Se invocan directamente el lector y el escritor del almacén: si alguno
      // lanzara, la pantalla de agendamiento se caería entera por una clave
      // corrupta de GM_storage.
      let leido = null;
      t.noLanza(() => { leido = api.mtrSabadoMemoriaLeer(); }, "leer no puede lanzar");
      t.cierto(leido !== null && typeof leido === "object", "siempre devuelve un objeto");
      t.noLanza(() => { api.mtrSabadoMemoriaGuardar({ "1": { origen: "observado", observados: [] } }); },
        "guardar no puede lanzar");
      t.noLanza(() => { api.mtrSabadoMemoriaGuardar(null); }, "ni con null");
    });

    t.caso("el IMC se lee del campo numérico de Everest, y un valor imposible no pasa", () => {
      const d = domFalso({});
      d.querySelector = (sel) => {
        if (sel.indexOf("indiceMasaCorporal") >= 0) return { value: "31,4" };   // coma decimal
        return null;
      };
      t.igual(api.mtrLeerCampoNumerico("monitoreoProgramaPrenatalMadre.indiceMasaCorporal", d), 31.4,
        "la coma decimal del teclado colombiano debe entenderse");
      d.querySelector = () => ({ value: "-5" });
      t.igual(api.mtrLeerCampoNumerico("lo.que.sea", d), null, "un negativo no es un IMC");
      d.querySelector = () => null;
      t.igual(api.mtrLeerCampoNumerico("lo.que.sea", d), null, "campo ausente -> null");
    });

    // ============ FECHA DE CONTROL ============

    t.caso("el control nunca cae en domingo ni en festivo", () => {
      const r = api.mtrFechaControlSugerida("2026-08-12", { grupoSabado: null });
      t.cierto(!!r, "debía salir fecha");
      t.falso(api.mtrEsFestivoCO(r.fecha), "no puede ser festivo");
      t.cierto(api.mtrDiaValidoParaControlConSabado(r.fecha, null), "y debe ser un día válido");
    });

    // v16.9.0 — REGLA ÚNICA DE SÁBADO (decisión del médico, 20-ago): «cualquier sábado
    // con agenda propia detectada», expresamente NO la de grupos. Con datos reales de su
    // equipo la deducción del grupo salía «conflicto» —trabaja sábados que el modelo dice
    // que no le tocan— y el asistente le tachaba sábados buenos.
    t.caso("el control cae en sábado si consta que el médico trabaja sábados, sin mirar de qué grupo sería", () => {
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-08-08", "1-3"),
        "2º sábado con grupo 1-3: ANTES se tachaba; ahora vale, porque consta que trabaja sábados");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-08-08", "2-4"), "y el del otro grupo también");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-08-08", { observados: ["2026-07-04"] }),
        "una agenda propia observada basta, sin necesidad de deducir grupo");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-08", null), "sin constancia no se propone sábado");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-08", { observados: [] }), "una memoria vacía no es constancia");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-09", "2-4"), "domingo nunca");
    });

    t.caso("mtrSabadoTrabajaEsteMedico: responde con lo OBSERVADO, no con una tabla de IDs", () => {
      const sinNada = api.mtrSabadoTrabajaEsteMedico("medico-sin-historia");
      t.falso(sinNada.habilitado, "sin sábados vistos, no consta");
      t.igual(sinNada.observados.length, 0);
      api.mtrSabadoRegistrarObservacion("medico-con-sabados", "2026-08-01");
      const conUno = api.mtrSabadoTrabajaEsteMedico("medico-con-sabados");
      t.cierto(conUno.habilitado, "una sola agenda propia en sábado ya lo habilita");
      t.igual(conUno.observados.length, 1, "y se ve de dónde salió");
      t.falso(api.mtrSabadoTrabajaEsteMedico(null).habilitado, "sin médico no se inventa nada");
    });

    t.caso("el control se separa de la toma al menos 4 días (>=72 h para el resultado)", () => {
      const r = api.mtrFechaControlSugerida("2026-08-17", { grupoSabado: "1-3" });
      t.cierto(r.dias >= 4, "debían pasar al menos 4 días, pasaron " + r.dias);
      t.cierto(r.fecha > "2026-08-17", "y el control es posterior a la toma");
    });

    t.caso("si no hay día válido en la ventana, se corre y se DICE que se corrió", () => {
      // Diciembre 2026: 25 (viernes) es festivo; se busca en una ventana estrecha.
      const r = api.mtrFechaControlSugerida("2026-12-20", { grupoSabado: null, minDias: 5, maxDias: 5 });
      t.cierto(!!r, "no puede devolver nada");
      if (r.fueraDeVentana) t.cierto(/se corrió/.test(r.motivo), "y el motivo debía decirlo");
    });

    // ============ LECTURA DEL DOM DE EVEREST ============

    t.caso("lee un par de radios SI/NO de Everest", () => {
      const d = domFalso({ "AntecedentePatologicos.Hipertension": true, "AntecedentePatologicos.Diabetes": false });
      t.igual(api.mtrLeerRadioSiNo("AntecedentePatologicos.Hipertension", d), true, "SI marcado");
      t.igual(api.mtrLeerRadioSiNo("AntecedentePatologicos.Diabetes", d), false, "NO marcado");
    });

    t.caso("un antecedente que NADIE ha marcado devuelve null, no false", () => {
      // No documentado no es lo mismo que "no lo tiene": si se devolviera false,
      // el recuadro no podría decirle al médico cuántas casillas están en blanco.
      const d = domFalso({ "AntecedentePatologicos.Dislipidemia": null });
      t.igual(api.mtrLeerRadioSiNo("AntecedentePatologicos.Dislipidemia", d), null, "sin marcar -> null");
      t.igual(api.mtrLeerRadioSiNo("campo.que.no.existe", d), null, "campo inexistente -> null");
    });

    t.caso("el ESPACIO FINAL del atributo name no hace desaparecer el tabaquismo", () => {
      // En el HTML real de Everest cuatro campos de Hábitos traen un espacio al
      // final del `name`, y uno de ellos es justo el del tabaquismo. Buscar sin
      // el espacio no encuentra nada y el paciente sale sin ese factor de riesgo.
      const d = domFalso({ "hs.HabitosGestionRiesgo.actualmenteFumaOExfumador ": true });
      t.igual(api.mtrLeerRadioSiNo("hs.HabitosGestionRiesgo.actualmenteFumaOExfumador", d), true,
        "debía encontrarlo probando también con el espacio final");
    });

    t.caso("los factores de riesgo se leen del DOM y se dice cuántos quedaron sin documentar", () => {
      const d = domFalso({
        "AntecedentePatologicos.Hipertension": true,
        "AntecedentePatologicos.Diabetes": true,
        "hs.HabitosGestionRiesgo.actualmenteFumaOExfumador ": true,
        "hs.HabitosGestionRiesgo.sedentarismo": true,
        "hs.HabitosGestionRiesgo.pesoAdecuadoTalla": false,
        "AntecedentePatologicos.nuropatia": true,
      });
      const f = api.mtrLeerFactoresRcvDelDom("", d);
      t.cierto(f.hta, "HTA");
      t.cierto(f.diabetes, "diabetes");
      t.cierto(f.tabaquismo, "tabaquismo (el del espacio final)");
      t.cierto(f.sedentarismo, "sedentarismo");
      t.cierto(f.obesidad, "'¿peso adecuado para la talla?' NO => obesidad");
      t.cierto(f.neuropatia, "neuropatía");
      t.cierto(f._sinDocumentar.length > 0, "y debía decir qué quedó sin documentar");
      t.igual(f._documentados, 6, "seis casillas documentadas");
    });

    t.caso("la ECV establecida se toma como la unión de las tres casillas de Everest", () => {
      for (const campo of ["AntecedentePatologicos.ecv", "AntecedentePatologicos.enfermedadCerebroVascular", "AntecedentePatologicos.eventoVascular"]) {
        const d = domFalso({ [campo]: true });
        t.cierto(api.mtrLeerFactoresRcvDelDom("", d).ecvAterescleroticaEstablecida,
          "marcar " + campo + " debía contar como ECV establecida");
      }
    });

    t.caso("roncar y tener sueño NO se convierte en un diagnóstico de apnea", () => {
      const d = domFalso({
        "clinicaPaciente.ronca": true,
        "clinicaPaciente.somnoliencia": true,
        "clinicaPaciente.cansancio": true,
      });
      const f = api.mtrLeerFactoresRcvDelDom("", d);
      t.cierto(f.apneaSugerida, "los tres síntomas juntos SÍ son sugestivos y se sugieren");
      t.falso(f.apneaSueno, "pero NO se dan por diagnosticados: eso sería inventar un factor de riesgo");
      t.igual(api.mtrContarFrMayores(f).lista.indexOf("apnea del sueño"), -1,
        "y por tanto no cuenta en el conteo de factores de riesgo");
    });

    t.caso("si el médico cambió de historia a media lectura, no se devuelven factores de otro paciente", () => {
      const d = domFalso({ "AntecedentePatologicos.Hipertension": true });
      // `_pacienteSigueAbierto` no puede confirmar la cédula en este entorno,
      // así que la lectura se aborta: es la dirección segura.
      t.igual(api.mtrLeerFactoresRcvDelDom("1234567890", d), null,
        "con una cédula que no se puede confirmar, NO se lee nada");
    });
  },
};
