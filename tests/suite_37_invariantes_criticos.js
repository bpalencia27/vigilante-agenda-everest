// =====================================================================
//  SUITE 37 — INVARIANTES CRÍTICOS: la mutación olvidada cae aquí
//
//  ¿Por qué existe?
//
//  De las 11 compuertas del enjambre de endurecimiento M0–M6, **cuatro fallaron por
//  mutaciones que los propios agentes dejaron sin restaurar en el código**, no por
//  defectos preexistentes:
//
//    · M2 — `edad < 0` donde iba `edad >= 18` (Cockcroft-Gault en pacientes pediátricos)
//    · M2 — condición invertida en `fraudWatch`
//    · M2 — `cups.some` donde iba `cups.every`: bastaba UN examen vigente para suprimir
//           todos los demás. En consulta: crónicos sin las órdenes que necesitan.
//    · M5 — Tab y Shift+Tab invertidos en la trampa de foco
//
//  Y no fue solo el enjambre. En v14.1.5 pasó aquí mismo: un agente de verificación sin
//  aislamiento invirtió `isPanelHiddenActivity` con un `!` en el repo compartido, y un
//  `git add -A` lo subió a un commit ajeno. El accidente no es de un equipo: es de
//  trabajar con muchos agentes sobre un solo archivo de 14.000 líneas.
//
//  El banco normal NO basta para esto. Una mutación olvidada sobrevive si la prueba que
//  la cazaba se "arregló" con ella puesta, o si esa rama nunca tuvo cobertura. Esta suite
//  no prueba comportamiento: **lee el código fuente** y exige que las decisiones que
//  costaron un incidente sigan escritas tal cual. Es el mismo patrón de la suite 26.
//
//  CÓMO SE USA CUANDO FALLA
//
//  Si un cambio legítimo mueve uno de estos invariantes, la suite falla **a propósito**:
//  no se relaja la aserción, se actualiza la tabla de abajo *y* se explica el porqué en
//  `tests/INFORME_MUTACIONES.md`. El objetivo no es congelar el código, es que nadie
//  pueda cambiar una de estas líneas sin darse cuenta de lo que está tocando.
//
//  QUÉ ENTRA AQUÍ
//
//  Solo lo que ya causó (o estuvo a punto de causar) daño clínico u operativo real, y
//  cuya inversión es de UN token — que es lo que hace una mutación. No es un sitio para
//  fijar estilo ni preferencias.
// =====================================================================
const fs = require("fs");
const path = require("path");

// Cada entrada dice: qué tiene que estar escrito, y qué pasa en consulta si se invierte.
const DEBE_ESTAR = [
  {
    id: "cups.every en pymCubiertoPorOrdenVigente",
    texto: "cups.every(",
    version: "v14.1.4 (decisión del médico) — mutación real dejada sin restaurar en M2",
    porque: "Con `some`, UNA sola orden vigente daba por cubierto un paquete entero. En el " +
            "RCV exprés son DIEZ exámenes: una glicemia de hace un mes silenciaba los otros " +
            "nueve, creatinina y perfil lipídico incluidos. Y la RAC necesita SUS DOS " +
            "exámenes (903876 + 903026): con `some` se daba por hecha con cualquiera.",
  },
  {
    id: "guarda adulta y de plausibilidad en Cockcroft-Gault",
    texto: "if (!(edad >= 18 && edad <= 120) || !(peso >= 20 && peso <= 300) || !(creat >= 0.1 && creat <= 20)) return 0;",
    version: "v14.1.3 + M2 — mutación real dejada sin restaurar en M2 (`edad < 0`)",
    porque: "Sin el borde de 18 años, la fórmula de adulto corre en un paciente pediátrico y " +
            "devuelve un estadio KDIGO que PARECE válido. Y el rango 0,1–20 de creatinina es " +
            "la guarda de unidades: una creatinina normal reportada en µmol/L llega como 88 y " +
            "daría una TFG ~88 veces menor, o sea falla renal terminal en un paciente sano.",
  },
  {
    id: "guarda adulta y de plausibilidad en CKD-EPI",
    texto: "if (!(edad >= 18 && edad <= 120) || !(creat >= 0.1 && creat <= 20)) return 0;",
    version: "v14.1.3 + M2",
    porque: "La hermana de la anterior. Las dos fórmulas tienen que rechazar lo mismo: si una " +
            "sola se relaja, el estadio depende de cuál se haya usado ese día.",
  },
  {
    id: "estadioKDIGO nunca devuelve G5 por un dato ilegible",
    texto: "!Number.isFinite(v) || v <= 0",
    version: "v14.1.3 (hallazgo verificado de una auditoría externa)",
    porque: "TODA comparación de orden con NaN es `false` en JavaScript, así que sin esta " +
            "guarda un valor no numérico caía por los seis `if` y salía por el `return \"G5\"` " +
            "del final: el estadio MÁS GRAVE a partir de un dato que ni se pudo leer. " +
            "\"No evaluable\" es null, nunca el peor diagnóstico.",
  },
  {
    id: "_labNumerico rechaza negativos",
    texto: "if (/-\\s*\\d/.test(txt)) return null",
    version: "v14.1.3",
    porque: "Al limpiar la cadena se PIERDE el signo, así que un \"-50\" corrupto del " +
            "laboratorio se convertía en 50 — por encima del umbral de albuminuria, así que " +
            "un dato inválido ACORTABA a la mitad la vigencia de la RAC.",
  },
  {
    id: "la guarda de cruce de pacientes FALLA CERRADA",
    texto: "return !!actual && String(actual) === String(docIdEsperado)",
    version: "v14.1.5 (el peor hallazgo clínico que ha tenido este script)",
    porque: "Entre el clic y la respuesta de Athenea pasan 2-4 s. Si el médico abre OTRA " +
            "historia, las casillas que se encuentran son las del paciente NUEVO. El `!!actual` " +
            "es lo que hace que, si la cédula no se puede leer del DOM, TAMPOCO se escriba: " +
            "escribir a ciegas es exactamente lo que se está evitando.",
  },
  {
    id: "la casilla del médico gana el desempate a la RAC",
    texto: "RAC_GUARDIA_MAX_RESTAURACIONES = 2",
    version: "v14.1.5",
    porque: "Everest borra sola la casilla de la RAC al re-renderizar, y por eso se restaura. " +
            "Pero el médico también la borra a propósito. Sin cupo, el robot se la rellenaba " +
            "una y otra vez a sus espaldas: lo contrario de \"la casilla del médico es sagrada\".",
  },
  {
    id: "la ventana de la guarda de la RAC",
    texto: "RAC_GUARDIA_VENTANA_MS = 20000",
    version: "v14.1.5",
    porque: "La otra mitad del mismo desempate: el borrado de Everest ocurre en el re-render " +
            "inmediato; el del médico llega más tarde. Sin reloj, la guarda vive para siempre.",
  },
  {
    id: "uxClaveLimpia cuenta DÍGITOS, no caracteres",
    texto: 'm.replace(/\\D/g, "").length >= 6',
    version: "v14.1.9",
    porque: "Es la barrera que impide que una cédula acabe siendo el NOMBRE de una métrica " +
            "enviada al tablero. Contar caracteres en vez de dígitos parece equivalente y no " +
            "lo es: se come claves legítimas cortas y ciega la telemetría.",
  },
];

// Lo que NO puede aparecer. Un negativo caza la mutación aunque alguien mueva el código
// de sitio, que es justo lo que un positivo por sí solo no consigue.
const NO_DEBE_ESTAR = [
  {
    id: "cups.some",
    texto: "cups.some(",
    porque: "Es literalmente la mutación que M2 dejó sin restaurar. Si reaparece, un examen " +
            "vigente vuelve a suprimir todo el paquete.",
  },
];

module.exports = {
  nombre: "Invariantes críticos (mutación olvidada)",
  cubre: [],

  async pruebas(t) {
    const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

    t.caso("el userscript se pudo leer y tiene el tamaño que debe — si no, este guard queda ciego", () => {
      // Sin esto, un fallo de lectura o una ruta cambiada haría que TODAS las
      // comprobaciones de abajo pasaran sobre una cadena vacía.
      t.cierto(src.length > 400000, "se esperaba el monolito completo, se leyeron " + src.length + " caracteres");
    });

    for (const inv of DEBE_ESTAR) {
      t.caso("sigue en pie: " + inv.id, () => {
        const veces = src.split(inv.texto).length - 1;
        t.cierto(veces >= 1,
          "DESAPARECIÓ el invariante de " + inv.version + ".\n" +
          "      Qué pasa si esto no está: " + inv.porque + "\n" +
          "      Si el cambio es deliberado, actualiza tests/suite_37_invariantes_criticos.js\n" +
          "      Y explica el porqué en tests/INFORME_MUTACIONES.md. NO relajes esta prueba.");
      });
    }

    for (const inv of NO_DEBE_ESTAR) {
      t.caso("no ha reaparecido: " + inv.id, () => {
        t.igual(src.indexOf(inv.texto), -1,
          "REAPARECIÓ algo que estaba prohibido. " + inv.porque);
      });
    }

    // ---------- las dos inversiones de M5, comprobadas por estructura ----------

    t.caso("la trampa de foco NO está invertida: Shift+Tab va al ÚLTIMO, Tab va al PRIMERO", () => {
      // M5 dejó Tab y Shift+Tab cambiados: Tab llevaba al elemento ANTERIOR. Junto con un
      // `outline: none` que llegó en la misma iteración, los modales quedaban
      // completamente inasequibles por teclado.
      const i = src.indexOf("if (e.shiftKey) {");
      t.cierto(i !== -1, "no se encontró la trampa de foco; si se renombró, actualiza esta prueba");
      const bloque = src.slice(i, i + 900);
      const ramaShift = bloque.slice(0, bloque.indexOf("} else {"));
      const ramaTab = bloque.slice(bloque.indexOf("} else {"));
      t.cierto(ramaShift.indexOf("=== first") !== -1 && ramaShift.indexOf("last.focus()") !== -1,
        "con Shift+Tab, estando en el PRIMERO hay que saltar al ÚLTIMO");
      t.cierto(ramaTab.indexOf("=== last") !== -1 && ramaTab.indexOf("first.focus()") !== -1,
        "con Tab, estando en el ÚLTIMO hay que saltar al PRIMERO");
    });

    t.caso("_dispararAvisoAudible NO depende del módulo — el tono suena esté donde esté el médico", () => {
      // v14.1.5: el aviso audible estaba condicionado a estar dentro de /viva/HCHealth, o
      // sea que el tono y la notificación del sistema —que existen precisamente para
      // avisar cuando el médico NO está mirando— se callaban justo cuando hacían falta.
      const i = src.indexOf("function _dispararAvisoAudible(");
      t.cierto(i !== -1, "no se encontró _dispararAvisoAudible");
      const cuerpo = src.slice(i, src.indexOf("function _dispararAvisoCartel(", i));
      t.igual(cuerpo.indexOf("_enModuloHCHealth"), -1,
        "el aviso AUDIBLE volvió a condicionarse al módulo: es la causa exacta de los avisos " +
        "tardíos que reportaron los compañeros del médico ('es como si estuvieran asincrónicas')");
    });

    // ---------- el guard se protege a sí mismo ----------

    t.caso("la tabla de invariantes no se ha quedado vacía ni desactivada", () => {
      // Una forma cómoda de "arreglar" un fallo de esta suite sería vaciar la tabla.
      // Entonces pasaría siempre y no diría nada, que es peor que no tenerla.
      t.cierto(DEBE_ESTAR.length >= 9, "se esperaban al menos 9 invariantes, hay " + DEBE_ESTAR.length);
      t.cierto(NO_DEBE_ESTAR.length >= 1, "se esperaba al menos un invariante negativo");
      const sinMotivo = DEBE_ESTAR.concat(NO_DEBE_ESTAR).filter((i) => !i.porque || i.porque.length < 60);
      t.igual(sinMotivo.map((i) => i.id), [],
        "todo invariante lleva escrito QUÉ PASA EN CONSULTA si se invierte; sin eso, el que " +
        "lo encuentre roto no puede decidir si el cambio era legítimo");
    });

    // =====================================================================
    // v18.0.29 — UNA ZONA MUERTA TEMPORAL DEJABA EL AUTO-LOGIN ROTO, Y LA CONSOLA MENTÍA
    //
    // `ATH_CRED_KEY` y `atheneaLoginBloqueado` se declaraban 1.340 líneas por DEBAJO del
    // bloque de Athenea, y ese bloque hace `return` al terminar: en la web de Athenea el
    // hilo sale del ámbito ANTES de evaluarlas, así que quedaban en su zona muerta temporal
    // PARA SIEMPRE en esa página. `atheneaCredsSet`/`atheneaCredsGet` sí existen —son
    // declaraciones de tipo function, izadas— pero al tocar `ATH_CRED_KEY` lanzaban
    // ReferenceError, que sus propios try/catch se tragaban devolviendo false/null.
    //
    // Resultado: en la pantalla de inicio de sesión, guardar las credenciales fallaba
    // SIEMPRE, y la consola imprimía igual «Credenciales capturadas y guardadas para
    // auto-login permanente». Un fallo del sistema presentado como un hecho — el mismo
    // patrón del Framingham (v18.0.27) y del aviso de ceguera (v18.0.17).
    //
    // Esto es una regresión de ORDEN DE DECLARACIÓN, y por eso se vigila sobre el fuente:
    // el arnés carga el script con hostname de Everest, no de Athenea, así que ese camino
    // —el único donde el defecto se manifiesta— no se recorre nunca en el banco. Una prueba
    // de conducta aquí daría verde con el defecto puesto.
    // =====================================================================
    t.caso("v18.0.29: ATH_CRED_KEY se declara ANTES del bloque de Athenea (o queda en zona muerta)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const decl = src.indexOf('const ATH_CRED_KEY');
      const bloque = src.indexOf('location.hostname.includes("atheneasoluciones.com")');
      t.cierto(decl > 0, "sigue existiendo la clave de credenciales");
      t.cierto(bloque > 0, "y el bloque de Athenea");
      t.cierto(decl < bloque,
        "la declaración tiene que ir ANTES: el bloque de Athenea hace return, y lo declarado después queda en zona muerta temporal en esa página — atheneaCredsSet lanzaría ReferenceError y su try/catch lo devolvería como un simple false");

      const declB = src.indexOf('let atheneaLoginBloqueado');
      t.cierto(declB > 0 && declB < bloque,
        "lo mismo con atheneaLoginBloqueado, que atheneaCredsSet toca en la misma línea");
    });

    t.caso("v18.0.29: el mensaje de «credenciales guardadas» depende del resultado, no se imprime siempre", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const soloCodigo = (txt) => txt.split("\n")
        .filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\/\/.*$/, "")).join("\n");

      const i = src.indexOf("Credenciales capturadas y guardadas");
      t.cierto(i > 0, "sigue existiendo el mensaje");
      const alrededor = soloCodigo(src.slice(Math.max(0, i - 700), i));
      t.cierto(/atheneaCredsSet\([^)]*\)/.test(alrededor),
        "el guardado ocurre justo antes del mensaje");
      t.cierto(/if\s*\(/.test(alrededor.slice(alrededor.lastIndexOf("atheneaCredsSet"))),
        "y el mensaje va dentro de un if sobre el resultado: anunciar un guardado que falló es peor que no anunciar nada");
    });

  },
};
