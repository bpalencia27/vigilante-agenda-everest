/* ===========================================================================
   MAPA TOTAL DE EVEREST — todo lo que la aplicación enseña, en un archivo
   ---------------------------------------------------------------------------
   El cosechador anterior miraba las casillas de una pantalla. Este mapea la
   aplicación entera: casillas, botones, tablas, pestañas, rutas, componentes
   de Angular, claves de almacenamiento y —lo más valioso— LOS NOMBRES DE CAMPO
   DE LAS RESPUESTAS DE RED.

   POR QUÉ LO DE LA RED IMPORTA MÁS QUE EL RESTO
   Dos de los mejores hallazgos del proyecto salieron de mirar una respuesta que
   el script YA descargaba y no leía: la EDAD venía en BuscarPacienteDetallado, y
   la PRESIÓN ARTERIAL venía en el historial de signos vitales. Los dos estuvieron
   meses ahí delante. Esto los habría encontrado en un minuto, y encontrará los
   que queden.

   ---------------------------------------------------------------------------
   PRIVACIDAD — LÉALO ANTES DE ENVIARME NADA

   La regla es una sola y no tiene excepciones: SE CAPTURAN NOMBRES, NUNCA VALORES.

   · Casillas de texto, número, fecha, correo, teléfono y contraseña: ni una letra.
   · Tablas: solo los ENCABEZADOS y cuántas filas hay. Ningún contenido de celda.
   · Respuestas de red: solo los NOMBRES DE CAMPO (las claves del JSON). Ningún valor.
   · Almacenamiento local: solo los NOMBRES DE CLAVE. Ningún contenido.
   · Todo texto capturado pasa por un filtro que tacha cualquier cadena de 5 o más
     dígitos seguidos, por si una cédula se colara en una etiqueta o en una URL.

   La única excepción, deliberada: en casillas de marcar y listas desplegables SÍ se
   anota qué está marcado o elegido, porque ESE es el dato clínico que buscamos
   ("Fuma: SÍ"). Si no lo quiere, ejecute VGL_MAPA_TODO(false).

   Aun así: abra el archivo y léalo antes de mandarlo.

   ---------------------------------------------------------------------------
   MODO DE USO

   1. Abra la historia clínica de un paciente. Mejor uno SIN cambios sin guardar.
   2. F12 -> "Console". Pegue este archivo entero y pulse Enter.
      Desde ese momento queda escuchando la red (sin tocarla).
   3. Escriba:   VGL_MAPA_TODO()
      Recorre todas las pestañas solo y al final descarga un archivo con todo.
   4. Opcional, para que el mapa de red salga más rico: antes del paso 3, navegue
      un poco a mano (abra laboratorios, órdenes, antecedentes). Todo lo que
      pase por la red queda anotado.

   NO MODIFICA NADA. Pulsa pestañas, que es lo que haría usted con el ratón.
   No escribe en casillas, no guarda, no envía nada a ningún sitio.
   =========================================================================== */

(function () {
  "use strict";

  // Cualquier cadena de 5+ dígitos se tacha: cédulas, números de historia, ids de
  // paciente. Se aplica a TODO el texto capturado, venga de donde venga.
  const NUM = /\d{5,}/g;
  const lim = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().replace(NUM, "[NUM]").slice(0, n || 90);

  // =========================================================================
  //  1. ESCUCHA DE RED — se instala al pegar el archivo
  //  Envuelve fetch y XMLHttpRequest para anotar QUÉ endpoints existen y QUÉ
  //  NOMBRES DE CAMPO devuelven. Nunca el contenido.
  // =========================================================================
  const RED = new Map();   // "MÉTODO ruta" -> { metodo, ruta, params, claves, vistas }

  function clavesDe(obj, prof) {
    // Recorre hasta 3 niveles y devuelve rutas de CLAVES: "datos.paciente.edad".
    // De un arreglo se mira solo el primer elemento: la forma es la misma y así
    // no se recorre una respuesta de 500 filas.
    const salida = [];
    (function rec(o, pre, d) {
      if (d > 3 || o == null) return;
      if (Array.isArray(o)) { if (o.length) rec(o[0], pre + "[]", d + 1); return; }
      if (typeof o !== "object") return;
      for (const k of Object.keys(o).slice(0, 60)) {
        const ruta = pre ? pre + "." + k : k;
        salida.push(ruta);
        const v = o[k];
        if (v && typeof v === "object") rec(v, ruta, d + 1);
      }
    })(obj, "", 0);
    return salida.slice(0, 200);
  }

  function anota(metodo, url, cuerpo) {
    try {
      let u;
      try { u = new URL(url, location.origin); } catch (e) { u = { pathname: String(url), searchParams: new Map() }; }
      const ruta = lim(u.pathname, 160);
      const clave = metodo + " " + ruta;
      const prev = RED.get(clave) || { metodo, ruta, params: [], claves: [], vistas: 0 };
      prev.vistas++;
      try {
        // Solo los NOMBRES de los parámetros: sus valores llevan la cédula.
        for (const k of u.searchParams.keys()) if (prev.params.indexOf(k) === -1) prev.params.push(k);
      } catch (e) {}
      if (cuerpo && !prev.claves.length) {
        try {
          const j = typeof cuerpo === "string" ? JSON.parse(cuerpo) : cuerpo;
          prev.claves = clavesDe(j, 0);
        } catch (e) { prev.claves = ["(la respuesta no es JSON)"]; }
      }
      RED.set(clave, prev);
    } catch (e) {}
  }

  if (!window.__VGL_RED_ENGANCHADA__) {
    window.__VGL_RED_ENGANCHADA__ = true;

    const fetchOriginal = window.fetch;
    if (typeof fetchOriginal === "function") {
      window.fetch = function (entrada, opciones) {
        const url = (entrada && entrada.url) || entrada;
        const metodo = ((opciones && opciones.method) || (entrada && entrada.method) || "GET").toUpperCase();
        return fetchOriginal.apply(this, arguments).then(function (res) {
          // Se lee un CLON: tocar el original le quitaría el cuerpo a la aplicación
          // y rompería Everest. Esto es lo único delicado del archivo.
          try { res.clone().text().then((t) => anota(metodo, url, t)).catch(() => anota(metodo, url, null)); }
          catch (e) { anota(metodo, url, null); }
          return res;
        });
      };
    }

    const abrirOriginal = XMLHttpRequest.prototype.open;
    const enviarOriginal = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__vglM = m; this.__vglU = u; return abrirOriginal.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
      const xhr = this;
      xhr.addEventListener("load", function () {
        try { anota(String(xhr.__vglM || "GET").toUpperCase(), xhr.__vglU, xhr.responseType === "" || xhr.responseType === "text" ? xhr.responseText : null); }
        catch (e) {}
      });
      return enviarOriginal.apply(this, arguments);
    };
  }

  // =========================================================================
  //  2. INVENTARIO DE UNA PANTALLA
  // =========================================================================
  function seccionDe(el) {
    try {
      let n = el;
      for (let i = 0; i < 12 && n; i++) {
        n = n.parentElement; if (!n) break;
        const h = n.querySelector("h1,h2,h3,h4,h5,legend,.card-header,.panel-title,[class*=titulo],[class*=title]");
        if (h) { const t = lim(h.textContent); if (t) return t; }
      }
    } catch (e) {}
    return "";
  }

  function etiquetaDe(el) {
    try {
      if (el.id) {
        const l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
        if (l) return lim(l.textContent);
      }
      const env = el.closest && el.closest("label");
      if (env) return lim(env.textContent);
      const prev = el.previousElementSibling;   // Angular suele poner la etiqueta como hermano
      if (prev && /^(label|span|b|strong|p)$/i.test(prev.tagName)) return lim(prev.textContent);
    } catch (e) {}
    return "";
  }

  function inventarioPantalla(conEstado) {
    const capturar = conEstado !== false;

    // --- Casillas ---
    const campos = [], vistos = new Set();
    document.querySelectorAll("input,select,textarea").forEach(function (el) {
      try {
        if (el.type === "hidden") return;
        const tipo = String(el.type || el.tagName || "").toLowerCase();
        const clave = (el.id || "") + "|" + (el.name || "") + "|" + tipo + "|" + etiquetaDe(el);
        if (vistos.has(clave)) return;
        vistos.add(clave);

        let estado = "[no-capturado]";
        if (capturar) {
          if (tipo === "checkbox" || tipo === "radio") estado = !!el.checked;
          else if (el.tagName === "SELECT") {
            const op = el.options && el.options[el.selectedIndex];
            estado = op ? lim(op.text, 60) : "";
          }
          // Texto, número, fecha, correo, teléfono, contraseña: JAMÁS.
        }
        const fila = { id: el.id || "", name: el.name || "", tipo, etiqueta: etiquetaDe(el), seccion: seccionDe(el), estado };
        if (el.tagName === "SELECT" && el.options) {
          // El VOCABULARIO de una lista vale tanto como el campo: saber que
          // "Tabaquismo" ofrece {Nunca, Exfumador, Activo} define cómo leerlo.
          fila.opciones = Array.prototype.slice.call(el.options, 0, 30).map((o) => lim(o.text, 60)).filter(Boolean);
        }
        if (el.placeholder) fila.placeholder = lim(el.placeholder, 60);
        if (el.required) fila.obligatorio = true;
        if (el.disabled) fila.deshabilitado = true;
        campos.push(fila);
      } catch (e) {}
    });

    // --- Botones y acciones ---
    const botones = [], vb = new Set();
    document.querySelectorAll('button,[role="button"],input[type=submit],input[type=button],a.btn,.btn').forEach(function (el) {
      try {
        if (el.closest && el.closest("#vgl-root")) return;   // nunca el panel del propio Vigilante
        const txt = lim(el.textContent || el.value, 60);
        const k = (el.id || "") + "|" + txt;
        if (!txt && !el.id) return;
        if (vb.has(k)) return; vb.add(k);
        botones.push({ id: el.id || "", texto: txt, seccion: seccionDe(el), deshabilitado: !!el.disabled });
      } catch (e) {}
    });

    // --- Tablas: SOLO encabezados y cuántas filas. Ninguna celda. ---
    const tablas = [];
    document.querySelectorAll("table").forEach(function (t) {
      try {
        if (t.closest && t.closest("#vgl-root")) return;
        const enc = Array.prototype.slice.call(t.querySelectorAll("th"), 0, 30).map((h) => lim(h.textContent, 50)).filter(Boolean);
        if (!enc.length) return;
        tablas.push({ id: t.id || "", encabezados: enc, filas: t.querySelectorAll("tbody tr").length, seccion: seccionDe(t) });
      } catch (e) {}
    });

    // --- Componentes de Angular: las etiquetas propias dicen la arquitectura ---
    const componentes = [];
    try {
      const c = new Set();
      document.querySelectorAll("*").forEach((el) => { const t = el.tagName.toLowerCase(); if (t.indexOf("-") > 0 && !t.startsWith("vgl")) c.add(t); });
      componentes.push(...Array.from(c).slice(0, 120));
    } catch (e) {}

    // --- Títulos: el esqueleto visible de la pantalla ---
    const titulos = [];
    try {
      document.querySelectorAll("h1,h2,h3,h4,h5,legend,.card-header,.panel-title").forEach((h) => {
        if (h.closest && h.closest("#vgl-root")) return;
        const t = lim(h.textContent, 80); if (t && titulos.indexOf(t) === -1) titulos.push(t);
      });
    } catch (e) {}

    // --- Enlaces y rutas ---
    const rutas = [];
    try {
      document.querySelectorAll("a[href],[routerLink]").forEach((a) => {
        if (a.closest && a.closest("#vgl-root")) return;
        const h = a.getAttribute("routerLink") || a.getAttribute("href") || "";
        if (!h || h === "#" || h.startsWith("javascript")) return;
        const r = lim(h, 120); if (rutas.indexOf(r) === -1) rutas.push(r);
      });
    } catch (e) {}

    return { totalCampos: campos.length, campos, botones, tablas, componentes, titulos, rutas: rutas.slice(0, 80) };
  }

  window.VGL_MAPA_PANTALLA = inventarioPantalla;

  // =========================================================================
  //  3. RECORRIDO COMPLETO
  // =========================================================================
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  function pestanasVisibles() {
    const out = [], vistas = new Set();
    document.querySelectorAll('[role="tab"], .nav-link, .mat-tab-label, ul.nav a, .nav-tabs a, .nav-pills a').forEach(function (el) {
      if (el.closest && el.closest("#vgl-root")) return;
      const t = lim(el.textContent, 60);
      if (!t || vistas.has(t)) return;
      vistas.add(t); out.push(t);
    });
    return out;
  }

  window.VGL_MAPA_TODO = async function (conEstado) {
    const nombres = pestanasVisibles();
    const porPestana = [];

    // Siempre se mapea la pantalla actual, haya pestañas o no.
    porPestana.push(Object.assign({ pestana: "(pantalla inicial)", url: lim(location.pathname + location.hash, 160) }, inventarioPantalla(conEstado)));

    if (!nombres.length) {
      console.warn("%c[Mapa] No vi pestañas aquí. Mapeé solo esta pantalla; navegue a mano y vuelva a ejecutar VGL_MAPA_TODO().", "color:#c80;font-weight:bold");
    } else {
      console.log("%c[Mapa] " + nombres.length + " pestañas por recorrer: " + nombres.join(" · "), "color:#06c;font-weight:bold");
    }

    for (let i = 0; i < nombres.length; i++) {
      const nombre = nombres[i];
      // Se re-busca por TEXTO en cada vuelta: al pulsar la primera, Angular
      // reconstruye el DOM y una lista de nodos guardada queda con referencias muertas.
      let destino = null;
      for (const el of document.querySelectorAll('[role="tab"], .nav-link, .mat-tab-label, ul.nav a, .nav-tabs a, .nav-pills a')) {
        if (el.closest && el.closest("#vgl-root")) continue;
        if (lim(el.textContent, 60) !== nombre) continue;
        destino = el; break;
      }
      if (!destino) { porPestana.push({ pestana: nombre, error: "no se volvió a encontrar tras cambiar de vista" }); continue; }
      try { destino.click(); } catch (e) { porPestana.push({ pestana: nombre, error: "no se pudo pulsar" }); continue; }

      await dormir(1100);   // Angular necesita su tiempo; 900 ms es lo que ya usa el otro diagnóstico, con margen
      const inv = inventarioPantalla(conEstado);
      porPestana.push(Object.assign({ pestana: nombre, url: lim(location.pathname + location.hash, 160) }, inv));
      console.log("[Mapa] " + (i + 1) + "/" + nombres.length + " — \"" + nombre + "\": " + inv.totalCampos + " casillas, " + inv.botones.length + " botones, " + inv.tablas.length + " tablas");
    }

    // --- Claves de almacenamiento: SOLO los nombres ---
    const almacen = { local: [], sesion: [] };
    try { for (let i = 0; i < localStorage.length; i++) almacen.local.push(lim(localStorage.key(i), 80)); } catch (e) {}
    try { for (let i = 0; i < sessionStorage.length; i++) almacen.sesion.push(lim(sessionStorage.key(i), 80)); } catch (e) {}

    const red = Array.from(RED.values()).sort((a, b) => b.vistas - a.vistas);

    const salida = {
      _nota: "Mapa de Everest. Solo NOMBRES: ni un valor de casilla, ni una celda de tabla, ni un dato de respuesta.",
      capturadoEn: new Date().toISOString(),
      origen: location.origin,
      estadoCapturado: conEstado !== false,
      resumen: {
        pestanas: porPestana.length,
        campos: porPestana.reduce((n, p) => n + (p.totalCampos || 0), 0),
        botones: porPestana.reduce((n, p) => n + ((p.botones || []).length), 0),
        tablas: porPestana.reduce((n, p) => n + ((p.tablas || []).length), 0),
        endpointsDeRed: red.length,
      },
      red,
      almacenamiento: almacen,
      pestanas: porPestana,
    };

    const texto = JSON.stringify(salida, null, 1);
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
      const d = new Date(), p = (x) => String(x).padStart(2, "0");
      a.download = "MAPA_EVEREST_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.warn("[Mapa] no se pudo descargar:", e); }
    try { if (window.copy) window.copy(texto); } catch (e) {}

    console.log("%c[Mapa] LISTO — " + salida.resumen.pestanas + " pantallas · " + salida.resumen.campos + " casillas · " +
      salida.resumen.botones + " botones · " + salida.resumen.tablas + " tablas · " + salida.resumen.endpointsDeRed + " endpoints. Archivo descargado.",
      "color:#0a0;font-weight:bold;font-size:14px");

    if (red.length) {
      console.log("%c[Mapa] ENDPOINTS Y SUS CAMPOS — aquí es donde aparecen los datos que ya se descargan y nadie lee:", "color:#e54d42;font-weight:bold;font-size:13px");
      console.table(red.map((r) => ({ metodo: r.metodo, ruta: r.ruta, params: r.params.join(","), nCampos: r.claves.length })));
    } else {
      console.log("%c[Mapa] Ningún endpoint anotado: la escucha de red solo ve lo que pase DESPUÉS de pegar el archivo. Navegue un poco y vuelva a ejecutarlo.", "color:#c80");
    }
    return salida;
  };

  console.log("%c[Mapa Total] Instalado. Escuchando la red desde ahora.", "color:#0a0;font-weight:bold;font-size:14px");
  console.log("%c  VGL_MAPA_TODO()      ← recorre todas las pestañas y descarga el mapa completo", "color:#0a0;font-weight:bold");
  console.log("%c  VGL_MAPA_TODO(false) ← igual, pero sin anotar qué está marcado en las casillas", "color:#06c");
  console.log("%c  VGL_MAPA_PANTALLA()  ← solo la pantalla actual, sin descargar", "color:#06c");
})();
