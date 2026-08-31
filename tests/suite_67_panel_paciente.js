// =====================================================================
//  SUITE 67 — «Panel del paciente» (v16.8.0)
//
//  La fusión que el médico decidió en las entrevistas del 20-ago y
//  reclamó el 21: «no me sale el módulo unificado como te lo mandé a
//  pedir». La Ficha (lo que leí y de dónde) y Riesgo y exámenes (lo que
//  concluyo) eran dos ventanas con dos botones, y para juzgar a un
//  paciente había que abrir las dos y compararlas de memoria.
//
//  Lo que hay que defender aquí:
//   · que las cinco secciones existan (la pestaña Medicamentos fue
//     restaurada en el REFACTOR S+) y que cambiar de una a otra no
//     pida NADA por red (una sola lectura alimenta el módulo entero);
//   · que los dos puntos de entrada viejos aterricen donde el médico
//     espera, sin romperle el camino a los llamadores internos;
//   · que la sección de tendencias no invente una línea con un solo
//     punto ni llame «cambio» al ruido del laboratorio.
// =====================================================================

const RESUMEN_DEMO = {
  programa: "HTA",
  factores: { edad: 66, sexo: "F", pesoKg: 70, diabetes: true, hta: true },
  erc: { crcl: 58, egfr: 55, estadioAdministrativo: "G3a", estadioClinico: "G3a" },
  riesgo: { categoria: "ALTO", criterios: ["diabetes"], paso: 2, fuente: "regla del programa" },
  ultimos: { CREATININA: { valor: 1.1, fecha: "2026-08-01" }, COLESTEROL_LDL: { valor: 130, fecha: "2026-08-01" } },
  _ultimos: { CREATININA: { valor: 1.1, fecha: "2026-08-01" } },
  medicamentos: ["LOSARTAN 50MG", "METFORMINA 850MG"],
  plan: { vencidos: [], faltantes: [{ nombre: "RAC" }] },
  _series: {
    HBA1C: [
      { fecha: "2025-08-01", valor: 9.4 },
      { fecha: "2026-02-01", valor: 8.6 },
      { fecha: "2026-08-01", valor: 7.1 },
    ],
    COLESTEROL_LDL: [
      { fecha: "2026-02-01", valor: 100 },
      { fecha: "2026-08-01", valor: 130 },
    ],
    CREATININA: [{ fecha: "2026-08-01", valor: 1.1 }],
  },
};

// Un analito de Athenea tal como llega, con su panel padre y su fecha.
function labFecha(nombre, valor, iso) {
  return { NombreParametro: nombre, Resultado: valor, FechaResultado: iso, fechaResultado: iso };
}

module.exports = {
  nombre: "Panel del paciente: la fusión de Ficha y Riesgo (v16.8.0)",
  cubre: [
    "mtrPanelSeccionValida", "mtrPanelNavHtml", "mtrPanelResumenHtml", "mtrPanelRiesgoRenalHtml",
    "mtrPanelExamenesHtml", "mtrPanelTendenciasHtml", "mtrPanelMedicamentosHtml",
    "openPanelPacienteModal", "mtrSeriesPorAnalito", "mtrTendenciaDe", "_mtrTendUmbralGrave",
    "mtrMetaHba1cGeneral", "mtrHojaEducativaHtml",
  ],

  async pruebas(t, api, env, cargar) {
    // ---------------- Navegación ----------------
    // v17.28.0 — la sección «Medicamentos» salió del panel; el REFACTOR S+ (30-ago,
    // aprobado en canvas) la RESTAURA: mtrPanelMedicamentosHtml quedó construida,
    // probada y huérfana desde v17.28.0, y el médico la pidió de vuelta como quinta
    // pestaña. MTR_PANEL_SECCIONES quedó con CINCO: resumen, renal, exámenes,
    // tendencias y medicamentos, con rótulos acortados a lenguaje de consultorio.
    t.caso("mtrPanelSeccionValida: acepta las cinco secciones y cae en Resumen ante cualquier cosa rara", () => {
      ["resumen", "renal", "examenes", "tendencias", "medicamentos"].forEach((s) => {
        t.igual(api.mtrPanelSeccionValida(s), s, "sección válida: " + s);
      });
      t.igual(api.mtrPanelSeccionValida("inventada"), "resumen", "una sección que no existe no deja el panel en blanco");
      t.igual(api.mtrPanelSeccionValida(null), "resumen", "null tampoco");
      t.igual(api.mtrPanelSeccionValida(undefined), "resumen", "ni undefined");
    });

    t.caso("mtrPanelNavHtml: las cinco secciones, con la activa marcada para el lector de pantalla", () => {
      const html = api.mtrPanelNavHtml("tendencias");
      ["Resumen", "Riesgo y renal", "Exámenes", "Tendencias", "Medicamentos"].forEach((r) => {
        t.cierto(html.indexOf(r) >= 0, "está la sección: " + r);
      });
      t.cierto(html.indexOf('data-panel-sec="tendencias"') >= 0, "cada chip sabe a qué sección lleva");
      t.cierto(/class="vgl-panel-tab active" data-panel-sec="tendencias"/.test(html), "la pedida sale activa");
      t.igual((html.match(/aria-selected="true"/g) || []).length, 1, "solo UNA está seleccionada");
      t.igual((html.match(/role="tab"/g) || []).length, 5, "las cinco son pestañas de verdad para accesibilidad");
      t.cierto(/class="vgl-panel-tab active" data-panel-sec="resumen"/.test(api.mtrPanelNavHtml("cualquiera")),
        "una sección inválida no deja la navegación sin activa");
    });

    // ---------------- Sección 1: resumen ----------------
    t.caso("mtrPanelResumenHtml: muestra lo leído CON su fuente y cuenta lo que falta", () => {
      const html = api.mtrPanelResumenHtml(RESUMEN_DEMO);
      t.cierto(html.indexOf("Órdenes de la plataforma") >= 0, "cada dato declara de dónde salió");
      t.cierto(html.indexOf("LOSARTAN 50MG") >= 0, "los medicamentos leídos se listan");
      t.cierto(html.indexOf("lo LEÍDO, nunca lo supuesto") >= 0, "y el pie recuerda la regla de la casa");
      const vacio = api.mtrPanelResumenHtml({});
      t.cierto(vacio.indexOf("sin dato") >= 0, "sin datos se dice «sin dato», jamás se inventa un valor");
      t.cierto(api.mtrPanelResumenHtml(null).indexOf("No se pudo leer al paciente") >= 0,
        "y sin resumen se explica, en vez de dejar la sección en blanco");
    });

    // ---------------- Sección 2: riesgo y renal ----------------
    t.caso("mtrPanelRiesgoRenalHtml: publica la categoría con su porqué y las dos fórmulas", () => {
      const d = api.mtrTableroClinico(RESUMEN_DEMO);
      const html = api.mtrPanelRiesgoRenalHtml(d, "");
      t.cierto(html.indexOf("Riesgo cardiovascular") >= 0, "la categoría");
      t.cierto(html.indexOf("Por qué:") >= 0, "y por qué, que es lo que el médico revisa");
      t.cierto(html.indexOf("Cockcroft-Gault") >= 0 && html.indexOf("CKD-EPI 2021") >= 0, "las dos fórmulas renales");
      t.falso(html.indexOf("undefined") >= 0 || html.indexOf("[object") >= 0, "sin restos de programación");
    });

    t.caso("mtrPanelRiesgoRenalHtml: sin contexto NO publica categoría — pone el cartel y deja el resto", () => {
      const d = api.mtrTableroClinico(RESUMEN_DEMO);
      const html = api.mtrPanelRiesgoRenalHtml(d, "necesito leer Antecedentes y Hábitos y Gestión de Riesgo.");
      t.cierto(html.indexOf("no lo clasifico todavía") >= 0, "lo dice sin rodeos");
      t.cierto(html.indexOf("Antecedentes") >= 0, "y nombra lo que le falta leer");
      t.falso(/Riesgo cardiovascular <b>/.test(html), "NO se publica ninguna categoría: eso es lo que protege la compuerta");
      t.cierto(html.indexOf("Cockcroft-Gault") >= 0, "pero la función renal se pinta igual: sale de los laboratorios");
      t.cierto(api.mtrPanelRiesgoRenalHtml(null, "").indexOf("Sin datos suficientes") >= 0, "sin datos, se dice");
    });

    // ---------------- Sección 3: exámenes ----------------
    t.caso("mtrPanelExamenesHtml: qué ordenar, qué sigue vigente y qué programa manda", () => {
      const d = api.mtrTableroClinico(RESUMEN_DEMO);
      const html = api.mtrPanelExamenesHtml(d);
      t.cierto(html.indexOf("Qué ordenar en la próxima toma") >= 0, "lo que hay que pedir");
      t.cierto(html.indexOf("Lo que sigue vigente") >= 0, "lo que no");
      t.cierto(html.indexOf("Programa que rige las vigencias") >= 0, "y con qué regla se decidió");
      t.cierto(api.mtrPanelExamenesHtml(null).indexOf("Sin datos suficientes") >= 0, "sin datos, se dice");
    });

    // v17.0.3 — REPORTE DE CAMPO (pantallazo): "MIRA QUE SALE SIN EXAMENES VIGENTES
    // REGISTRADOS POR LO QUE ESO ME CONFUNDE" — el médico vio "Sin exámenes vigentes
    // registrados" justo debajo de una lista de 8 exámenes ya listados en "Qué ordenar",
    // y lo leyó como que faltaban datos. La causa: "vigentes" es SOLO lo que sobra del
    // programa después de sacar lo que ya está en "ordenar" — con un programa corto
    // (HTA) es NORMAL que quede vacío porque el programa completo ya cupo arriba. El
    // texto ahora distingue ese caso ("ya está todo arriba") del caso de verdad vacío
    // (todavía no hay NADA del programa, ni ordenar ni vigentes).
    t.caso("mtrPanelExamenesHtml (v17.0.3): «Lo que sigue vigente» vacío ya NO dice siempre lo mismo — distingue «ya está todo arriba» de «no hay datos todavía»", () => {
      // Caso real del médico: programa corto, todo el programa ya cupo en "ordenar".
      const dOrdenLleno = api.mtrTableroClinico({
        programa: "HTA", factores: { hta: true },
        plan: { ordenar: [{ clave: "creatinina", nombre: "CREATININA", estado: "D", subestado: "vencido", vence: "2026-08-01" }], drivers: [], pasajeros: [] },
      });
      t.igual(dOrdenLleno.vigentes.length, 0, "fijamos el fixture: vigentes debe quedar vacío");
      t.cierto(dOrdenLleno.ordenar.length > 0, "fijamos el fixture: ordenar debe tener contenido, como en el pantallazo del médico");
      const htmlOrdenLleno = api.mtrPanelExamenesHtml(dOrdenLleno);
      t.cierto(htmlOrdenLleno.indexOf('Nada más aparte de lo que ya se muestra arriba en "Qué ordenar"') >= 0,
        "con algo en 'ordenar' y nada en 'vigentes', debe aclarar que el programa completo ya está arriba, no sonar a que faltan datos");
      t.falso(htmlOrdenLleno.indexOf("Sin exámenes vigentes registrados") >= 0, "el texto viejo que confundió al médico ya no debe aparecer");

      // Caso de verdad vacío: ni ordenar ni vigentes (no hay nada del programa todavía).
      const dTodoVacio = api.mtrTableroClinico({
        programa: "HTA", factores: { hta: true },
        plan: { ordenar: [], drivers: [], pasajeros: [] },
      });
      const htmlTodoVacio = api.mtrPanelExamenesHtml(dTodoVacio);
      t.cierto(htmlTodoVacio.indexOf("Todavía no hay resultados de este programa para calcular vigencias.") >= 0,
        "sin ordenar y sin vigentes, el mensaje debe ser el de 'no hay datos', distinto del de 'ya está arriba'");

      // Con vigentes real (y algo también en ordenar, para no cruzarse con el mensaje
      // de "Nada por ordenar", que es un caso distinto): se lista, y ninguno de los dos
      // mensajes de "Lo que sigue vigente" vacío se cuela.
      const dConVigentes = api.mtrTableroClinico({
        programa: "HTA", factores: { hta: true },
        plan: {
          ordenar: [{ clave: "hemoglobina", nombre: "HEMOGLOBINA", estado: "D", subestado: "vencido", vence: "2026-08-01" }],
          drivers: [{ clave: "creatinina", nombre: "CREATININA", estado: "D", vence: "2026-08-01" }],
          pasajeros: [],
        },
      });
      const htmlConVigentes = api.mtrPanelExamenesHtml(dConVigentes);
      t.cierto(htmlConVigentes.indexOf("CREATININA") >= 0, "con vigentes reales, se listan");
      t.falso(htmlConVigentes.indexOf('Nada más aparte de lo que ya se muestra arriba') >= 0, "con vigentes reales no debe aparecer el mensaje de 'ya está arriba'");
      t.falso(htmlConVigentes.indexOf('Todavía no hay resultados de este programa') >= 0, "ni el mensaje de 'no hay datos'");
    });

    // ---------------- Sección 4: tendencias ----------------
    t.caso("mtrPanelTendenciasHtml: compara contra el control anterior y marca si mejora o empeora", () => {
      const html = api.mtrPanelTendenciasHtml(RESUMEN_DEMO);
      t.cierto(html.indexOf("bajó de 8.6 a 7.1") >= 0, "dice el cambio con números (HbA1c)");
      t.cierto(/vgl-tend-fila mejora[\s\S]*Hemoglobina|mejora/.test(html), "y que bajar la HbA1c es mejorar");
      t.cierto(html.indexOf("empeora") >= 0, "mientras que subir el LDL empeora");
      t.cierto(html.indexOf("Creatinina en Suero") >= 0, "el analito con un solo control se nombra…");
      t.cierto(html.indexOf("todavía sin tendencia") >= 0, "…pero se dice que todavía no hay tendencia: no se dibuja una línea de un punto");
      t.cierto(html.indexOf("control ANTERIOR") >= 0, "el pie explica contra qué se compara");
      t.cierto(api.mtrPanelTendenciasHtml({}).indexOf("Todavía no hay serie") >= 0, "sin series, se explica en vez de quedar en blanco");
    });

    // ---------------- Sección 5: medicamentos ----------------
    t.caso("mtrPanelMedicamentosHtml: lista lo que toma y, sin lista, NO opina a ciegas", () => {
      const html = api.mtrPanelMedicamentosHtml(RESUMEN_DEMO);
      t.cierto(html.indexOf("LOSARTAN 50MG") >= 0, "lo que está tomando");
      t.cierto(html.indexOf("METFORMINA 850MG") >= 0, "todo, no solo el primero");
      // v17.0.2 — «no se pudo leer» (null) y «no toma nada» ([]) son cosas distintas y se
      // dicen distinto: colapsarlas afirmaba en el registro que el paciente no tomaba nada.
      const noLeido = api.mtrPanelMedicamentosHtml({ erc: { egfr: 55 }, medicamentos: null });
      t.cierto(noLeido.indexOf("No se pudo leer") >= 0, "sin lectura se dice que NO se pudo leer");
      t.cierto(noLeido.indexOf("no quiere decir que no tome nada") >= 0, "con la advertencia explícita");
      t.cierto(noLeido.indexOf("no se opina a ciegas") >= 0, "y por qué eso impide revisar dosis e interacciones");
      const sinNinguno = api.mtrPanelMedicamentosHtml({ erc: { egfr: 55 }, medicamentos: [] });
      t.cierto(sinNinguno.indexOf("no reporta medicamentos activos") >= 0, "y una lista vacía de verdad se dice como tal");
    });

    // v17.2.0 (#114) — la frecuencia (HistoricoMedicamentoHCM) junto al nombre, SOLO
    // cuando el histórico trajo coincidencia. Sin médicamentosFrecuencia, o sin match
    // para un fármaco puntual, la línea sale IDÉNTICA a como salía antes de #114 — eso
    // es justo lo que separan estos dos casos.
    t.caso("mtrPanelMedicamentosHtml (#114): la frecuencia sale junto al nombre SOLO cuando el histórico la trajo", () => {
      const frecuencias = new Map([[api._mtrClaveDedupMedicamento("LOSARTAN 50MG"), "cada 1 día"]]);
      const conFrecuencia = Object.assign({}, RESUMEN_DEMO, { medicamentosFrecuencia: frecuencias });
      const html = api.mtrPanelMedicamentosHtml(conFrecuencia);
      t.cierto(html.indexOf('<span class="vgl-tab-frec">(cada 1 día)</span>') >= 0,
        "LOSARTAN, que sí tiene coincidencia, muestra su frecuencia entre paréntesis");
      t.cierto(/LOSARTAN 50MG <span class="vgl-tab-frec">/.test(html),
        "pegada al nombre exacto, no a cualquier parte del HTML");
      t.cierto(html.indexOf("METFORMINA 850MG</span>") >= 0,
        "METFORMINA, sin coincidencia en el histórico, sale IGUAL que siempre — sin paréntesis ni span vacío");
      t.cierto(!/METFORMINA 850MG <span class="vgl-tab-frec"/.test(html),
        "y no le inventa una frecuencia que no llegó");
      // El caso de toda la vida (ya probado arriba con RESUMEN_DEMO, que no trae el campo):
      // ningún .vgl-tab-frec en absoluto — el span nuevo no aparece si no hay Map que
      // consultar, ni por accidente ni por un `undefined` que se cuele en el HTML.
      const sinCampo = api.mtrPanelMedicamentosHtml(RESUMEN_DEMO);
      t.cierto(sinCampo.indexOf("vgl-tab-frec") === -1,
        "sin medicamentosFrecuencia, la vista de siempre no cambia ni un carácter de más");
    });

    // ---------------- Las series, desde los laboratorios crudos ----------------
    t.caso("mtrSeriesPorAnalito: arma la serie por analito, ordenada y sin repetir el mismo día", () => {
      const series = api.mtrSeriesPorAnalito([
        labFecha("GLICEMIA", "180", "2026-08-01"),
        labFecha("GLICEMIA", "150", "2026-02-01"),
        labFecha("GLICEMIA", "999", "2026-08-01"),      // mismo día repetido: no es otro control
        labFecha("CREATININA EN SUERO", "POSITIVO", "2026-08-01"),  // cualitativo: no hace serie
        labFecha("GLICEMIA", "160", null),                  // sin fecha: no se puede ubicar
      ]);
      t.cierto(!!series.GLUCOSA, "hay serie de glucosa");
      t.igual(series.GLUCOSA.length, 2, "dos controles, no cuatro");
      t.igual(series.GLUCOSA[0].fecha, "2026-02-01", "de la más vieja…");
      t.igual(series.GLUCOSA[1].valor, 180, "…a la más nueva");
      t.cierto(series.CREATININA === undefined, "un resultado cualitativo no se grafica: " + JSON.stringify(series));
      t.igual(Object.keys(api.mtrSeriesPorAnalito(null)).length, 0, "sin laboratorios, sin series, y sin lanzar");
    });

    t.caso("mtrSeriesPorAnalito: se queda con los últimos N controles, no con la historia entera", () => {
      const muchos = [];
      for (let i = 1; i <= 9; i++) muchos.push(labFecha("GLICEMIA", String(100 + i), "2026-0" + (i > 8 ? 9 : i) + "-01"));
      const s = api.mtrSeriesPorAnalito(muchos, { maxPuntos: 4 });
      t.igual(s.GLUCOSA.length, 4, "cuatro puntos, los más recientes");
      t.igual(s.GLUCOSA[3].valor, 109, "y el último es el último de verdad");
    });

    t.caso("mtrTendenciaDe: el ruido del laboratorio no es un cambio", () => {
      const casi = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 100 }, { fecha: "2026-06-01", valor: 103 }], "COLESTEROL_LDL");
      t.igual(casi.direccion, "estable", "un 3 % es el mismo control con otra tinta");
      t.cierto(casi.texto.indexOf("estable") >= 0, "y así se dice");
      const sube = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 100 }, { fecha: "2026-06-01", valor: 130 }], "COLESTEROL_LDL");
      t.igual(sube.direccion, "sube");
      t.igual(sube.sentido, "empeora", "subir el LDL es empeorar");
      // v17.0.2 — «TFG» no es una clave de la lista blanca (era una entrada muerta del
      // mapa). El caso clínico es el mismo con HEMOGLOBINA, que sí se mide y sí baja.
      const hb = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 13.0 }, { fecha: "2026-06-01", valor: 8.2 }], "HEMOGLOBINA");
      t.igual(hb.sentido, "empeora", "BAJAR la hemoglobina también es empeorar: el sentido lo pone la clínica, no el signo");
      // Y las cuatro claves que faltaban en el mapa ya tienen sentido definido.
      ["PTH", "FOSFORO", "ALBUMINA", "HEMOGLOBINA"].forEach((k) => {
        const t2 = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 10 }, { fecha: "2026-06-01", valor: 20 }], k);
        t.cierto(t2.sentido === "mejora" || t2.sentido === "empeora",
          k + " ya no sale neutro: antes un desplome se pintaba gris, igual que un analito estable");
      });
      t.igual(api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 5 }], "HBA1C").direccion, "sin serie", "un solo control no es una tendencia");
      t.igual(api.mtrTendenciaDe(null, "HBA1C").n, 0, "y sin serie no se lanza");
    });

    // ================= v17.1.0 (#123) — EL TERCER NIVEL: EL ROJO =================
    // El médico lo esperaba y nunca salía: `sentido` era binario y el CSS solo tenía
    // .mejora y .empeora. Decisión suya del 21-ago: rojo si el salto es ≥25 % en el
    // sentido malo O si el valor queda fuera de meta grave — cualquiera de las dos.
    // v17.55.0 (29-ago) — el rojo por VALOR empieza EN la meta: el factor +30 %
    // desapareció (decisión tomada con la medición delante, 130 de 137 vectores con
    // LDL quedan en rojo). La «falla grave» de la Parte B se separó y la decide solo
    // la regla renal; esta línea es SOLO el color de las tendencias.
    t.caso("#123 rojo por SALTO: empeorar 25 % o más en un solo control es grave", () => {
      const justo = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 100 }, { fecha: "2026-06-01", valor: 120 }], "COLESTEROL_TOTAL");
      t.igual(justo.sentido, "empeora");
      t.igual(justo.gravedad, null, "un 20 % empeora, pero todavía no es grave");
      const grave = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 100 }, { fecha: "2026-06-01", valor: 130 }], "COLESTEROL_TOTAL");
      t.igual(grave.gravedad, "grave", "un 30 % sí");
      t.cierto(/30 %/.test(grave.motivoGrave), "y se dice por qué: " + grave.motivoGrave);
      const mejorando = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 130 }, { fecha: "2026-06-01", valor: 90 }], "COLESTEROL_TOTAL");
      t.igual(mejorando.gravedad, null, "un salto grande hacia el lado BUENO no es grave: es una mejoría");
      t.igual(mejorando.sentido, "mejora");
    });

    t.caso("#123 rojo por VALOR: fuera de meta grave, aunque no se haya movido", () => {
      const serie = [{ fecha: "2026-01-01", valor: 130 }, { fecha: "2026-06-01", valor: 131 }];
      // Riesgo ALTO -> meta de LDL 70; el rojo empieza EN la meta (v17.55.0, factor 1).
      const conRiesgo = api.mtrTendenciaDe(serie, "COLESTEROL_LDL", { categoriaRiesgo: "alto" });
      t.igual(conRiesgo.direccion, "estable", "no se movió");
      t.igual(conRiesgo.gravedad, "grave", "pero 131 con meta 70 es falla grave, se haya movido o no");
      t.cierto(/meta de 70/.test(conRiesgo.motivoGrave), conRiesgo.motivoGrave);
      // Y con riesgo BAJO la meta es 116: 131 también la sobrepasa. La v17.55.0 retiró el
      // +30 % (antes el corte era 116+30 % = 150,8 y 131 no llegaba): la meta es del
      // paciente, no del analito — y el rojo ahora es «sobre la meta», sin colchón.
      const conBajo = api.mtrTendenciaDe(serie, "COLESTEROL_LDL", { categoriaRiesgo: "bajo" });
      t.igual(conBajo.gravedad, "grave", "131 con meta 116 ya está sobre la meta: rojo en riesgo bajo también");
      t.cierto(/meta de 116/.test(conBajo.motivoGrave), conBajo.motivoGrave);
    });

    t.caso("#123: SIN contexto no hay rojo por valor — no se inventa una meta", () => {
      const serie = [{ fecha: "2026-01-01", valor: 130 }, { fecha: "2026-06-01", valor: 131 }];
      t.igual(api.mtrTendenciaDe(serie, "COLESTEROL_LDL").gravedad, null, "sin categoría de riesgo, sin meta");
      t.igual(api.mtrTendenciaDe(serie, "COLESTEROL_LDL", {}).gravedad, null, "un contexto vacío tampoco la inventa");
      t.igual(api.mtrTendenciaDe(serie, "COLESTEROL_LDL", { categoriaRiesgo: "no existe" }).gravedad, null,
        "ni una categoría que el script no conoce");
    });

    t.caso("#123: RAC ≥300 es macroalbuminuria — el mismo corte que ya dispara la remisión a nefrología", () => {
      t.igual(api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 290 }, { fecha: "2026-06-01", valor: 295 }], "RAC").gravedad, null);
      const macro = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 290 }, { fecha: "2026-06-01", valor: 320 }], "RAC");
      t.igual(macro.gravedad, "grave");
      t.cierto(/corte de 300/.test(macro.motivoGrave), macro.motivoGrave);
    });

    t.caso("#123: HbA1c usa la meta del paciente cuando la hay, y 7,0 cuando no", () => {
      const serie = [{ fecha: "2026-01-01", valor: 9.0 }, { fecha: "2026-06-01", valor: 9.2 }];
      t.igual(api.mtrTendenciaDe(serie, "HBA1C").gravedad, "grave", "9,2 con meta 7,0 (rojo sobre la meta)");
      // v17.55.0 — el corte ya NO sube con el +30 % (antes: 8,0+30 % = 10,4 y 9,2 no
      // llegaba). La meta individual es el tope: 9,2 sobre 8,0 es rojo.
      const conMeta = api.mtrTendenciaDe(serie, "HBA1C", { metaHba1c: 8.0 });
      t.igual(conMeta.gravedad, "grave", "9,2 con meta individual de 8,0 está sobre ella: rojo");
      t.cierto(/meta de 8/.test(conMeta.motivoGrave), conMeta.motivoGrave);
    });

    // v17.6.3 — Flujo de la meta de HbA1c (decisión del médico, 22-ago): la meta GENERAL
    // se configura en Ajustes (S.metaHba1cGeneral, 5–12 %); la meta INDIVIDUAL del
    // paciente gana sobre ella. Fuera de rango o ausente → 7,0 (la regla de siempre).
    t.caso("v17.6.3 — mtrMetaHba1cGeneral: 7,0 de fábrica; la de Ajustes (5–12) la reemplaza; fuera de rango vuelve a 7,0", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrMetaHba1cGeneral(), 7.0, "sin configurar: 7,0 (la regla de siempre)");
      c.env.almacen["vgl_cfg"] = JSON.stringify(Object.assign({}, JSON.parse(c.env.almacen["vgl_cfg"] || "{}"), { metaHba1cGeneral: 7.5 }));
      // El CONFIG se lee al cargar; recargamos el entorno con el almacén ya modificado.
      const c2 = cargar({ silencioso: true, almacen: c.env.almacen });
      t.igual(c2.api.mtrMetaHba1cGeneral(), 7.5, "configurada en 7,5: la general pasa a 7,5");
      const c3 = cargar({ silencioso: true, almacen: Object.assign({}, c.env.almacen, { vgl_cfg: JSON.stringify(Object.assign({}, JSON.parse(c.env.almacen["vgl_cfg"] || "{}"), { metaHba1cGeneral: 13 })) }) });
      t.igual(c3.api.mtrMetaHba1cGeneral(), 7.0, "13 % está fuera de rango (5–12): cae a 7,0, no se acepta un valor absurdo");
    });

    // v17.6.3 — B5 (decisión del médico, 22-ago): hoja educativa imprimible para el
    // paciente. Texto estándar de la casa; los únicos datos del paciente que viajan son
    // los del resumen real (riesgo, pendientes, meta de HbA1c, nombre).
    t.caso("v17.6.3 — mtrHojaEducativaHtml: secciones según el resumen (alarmas, dieta, actividad, pendientes, meta, riesgo)", () => {
      const hoja = api.mtrHojaEducativaHtml({
        programa: "DM2",
        riesgo: { categoria: "muy alto" },
        plan: { vencidos: [{ clave: "LDL" }], faltantes: [{ clave: "RAC" }] },
        hba1c: { meta: 7.0, actual: 8.2 },
      }, { nombre: "PACIENTE DE PRUEBA", hoyIso: "2026-08-17" });
      t.cierto(/Signos de alarma/.test(hoja), "riesgo muy alto → sección de signos de alarma");
      t.cierto(/Alimentación/.test(hoja) && /Actividad física/.test(hoja), "programa RCV (DM2) → dieta y actividad");
      // v17.8.0 — los pendientes viajan por mtrNombreLegibleAnalito: la clave interna
      // «RAC» sale como «Relación albúmina/creatinina» (el paciente no se lleva a casa
      // un papel con una sigla de base de datos). «LDL», por ser sigla clínica de uso
      // diario, se conserva tal cual.
      t.cierto(/LDL/.test(hoja) && /Relación albúmina\/creatinina/.test(hoja),
        "los exámenes vencidos y faltantes se listan, con el nombre que el paciente entiende");
      t.cierto(/Su meta de hemoglobina glicosilada/.test(hoja) && /7\s*%/.test(hoja), "la meta de HbA1c del paciente aparece con su valor");
      t.cierto(/MUY ALTO/.test(hoja), "la categoría de riesgo viaja en mayúsculas");
      t.cierto(/PACIENTE DE PRUEBA/.test(hoja), "el nombre va en el encabezado (impresión local, no PHI en el código)");
    });

    t.caso("v17.6.3 — mtrHojaEducativaHtml: sin riesgo ni pendientes sigue siendo un documento imprimible (no inventa secciones)", () => {
      const hoja = api.mtrHojaEducativaHtml({ programa: "HTA" }, { nombre: "", hoyIso: "2026-08-17" });
      t.cierto(/<!doctype html>/i.test(hoja) && /Hoja educativa/.test(hoja), "es un documento HTML con título");
      t.falso(/Signos de alarma/.test(hoja), "sin riesgo muy alto ni falla: no se inventa la sección de alarmas");
      t.falso(/Su meta de hemoglobina/.test(hoja), "sin hba1c.meta: no se inventa una meta");
      t.cierto(/Medicamentos/.test(hoja), "la sección de medicamentos (adherencia) siempre está");
    });

    t.caso("#123: los analitos SIN meta propia se juzgan con el rango del PROPIO laboratorio", () => {
      // Hemoglobina: el script no tiene umbral clínico para ella (solo periodicidad), así
      // que el corte lo pone Athenea con cada resultado. Bajar es empeorar.
      // Caída del 12 % — por debajo del 25 % del salto, para que lo que se pruebe aquí sea
      // el rango y no la otra regla.
      const fuera = api.mtrTendenciaDe([
        { fecha: "2026-01-01", valor: 12.5, min: 12, max: 16 },
        { fecha: "2026-06-01", valor: 11.0, min: 12, max: 16 },
      ], "HEMOGLOBINA");
      t.igual(fuera.gravedad, "grave", "11,0 con rango 12–16 está fuera por el lado malo, aunque el salto sea pequeño");
      t.cierto(/rango del laboratorio/.test(fuera.motivoGrave), fuera.motivoGrave);
      // Y el desplome del caso real (13,0 → 8,2) es grave por las DOS vías a la vez.
      const desplome = api.mtrTendenciaDe([
        { fecha: "2026-01-01", valor: 13.0, min: 12, max: 16 },
        { fecha: "2026-06-01", valor: 8.2, min: 12, max: 16 },
      ], "HEMOGLOBINA");
      t.igual(desplome.gravedad, "grave", "el caso que motivó la v17.0.2 ya no se pinta gris");
      const dentro = api.mtrTendenciaDe([
        { fecha: "2026-01-01", valor: 15.5, min: 12, max: 16 },
        { fecha: "2026-06-01", valor: 12.5, min: 12, max: 16 },
      ], "HEMOGLOBINA");
      t.igual(dentro.gravedad, null, "bajó bastante pero sigue dentro del rango: ámbar, no rojo");
    });

    t.caso("#123: sin rango del laboratorio, un analito sin meta NUNCA se pinta rojo", () => {
      // Casilla vacía antes que dato inventado, aplicado al color.
      t.igual(api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 5 }, { fecha: "2026-06-01", valor: 5.2 }], "PTH").gravedad, null);
      t.igual(api.mtrTendenciaDe([
        { fecha: "2026-01-01", valor: 5, min: 0, max: 0 },
        { fecha: "2026-06-01", valor: 5.2, min: 0, max: 0 },
      ], "FOSFORO").gravedad, null, "un rango degenerado (0–0) no es un rango");
    });

    t.caso("_mtrTendUmbralGrave: solo conoce los cinco analitos con umbral propio", () => {
      t.cierto(!!api._mtrTendUmbralGrave("TRIGLICERIDOS", {}), "triglicéridos: meta 150 fija");
      t.cierto(!!api._mtrTendUmbralGrave("HBA1C", {}), "HbA1c: 7,0 por defecto");
      t.cierto(!!api._mtrTendUmbralGrave("RAC", {}), "RAC: corte 300");
      t.cierto(!!api._mtrTendUmbralGrave("COLESTEROL_LDL", { categoriaRiesgo: "alto" }), "LDL: según riesgo");
      t.igual(api._mtrTendUmbralGrave("COLESTEROL_LDL", {}), null, "LDL sin riesgo no tiene meta");
      ["HEMOGLOBINA", "PTH", "FOSFORO", "ALBUMINA", "COLESTEROL_TOTAL", "COLESTEROL_HDL", "GLUCOSA"].forEach((k) => {
        t.igual(api._mtrTendUmbralGrave(k, { categoriaRiesgo: "alto" }), null,
          k + ": el script NO tiene umbral clínico propio y no se inventa uno");
      });
    });

    t.caso("#123: el HTML emite la clase 'grave' y NUNCA dos clases de color a la vez", () => {
      const html = api.mtrPanelTendenciasHtml({
        riesgo: { categoria: "alto" },
        _series: { COLESTEROL_LDL: [{ fecha: "2026-01-01", valor: 130 }, { fecha: "2026-06-01", valor: 131 }] },
      });
      t.cierto(/vgl-tend-fila grave/.test(html), "sale la clase roja");
      t.falso(/vgl-tend-fila (grave empeora|empeora grave)/.test(html), "y sustituye a la de sentido, no se suma");
      t.cierto(/vgl-tend-grave-motivo/.test(html), "con el motivo a la vista");
      t.cierto(/En rojo/.test(html), "y el pie explica qué significa el rojo, solo cuando hay alguno");
      const sano = api.mtrPanelTendenciasHtml({
        _series: { COLESTEROL_TOTAL: [{ fecha: "2026-01-01", valor: 180 }, { fecha: "2026-06-01", valor: 178 }] },
      });
      t.falso(/En rojo/.test(sano), "sin filas rojas no se explica un color que no está");
    });

    t.caso("#123: los cinco analitos que salían en MAYÚSCULA PELADA ya tienen nombre", () => {
      const html = api.mtrPanelTendenciasHtml({
        _series: {
          HBA1C: [{ fecha: "2026-01-01", valor: 6.5 }, { fecha: "2026-06-01", valor: 6.6 }],
          HEMOGLOBINA: [{ fecha: "2026-01-01", valor: 14 }, { fecha: "2026-06-01", valor: 13.9 }],
        },
      });
      t.falso(/>HBA1C</.test(html), "ya no sale la clave cruda");
      t.cierto(/Hemoglobina glicosilada|HbA1c/i.test(html), "sino su nombre de consultorio");
    });

    // ---------------- El módulo entero ----------------
    await t.casoAsync("openPanelPacienteModal: un solo módulo con las cinco secciones, y los caminos viejos aterrizan donde el médico espera", async () => {
      const c = await cargar({ silencioso: true });
      // El DOM del arnés devuelve null en querySelector: se le presta uno memoizado por
      // selector, igual que hacen las suites de los otros modales.
      const d = c.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      c.api._vglCosechaGuardar("777888999", { factores: { hta: { v: true, ts: 1 }, tabaquismo: { v: false, ts: 1 } } });
      c.api.mtrCacheResumenGuardar("777888999", RESUMEN_DEMO);

      await c.api.openPanelPacienteModal({ doc_id: "777888999", nombre: "PACIENTE DE PRUEBA" }, { seccion: "tendencias" });
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      t.cierto(!!modal, "el módulo unificado abre");
      const nav = String((modal.querySelector("#vgl-panel-nav-slot") || {}).innerHTML || "");
      t.igual((nav.match(/data-panel-sec=/g) || []).length, 5, "con sus cinco secciones (Medicamentos restaurada en el REFACTOR S+)");
      t.cierto(/data-panel-sec="tendencias"[^>]*aria-selected="true"|active" data-panel-sec="tendencias"/.test(nav),
        "y aterriza en la sección pedida");
      const cuerpo = String((modal.querySelector("#vgl-panel-cuerpo") || {}).innerHTML || "");
      t.cierto(cuerpo.indexOf("Cómo viene evolucionando") >= 0, "que es la de tendencias");
    });

    // =====================================================================
    // v17.6.0 — META DE HbA1c INDIVIDUAL, de punta a punta dentro del Panel: clic en el
    // lápiz -> aparece el formulario -> un valor fuera de 5-12 % se rechaza SIN guardar
    // nada y sin perder el formulario -> un valor válido se guarda en la cosecha del
    // paciente y el Panel confirma. La tubería (que el valor de HbA1c y la meta lleguen
    // hasta aquí) ya se prueba en la suite 47; esto prueba el CABLEADO del DOM, que es
    // lo único que faltaba.
    // =====================================================================
    await t.casoAsync("openPanelPacienteModal: fijar la meta individual de HbA1c — clic, valor inválido rechazado, valor válido guardado", async () => {
      const c = await cargar({ silencioso: true });
      const d = c.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      // Un resumen con HbA1c medida (8,2 %) y SIN meta individual todavía — el caso real
      // que motivó el ítem 3: un paciente de 85 años al que la meta general (7,0 %) no
      // le aplica.
      const resumenConHba1c = Object.assign({}, RESUMEN_DEMO, {
        factores: Object.assign({}, RESUMEN_DEMO.factores, { edad: 85 }),
        hba1c: { actual: 8.2 },
      });
      c.api.mtrCacheResumenGuardar("707070707", resumenConHba1c);

      await c.api.openPanelPacienteModal({ doc_id: "707070707", nombre: "PACIENTE DE PRUEBA" }, { seccion: "renal" });
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      const cuerpo = modal.querySelector("#vgl-panel-cuerpo");
      t.cierto(String(cuerpo.innerHTML).indexOf('data-accion="editar-meta-hba1c"') >= 0,
        "con HbA1c medida y diabetes, el Panel muestra el botón de editar la meta");

      const boton = cuerpo.querySelector('[data-accion="editar-meta-hba1c"]');
      t.cierto(!!(boton._listeners && boton._listeners.click), "el botón quedó con su manejador de clic");
      boton._listeners.click[0]();

      const fila = cuerpo.querySelector("#vgl-meta-fila-hba1c");
      t.cierto(fila.innerHTML.indexOf('id="vgl-meta-hba1c-input"') >= 0, "el clic reemplaza la fila por el formulario");
      t.cierto(fila.innerHTML.indexOf('value="7"') >= 0,
        "sin meta individual previa, el campo arranca en la meta general (MTR_HBA1C_META_DM2 = 7)");

      const inp = fila.querySelector("#vgl-meta-hba1c-input");
      const guardar = fila.querySelector("#vgl-meta-hba1c-guardar");

      // ---- valor inválido: se rechaza, no se guarda nada, el formulario sigue ahí ----
      inp.value = "20";
      await guardar._listeners.click[0]();
      const errEl = fila.querySelector("#vgl-meta-hba1c-error");
      t.cierto(/entre 5 % y 12 %/.test(errEl.textContent), "un valor fuera de rango se explica en la propia fila");
      t.falso(!!(c.api._vglCosechaLeer("707070707") || {}).metaHba1cManual,
        "y NO se guarda nada — la cosecha del paciente sigue sin meta individual");

      // ---- valor válido: se guarda, y el Panel lo confirma ----
      inp.value = "7.6";
      await guardar._listeners.click[0]();
      t.igual(c.api._vglCosechaLeer("707070707").metaHba1cManual.v, 7.6,
        "el valor válido queda guardado en la cosecha del paciente, listo para que el motor lo use en la próxima clasificación");
      t.cierto(String(cuerpo.innerHTML).indexOf("Meta de HbA1c actualizada") >= 0,
        "y el Panel se lo confirma al médico");
    });

    // =====================================================================
    // v17.6.1 — TRES HUECOS QUE LA PRUEBA DE ARRIBA NO CUBRÍA, SEÑALADOS POR UNA
    // AUDITORÍA DE PRODUCCIÓN: la prueba de arriba solo probaba un valor cómodamente
    // fuera de rango (20) y un valor válido cualquiera (7,6) — nunca los BORDES exactos
    // de `v >= 5 && v <= 12` (donde vive el error clásico de off-by-one: `>`/`<` en vez
    // de `>=`/`<=` habría rechazado justo 5 y 12, que sí deben aceptarse), nunca qué pasa
    // si se REABRE el editor después de guardar (¿el campo arranca en el valor ya guardado,
    // o vuelve a mostrar la meta general como si nada?), y nunca un payload con forma de
    // XSS — solo números "raros". Las tres quedan cubiertas aquí.
    // =====================================================================
    await t.casoAsync("openPanelPacienteModal: meta de HbA1c — los bordes EXACTOS 5 % y 12 % se aceptan, 4,9 % y 12,1 % se rechazan", async () => {
      const c = await cargar({ silencioso: true });
      const d = c.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      const resumenConHba1c = Object.assign({}, RESUMEN_DEMO, {
        factores: Object.assign({}, RESUMEN_DEMO.factores, { edad: 85 }),
        hba1c: { actual: 8.2 },
      });

      const abrirEditorYProbar = async (docId, valorTexto) => {
        c.api.mtrCacheResumenGuardar(docId, resumenConHba1c);
        await c.api.openPanelPacienteModal({ doc_id: docId, nombre: "PACIENTE DE PRUEBA" }, { seccion: "renal" });
        const modal = c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
        const cuerpo = modal.querySelector("#vgl-panel-cuerpo");
        cuerpo.querySelector('[data-accion="editar-meta-hba1c"]')._listeners.click[0]();
        const fila = cuerpo.querySelector("#vgl-meta-fila-hba1c");
        const inp = fila.querySelector("#vgl-meta-hba1c-input");
        const guardar = fila.querySelector("#vgl-meta-hba1c-guardar");
        inp.value = valorTexto;
        await guardar._listeners.click[0]();
        return { fila, guardada: !!(c.api._vglCosechaLeer(docId) || {}).metaHba1cManual };
      };

      const r5 = await abrirEditorYProbar("bordeinf5", "5");
      t.cierto(r5.guardada, "5 % exacto es el borde inferior INCLUSIVE: debe aceptarse");
      t.igual(c.api._vglCosechaLeer("bordeinf5").metaHba1cManual.v, 5, "y quedar guardado tal cual, sin redondear ni desplazar");

      const r12 = await abrirEditorYProbar("bordesup12", "12");
      t.cierto(r12.guardada, "12 % exacto es el borde superior INCLUSIVE: debe aceptarse");
      t.igual(c.api._vglCosechaLeer("bordesup12").metaHba1cManual.v, 12, "y quedar guardado tal cual");

      const rBajo = await abrirEditorYProbar("fuerainf49", "4.9");
      t.falso(rBajo.guardada, "4,9 % — un pelo por debajo del borde — debe rechazarse");
      t.cierto(/entre 5 % y 12 %/.test(rBajo.fila.querySelector("#vgl-meta-hba1c-error").textContent));

      const rAlto = await abrirEditorYProbar("fuerasup121", "12.1");
      t.falso(rAlto.guardada, "12,1 % — un pelo por encima del borde — debe rechazarse");
      t.cierto(/entre 5 % y 12 %/.test(rAlto.fila.querySelector("#vgl-meta-hba1c-error").textContent));
    });

    await t.casoAsync("openPanelPacienteModal: meta de HbA1c — para un paciente que YA tiene una meta individual guardada, el editor arranca en ESE valor, no en la meta general", async () => {
      // v17.6.1 — el otro extremo del mismo `actual = _resumen.hba1c.meta ?? MTR_HBA1C_META_DM2`
      // que la prueba de arriba ya cubre para "sin meta individual" (arranca en 7). Este
      // fixture simula al paciente que YA llegó con una meta guardada de una sesión
      // anterior — `hba1c.meta` viene con 9,5 desde el resumen cacheado, tal como lo
      // dejaría una recalculación real que sí lee `metaHba1cManual` de la cosecha (esa
      // lectura, de punta a punta, ya se prueba en la suite 47). Se prueba aquí la otra
      // mitad: dado un resumen que YA trae la meta individual, ¿el formulario la respeta
      // al abrirse, o la pisa con la general? No debe pisarla.
      const c = await cargar({ silencioso: true });
      const d = c.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      const resumenConMetaYaGuardada = Object.assign({}, RESUMEN_DEMO, {
        factores: Object.assign({}, RESUMEN_DEMO.factores, { edad: 85 }),
        hba1c: { actual: 8.2, meta: 9.5 },
      });
      c.api.mtrCacheResumenGuardar("yaguardadohba1c", resumenConMetaYaGuardada);

      await c.api.openPanelPacienteModal({ doc_id: "yaguardadohba1c", nombre: "PACIENTE DE PRUEBA" }, { seccion: "renal" });
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      const cuerpo = modal.querySelector("#vgl-panel-cuerpo");
      const extra = String(cuerpo.innerHTML).match(/vgl-tab-mini">([^<]*meta individual[^<]*)</);
      t.cierto(!!extra, "la fila ya avisa, antes de abrir el editor, que esta es la meta individual del paciente");

      cuerpo.querySelector('[data-accion="editar-meta-hba1c"]')._listeners.click[0]();
      const fila = cuerpo.querySelector("#vgl-meta-fila-hba1c");
      t.cierto(fila.innerHTML.indexOf('value="9.5"') >= 0,
        "el campo arranca en 9,5 — la meta YA guardada — no en 7 (la general): la precedencia es correcta al reabrir");
    });

    await t.casoAsync("openPanelPacienteModal: meta de HbA1c — un payload con forma de XSS se rechaza igual que cualquier otro valor no numérico, y nunca queda reflejado en el DOM", async () => {
      const c = await cargar({ silencioso: true });
      const d = c.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      const resumenConHba1c = Object.assign({}, RESUMEN_DEMO, {
        factores: Object.assign({}, RESUMEN_DEMO.factores, { edad: 85 }),
        hba1c: { actual: 8.2 },
      });
      c.api.mtrCacheResumenGuardar("xsshba1c", resumenConHba1c);

      await c.api.openPanelPacienteModal({ doc_id: "xsshba1c", nombre: "PACIENTE DE PRUEBA" }, { seccion: "renal" });
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      const cuerpo = modal.querySelector("#vgl-panel-cuerpo");
      cuerpo.querySelector('[data-accion="editar-meta-hba1c"]')._listeners.click[0]();
      const fila = cuerpo.querySelector("#vgl-meta-fila-hba1c");
      const inp = fila.querySelector("#vgl-meta-hba1c-input");
      const guardar = fila.querySelector("#vgl-meta-hba1c-guardar");

      const payload = '<img src=x onerror=alert(1)>';
      inp.value = payload;
      await guardar._listeners.click[0]();

      t.falso(!!(c.api._vglCosechaLeer("xsshba1c") || {}).metaHba1cManual,
        "mtrFloat() lo trata como no-numérico: se rechaza por la MISMA puerta que cualquier basura, nunca se guarda");
      t.cierto(/entre 5 % y 12 %/.test(fila.querySelector("#vgl-meta-hba1c-error").textContent),
        "el mensaje de error es el genérico de siempre — no repite el payload");
      t.falso(cuerpo.innerHTML.indexOf(payload) >= 0,
        "el payload jamás queda reflejado, ni escapado ni crudo, en ningún punto del modal");
    });

    await t.casoAsync("openPanelPacienteModal: sin documento no abre una ventana vacía", async () => {
      const c = await cargar({ silencioso: true });
      await c.api.openPanelPacienteModal(null);
      t.falso(!!c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal"), "no se abre y se dice por qué");
    });

    // ===== INJERTADO EN LA FUSIÓN main<-rama (v18.0.6): casos que solo
    // existían en la rama de trabajo y que main había perdido. =====
    t.caso("mtrPanelResumenBentoDatos: riesgo alto/muy alto o alerta renal → «pend»; bajo/moderado sin alerta → «ok»; sin categoría → «nd»", () => {
      const dSinCat = api.mtrTableroClinico({});
      const cSinCat = api.mtrPanelResumenBentoDatos({}, dSinCat).find((c) => c.id === "renal");
      t.igual(cSinCat.estado, "nd", "sin categoría de riesgo, no se opina");

      const dBajo = api.mtrTableroClinico({ riesgo: { categoria: "bajo" }, erc: {} });
      t.igual(api.mtrPanelResumenBentoDatos({}, dBajo).find((c) => c.id === "renal").estado, "ok", "riesgo bajo, sin alertas renales: al día");

      const dAlto = api.mtrTableroClinico({ riesgo: { categoria: "alto" }, erc: {} });
      t.igual(api.mtrPanelResumenBentoDatos({}, dAlto).find((c) => c.id === "renal").estado, "pend", "riesgo alto: siempre a revisar, aunque el riñón esté callado");

      // Riesgo bajo pero con sospecha de injuria renal: la tarjeta SÍ debe alertar —
      // el criterio no es solo la categoría, es el mismo conjunto de alertas que ya
      // pinta mtrPanelRiesgoRenalHtml.
      const dIra = api.mtrTableroClinico({ riesgo: { categoria: "bajo" }, erc: { sospechaIra: true } });
      const cIra = api.mtrPanelResumenBentoDatos({}, dIra).find((c) => c.id === "renal");
      t.igual(cIra.estado, "pend", "sospecha de injuria renal pesa aunque la categoría sea baja");
      t.cierto(cIra.sub.indexOf("injuria renal") >= 0, "y el motivo se nombra, no solo el color");
    });

    t.caso("mtrPanelResumenBentoDatos: exámenes — sin programa identificado → «nd»; con pendientes → «pend»; al día → «ok»", () => {
      const dSinPrograma = api.mtrTableroClinico({ plan: { ordenar: [], drivers: [], pasajeros: [] } });
      t.igual(api.mtrPanelResumenBentoDatos({}, dSinPrograma).find((c) => c.id === "examenes").estado, "nd",
        "sin programa rector, no se evaluó nada — no puede decir 'al día'");

      const dPendiente = api.mtrTableroClinico({
        programa: "HTA", factores: { hta: true },
        plan: { ordenar: [{ clave: "creatinina", nombre: "CREATININA", estado: "D", subestado: "vencido", vence: "2026-08-01" }], drivers: [], pasajeros: [] },
      });
      const cPend = api.mtrPanelResumenBentoDatos({}, dPendiente).find((c) => c.id === "examenes");
      t.igual(cPend.estado, "pend");
      t.igual(cPend.dato, "1 examen");

      const dAlDia = api.mtrTableroClinico({ programa: "HTA", factores: { hta: true }, plan: { ordenar: [], drivers: [], pasajeros: [] } });
      t.igual(api.mtrPanelResumenBentoDatos({}, dAlDia).find((c) => c.id === "examenes").estado, "ok", "programa identificado, nada por ordenar: al día");
    });

    t.caso("mtrPanelResumenBentoDatos: tendencias — sin serie de 2+ puntos → «nd»; con analito que empeora/grave → «pend»; el resto → «ok»", () => {
      const dCualquiera = api.mtrTableroClinico({});
      t.igual(api.mtrPanelResumenBentoDatos({}, dCualquiera).find((c) => c.id === "tendencias").estado, "nd", "sin _series, sin tendencia que mostrar");

      const conUnSolo = { _series: { CREATININA: [{ fecha: "2026-08-01", valor: 1.1 }] } };
      t.igual(api.mtrPanelResumenBentoDatos(conUnSolo, dCualquiera).find((c) => c.id === "tendencias").estado, "nd",
        "un solo control no es tendencia todavía, igual que en la pestaña detallada");

      // v17.55.0 — el rojo por valor empieza en la meta (decisión del médico), así que una
      // HbA1c de 7,1 ya está en rojo aunque venga bajando de 9,4. Para seguir probando el
      // caso «mejorando y sin nada grave» hace falta un valor que además esté EN meta — que
      // es lo que la tarjeta quiere decir con «al día».
      const conMejora = { _series: { HBA1C: [{ fecha: "2025-08-01", valor: 9.4 }, { fecha: "2026-08-01", valor: 6.6 }] } };
      t.igual(api.mtrPanelResumenBentoDatos(conMejora, dCualquiera).find((c) => c.id === "tendencias").estado, "ok", "mejorando y en meta: al día");
      const bajandoPeroFuera = { _series: { HBA1C: [{ fecha: "2025-08-01", valor: 9.4 }, { fecha: "2026-08-01", valor: 7.1 }] } };
      t.igual(api.mtrPanelResumenBentoDatos(bajandoPeroFuera, dCualquiera).find((c) => c.id === "tendencias").estado, "pend",
        "bajando pero todavía por encima de la meta: no es «al día»");

      const conEmpeora = { _series: { COLESTEROL_LDL: [{ fecha: "2026-02-01", valor: 100 }, { fecha: "2026-08-01", valor: 130 }] } };
      t.igual(api.mtrPanelResumenBentoDatos(conEmpeora, dCualquiera).find((c) => c.id === "tendencias").estado, "pend", "empeorar 30% es justo lo que la pestaña de tendencias marca en rojo");
    });

    t.caso("mtrPanelResumenBentoHtml: cada tarjeta lleva data-panel-sec para saltar a SU pestaña — mismo mecanismo de swap, sin pedir nada por red", () => {
      const cards = api.mtrPanelResumenBentoDatos(RESUMEN_DEMO, api.mtrTableroClinico(RESUMEN_DEMO));
      const html = api.mtrPanelResumenBentoHtml(cards);
      ["renal", "examenes", "tendencias"].forEach((id) => {
        t.cierto(html.indexOf('data-panel-sec="' + id + '"') >= 0, "la tarjeta de " + id + " sabe a qué pestaña salta");
      });
      t.cierto(/role="button"/.test(html), "es accionable para el lector de pantalla");
      t.igual(api.mtrPanelResumenBentoHtml([]), "", "sin tarjetas, no se pinta una cuadrícula vacía");
    });

    t.caso("v17.28.0 — mtrPanelResumenHtml ya NO repite la lista completa de medicamentos: solo la Ficha (RCV) la tiene", () => {
      const html = api.mtrPanelResumenHtml(RESUMEN_DEMO);
      const iDashboard = html.indexOf("vgl-bento-grid");
      // v18.0.x — el rótulo de la fuente dejó de nombrar al proveedor: "Órdenes de
      // Everest" pasó a "Órdenes de la plataforma" (userscript, const F_ORD en
      // mtrFichaVivaFilas). Cambio de rótulo; el ancla de la ficha detallada es la misma.
      const iFicha = html.indexOf("Órdenes de la plataforma");
      t.cierto(iDashboard >= 0 && iFicha > iDashboard, "dashboard, luego la ficha detallada, sin nada entre medio");
      t.falso(html.indexOf("Medicamentos actuales") >= 0,
        "el rótulo de la lista pasiva ya no aparece en el Resumen");
      t.falso(/vgl-panel-meds-/.test(html), "y ninguna de sus clases CSS queda huérfana en el HTML");
    });

    t.caso("v17.29.0 — un RAC≥30 vencido se pinta en rojo (vencido), igual que cualquier otro examen vencido", () => {
      // mtrTableroClinico lee `resumen.plan` YA CALCULADO (no invoca mtrPlanParaclinicos
      // por su cuenta) — se construye con la API real, como lo haría el resto del script,
      // en vez de fabricar un plan a mano que podría no reflejar la forma real de los datos.
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-28", programa: "HTA", esDm2: true, edad: 66, rac: 45,
        categoriaRiesgo: "alto",
        ultimos: {
          RAC: { valor: 45, fecha: "2025-01-01" },            // vencido hace mucho, ≥30: albuminuria
          COLESTEROL_LDL: { valor: 130, fecha: "2025-01-01" }, // vencido, para comparar
        },
      });
      const resumen = { programa: "HTA", factores: { edad: 66, sexo: "F" }, erc: {}, riesgo: { categoria: "alto" }, plan: plan };
      const d = api.mtrTableroClinico(resumen);
      const rac = d.ordenar.find((x) => x.clave === "RAC");
      t.cierto(!!rac, "la RAC aparece en qué ordenar");
      t.cierto(rac.vencidoBase, "y mtrTableroClinico expone que de verdad está vencida (no solo en vigilancia estrecha)");
      const html = api.mtrPanelExamenesHtml(d);
      const iRac = html.indexOf("Relación albúmina/creatinina");
      const iLdl = html.indexOf("Colesterol LDL");
      t.cierto(iRac >= 0 && iLdl >= 0, "las dos filas están en el HTML");
      t.cierto(/vgl-tab-venc/.test(html.slice(Math.max(0, iRac - 60), iRac + 20)),
        "la fila de la RAC lleva la clase de vencido (roja), no la de 'por pedir' (ámbar)");
      t.cierto(/vgl-tab-venc/.test(html.slice(Math.max(0, iLdl - 60), iLdl + 20)),
        "la LDL, vencida por la vía normal, sigue roja como siempre (control del escenario)");
    });

    t.caso("v17.29.0 — meta de triglicéridos sube a 400 (antes 150): el corte grave queda cerca de 520, no de 200", () => {
      const u = api._mtrTendUmbralGrave("TRIGLICERIDOS", {});
      t.igual(u.meta, 400, "la meta base es 400, no 150");
      // v17.55.0 — el corte deja de llevar el +30 %: el rojo empieza en la meta.
      t.igual(u.tope, 400, "el corte es la meta misma, no meta+30%");
    });

    // v18.0.6 — aquí vivían, DUPLICADOS por el injerto de la fusión, los tres casos de la
    // meta individual de HbA1c ("fijar la meta…", "los bordes EXACTOS 5 % y 12 %…", "el
    // editor arranca en ESE valor…"). Son byte a byte los mismos que ya están más arriba
    // en este archivo (líneas ~484, ~549 y ~596), con su comentario de cabecera. Se retiran
    // los ejemplares repetidos: no aportaban una sola aserción nueva y falseaban el conteo.

    // =====================================================================
    // v18.0.23 — EL PUNTO VERDE «AL DÍA» SOBRE AVISOS CRÍTICOS DE SEGURIDAD
    //
    // El punto de la pestaña «Medicamentos» del Panel del paciente se calculaba como
    // «¿hay lista de medicamentos? -> ok»: la mera EXISTENCIA de fármacos lo pintaba de
    // verde. Reproducido con el arnés —enalapril + losartán + espironolactona + ibuprofeno,
    // TFG 45 y potasio 5,4— el motor devuelve 2 avisos CRITICAL («DOBLE BLOQUEO SRAA …
    // Contraindicado», «Espironolactona: CONTRAINDICADA con potasio 5,4») y 2 HIGH, y el
    // punto salía "ok". El médico que recorre la tira de pestañas veía verde en
    // Medicamentos y no tenía ningún motivo para abrirla.
    //
    // El estado "pend" (ámbar, «revisar») ya existía y estaba declarado en la hoja; aquí
    // nadie lo usaba. El cálculo se extrajo a mtrEstadoPuntoMedicamentos para que el banco
    // pueda ejercitarlo —dentro del cierre del render no había forma— y para que use el
    // MISMO contexto que arma la pestaña, y no puedan discrepar.
    // =====================================================================
    t.caso("v18.0.23: el punto de Medicamentos avisa cuando hay avisos CRÍTICOS, no se queda verde", () => {
      const c = cargar({ silencioso: true });
      const resumen = {
        medicamentos: ["ENALAPRIL 20 MG", "LOSARTAN 50 MG", "ESPIRONOLACTONA 25 MG", "IBUPROFENO 400 MG"],
        erc: { egfr: 45, crcl: 42 },
        _ultimos: { POTASIO: { valor: 5.4 } },
      };
      // Control del caso: el motor de verdad tiene algo grave que decir de este paciente.
      const r = c.api.mtrAvisosFarmacologicos({
        medicamentos: c.api.mtrMedicamentosUnicos(resumen.medicamentos),
        tfgCkdEpi: 45, tfgCockcroftGault: 42, potasio: 5.4,
      });
      const todos = [].concat(r.avisos || [], r.interacciones || []);
      t.cierto(todos.some((x) => String((x && (x.severidad || x.severity || x.nivel)) || "").toUpperCase() === "CRITICAL"),
        "control: este paciente tiene al menos un aviso CRITICAL");

      t.igual(c.api.mtrEstadoPuntoMedicamentos(resumen), "pend",
        "el punto tiene que mandar a revisar: verde sobre un «Contraindicado» es peor que no tener punto");
    });

    t.caso("v18.0.23: y no se sobre-corrige — una revisión limpia sigue en verde", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrEstadoPuntoMedicamentos({
        medicamentos: ["ACETAMINOFEN 500 MG"], erc: { egfr: 90, crcl: 95 }, _ultimos: {},
      }), "ok", "un fármaco sin nada que señalar sigue pintando verde");
    });

    t.caso("v18.0.23: lo que no se pudo revisar NO se afirma «al día»", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrEstadoPuntoMedicamentos({ medicamentos: null, erc: { egfr: 80 } }), "nd",
        "«no se pudo leer la lista» no es «está al día» — casilla vacía antes que dato inventado");
      t.igual(c.api.mtrEstadoPuntoMedicamentos({ medicamentos: [], erc: { egfr: 80 } }), "nd",
        "y «Everest no reporta medicamentos» tampoco es una revisión limpia");
    });

    // v18.0.23 — «OTROS MEDICAMENTOS» INVENTABA FÁRMACOS QUE EL PACIENTE NO TOMA.
    // La cifra salía de restar dos listas deduplicadas con claves DISTINTAS:
    // mtrMedicamentosUnicos conserva la dosis y mtrMedicamentosRcv la ignora desde la
    // v17.6.74 —a propósito, para agrupar ROSUVASTATINA 40 con la de 20—. Restar sus
    // longitudes atribuye ese agrupamiento a «medicamentos que no son del programa».
    // v18.0.23 — «OTROS MEDICAMENTOS» INVENTABA FÁRMACOS QUE EL PACIENTE NO TOMA.
    // La cifra salía de restar dos listas deduplicadas con claves DISTINTAS:
    // mtrMedicamentosUnicos conserva la dosis y mtrMedicamentosRcv la ignora desde la
    // v17.6.74 —a propósito, para agrupar ROSUVASTATINA 40 con la de 20—. Restar sus
    // longitudes atribuye ese agrupamiento a «medicamentos que no son del programa».
    //
    // OJO AL MÉTODO: la primera versión de esta prueba era HUECA y lo destapó su mutación.
    // Calculaba la cuenta buena EN LA PROPIA PRUEBA (`unicos.filter(...)`) en vez de
    // ejercitar la línea de producción, así que al revertir el arreglo seguía verde. Ahora
    // se llama a mtrFichaVivaFilas, que es quien arma de verdad ese renglón, y se lee lo
    // que el médico vería en pantalla.
    const otrosDeLaFicha = (c, meds) => {
      const txt = JSON.stringify(c.api.mtrFichaVivaFilas({ medicamentos: meds, erc: { egfr: 80 } }));
      const prog = /Medicamentos del programa cardiovascular \((\d+)\)/.exec(txt);
      const otros = /(\d+) \(no son del programa/.exec(txt);
      return { programa: prog ? Number(prog[1]) : null, otros: otros ? Number(otros[1]) : 0 };
    };

    t.caso("v18.0.23: «Otros medicamentos» no inventa fármacos al agrupar dosis distintas", () => {
      const c = cargar({ silencioso: true });
      // 5 renglones, 3 fármacos, TODOS cardiovasculares.
      const meds = ["LOSARTAN 100 MG", "LOSARTAN 50 MG", "METFORMINA 850 MG",
                    "ATORVASTATINA 40 MG", "ATORVASTATINA 20 MG"];

      // Control del caso: la resta de longitudes SÍ daría 2 aunque no sobre ningún fármaco.
      const unicos = c.api.mtrMedicamentosUnicos(meds);
      const rcv = c.api.mtrMedicamentosRcv(unicos);
      t.igual(unicos.length - rcv.length, 2,
        "control: por la resta vieja saldrían 2 «otros» — dos fármacos que el paciente no toma");

      const r = otrosDeLaFicha(c, meds);
      t.igual(r.programa, 3, "los tres fármacos del programa se cuentan bien");
      t.igual(r.otros, 0,
        "y NO se afirma que haya otros: los tres son cardiovasculares, lo que sobraba era el agrupamiento de dosis");
    });

    t.caso("v18.0.23: y sí cuenta los que de verdad no son del programa", () => {
      const c = cargar({ silencioso: true });
      const r = otrosDeLaFicha(c, ["LOSARTAN 50 MG", "ACETAMINOFEN 500 MG", "OMEPRAZOL 20 MG"]);
      t.igual(r.programa, 1, "solo el losartán es del programa cardiovascular");
      t.igual(r.otros, 2,
        "acetaminofén y omeprazol sí quedan fuera, y se dicen: no se sobre-corrigió hasta callarlo todo");
    });

    // v18.0.23 — SE AÑADÍA UNA CLASE QUE LA HOJA NO DECLARA. El chip del sábado que el
    // médico SÍ trabaja recibía `vgl-agm-pbtn-sabado-mio`, y la regla existe con otro
    // nombre («…-suyo»). Los dos sábados salían idénticos en pantalla y la única diferencia
    // era el `title`, que obliga a pasar el ratón chip por chip.
    // Regresión de código fuente: lo que hay que fijar es que las dos mitades —quien añade
    // la clase y quien la declara— usen el mismo nombre.
    t.caso("v18.0.23: la clase del sábado propio existe en la hoja de estilos", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const anadidas = (src.match(/classList\.add\("(vgl-agm-pbtn-sabado-[\w-]+)"\)/g) || [])
        .map((m) => /"([^"]+)"/.exec(m)[1]);
      t.cierto(anadidas.length > 0, "sigue habiendo un chip de sábado con clase propia");
      for (const cls of anadidas) {
        t.cierto(src.includes("." + cls + "{"),
          `la clase «${cls}» se añade desde JS pero la hoja no la declara: el realce no se pinta nunca`);
      }
    });

  },
};
