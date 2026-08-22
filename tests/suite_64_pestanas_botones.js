// =====================================================================
//  SUITE 64 — v16.1.0: cada botón en SU pestaña, el «Deshacer» que se
//             retira solo, y el azul de Everest fuera de los módulos
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que «Normalidad» viva solo en
//  Revisión por sistema y Examen físico, «Auto-Labs» solo en Ruta Crónicos,
//  que el botón de deshacer no se quede pegado en la pantalla, y que el
//  texto de los módulos nuevos nunca dependa de la cascada de Everest.
//
//  Reporte de campo del 20-08-2026 (con pantallazos): los dos botones se
//  colaban en otras pestañas y los colores de Everest se metían en la Ficha
//  y en el módulo de Riesgo — los criterios del «Por qué» quedaban azul
//  oscuro sobre fondo oscuro, ilegibles.
// =====================================================================

module.exports = {
  nombre: "v16.1.0 — botones por pestaña, Deshacer efímero y Regla E en los módulos",
  cubre: [
    "createIaInjectorUI","_vglPestanaActiva", "_vglEnPestana", "mtrLeerProgramasRutaCronicos",
    "_vglCosechaLeer", "_vglCosechaGuardar", "_vglCosecharDePantalla",
    "mtrClasificarMedicamento", "mtrMedicamentosRcv",
    "_vglBarraPestanasPrincipal", "_vglVisibleDeVerdad",
    // v17.6.2 — desenganche del agendamiento: memoria del resumen en el aviso de «falta documentar»
    "mtrFactoresConMemoria", "mtrFactoresPendientesNavegables"],

  pruebas(t, api, env, cargar) {
    const c = cargar({ silencioso: true });
    const a = c.api;

    // Barra de pestañas igual a la real de Everest (confirmada en las 10 capturas):
    // <a class="nav-link active" role="tab" id="pes" aria-selected="true">Ruta Crónicos</a>
    const barra = (idActivo, textoActivo) => ({
      querySelector(sel) {
        const s = String(sel);
        if (s.indexOf("active") >= 0 || s.indexOf('aria-selected="true"') >= 0) {
          return { id: idActivo, textContent: textoActivo };
        }
        return null;
      },
    });

    t.caso("lee de la barra de Everest qué pestaña está abierta", () => {
      const r = a._vglPestanaActiva(barra("pes", "Ruta Crónicos"));
      t.igual(r.id, "pes", "el id de la pestaña activa");
      t.igual(r.texto, "Ruta Crónicos", "y su nombre visible");
      t.igual(a._vglPestanaActiva({ querySelector: () => null }), null, "sin barra legible, null (no se adivina)");
    });

    t.caso("«Normalidad» reconoce SOLO Revisión por sistema y Examen físico", () => {
      t.cierto(a._vglEnPestana("examen", barra("ngb-tab-8", "Revision por sistema y Examen fisico")), "la pestaña real, tal como Everest la escribe (sin tildes)");
      t.cierto(a._vglEnPestana("examen", barra("ngb-tab-8", "Revisión por sistema y Examen físico")), "y con tildes, por si Everest las corrige un día");
      t.falso(a._vglEnPestana("examen", barra("pes", "Ruta Crónicos")), "en Ruta Crónicos NO");
      t.falso(a._vglEnPestana("examen", barra("paraclinico", "Paraclínicos")), "en Paraclínicos NO");
      t.falso(a._vglEnPestana("examen", barra("antecedente", "Antecedentes")), "en Antecedentes NO");
    });

    t.caso("«Auto-Labs» reconoce SOLO Ruta Crónicos", () => {
      t.cierto(a._vglEnPestana("cronicos", barra("pes", "Ruta Crónicos")), "su pestaña");
      t.cierto(a._vglEnPestana("cronicos", barra("pes", "Ruta Cronicos")), "escrita sin tilde también");
      t.falso(a._vglEnPestana("cronicos", barra("paraclinico", "Paraclínicos")), "en Paraclínicos NO — ahí también hay casillas «resultado…», que era justo la confusión");
      t.falso(a._vglEnPestana("cronicos", barra("ngb-tab-8", "Revision por sistema y Examen fisico")), "en Examen físico NO");
    });

    t.caso("el id sirve de respaldo si un día cambia el texto de la pestaña", () => {
      t.cierto(a._vglEnPestana("cronicos", barra("pes", "Programa de crónicos (nuevo nombre)")), "por id 'pes'");
      t.cierto(a._vglEnPestana("examen", barra("ngb-tab-8", "Otro nombre")), "por id 'ngb-tab-8'");
    });

    // v17.1.1 — reporte en vivo del 21-ago (con pantallazos): en «Revisión por sistema»
    // salían «Enfermedad actual» Y «Auto-Labs» (de OTRAS pestañas), y al pasar a «Ruta
    // Crónicos» salía «Normalidad fija» (de Examen físico) y Auto-Labs NO salía — justo lo
    // contrario. Causa: `d.querySelector('a.nav-link.active[role="tab"]')` SIN ACOTAR
    // devuelve el PRIMERO que haya en todo el documento, y Ruta Crónicos trae su propio
    // tabset suelto (los programas: Síndrome Metabólico/Hipertensión/Diabetes/ERC), que
    // también es role="tab" con su propia .active. Cuál gana depende del orden del DOM, no
    // de la pestaña que el médico ve. Ahora se ancla primero por los ids YA conocidos.
    const barraConDecoy = (idActivo, textoActivo) => {
      const activo = { id: idActivo, textContent: textoActivo };
      const contenedorReal = {
        querySelector(sel) {
          const s = String(sel);
          if (s.indexOf("active") >= 0 || s.indexOf('aria-selected="true"') >= 0) return activo;
          return null;
        },
      };
      const miembro = (id) => ({ id, textContent: "", closest: () => null, parentElement: contenedorReal });
      return {
        getElementById(id) {
          return ["ngb-tab-8", "pes", "anamesis", "impDiagnostica"].indexOf(id) >= 0 ? miembro(id) : null;
        },
        // Sin acotar (documento entero), lo primero que aparece es el tabset SUELTO —
        // así se prueba que el código nuevo ya no cae en este camino cuando SÍ logró
        // anclarse a la barra principal por id.
        querySelector(sel) {
          const s = String(sel);
          if (s.indexOf("active") >= 0) return { id: "decoy", textContent: "Síndrome Metabólico (tabset suelto de Ruta Crónicos, NO es la barra principal)" };
          return null;
        },
      };
    };

    t.caso("#151 no se confunde con un tabset SUELTO que también trae su propia .active", () => {
      const docCronicos = barraConDecoy("pes", "Ruta Crónicos");
      const barraHallada = a._vglBarraPestanasPrincipal(docCronicos);
      t.cierto(!!barraHallada, "encuentra el contenedor de la barra principal anclándose por id");
      t.igual(barraHallada.querySelector('a.nav-link.active[role="tab"]').id, "pes", "y ESE contenedor es el que trae la .active real");
      t.igual(a._vglBarraPestanasPrincipal({ getElementById: () => null }), null, "sin ningún id conocido en el DOM, no inventa un contenedor");

      const r = a._vglPestanaActiva(docCronicos);
      t.igual(r.id, "pes", "toma la pestaña de la barra PRINCIPAL (anclada por id), no la del tabset suelto");
      t.igual(r.texto, "Ruta Crónicos", "y su nombre real, no el del decoy");
      t.cierto(a._vglEnPestana("cronicos", docCronicos), "Auto-Labs SÍ debe verse en Ruta Crónicos");
      t.falso(a._vglEnPestana("examen", docCronicos), "Normalidad NO debe colarse en Ruta Crónicos");

      const docExamen = barraConDecoy("ngb-tab-8", "Revision por sistema y Examen fisico");
      t.cierto(a._vglEnPestana("examen", docExamen), "Normalidad SÍ debe verse en Examen físico");
      t.falso(a._vglEnPestana("cronicos", docExamen), "Auto-Labs NO debe colarse en Examen físico");
      t.falso(a._vglEnPestana("anamnesis", docExamen), "ni el botón de redacción de Enfermedad actual");
    });

    t.caso("_vglVisibleDeVerdad: distingue lo que Everest deja MONTADO por debajo de lo que de verdad se ve", () => {
      t.falso(a._vglVisibleDeVerdad(null), "sin elemento, no es visible");
      t.falso(a._vglVisibleDeVerdad(undefined), "tampoco con undefined");
      t.falso(
        a._vglVisibleDeVerdad({ offsetParent: null, getBoundingClientRect: () => ({ width: 100, height: 40 }) }),
        "offsetParent nulo = display:none en algún ancestro (la pestaña de al lado)"
      );
      t.falso(
        a._vglVisibleDeVerdad({ offsetParent: {}, getBoundingClientRect: () => ({ width: 0, height: 0 }) }),
        "caja en cero, aunque offsetParent exista"
      );
      t.cierto(
        a._vglVisibleDeVerdad({ offsetParent: {}, getBoundingClientRect: () => ({ width: 320, height: 20 }) }),
        "con caja real y offsetParent, sí cuenta"
      );
      t.cierto(
        a._vglVisibleDeVerdad({}),
        "sin offsetParent ni getBoundingClientRect (objeto simple de prueba) no se esconde por error de lectura"
      );
    });

    t.caso("si la barra no se puede leer, NO se decide por pestaña (los botones caen al criterio de casillas)", () => {
      const ciego = { querySelector: () => null };
      t.igual(a._vglEnPestana("examen", ciego), null, "null = «no se sabe», nunca false");
      t.igual(a._vglEnPestana("cronicos", ciego), null, "igual para Auto-Labs");
      t.igual(a._vglEnPestana("pestaña-inventada", barra("pes", "Ruta Crónicos")), null, "una clave que no existe tampoco inventa nada");
    });

    // ---- El botón «Deshacer» ya no se queda cinco minutos en pantalla ----
    t.caso("el «↩ Deshacer» se retira solo a los pocos segundos (y el lote sigue guardado por dentro)", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      t.cierto(/VGL_DESHACER_VISIBLE_MS\s*=\s*20000/.test(src), "el botón vive 20 segundos, no 5 minutos");
      t.cierto(/setTimeout\(_quitar, VGL_DESHACER_VISIBLE_MS\)/.test(src), "y se retira solo con ese plazo");
      t.cierto(/5 \* 60 \* 1000/.test(src), "el lote por dentro conserva sus 5 minutos: no se pierde nada de lo que se puede restaurar");
      t.cierto(/pestanaOrigen/.test(src) && /_quitar\(\)/.test(src), "y si el médico cambia de pestaña, el botón se va con ella");
      t.falso(/Disponible por 5 minutos/.test(src), "el texto viejo que prometía 5 minutos a la vista ya no está");
    });

    // ---- Regla E: el azul de Everest no entra en los módulos nuevos ----
    t.caso("Regla E: cada texto de la Ficha y del módulo de Riesgo fija su color (el azul de Everest no gana)", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      // v16.8.0 — los dos módulos se fundieron en el «Panel del paciente» y sus reglas
      // pasaron a ser selectores AGRUPADOS (#vgl-ficha-modal X,#vgl-tablero-modal X,
      // #vgl-panel-modal X). Se comprueba pieza por pieza en vez de por texto exacto:
      // lo que importa es que el color quede fijado Y que el módulo nuevo esté cubierto,
      // no en qué orden se escribieron los selectores.
      const exige = [
        [".vgl-ficha-v", "color:var(--fg) !important"],
        [".vgl-ficha-k", "color:var(--fg2) !important"],
        [".vgl-ficha-fila.falta .vgl-ficha-v", "color:var(--c-ambar) !important"],
        [".vgl-tab-riesgo-cat", "color:var(--fg) !important"],
        [".vgl-tab-crit", "color:var(--fg2) !important"],
        [".vgl-tab-tfg-val", "color:var(--fg) !important"],
        [".vgl-tab-ex", "color:var(--fg) !important"],
        [".vgl-tab-fecha", "color:var(--fg) !important"],
      ];
      exige.forEach(([sub, decl]) => {
        const re = new RegExp("[^\\n{}]*#vgl-panel-modal " + sub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{[^}]*" + decl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        t.cierto(re.test(src), "falta la regla blindada para el Panel: " + sub + " -> " + decl);
      });
      t.cierto(/#vgl-ficha-modal,#vgl-tablero-modal,#vgl-panel-modal\{color:var\(--fg\) !important\}/.test(src),
        "y los tres módulos fijan su color base, que es de donde heredan los demás");
    });


    // =====================================================================
    //  LA MEMORIA VIVA DEL PACIENTE (cosecha por pestañas)
    //  Reporte de campo del 20-08: un paciente con «Hipertensión Arterial»
    //  marcada en Ruta Crónicos salía «sin programa», y el agendamiento decía
    //  «no se pudieron leer los exámenes» justo después de que Auto-Labs los
    //  leyera y los llenara. Las dos cosas nacen del mismo hueco: lo que una
    //  pestaña revela se perdía al cambiar de pestaña.
    // =====================================================================
    const domProgramas = (marcados) => ({
      querySelectorAll(sel) {
        if (String(sel).indexOf("kt-checkbox") < 0) return [];
        return Object.keys(marcados).map((texto) => ({
          textContent: " " + texto + " ",
          querySelector: () => ({ checked: marcados[texto] }),
        }));
      },
      querySelector: () => null,
    });

    t.caso("lee «Ingreso a programa» de Ruta Crónicos por el texto de la etiqueta (Everest no les pone name ni id)", () => {
      const r = a.mtrLeerProgramasRutaCronicos(domProgramas({
        "Síndrome Metabólico": false, "Hipertensión Arterial": true, "Diabetes": false, "Enfermedad Renal Crónica": false,
      }));
      t.cierto(!!r, "los encontró");
      t.igual(r.hta, true, "hipertensión marcada");
      t.igual(r.diabetes, false, "diabetes sin marcar — false, que NO es lo mismo que «no se sabe»");
      t.igual(r.erc, false, "renal sin marcar");
      t.igual(r.sindromeMetabolico, false, "síndrome metabólico sin marcar");
    });

    t.caso("si esas casillas no están en pantalla, devuelve null (no inventa que el paciente no tiene programa)", () => {
      t.igual(a.mtrLeerProgramasRutaCronicos({ querySelectorAll: () => [], querySelector: () => null }), null, "sin casillas, null");
      t.igual(a.mtrLeerProgramasRutaCronicos(null), null, "sin documento, null");
    });

    t.caso("lo cosechado se guarda por paciente y sobrevive al cambio de pestaña", () => {
      a._vglCosechaGuardar("111111111", { programas: { hta: true, diabetes: false, erc: false } });
      const leido = a._vglCosechaLeer("111111111");
      t.cierto(!!leido && !!leido.programas, "se recupera después");
      t.igual(leido.programas.hta, true, "con lo que se vio");
      t.igual(a._vglCosechaLeer("222222222"), null, "y jamás se cruza con otro paciente");
      a._vglCosechaGuardar("111111111", { tension: { pas: 150 } });
      const fusion = a._vglCosechaLeer("111111111");
      t.igual(fusion.programas.hta, true, "lo viejo se conserva");
      t.igual(fusion.tension.pas, 150, "y lo nuevo se suma: la memoria crece, no se pisa");
    });

    t.caso("sin documento del paciente no se guarda nada suelto", () => {
      t.igual(a._vglCosechaGuardar("", { programas: {} }), null, "sin cédula no hay dónde guardar");
      t.igual(a._vglCosechaGuardar("333", null), null, "sin datos tampoco");
      t.igual(a._vglCosecharDePantalla(""), null, "y la cosecha automática exige saber a quién pertenece");
    });


    // =====================================================================
    //  SOLO LOS MEDICAMENTOS DEL RIESGO CARDIOVASCULAR (orden del médico,
    //  20-08, con pantallazo: la lista traía quetiapina, levomepromazina y
    //  escitalopram — nada que ver con el programa — y repetía el mismo
    //  fármaco hasta cuatro veces).
    // =====================================================================
    t.caso("clasifica cada medicamento por el programa al que pertenece", () => {
      t.igual(a.mtrClasificarMedicamento("LOSARTAN 50 mg (TABLETA)").para, "hipertensión", "un ARA-II");
      t.igual(a.mtrClasificarMedicamento("ATORVASTATINA 40 MG (TABLETA)").para, "colesterol", "una estatina");
      t.igual(a.mtrClasificarMedicamento("METFORMINA 850").para, "diabetes", "un antidiabético");
      t.igual(a.mtrClasificarMedicamento("Ácido acetilsalicílico 100 mg").para, "prevención de trombos", "el ASA");
      t.igual(a.mtrClasificarMedicamento("CALCITRIOL 0.25 MCG").para, "riñón", "lo renal");
      t.igual(a.mtrClasificarMedicamento("ESPIRONOLACTONA 25 MG").para, "corazón", "diurético del corazón");
    });

    t.caso("lo que NO es del programa queda fuera — y lo nefrotóxico se sigue vigilando aparte", () => {
      ["QUETIAPINA 50MG (TABLETA DE LIBERACION PROLONGADA)", "LEVOMEPROMAZINA 4 mg/mL (SOLUCION ORAL)", "ESCITALOPRAM 10MG (TABLETA)"]
        .forEach((m) => {
          const c2 = a.mtrClasificarMedicamento(m);
          t.falso(c2.esRcv, "fuera del programa: " + m);
          t.falso(c2.soloSeguridad, "y tampoco es de los que se vigilan por el riñón: " + m);
        });
      const aine = a.mtrClasificarMedicamento("IBUPROFENO 400 MG");
      t.falso(aine.esRcv, "un AINE no es tratamiento del riesgo cardiovascular");
      t.cierto(aine.soloSeguridad, "pero SÍ se sigue vigilando por el riñón (decisión del médico)");
      t.cierto(a.mtrClasificarMedicamento("NITROFURANTOINA 100 MG").soloSeguridad, "igual la nitrofurantoína");
      t.falso(a.mtrClasificarMedicamento("").esRcv, "una cadena vacía no clasifica nada");
    });

    t.caso("la lista que ve el médico: solo del programa, sin repetidos y con su para qué", () => {
      const lista = a.mtrMedicamentosRcv([
        "QUETIAPINA 50MG (TABLETA DE LIBERACION PROLONGADA)",
        "LOSARTAN 50 mg (TABLETA)",
        "ATORVASTATINA 40 MG (TABLETA)",
        "QUETIAPINA 25MG (TABLETA) (H)",
        "LEVOMEPROMAZINA 4 mg/mL (SOLUCION ORAL)",
        "ESCITALOPRAM 10MG (TABLETA)",
        "LOSARTAN 50 mg (TABLETA)",
        "IBUPROFENO 400 MG",
      ]);
      t.igual(lista.length, 2, "de ocho renglones quedan los dos del programa");
      t.igual(lista[0].texto, "LOSARTAN 50 mg (TABLETA) — hipertensión", "con su para qué, en el idioma del paciente");
      t.igual(lista[1].para, "colesterol", "y la estatina con el suyo");
      t.igual(lista.filter((m) => /LOSARTAN/i.test(m.nombre)).length, 1, "el repetido de Everest se agrupa una sola vez");
    });

    t.caso("la lista aguanta lo que venga (objetos, vacíos, nulos) sin romperse", () => {
      t.igual(a.mtrMedicamentosRcv(null).length, 0, "sin lista, lista vacía");
      t.igual(a.mtrMedicamentosRcv([null, "", "   "]).length, 0, "renglones vacíos se ignoran");
      const objs = a.mtrMedicamentosRcv([{ nombre: "ENALAPRIL 20 MG" }, { descripcion: "METFORMINA 1000" }]);
      t.igual(objs.length, 2, "también entiende los medicamentos que vienen como objeto");
    });

    t.caso("los dos módulos siguen dentro de las listas que les dan tokens, tema claro y modo oculto", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const enLista = (marca) => src.indexOf(marca) >= 0;
      t.cierto(enLista("#vgl-ficha-modal,#vgl-tablero-modal,#vgl-acomp-burbuja"), "lista de tokens de diseño");
      t.cierto(enLista("#vgl-ficha-modal.light,#vgl-tablero-modal.light"), "lista del tema claro");
      t.cierto(enLista("body.vgl-modo-oculto #vgl-tablero-modal"), "y se esconde con el modo oculto, como sus hermanos");
    });

    // ============ v17.1.0 (#73) — LOS BOTONES DE REDACCIÓN, CADA UNO EN SU PESTAÑA ============
    // Pedido del médico: en vez de un botón único en el dock, uno por casilla, flotante,
    // en la pestaña donde de verdad está esa casilla. (Él los pidió los DOS en «Impresión
    // Diagnóstica»; verificado contra el DOM real capturado en consultorio, ahí solo existe
    // «Análisis y Plan» — «Enfermedad actual» vive en Anamnesis. Se lo consulté y eligió
    // que cada botón viva en su casilla real.)
    t.caso("createIaInjectorUI: no pinta ningún botón si la casilla no está en pantalla", () => {
      const c = cargar({ silencioso: true });
      const creados = [];
      c.env.doc.body.appendChild = (n) => { creados.push(n); };
      c.env.doc.getElementById = () => null;
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = () => [];
      c.api.createIaInjectorUI();
      t.igual(creados.length, 0,
        "sin casilla medible no se pinta un botón que prometa llenar algo que no está");
    });

    t.caso("createIaInjectorUI: no lanza aunque el DOM no coopere", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.querySelector = () => { throw new Error("DOM hostil"); };
      t.noLanza(() => c.api.createIaInjectorUI(),
        "corre en cada vuelta del reloj: una excepción aquí mataría el resto del tick");
    });

    // =====================================================================
    // v17.6.2 — DESENGANCHE DEL AGENDAMIENTO (reporte del 22-ago con pantallazo):
    // el aviso decía «falta documentar Hipertensión y Diabetes; Tabaquismo» cuando el
    // médico YA las había marcado. El aviso leía SOLO la pantalla actual; el resumen
    // clínico cacheado ya consolidó esa lectura en su momento. mtrFactoresConMemoria
    // fusiona lo que el DOM muestra AHORA con lo que el resumen ya determinó, y solo
    // puede AFIRMAR (llenar un hueco), jamás inventar un false.
    // =====================================================================
    t.caso("mtrFactoresConMemoria: un factor ya documentado en el resumen cacheado deja de aparecer como faltante", () => {
      const resumen = { factores: { _leidos: { hta: true, diabetes: true, tabaquismo: false } } };
      const fusion = a.mtrFactoresConMemoria({ hta: null, diabetes: null, tabaquismo: null }, resumen);
      t.igual(fusion.hta, true, "HTA documentada en el resumen: el agendamiento ya no la reporta como faltante");
      t.igual(fusion.diabetes, true, "igual diabetes");
      t.igual(fusion.tabaquismo, false, "y el «No fuma» documentado también manda (tri-estado real, no inventado)");
      const pend = a.mtrFactoresPendientesNavegables(fusion);
      t.igual(pend.length, 0, "con la fusión, el aviso de «falta documentar» no sale");
    });

    t.caso("mtrFactoresConMemoria: lo que el DOM ya dice ahora gana sobre el resumen (no se pisan datos frescos)", () => {
      const resumen = { factores: { _leidos: { hta: false } } };
      const fusion = a.mtrFactoresConMemoria({ hta: true, diabetes: null }, resumen);
      t.igual(fusion.hta, true, "el DOM (true) manda sobre el resumen (false): lo que el médico acaba de marcar es lo más fresco");
      t.igual(fusion.diabetes, null, "un factor que ni el DOM ni el resumen traen sigue en null (sin dato, no inventado)");
    });

    t.caso("mtrFactoresConMemoria: sin resumen, o resumen aplanado sin _leidos, no inventa nada", () => {
      t.igual(a.mtrFactoresConMemoria({ hta: null }, null).hta, null, "sin resumen, todo queda como estaba");
      t.igual(a.mtrFactoresConMemoria({ hta: null }, { factores: { hta: true } }).hta, true,
        "resumen viejo sin _leidos: el true aplanado sí es evidencia de «documentado»");
      t.igual(a.mtrFactoresConMemoria({ hta: null }, { factores: { hta: false } }).hta, null,
        "pero un false aplanado no distingue «marcó No» de «no documentado»: no se acepta como dato");
      t.igual(a.mtrFactoresConMemoria(null, null), {}, "entradas nulas devuelven un objeto vacío, sin lanzar");
    });

    t.caso("mtrFactoresConMemoria: el aviso completo del agendamiento queda coherente — documentado en el resumen, sin pendientes", () => {
      const resumen = { factores: { _leidos: { hta: true, diabetes: true, tabaquismo: true } } };
      const fusion = a.mtrFactoresConMemoria({ hta: null, diabetes: null, tabaquismo: null }, resumen);
      t.igual(a.mtrFactoresPendientesNavegables(fusion).length, 0, "el escenario del reporte: las tres marcadas, cero faltantes");
    });

  },
};
