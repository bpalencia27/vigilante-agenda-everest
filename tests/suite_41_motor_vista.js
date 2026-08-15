// =====================================================================
//  SUITE 41 — La vista de los avisos farmacológicos
//
//  Tres propiedades, y las tres pueden hacer daño si fallan:
//
//   1. XSS. Los nombres de fármaco los escribe Everest y llegan crudos a esta
//      vista. Sin escapado, un nombre con etiquetas dentro se ejecutaría DENTRO
//      de la historia clínica del paciente.
//   2. El silencio con motivo. "No pude leer qué toma" y "leí y está bien" se
//      pintan distinto, porque clínicamente son opuestos.
//   3. La bandera. Apagada, no se pinta nada — ni un contenedor vacío.
// =====================================================================
module.exports = {
  nombre: "Vista de avisos farmacológicos",
  cubre: ["mtrRenderAvisosHtml", "mtrPintarAviso", "mtrEtiquetaAviso"],

  pruebas(t, api) {
    const S = api.__S;
    // Las ÚNICAS etiquetas que este bloque escribe. Cualquier otra en la salida
    // solo puede venir de un dato de Everest que no se escapó.
    const PROPIAS = ["div", "/div", "span", "/span", "b", "/b"];
    const etiquetasAjenas = (html) =>
      (String(html).match(/<\/?[a-zA-Z][^\s>\/]*/g) || [])
        .map((x) => x.slice(1).toLowerCase())
        .map((x) => (x.charAt(0) === "/" ? x : x))
        .filter((x) => PROPIAS.indexOf(x) < 0);
    const conBandera = (fn) => {
      const antes = S.motorPortado;
      S.motorPortado = true;
      try { return fn(); } finally { S.motorPortado = antes; }
    };
    const PACIENTE_G4 = {
      medicamentos: ["METFORMINA 850 MG", "IBUPROFENO 400 MG", "LOSARTAN 50 MG", "HIDROCLOROTIAZIDA 25 MG"],
      tfgCkdEpi: 25, tfgCockcroftGault: 26,
    };

    // ---------- 1. la bandera ----------

    t.caso("con la bandera apagada no se pinta nada, ni un contenedor vacío", () => {
      t.igual(S.motorPortado, false, "la bandera tiene que nacer apagada");
      t.igual(api.mtrRenderAvisosHtml(PACIENTE_G4), "");
      t.igual(api.mtrRenderAvisosHtml({}), "");
    });

    t.caso("con la bandera encendida sí se pinta", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml(PACIENTE_G4));
      t.cierto(h.length > 200, "no pintó nada con la bandera encendida");
      t.cierto(h.indexOf("vgl-mtr-bloque") >= 0);
    });

    // ---------- 2. XSS, que es lo que puede hacer daño de verdad ----------

    t.caso("un nombre de fármaco con etiquetas dentro NO se ejecuta", () => {
      const veneno = '<img src=x onerror="alert(1)">METFORMINA 850 MG';
      const h = conBandera(() => api.mtrRenderAvisosHtml({
        medicamentos: [veneno], tfgCkdEpi: 25, tfgCockcroftGault: 26,
      }));
      t.cierto(h.indexOf("METFORMINA") >= 0, "el aviso debía dispararse igual");
      t.cierto(h.indexOf("&lt;img") >= 0, "el texto tiene que aparecer escapado, no desaparecer");
      // La propiedad de verdad no es "no aparece la cadena onerror=" —eso es
      // texto inerte una vez escapado el `<`— sino que NINGUNA etiqueta del
      // resultado venga de fuera. Se comprueba entera, no por lista negra.
      t.igual(etiquetasAjenas(h), [], "salió al HTML una etiqueta que no es del bloque");
    });

    t.caso("el veneno tampoco pasa por el mensaje, el mecanismo ni la lista de fármacos", () => {
      const h = conBandera(() => api.mtrPintarAviso({
        principio_activo: "<b>x</b>",
        medicamento_detectado: '"><script>alert(1)</script>',
        conducta: "<i>EVITAR</i>",
        mensaje: "<svg onload=alert(1)>",
        severidad: "CRITICAL",
        mecanismo: "<iframe src=javascript:alert(1)>",
        par_farmacos: ["<script>a</script>", "b"],
      }));
      t.igual(etiquetasAjenas(h), [], "salió al HTML una etiqueta que no es del bloque");
      t.cierto(h.indexOf("&lt;") >= 0, "el contenido tiene que estar, pero escapado");
    });

    t.caso("una interacción con nombres envenenados tampoco escapa", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml({
        medicamentos: ['LOSARTAN 50 MG<script>alert(1)</script>', "HIDROCLOROTIAZIDA 25 MG", "IBUPROFENO 400 MG"],
        tfgCkdEpi: 40, tfgCockcroftGault: 41,
      }));
      t.cierto(h.indexOf("Triple Whammy") >= 0, "la interacción debía detectarse igual");
      t.igual(etiquetasAjenas(h), []);
    });

    // ---------- 3. el silencio con motivo ----------

    t.caso("sin lista de medicamentos se pinta el aviso de que NO se juzgó nada", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml({}));
      t.cierto(h.indexOf("vgl-mtr-sinjuicio") >= 0,
        "tiene que usar la clase de 'no se pudo juzgar', no la de 'todo limpio'");
      t.igual(h.indexOf("vgl-mtr-limpio"), -1);
      t.cierto(/no significa que no haya riesgo/i.test(h),
        "el médico tiene que leer que el silencio no es seguridad");
    });

    t.caso("con la lista leída y sin hallazgos se pinta distinto", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml({
        medicamentos: ["ACETAMINOFEN 500 MG"], tfgCkdEpi: 85, tfgCockcroftGault: 88,
      }));
      t.cierto(h.indexOf("vgl-mtr-limpio") >= 0);
      t.igual(h.indexOf("vgl-mtr-sinjuicio"), -1,
        "leer y no encontrar nada NO puede pintarse igual que no haber podido leer");
    });

    t.caso("sin función renal tampoco se pinta 'todo limpio'", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml({ medicamentos: ["METFORMINA 850 MG"] }));
      t.cierto(h.indexOf("vgl-mtr-sinjuicio") >= 0);
      t.igual(h.indexOf("vgl-mtr-limpio"), -1);
    });

    // ---------- orden y contenido ----------

    t.caso("lo CRITICAL se pinta antes que lo HIGH", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml(PACIENTE_G4));
      const primerCrit = h.indexOf("vgl-mtr-crit");
      const primerAlto = h.indexOf("vgl-mtr-alto");
      t.cierto(primerCrit >= 0, "no hay ningún aviso crítico y debía haberlo");
      if (primerAlto >= 0) t.cierto(primerCrit < primerAlto, "un HIGH quedó antes que un CRITICAL");
    });

    t.caso("la cabecera dice cuántos exigen acción inmediata", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml(PACIENTE_G4));
      t.cierto(/requieren acción inmediata/.test(h), "falta el conteo de críticos en la cabecera");
    });

    t.caso("el pie deja claro que no se ordena ni se cambia nada", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml(PACIENTE_G4));
      t.cierto(/la decisión es suya/i.test(h),
        "el bloque tiene que decir explícitamente que solo avisa");
    });

    t.caso("las interacciones se rotulan con nombre legible, no con el código", () => {
      t.igual(api.mtrEtiquetaAviso({ tipo_interaccion: "TRIPLE_WHAMMY" }), "Triple Whammy");
      t.igual(api.mtrEtiquetaAviso({ tipo_interaccion: "BETA_CCB_NODHP" }), "Bradicardia por combinación");
      // y si aparece uno nuevo en el Copiloto que aquí no esté, se muestra crudo
      t.igual(api.mtrEtiquetaAviso({ tipo_interaccion: "REGLA_QUE_NO_EXISTE_AUN" }), "REGLA_QUE_NO_EXISTE_AUN");
      t.igual(api.mtrEtiquetaAviso({ medicamento_detectado: "METFORMINA 850 MG" }), "METFORMINA 850 MG");
    });

    t.caso("la vista es una región accesible con etiqueta", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml(PACIENTE_G4));
      t.cierto(h.indexOf('role="region"') >= 0);
      t.cierto(h.indexOf('aria-label="Avisos de seguridad farmacológica"') >= 0);
    });

    t.caso("la vista nunca lanza, aunque le entre basura", () => {
      conBandera(() => {
        for (const ctx of [null, undefined, {}, { medicamentos: "no-es-lista" },
          { medicamentos: [null], tfgCkdEpi: NaN }, { tfgCkdEpi: "x", tfgCockcroftGault: "y" }]) {
          t.noLanza(() => api.mtrRenderAvisosHtml(ctx), JSON.stringify(ctx));
        }
      });
    });

    t.caso("el interruptor y su CSS están cableados en el userscript", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(src.indexOf('sw("c-motor"') >= 0, "falta el interruptor en Ajustes");
      t.cierto(src.indexOf('S.motorPortado = motorBtn.checked') >= 0, "el interruptor no guarda nada");
      t.cierto(src.indexOf("motorPortado: false") >= 0, "la bandera no nace apagada en los valores por defecto");
      t.cierto(src.indexOf("mtrRenderAvisosHtml({") >= 0, "el bloque no se pinta en ningún sitio: sería código sombra");
      // toda declaracion de color del bloque nuevo lleva !important (Regla E, suite 25)
      const css = src.slice(src.indexOf("const MTR_CSS"), src.indexOf("const MTR_CSS") + 3000);
      const colores = css.match(/color:[^;}]+/g) || [];
      t.cierto(colores.length > 5, "no se encontró el CSS del bloque");
      for (const c of colores) {
        t.cierto(c.indexOf("!important") >= 0, "declaración de color sin !important: " + c);
      }
    });
  },
};
