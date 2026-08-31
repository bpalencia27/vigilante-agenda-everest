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
    // en ese formato: la suite quedaba en verde sin verla. El filtro se quitó y hoy la
    // regla exige CERO declaraciones de color sin !important (ver la reconciliación
    // v17.6.83+ dentro del caso).
    t.caso("Regla E - color con selector de PANEL fuera de #vgl-root lleva !important", () => {
      // v17.6.83+ — el panel rediseñado expandió el CSS de los modales con muchas
      // declaraciones NO de color (bordes, fondos, grid, padding…) sin !important. La
      // regla del proyecto (y el nombre de esta prueba) es SOLO sobre `color`: fuera de
      // #vgl-root, el CSS de Everest es una caja negra que puede ganarle a una
      // declaración de color de clase sin !important. Hasta v17.6.82 la hoja solo tenía
      // color en ese conjunto (74 entradas conocidas); hoy producción tiene CERO.
      // La auditoría queda MÁS fuerte: cualquier regla de color NUEVA en un selector de
      // panel sin !important rompe la suite. Las ~718 declaraciones no-color del panel
      // quedan fuera de alcance a propósito (son propiedades que Everest no pisa).
      const paneles = [
        '#vgl-pym-modal', '#vgl-pes-modal', '#vgl-labs-modal',
        '#vgl-labsv-modal', '#vgl-postcita-panel', '#vgl-agendar-modal', '#vgl-ordenar-modal',
        '#vgl-paquete-modal', '#vgl-chooser-modal'
      ];

      const infracciones = new Set();
      for (const r of reglasCss) {
        if (paneles.some(p => r.selector.includes(p))) {
          if (r.selector.includes(':where(')) continue;
          for (const cd of r.decls) {
            const normDecl = cd.replace(/\s+/g, ''); // "color:var(--c-azul)"
            if (normDecl.indexOf('color:') !== 0) continue;   // la regla es de COLOR, no de todo el bloque
            if (cd.includes('!important')) continue;
            const normSel = r.selector.trim().replace(/\s+/g, ' ');
            infracciones.add(`${normSel}|${normDecl}`);
          }
        }
      }

      const arrInfracciones = Array.from(infracciones).sort();
      t.cierto(arrInfracciones.length === 0,
        `Cero declaraciones de color sin !important en selectores de panel. Salieron ${arrInfracciones.length}: ${arrInfracciones.slice(0, 5).join(' | ')}`);
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
      // v15.1.0 (M1) — normalización exhaustiva: todas las declaraciones de font-size literales
      // migran a la escala oficial de tokens (--t-micro: 48, --t-body: 14, --t-lead: 6).
      t.cierto(microUsos.length >= 48, `var(--t-micro) debe aparecer en la escala. Salieron ${microUsos.length}.`);
      t.cierto(bodyUsos.length >= 14, `var(--t-body) debe aparecer en la escala. Salieron ${bodyUsos.length}.`);
      t.cierto(leadUsos.length >= 6, `var(--t-lead) debe aparecer 6 veces (base 5 + .vgl-dock-btn de T5; el banner no usa --t-lead). Salieron ${leadUsos.length}.`);

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
      // v15.0.0: 158 -> 160. Los 2 nuevos son de `.vgl-agm-pbtn-sabado-suyo`
      // (border-style y border-color), el chip del sábado que SÍ le toca a este
      // médico. Necesitan !important por una razón concreta y comprobable: la
      // regla que los pisa es `.vgl-agm-pbtn-sabado`, declarada ANTES en la misma
      // hoja y con la misma especificidad (una clase). Sin !important el borde
      // punteado de "por confirmar" ganaría por orden de aparición y el médico
      // vería como dudoso un sábado que el script ya sabe que es suyo.
      // v15.6.0+ / v16 / v17 — el total sube con cada módulo que cuelga de document.body
      // (Regla E: !important obligatorio fuera de #vgl-root). Desde la v15.3 (161) hasta la
      // v17.6.x llegaron: guía paso a paso (burbuja y botones), dock de acciones v17.5 (7
      // botones), panel del paciente v16.8 (5 secciones + cabecera), redactor IA v17.1
      // (botones por casilla), tablero de telemetría, barra de ajustes y los modales de
      // agendar/ordenar/labs con sus variantes — 161 -> 307.
      // v17.6.3 (E2E visual en Chromium real, hostil por delante): 307 -> 310.
      // Tres huecos de blindaje que el CSSOM confirmó sin regla ganadora: botones .sec
      // y .pri (las reglas base no llevaban la marca) y #vgl-head (no declaraba color).
      // Los kicker/sub del modal IA se añadieron a listas que YA llevaban la marca, así
      // que no cambian el censo. Mismo bug #2 del CLAUDE.md, variante "sin regla propia".
      // v17.6.4 (E2E real reproducido con hostil por delante, reporte del médico en
      // consulta): 310 -> 333. El Resumen del turno (#vgl-sheet, DENTRO de #vgl-root)
      // quedó fuera del blindaje id-por-id y el hostil le ganaba a TODO el texto:
      // título, labels/hints de .vgl-fld, KPIs (número y rótulo), leyenda, cap del
      // gráfico, conteos, etiquetas de barras, campos y botones .vgl-btn (+variantes
      // .primary/.on/.off), la base de #vgl-root y #vgl-sheet, y el .vgl-sb-btn.primary.
      // 23 declaraciones de color nuevas con !important; el CSSOM confirmó 0 fugas de
      // rgb(31,78,121) en ambos temas. El cableado tipográfico de ESTA regla no añade
      // ninguno.
      // v17.6.5 (mejoras de turno largo, auditoría UX 2026-08-23): 333 -> 342.
      // +9 de la cabecera y el modo alto contraste: 2 del botón .vgl-tl.hc, 1 de su
      // estado .active, 2 del reloj #vgl-clock (base y .vgl-stale) y 4 del modo .vgl-hc
      // (fondo sólido + 2 backdrop-filter + el ::before oculto). Mismo patrón que el
      // resto: la cabecera y el panel viven dentro de #vgl-root, y el dock/banner/toasts
      // cuelgan de document.body (Regla E).
      // v17.6.7 (cierre de turno): 342 -> 345. +3 del badge de inasistencias previas
      // (.vgl-cd.vgl-adh: background y color + la variante .light).
      // v17.6.11 (Redacción IA S+): 345 -> 347. +2 del contador de palabras del borrador
      // (#vgl-ia-modal .vgl-ia-meta: color y su <b> verde).
      // v17.6.18 (reporte de campo, 24-ago-2026: "el cronómetro no le encontré utilidad"
      // — se retira por completo): 350 -> 347. -3 del cronómetro del paciente en sala
      // (.vgl-cd.vgl-cron: background y color + la variante .light), que ya no existe.
      // v17.6.24 (auditoría S+ del Redactor IA, 24-ago-2026): 347 -> 349. +2 de
      // .vgl-agm-btn.sec.active (background y box-shadow) — el botón «❓ Preguntar sobre
      // este paciente» del Redactor IA vive dentro de #vgl-ia-modal (colgado de
      // document.body, Regla E) y antes NO tenía ninguna regla .active: el clic sí cambiaba
      // de modo pero no se veía seleccionado, como si el clic no hubiera hecho efecto.
      // v17.6.83–v17.56.0 (línea de producción) — 349 -> 437 (+88): el panel del paciente
      // rediseñado (5 secciones + cabecera), las burbujas de información del Redactor IA,
      // los modales de flujo y sus variantes .light, el aviso de versión y los chips del
      // nuevo tablero — todo colgado de document.body, así que la Regla E exige su
      // !important. Censo verificado sobre la hoja real de producción.
      // REFACTOR S+ del Panel (30-ago, aprobado en canvas) — 437 -> 445 (+8): el kicker
      // esmeralda (#vgl-panel-modal .vgl-agm-title.vgl-agm-kicker), la pestaña activa
      // (.vgl-panel-tab.active: background y color + border-color), el punto de estado
      // (.vgl-panel-dot base + sus variantes ok/pend/nd) y la fila «grave» de las metas
      // (.vgl-meta-fila.grave .vgl-meta-act). Censo verificado sobre la hoja real.
      // REFACTOR S+ de Laboratorios (30-ago) — 445 -> 449 (+4): el icono de origen
      // (.vgl-labs-srclbl svg), el chip «En línea» (.vgl-labs-srconline), el botón de
      // informe (.vgl-labs-pdf) y el año compacto de la fecha (.vgl-labs-date small) —
      // identidad índigo, Regla E. Censo verificado.
      // REFACTOR S+ de Ordenamiento/Control (30-ago) — 449 -> 465 (+16): el modal
      // «Próximo control» (#vgl-paquete-modal) cuelga de document.body, así que sus 14
      // declaraciones de color llevan !important por Regla E, más el par de
      // animation/transition del bloque reduced-motion. Censo verificado.
      // REFACTOR S+ del menú de elección (30-ago) — 465 -> 472 (+7): los escudos de color
      // de #vgl-paquete-modal (sub/close) y #vgl-chooser-modal (title/sub/close/chooser-t/
      // chooser-d) y el par animation/transition del reduced-motion del chooser.
      // REFACTOR S+ del aviso universal (30-ago) — 473 -> 475 (+2): el modal «Pendientes
      // de este paciente» (aviso al abrir la historia por primera vez) pasa a tarjetas de
      // sección (.vgl-pym-sec-t con su acento por variante y .vgl-pym-sec-b), cuyos colores
      // cuelgan de document.body (Regla E) y llevan !important.
      // =====================================================================
      // v18.0.14 — BLINDAJE COMPLETO DE color: 475 -> 635 (+160 en la hoja que mide
      // esta suite; 248 contando también las hojas interpoladas que ella no resuelve).
      //
      // El médico reportó (31-ago) que «el CSS de Everest se mezcla». Yo lo descarté con
      // una medición MAL HECHA: mi analizador solo contaba reglas cuyo selector llevara un
      // id de módulo (#vgl-…), y así se me escaparon las reglas de SOLO CLASE (.vgl-agm-sub
      // b, .vgl-uro-badge, .vgl-chip…), que son las más numerosas y viven dentro de todos
      // los módulos a la vez. Una medición en Chromium con el Everest hostil que prescribe
      // CLAUDE.md lo dejó sin discusión:
      //     · en el panel: 46 de 58 nodos de texto perdían su color (mediana 1,62:1);
      //     · en Laboratorios: el DOCUMENTO DEL PACIENTE y el rótulo «Función renal:»
      //       quedaban literalmente invisibles en tema oscuro (1,03:1 y 1,04:1).
      // Tenía razón él, y el censo real era de 125 declaraciones secuestrables, no una.
      //
      // Se blindan TODAS las declaraciones de `color` de la hoja. Censo posterior: 501
      // declaraciones de color, 0 expuestas — las únicas sin !important son el blindaje
      // tipográfico `:where(… :not([class])){color:inherit}`, que debe seguir SIN él
      // (especificidad cero a propósito: ver CLAUDE.md, bug #1 del botón ámbar T1).
      //
      // Comprobado antes de barrer, porque era el riesgo real: `grep "style.color ="`
      // devuelve CERO en todo el archivo, así que ningún !important nuestro puede pisar un
      // color que el script pinte a mano. Regla B de esta misma suite cubre el caso del
      // estilo en línea dentro del HTML.
      // =====================================================================
      const importantTotal = (css.match(/!important/g) || []).length;
      t.cierto(importantTotal === 644, `El total de !important en la hoja no debe cambiar por este cableado, salvo el interruptor .perf de T5, los 6 del recuadro renal de R1b, los 2 del chip de sábado propio de v15, el 1 del marcador "prioritario" del PyM de v15.3, los 3 del blindaje v17.6.3 (.sec, .pri, #vgl-head), los 23 del blindaje v17.6.4 del Resumen del turno (#vgl-sheet y .vgl-btn), los 9 del v17.6.5 (reloj de cabecera, botón de alto contraste y modo .vgl-hc), los 3 del badge de inasistencias del v17.6.7 (.vgl-adh), los 2 del contador de palabras del v17.6.11 (.vgl-ia-meta), los 2 del botón «Preguntar» activo del v17.6.24 (.vgl-agm-btn.sec.active), los 88 de la línea v17.6.83–v17.56.0, los 8 del REFACTOR S+ del Panel, los 4 del REFACTOR S+ de Laboratorios, los 16 del REFACTOR S+ de Ordenamiento/Control, los 8 del REFACTOR S+ del menú de elección y los 2 del REFACTOR S+ del aviso universal (esperado 644 tras el blindaje completo de color de la v18.0.14, salió ${importantTotal})`);
    });

    // [auditoría 25-ago, hallazgo 1.22] _pintarCriticos (la caja roja de "faltan datos" del
    // Redactor IA) pinta con <div style="..."> SIN clase propia dentro de #vgl-ia-modal. El
    // blindaje tipográfico (:where(...:not([class]))) solo cubría span/b/small/label/p, no
    // div — una regla de Everest de mayor peso para div{color:X} podía ganar por herencia y
    // dejar ilegible la caja que bloquea generar la nota sin categoría de riesgo.
    t.caso("Regla I - #vgl-ia-modal blinda también los <div> sin clase propia (1.22)", () => {
      const linea = (css.split("\n")).find((l) => l.includes("#vgl-ia-modal :where("));
      t.cierto(!!linea, "debe existir la regla de blindaje tipográfico para #vgl-ia-modal");
      t.cierto(!!linea && linea.includes("div:not([class])"),
        "debe incluir div:not([class]) — _pintarCriticos pinta con <div style=\"...\"> sin clase propia: " + linea);
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
      t.cierto(strongUsos.length >= 4, `var(--t-strong) debe aparecer en la escala. Salieron ${strongUsos.length}.`);
      t.cierto(titleUsos.length >= 4, `var(--t-title) debe aparecer en la escala. Salieron ${titleUsos.length}.`);
      t.cierto(heroUsos.length >= 6, `var(--t-hero) debe aparecer en la escala. Salieron ${heroUsos.length}.`);

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
      // 1 sitio (.vgl-lab-inj,.vgl-exf-btn) -> 2 sitios. v15.6.0 — #vgl-acomp-burbuja (la
      // burbuja de la guía paso a paso) y v17.1.0 — .vgl-ia-inj (botones de redacción IA)
      // comparten la misma capa de widget: 2 -> 3 sitios.
      // v17.6.83+ — la línea de producción suma 3 sitios más en la misma capa: los
      // sugeridores de la Ficha del paciente (#vgl-cw-examenes, #vgl-cw-farmaco) y el
      // botón/panel de ordenamiento de la consulta: 3 -> 6.
      t.cierto(zWidget.length === 6, `var(--z-widget) debe usarse en .vgl-lab-inj,.vgl-exf-btn,.vgl-ia-inj, #vgl-acciones-dock, #vgl-acomp-burbuja y los sugeridores de la Ficha (6 sitios). Salieron ${zWidget.length}.`);
      // v15.6.0 — la regla nueva de los modales de flujo (riesgo, IA, datos, ficha, tablero,
      // confirmar, panel, llenar) comparte la misma capa: 1 selector compuesto -> 2 sitios.
      t.cierto(zModal.length === 2, `var(--z-modal) debe usarse en #vgl-agendar-modal,#vgl-ordenar-modal,#vgl-labs-modal y en la lista de modales de flujo de v15.6.0 (2 sitios). Salieron ${zModal.length}.`);
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
      // v17.1.0 — el selector base se amplió a .vgl-ia-inj (botones de redacción IA por casilla).
      const bloque = /\.vgl-lab-inj\s*,\s*\.vgl-exf-btn\s*,\s*\.vgl-ia-inj\s*\{([^}]*)\}/.exec(cssClean);
      t.cierto(!!bloque, "existe la regla base .vgl-lab-inj,.vgl-exf-btn,.vgl-ia-inj (si falla, el selector cambió y hay que revisar a mano)");
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

    // v17.6.41 — AUDITORÍA S+ (barrido total, 24-ago-2026): .vgl-toast-rail se crea en JS
    // (el <i class="vgl-toast-rail"> de cada toast) pero nunca tuvo regla base de CSS —
    // sin width/height, la franja de color que distingue el tipo de aviso (rojo/verde/
    // ámbar/azul) era invisible. De paso, .vgl-toast-ic declaraba box-shadow DOS veces (la
    // segunda, plana, pisaba el anillo de acento --tk de la primera) y .vgl-toast-b
    // declaraba font-size DOS veces (la primera, 12.5px fija, era código muerto).
    t.caso("v17.6.41: .vgl-toast-rail tiene una regla base real (no queda invisible)", () => {
      t.cierto(/\.vgl-toast-rail\{width:/.test(css), ".vgl-toast-rail debe tener un ancho propio, no depender solo del inline style de color");
    });

    t.caso("v17.6.41: .vgl-toast-ic ya no pisa su propio anillo de acento con un box-shadow duplicado", () => {
      const idx = css.indexOf(".vgl-toast-ic{");
      const bloque = css.slice(idx, css.indexOf("}", idx) + 1);
      const ocurrencias = (bloque.match(/box-shadow:/g) || []).length;
      t.igual(ocurrencias, 1, "una sola declaración de box-shadow en .vgl-toast-ic (la que trae el anillo --tk)");
      t.cierto(/box-shadow:var\(--glow-edge\),inset/.test(bloque), "debe sobrevivir la versión CON el anillo --tk, no la plana");
    });

    t.caso("v17.6.41: .vgl-toast-b ya no declara font-size dos veces", () => {
      const idx = css.indexOf(".vgl-toast-b{");
      const bloque = css.slice(idx, css.indexOf("}", idx) + 1);
      const ocurrencias = (bloque.match(/font-size:/g) || []).length;
      t.igual(ocurrencias, 1, "una sola declaración de font-size en .vgl-toast-b");
    });


    // =====================================================================
    // v18.0.14 — REGLA P: EL BLINDAJE COMPLETO, MEDIDO COMO REGLA Y NO COMO NÚMERO
    //
    // La Regla E solo mira selectores que NOMBRAN un id de panel (#vgl-pym-modal…). Ese
    // punto ciego está declarado arriba desde v12.10.12 — y es exactamente por donde se
    // coló el problema que el médico reportó el 31-ago: las reglas de SOLO CLASE
    // (.vgl-agm-sub b, .vgl-uro-badge, .vgl-chip-mas…) viven dentro de todos los módulos
    // a la vez y ninguna prueba las miraba. Yo las descarté con una medición mal hecha
    // (mi analizador exigía el id en el selector, así que contaba 1 infracción donde
    // había 125). Chromium con el Everest hostil de CLAUDE.md lo zanjó: 46 de 58 nodos
    // de texto del panel perdían su color, y en Laboratorios el documento del paciente y
    // el rótulo «Función renal:» quedaban invisibles (1,03:1 y 1,04:1).
    //
    // Esta regla no admite punto ciego: recorre TODA la hoja, sin filtrar por selector.
    // CERO declaraciones de color sin !important, sin excepción — ni siquiera el blindaje
    // tipográfico. Eso corrige lo que yo mismo tenía mal: creía que el blindaje debía
    // quedarse sin !important «por tener especificidad cero», y esa lectura confundía DOS
    // defensas distintas. La que importa contra el bug #1 (nuestra regla vieja gana a
    // nuestra clase nueva, botón ámbar T1 / v12.10.2) es el `:not([class])`, no la falta
    // de !important: con él, el blindaje y cualquier clase de acento nuestra son DISJUNTOS
    // por construcción — jamás alcanzan al mismo elemento, así que no pueden competir.
    // Sin !important, en cambio, el blindaje sí perdía contra Everest, que es el adversario
    // real: escrito `:where(#vgl-cw-examenes :not([class])){color:inherit}` el id queda
    // DENTRO del :where() y la regla vale (0,0,0) — la gana cualquier `span{color:X}` de
    // Everest. Por eso en v18.0.14 los cuatro blindajes que estaban en esa forma pasan a la
    // forma fuerte (id FUERA del :where(), como el blindaje general de v12.3.15 ya hacía)
    // y ganan !important.
    //
    // Lo que esta prueba vigila en la otra dirección es esa condición de disyunción: un
    // blindaje con !important SOLO es seguro mientras cada rama de su :where() lleve
    // :not([class]). Si alguien la quitara, la regla pasaría a alcanzar elementos CON clase
    // y, con (1,0,x) + !important, aplastaría todos nuestros acentos — el bug #1 otra vez,
    // ahora blindado. Se comprueba explícitamente.
    //
    // Regla E se queda: es más barata de leer y da un mensaje de error más concreto
    // cuando lo que se rompe es un panel. Esta es la red de abajo.
    // =====================================================================
    t.caso("Regla P - TODA declaración de color de la hoja lleva !important, blindaje incluido", () => {
      const expuestas = [];
      for (const r of reglasCss) {
        for (const cd of r.decls) {
          const norm = cd.replace(/\s+/g, '');
          if (norm.indexOf('color:') !== 0) continue;   // solo `color`, no background-color ni border-color
          if (cd.includes('!important')) continue;
          expuestas.push(`${r.selector.trim().replace(/\s+/g, ' ')} {${norm}}`);
        }
      }

      t.igual(expuestas.length, 0,
        `Cero declaraciones de color sin !important en TODA la hoja (Everest es una caja negra: una clase sin !important pierde contra cualquier regla suya de especificidad >= 10, y contra cualquiera con !important sea cual sea su especificidad). Expuestas: ${expuestas.length}${expuestas.length ? " — " + expuestas.slice(0, 6).join(' | ') : ""}`);

      // La otra dirección: la condición que hace SEGURO ese !important en el blindaje es
      // que siga siendo disjunto de nuestras clases. Cada rama del :where() debe llevar
      // :not([class]); si una la pierde, la regla alcanza elementos CON clase y, con
      // (1,0,x)+!important, aplasta todos los acentos propios (bug #1, ahora blindado).
      //
      // Se recorre el CSS CRUDO, no `reglasCss`: el extractor de esta suite parte los
      // selectores por comas — incluidas las comas de DENTRO de un :where() — así que sus
      // entradas traen fragmentos con paréntesis sin cerrar (#vgl-root :where(span:not([class]))
      // y una comprobación hecha sobre ellos se cuela sin ver nada. Verificado con una
      // mutación: escrita así, quitarle el :not([class]) a una rama NO ponía la prueba en
      // rojo. Por eso esta mitad no usa reglasCss.
      const cuerposWhere = (texto) => {
        const fuera = [];
        for (let i = texto.indexOf(':where('); i >= 0; i = texto.indexOf(':where(', i + 1)) {
          let prof = 1, j = i + ':where('.length;
          for (; j < texto.length && prof > 0; j++) {
            if (texto[j] === '(') prof++;
            else if (texto[j] === ')') prof--;
          }
          if (prof === 0) fuera.push(texto.slice(i + ':where('.length, j - 1));
        }
        return fuera;
      };
      const ramasNivel0 = (cuerpo) => {
        const partes = []; let prof = 0, act = '';
        for (const ch of cuerpo) {
          if (ch === '(') prof++;
          else if (ch === ')') prof--;
          if (ch === ',' && prof === 0) { partes.push(act); act = ''; continue; }
          act += ch;
        }
        partes.push(act);
        return partes.map(x => x.trim()).filter(Boolean);
      };

      const cuerpos = cuerposWhere(cssClean);
      t.cierto(cuerpos.length >= 27, `el blindaje tipográfico sigue en la hoja (se esperaban >= 27 usos de :where(), se hallaron ${cuerpos.length})`);

      const ramasSinGuarda = [];
      for (const cuerpo of cuerpos) {
        for (const rama of ramasNivel0(cuerpo)) {
          if (!rama.includes(':not([class])')) ramasSinGuarda.push(rama);
        }
      }
      t.igual(ramasSinGuarda.length, 0,
        `toda rama de un :where() del blindaje debe llevar :not([class]) (es lo que lo mantiene disjunto de nuestras clases de acento). Sin guarda: ${ramasSinGuarda.slice(0, 5).join(' | ')}`);
    });

    // v18.0.14 — la contraprueba de que no barrí de más: si el script pintara colores a
    // mano desde JS (el.style.color = …), un !important nuestro en la hoja ganaría a ese
    // estilo en línea y le apagaría el color dinámico. Comprobado antes de barrer y
    // cableado aquí para que siga siendo cierto: CERO asignaciones a .style.color.
    t.caso("v18.0.14: ningún color se pinta desde JS con .style.color (o el !important lo apagaría)", () => {
      const asignaciones = (code.match(/\.style\.color\s*=/g) || []).length;
      t.igual(asignaciones, 0,
        "el !important de la Regla P gana al estilo en línea; si alguien empieza a pintar color desde JS, hay que blindar ese caso a mano (Regla B cubre el estilo en línea escrito dentro del HTML)");
    });


    // =====================================================================
    // v18.0.14 — REGLA Q: UN COMENTARIO QUE SE CIERRA ANTES DE TIEMPO SE COME LA REGLA
    //            QUE VIENE DETRÁS
    //
    // Encontrado midiendo en Chromium, no leyendo: la regla raíz del widget de Fármacos
    // (#vgl-cw-farmaco{position;z-index;font-family;max-width:320px}) NO se aplicaba. La
    // causa estaba cinco líneas más arriba, en un comentario que documentaba las clases
    // del panel escribiéndolas con comodín: «(.vgl-mtr-*/.vgl-dup-*)». Ese «*/» del medio
    // CIERRA el comentario ahí mismo — el analizador de CSS se queda con el PRIMER «*/»,
    // no con el que el autor tenía en la cabeza. Lo que seguía («cuyo CSS se extiende más
    // abajo…») pasaba a leerse como selector, y el analizador seguía tragando hasta poder
    // recuperarse: la regla siguiente entera se perdía. Vivo desde la v17.24.0.
    //
    // Es la misma familia que la Regla N (un backtick suelto cierra el template literal y
    // tumba el archivo entero), pero MÁS silenciosa: aquí no hay error de sintaxis, ni en
    // JS ni en CSS. El archivo carga, el banco pasa, y una regla simplemente no existe.
    // Por eso hacen falta las dos comprobaciones:
    //   1) sintáctica — ningún cierre de comentario seguido de texto en la misma línea;
    //   2) semántica  — tras despiezar los comentarios COMO LO HACE EL ANALIZADOR (primer
    //      «*/» gana), ningún selector puede traer caracteres no ASCII. Todos nuestros
    //      selectores son ASCII puro; la prosa del proyecto es española y lleva tildes,
    //      «—» o ««»». Si aparece un selector con acentos, es prosa que se escapó de un
    //      comentario, y detrás de ella hay una regla perdida.
    // =====================================================================
    t.caso("Regla Q - ningún comentario del CSS se cierra antes de tiempo (se comería la regla siguiente)", () => {
      // (1) sintáctica: dónde CREE el analizador que termina cada comentario.
      const fugas = [];
      let i = 0;
      for (;;) {
        const a = css.indexOf("/*", i);
        if (a < 0) break;
        const b = css.indexOf("*/", a + 2);
        if (b < 0) break;
        const cierre = b + 2;
        const finLinea = css.indexOf("\n", cierre);
        const resto = css.slice(cierre, finLinea < 0 ? css.length : finLinea).trim();
        if (resto && !resto.startsWith("/*")) fugas.push(`…${css.slice(Math.max(0, cierre - 45), cierre)}  ->  ${resto.slice(0, 60)}`);
        i = cierre;
      }
      t.igual(fugas.length, 0,
        `un "*/" seguido de más texto en la misma línea casi siempre significa que el comentario se cerró donde el autor no quería (p. ej. un comodín ".vgl-algo-*/" dentro del comentario). Fugas: ${fugas.slice(0, 3).join(' || ')}`);

      // (2) semántica: despiece como el analizador (primer "*/" gana) y revisión de selectores.
      const trozos = []; let j = 0;
      for (;;) {
        const a = css.indexOf("/*", j);
        if (a < 0) { trozos.push(css.slice(j)); break; }
        trozos.push(css.slice(j, a));
        const b = css.indexOf("*/", a + 2);
        if (b < 0) break;
        j = b + 2;
      }
      const limpio = trozos.join("");
      const selConProsa = [];
      const re = /(^|\})([^{}]*)\{/g;
      let m;
      while ((m = re.exec(limpio)) !== null) {
        const sel = m[2].trim();
        if (!sel) continue;
        // eslint-disable-next-line no-control-regex
        if (/[^\x00-\x7F]/.test(sel)) selConProsa.push(sel.slice(0, 110));
      }
      t.igual(selConProsa.length, 0,
        `todos nuestros selectores son ASCII: uno con tildes o guiones largos es prosa que se escapó de un comentario, y detrás de ella hay una regla que el navegador nunca ve. Selectores con prosa: ${selConProsa.slice(0, 3).map(x => JSON.stringify(x)).join(' || ')}`);
    });

    // v18.0.14 — la consecuencia concreta de la fuga de arriba, cableada como prueba: la
    // regla raíz del widget de Fármacos tiene que existir Y traer sus cuatro propiedades.
    // Sin ella el widget se queda sin z-index (puede pintarse por debajo de Everest) y sin
    // el tope de 320 px (se estira sin freno). La posición se salva porque JS la pone en
    // línea desde la v17.38.0, que es justo por qué el fallo pudo pasar meses sin verse.
    t.caso("v18.0.14: la regla raíz de #vgl-cw-farmaco sobrevive al despiece de comentarios", () => {
      const trozos = []; let j = 0;
      for (;;) {
        const a = css.indexOf("/*", j);
        if (a < 0) { trozos.push(css.slice(j)); break; }
        trozos.push(css.slice(j, a));
        const b = css.indexOf("*/", a + 2);
        if (b < 0) break;
        j = b + 2;
      }
      const limpio = trozos.join("");
      const idx = limpio.indexOf("#vgl-cw-farmaco{");
      t.cierto(idx > 0, "la regla raíz #vgl-cw-farmaco{…} sigue en la hoja tras despiezar comentarios");
      // y el selector que la precede debe ser sano: si el analizador venía arrastrando
      // basura, "#vgl-cw-farmaco{" quedaría pegado a un selector inválido.
      const antes = limpio.slice(Math.max(0, idx - 400), idx);
      const ultimoCierre = Math.max(antes.lastIndexOf("}"), antes.lastIndexOf("{"));
      const entre = antes.slice(ultimoCierre + 1).trim();
      t.igual(entre, "", `entre la regla anterior y #vgl-cw-farmaco{ no puede quedar texto suelto (sería prosa de un comentario roto). Quedó: ${JSON.stringify(entre.slice(0, 90))}`);
      const bloque = limpio.slice(idx, limpio.indexOf("}", idx));
      for (const prop of ["z-index:", "max-width:", "font-family:", "color:"]) {
        t.cierto(bloque.includes(prop), `la regla raíz de #vgl-cw-farmaco conserva ${prop}`);
      }
    });


    // =====================================================================
    // v18.0.16 — REGLA R: EL ESTILO EN LÍNEA DEJÓ DE SER INMUNE EL DÍA QUE GANAMOS
    //            !important, Y ME LLEVÓ POR DELANTE CUATRO AVISOS
    //
    // `CLAUDE.md` daba por sentado: «el estilo inline SÍ es inmune a esto (gana a
    // cualquier regla no-!important)». Era cierto hasta la v18.0.14. Al blindar TODA la
    // hoja, nuestras propias reglas pasaron a llevar !important — y un !important de hoja
    // le gana a un estilo en línea SIN !important. El blindaje tipográfico, que alcanza a
    // todo elemento sin clase propia, se comió el color en línea de cuatro sitios. Medido
    // en Chromium, antes y después de mi propio cambio:
    //     · hora asignada del modal de agendamiento   #4ff0b8 -> blanco
    //     · etiqueta de fecha («mañana», «hoy»)       #4ff0b8 -> blanco
    //     · caja «la IA escribió una cifra que no está en los hechos»  #8b1a1a -> negro
    //     · el número señalado dentro de esa caja                      #c00    -> negro
    // Los dos últimos son el aviso más grave del módulo de redacción; los dos primeros son
    // cifras que el médico lee ANTES de confirmar una cita.
    //
    // La Regla B de esta misma suite existía para esto y NO lo cazó: mira `\.style\.color =`
    // y estos cuatro pintaban por `cssText` o por `style="…"` dentro del HTML. Se cierra el
    // hueco entero: TODA forma de pintar color en línea entra en la cuenta.
    //
    // El invariante que se fija: un color en línea o lleva `!important` (y entonces gana a
    // cualquier regla, nuestra o de Everest), o no existe — el elemento lleva CLASE propia
    // y su color vive en la hoja, donde la Regla P ya lo obliga a blindarse. Las dos
    // salidas son seguras; lo inseguro es el término medio, que es justo lo que había.
    // =====================================================================
    t.caso("Regla R - ningún color pintado EN LÍNEA queda sin !important (la hoja se lo comería)", () => {
      const sitios = [];

      // (a) style="…color:…" escrito dentro del HTML que generamos
      const reHtml = /style="([^"]*)"/g;
      let m;
      while ((m = reHtml.exec(code)) !== null) {
        const decls = m[1];
        if (!/(^|;)\s*color\s*:/.test(decls)) continue;
        const decl = decls.split(";").map(d => d.trim()).find(d => /^color\s*:/.test(d)) || "";
        if (decl.includes("!important")) continue;
        sitios.push('style="…' + decl.slice(0, 60) + '…"  (línea ' + (code.slice(0, m.index).split("\n").length) + ")");
      }

      // (b) elemento.style.cssText = "…color:…"  — la vía que la Regla B no miraba
      const reCss = /\.style\.cssText\s*=\s*"([^"]*)"/g;
      while ((m = reCss.exec(code)) !== null) {
        const decls = m[1];
        if (!/(^|;)\s*color\s*:/.test(decls)) continue;
        const decl = decls.split(";").map(d => d.trim()).find(d => /^color\s*:/.test(d)) || "";
        if (decl.includes("!important")) continue;
        sitios.push('cssText "…' + decl.slice(0, 60) + '…"  (línea ' + (code.slice(0, m.index).split("\n").length) + ")");
      }

      // (c) elemento.style.color = "…"  — lo que la Regla B ya cubría, aquí por completitud.
      //     setProperty("color", v, "important") NO cuenta: lleva su prioridad aparte.
      const reProp = /\.style\.color\s*=/g;
      while ((m = reProp.exec(code)) !== null) {
        sitios.push(".style.color = …  (línea " + (code.slice(0, m.index).split("\n").length) + ")");
      }

      t.igual(sitios.length, 0,
        `un color en línea sin !important lo pisa cualquier regla nuestra de la hoja (todas llevan !important desde la v18.0.14). O lleva !important, o el elemento lleva clase propia y su color vive en la hoja. Sitios: ${sitios.slice(0, 6).join(" | ")}`);
    });

  }
};
