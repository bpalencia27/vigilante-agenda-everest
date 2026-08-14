const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Cascada CSS",
  cubre: ["buildOverlay"],
  pruebas: function (t, api, env) {
    const code = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

    let css = "";
    let inCss = false;
    for (const line of code.split('\n')) {
      if (line.includes('style.textContent = `')) { inCss = true; continue; }
      if (inCss && line.includes('`;')) { inCss = false; break; }
      if (inCss) css += line + '\n';
    }
    t.cierto(css.length > 0, "Se extrajo el bloque CSS de buildOverlay");

    const combos = [];
    const combosVistos = new Set();
    const addCombo = (arr) => {
      if (arr.length > 1) {
        const str = [...arr].sort().join(' ');
        if (!combosVistos.has(str)) {
          combosVistos.add(str);
          combos.push(arr);
        }
      }
    };

    let match;
    const regClassAttr = /class="([^"]+)"/g;
    while ((match = regClassAttr.exec(code)) !== null) addCombo(match[1].split(/\s+/).filter(Boolean));

    const regClassName = /\.className\s*=\s*["']([^"']+)["']/g;
    while ((match = regClassName.exec(code)) !== null) addCombo(match[1].split(/\s+/).filter(Boolean));

    const cssClean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const reglasCss = [];
    const blockRegex = /([^{}]+)\{([^{}]+)\}/g;

    let blockId = 0;
    while ((match = blockRegex.exec(cssClean)) !== null) {
      blockId++;
      const selectorsStr = match[1];
      const blockStr = match[2];

      if (selectorsStr.includes('@media') || selectorsStr.includes('@keyframes')) continue;

      const propsArr = blockStr.split(';').map(p => p.trim()).filter(p => p.includes(':'));
      const props = new Set();
      const importantProps = new Set();
      const decls = [];
      for (const p of propsArr) {
        const splitIndex = p.indexOf(':');
        const k = p.substring(0, splitIndex);
        const v = p.substring(splitIndex + 1);
        const propKebab = k.trim().replace(/([A-Z])/g, "-$1").toLowerCase();
        props.add(propKebab);
        if (v && v.includes('!important')) importantProps.add(propKebab);
        if (propKebab === 'color') {
          decls.push(p.replace(/\s+/g, ' '));
        }
      }

      for (const sel of selectorsStr.split(',').map(s => s.trim()).filter(Boolean)) {
        let ids = (sel.match(/#[a-zA-Z0-9_-]+/g) || []).length;
        let cls = (sel.match(/\.[a-zA-Z0-9_-]+/g) || []).length;
        let pseudo = (sel.match(/:[a-zA-Z0-9_-]+/g) || []).length;
        let tags = (sel.match(/^[a-zA-Z0-9_-]+|(?<=[\s>+~])[a-zA-Z0-9_-]+/g) || []).filter(t => !['#','.',':'].includes(t[0])).length;

        let specificity = ids * 100 + (cls + pseudo) * 10 + tags;

        const parts = sel.split(/[\s>+~]+/);
        const lastPart = parts[parts.length - 1];
        const targetClasses = (lastPart.match(/\.[a-zA-Z0-9_-]+/g) || []).map(c => c.substring(1));

        reglasCss.push({
          blockId,
          selector: sel,
          specificity,
          targetClasses: new Set(targetClasses),
          isHover: sel.includes(':hover') || sel.includes(':disabled') || sel.includes(':focus'),
          props,
          importantProps,
          decls
        });
      }
    }

    t.caso("Regla A - Clases que conviven no dependen del orden", () => {
      let fallos = [];
      for (const combo of combos) {
        const comboSet = new Set(combo);

        const aplicables = reglasCss.filter(r => {
          if (r.targetClasses.size === 0) return false;
          if (r.isHover) return false;
          for (const req of r.targetClasses) {
            if (!comboSet.has(req)) return false;
          }
          return true;
        });

        for (let i = 0; i < aplicables.length; i++) {
          for (let j = i + 1; j < aplicables.length; j++) {
            const r1 = aplicables[i];
            const r2 = aplicables[j];

            if (r1.blockId === r2.blockId) continue;

            if (r1.specificity === r2.specificity) {
              for (const p of r1.props) {
                if (r2.props.has(p)) {
                  const req1 = Array.from(r1.targetClasses);
                  const req2 = Array.from(r2.targetClasses);

                  const diff1 = req1.filter(c => !req2.includes(c));
                  const diff2 = req2.filter(c => !req1.includes(c));

                  if (diff1.length > 0 && diff2.length > 0) {
                     fallos.push(`Regla A: Las clases '${r1.selector}' y '${r2.selector}' conviven en class="${combo.join(' ')}" y colisionan en '${p}' con especificidad idéntica (${r1.specificity}).`);
                  }
                }
              }
            }
          }
        }
      }

      const unicos = [...new Set(fallos)];
      if (unicos.length > 0) {
        throw new Error("Dependencia del orden detectada:\n" + unicos.join("\n"));
      }
    });

    t.caso("Regla B - !important contra estilo inline", () => {
      const classImportantProps = new Map();
      for (const r of reglasCss) {
        if (r.importantProps.size > 0) {
          for (const c of r.targetClasses) {
            if (!classImportantProps.has(c)) classImportantProps.set(c, new Set());
            for (const p of r.importantProps) classImportantProps.get(c).add({ prop: p, selector: r.selector });
          }
        }
      }

      let fallos = [];

      const htmlTagRegex = /<[a-zA-Z0-9-]+([^>]+)>/g;
      while ((match = htmlTagRegex.exec(code)) !== null) {
        const attrs = match[1];
        const classMatch = attrs.match(/class="([^"]+)"/);
        const styleMatch = attrs.match(/style="([^"]+)"/);
        if (classMatch && styleMatch) {
          const classes = classMatch[1].split(/\s+/);
          const styles = styleMatch[1].split(';').map(s => s.split(':')[0].trim());
          for (const cls of classes) {
            if (classImportantProps.has(cls)) {
              const impProps = classImportantProps.get(cls);
              for (const style of styles) {
                for (const imp of impProps) {
                  if (imp.prop === style) {
                    const selClean = imp.selector.replace(/:[a-zA-Z-]+/g, '');
                    if (!selClean.includes(' ') && !selClean.includes('>') && !selClean.includes('~') && !selClean.includes('+')) {
                       fallos.push(`Regla B: Clase '.${cls}' pura declara '${style}: !important', pero en HTML usa style inline.`);
                    }
                  }
                }
              }
            }
          }
        }
      }

      const elVars = new Map();
      const getEl = (v) => {
        if (!elVars.has(v)) elVars.set(v, { classes: new Set(), styles: new Set() });
        return elVars.get(v);
      };

      const classAddRegex = /([a-zA-Z0-9_.]+)\.classList\.(add|toggle|remove)\(["']([^"']+)["']/g;
      while ((match = classAddRegex.exec(code)) !== null) getEl(match[1]).classes.add(match[3]);

      const classNameReg = /([a-zA-Z0-9_.]+)\.className\s*=\s*["']([^"']+)["']/g;
      while ((match = classNameReg.exec(code)) !== null) {
        match[2].split(/\s+/).filter(Boolean).forEach(c => getEl(match[1]).classes.add(c));
      }

      const styleAssignRegex = /([a-zA-Z0-9_.]+)\.style\.([a-zA-Z0-9_]+)\s*=/g;
      while ((match = styleAssignRegex.exec(code)) !== null) {
        const propKebab = match[2].replace(/([A-Z])/g, "-$1").toLowerCase();
        getEl(match[1]).styles.add(propKebab);
      }

      for (const [varName, data] of elVars.entries()) {
        for (const cls of data.classes) {
          if (classImportantProps.has(cls)) {
            const impProps = classImportantProps.get(cls);
            for (const style of data.styles) {
              for (const imp of impProps) {
                if (imp.prop === style) {
                   const selClean = imp.selector.replace(/:[a-zA-Z-]+/g, '');
                   if (!selClean.includes(' ') && !selClean.includes('>') && !selClean.includes('~') && !selClean.includes('+')) {
                      fallos.push(`Regla B: Clase '.${cls}' declara '${style}: !important', pero JS asigna '${varName}.style.${style}'`);
                   }
                }
              }
            }
          }
        }
      }

      const unicos = [...new Set(fallos)];
      if (unicos.length > 0) {
        throw new Error("Colisión !important vs inline detectada:\n" + unicos.join("\n"));
      }
    });

    // v12.10.9 — Regla C (dirigida, no genérica): la insignia SUGERIDO perdía sus tres
    // propiedades (color/background/border-color) en tema claro porque
    // `#vgl-agendar-modal.light .vgl-agm-sbtn` (id+2 clases) le ganaba en especificidad a
    // `.vgl-agm-sbtn-sugerido` (1 clase), sin que Regla A lo detectara: Regla A solo mira
    // colisiones de especificidad IDÉNTICA (dependientes del orden), y aquí la
    // especificidad es distinta a propósito — gana siempre la de mayor especificidad, que
    // es justo el bug. Tampoco lo veía porque la clase se arma por concatenación
    // (`"vgl-agm-sbtn" + (esSugerida ? " vgl-agm-sbtn-sugerido" : "")`), no como
    // `class="..."` ni `.className = "literal"`, así que ni entraba a `combos`.
    // Verificado con Chromium real (harness + buildOverlay(), CSS extraído real) contra
    // las tres propiedades computadas en tema claro y oscuro, con y sin `.active` — no se
    // deja como detector genérico: uno se intentó y dio 259 falsos positivos en este mismo
    // archivo. Se ancla el fix concreto: el selector de tema claro que compite por SUGERIDO
    // debe tener especificidad ESTRICTAMENTE mayor que el que le gana hoy.
    t.caso("Regla C - la insignia SUGERIDO no pierde su color en tema claro", () => {
      const base = reglasCss.find((r) =>
        r.selector.includes("#vgl-agendar-modal.light") && r.targetClasses.has("vgl-agm-sbtn") && !r.targetClasses.has("vgl-agm-sbtn-sugerido")
      );
      t.cierto(!!base, "existe la regla base de tema claro para .vgl-agm-sbtn (si esto falla, el selector cambió de forma y hay que revisar el fix a mano)");

      const sugeridoClaro = reglasCss.filter((r) =>
        r.selector.includes("#vgl-agendar-modal.light") && r.targetClasses.has("vgl-agm-sbtn-sugerido")
      );
      t.cierto(sugeridoClaro.length > 0, "existe una regla de tema claro específica para .vgl-agm-sbtn-sugerido (el fix de v12.10.9)");

      for (const r of sugeridoClaro) {
        t.cierto(r.specificity > base.specificity, `la regla de SUGERIDO en tema claro (${r.selector}, especificidad ${r.specificity}) debe superar a la regla base (${base.selector}, especificidad ${base.specificity}) — si no, vuelve a perder el color`);
        for (const prop of ["color", "background", "border-color"]) {
          t.cierto(r.props.has(prop), `la regla de SUGERIDO en tema claro debe fijar '${prop}' explícitamente (la base también la fija: si SUGERIDO no la repite, la hereda de la base igual)`);
        }
      }
    });

    t.caso("Regla D - toda var(--X) que consume la hoja está declarada", () => {
      const cssClean = css.replace(/\/\*[\s\S]*?\*\//g, "");

      const usadas = new Set();
      const regexUsadas = /var\(\s*(--[A-Za-z0-9_-]+)/g;
      let match;
      while ((match = regexUsadas.exec(cssClean)) !== null) {
        usadas.add(match[1]);
      }

      const declaradas = new Set();
      const regexDeclaradas = /(?:^|[;{,\s])(--[A-Za-z0-9_-]+)\s*:/g;
      while ((match = regexDeclaradas.exec(cssClean)) !== null) {
        declaradas.add(match[1]);
      }

      const faltantes = [];
      for (const u of usadas) {
        if (!declaradas.has(u)) {
          faltantes.push(u);
        }
      }

      const esperadas = ['--ac', '--ac-rgb', '--tk'];
      const faltantesString = faltantes.sort().join(', ');
      const esperadasString = esperadas.sort().join(', ');

      if (faltantesString !== esperadasString) {
         throw new Error(`USADAS - DECLARADAS no coincide. Esperadas: {${esperadasString}}, Obtenidas: {${faltantesString}}`);
      }

      /*
       * LIMITACIÓN: Esta guarda demuestra que el token está declarado en ALGÚN sitio de la hoja CSS,
       * NO que llegue al elemento final (un elemento fuera de las listas de ids pasa esta guarda
       * aunque falle en runtime).
       * NO se comprueba la dirección inversa (declarada-y-sin-usar) porque hoy hay 15 tokens en
       * ese caso, entre ellos --rgb-atendido (inyectado desde JS) y tokens de escala tipográfica
       * y de capas que están pendientes de conectar.
       */
    });

    // Punto ciego: el filtro exige que el selector nombre explícitamente el ID del panel
    // (#vgl-pym-modal, etc.), así que Regla E no ve las clases peladas (como .vgl-labsv-lead,
    // .vgl-labsv-foot, .vgl-pym-t, .vgl-modal-t...) que cuelgan del modal pero no lo incluyen
    // en su cadena de especificidad. Es decir, esta regla NO habría cazado el bug v12.10.5
    // si el selector hubiera sido una clase sin el ID del panel. Sirve para que no entre
    // una regla nueva insegura que nombre al panel sin !important.
    // v12.10.12 — reconciliación: la versión original de esta prueba traía un filtro
    // (`if (cd.includes('color: var(')) continue;`) que EXCLUÍA por completo, de la
    // revisión, cualquier declaración de color escrita con espacio tras los dos puntos
    // ("color: var(...)", el formato multilínea normal de CSS) — no solo las 3 que la
    // base original no contaba bien, sino CUALQUIER declaración futura escrita así,
    // sin importar si tenía !important o no. Verificado con una regla nueva inyectada
    // en ese formato: la suite quedaba en verde sin verla. BASE_CONOCIDA ahora es la
    // lista real y completa (73 infracciones únicas, filtro quitado).
    t.caso("Regla E - color con selector de PANEL fuera de #vgl-root lleva !important", () => {
      const BASE_CONOCIDA = [
        "#vgl-agendar-modal #vgl-agm-sms-nota|color:var(--fg3)",
        "#vgl-agendar-modal #vgl-lab-date-lbl|color:var(--c-verde)",
        "#vgl-agendar-modal .vgl-agm-cell-lab .vgl-agm-fieldrow>label|color:var(--c-verde)",
        "#vgl-agendar-modal .vgl-agm-fieldrow>label|color:var(--c-azul)",
        "#vgl-agendar-modal .vgl-agm-fieldrow|color:var(--fg2)",
        "#vgl-agendar-modal .vgl-agm-kicker|color:var(--c-azul)",
        "#vgl-agendar-modal .vgl-agm-lab-sms-nota|color:var(--fg3)",
        "#vgl-agendar-modal .vgl-agm-patient|color:var(--fg)",
        "#vgl-agendar-modal .vgl-agm-step|color:var(--c-azul)",
        "#vgl-agendar-modal.light .vgl-agm-card|color:var(--fg)",
        "#vgl-agendar-modal.light .vgl-agm-close|color:var(--fg)",
        "#vgl-agendar-modal.light .vgl-agm-dinfo b|color:var(--c-verde)",
        "#vgl-agendar-modal.light .vgl-agm-input|color:var(--fg)",
        "#vgl-agendar-modal.light .vgl-agm-lbl|color:var(--c-azul)",
        "#vgl-agendar-modal.light .vgl-agm-pbtn|color:var(--fg)",
        "#vgl-agendar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-sugerido|color:var(--c-ambar)",
        "#vgl-agendar-modal.light .vgl-agm-sbtn|color:var(--fg)",
        "#vgl-agendar-modal.light .vgl-agm-sub b|color:var(--fg)",
        "#vgl-agendar-modal.light .vgl-agm-sub.med b|color:var(--c-azul)",
        "#vgl-agendar-modal.light .vgl-agm-sub|color:var(--fg2)",
        "#vgl-agendar-modal.light .vgl-agm-title|color:var(--fg)",
        "#vgl-agendar-modal.light .vgl-ord-cie|color:var(--c-azul)",
        "#vgl-agendar-modal.light .vgl-ord-cups|color:var(--fg2)",
        "#vgl-agendar-modal.light .vgl-ord-title|color:var(--fg)",
        "#vgl-labs-modal .vgl-agm-lbl|color:var(--c-verde)",
        "#vgl-labs-modal .vgl-labs-alert .vgl-labs-val|color:var(--c-rojo)",
        "#vgl-labs-modal .vgl-labs-date|color:var(--fg3)",
        "#vgl-labs-modal .vgl-labs-empty b|color:var(--fg)",
        "#vgl-labs-modal .vgl-labs-empty|color:var(--fg2)",
        "#vgl-labs-modal .vgl-labs-exam|color:var(--fg)",
        "#vgl-labs-modal .vgl-labs-kicker|color:var(--c-verde)",
        "#vgl-labs-modal .vgl-labs-patient|color:var(--fg)",
        "#vgl-labs-modal .vgl-labs-portal|color:var(--c-azul)",
        "#vgl-labs-modal .vgl-labs-ref|color:var(--fg3)",
        "#vgl-labs-modal .vgl-labs-src.athenea|color:var(--c-azul)",
        "#vgl-labs-modal .vgl-labs-srclbl b|color:var(--fg)",
        "#vgl-labs-modal .vgl-labs-srclbl|color:var(--fg2)",
        "#vgl-labs-modal .vgl-labs-src|color:var(--fg2)",
        "#vgl-labs-modal .vgl-labs-table thead th|color:var(--fg3)",
        "#vgl-labs-modal .vgl-labs-uro-i b|color:var(--fg3)",
        "#vgl-labs-modal .vgl-labs-val|color:var(--fg)",
        "#vgl-labs-modal.light .vgl-agm-card|color:var(--fg)",
        "#vgl-labs-modal.light .vgl-agm-close|color:var(--fg)",
        "#vgl-labs-modal.light .vgl-agm-lbl|color:var(--c-azul)",
        "#vgl-labs-modal.light .vgl-agm-lbl|color:var(--c-verde)",
        "#vgl-labs-modal.light .vgl-agm-pbtn|color:var(--fg)",
        "#vgl-labs-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-sugerido|color:var(--c-ambar)",
        "#vgl-labs-modal.light .vgl-agm-sbtn|color:var(--fg)",
        "#vgl-labs-modal.light .vgl-agm-sub b|color:var(--fg)",
        "#vgl-labs-modal.light .vgl-agm-sub|color:var(--fg2)",
        "#vgl-labs-modal.light .vgl-agm-title|color:var(--fg)",
        "#vgl-ordenar-modal .vgl-agm-fieldrow>label|color:var(--c-azul)",
        "#vgl-ordenar-modal .vgl-agm-fieldrow|color:var(--fg2)",
        "#vgl-ordenar-modal .vgl-agm-kicker|color:var(--c-morado)",
        "#vgl-ordenar-modal .vgl-agm-lbl|color:var(--c-morado)",
        "#vgl-ordenar-modal .vgl-agm-patient|color:var(--fg)",
        "#vgl-ordenar-modal .vgl-agm-step|color:var(--c-morado)",
        "#vgl-ordenar-modal .vgl-ord-cie|color:var(--c-morado)",
        "#vgl-ordenar-modal .vgl-ord-cup b|color:var(--c-azul)",
        "#vgl-ordenar-modal .vgl-ord-cupk|color:var(--fg3)",
        "#vgl-ordenar-modal .vgl-ord-cup|color:var(--fg2)",
        "#vgl-ordenar-modal .vgl-ord-pymsrc|color:var(--c-morado)",
        "#vgl-ordenar-modal .vgl-ord-sexwarn|color:var(--c-rojo)",
        "#vgl-ordenar-modal.light .vgl-agm-card|color:var(--fg)",
        "#vgl-ordenar-modal.light .vgl-agm-close|color:var(--fg)",
        "#vgl-ordenar-modal.light .vgl-agm-dinfo b|color:var(--c-verde)",
        "#vgl-ordenar-modal.light .vgl-agm-lbl|color:var(--c-azul)",
        "#vgl-ordenar-modal.light .vgl-agm-pbtn|color:var(--fg)",
        "#vgl-ordenar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-sugerido|color:var(--c-ambar)",
        "#vgl-ordenar-modal.light .vgl-agm-sbtn|color:var(--fg)",
        "#vgl-ordenar-modal.light .vgl-agm-sub b|color:var(--fg)",
        "#vgl-ordenar-modal.light .vgl-agm-sub|color:var(--fg2)",
        "#vgl-ordenar-modal.light .vgl-agm-title|color:var(--fg)"
      ];

      const paneles = [
        '#vgl-pym-modal', '#vgl-pes-modal', '#vgl-labs-modal',
        '#vgl-labsv-modal', '#vgl-postcita-panel', '#vgl-agendar-modal', '#vgl-ordenar-modal'
      ];

      const infracciones = new Set();
      for (const r of reglasCss) {
        if (paneles.some(p => r.selector.includes(p))) {
          if (r.selector.includes(':where(')) continue;
          for (const cd of r.decls) {
            if (!cd.includes('!important')) {
              const normSel = r.selector.trim().replace(/\s+/g, ' ');
              const normDecl = cd.replace(/\s+/g, ''); // "color:var(--c-azul)"
              infracciones.add(`${normSel}|${normDecl}`);
            }
          }
        }
      }

      const arrInfracciones = Array.from(infracciones).sort();
      t.cierto(arrInfracciones.length === BASE_CONOCIDA.length, `Deben salir ${BASE_CONOCIDA.length} cadenas únicas. Salieron ${arrInfracciones.length}.`);

      for (let i = 0; i < BASE_CONOCIDA.length; i++) {
        t.cierto(arrInfracciones[i] === BASE_CONOCIDA[i], `Infracción no coincide:\nEsperada: ${BASE_CONOCIDA[i]}\nObtenida: ${arrInfracciones[i]}`);
      }
    });

    t.caso("Regla F - paridad de tokens claro/oscuro y un token por cada color de COLORS", () => {
      // 1. Paridad de tokens claro/oscuro
      const bloqueOscuro = css.match(/((?:#[a-z0-9-]+,?\s*)+)\s*\{\s*\/\*[\s\S]*?\*\/\s*--bg:rgba\([^)]+\);/);
      const bloqueClaro = css.match(/((?:#[a-z0-9-]+\.light,?\s*)+)\s*\{\s*--bg:rgba\([^)]+\);/);

      if (!bloqueOscuro || !bloqueClaro) {
        throw new Error("No se encontraron los bloques de IDs para el modo oscuro o claro");
      }

      const oscuroIds = [];
      const regexOscuro = /#([a-z0-9-]+)/g;
      let match;
      while ((match = regexOscuro.exec(bloqueOscuro[1])) !== null) {
        oscuroIds.push(match[1]);
      }

      const claroIds = [];
      const regexClaro = /#([a-z0-9-]+)\.light/g;
      while ((match = regexClaro.exec(bloqueClaro[1])) !== null) {
        claroIds.push(match[1]);
      }

      for (const id of oscuroIds) {
        if (!claroIds.includes(id)) {
           throw new Error(`El id oscuro #${id} no tiene un gemelo en la lista clara.`);
        }
      }

      // 2. Un token por cada color de COLORS
      const colorsMatch = code.match(/const COLORS = (\{[^\}]+\});/);
      if (!colorsMatch) throw new Error("No se encontró la declaración de const COLORS");

      // Leer de forma segura las claves de COLORS extrayéndolas del texto
      const colorsKeys = [];
      const keysRegex = /([A-Z]+)\s*:/g;
      while ((match = keysRegex.exec(colorsMatch[1])) !== null) {
        colorsKeys.push(match[1]);
      }

      const cssDeclaradas = new Set();
      const regexDeclaradas = /(?:^|[;{,\s])(--[A-Za-z0-9_-]+)\s*:/g;
      while ((match = regexDeclaradas.exec(css)) !== null) {
        cssDeclaradas.add(match[1]);
      }

      for (const key of colorsKeys) {
        const cKey = `--c-${key.toLowerCase()}`;
        const rgbKey = `--rgb-${key.toLowerCase()}`;
        if (!cssDeclaradas.has(cKey)) throw new Error(`Falta el token ${cKey}`);
        if (!cssDeclaradas.has(rgbKey)) throw new Error(`Falta el token ${rgbKey}`);
      }

      /*
       * Justificación: La línea 11474 usa rgba(var(--trgb),${alfa}) y la 11561
       * fija --trgb:var(--rgb-${clave}) sin valor de respaldo. Por lo tanto,
       * una clave nueva en COLORS sin su correspondiente token --rgb-*
       * volvería inválido ese rgba() y la tarjeta heredaría el azul de Everest.
       */
    });

    // TAREA D1 — cablea la escala tipográfica muerta (--t-micro/--t-body/--t-lead) a los
    // 36 font-size literales de la hoja (12px/14px/16px). El valor computado NO cambia
    // (los tokens valen exactamente 12/14/16px en ambos temas): cero cambio visual, solo
    // deja de haber `font-size:12px|14px|16px` literales sueltos en la cascada. El caso
    // especial de `.vgl-lab-inj,.vgl-exf-btn` lleva reserva (`var(--t-micro,12px)`) porque
    // ese botón se pega directo a document.body y no está en ninguna de las dos listas de
    // ids con tokens — sin reserva, la declaración quedaría inválida (incidente v12.6.6).
    t.caso("Regla G - escala tipográfica: font-size literales quedan cableados a var(--t-*)", () => {
      const literal12 = css.match(/font-size: *12px(?![0-9.])/g) || [];
      const literal14 = css.match(/font-size: *14px(?![0-9.])/g) || [];
      const literal16 = css.match(/font-size: *16px(?![0-9.])/g) || [];

      t.cierto(literal12.length === 0, `No deben quedar font-size:12px literales en la hoja (quedaron ${literal12.length})`);
      t.cierto(literal14.length === 0, `No deben quedar font-size:14px literales en la hoja (quedaron ${literal14.length})`);
      t.cierto(literal16.length === 0, `No deben quedar font-size:16px literales en la hoja (quedaron ${literal16.length})`);

      const microUsos = css.match(/var\(--t-micro(?:,[^)]*)?\)/g) || [];
      const bodyUsos = css.match(/var\(--t-body\)/g) || [];
      const leadUsos = css.match(/var\(--t-lead\)/g) || [];

      t.cierto(microUsos.length === 25, `var(--t-micro) debe aparecer 25 veces (incluida la reserva). Salieron ${microUsos.length}.`);
      t.cierto(bodyUsos.length === 6, `var(--t-body) debe aparecer 6 veces. Salieron ${bodyUsos.length}.`);
      t.cierto(leadUsos.length === 5, `var(--t-lead) debe aparecer 5 veces. Salieron ${leadUsos.length}.`);

      const conReserva = css.match(/var\(--t-micro,12px\)/g) || [];
      t.cierto(conReserva.length === 1, `El caso especial .vgl-lab-inj,.vgl-exf-btn debe conservar la reserva var(--t-micro,12px) exactamente 1 vez (salieron ${conReserva.length}) — sin ella, el botón #vgl-examen-normalidad (fuera de las listas de tokens) heredaría el font-size de Everest`);

      const importantTotal = (css.match(/!important/g) || []).length;
      t.cierto(importantTotal === 150, `El total de !important en la hoja no debe cambiar por este cableado (esperado 150, salió ${importantTotal})`);
    });

    t.caso("Regla H - los tokens de escala tipográfica siguen declarados en ambas listas, sin cambiar de valor", () => {
      const declaracion = /--t-micro:12px;--t-body:14px;--t-lead:16px;/g;
      const usos = css.match(declaracion) || [];
      t.cierto(usos.length === 2, `--t-micro/--t-body/--t-lead deben seguir declarados con 12px/14px/16px en las dos listas de tokens (oscura y clara). Salieron ${usos.length}.`);
    });

  }
};
