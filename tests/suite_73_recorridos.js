// =====================================================================
//  SUITE 73 — RECORRIDOS REALES DEL MODAL DE AGENDAR
// ---------------------------------------------------------------------
//  Esta suite no mira pantallas: CAMINA el modal como lo hace el usuario
//  (plazos, días, especialidades, turnos, chips de toma de muestras,
//  fecha manual, reapertura y navegación por pasos) y exige en CADA
//  transición la invariante de marca única: a lo sumo un plazo activo,
//  exactamente un día activo, una especialidad activa, un tipo de cita
//  activo y a lo sumo un turno activo. Un estado doble no es un detalle
//  cosmético: es una cita agendada en el día equivocado.
//
//  Las fechas NO se hardcodean: todos los recorridos parten de hoy y
//  usan las mismas funciones de negocio de producción
//  (calcBusinessTargetDate, calcRangoSondeoIso, calcDateRangeAroundIso)
//  para calcular lo que el modal DEBE mostrar, de modo que la suite
//  sigue siendo válida cualquier día que se ejecute.
//
//  Infraestructura: el modal se instancia con innerHTML y se consulta con
//  querySelector por toda la producción, así que esta suite parchea el
//  document del arnés con un enriquecedor DOM (parser de HTML, motor de
//  selectores, dataset, classList con semántica real) ANTES de abrir el
//  modal. El enriquecedor MUTA los nodos del arnés: nunca toca el
//  archivo de producción.
// =====================================================================

module.exports = {
  nombre: "Suite 73 · Recorridos del modal Agendar",
  cubre: ["openAgendamientoModal", "calcBusinessTargetDate", "calcRangoSondeoIso", "calcDateRangeAroundIso"],
  async pruebas(t, api, env, cargar) {

    // ------------------------------------------------------------------
    //  ENRIQUECEDOR DOM
    //  El arnés trae nodos planos sin parser ni selectores. El modal de
    //  agendamiento se construye con innerHTML y se consulta con
    //  querySelector/querySelectorAll por todas partes, así que sin esto
    //  no hay recorrido posible. Todo lo que se añade aquí imita al
    //  navegador real: nada se inventa a favor de la prueba.
    // ------------------------------------------------------------------
    const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
    const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

    function decodificarEntidades(s) {
      return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (todo, cuerpo) => {
        if (cuerpo[0] === "#") {
          const esHex = cuerpo[1] === "x" || cuerpo[1] === "X";
          const code = parseInt(cuerpo.slice(esHex ? 2 : 1), esHex ? 16 : 10);
          return Number.isFinite(code) ? String.fromCodePoint(code) : todo;
        }
        return Object.prototype.hasOwnProperty.call(ENTIDADES, cuerpo) ? ENTIDADES[cuerpo] : todo;
      });
    }

    // Nula el _parent de todo un subárbol: el getElementById del arnés
    // solo ve nodos con _parent, así que esto es lo que hace que los
    // internos de un modal cerrado desaparezcan de verdad.
    function desconectar(sub) {
      sub._parent = null;
      for (const h of sub.children || []) desconectar(h);
    }

    function aplicarCssEnLinea(nodo, css) {
      const st = nodo.style;
      if (!st) return;
      st.cssText = css;
      String(css).split(";").forEach((decl) => {
        const ix = decl.indexOf(":");
        if (ix < 0) return;
        const prop = decl.slice(0, ix).trim();
        const val = decl.slice(ix + 1).trim();
        if (!prop) return;
        st[prop.replace(/-([a-z])/g, (x, c) => c.toUpperCase())] = val;
      });
    }

    // Parser de HTML: tags de apertura/cierre, autocierre, void elements
    // (input es crítico aquí), atributos con comillas dobles, simples o
    // sin comillas, comentarios multilínea y entidades básicas.
    function parsearHtml(doc, padre, html) {
      const s = String(html);
      const pila = [padre];
      let i = 0;
      while (i < s.length) {
        if (s.startsWith("<!--", i)) {
          const fin = s.indexOf("-->", i + 4);
          i = fin < 0 ? s.length : fin + 3;
          continue;
        }
        if (s[i] === "<" && s[i + 1] === "/") {
          const fin = s.indexOf(">", i);
          const tagCierre = s.slice(i + 2, fin).trim().toLowerCase();
          for (let k = pila.length - 1; k >= 1; k--) {
            if (pila[k].tagName && pila[k].tagName.toLowerCase() === tagCierre) { pila.length = k; break; }
          }
          i = fin < 0 ? s.length : fin + 1;
          continue;
        }
        if (s[i] === "<" && /[a-zA-Z]/.test(s[i + 1] || "")) {
          const finTag = s.indexOf(">", i);
          if (finTag < 0) break;
          let interior = s.slice(i + 1, finTag);
          const autocierre = interior.endsWith("/");
          if (autocierre) interior = interior.slice(0, -1);
          const mTag = interior.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
          const tag = mTag ? mTag[1].toLowerCase() : "div";
          const nodo = doc.createElement(tag);
          const restante = interior.slice(mTag ? mTag[0].length : 0);
          const reAtr = /([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
          let mA;
          while ((mA = reAtr.exec(restante))) {
            const nombre = mA[1];
            const crudo = mA[2] !== undefined ? mA[2] : (mA[3] !== undefined ? mA[3] : (mA[4] !== undefined ? mA[4] : ""));
            const valor = decodificarEntidades(crudo);
            nodo.setAttribute(nombre, valor);
            if (nombre === "class") nodo.className = valor;
            else if (nombre === "style") aplicarCssEnLinea(nodo, valor);
            else if (nombre === "value" && "value" in nodo) nodo.value = valor;
            else if (nombre === "checked") nodo.checked = true;
            else if (nombre === "disabled") nodo.disabled = true;
            else if (nombre === "type" && "type" in nodo) nodo.type = valor;
          }
          pila[pila.length - 1].appendChild(nodo);
          if (!autocierre && !VOID_TAGS.has(tag)) pila.push(nodo);
          i = finTag + 1;
          continue;
        }
        let finTexto = s.indexOf("<", i);
        if (finTexto < 0) finTexto = s.length;
        if (finTexto > i) {
          const tn = doc.createTextNode(decodificarEntidades(s.slice(i, finTexto)));
          pila[pila.length - 1].appendChild(tn);
        }
        i = finTexto === i ? i + 1 : finTexto;
      }
    }

    function serializar(nodo) {
      const partes = [];
      for (const h of nodo.children || []) {
        if (h.tagName) {
          const attrs = Object.keys(h.attributes || {}).map((k) => {
            const esc = String(h.attributes[k]).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
            return " " + k + '="' + esc + '"';
          }).join("");
          const tag = String(h.tagName).toLowerCase();
          if (VOID_TAGS.has(tag)) partes.push("<" + tag + attrs + ">");
          else partes.push("<" + tag + attrs + ">" + serializar(h) + "</" + tag + ">");
        } else {
          partes.push(String(h.textContent || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        }
      }
      return partes.join("");
    }

    function soloTexto(nodo) {
      let out = "";
      for (const h of nodo.children || []) out += h.tagName ? soloTexto(h) : String(h.textContent || "");
      return out;
    }

    // ----- motor de selectores: compuestos, :not(), [attr op valor],
    // descendiente e hijo, listas con coma -----
    function partirPorComas(sel) {
      const out = [];
      let actual = "", prof = 0, comilla = null;
      for (const c of String(sel)) {
        if (comilla) { actual += c; if (c === comilla) comilla = null; continue; }
        if (c === '"' || c === "'") { comilla = c; actual += c; continue; }
        if (c === "(" || c === "[") prof++;
        if (c === ")" || c === "]") prof--;
        if (c === "," && prof === 0) { out.push(actual); actual = ""; continue; }
        actual += c;
      }
      if (actual.trim()) out.push(actual);
      return out.map((x) => x.trim()).filter(Boolean);
    }

    function parseCompuesto(comp) {
      const partes = [];
      const s = comp.trim();
      let i = 0;
      while (i < s.length) {
        const c = s[i];
        if (c === " ") { i++; continue; }
        if (c === "*") { partes.push({ t: "tag", v: "*" }); i++; continue; }
        if (/[a-zA-Z]/.test(c)) {
          let j = i;
          while (j < s.length && /[a-zA-Z0-9-]/.test(s[j])) j++;
          partes.push({ t: "tag", v: s.slice(i, j).toUpperCase() });
          i = j; continue;
        }
        if (c === "#") {
          let j = i + 1;
          while (j < s.length && /[\w-]/.test(s[j])) j++;
          partes.push({ t: "id", v: s.slice(i + 1, j) });
          i = j; continue;
        }
        if (c === ".") {
          let j = i + 1;
          while (j < s.length && /[\w-]/.test(s[j])) j++;
          partes.push({ t: "cls", v: s.slice(i + 1, j) });
          i = j; continue;
        }
        if (c === "[") {
          const fin = s.indexOf("]", i);
          if (fin < 0) break;
          const mA = s.slice(i + 1, fin).match(/^([^\s~^$*|=]+)(?:\s*([~^$*|]?=)\s*(.*))?$/);
          if (mA) {
            const valor = mA[3] !== undefined ? mA[3].replace(/^['"]|['"]$/g, "") : undefined;
            partes.push({ t: "attr", attr: mA[1].toLowerCase(), op: mA[2], v: valor });
          }
          i = fin + 1; continue;
        }
        if (s.startsWith(":not(", i)) {
          let prof = 1, j = i + 5;
          while (j < s.length && prof > 0) {
            if (s[j] === "(") prof++;
            else if (s[j] === ")") prof--;
            j++;
          }
          partes.push({ t: "not", sub: parseCompuesto(s.slice(i + 5, j - 1)) });
          i = j; continue;
        }
        i++;
      }
      return partes;
    }

    // La presencia de un atributo consulta también las propiedades que el
    // navegador refleja: producción escribe btn.disabled como propiedad y
    // luego pregunta por button:not([disabled]).
    function atributoReflejado(n, attr) {
      if (Object.prototype.hasOwnProperty.call(n.attributes, attr)) return { tiene: true, valor: String(n.attributes[attr]) };
      if (attr === "disabled") return n.disabled === true ? { tiene: true, valor: "disabled" } : { tiene: false };
      if (attr === "checked") return n.checked === true ? { tiene: true, valor: "checked" } : { tiene: false };
      if (attr === "value") return (typeof n.value === "string" && n.value !== "") ? { tiene: true, valor: n.value } : { tiene: false };
      if (attr === "id") return n.id ? { tiene: true, valor: n.id } : { tiene: false };
      return { tiene: false };
    }

    function matchParte(n, p) {
      switch (p.t) {
        case "tag": return p.v === "*" || n.tagName === p.v;
        case "id": return n.id === p.v;
        case "cls": return !!(n.classList && n.classList._s.has(p.v));
        case "attr": {
          const r = atributoReflejado(n, p.attr);
          if (!r.tiene) return false;
          if (!p.op) return true;
          const val = r.valor;
          switch (p.op) {
            case "=": return val === p.v;
            case "^=": return p.v !== "" && val.startsWith(p.v);
            case "$=": return p.v !== "" && val.endsWith(p.v);
            case "*=": return p.v !== "" && val.includes(p.v);
            case "~=": return val.split(/\s+/).includes(p.v);
            case "|=": return val === p.v || val.startsWith(p.v + "-");
            default: return false;
          }
        }
        case "not": return !matchCompuesto(n, p.sub);
        default: return false;
      }
    }
    function matchCompuesto(n, partes) { return partes.every((p) => matchParte(n, p)); }

    function partirCadena(sel) {
      const tokens = [];
      let actual = "", prof = 0, pendienteHijo = false;
      const empujar = () => {
        if (actual.trim()) {
          tokens.push({ rel: pendienteHijo ? ">" : " ", comp: parseCompuesto(actual.trim()) });
          pendienteHijo = false;
        }
        actual = "";
      };
      for (const c of sel) {
        if (c === "(" || c === "[") prof++;
        if (c === ")" || c === "]") prof--;
        if (prof === 0 && c === ">") { empujar(); pendienteHijo = true; continue; }
        if (prof === 0 && c === " ") { empujar(); continue; }
        actual += c;
      }
      empujar();
      return tokens;
    }

    function cumpleCadena(n, tokens) {
      if (!tokens.length) return false;
      if (!matchCompuesto(n, tokens[tokens.length - 1].comp)) return false;
      let idx = tokens.length - 2;
      let actual = n;
      while (idx >= 0) {
        const tk = tokens[idx];
        let padre = actual._parent;
        let hallado = false;
        while (padre && padre.tagName) {
          if (matchCompuesto(padre, tk.comp)) { hallado = true; break; }
          if (tk.rel === ">") break;
          padre = padre._parent;
        }
        if (!hallado) return false;
        actual = padre;
        idx--;
      }
      return true;
    }

    function matcheaSelector(n, sel) {
      return partirPorComas(sel).some((alt) => cumpleCadena(n, partirCadena(alt)));
    }

    function dfsNodos(raiz) {
      const out = [];
      (function rec(nodo) {
        for (const h of nodo.children || []) {
          if (h.tagName) out.push(h);
          if (h.children && h.children.length) rec(h);
        }
      })(raiz);
      return out;
    }

    function enriquecer(doc, n) {
      // toggle con semántica DOM: sin force explícito alterna (el del
      // arnés base borra la clase, lo que rompería irAPaso).
      n.classList.toggle = function (c, f) {
        const tiene = this._s.has(c);
        const nuevo = f === undefined ? !tiene : !!f;
        if (nuevo) this._s.add(c); else this._s.delete(c);
        return nuevo;
      };
      Object.defineProperty(n, "className", {
        configurable: true, enumerable: true,
        get() { return [...n.classList._s].join(" "); },
        set(v) {
          n.classList._s.clear();
          String(v == null ? "" : v).split(/\s+/).filter(Boolean).forEach((c) => n.classList._s.add(c));
        },
      });
      const attrDe = (k) => "data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
      n.dataset = new Proxy({}, {
        get(_, k) {
          if (typeof k !== "string") return undefined;
          const v = n.getAttribute(attrDe(k));
          return v === null ? undefined : v;
        },
        set(_, k, v) {
          if (typeof k !== "string") return false;
          if (v === undefined || v === null) n.removeAttribute(attrDe(k));
          else n.setAttribute(attrDe(k), String(v));
          return true;
        },
        deleteProperty(_, k) { if (typeof k === "string") n.removeAttribute(attrDe(k)); return true; },
        has(_, k) { return typeof k === "string" && n.getAttribute(attrDe(k)) !== null; },
      });
      Object.defineProperty(n, "innerHTML", {
        configurable: true, enumerable: true,
        get() { return serializar(n); },
        set(v) {
          for (const h of n.children || []) desconectar(h);
          n.children.length = 0;
          parsearHtml(doc, n, String(v));
        },
      });
      Object.defineProperty(n, "textContent", {
        configurable: true, enumerable: true,
        get() { return soloTexto(n); },
        set(v) {
          for (const h of n.children || []) desconectar(h);
          n.children.length = 0;
          const tn = doc.createTextNode(String(v));
          tn._parent = n;
          n.children.push(tn);
        },
      });
      n.removeChild = function (c) {
        const ix = this.children.indexOf(c);
        if (ix >= 0) this.children.splice(ix, 1);
        desconectar(c);
        return c;
      };
      n.removeEventListener = function (ev, f) {
        const arr = this._listeners[ev];
        if (!arr) return;
        const ix = arr.indexOf(f);
        if (ix >= 0) arr.splice(ix, 1);
      };
      Object.defineProperty(n, "parentElement", { configurable: true, get() { return n._parent || null; } });
      n.contains = function (otro) {
        if (otro === this) return true;
        for (const h of this.children || []) if (h.contains && h.contains(otro)) return true;
        return false;
      };
      n.matches = (sel) => matcheaSelector(n, sel);
      n.closest = (sel) => {
        let cur = n;
        while (cur) {
          if (cur.tagName && matcheaSelector(cur, sel)) return cur;
          cur = cur._parent;
        }
        return null;
      };
      n.querySelectorAll = (sel) => dfsNodos(n).filter((x) => matcheaSelector(x, sel));
      n.querySelector = (sel) => dfsNodos(n).find((x) => matcheaSelector(x, sel)) || null;
      return n;
    }

    // ------------------------------------------------------------------
    //  UTILIDADES DE RECORRIDO
    // ------------------------------------------------------------------
    const esperar = (ms) => new Promise((res) => setTimeout(res, ms));

    // Dispara TODOS los listeners del tipo en COPIA de la lista (un
    // handler puede deregistrar a otro) y NO re-lanza sus errores: un
    // listener roto no debe enmascarar lo que la prueba está midiendo.
    // Los errores se guardan en el nodo y se loguean con prefijo.
    function disparar(nodo, tipo) {
      const arr = (nodo && nodo._listeners && nodo._listeners[tipo] ? nodo._listeners[tipo] : []).slice();
      for (const f of arr) {
        try { f({ type: tipo, target: nodo, currentTarget: nodo, preventDefault() {}, stopPropagation() {} }); }
        catch (e) {
          nodo._ultimoError = e;
          console.error("[suite_73] listener de '" + tipo + "' lanzó:", e && e.message ? e.message : e);
        }
      }
    }

    const respuestaJson = (obj) => async () => ({
      ok: true, status: 200,
      headers: { get: () => null },
      json: async () => obj,
      text: async () => JSON.stringify(obj),
      clone() { return this; },
    });

    // Router de red del recorrido: cada endpoint del modal contesta como
    // en consultorio. BuscarPacienteDetallado se examina ANTES que
    // BuscarPaciente porque su URL lo contiene como prefijo. ObtenerTurnos
    // (fetch) se distingue de ObtenerTurnosPorFecha (gmxhr) por la misma
    // razón. Los turnos llevan id ÚNICO por llamada para que la firma
    // entre fechas nunca colisione.
    function routerFetch(cfg) {
      const c = cfg || {};
      let seqTurnos = 900;
      return async (url) => {
        const u = String(url);
        if (u.includes("BuscarPacienteDetallado")) {
          return respuestaJson({ data: { celular: "3001112233", sexo: "F", programasPaciente: [], eps: { nombre: "EPS" }, nombreCompleto: "PACIENTE PRUEBA" } })();
        }
        if (u.includes("BuscarPaciente")) {
          return respuestaJson({ data: { id: 777 } })();
        }
        if (u.includes("BuscarCitasDisponibles")) {
          const mF = u.match(/FechaDeseada=(\d{4}-\d{2}-\d{2})/);
          const mE = u.match(/EspecialidadId=(\d+)/);
          const iso = mF ? mF[1] : null;
          const esp = mE ? mE[1] : null;
          if (iso && Array.isArray(c.sinAgendaEn) && c.sinAgendaEn.includes(iso) &&
            (!c.sinAgendaSoloEsp || String(c.sinAgendaSoloEsp) === esp)) {
            return respuestaJson({ agendas: [] })();
          }
          const fechaAgenda = iso ? iso.split("-").reverse().join("/") : "01/01/2026";
          const medico = c.medicoPorIso ? c.medicoPorIso(iso, esp) : "ANA MARIA PEREZ";
          return respuestaJson({ agendas: [{ agendaId: 55, medico: medico, fechaAgenda: fechaAgenda, sede: "CMB" }] })();
        }
        if (u.includes("AgdValidarAgenda")) {
          return respuestaJson({ data: { isError: false } })();
        }
        if (u.includes("ObtenerTurnos") && !u.includes("PorFecha")) {
          seqTurnos += 3;
          const turnos = [0, 1, 2].map((k) => ({ turnoId: seqTurnos + k, horaTexto: ["08:00 AM", "08:30 AM", "09:00 AM"][k], estado: "ACT" }));
          return respuestaJson({ turnos })();
        }
        return respuestaJson({ data: {} })();
      };
    }

    function routerGmxhr() {
      return (o) => {
        const u = String((o && o.url) || "");
        if (u.includes("ObtenerTurnosPorFecha")) {
          setTimeout(() => {
            try { o.onload({ status: 200, responseText: JSON.stringify({ turnos: [{ hora: "06:30:00" }] }) }); }
            catch (e) { console.error("[suite_73] onload simulado falló:", e && e.message); }
          }, 0);
          return;
        }
        setTimeout(() => {
          try { if (o && typeof o.onerror === "function") o.onerror(new Error("gmxhr: url no simulada")); }
          catch (e) { /* el router jamás propaga */ }
        }, 0);
      };
    }

    const montar = (cfg) => {
      const c = cargar({ silencioso: true, fetch: routerFetch(cfg), gmxhr: routerGmxhr() });
      const doc = c.env.doc;
      const crearOriginal = doc.createElement;
      const textoOriginal = doc.createTextNode;
      doc.createElement = (tag) => enriquecer(doc, crearOriginal(tag));
      doc.createTextNode = (tx) => {
        const tn = textoOriginal(tx);
        tn.nodeType = 3;
        tn._parent = null;
        return tn;
      };
      // Médico propio conocido: las agendas del router con ese nombre son
      // "propias" y las del resto disparan el salto automático de día.
      try { c.api.__state.activeDoctor = { id: 707, name: "ANA MARIA PEREZ" }; } catch (e) { /* forma del estado ya fijada */ }
      return c;
    };

    const abrir = async (r) => {
      r.api.openAgendamientoModal({ doc_id: "5150076", nombre: "PACIENTE PRUEBA" });
      await esperar(150);
      return r.env.doc.getElementById("vgl-agendar-modal");
    };

    // La invariante central de esta suite, verificada tras CADA paso del
    // recorrido. Devuelve la fecha (dd/mm/aaaa) que la cabecera anuncia.
    const estadoCoherente = (t, modal, etiqueta) => {
      const qsa = (sel) => modal.querySelectorAll(sel);
      const plazosAct = qsa("#vgl-time-presets .vgl-agm-pbtn.active");
      t.cierto(plazosAct.length <= 1, etiqueta + ": a lo sumo un plazo activo (hubo " + plazosAct.length + ")");
      const dias = qsa("#vgl-day-chips .vgl-agm-pbtn");
      if (dias.length) {
        t.igual(dias.filter((d) => d.classList.contains("active")).length, 1, etiqueta + ": exactamente un día activo");
      }
      t.igual(qsa("#vgl-esp-presets .active").length, 1, etiqueta + ": exactamente una especialidad activa");
      t.igual(qsa("#vgl-agm-que .vgl-type-card.active").length, 1, etiqueta + ": exactamente un tipo de cita activo");
      const slotsAct = qsa("#vgl-agm-slots .vgl-agm-sbtn.active");
      t.cierto(slotsAct.length <= 1, etiqueta + ": a lo sumo un turno activo (hubo " + slotsAct.length + ")");
      const tomasAct = qsa("#vgl-lab-day-chips .vgl-agm-pbtn.active");
      t.cierto(tomasAct.length <= 1, etiqueta + ": a lo sumo un chip de toma activo (hubo " + tomasAct.length + ")");
      const bloqueado = (n) => n.disabled === true || n.classList.contains("vgl-agm-pbtn-sinagenda") || n.getAttribute("aria-disabled") === "true";
      for (const d of dias) t.falso(d.classList.contains("active") && bloqueado(d), etiqueta + ": un día activo no puede estar bloqueado a la vez");
      for (const lt of qsa("#vgl-lab-day-chips .vgl-agm-pbtn")) t.falso(lt.classList.contains("active") && bloqueado(lt), etiqueta + ": un chip de toma activo no puede estar bloqueado a la vez");
      const info = modal.querySelector("#vgl-agm-date-info");
      const fechas = info ? [...info.querySelectorAll("b")].filter((b) => /^\d{2}\/\d{2}\/\d{4}$/.test(b.textContent)) : [];
      t.igual(fechas.length, 1, etiqueta + ": la cabecera anuncia exactamente una fecha deseada");
      t.igual(qsa("#vgl-agm-slots .vgl-agm-err").length, 0, etiqueta + ": sin errores en la lista de horarios");
      return fechas.length ? fechas[0].textContent : null;
    };

    const textoDe = (n) => String(n.textContent || "").trim();

    // ------------------------------------------------------------------
    //  Helpers de recorrido: los chips se RECREAN en cada repintado, así
    //  que nunca se cachea un nodo entre un clic y su comprobación.
    // ------------------------------------------------------------------
    const chipsDia = (m) => [...m.querySelectorAll("#vgl-day-chips .vgl-agm-pbtn")];
    const activosDia = (m) => chipsDia(m).filter((c) => c.classList.contains("active"));
    const etiquetasDia = (m) => chipsDia(m).map(textoDe).join(" | ");
    const esperables = (items) => items.map((it) => it.isCenter ? it.shortLbl + " 🎯" : it.shortLbl).join(" | ");
    const chipDe = (m, item) => chipsDia(m).find((c) => textoDe(c) === item.shortLbl || textoDe(c) === item.shortLbl + " 🎯");
    const btnPlazo = (m, mm, dd) => [...m.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn")]
      .find((b) => b.getAttribute("data-m") === String(mm) && b.getAttribute("data-d") === String(dd));
    const chipEsp = (m, esp) => [...m.querySelectorAll("#vgl-esp-presets .vgl-agm-pbtn")]
      .find((b) => b.getAttribute("data-esp") === String(esp));

    // ------------------------------------------------------------------
    //  R1 — APERTURA POR DEFECTO Y CAMBIO DE PLAZO
    //  Lo primero que ve el usuario: el modal abre con el plazo por
    //  defecto (1 mes), el centro del rango ya elegido y sus horarios en
    //  pantalla; y cada clic de plazo re-centra los días sin dejar
    //  marcas dobles.
    // ------------------------------------------------------------------
    await t.casoAsync("R1 · apertura con el plazo por defecto y re-centrado por plazo", async () => {
      const r = montar({});
      const modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;

      const rangoInicial = r.api.calcRangoSondeoIso(r.api.calcBusinessTargetDate(1, 0).iso);
      const chips = [...modal.querySelectorAll("#vgl-day-chips .vgl-agm-pbtn")];
      t.igual(chips.length, rangoInicial.length, "tantos chips de día como días sondea el rango por defecto");
      chips.forEach((ch, i) => {
        const esperado = rangoInicial[i].isCenter ? rangoInicial[i].shortLbl + " 🎯" : rangoInicial[i].shortLbl;
        t.igual(textoDe(ch), esperado, "el chip " + i + " muestra su etiqueta corta del rango");
      });
      const centroInicial = rangoInicial.find((it) => it.isCenter);
      t.cierto(!!centroInicial, "el rango por defecto tiene centro");
      const activosIniciales = chips.filter((ch) => ch.classList.contains("active"));
      t.igual(activosIniciales.length, 1, "exactamente un día activo tras la apertura");
      t.igual(textoDe(activosIniciales[0]), centroInicial.shortLbl + " 🎯", "el día activo es el centro del rango por defecto");

      t.igual(modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn.active").length, 0,
        "la apertura no marca plazos: elige día, no plazo");
      t.igual(modal.querySelectorAll("#vgl-esp-presets .active").length, 1, "una especialidad activa (la de defecto)");
      t.igual(modal.querySelectorAll("#vgl-agm-que .vgl-type-card.active").length, 1, "un tipo de cita activo");

      t.igual(estadoCoherente(t, modal, "apertura"), centroInicial.fmt,
        "la cabecera anuncia la fecha del centro activo");

      const slots = [...modal.querySelectorAll("#vgl-agm-slots .vgl-agm-sbtn")];
      t.igual(slots.length, 3, "tres turnos libres pintados");
      t.igual(slots.filter((s) => s.classList.contains("active")).length, 0,
        "sin paciente perfilado no hay turno preseleccionado");
      const btnConfirm = modal.querySelector("#vgl-agm-confirm");
      const btnStep2Next = modal.querySelector("#vgl-step-2-next");
      t.cierto(!!btnConfirm && btnConfirm.disabled === true, "confirmar nace bloqueado sin horario elegido");
      t.cierto(btnConfirm.textContent.includes("Elija un horario"), "el botón de confirmar explica qué falta");
      t.cierto(!!btnStep2Next && btnStep2Next.disabled === true, "siguiente también bloqueado sin horario");

      const plazos = [[0, 15], [2, 0], [6, 0]];
      for (const [m, d] of plazos) {
        const btn = [...modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn")]
          .find((b) => b.getAttribute("data-m") === String(m) && b.getAttribute("data-d") === String(d));
        t.cierto(!!btn, "existe el botón de plazo " + m + " mes y " + d + " días");
        if (!btn) continue;
        disparar(btn, "click");
        await esperar(120);
        const rango = r.api.calcRangoSondeoIso(r.api.calcBusinessTargetDate(m, d).iso);
        const chipsAhora = [...modal.querySelectorAll("#vgl-day-chips .vgl-agm-pbtn")];
        t.igual(chipsAhora.length, rango.length, "plazo " + m + "/" + d + ": el rango de días cambió al del nuevo plazo");
        const centroAhora = rango.find((it) => it.isCenter);
        const activosAhora = chipsAhora.filter((ch) => ch.classList.contains("active"));
        t.igual(activosAhora.length, 1, "plazo " + m + "/" + d + ": un solo día activo");
        t.igual(textoDe(activosAhora[0]), centroAhora.shortLbl + " 🎯",
          "plazo " + m + "/" + d + ": el activo es el centro del nuevo rango");
        t.igual(modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn.active").length, 1,
          "plazo " + m + "/" + d + ": un solo plazo marcado");
        estadoCoherente(t, modal, "plazo " + m + "/" + d);
      }
    });

    // ------------------------------------------------------------------
    //  R2 — FECHA MANUAL DE CONTROL Y «VOLVER»
    //  El calendario manual elige una fecha propia: los chips se centran
    //  en ella, el banner de sugerencias se esconde y el plazo queda
    //  despintado. «Volver» restaura el plazo que estaba antes, limpia
    //  el calendario y devuelve el banner. Nada de marcas dobles.
    // ------------------------------------------------------------------
    await t.casoAsync("R2 · fecha manual de control y «volver» restauran un solo estado", async () => {
      const r = montar({});
      const modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;

      const btnPlazo20 = btnPlazo(modal, 2, 0);
      t.cierto(!!btnPlazo20, "existe el plazo de 2 meses");
      disparar(btnPlazo20, "click");
      await esperar(150);
      const rango20 = r.api.calcRangoSondeoIso(r.api.calcBusinessTargetDate(2, 0).iso);
      const centro20 = rango20.find((it) => it.isCenter);

      // Un día elegido a mano antes de entrar en manual: el recorrido real
      // de ventanilla (el médico mira varios días antes de rendirse al
      // calendario).
      const objetivo = rango20.find((it) => !it.isCenter && !it.esSabado);
      const chipObj = objetivo && chipDe(modal, objetivo);
      t.cierto(!!chipObj, "hay un día elegible en el rango del plazo");
      if (chipObj) { disparar(chipObj, "click"); await esperar(250); }

      const mBtn = modal.querySelector("#vgl-agm-manual-btn");
      const mInp = modal.querySelector("#vgl-agm-manual-fecha");
      const mEst = modal.querySelector("#vgl-agm-manual-est");
      const mVol = modal.querySelector("#vgl-agm-manual-volver");
      const banner = modal.querySelector("#vgl-agm-sugerida");
      t.cierto(!!mBtn && !!mInp && !!mEst && !!mVol && !!banner, "la vista expone los controles del modo manual");
      if (!mBtn || !mInp || !mEst || !mVol || !banner) return;

      disparar(mBtn, "click");
      const isoManual = r.api.calcBusinessTargetDate(4, 0).iso;
      mInp.value = isoManual;
      disparar(mInp, "change");
      await esperar(350);

      const rangoManual = r.api.calcRangoSondeoIso(isoManual);
      const centroManual = rangoManual.find((it) => it.isCenter);
      t.igual(modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn.active").length, 0,
        "modo manual: el plazo queda despintado");
      t.igual(etiquetasDia(modal), esperables(rangoManual),
        "modo manual: los chips de día se centran en la fecha escrita");
      const activosManual = activosDia(modal);
      t.igual(activosManual.length, 1, "modo manual: un solo día activo");
      if (centroManual && activosManual.length) {
        t.igual(textoDe(activosManual[0]), centroManual.shortLbl + " 🎯",
          "modo manual: el activo es el centro de la fecha escrita");
      }
      t.cierto(!mEst.classList.contains("vgl-d-none") && mEst.textContent.startsWith("Modo manual"),
        "el estado explica que la fecha la eligió el médico");
      t.cierto(!mVol.classList.contains("vgl-d-none"), "«volver» visible durante el modo manual");
      t.cierto(!mInp.classList.contains("vgl-d-none"), "el calendario manual sigue visible");
      t.cierto(banner.classList.contains("vgl-d-none"), "el banner de sugerencia se esconde en modo manual");
      t.igual(estadoCoherente(t, modal, "modo manual"), centroManual ? centroManual.fmt : null,
        "la cabecera anuncia la fecha manual");

      disparar(mVol, "click");
      await esperar(350);
      t.igual(etiquetasDia(modal), esperables(rango20),
        "«volver» restaura el rango del plazo elegido antes del manual");
      const activosVuelta = activosDia(modal);
      t.igual(activosVuelta.length, 1, "«volver»: un solo día activo");
      if (centro20 && activosVuelta.length) {
        t.igual(textoDe(activosVuelta[0]), centro20.shortLbl + " 🎯",
          "«volver»: el activo es el centro del plazo restaurado");
      }
      // v18.0.133 — «volver» re-marca el plazo del que nació la sugerencia (diseño v15.8.0,
      // regla N3: el plazo vuelve a reflejar la sugerencia). La invariante del recorrido no es
      // «cero plazos», sino «sin estados dobles»: a lo sumo UN plazo activo y, si lo hay, debe
      // ser exactamente el plazo cuyo centro quedó restaurado en pantalla.
      const plazosVuelta = [...modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn.active")];
      t.cierto(plazosVuelta.length <= 1, "«volver»: a lo sumo un plazo activo (sin estados dobles)");
      if (plazosVuelta.length === 1 && centro20) {
        const pm = Number(plazosVuelta[0].getAttribute("data-m"));
        const pd = Number(plazosVuelta[0].getAttribute("data-d"));
        t.igual(r.api.calcBusinessTargetDate(pm, pd).iso, centro20.iso,
          "«volver»: el plazo re-marcado es el que explica el rango restaurado");
      }
      t.cierto(mEst.classList.contains("vgl-d-none"), "«volver»: el estado manual se esconde");
      t.cierto(mVol.classList.contains("vgl-d-none"), "«volver»: el propio «volver» se esconde");
      t.cierto(mInp.classList.contains("vgl-d-none") && mInp.value === "",
        "«volver»: el calendario se limpia y se esconde");
      t.cierto(!banner.classList.contains("vgl-d-none"), "«volver»: el banner de sugerencia vuelve a verse");
      t.igual(estadoCoherente(t, modal, "volver del manual"), centro20 ? centro20.fmt : null,
        "la cabecera anuncia el centro del plazo restaurado");
    });

    // ------------------------------------------------------------------
    //  R3 — SALTO AUTOMÁTICO AL DÍA CON AGENDA PROPIA
    //  Con Medicina General (control), si el día central solo tiene agenda
    //  de OTRO profesional, el cuadro salta solo al día más cercano con
    //  agenda propia. El chip del centro queda tachado con su motivo y el
    //  saltado queda activo (sin 🎯: la sugerencia no fue suya).
    // ------------------------------------------------------------------
    await t.casoAsync("R3 · el salto automático tacha el centro y activa un solo día con agenda propia", async () => {
      const isoCentroSinAgenda = api.calcBusinessTargetDate(1, 0).iso;
      const r = montar({
        medicoPorIso: (iso) => iso === isoCentroSinAgenda ? "OTRO PROFESIONAL" : "ANA MARIA PEREZ",
      });
      const modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;
      await esperar(450);

      const rangoDef = r.api.calcRangoSondeoIso(isoCentroSinAgenda);
      const centroDef = rangoDef.find((it) => it.isCenter);
      t.cierto(!!centroDef, "el rango por defecto tiene centro");
      if (!centroDef) return;
      const chipCentro = chipDe(modal, centroDef);
      t.cierto(!!chipCentro, "el chip del centro existe");
      if (!chipCentro) return;
      t.cierto(chipCentro.disabled === true, "el centro sin agenda propia queda deshabilitado");
      t.cierto(chipCentro.classList.contains("vgl-agm-pbtn-sinagenda"), "el centro sin agenda propia queda tachado");
      t.igual(chipCentro.title, "Ese día solo tiene agenda de otro profesional",
        "el title del centro explica por qué se saltó");
      t.igual(chipCentro.getAttribute("aria-disabled"), "true", "aria-disabled en el centro tachado");
      t.falso(chipCentro.classList.contains("active"), "el centro saltado no queda activo");

      const centroMs = new Date(centroDef.iso + "T12:00:00").getTime();
      const esperado = rangoDef.filter((it) => it.iso !== centroDef.iso).slice()
        .sort((a, b) => Math.abs(new Date(a.iso + "T12:00:00").getTime() - centroMs)
                     - Math.abs(new Date(b.iso + "T12:00:00").getTime() - centroMs))[0];
      t.cierto(!!esperado, "hay un candidato con agenda propia");
      const activos = activosDia(modal);
      t.igual(activos.length, 1, "salto: exactamente un día activo");
      if (esperado && activos.length) {
        t.igual(textoDe(activos[0]), esperado.shortLbl,
          "el activo es el día saltado, sin 🎯 (la elección no fue del médico)");
      }
      t.igual(modal.querySelectorAll("#vgl-agm-slots .vgl-agm-sbtn").length, 3,
        "los turnos pintados son los del día saltado");
      t.igual(modal.querySelectorAll("#vgl-agm-slots .vgl-agm-loading").length, 0,
        "no queda ninguna carga colgada tras el salto");
      t.igual(estadoCoherente(t, modal, "salto automático"), esperado ? esperado.fmt : null,
        "la cabecera anuncia la fecha del día saltado");
    });

    // ------------------------------------------------------------------
    //  R3b — SONDEO QUE TACHA UN DÍA SIN AGENDA DEL SERVICIO
    //  Un día sin agenda NO desaparece: se apaga y dice por qué. El resto
    //  del estado (centro activo, turnos, cabecera) no se toca.
    // ------------------------------------------------------------------
    await t.casoAsync("R3b · el sondeo tacha el día sin agenda sin romper el resto del estado", async () => {
      const rangoDef = api.calcRangoSondeoIso(api.calcBusinessTargetDate(1, 0).iso);
      const centroDef = rangoDef.find((it) => it.isCenter);
      const x = rangoDef.find((it) => !it.isCenter && !it.esSabado);
      t.cierto(!!centroDef && !!x, "hay centro y un día laborable no central en el rango por defecto");
      if (!centroDef || !x) return;
      const r = montar({ sinAgendaEn: [x.iso], sinAgendaSoloEsp: 12 });
      const modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;
      await esperar(450);

      const chipX = chipDe(modal, x);
      t.cierto(!!chipX, "el chip del día sin agenda existe");
      if (!chipX) return;
      t.cierto(chipX.disabled === true, "el día sin agenda queda deshabilitado");
      t.cierto(chipX.classList.contains("vgl-agm-pbtn-sinagenda"), "el día sin agenda queda tachado");
      t.igual(chipX.title, "Sin agenda del servicio ese día", "el title del sondeo explica el tachado");
      t.igual(chipX.getAttribute("aria-disabled"), "true", "aria-disabled en el día tachado");
      t.falso(chipX.classList.contains("active"), "el día tachado no queda activo");

      const activos = activosDia(modal);
      t.igual(activos.length, 1, "el centro sigue siendo el único día activo");
      t.igual(textoDe(activos[0]), centroDef.shortLbl + " 🎯", "el activo sigue siendo el centro del rango");
      t.igual(modal.querySelectorAll("#vgl-agm-slots .vgl-agm-sbtn").length, 3,
        "los turnos del centro siguen pintados");
      t.igual(estadoCoherente(t, modal, "sondeo sin agenda"), centroDef.fmt,
        "la cabecera sigue anunciando el centro");
    });

    // ------------------------------------------------------------------
    //  R4 — CAMBIO DE ESPECIALIDAD: EL VEREDICTO VIEJO NO CONTAMINA
    //  Un día tachado «sin agenda» para control puede tener agenda de otra
    //  especialidad. Cambiar de especialidad debe re-sondear los chips; y
    //  al volver a la especialidad original, el tachado legítimo vuelve.
    // ------------------------------------------------------------------
    await t.casoAsync("R4 · cambiar de especialidad re-sondea los días y no hereda el tachado viejo", async () => {
      const rangoDef = api.calcRangoSondeoIso(api.calcBusinessTargetDate(1, 0).iso);
      const habiles = rangoDef.filter((it) => !it.isCenter && !it.esSabado);
      t.cierto(habiles.length >= 2, "el rango por defecto tiene al menos dos días laborables no centrales");
      if (habiles.length < 2) return;
      const x = habiles[0], y = habiles[1];
      const r = montar({ sinAgendaEn: [x.iso], sinAgendaSoloEsp: 12 });
      const modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;
      await esperar(450);

      const chipXViejo = chipDe(modal, x);
      t.cierto(!!chipXViejo && chipXViejo.disabled === true,
        "con control (esp 12) el día X arranca tachado por el sondeo");
      if (!chipXViejo) return;

      const chipEsp46 = chipEsp(modal, 46);
      t.cierto(!!chipEsp46, "existe el preset de Psicología");
      if (!chipEsp46) return;
      disparar(chipEsp46, "click");
      await esperar(450);

      const chipX = chipDe(modal, x);
      t.cierto(!!chipX && chipX !== chipXViejo, "al cambiar de especialidad los chips se recrean");
      if (!chipX) return;
      t.cierto(chipX.disabled !== true, "X queda re-habilitado para la especialidad nueva");
      t.falso(chipX.classList.contains("vgl-agm-pbtn-sinagenda"), "X pierde el tachado del veredicto viejo");
      t.cierto(!chipX.title, "X pierde el title del veredicto viejo");
      t.igual(estadoCoherente(t, modal, "esp nueva"), rangoDef.find((it) => it.isCenter).fmt,
        "el centro sigue elegido y coherente bajo la especialidad nueva");

      const chipY = chipDe(modal, y);
      t.cierto(!!chipY && chipY.disabled !== true, "el día Y es elegible bajo Psicología");
      if (chipY) { disparar(chipY, "click"); await esperar(350); }

      const chipEsp12 = chipEsp(modal, 12);
      t.cierto(!!chipEsp12, "existe el preset de Medicina General (Control)");
      if (chipEsp12) { disparar(chipEsp12, "click"); await esperar(500); }

      const rangoY = r.api.calcRangoSondeoIso(y.iso);
      t.igual(etiquetasDia(modal), esperables(rangoY),
        "al volver a control, el rango se re-centra en el día elegido (Y)");
      const activos = activosDia(modal);
      t.igual(activos.length, 1, "tras el cambio de especialidad hay un solo día activo");
      t.igual(textoDe(activos[0]), y.shortLbl + " 🎯", "el día elegido queda activo y como centro");
      const chipX2 = chipDe(modal, x);
      t.cierto(!!chipX2, "X sigue dentro del rango re-centrado en Y");
      if (chipX2) {
        t.cierto(chipX2.disabled === true, "X vuelve a quedar tachado para control (su veredicto legítimo)");
        t.igual(chipX2.title, "Sin agenda del servicio ese día", "el title vuelve a explicar el tachado");
      }
      t.igual(estadoCoherente(t, modal, "control sobre Y"), y.fmt,
        "la cabecera anuncia Y y no queda ningún estado doble");
    });

    // ------------------------------------------------------------------
    //  R5 — TURNO ÚNICO EN CADA TRANSICIÓN
    //  Elegir turno habilita confirmar con la hora elegida; elegir otro
    //  turno REEMPLAZA la marca; cambiar de día la despinta y vuelve a
    //  pedir horario. Nunca dos turnos activos, nunca la hora vieja en
    //  el botón.
    // ------------------------------------------------------------------
    await t.casoAsync("R5 · el turno elegido es único y se despinta al cambiar de día", async () => {
      const r = montar({});
      const modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;
      await esperar(150);

      const confirm = modal.querySelector("#vgl-agm-confirm");
      const step2Next = modal.querySelector("#vgl-step-2-next");
      t.cierto(!!confirm && !!step2Next, "están el botón de confirmar y el de siguiente");
      if (!confirm || !step2Next) return;
      const slotsDe = () => [...modal.querySelectorAll("#vgl-agm-slots .vgl-agm-sbtn")];
      const activosSlot = () => modal.querySelectorAll("#vgl-agm-slots .vgl-agm-sbtn.active").length;
      t.igual(slotsDe().length, 3, "tres turnos libres al abrir");

      disparar(slotsDe()[0], "click");
      await esperar(80);
      t.igual(activosSlot(), 1, "un solo turno activo tras elegir 08:00 AM");
      t.cierto(confirm.textContent.includes("Sí, Crear Cita en"), "confirmar anuncia la cita");
      t.cierto(confirm.textContent.includes("08:00 AM"), "confirmar anuncia la hora 08:00 AM");
      t.cierto(confirm.disabled === false, "confirmar queda habilitado");
      t.cierto(step2Next.disabled === false, "siguiente queda habilitado");

      disparar(slotsDe()[1], "click");
      await esperar(80);
      t.igual(activosSlot(), 1, "elegir otro turno reemplaza la marca, no la duplica");
      t.cierto(confirm.textContent.includes("08:30 AM"), "confirmar anuncia la hora nueva");
      t.falso(confirm.textContent.includes("08:00 AM"), "la hora vieja desaparece del botón");

      const rangoDef = r.api.calcRangoSondeoIso(r.api.calcBusinessTargetDate(1, 0).iso);
      const otroDia = rangoDef.find((it) => !it.isCenter && !it.esSabado);
      const chipOtro = otroDia && chipDe(modal, otroDia);
      t.cierto(!!chipOtro, "hay otro día elegible en el rango");
      if (!chipOtro) return;
      disparar(chipOtro, "click");
      await esperar(400);
      t.igual(activosSlot(), 0, "cambiar de día despinta el turno elegido");
      t.cierto(confirm.disabled === true, "confirmar vuelve a bloquearse sin horario");
      t.cierto(confirm.textContent.includes("Elija un horario"), "el botón vuelve a pedir un horario");
      t.cierto(step2Next.disabled === true, "siguiente vuelve a bloquearse");
      t.igual(slotsDe().length, 3, "el nuevo día trae sus tres turnos");

      disparar(slotsDe()[2], "click");
      await esperar(80);
      t.igual(activosSlot(), 1, "un solo turno activo en el día nuevo");
      t.cierto(confirm.textContent.includes("09:00 AM"), "confirmar anuncia la hora del día nuevo");
      t.igual(estadoCoherente(t, modal, "turnos"), otroDia.fmt,
        "el estado queda coherente con el día nuevo y su turno");
    });

    // ------------------------------------------------------------------
    //  R6 — LA FECHA MANUAL DE TOMA MANDA SOBRE EL CHIP CLICADO
    //  Si el médico clicó un chip de toma y luego escribe una fecha manual
    //  (+2 meses), los chips deben centrarse en la fecha ESCRITA y la
    //  etiqueta visible anunciarla; y esa elección debe sobrevivir un
    //  cambio de día de control. Aquí vive el bug del centro calcado del
    //  chip viejo (renderLabDayChips recalculaba el centro con la
    //  selectedLabDateInfo anterior) y el de la etiqueta que nunca se
    //  repintaba en esta ruta.
    // ------------------------------------------------------------------
    await t.casoAsync("R6 · la fecha manual de toma re-centra los chips y sobrevive al cambio de día", async () => {
      const r = montar({});
      const modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;
      await esperar(250);

      const chipsToma = () => [...modal.querySelectorAll("#vgl-lab-day-chips .vgl-agm-pbtn")];
      const activosToma = () => chipsToma().filter((c) => c.classList.contains("active"));
      const etiquetasToma = () => chipsToma().map(textoDe).join(" | ");
      t.cierto(chipsToma().length > 1, "hay chips de toma pintados al abrir");
      const chipToma = chipsToma().find((c) => !c.classList.contains("active"));
      t.cierto(!!chipToma, "hay un chip de toma no activo para clicar");
      if (!chipToma) return;
      disparar(chipToma, "click");
      await esperar(200);
      t.igual(activosToma().length, 1, "un solo chip de toma activo tras el clic");

      const lInp = modal.querySelector("#vgl-agm-lab-manual-fecha");
      const lLbl = modal.querySelector("#vgl-lab-date-lbl");
      t.cierto(!!lInp && !!lLbl, "están el calendario manual de toma y su etiqueta");
      if (!lInp || !lLbl) return;
      const isoToma = r.api.calcBusinessTargetDate(2, 0).iso;
      lInp.value = isoToma;
      disparar(lInp, "change");
      await esperar(250);

      const rangoToma = r.api.calcDateRangeAroundIso(isoToma, 3);
      const centroToma = rangoToma.find((it) => it.isCenter);
      t.cierto(!!centroToma, "la fecha manual tiene centro en su rango de toma");
      if (!centroToma) return;
      t.igual(etiquetasToma(), esperables(rangoToma),
        "los chips de toma se centran en la fecha ESCRITA, no en el chip clicado");
      t.igual(activosToma().length, 1, "un solo chip de toma activo tras la fecha manual");
      t.igual(textoDe(activosToma()[0]), centroToma.shortLbl + " 🎯",
        "el chip activo es el centro de la fecha escrita");
      t.cierto(lLbl.textContent.includes(centroToma.fmt),
        "la etiqueta de toma anuncia la fecha escrita");

      const rangoDef = r.api.calcRangoSondeoIso(r.api.calcBusinessTargetDate(1, 0).iso);
      const otroDia = rangoDef.find((it) => !it.isCenter && !it.esSabado);
      const chipOtro = otroDia && chipDe(modal, otroDia);
      t.cierto(!!chipOtro, "hay otro día de control elegible");
      if (!chipOtro) return;
      disparar(chipOtro, "click");
      await esperar(400);
      t.igual(etiquetasToma(), esperables(rangoToma),
        "la toma manual sobrevive el cambio de día de control");
      t.igual(activosToma().length, 1, "sigue habiendo un solo chip de toma activo");
      t.igual(textoDe(activosToma()[0]), centroToma.shortLbl + " 🎯",
        "el centro de la toma manual sigue siendo el chip activo");
      t.cierto(lLbl.textContent.includes(centroToma.fmt),
        "la etiqueta de toma sigue anunciando la fecha manual");
      t.igual(estadoCoherente(t, modal, "toma manual"), otroDia.fmt,
        "el día de control nuevo queda coherente sin tocar la toma elegida");
    });

    // ------------------------------------------------------------------
    //  R7 — CIERRE Y REAPERTURA SIN FANTASMAS
    //  Cerrar con ✕ desmonta TODO el modal (chips, vistas, stepper) y
    //  reabrir construye un estado fresco: sin restos de la sesión
    //  anterior, con un solo día activo y su cabecera.
    // ------------------------------------------------------------------
    await t.casoAsync("R7 · cerrar con ✕ desmonta todo y reabrir arranca limpio", async () => {
      const r = montar({});
      let modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;
      const btnX = modal.querySelector("#vgl-agm-x");
      t.cierto(!!btnX, "el botón de cerrar existe");
      if (!btnX) return;

      disparar(btnX, "click");
      await esperar(120);
      t.cierto(r.env.doc.getElementById("vgl-agendar-modal") === null, "el modal desaparece del documento");
      t.cierto(r.env.doc.getElementById("vgl-day-chips") === null, "los chips de día se van con él");
      t.cierto(r.env.doc.getElementById("vgl-step-view-1") === null, "las vistas del stepper también");

      modal = await abrir(r);
      t.cierto(!!modal, "el modal reabre");
      if (!modal) return;
      await esperar(250);
      t.igual(activosDia(modal).length, 1, "reabierto: un solo día activo");
      t.igual(modal.querySelectorAll("#vgl-esp-presets .active").length, 1, "reabierto: una especialidad activa");
      t.igual(modal.querySelectorAll("#vgl-time-presets .vgl-agm-pbtn.active").length, 0,
        "reabierto: sin plazos marcados (estado fresco)");
      // v18.0.133 — al reabrir, el resumen clínico ya quedó en caché por el auto-análisis de la
      // primera apertura, así que el turno ⭐ SUGERIDO puede venir preseleccionado (diseño
      // v15.4.0 / v17.6.13). La invariante real de la reapertura es que no haya HERENCIA de la
      // sesión anterior: a lo sumo UN turno activo y, si existe, es la preselección sugerida —
      // nunca un turno cualquiera que nadie eligió.
      const slotsReab = [...modal.querySelectorAll("#vgl-agm-slots .vgl-agm-sbtn.active")];
      t.cierto(slotsReab.length <= 1, "reabierto: a lo sumo un turno activo (sin estados dobles)");
      if (slotsReab.length === 1) {
        t.cierto(slotsReab[0].classList.contains("vgl-agm-sbtn-sugerido"),
          "reabierto: el único turno activo es la preselección ⭐, no un turno heredado");
      }
      const rangoDef = r.api.calcRangoSondeoIso(r.api.calcBusinessTargetDate(1, 0).iso);
      const centroDef = rangoDef.find((it) => it.isCenter);
      t.igual(estadoCoherente(t, modal, "reapertura"), centroDef ? centroDef.fmt : null,
        "reabierto: la cabecera anuncia el centro del rango por defecto");
    });

    // ------------------------------------------------------------------
    //  R8 — STEPPER: UN PASO ACTIVO, UN aria-current, RESUMEN FIEL
    //  Los tres pasos y sus indicadores son excluyentes en cada
    //  transición, y el resumen del paso 3 dice exactamente lo elegido:
    //  especialidad, médico, fecha y hora. Volver hacia atrás conserva la
    //  elección de turno.
    // ------------------------------------------------------------------
    await t.casoAsync("R8 · el stepper marca un solo paso y el resumen repite lo elegido", async () => {
      const r = montar({});
      const modal = await abrir(r);
      t.cierto(!!modal, "el modal quedó montado en el documento");
      if (!modal) return;
      await esperar(200);

      const v1 = () => modal.querySelector("#vgl-step-view-1");
      const v2 = () => modal.querySelector("#vgl-step-view-2");
      const v3 = () => modal.querySelector("#vgl-step-view-3");
      const ind = (n) => modal.querySelector("#vgl-step-ind-" + n);
      t.cierto(!!v1() && !!v2() && !!v3() && !!ind(1) && !!ind(2) && !!ind(3),
        "las tres vistas y los tres indicadores existen");
      if (!v1() || !v2() || !v3() || !ind(1) || !ind(2) || !ind(3)) return;

      t.cierto(v1().style.display !== "none", "al abrir se ve el paso 1");
      t.igual(v2().style.display, "none", "el paso 2 nace oculto");
      t.igual(v3().style.display, "none", "el paso 3 nace oculto");
      t.cierto(ind(1).classList.contains("active") && ind(1).getAttribute("aria-current") === "step",
        "al abrir el indicador 1 es el paso en curso");
      t.falso(ind(2).classList.contains("active"), "el indicador 2 arranca inactivo");

      const step1Next = modal.querySelector("#vgl-step-1-next");
      t.cierto(!!step1Next, "existe el botón de siguiente del paso 1");
      if (!step1Next) return;
      disparar(step1Next, "click");
      await esperar(100);
      t.igual(v1().style.display, "none", "paso 1: se oculta");
      t.igual(v2().style.display, "block", "paso 2: se muestra");
      t.igual(v3().style.display, "none", "paso 3: sigue oculto");
      t.cierto(ind(1).classList.contains("completed") && !ind(1).classList.contains("active"),
        "indicador 1: completado y ya no activo");
      t.cierto(ind(1).getAttribute("aria-current") === null, "indicador 1: sin aria-current");
      t.cierto(ind(2).classList.contains("active") && ind(2).getAttribute("aria-current") === "step",
        "indicador 2: paso en curso");
      t.falso(ind(2).classList.contains("completed"), "indicador 2: no completado");
      t.falso(ind(3).classList.contains("active"), "indicador 3: aún inactivo");

      const slot0 = modal.querySelector("#vgl-agm-slots .vgl-agm-sbtn");
      t.cierto(!!slot0, "hay turnos en el paso 2");
      const step2Next = modal.querySelector("#vgl-step-2-next");
      t.cierto(!!step2Next, "existe el botón de siguiente del paso 2");
      if (!slot0 || !step2Next) return;
      disparar(slot0, "click");
      await esperar(80);
      disparar(step2Next, "click");
      await esperar(100);
      t.igual(v3().style.display, "block", "paso 3: se muestra");
      t.igual(v2().style.display, "none", "paso 2: se oculta");
      t.cierto(ind(2).classList.contains("completed"), "indicador 2: completado");
      t.cierto(ind(3).classList.contains("active") && ind(3).getAttribute("aria-current") === "step",
        "indicador 3: paso en curso");
      const resumen = modal.querySelector("#vgl-summary-content");
      t.cierto(!!resumen, "el resumen del paso 3 existe");
      if (resumen) {
        t.cierto(resumen.textContent.includes("08:00 AM"), "el resumen repite la hora elegida");
        t.cierto(resumen.textContent.includes("Medicina General (Control)"), "el resumen repite la especialidad");
        t.cierto(resumen.textContent.includes("ANA MARIA PEREZ"), "el resumen repite el médico propio");
      }

      const step3Back = modal.querySelector("#vgl-step-3-back");
      t.cierto(!!step3Back, "existe el botón de volver del paso 3");
      if (!step3Back) return;
      disparar(step3Back, "click");
      await esperar(80);
      t.igual(v2().style.display, "block", "de 3 a 2: la vista 2 vuelve");
      t.falso(ind(3).classList.contains("active") || ind(3).getAttribute("aria-current") === "step",
        "indicador 3: deja de ser el paso en curso");
      t.cierto(ind(2).classList.contains("active") && !ind(2).classList.contains("completed"),
        "indicador 2: vuelve a ser el paso en curso");

      const step2Back = modal.querySelector("#vgl-step-2-back");
      t.cierto(!!step2Back, "existe el botón de volver del paso 2");
      if (!step2Back) return;
      disparar(step2Back, "click");
      await esperar(80);
      t.igual(v1().style.display, "block", "de 2 a 1: la vista 1 vuelve");
      t.cierto(ind(1).classList.contains("active") && !ind(1).classList.contains("completed"),
        "indicador 1: vuelve a ser el paso en curso sin completado");
      t.cierto(ind(1).getAttribute("aria-current") === "step", "aria-current vuelve al indicador 1");
      t.igual(modal.querySelectorAll("#vgl-agm-slots .vgl-agm-sbtn.active").length, 1,
        "el turno elegido sobrevive la vuelta atrás");
      estadoCoherente(t, modal, "stepper");
    });

  },
};
