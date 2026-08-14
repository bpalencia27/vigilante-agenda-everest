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
   MODO DE USO (30 segundos por pestaña)

   1. Abra la historia clínica del paciente y párese en la pestaña que le
      interese (Antecedentes, Hábitos y Gestión de Riesgo, Examen físico…).
   2. F12 -> pestaña "Console". Pegue este archivo entero y pulse Enter.
   3. Se descarga un .json y además queda copiado al portapapeles.
   4. Cambie de pestaña y escriba   VGL_COSECHA()   otra vez. Una por pestaña.

   NO MODIFICA NADA. No escribe, no guarda, no envía. Solo mira y anota.
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

  window.VGL_COSECHA = function (conEstado) {
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

  VGL_COSECHA();
})();
