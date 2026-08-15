const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Cascada CSS",
  cubre: [],
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
      t.cierto(combos.length > 0, "debe encontrar combos de clases para validar");
      t.cierto(reglasCss.length > 0, "debe extraer reglas CSS");
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
      t.cierto(unicos.length === 0, "Dependencia del orden detectada:\n" + unicos.join("\n"));
    });

    t.caso("Regla B - !important contra estilo inline", () => {
      const classImportantProps = new Map();
      t.cierto(reglasCss.length > 0, "debe extraer reglas CSS");
      for (const r of reglasCss) {
        if (r.importantProps.size > 0) {
          for (const c of r.targetClasses) {
            if (!classImportantProps.has(c)) classImportantProps.set(c, new Set());
            for (const p of r.importantProps) classImportantProps.get(c).add({ prop: p, selector: r.selector });
          }
        }
      }

      t.cierto(classImportantProps.size > 0, "debe encontrar propiedades con !important");

      let fallos = [];

      const htmlTagRegex = /<[a-zA-Z0-9-]+([^>]+)>/g;
      let tagMatch;
      while ((tagMatch = htmlTagRegex.exec(code)) !== null) {
        const attrs = tagMatch[1];
        const classMatch = /class="([^"]+)"/.exec(attrs);
        const styleMatch = /style="([^"]+)"/.exec(attrs);

        if (classMatch && styleMatch) {
          const classes = classMatch[1].split(/\s+/).filter(Boolean);
          const styleProps = styleMatch[1].split(';')
            .map(s => s.trim().split(':')[0].trim())
            .filter(Boolean)
            .map(p => p.replace(/([A-Z])/g, "-$1").toLowerCase());

          for (const cls of classes) {
            if (classImportantProps.has(cls)) {
              for (const imp of classImportantProps.get(cls)) {
                if (styleProps.includes(imp.prop)) {
                  const selClean = imp.selector.replace(/:[a-zA-Z-]+/g, '');
                  if (!selClean.includes(' ') && !selClean.includes('>') && !selClean.includes('~') && !selClean.includes('+')) {
                    fallos.push(`Regla B: Clase '.${cls}' pura declara '${imp.prop}: !important' (${imp.selector}), pero en HTML usa style inline.`);
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
    // lista real y completa (74 infracciones únicas tras v14.0.0/vgl-ord-vigwarn, filtro quitado).
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
        "#vgl-ordenar-modal .vgl-ord-vigwarn|color:var(--c-verde)",
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

      // v14.0.0 (TL1) — piel de agendar/ordenar: 12.5px/13.5px eran parte de los "hoy hay
      // 11px, 11.5px, 12.5px..." que el propio §4.2 pide eliminar. Migrados a
      // var(--t-micro)/var(--t-body) (0.5px de diferencia, imperceptible) SOLO en las
      // clases .vgl-agm-*/.vgl-ord-*/.vgl-postcita-* — el resto de la hoja (labs/pym/pes/
      // labsv-modal, toasts, badges) queda fuera del alcance de TL1 a propósito, no tocado.
      const clasesTL1 = /\.(vgl-agm-[\w-]+|vgl-ord-[\w-]+|vgl-postcita-sub)\s*\{[^}]*font-size:\s*1[23]\.5px/g;
      const sinMigrarTL1 = css.match(clasesTL1) || [];
      t.cierto(sinMigrarTL1.length === 0, `No deben quedar font-size:12.5px/13.5px literales en las clases de TL1 (agendar/ordenar) (quedaron ${sinMigrarTL1.length}: ${sinMigrarTL1.join(" | ")})`);

      const microUsos = css.match(/var\(--t-micro(?:,[^)]*)?\)/g) || [];
      const bodyUsos = css.match(/var\(--t-body\)/g) || [];
      const leadUsos = css.match(/var\(--t-lead\)/g) || [];

      // v14.0.0 (TL1) — 8 usos nuevos de var(--t-micro) (12.5px de .vgl-agm-lbl/-pbtn/-dinfo/
      // -sbtn/-loading/-err/-input y .vgl-postcita-sub) y 5 de var(--t-body) (13.5px de
      // .vgl-agm-sub/-check-lbl/-btn y las DOS declaraciones de .vgl-ord-title — la base
      // compartida y el override más específico de #vgl-ordenar-modal, que antes le ganaba
      // en especificidad y dejaba el cableado de la base sin efecto real): 25->33, 6->11.
      // v14.0.0 (TL2) — 3 usos nuevos de var(--t-micro) en #vgl-labs-modal
      // (.vgl-labs-srclbl, .vgl-labs-portal, .vgl-labs-uro): 33->36. Solo estos 3: el
      // resto de tamaños del modal de labs (10.5/11/11.5/13/15.5px) se dejan a propósito
      // — migrarlos a --t-body (14px, el valor VIGENTE, no el "oficial" de 13px) subiría
      // el tamaño de letra de una tabla clínica densa, justo lo contrario de "densidad
      // antes que aire" (§4.3.4); queda documentado como pregunta abierta para el médico,
      // no una migración mecánica segura.
      // v14.0.0 (release unificado T4+T5+T7 sobre TL1/TL2) — los dos contenedores nuevos
      // suman sobre la base de TL1/TL2 (micro 36, body 11, lead 5):
      //   · T5, dock de widgets: +1 var(--t-micro) (.vgl-dock-toggle) y +1 var(--t-lead)
      //     (.vgl-dock-btn). No usa var(--t-body).
      //   · T7, banner PyM: +4 var(--t-micro) (contador, aviso de "no se pudo verificar",
      //     nombre de cada actividad y el botón "Ordenar") y +2 var(--t-body) (el
      //     contenedor #vgl-pym-banner y el botón de minimizar). No usa var(--t-lead).
      // Total: micro 36+1+4=41, body 11+2=13, lead 5+1=6. Los tres números se
      // recalcularon ejecutando este mismo regex contra el CSS ya fusionado, no sumando a
      // mano las cifras de cada rama por separado.
      // v14.1.1 (R1b) — +3 micro y +1 body: el recuadro de función renal del modal de
      // laboratorios (.vgl-labs-renal-det/-aviso/-vacio en micro, .vgl-labs-renal-top en
      // body). Se suben los anclas en vez de relajar la regla: el valor de esta prueba es
      // justamente que un font-size literal nuevo NO pueda entrar sin que alguien lo note.
      t.cierto(microUsos.length === 44, `var(--t-micro) debe aparecer 44 veces (36 de TL1/TL2 + 1 del dock de T5 + 4 del banner de T7 + 3 del recuadro renal de R1b). Salieron ${microUsos.length}.`);
      t.cierto(bodyUsos.length === 14, `var(--t-body) debe aparecer 14 veces (11 de TL1 + 2 del banner de T7 + 1 del recuadro renal de R1b; T5 no usa --t-body). Salieron ${bodyUsos.length}.`);
      t.cierto(leadUsos.length === 6, `var(--t-lead) debe aparecer 6 veces (base 5 + .vgl-dock-btn de T5; el banner no usa --t-lead). Salieron ${leadUsos.length}.`);

      const conReserva = css.match(/var\(--t-micro,12px\)/g) || [];
      t.cierto(conReserva.length === 1, `El caso especial .vgl-lab-inj,.vgl-exf-btn debe conservar la reserva var(--t-micro,12px) exactamente 1 vez (salieron ${conReserva.length}) — sin ella, el botón #vgl-examen-normalidad (fuera de las listas de tokens) heredaría el font-size de Everest`);

      // v14.0.0 (T5) — el interruptor de modo rendimiento del dock de widgets
      // (#vgl-acciones-dock.perf,#vgl-acciones-dock.perf *{transition:none
      // !important;animation:none !important}) suma 2 !important nuevos, mismo patrón que
      // el ya existente #vgl-dock.perf *{...}. No los añadió el cableado de esta regla
      // (Regla G): 150 -> 152.
      // v14.1.1 (R1b): 152 -> 158. Las 6 declaraciones de 'color' del recuadro de función
      // renal del modal de laboratorios viven FUERA de #vgl-root (el modal cuelga de
      // document.body), así que la Regla E exige !important en cada una: el CSS de Everest
      // es una caja negra que puede ganarle a una regla sin él. No son 6 !important
      // decorativos: son exactamente los que esa regla obliga a poner.
      const importantTotal = (css.match(/!important/g) || []).length;
      t.cierto(importantTotal === 158, `El total de !important en la hoja no debe cambiar por este cableado, salvo el interruptor .perf de T5 y los 6 del recuadro renal de R1b (esperado 158, salió ${importantTotal})`);
    });

    t.caso("Regla H - los tokens de escala tipográfica siguen declarados en ambas listas, sin cambiar de valor", () => {
      const declaracion = /--t-micro:12px;--t-body:14px;--t-lead:16px;/g;
      const usos = css.match(declaracion) || [];
      t.cierto(usos.length === 2, `--t-micro/--t-body/--t-lead deben seguir declarados con 12px/14px/16px en las dos listas de tokens (oscura y clara). Salieron ${usos.length}.`);
    });

    // v14.0.0 (T3) — §4.2 del superprompt: --t-strong/--t-title/--t-hero completan la escala
    // tipográfica (junto con --t-micro/--t-body/--t-lead, ya cableados en D1). --t-body queda
    // en 14px (no baja a los 13px "oficiales" del superprompt): esta tarea es cero-cambio-visual,
    // bajarlo movería 6 elementos reales — pregunta abierta para el médico, documentada en el
    // comentario junto a la declaración.
    t.caso("Regla I - escala tipográfica ampliada: 15/18/22px literales quedan cableados a var(--t-strong/title/hero)", () => {
      const literal15 = css.match(/font-size: *15px(?![0-9.])/g) || [];
      const literal18 = css.match(/font-size: *18px(?![0-9.])/g) || [];
      const literal22 = css.match(/font-size: *22px(?![0-9.])/g) || [];
      t.cierto(literal15.length === 0, `No deben quedar font-size:15px literales en la hoja (quedaron ${literal15.length})`);
      t.cierto(literal18.length === 0, `No deben quedar font-size:18px literales en la hoja (quedaron ${literal18.length})`);
      t.cierto(literal22.length === 0, `No deben quedar font-size:22px literales en la hoja (quedaron ${literal22.length})`);

      const strongUsos = css.match(/var\(--t-strong\)/g) || [];
      const titleUsos = css.match(/var\(--t-title\)/g) || [];
      const heroUsos = css.match(/var\(--t-hero\)/g) || [];
      // v14.0.0 (T7) — el título del banner PyM (.vgl-pymb-titulo) suma 1 uso nuevo.
      t.cierto(strongUsos.length === 4, `var(--t-strong) debe aparecer 4 veces (incluido .vgl-pymb-titulo de T7). Salieron ${strongUsos.length}.`);
      t.cierto(titleUsos.length === 4, `var(--t-title) debe aparecer 4 veces. Salieron ${titleUsos.length}.`);
      t.cierto(heroUsos.length === 6, `var(--t-hero) debe aparecer 6 veces. Salieron ${heroUsos.length}.`);

      const declaracion = /--t-strong:15px;--t-title:18px;--t-hero:22px;/g;
      const usosDeclaracion = css.match(declaracion) || [];
      t.cierto(usosDeclaracion.length === 2, `--t-strong/--t-title/--t-hero deben estar declarados en las dos listas de tokens (oscura y clara). Salieron ${usosDeclaracion.length}.`);
    });

    // v14.0.0 (T3) — D6: política de capas. Los 7 "vgl-modal"-como (fraude/PyM/PES/labs vencidos)
    // ya se agrupaban en el propio CSS bajo el comentario "losas de alerta" — se clasifican como
    // --z-alerta (2147483600). Los modales de FLUJO (agendar/ordenar/labs, "placas bento") son
    // --z-modal (2147483000, más bajo que las alertas a propósito: una alerta nunca debe quedar
    // tapada detrás de un modal de flujo). El panel/dock del Vigilante es --z-panel (2147482000)
    // y los widgets ya existentes (inyector de labs) son --z-widget (2147480000, la migración que
    // D6 pide explícitamente para #vgl-lab-injector, hoy en 9999999). --z-toast y los elementos que
    // lo usan (.vgl-sp-toast, #vgl-toasts, #vgl-postcita-panel) NO están en la tabla de D6: se
    // dejan con su literal de siempre, no se inventa una clasificación que el diseño no pide.
    t.caso("Regla J - z-index migrado a los 5 tokens de capas de D6, con el valor exacto de la tabla", () => {
      const declaracionCapas = /--z-toast:2147483647;--z-modal:2147483000;\s*--z-widget:2147480000;--z-banner:2147481000;--z-panel:2147482000;--z-alerta:2147483600;/g;
      const usosDeclaracion = css.match(declaracionCapas) || [];
      t.cierto(usosDeclaracion.length === 2, `Los 5 tokens --z-* de D6 deben estar declarados con sus valores exactos en las dos listas (oscura y clara). Salieron ${usosDeclaracion.length}.`);

      // Ningún z-index NUEVO de los 8 migrados debe quedar como literal — pero el conteo total
      // de "z-index:2147483647" en la hoja debe seguir siendo 1 (.vgl-sp-toast, intocado a propósito).
      const literalMax = css.match(/z-index:2147483647/g) || [];
      t.cierto(literalMax.length === 1, `Solo debe quedar 1 literal z-index:2147483647 (.vgl-sp-toast, fuera del alcance de D6). Salieron ${literalMax.length}.`);
      const literalWidgetViejo = css.match(/z-index:9999999/g) || [];
      t.cierto(literalWidgetViejo.length === 0, `El z-index improvisado de .vgl-lab-inj/.vgl-exf-btn (9999999) debe haber migrado a var(--z-widget). Quedaron ${literalWidgetViejo.length}.`);

      const zPanel = css.match(/z-index:var\(--z-panel\)/g) || [];
      // v14.0.0 — admite también la forma CON RESERVA, var(--z-widget,2147480000): el token
      // se sigue consumiendo igual. La reserva es obligatoria en .vgl-lab-inj/.vgl-exf-btn
      // porque #vgl-examen-normalidad vive fuera de las listas de contenedores (ver Regla M);
      // sin ella la declaración quedaba inválida y el botón desaparecía tras Everest.
      const zWidget = css.match(/z-index:var\(--z-widget(?:,\s*\d+)?\)/g) || [];
      const zModal = css.match(/z-index:var\(--z-modal\)/g) || [];
      const zAlerta = css.match(/z-index:var\(--z-alerta\)/g) || [];
      const zBanner = css.match(/z-index:var\(--z-banner\)/g) || [];
      t.cierto(zPanel.length === 2, `var(--z-panel) debe usarse en #vgl-root y #vgl-dock (2 sitios). Salieron ${zPanel.length}.`);
      // v14.0.0 (T5) — #vgl-acciones-dock (el dock de widgets) también usa var(--z-widget):
      // 1 sitio (.vgl-lab-inj,.vgl-exf-btn) -> 2 sitios.
      t.cierto(zWidget.length === 2, `var(--z-widget) debe usarse en .vgl-lab-inj,.vgl-exf-btn y #vgl-acciones-dock (2 sitios). Salieron ${zWidget.length}.`);
      t.cierto(zModal.length === 1, `var(--z-modal) debe usarse en #vgl-agendar-modal,#vgl-ordenar-modal,#vgl-labs-modal (1 sitio, selector compuesto). Salieron ${zModal.length}.`);
      t.cierto(zAlerta.length === 4, `var(--z-alerta) debe usarse en #vgl-modal, #vgl-pym-modal, #vgl-pes-modal y #vgl-labsv-modal (4 sitios). Salieron ${zAlerta.length}.`);
      // v14.0.0 (T7) — el banner PyM superior ya tiene consumidor real.
      t.cierto(zBanner.length === 1, `var(--z-banner) debe usarse en #vgl-pym-banner (1 sitio, T7). Salieron ${zBanner.length}.`);

      // Orden relativo exigido por D6, verificado sobre los valores reales de los tokens (no solo
      // que existan): las alertas SIEMPRE deben poder ganarle a los modales de flujo.
      const valorToken = (nombre) => {
        const m = new RegExp(`--${nombre}:(\\d+)`).exec(css);
        return m ? Number(m[1]) : null;
      };
      t.cierto(valorToken("z-alerta") > valorToken("z-modal"), "una alerta (PES/fraude/PyM/labs vencidos) debe ganarle SIEMPRE a un modal de flujo (agendar/ordenar/labs) si algún día llegan a coexistir en pantalla");
      t.cierto(valorToken("z-modal") > valorToken("z-panel"), "un modal debe ganarle al panel/dock");
      t.cierto(valorToken("z-panel") > valorToken("z-banner"), "el panel debe ganarle al banner de PyM (T7, aún no existe)");
      t.cierto(valorToken("z-banner") > valorToken("z-widget"), "el banner debe ganarle al dock de widgets (T5, aún no existe)");
    });

    // v14.0.0 (T8) — Regla K (dirigida, no genérica): repite exactamente el bug ya
    // documentado en v12.6.6/v12.10.2 (#vgl-postcita-panel/#vgl-labsv-modal), esta vez en
    // #vgl-pym-banner: la entrada "simple" de la lista de escudos
    // (`#vgl-pym-banner span,#vgl-pym-banner b{color:inherit}`, especificidad id+tag) le
    // ganaba en cascada a `.vgl-pymb-contador{color:var(--bg-solid)}` (especificidad de 1
    // clase), dejando el contador con el color heredado del banner en vez del suyo propio
    // — invisible sobre su fondo ámbar. Detectado por auditoría real de contraste WCAG en
    // Chromium (ratio 1.5/2.64, ambos bajo el mínimo AA de 4.5), no por esta suite: el
    // harness de pruebas no aplica cascada CSS real. El fix fue quitar la entrada simple y
    // apoyarse solo en la armadura segura `:where(span:not([class]),...)`, que por
    // construcción nunca compite con un elemento que ya tiene su propia clase. Esta regla
    // ancla que esa entrada insegura no vuelva: cualquier regla dentro de #vgl-pym-banner
    // que fije 'color' sobre span/b SIN exigir una clase propia, con especificidad >= la de
    // .vgl-pymb-contador, es exactamente la reincidencia del bug.
    t.caso("Regla K - el contador del banner PyM no pierde su color propio contra el escudo del banner", () => {
      const contador = reglasCss.find((r) => r.selector === ".vgl-pymb-contador" && r.props.has("color"));
      t.cierto(!!contador, "existe una regla .vgl-pymb-contador que fija 'color' (si esto falla, el selector cambió de forma y hay que revisar a mano)");

      const escudosPeligrosos = reglasCss.filter((r) => {
        if (!r.props.has("color")) return false;
        if (!r.selector.includes("#vgl-pym-banner")) return false;
        if (r.selector.includes(":where(")) return false; // la armadura segura, no compite por diseño
        const tagPelado = /(^|[\s>+~])(span|b|small|label|p)(\[|:|\.|$|[\s>+~])/.test(r.selector) && !r.targetClasses.has("vgl-pymb-contador");
        return tagPelado;
      });

      for (const r of escudosPeligrosos) {
        t.cierto(r.specificity < contador.specificity, `la regla '${r.selector}' (especificidad ${r.specificity}) NO debe igualar/superar a '.vgl-pymb-contador' (especificidad ${contador.specificity}) fijando 'color' — es la reincidencia exacta del bug v12.6.6/v12.10.2/T8 que dejaba el contador ilegible`);
      }
    });

    // v14.0.0 — Regla L: todo contenedor que cuelgue de document.body debe traer su
    // PROPIO fondo opaco. Bug real encontrado en la verificación en Chromium del release
    // unificado, y que la auditoría T8 NO cazó porque su página de prueba tenía el lienzo
    // oscuro — es decir, midió justo la combinación que no ocurre en producción.
    //
    // El mecanismo: --surface-1/2/3 son VELOS (~92% transparentes, ver §4.3 del
    // superprompt: "tarjeta"), pensados para ir SOBRE el --bg opaco que paga #vgl-root.
    // Un contenedor pegado a document.body no tiene ese --bg debajo, así que con
    // `background:var(--surface-2)` a secas su fondo real es EL QUE PINTE EVEREST. En tema
    // oscuro sobre una pantalla clara del EHR, el texto --fg casi blanco caía a contraste
    // 1.05 (invisible); y en el banner, por ser position:sticky, al hacer scroll las filas
    // clínicas de Everest se leían A TRAVÉS de él, sobreimpresas sobre el aviso de PyM.
    //
    // Esta regla es DIRIGIDA (no genérica): fija los contenedores de nivel body conocidos
    // y exige que su declaración de background mencione un token opaco (--bg-solid o --bg),
    // no solo un velo --surface-*. No intenta adivinar la opacidad real de un color: se
    // ancla al patrón concreto que causó el fallo.
    t.caso("Regla L - los contenedores pegados a document.body traen fondo opaco propio, no solo un velo --surface-*", () => {
      const CONTENEDORES_BODY = ["#vgl-acciones-dock", "#vgl-pym-banner"];
      for (const id of CONTENEDORES_BODY) {
        // Bloque base del contenedor: el selector EXACTO, sin sufijos (.perf/.light/.minimizado).
        // Se lee del CSS crudo porque el parser de esta suite solo guarda el texto de las
        // declaraciones de 'color', no el de 'background'.
        const bloque = new RegExp(`(^|\\n)\\s*\\${id}\\s*\\{([^}]*)\\}`).exec(cssClean);
        t.cierto(!!bloque, `existe el bloque base de ${id} (si falla, el selector cambió de forma y hay que revisar a mano)`);
        const decl = (bloque[2].split(";").find((d) => /^\s*background\s*:/.test(d)) || "").trim();
        t.cierto(!!decl, `el bloque base de ${id} debe declarar 'background' explícitamente`);
        t.cierto(/var\(--bg-solid\)|var\(--bg\)/.test(decl),
          `${id} cuelga de document.body: su 'background' DEBE apoyarse en un token opaco (--bg-solid o --bg), no solo en un velo --surface-*, o su fondo real pasa a ser el que pinte Everest y el texto se vuelve ilegible según la pantalla del host. Declaración actual: "${decl}"`);
      }
    });

    // v14.0.0 — Regla M: los elementos que viven FUERA de las listas de contenedores con
    // tokens deben consumir cada var() CON RESERVA. Bug real reportado en consulta: el
    // botón "🩺 Normalidad fija" (#vgl-examen-normalidad) "desapareció". No estaba ausente:
    // estaba PINTADO DETRÁS de Everest. Ese botón se pega a document.body y NO está en las
    // listas de tokens (a diferencia de #vgl-examen-guardar/#vgl-examen-aplicar, que sí),
    // así que --z-widget no resuelve para él — y en CSS una declaración con una var()
    // indefinida y sin reserva es INVÁLIDA ENTERA, con lo que z-index caía a "auto" y el
    // contenido de Everest se le ponía encima. Verificado en Chromium: #vgl-lab-injector
    // (que SÍ está en las listas) resolvía z-index 2147480000 y recibía el clic; el de
    // examen físico resolvía "auto" y el clic se lo llevaba el app-root de Everest.
    // Lo introdujo la migración de z-index a tokens de D6, que dejó este literal (antes
    // 9999999) como el ÚNICO token de su regla sin reserva — color, font-family y font-size
    // sí la llevaban, y por exactamente el mismo motivo (incidente v12.6.6).
    t.caso("Regla M - la regla de los botones inyectados consume TODOS sus tokens con reserva (viven fuera de las listas)", () => {
      const bloque = /\.vgl-lab-inj\s*,\s*\.vgl-exf-btn\s*\{([^}]*)\}/.exec(cssClean);
      t.cierto(!!bloque, "existe la regla base .vgl-lab-inj,.vgl-exf-btn (si falla, el selector cambió y hay que revisar a mano)");
      const sinReserva = (bloque[1].match(/var\(--[\w-]+\)/g) || []);
      t.cierto(sinReserva.length === 0,
        `#vgl-examen-normalidad NO está en las listas de contenedores con tokens, así que toda var() de esta regla necesita valor de reserva —var(--x, valor)— o la declaración entera queda inválida para ese botón y desaparece detrás de Everest. Sin reserva: ${sinReserva.join(", ")}`);
    });

    // v14.0.0 — Guarda del pie: el bloque CSS vive dentro de un template literal de JS, así
    // que un backtick suelto (por ejemplo en un comentario que cite `código`) NO rompe solo
    // un estilo: cierra la plantilla y tumba el archivo ENTERO con SyntaxError — el médico
    // se queda sin script. Pasó dos veces el mismo día escribiendo estos comentarios.
    // `node -c` y el propio runner ya lo cazan, pero esta prueba lo dice por su nombre en
    // vez de fallar con un error de sintaxis críptico a 13.000 líneas de distancia.
    t.caso("Regla N - ningún backtick suelto dentro del bloque CSS (cierra el template literal y tumba el archivo)", () => {
      const lineas = code.split("\n");
      const ini = lineas.findIndex((l) => l.includes("style.textContent = `"));
      t.cierto(ini >= 0, "se encontró el inicio del bloque CSS");
      const fin = lineas.findIndex((l, i) => i > ini && l.includes("`;"));
      t.cierto(fin > ini, "se encontró el cierre del bloque CSS");
      const culpables = [];
      for (let i = ini + 1; i < fin; i++) if (lineas[i].includes("`")) culpables.push(`${i + 1}: ${lineas[i].trim().slice(0, 60)}`);
      t.cierto(culpables.length === 0, `Backtick dentro del bloque CSS — cierra el template literal y rompe el archivo entero. Líneas: ${culpables.join(" | ")}`);
    });

    // v14.0.5 — Regla O: el piso de contraste de --fg3 se COMPRUEBA, no se declara.
    // INFORME_AUDITORIA_T8.md midió 4.11 en Chromium real para .vgl-dock-toggle en tema
    // claro (bajo el mínimo AA de 4.5) y dejó la corrección como decisión del médico,
    // anotando que debía ser global (el token) y no un parche a un solo selector — porque
    // --fg3 lo comparten ~30 usos, .vgl-toast-x entre ellos.
    //
    // Esta prueba calcula el ratio WCAG 2.x DE VERDAD (linealización sRGB + composición
    // alpha), leyendo los valores del propio CSS en vez de fiarse de un número escrito a
    // mano: si alguien vuelve a aclarar --fg3, o oscurece --bg-solid, o sube la opacidad
    // del velo --bg3 del dock, el ratio se recalcula solo y la prueba cae. Es la única
    // guarda de contraste automática del banco; el resto de la auditoría T8 fue manual y
    // no puede reproducirse aquí (el arnés no aplica cascada ni layout reales).
    t.caso("Regla O - el token --fg3 cumple el mínimo AA (4.5:1) sobre el fondo del dock en AMBOS temas", () => {
      const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const ratio = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
      const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      // Composición alpha estándar: color con opacidad `a` pintado SOBRE `bg`.
      const sobre = (fg, a, bg) => fg.map((c, i) => a * c + (1 - a) * bg[i]);

      // Los tokens se leen del CSS real. Si un selector/-token cambia de forma, la prueba
      // dice explícitamente que hay que revisarla a mano en vez de dar un falso verde.
      const leerToken = (bloqueRe, token) => {
        const bloque = bloqueRe.exec(cssClean);
        if (!bloque) return null;
        const m = new RegExp(`--${token}\\s*:\\s*([^;]+);`).exec(bloque[0]);
        return m ? m[1].trim() : null;
      };
      const REclaro = /#vgl-root\.light[^{]*\{[\s\S]*?\}/;
      // El bloque oscuro es el de la MISMA lista de contenedores pero sin `.light`.
      const REoscuro = /(^|\n)\s*#vgl-root,#vgl-lab-injector[^{]*\{[\s\S]*?\}/;

      const fg3Claro = leerToken(REclaro, "fg3");
      const bgSolidClaro = leerToken(REclaro, "bg-solid");
      const bg3Claro = leerToken(REclaro, "bg3");
      t.cierto(!!fg3Claro && !!bgSolidClaro && !!bg3Claro,
        `se leyeron --fg3/--bg-solid/--bg3 del bloque de tema claro (si esto falla, el bloque cambió de forma y hay que revisar el contraste A MANO, no borrar esta prueba). fg3=${fg3Claro} bgSolid=${bgSolidClaro} bg3=${bg3Claro}`);

      // El dock apila el velo --surface-2 (= --bg3) SOBRE --bg-solid; ver #vgl-acciones-dock.
      const mAlpha = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(bg3Claro);
      t.cierto(!!mAlpha, `--bg3 del tema claro sigue siendo un rgba() con alpha (leído: ${bg3Claro})`);
      const veloClaro = [Number(mAlpha[1]), Number(mAlpha[2]), Number(mAlpha[3])];
      const fondoDockClaro = sobre(veloClaro, Number(mAlpha[4]), hex(bgSolidClaro));

      const rClaro = ratio(hex(fg3Claro), fondoDockClaro);
      t.cierto(rClaro >= 4.5,
        `tema CLARO: --fg3 (${fg3Claro}) sobre el fondo del dock da ${rClaro.toFixed(2)}:1, por debajo del mínimo AA de 4.5:1. Es exactamente la regresión que T8 midió en Chromium (4.11) y que se corrigió subiendo el token — oscurezca --fg3, no parchee un selector suelto.`);

      // Tema oscuro: el mismo token, el mismo dock, la otra piel. Nunca estuvo mal (6.87),
      // pero un cambio de --bg-solid oscuro podría romperlo sin que nadie mirara.
      const fg3Oscuro = leerToken(REoscuro, "fg3");
      const bgSolidOscuro = leerToken(REoscuro, "bg-solid");
      const bg3Oscuro = leerToken(REoscuro, "bg3");
      // Se comprueba que se LEYERON, en vez de envolver todo en un `if` que se saltaría en
      // silencio y daría verde sin haber medido nada (le pasó a la primera versión de esta
      // prueba: el selector del bloque oscuro no casaba y la rama entera no se ejecutaba).
      const mO = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(bg3Oscuro || "");
      t.cierto(!!fg3Oscuro && !!bgSolidOscuro && !!mO,
        `se leyeron --fg3/--bg-solid/--bg3 del bloque de tema OSCURO (si falla, el bloque cambió de forma: revise el contraste a mano, no borre la prueba). fg3=${fg3Oscuro} bgSolid=${bgSolidOscuro} bg3=${bg3Oscuro}`);
      const fondoDockOscuro = sobre([Number(mO[1]), Number(mO[2]), Number(mO[3])], Number(mO[4]), hex(bgSolidOscuro));
      const rOscuro = ratio(hex(fg3Oscuro), fondoDockOscuro);
      t.cierto(rOscuro >= 4.5,
        `tema OSCURO: --fg3 (${fg3Oscuro}) sobre el fondo del dock da ${rOscuro.toFixed(2)}:1, bajo el mínimo AA de 4.5:1`);

      // Jerarquía: --fg3 debe seguir siendo MÁS CLARO que --fg2 en tema claro. Si al subir
      // el contraste alguien lo oscurece de más, --fg3 dejaría de leerse como texto muteado
      // y el panel perdería su escala de énfasis — un arreglo de contraste no debe pagarse
      // rompiendo la jerarquía visual.
      const fg2Claro = leerToken(REclaro, "fg2");
      const mF2 = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(fg2Claro || "");
      t.cierto(!!mF2, `se leyó --fg2 del tema claro como rgba() (leído: ${fg2Claro})`);
      const fg2Compuesto = sobre([Number(mF2[1]), Number(mF2[2]), Number(mF2[3])], Number(mF2[4]), fondoDockClaro);
      const rFg2 = ratio(fg2Compuesto, fondoDockClaro);
      t.cierto(rClaro < rFg2,
        `--fg3 (${rClaro.toFixed(2)}:1) quedó igual o MÁS contrastado que --fg2 (${rFg2.toFixed(2)}:1): se invirtió la jerarquía de énfasis del panel`);
    });

  }
};
