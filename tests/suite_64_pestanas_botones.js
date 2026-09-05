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
    "mtrClasificarMedicamento", "mtrMedicamentosRcv", "_mtrClaveDedupMedicamentoSinDosis", "_mtrClaveDedupMedicamento",
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

    // v18.1 (M2M f34) — los cuatro ids ancla son frágiles: "ngb-tab-8" lo autogenera
    // Angular POR POSICIÓN (se renumera si Everest añade o reordena pestañas) y los
    // otros tres son ids internos que un rediseño puede borrar. La identidad estable de
    // la barra es su COPY, ya declarado en VGL_PESTANAS: si un día NINGÚN id aparece,
    // la barra debe localizarse por el TEXTO de sus pestañas — y aunque el tabset suelto
    // de los programas aparezca PRIMERO en el DOM, no puede ganar, porque sus pestañas
    // no contienen ningún copy de la barra principal.
    t.caso("M2M f34: sin NINGÚN id ancla, la barra principal se localiza por el TEXTO de sus pestañas", () => {
      const activo = { id: "", textContent: "Ruta Crónicos" };
      const contenedorReal = {
        querySelector(sel) {
          const s = String(sel);
          if (s.indexOf("active") >= 0 || s.indexOf('aria-selected="true"') >= 0) return activo;
          return null;
        },
      };
      const tabPrincipal = (texto) => ({ id: "", textContent: texto, closest: () => contenedorReal, parentElement: contenedorReal });
      const docSinIds = {
        getElementById: () => null,
        // El tabset SUELTO de los programas aparece primero en el documento entero...
        querySelector(sel) {
          const s = String(sel);
          if (s.indexOf("active") >= 0) return { id: "decoy", textContent: "Síndrome Metabólico (tabset suelto de Ruta Crónicos)" };
          return null;
        },
        // ...pero sus pestañas no contienen NINGÚN copy de la barra principal.
        querySelectorAll(sel) {
          const s = String(sel);
          if (s.indexOf("tab") >= 0) {
            return [
              { id: "prog-1", textContent: "Síndrome Metabólico", closest: () => null, parentElement: { esDecoy: true } },
              { id: "prog-2", textContent: "Hipertensión Arterial", closest: () => null, parentElement: { esDecoy: true } },
              tabPrincipal("Revision por sistema y Examen fisico"),
              tabPrincipal("Ruta Crónicos"),
              tabPrincipal("Antecedentes"),
            ];
          }
          return [];
        },
      };
      const barraHallada = a._vglBarraPestanasPrincipal(docSinIds);
      t.cierto(!!barraHallada && !barraHallada.esDecoy, "encuentra la barra principal aunque ningún id ancla exista — y no es el tabset de los programas");
      t.igual(
        barraHallada && barraHallada.querySelector && barraHallada.querySelector('a.nav-link.active[role="tab"]').textContent,
        "Ruta Crónicos",
        "anclada por el TEXTO de sus pestañas, no por ids que Angular puede renumerar"
      );

      const r = a._vglPestanaActiva(docSinIds);
      t.igual(r && r.texto, "Ruta Crónicos", "la pestaña activa se lee de la barra hallada por copy, no del decoy");
      t.cierto(a._vglEnPestana("cronicos", docSinIds), "Auto-Labs SÍ en Ruta Crónicos hallada por texto");
      t.falso(a._vglEnPestana("examen", docSinIds), "Normalidad NO se cuela en Ruta Crónicos");
    });

    // v18.1 (M2M f35) — fronteras del matching por copy: la normalización de espacios y
    // el plegado de tildes/caja ya existían, pero ninguna prueba fijaba SUS fronteras.
    // Si alguien endurece o afloja `_vglPestanaActiva`/`_vglEnPestana`, cae aquí.
    t.caso("M2M f35: fronteras del copy — espacios dobles, MAYÚSCULAS totales, tildes y el negativo que solo comparte palabras", () => {
      t.cierto(a._vglEnPestana("cronicos", barra("x", "RUTA  CRÓNICOS")), "MAYÚSCULAS totales con doble espacio interno: el copy matchea igual");
      t.cierto(a._vglEnPestana("examen", barra("x", "  Revision   por sistema ")), "espacios múltiples y de borde, sin tilde");
      t.cierto(a._vglEnPestana("impresion", barra("x", "Impresión Diagnóstica del episodio")), "el nombre de la pestaña dentro de un copy más largo");
      t.falso(a._vglEnPestana("cronicos", barra("x", "Ruta de atención del paciente")), "«Ruta de atención» NO es «Ruta Crónicos»: compartir la palabra «ruta» no basta");
      t.falso(a._vglEnPestana("impresion", barra("x", "Impresión terapéutica")), "«impresión terapéutica» no contiene «impresión diagnóstica»");
      t.falso(a._vglEnPestana("anamnesis", barra("x", "Antecedentes anamnésicos")), "«antecedentes anamnésicos» no contiene el substring «anamnesis»: el parecido no basta");
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

    // =====================================================================
    //  v17.48.0 — UNA SOLA CLAVE POR PACIENTE (decisión D2 del 29-ago)
    //  `normalizeKey` quita los ceros a la izquierda de un documento; `extractDoc` NO.
    //  Si el mismo paciente llega como "0005150076" por una vía (API de Everest, DOM de
    //  respaldo) y como "5150076" por otra, la memoria local queda partida en dos
    //  entradas y consume dos de los 80 cupos.
    //  El comentario que justifica `normalizeKey` (":8205") dice literalmente que la base
    //  guarda la cédula rellenada y la agenda la trae limpia — así que el escenario está
    //  afirmado sobre datos reales, aunque no haya captura que lo demuestre por la vía de
    //  la API.
    //  Estas pruebas fijan las dos mitades del arreglo: escribir canónico, y seguir
    //  leyendo lo que ya estaba guardado bajo la clave vieja.
    // =====================================================================
    t.caso("v17.48.0 — la memoria se archiva bajo UNA sola clave, con o sin ceros delante", () => {
      const c = cargar({ silencioso: true });
      c.api._vglCosechaGuardar("0005150076", { programas: { hta: true } });
      const porLaLimpia = c.api._vglCosechaLeer("5150076");
      t.cierto(!!porLaLimpia && !!porLaLimpia.programas,
        "guardado con ceros, se encuentra sin ellos — es el mismo paciente");
      t.igual(porLaLimpia.programas.hta, true, "y con lo que se había visto");
    });

    t.caso("v17.48.0 — y al revés: guardado sin ceros, se encuentra con ellos", () => {
      const c = cargar({ silencioso: true });
      c.api._vglCosechaGuardar("5150076", { programas: { diabetes: true } });
      const porLaRellenada = c.api._vglCosechaLeer("0005150076");
      t.cierto(!!porLaRellenada && !!porLaRellenada.programas, "la clave canónica es la misma");
      t.igual(porLaRellenada.programas.diabetes, true);
    });

    t.caso("FIX 15 M2M — la escritura no pisa la memoria que otra pestaña guardó mientras tanto", () => {
      const c = cargar({ silencioso: true });
      const ahora = Date.now();
      // S0: lo que ESTA pestaña leyó al entrar. S1: lo que la OTRA pestaña escribió
      // mientras tanto — actualizó a este paciente (hta) y guardó a otro (tabaquismo).
      // Se simula la carrera real: dos procesos, la 1.ª lectura ve S0, el disco ya tiene S1.
      const s0 = JSON.stringify({ "111111": { ts: ahora - 2000, programas: { dm: true } } });
      const s1 = JSON.stringify({
        "111111": { ts: ahora - 1000, programas: { dm: true, hta: true } },
        "222222": { ts: ahora - 500, factores: { tabaquismo: { v: true, ts: ahora - 500 } } },
      });
      const realGet = c.env.storage.getItem.bind(c.env.storage);
      let lecturas = 0;
      c.env.storage.getItem = (k) => (k === "vgl_cosecha" ? (++lecturas <= 1 ? s0 : s1) : realGet(k));
      c.api._vglCosechaGuardar("111111", { tension: { pas: 150 } });
      const guardado = JSON.parse(c.env.almacen["vgl_cosecha"]);
      t.cierto(!!guardado["222222"], "la memoria del paciente de la OTRA pestaña sobrevive");
      t.igual(guardado["111111"].programas.hta, true, "la actualización del otro para ESTE paciente se conserva");
      t.igual(guardado["111111"].tension.pas, 150, "y lo cosechado en esta pestaña se suma");
    });

    t.caso("v17.48.0 — dos pacientes DISTINTOS siguen sin cruzarse (los ceros no fusionan de más)", () => {
      const c = cargar({ silencioso: true });
      c.api._vglCosechaGuardar("5150076", { programas: { hta: true } });
      c.api._vglCosechaGuardar("5150077", { programas: { hta: false } });
      t.igual(c.api._vglCosechaLeer("5150076").programas.hta, true);
      t.igual(c.api._vglCosechaLeer("5150077").programas.hta, false, "cédulas distintas, memorias distintas");
    });

    t.caso("v17.48.0 — el detector agrupa las claves del MISMO paciente y no las de otros", () => {
    const c = cargar({ silencioso: true });
    const grupos = c.api._vglDetectarClavesDuplicadas({
      "0005150076": { ts: 1 },
      "5150076": { ts: 2 },
      "8396613": { ts: 3 },
      "00005150076": { ts: 4 },
    });
    t.igual(grupos.length, 1, "un solo paciente está partido en dos claves... más una tercera");
    t.igual(grupos[0].slice().sort(), ["0005150076", "00005150076", "5150076"].sort(), "las tres escrituras del mismo paciente");
  });

  t.caso("v17.48.0 — sin duplicados el detector no inventa grupos", () => {
    const c = cargar({ silencioso: true });
    t.igual(c.api._vglDetectarClavesDuplicadas({ "5150076": {}, "8396613": {} }).length, 0);
    t.igual(c.api._vglDetectarClavesDuplicadas(null).length, 0, "sin almacén, nada que decir");
  });

  t.caso("v17.48.0 — CERO PHI: el detector anota el conteo, jamás una cédula", () => {
    const c = cargar({ silencioso: true });
    // v18.0.60 — el duplicado YA NO se puede fabricar llamando dos veces a
    // `_vglCosechaGuardar`: desde esta versión resuelve la clave existente antes de
    // escribir, justo para no partir al paciente en dos (ver suite_32). Así que se monta
    // como se produce DE VERDAD: un registro que quedó en disco escrito por una versión
    // anterior a la canonicalización, y el de hoy con la forma canónica. El detector sigue
    // haciendo falta exactamente para eso — los duplicados viejos ya están en las máquinas.
    c.env.storage.setItem("vgl_cosecha", JSON.stringify({
      "0005150076": { programas: { hta: true }, ts: 1 },
      "5150076": { programas: { dm: true }, ts: 2 },
    }));
    c.env.storage.removeItem("vgl_flight_recorder_logs");
    const n = c.api._vglRevisarClavesDuplicadas();
    t.igual(n, 1, "debe encontrar el paciente partido");
    const crudo = String(c.env.almacen["vgl_flight_recorder_logs"] || "");
    t.cierto(crudo.indexOf("cedulas_duplicadas") >= 0, "debe quedar constancia en la bitácora");
    t.igual(crudo.indexOf("5150076"), -1, "pero la cédula NO puede aparecer en lo registrado");
    t.igual(crudo.indexOf("0005150076"), -1, "ni siquiera en su forma rellenada");
    const linea = JSON.parse(crudo).filter((e) => e.act === "cedulas_duplicadas")[0];
    t.igual(linea.act, "cedulas_duplicadas", "el nombre de la acción es fijo, nunca lleva la cédula pegada");
    t.igual(Object.keys(linea.det).slice().sort(), ["claves", "grupos"], "solo conteos: ningún campo más puede colarse");
  });

  t.caso("v17.48.0 — una cédula ilegible no se parece a TODAS las demás", () => {
    const c = cargar({ silencioso: true });
    c.api._vglCosechaGuardar("5150076", { programas: { hta: true } });
    t.falso(!!c.api._vglCosechaLeer("abc"), "texto sin dígitos no puede devolver la historia de otro paciente");
    t.falso(!!c.api._vglCosechaLeer("0"), "ni un cero suelto");
    t.igual(c.api._vglDetectarClavesDuplicadas({ "abc": {}, "---": {} }).length, 0, "dos claves ilegibles no son el mismo paciente");
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

    // v17.6.74 — [reportado en consultorio, 26-ago-2026, con captura real] "cuando sea
    // ese caso el script solamente debe tomar los ÚLTIMOS que fueron prescritos. No
    // poner dos medicamentos iguales pero con diferentes dosis" (instrucción explícita
    // del médico). Caso real: LOSARTAN 50mg, ROSUVASTATINA 40mg y ROSUVASTATINA 20mg —
    // las dos últimas debían colapsar en UNA sola (la más reciente), no aparecer las dos.
    t.caso("mtrMedicamentosRcv (1.15-bis): dos concentraciones del MISMO fármaco cuentan como uno — se conserva la primera vista (la más reciente, con la lista ya ordenada por fecha)", () => {
      // El orden aquí YA simula la salida de mtrMedicamentosDesdeRespuesta tras ordenar
      // por fecha descendente (ver suite 39): la formulación más reciente va primero.
      const lista = a.mtrMedicamentosRcv([
        "LOSARTAN 50 mg (TABLETA)",
        "ROSUVASTATINA 40 MG (TABLETA)",   // la más reciente: debe sobrevivir
        "ROSUVASTATINA 20 MG (TABLETA)",   // la vieja: debe desaparecer
      ]);
      t.igual(lista.length, 2, "LOSARTAN + UNA sola ROSUVASTATINA, no tres renglones");
      const rosu = lista.filter((m) => /ROSUVASTATINA/i.test(m.nombre));
      t.igual(rosu.length, 1, "solo una rosuvastatina sobrevive");
      t.cierto(/40 MG/.test(rosu[0].nombre), "y es la de 40 MG — la que llegó primero en la lista (la más reciente)");
    });

    t.caso("mtrMedicamentosRcv (1.15-bis): un combo NO se fusiona con sus componentes sueltos, aunque compartan principio activo", () => {
      const lista = a.mtrMedicamentosRcv([
        "AMLODIPINO 10 MG (TABLETA)",
        "AMLODIPINO + LOSARTAN 5/50MG (TABLETA)",
      ]);
      t.igual(lista.length, 2, "el combo y el amlodipino solo cuentan como DOS medicamentos distintos, no se funden");
      t.cierto(lista.some((m) => m.nombre === "AMLODIPINO 10 MG (TABLETA)"));
      t.cierto(lista.some((m) => m.nombre === "AMLODIPINO + LOSARTAN 5/50MG (TABLETA)"));
    });

    t.caso("mtrMedicamentosRcv (1.15-bis): la frecuencia se sigue buscando POR DOSIS (mezclar frecuencias entre concentraciones distintas sería inventar un dato)", () => {
      // El mapa de frecuencias usa la clave CON dosis (mtrMapaFrecuenciasPorNombre real):
      // solo la formulación exacta de 40 MG tiene frecuencia conocida.
      const frecuencias = new Map([["rosuvastatina 40 mg (tableta)", "cada 24 horas"]]);
      const lista = a.mtrMedicamentosRcv([
        "ROSUVASTATINA 40 MG (TABLETA)",
        "ROSUVASTATINA 20 MG (TABLETA)",
      ], frecuencias);
      t.igual(lista.length, 1, "se colapsan en una, como siempre");
      t.igual(lista[0].frecuenciaTexto, "cada 24 horas", "la frecuencia de la formulación que sobrevivió (40 MG) sí se encuentra");
    });

    t.caso("_mtrClaveDedupMedicamentoSinDosis: corta en la primera cifra, y sin ninguna cifra usa el nombre completo", () => {
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("ROSUVASTATINA 40 MG (TABLETA)"), "rosuvastatina");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("ROSUVASTATINA 20 MG (TABLETA)"), "rosuvastatina");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("LOSARTAN 50 mg (TABLETA)"), "losartan");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("INDAPAMIDA 1.5 MG (TABLETA DE LIBERACION SOSTENIDA)"), "indapamida");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("GEMFIBROZIL 600 mg (TABLETA)"), "gemfibrozil");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("ENALAPRIL MALEATO 20 mg (TABLETA)"), "enalapril maleato");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("LINAGLIPTINA + METFORMINA 2.5/1000MG (TABLETA)"), "linagliptina + metformina");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("INSULINA GLARGINA 100UI/ML (PEN 3ML )"), "insulina glargina");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("AMLODIPINO + LOSARTAN 5/50MG (TABLETA)"), "amlodipino + losartan",
        "el combo conserva los DOS nombres: el '+' viene antes que cualquier dígito");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis("TIRAS REACTIVAS PARA GLUCOMETRIA (UNIDAD)"), "tiras reactivas para glucometria (unidad)",
        "sin ningún dígito, se usa el nombre completo — igual que _mtrClaveDedupMedicamento");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis(""), "");
      t.igual(a._mtrClaveDedupMedicamentoSinDosis(null), "");
    });

    // v17.6.74 — GUARDA: _mtrClaveDedupMedicamento (CON dosis) no debe tocarse — la usa
    // mtrMedicamentosUnicos/mtrDuplicidadesTerapeuticas, donde dos concentraciones
    // distintas del mismo principio SIGUEN debiendo alertar (decisión ya vigente,
    // documentada en el comentario de esa función).
    t.caso("_mtrClaveDedupMedicamento (CON dosis, sin tocar): dos concentraciones distintas siguen siendo claves DISTINTAS", () => {
      t.falso(
        a._mtrClaveDedupMedicamento("ROSUVASTATINA 40 MG (TABLETA)") === a._mtrClaveDedupMedicamento("ROSUVASTATINA 20 MG (TABLETA)"),
        "la clave CON dosis no debe fusionar concentraciones distintas: eso apagaría la alerta de duplicidad terapéutica"
      );
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

    // v17.x.x — REFACTOR S+ (30-ago): control de acceso por médico. Los inyectores de
    // redacción («Enfermedad actual» y «Análisis y plan») son parte del Redactor IA: solo
    // se pintan para médico autorizado CON la redacción activada y su clave Gemini. Igual
    // que el botón «Redactar» del dock.
    function mockCasillasInyectores(c) {
      const ea = c.env.doc.createElement("textarea");
      ea.setAttribute("name", "UltimaEnfermedad");
      const an = c.env.doc.createElement("textarea");
      an.setAttribute("placeholder", "Ingrese la descripcion del analisis del paciente");
      c.env.doc.querySelector = (sel) => {
        const s = String(sel || "");
        if (s.indexOf('textarea[name="UltimaEnfermedad"]') >= 0) return ea;
        return null;
      };
      c.env.doc.querySelectorAll = (sel) => (String(sel) === "textarea" ? [an] : []);
      const creados = [];
      c.env.doc.body.appendChild = (n) => { n._parent = c.env.doc.body; c.env.doc.body.children.push(n); creados.push(n); };
      return creados;
    }

    // v18.1.0 (Misión B / B1) — el padrón autorizado ya no vive en el userscript: el
    // médico COMPLETO de estas pruebas (uid 707) se siembra en `vgl_acceso_lista`,
    // como la dejaría el fetch del arreglo B2.
    const ALMACEN_ACCESO_64 = { vgl_acceso_lista: JSON.stringify({
      version: "test-64.1",
      perfiles: { COMPLETO: [{ uid: 707, nombre: "Brandon Jesús Palencia Martínez" }], LABORATORIOS: [] },
      blocklist: [],
    }) };
    t.caso("createIaInjectorUI: médico autorizado con redacción activada pinta los dos inyectores cuando las casillas están en pantalla", () => {
      const c = cargar({ silencioso: true, almacen: ALMACEN_ACCESO_64 });
      const a = c.api;
      a.__state.activeDoctor = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
      a.__S.iaRedaccion = true;
      a.mtrGuardarClaveGemini("CLAVE-DE-PRUEBA");
      const creados = mockCasillasInyectores(c);
      a.createIaInjectorUI();
      t.igual(creados.map((n) => n.id).sort(), ["vgl-ia-inj-an", "vgl-ia-inj-ea"],
        "con permiso completo se pintan los dos botones por casilla");
    });

    t.caso("createIaInjectorUI: médico NO autorizado no pinta los inyectores aunque las casillas estén en pantalla", () => {
      const c = cargar({ silencioso: true });
      const a = c.api;
      a.__state.activeDoctor = { id: 909, name: "ANA MARIA PEREZ" }; // no está en la lista autorizada
      a.__S.iaRedaccion = true;
      a.mtrGuardarClaveGemini("CLAVE-DE-PRUEBA");
      const creados = mockCasillasInyectores(c);
      a.createIaInjectorUI();
      t.igual(creados.length, 0, "sin autorización no se pinta nada, con casilla presente o sin ella");
    });

    t.caso("createIaInjectorUI: médico autorizado sin clave Gemini no pinta los inyectores", () => {
      const c = cargar({ silencioso: true, almacen: ALMACEN_ACCESO_64 });
      const a = c.api;
      a.__state.activeDoctor = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
      a.__S.iaRedaccion = true;
      // sin mtrGuardarClaveGemini → mtrLeerClaveGemini() devuelve "" → no se pinta nada
      const creados = mockCasillasInyectores(c);
      a.createIaInjectorUI();
      t.igual(creados.length, 0, "el Redactor IA no se muestra sin la clave configurada");
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
