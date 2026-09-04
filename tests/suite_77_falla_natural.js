// =====================================================================
//  SUITE 77 — Falla terapéutica con la ventana del 50 % ya gastada:
//             rigen las VIGENCIAS NATURALES, no la falla
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que una falla terapéutica
//  cuya ventana del 50 % ya venció NO dispare tomas de urgencia —
//  las fallas no cuentan como vencimiento; cuando la ventana se gastó,
//  cada analito vuelve a su vigencia natural.
//
//  Reporte del médico (04-sep, verbatim): «LAS FALLAS TERAPEUTICAS NO SE
//  TIENEN EN CUENTA COMO VENCIMIENTO, EN CASO DE QUE YA HAYA PASADO LA
//  VENTANA DEL 50% PUES SE UTILIZAN ENTONCES LAS VIGENCIAS NATURALES DE
//  CADA ANALITO». Su paciente HTA con LDL de 160 (jun-02) —la ventana
//  del 50 % venció el 31-ago, la norma lo cubre hasta el 29-nov— salía
//  con toma el 18-sep y control el 25-sep «hay exámenes por pedir»,
//  arrastrando el panel entero. No había criterio para eso.
//
//  Y el segundo reporte (04-sep): «APARECE QUE NUNCA SE LOS HA REALIZADO
//  Y RESULTA QUE SÍ SE LOS HIZO» — cuando Athenea no se pudo leer, el
//  tablero afirmaba «Nunca se le ha tomado» de labs que existían. Ahora
//  se dice la verdad: «no se pudo leer el laboratorio».
// =====================================================================

"use strict";

module.exports = {
  nombre: "Falla con ventana del 50 % gastada: vigencias naturales; lectura fallida no es «nunca tomado»",
  cubre: [
    "mtrEstadoAnalito", "mtrPlanParaclinicos", "mtrTableroClinico",
    "mtrSugerenciaPorPlazo", "mtrPaqueteEstadoDe", "mtrFueraDeMeta",
  ],

  pruebas(t, api) {
    const HTA_REPORTE3 = {
      hoyIso: "2026-09-04", programa: "HTA", estadioAdministrativo: null, esDm2: false,
      categoriaRiesgo: "alto", edad: 62, egfrCkdEpi: 88, rac: 12,
      ultimos: {
        COLESTEROL_LDL: { fecha: "2026-06-02", valor: 160 },
        COLESTEROL_TOTAL: { fecha: "2026-06-02", valor: 190 },
        COLESTEROL_HDL: { fecha: "2026-06-02", valor: 50 },
        TRIGLICERIDOS: { fecha: "2026-06-02", valor: 150 },
        GLUCOSA: { fecha: "2026-06-02", valor: 95 },
        CREATININA: { fecha: "2026-06-02", valor: 0.9 },
        RAC: { fecha: "2026-06-02", valor: 12 },
        UROANALISIS: { fecha: "2026-06-02", valor: 1 },
      },
    };

    t.caso("v18.0.143 (reporte 3): ventana del 50 % gastada + norma viva → vigencia natural, no toma de septiembre", () => {
      const plan = api.mtrPlanParaclinicos(HTA_REPORTE3);
      const ldl = [].concat(plan.drivers || [], plan.pasajeros || []).filter((x) => x.clave === "COLESTEROL_LDL")[0];
      t.cierto(!!ldl, "precondición: el LDL está en el plan");
      t.igual(ldl.estado, "D", "ya no se pide: la norma (180 d) lo cubre hasta el 29-nov");
      t.igual(ldl.subestado, "falla_natural", "subestado nuevo: ventana del 50 % gastada, norma viva");
      t.igual(ldl.vence, "2026-11-29", "publica la fecha NATURAL (la de la norma), no la del 50 %");
      t.igual(ldl.venceFalla, "2026-08-31", "y conserva la del 50 % en su campo propio, para contar la historia");
      t.igual(ldl.diasParaVencer, 86, "86 días por delante según la norma — los mismos del tablero del médico");
      t.igual(ldl.diasParaVencerFalla, -4, "la ventana del 50 % venció hace 4 días");
      t.igual(ldl.vigenciaDias, 180, "la vigencia publicada es la de la norma, no la partida");
      t.falso(ldl.vencidoBase, "no está vencido: la norma sigue viva");
      t.falso((plan.vencidos || []).some((x) => x.clave === "COLESTEROL_LDL"),
        "no aparece en «Ya vencidos»");
      t.falso((plan.ordenar || []).some((x) => x.clave === "COLESTEROL_LDL"),
        "y tampoco se ordena en septiembre: la falla con ventana gastada no cuenta como vencimiento");
      t.cierto((plan.diferidos || []).some((x) => x.clave === "COLESTEROL_LDL"),
        "espera en diferidos, como cualquier vigente que aún no se cosecha");
      t.cierto((plan.ordenar || []).some((x) => x.clave === "HEMOGLOBINA"),
        "la hemoglobina (pasajera, nunca tomada) sí viaja en la orden — ella sola no fija la fecha");
      t.igual(plan.ftl, "2026-11-28",
        "la toma va al vencimiento natural: 29-nov es domingo → se adelanta al sábado 28");
      t.igual(plan.motivoFtl, "en el vencimiento más próximo (Colesterol total)",
        "ya no «hay exámenes por pedir»: sin Estado A no hay piso de 14 días · " + plan.motivoFtl);
      t.cierto(/vigente hasta el 2026-11-29/.test(ldl.motivo) && /venci\u00f3 el 2026-08-31/.test(ldl.motivo)
        && /rige la vigencia natural/.test(ldl.motivo),
        "el motivo cuenta la historia completa: norma viva, ventana gastada, regla · " + ldl.motivo);
    });

    t.caso("v18.0.143: el mismo LDL con el resto del panel fresco — la toma sigue siendo la natural", () => {
      const ultimos = Object.assign({}, HTA_REPORTE3.ultimos, {
        COLESTEROL_TOTAL: { fecha: "2026-09-01", valor: 190 },
        COLESTEROL_HDL: { fecha: "2026-09-01", valor: 50 },
        TRIGLICERIDOS: { fecha: "2026-09-01", valor: 150 },
        GLUCOSA: { fecha: "2026-09-01", valor: 95 },
        CREATININA: { fecha: "2026-09-01", valor: 0.9 },
        RAC: { fecha: "2026-09-01", valor: 12 },
        UROANALISIS: { fecha: "2026-09-01", valor: 1 },
      });
      const plan = api.mtrPlanParaclinicos(Object.assign({}, HTA_REPORTE3, { ultimos: ultimos }));
      const ldl = [].concat(plan.drivers || [], plan.pasajeros || []).filter((x) => x.clave === "COLESTEROL_LDL")[0];
      t.cierto(!!ldl, "precondición: el LDL está en el plan");
      t.igual(ldl.subestado, "falla_natural", "el resto fresco no cambia la verdad del LDL");
      t.igual(ldl.vence, "2026-11-29", "su vigencia natural manda sobre el panel de febrero");
      t.igual(plan.ftl, "2026-11-28", "el LDL (29-nov, domingo) gana la carrera contra feb-2027 → sábado 28");
      t.igual(plan.motivoFtl, "en el vencimiento más próximo (Colesterol LDL)",
        "y ahora el nombrado es él, no el colesterol total · " + plan.motivoFtl);
    });

    t.caso("v18.0.143: ANTES de la ventana del 50 %, la regla del 02-sep no cambia (se repite YA)", () => {
      // La regla v18.0.135 sigue intacta: mientras la ventana del 50 % está POR
      // VENCIER, el examen se repite ya (Estado A). Lo que cambió es qué pasa
      // cuando la ventana YA se gastó y la norma sigue viva.
      const a = api.mtrEstadoAnalito("COLESTEROL_LDL", { fecha: "2026-08-01", valor: 160 },
        { hoyIso: "2026-09-04", programa: "HTA", estadioAdministrativo: null, esDm2: false,
          categoriaRiesgo: "alto", edad: 62, egfrCkdEpi: 88 });
      t.igual(a.estado, "D", "aún dentro de la ventana: vigente");
      t.igual(a.subestado, "vigente", "sin falla que declarar");
      t.igual(a.vence, "2026-10-30", "la mitad de 180 d desde el 01-ago");
      t.igual(a.venceFalla, null, "sin ventana gastada no hay fecha de falla que conservar");
      t.igual(a.diasParaVencerFalla, null, "ni días de falla");
      t.igual(a.vigenciaDias, 90, "la vigencia partida se sigue publicando, como desde v16.2.7");
    });

    t.caso("v18.0.143: norma agotada sigue siendo VENCIDO de verdad (nada se relaja)", () => {
      const a = api.mtrEstadoAnalito("COLESTEROL_LDL", { fecha: "2025-06-02", valor: 160 },
        { hoyIso: "2026-09-04", programa: "HTA", estadioAdministrativo: null, esDm2: false,
          categoriaRiesgo: "alto", edad: 62, egfrCkdEpi: 88 });
      t.igual(a.estado, "A", "se pide: la norma murió en nov-2025");
      t.igual(a.subestado, "vencido", "vencido real, no falla_natural: la ventana Y la norma cayeron juntas");
      t.cierto(a.vencidoBase, "vencidoBase lo certifica, para la urgencia de piso 14/techo 21");
      t.igual(a.venceFalla, null, "la falla no se estampa cuando la norma también murió: no hay historia que contar");
      const plan = api.mtrPlanParaclinicos(Object.assign({}, HTA_REPORTE3, {
        ultimos: { COLESTEROL_LDL: { fecha: "2025-06-02", valor: 160 } },
      }));
      t.cierto((plan.vencidos || []).some((x) => x.clave === "COLESTEROL_LDL"),
        "y en el plan va donde siempre: al recuadro de «Ya vencidos»");
    });

    t.caso("v18.0.143 (reporte 2): lectura fallida de Athenea no se anuncia como «nunca se le ha tomado»", () => {
      const planBase = {
        ordenar: [{ clave: "HEMOGLOBINA", nombre: "Hemoglobina", estado: "A", subestado: "sin_historial" }],
        drivers: [], pasajeros: [], vencidos: [], bloqueados: [],
      };
      const conFallo = api.mtrTableroClinico({ plan: Object.assign({}, planBase, { _lecturaAtheneaFallo: true }) });
      t.cierto(!!conFallo && conFallo.ordenar.length === 1, "precondición: la fila llegó al tablero");
      t.igual(conFallo.ordenar[0].quePasa, "No consta tomado (no se pudo leer el laboratorio)",
        "con el flag, se DICE que no se pudo leer: «sí se los hizo» deja de leerse como «nunca»");
      const sinFallo = api.mtrTableroClinico({ plan: planBase });
      t.igual(sinFallo.ordenar[0].quePasa, "Nunca se le ha tomado",
        "sin el flag, el texto de siempre — la afirmación solo cambia cuando hay evidencia de fallo");
      // La sugerencia de plazo (el «Hay exámenes pendientes» del agendamiento), misma vara:
      const planFal = {
        ftl: "2026-09-18", vencidos: [],
        faltantes: [{ clave: "CREATININA", nombre: "Creatinina sérica" }],
        drivers: [], control: { fecha: "2026-09-25" },
        _lecturaAtheneaFallo: true,
      };
      const s1 = api.mtrSugerenciaPorPlazo(planFal, null, "2026-10-01", "2026-09-04", "HTA");
      t.cierto(!!s1 && /No consta tomado \(no se pudo leer el laboratorio\)/.test(s1.motivo),
        "la sugerencia tampoco afirma «nunca tomado» de una lectura que falló · " + (s1 && s1.motivo));
      const s2 = api.mtrSugerenciaPorPlazo(Object.assign({}, planFal, { _lecturaAtheneaFallo: false }),
        null, "2026-10-01", "2026-09-04", "HTA");
      t.cierto(!!s2 && /Nunca se le ha tomado/.test(s2.motivo),
        "y sin flag, el texto clásico · " + (s2 && s2.motivo));
    });

    t.caso("v18.0.143: el tablero pinta la falla agotada como VIGENTE, con su historia al lado", () => {
      const d = api.mtrTableroClinico({ plan: {
        drivers: [{ clave: "COLESTEROL_LDL", nombre: "Colesterol LDL", estado: "D",
          subestado: "falla_natural", vence: "2026-11-29", venceFalla: "2026-08-31",
          vigenciaDias: 180, diasParaVencer: 86 }],
        ordenar: [], pasajeros: [], vencidos: [], bloqueados: [],
      } });
      const v = (d.vigentes || []).filter((x) => x.clave === "COLESTEROL_LDL")[0];
      t.cierto(!!v, "precondición: el LDL cae en «lo que sigue vigente» — ahí vive ahora");
      t.cierto(/Vigente hasta el dom 29 nov/.test(v.quePasa)
        && /ventana del 50 % venci\u00f3 el lun 31 ago/.test(v.quePasa)
        && /rige la vigencia natural/.test(v.quePasa),
        "las dos fechas legibles y la regla, en una sola línea · " + v.quePasa);
      t.igual(api.mtrPaqueteEstadoDe({ subestado: "falla_natural", vence: "2026-11-29" }), "vence",
        "y la tarjeta de paquetes lo pinta como VENCE, no como «Repetir»");
    });

    t.caso("v18.0.143: el cableado de fuente (lo que las pantallas consumen)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      // El subestado viejo dejó de existir por completo: motor, plan, pintores y badges.
      t.falso(src.includes("recontrol_falla"),
        "nadie produce ni consume recontrol_falla ya: ventana gastada = vigencia natural");
      t.cierto(src.includes('subestado = "falla_natural"'),
        "el motor estampa el subestado nuevo");
      t.cierto(src.includes('venceFalla:'),
        "y publica la fecha de la ventana gastada en su campo propio");
      // FIX B: el modal de Laboratorios calcula la lectura fallida ANTES de cachear.
      t.cierto(src.includes("const _lecturaFal ="),
        "el modal sabe distinguir «no pudo leer» de «no tiene nada»");
      t.cierto(/_lecturaFal && resumenClinico/.test(src),
        "y con lectura fallida no guarda el resumen vacío en la caché compartida");
      t.cierto(src.includes("else atheneaPrincipalFallo = true;"),
        "la lectura NO fresca que falla también cuenta — no solo el clic de «🔄 Buscar»");
      t.cierto(src.includes("if (atheneaPrincipalFallo)"),
        "y el guard del Panel ya no exige o.fresco para estampar el flag");
      t.cierto(/No consta tomado \(no se pudo leer el laboratorio\)/.test(src),
        "los pintores tienen el texto de la lectura fallida");
    });
  },
};
