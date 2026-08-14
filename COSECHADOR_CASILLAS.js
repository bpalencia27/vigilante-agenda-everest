/* ===========================================================================
   COSECHADOR DE CASILLAS — inventario del formulario de Everest, de un solo tiro
   ---------------------------------------------------------------------------
   PARA QUÉ: el médico tiene razón en que muchas cosas que "no tenemos" SÍ están
   en la historia clínica de Everest — tabaquismo, sedentarismo, antecedentes,
   ECV establecida. Lo que falta no es el dato: es saber EN QUÉ CASILLA vive.

   Ya existe `DIAGNOSTICO_FACTORES_RCV.js`, que graba una sesión entera mientras
   se recorren las pestañas. Este es su complemento y es más simple: se pega en
   la pantalla que uno quiera y devuelve el inventario de ESA pantalla al
   instante. Sin sesión, sin esperar, sin recordar por dónde se pasó.

   Sirve para responder de una vez preguntas como: ¿existe una casilla de
   tabaquismo?, ¿cómo se llama?, ¿es un sí/no o una lista?, ¿qué opciones tiene?

   ---------------------------------------------------------------------------
   PRIVACIDAD — LÉALO ANTES DE ENVIAR NADA

   Lo que SÍ se captura: el nombre técnico de cada casilla (id/name), su tipo, la
   etiqueta visible, y el título de la sección donde vive. Eso es estructura del
   formulario, no datos del paciente.

   Lo que NO se captura NUNCA: lo escrito en casillas de texto, número, fecha,
   correo o teléfono. Ni una sola letra. Esos campos salen siempre como
   "[no-capturado]".

   La única excepción, y es deliberada: en casillas de marcar (sí/no) y en listas
   desplegables SÍ se anota qué está marcado o elegido — porque ESE es justo el
   dato clínico que buscamos ("Fuma: SÍ"). Si no quiere ni eso, ejecute
   VGL_COSECHA(false) y saldrá solo la estructura, sin ningún estado.

   Aun así: revise el archivo antes de mandarlo.

   ---------------------------------------------------------------------------
   MODO DE USO

   1. Abra la historia clínica de un paciente. Mejor uno SIN cambios sin guardar:
      el recorrido cambia de pestaña, y qué hace Everest con un formulario a medio
      llenar es cosa suya, no de este script.
   2. F12 -> pestaña "Console". Pegue este archivo entero y pulse Enter.
   3. Escriba:

          VGL_COSECHA_TODO()

      Recorre TODAS las pestañas solo —pulsa cada una, espera a que Angular la
      monte, anota— y al final descarga UN archivo con todo. Unos 20 segundos.
      En la consola queda además una tabla con las casillas que parecen factores
      de riesgo: tabaquismo, antecedentes, ECV. Eso es lo que hace falta.

   4. Si prefiere ir a mano, VGL_COSECHA() cosecha solo la pantalla actual.

   NO MODIFICA NADA. Pulsa pestañas, que es lo mismo que haría usted con el ratón.
   No escribe en ninguna casilla, no guarda, no envía nada a ningún sitio.
   =========================================================================== */

(function () {
  "use strict";

  // Un valor que "parece" un identificador se tacha aunque venga de una lista:
  // en un desplegable de acudientes, por ejemplo, podría colarse una cédula.
  const PARECE_ID = /^\s*\d{5,}\s*$/;

  // El título de sección más cercano da el contexto que el nombre técnico no da:
  // "swFuma" dentro de "Hábitos" se entiende; suelto, no.
  function seccionDe(el) {
    try {
      let n = el;
      for (let i = 0; i < 12 && n; i++) {
        n = n.parentElement;
        if (!n) break;
        const h = n.querySelector("h1,h2,h3,h4,h5,legend,.card-header,.panel-title,[class*=titulo],[class*=title]");
        if (h) {
          const t = (h.textContent || "").replace(/\s+/g, " ").trim();
          if (t && t.length < 90) return t;
        }
      }
    } catch (e) {}
    return "";
  }

  function etiquetaDe(el) {
    try {
      if (el.id) {
        const l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
        if (l) return (l.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90);
      }
      const env = el.closest && el.closest("label");
      if (env) return (env.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90);
      // Angular suele poner la etiqueta como hermano anterior, no como <label for>.
      const prev = el.previousElementSibling;
      if (prev && /^(label|span|b|strong|p)$/i.test(prev.tagName)) {
        return (prev.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90);
      }
    } catch (e) {}
    return "";
  }

  window.VGL_COSECHA = function (conEstado, sinArchivo) {
    const capturarEstado = conEstado !== false; // por defecto sí
    const campos = [];
    const vistos = new Set();

    document.querySelectorAll("input,select,textarea").forEach(function (el) {
      try {
        if (el.type === "hidden") return;
        const id = el.id || "";
        const name = el.name || "";
        const tipo = (el.type || el.tagName || "").toLowerCase();
        // Los radios comparten `name` a propósito (es el grupo sí/no): se conserva
        // cada uno, distinguido por su etiqueta, porque esa etiqueta ES la opción.
        const clave = id + "|" + name + "|" + tipo + "|" + etiquetaDe(el);
        if (vistos.has(clave)) return;
        vistos.add(clave);

        let estado = "[no-capturado]";
        if (capturarEstado) {
          if (tipo === "checkbox" || tipo === "radio") {
            estado = !!el.checked;
          } else if (el.tagName === "SELECT") {
            const op = el.options && el.options[el.selectedIndex];
            const txt = op ? (op.text || "").trim() : "";
            estado = PARECE_ID.test(txt) ? "[NUM-REDACTADO]" : txt;
          }
          // Texto, número, fecha, correo, teléfono: JAMÁS. Se quedan en
          // "[no-capturado]" — es donde vive lo escrito del paciente.
        }

        const fila = {
          id: id,
          name: name,
          tipo: tipo,
          etiqueta: etiquetaDe(el),
          seccion: seccionDe(el),
          estado: estado,
        };

        // Para un desplegable, el VOCABULARIO importa tanto como el campo: saber que
        // "Tabaquismo" ofrece {Nunca, Exfumador, Activo} define cómo leerlo después.
        if (el.tagName === "SELECT" && el.options) {
          fila.opciones = Array.prototype.slice.call(el.options, 0, 25)
            .map(function (o) { return (o.text || "").trim(); })
            .filter(function (t) { return t && !PARECE_ID.test(t); });
        }
        if (el.placeholder) fila.placeholder = String(el.placeholder).slice(0, 60);
        campos.push(fila);
      } catch (e) {}
    });

    // Las pestañas visibles ayudan a saber qué pantallas faltan por cosechar.
    const pestanas = [];
    try {
      document.querySelectorAll('a[id], [role="tab"], .nav-link, .mat-tab-label').forEach(function (el) {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t && t.length < 60 && pestanas.indexOf(t) === -1) pestanas.push(t);
      });
    } catch (e) {}

    const salida = {
      _nota: "Inventario de casillas de Everest. Sin valores de texto: solo estructura del formulario.",
      capturadoEn: new Date().toISOString(),
      url: location.href,
      tituloPantalla: (document.title || "").slice(0, 120),
      estadoCapturado: capturarEstado,
      totalCampos: campos.length,
      pestanasVisibles: pestanas,
      campos: campos,
    };

    if (sinArchivo) return salida;   // el recorrido completo junta todo y descarga UNA vez

    const texto = JSON.stringify(salida, null, 1);
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
      const d = new Date(), p = function (x) { return String(x).padStart(2, "0"); };
      a.download = "casillas_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.warn("[Cosechador] no se pudo descargar, use el portapapeles:", e); }
    try { if (window.copy) window.copy(texto); } catch (e) {}

    console.log("%c[Cosechador] " + campos.length + " casillas en esta pantalla. Archivo descargado y copiado al portapapeles.", "color:#0a0;font-weight:bold;font-size:14px");
    if (pestanas.length) console.log("[Cosechador] Pestañas que se ven desde aquí:", pestanas.join(" · "));
    console.log("%cCambie de pestaña y escriba  VGL_COSECHA()  otra vez.", "color:#06c");

    // Un vistazo rápido en consola, por si la respuesta salta a la vista sin abrir el archivo.
    try {
      const interesantes = campos.filter(function (c) {
        return /fum|tabac|cigarr|sedentar|activid|alcohol|infarto|iam|acv|stent|revascular|angina|cardiovascular|ecv|familiar|antecedent|riesgo|habito|hábito|peso|talla|imc|presion|presión|perimetro|perímetro/i
          .test((c.id + " " + c.name + " " + c.etiqueta + " " + c.seccion));
      });
      if (interesantes.length) {
        console.log("%c[Cosechador] Casillas que parecen factores de riesgo:", "color:#e54d42;font-weight:bold");
        console.table(interesantes.map(function (c) { return { id: c.id, name: c.name, tipo: c.tipo, etiqueta: c.etiqueta, seccion: c.seccion, estado: c.estado }; }));
      }
    } catch (e) {}

    return salida;
  };

  // ===========================================================================
  //  VGL_COSECHA_TODO() — RECORRE TODAS LAS PESTAÑAS SOLO
  //
  //  Pedido del médico: "captura y graba todas las pestañas de la historia clínica
  //  para que tengas un panorama completo". Esto hace justo eso: pulsa cada pestaña,
  //  espera a que Angular la monte, cosecha, y pasa a la siguiente. Al final descarga
  //  UN archivo con todo junto.
  //
  //  QUÉ HACE Y QUÉ NO: solo NAVEGA y MIRA. Pulsa pestañas, que es lo mismo que haría
  //  usted con el ratón. No escribe en ninguna casilla, no pulsa Guardar, no envía nada
  //  a ningún sitio. Rigen las mismas reglas de privacidad de arriba: de las casillas de
  //  texto, número y fecha no se copia ni una letra.
  //
  //  AUN ASÍ, ÚSELO CON UN PACIENTE SIN CAMBIOS SIN GUARDAR. Cambiar de pestaña en un
  //  formulario a medio llenar es cosa de Everest, no de este script, y no sé qué hace
  //  Everest con eso. Lo prudente: abra un paciente, no escriba nada, y ejecútelo.
  // ===========================================================================
  const _dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  window.VGL_COSECHA_TODO = async function (conEstado) {
    // Se resuelven las pestañas ANTES de empezar: al pulsar la primera, Angular
    // reconstruye el DOM y una lista de nodos guardada se queda con referencias muertas.
    const candidatas = [];
    const vistas = new Set();
    document.querySelectorAll('[role="tab"], .nav-link, .mat-tab-label, ul.nav a, .nav-tabs a').forEach(function (el) {
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!txt || txt.length > 60 || vistas.has(txt)) return;
      if (el.closest && el.closest("#vgl-root")) return;      // nunca el panel del propio Vigilante
      vistas.add(txt);
      candidatas.push(txt);
    });

    if (!candidatas.length) {
      console.warn("%c[Cosechador] No encontré pestañas en esta pantalla. Use VGL_COSECHA() a mano en cada una.", "color:#e54d42;font-weight:bold");
      return null;
    }

    console.log("%c[Cosechador] " + candidatas.length + " pestañas por recorrer: " + candidatas.join(" · "), "color:#06c;font-weight:bold");
    const porPestana = [];

    for (let i = 0; i < candidatas.length; i++) {
      const nombre = candidatas[i];
      // Se vuelve a buscar por TEXTO en cada vuelta, contra el DOM de AHORA.
      let destino = null;
      const todos = document.querySelectorAll('[role="tab"], .nav-link, .mat-tab-label, ul.nav a, .nav-tabs a');
      for (const el of todos) {
        if ((el.textContent || "").replace(/\s+/g, " ").trim() !== nombre) continue;
        if (el.closest && el.closest("#vgl-root")) continue;
        destino = el; break;
      }
      if (!destino) { porPestana.push({ pestana: nombre, error: "no se volvió a encontrar tras cambiar de vista" }); continue; }

      try { destino.click(); } catch (e) { porPestana.push({ pestana: nombre, error: "no se pudo pulsar: " + e }); continue; }
      // 900 ms es lo que ya usa DIAGNOSTICO_FACTORES_RCV.js para esperar a Angular en
      // esta misma aplicación; se respeta ese número en vez de inventar otro.
      await _dormir(900);

      const inv = window.VGL_COSECHA_SILENCIOSA(conEstado);
      porPestana.push({ pestana: nombre, totalCampos: inv.totalCampos, campos: inv.campos });
      console.log("[Cosechador] " + (i + 1) + "/" + candidatas.length + " — \"" + nombre + "\": " + inv.totalCampos + " casillas");
    }

    const salida = {
      _nota: "Recorrido completo de las pestañas de la historia clínica de Everest. Sin valores de texto: solo estructura del formulario.",
      capturadoEn: new Date().toISOString(),
      url: location.href,
      estadoCapturado: conEstado !== false,
      pestanasRecorridas: porPestana.length,
      totalCamposTodos: porPestana.reduce((n, p) => n + (p.totalCampos || 0), 0),
      pestanas: porPestana,
    };

    const texto = JSON.stringify(salida, null, 1);
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
      const d = new Date(), p = (x) => String(x).padStart(2, "0");
      a.download = "casillas_TODAS_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.warn("[Cosechador] no se pudo descargar:", e); }
    try { if (window.copy) window.copy(texto); } catch (e) {}

    console.log("%c[Cosechador] LISTO — " + salida.pestanasRecorridas + " pestañas, " + salida.totalCamposTodos + " casillas en total. Archivo descargado y copiado al portapapeles.", "color:#0a0;font-weight:bold;font-size:14px");

    // El resumen que de verdad se buscaba: dónde vive cada factor de riesgo.
    try {
      const filas = [];
      porPestana.forEach((p) => (p.campos || []).forEach((c) => {
        if (/fum|tabac|cigarr|sedentar|activid.*f[ií]s|alcohol|infarto|iam|acv|ecv|stent|revascular|angina|antecedent|familiar/i
          .test(c.id + " " + c.name + " " + c.etiqueta + " " + c.seccion)) {
          filas.push({ pestana: p.pestana, id: c.id, name: c.name, tipo: c.tipo, etiqueta: c.etiqueta, seccion: c.seccion, estado: c.estado });
        }
      }));
      if (filas.length) {
        console.log("%c[Cosechador] FACTORES DE RIESGO ENCONTRADOS — esto es lo que hacía falta:", "color:#e54d42;font-weight:bold;font-size:13px");
        console.table(filas);
      } else {
        console.log("%c[Cosechador] Ninguna casilla de tabaquismo/antecedentes/ECV en las pestañas recorridas. Puede que vivan en otra pantalla (Antecedentes fuera de la consulta, o en el módulo de Riesgo Cardiovascular).", "color:#c80");
      }
    } catch (e) {}

    return salida;
  };

  // Misma cosecha, sin descargar ni imprimir: la usa el recorrido de arriba.
  window.VGL_COSECHA_SILENCIOSA = function (conEstado) {
    const log = console.log, warn = console.warn, tabla = console.table;
    console.log = console.warn = console.table = function () {};
    try { return window.VGL_COSECHA(conEstado, true); }
    finally { console.log = log; console.warn = warn; console.table = tabla; }
  };

  console.log("%c[Cosechador] Listo. Dos formas de usarlo:", "color:#06c;font-weight:bold;font-size:14px");
  console.log("%c  VGL_COSECHA_TODO()  ← recorre TODAS las pestañas solo (lo que quiere el médico)", "color:#0a0;font-weight:bold");
  console.log("%c  VGL_COSECHA()       ← solo la pantalla en la que está ahora", "color:#06c");
})();
