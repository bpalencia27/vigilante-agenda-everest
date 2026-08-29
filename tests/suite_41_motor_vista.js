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
  cubre: ["mtrRenderAvisosHtml", "mtrPintarAviso", "mtrEtiquetaAviso",
    "mtrMedsSinGrupo", "mtrMedsFueraDeGrupoNombres", "mtrAvisoFueraDeGrupo"],

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
      // v17.6.77 — auditoría 25-ago (ítem 5): antes usaba ACETAMINOFEN (fuera de todo
      // grupo del motor) como fixture de "sin hallazgos" — desde que ese caso SÍ genera
      // el aviso visible de cobertura (ver más abajo), deja de ser un fixture de "nada
      // que reportar". Se cambia a LOSARTAN, que el motor sí reconoce y no produce
      // ningún hallazgo de dosis/interacción con esta función renal — el escenario que
      // esta prueba de verdad protege.
      const h = conBandera(() => api.mtrRenderAvisosHtml({
        medicamentos: ["LOSARTAN 50 MG"], tfgCkdEpi: 85, tfgCockcroftGault: 88,
      }));
      t.cierto(h.indexOf("vgl-mtr-limpio") >= 0);
      t.igual(h.indexOf("vgl-mtr-sinjuicio"), -1,
        "leer y no encontrar nada NO puede pintarse igual que no haber podido leer");
    });

    // =====================================================================
    // v17.6.77 — auditoría 25-ago (ítem 5): la detección de "fuera de grupo"
    // (mtrMedsSinGrupo) ya existía pero solo alimentaba telemetría — el médico nunca
    // veía CUÁLES fármacos el motor no reconoce. Ahora se suma al flujo de avisos
    // visible (mtrAvisoFueraDeGrupo), mismo patrón que el resto (severidad INFO).
    // =====================================================================
    t.caso("un fármaco fuera de todo grupo reconocido genera un aviso VISIBLE, no solo telemetría", () => {
      const h = conBandera(() => api.mtrRenderAvisosHtml({
        medicamentos: ["ACETAMINOFEN 500 MG"], tfgCkdEpi: 85, tfgCockcroftGault: 88,
      }));
      t.igual(h.indexOf("vgl-mtr-limpio"), -1, "ya no se pinta como 'todo limpio': SÍ hay algo que decir");
      t.cierto(h.indexOf("vgl-mtr-info") >= 0, "el aviso se pinta con la clase de severidad INFO");
      t.cierto(h.indexOf("ACETAMINOFEN") >= 0, "y NOMBRA el fármaco no reconocido — no un conteo mudo");
      t.cierto(/no cae en ningún grupo farmacológico/i.test(h), "con el mensaje explicando la brecha de cobertura");
    });

    t.caso("un fármaco reconocido SOLO por el catálogo RCV externo (v17.6.4) NO se marca como fuera de grupo", () => {
      // Confirma el fix del hallazgo cruzado: mtrMedsSinGrupo (y por tanto el aviso
      // visible) tenía un hueco real — no miraba mtrGruposCatalogoRcv, el TERCER
      // sistema de clasificación (llegó después, v17.6.4). El omeprazol participa en la
      // interacción CLOPIDOGREL_IBP solo por el catálogo — sin el fix, salía marcado
      // como "no reconocido" pese a que el motor SÍ lo evalúa.
      const h = conBandera(() => api.mtrRenderAvisosHtml({
        medicamentos: ["OMEPRAZOL 20 MG", "CLOPIDOGREL 75 MG"], tfgCkdEpi: 85, tfgCockcroftGault: 88,
      }));
      t.falso(/OMEPRAZOL[\s\S]*no cae en ningún grupo/i.test(h), "el omeprazol no debe aparecer como fuera de grupo");
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
      t.cierto(primerAlto >= 0, "no hay ningún aviso alto y debía haberlo");
      t.cierto(primerCrit < primerAlto, "un HIGH quedó antes que un CRITICAL");
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
      t.cierto(src.indexOf('_ajustesPonBorrador("motorPortado", motorBtn.checked)') >= 0, "el interruptor no escribe al borrador de Ajustes (v15.6: Guardar/Descartar)");
      t.cierto(src.indexOf("motorPortado: false") >= 0, "la bandera no nace apagada en los valores por defecto");
      t.cierto(src.indexOf("mtrRenderAvisosHtml({") >= 0, "el bloque no se pinta en ningún sitio: sería código sombra");
      // toda declaracion de color del bloque nuevo lleva !important (Regla E, suite 25)
      // v17.23.0 — un tope fijo de caracteres se quedó corto en cuanto MTR_CSS creció (se
      // agregó #vgl-panel-modal a cada selector) y cortaba la última declaración a la mitad,
      // dejando pasar un falso "sin !important". Se toma el bloque completo hasta su propio
      // cierre de template literal, no un número arbitrario.
      const iniMtrCss = src.indexOf("const MTR_CSS");
      const css = src.slice(iniMtrCss, src.indexOf("`;", iniMtrCss) + 2);
      const colores = css.match(/color:[^;}]+/g) || [];
      t.cierto(colores.length > 5, "no se encontró el CSS del bloque");
      for (const c of colores) {
        t.cierto(c.indexOf("!important") >= 0, "declaración de color sin !important: " + c);
      }
    });
    t.caso("v17.16.0 — las tres funciones de «fármaco fuera de grupo», probadas de frente", () => {
      // Estaban en `cubre` y solo se ejercitaban a través del render: el informe del banco
      // las listaba como «declaradas pero nunca nombradas». Son la señal de PUNTO CIEGO del
      // motor —un fármaco que no cae en ningún grupo no se evalúa ni por interacción ni por
      // dosis renal— así que merecen estar fijadas de frente y no de refilón.
      const conocido = "Losartan 50 mg";
      const raro = "Zyxomicina 10 mg";

      // El conteo (alimenta telemetría: enteros, JAMÁS nombres).
      t.igual(api.mtrMedsSinGrupo([conocido]), { total: 1, sinGrupo: 0 }, "un fármaco conocido no cuenta como punto ciego");
      const cuenta = api.mtrMedsSinGrupo([conocido, raro]);
      t.igual(cuenta.total, 2, "cuenta los dos");
      t.igual(cuenta.sinGrupo, 1, "y solo el desconocido queda fuera de grupo");
      t.igual(api.mtrMedsSinGrupo(null), { total: 0, sinGrupo: 0 }, "sin lista no se inventa un conteo");
      t.igual(api.mtrMedsSinGrupo(["", "   "]), { total: 0, sinGrupo: 0 }, "las entradas vacías no son fármacos");

      // Los nombres (alimentan PANTALLA: aquí sí van los nombres, nunca a telemetría).
      t.igual(api.mtrMedsFueraDeGrupoNombres([conocido, raro]), [raro],
        "para la pantalla sí se dice CUÁL es el que el motor no reconoce");
      t.igual(api.mtrMedsFueraDeGrupoNombres([conocido]), [],
        "y con todo reconocido, la lista va vacía");
      // La separación importa: el conteo y los nombres tienen que coincidir SIEMPRE, o una
      // de las dos vías estaría mintiendo sobre la misma realidad.
      t.igual(api.mtrMedsFueraDeGrupoNombres([conocido, raro]).length,
        api.mtrMedsSinGrupo([conocido, raro]).sinGrupo,
        "el conteo PHI-free y la lista para pantalla no pueden discrepar");

      // El aviso visible.
      t.igual(api.mtrAvisoFueraDeGrupo([conocido]), null, "sin puntos ciegos NO se pinta un aviso vacío");
      const aviso = api.mtrAvisoFueraDeGrupo([conocido, raro]);
      t.cierto(!!aviso, "con un fármaco fuera de grupo sí hay algo que decir");
      t.cierto(/no se pudo evaluar/.test(aviso.detalle || aviso.texto || JSON.stringify(aviso)),
        "y lo que dice es que NO se pudo evaluar, no un juicio sobre el fármaco");
      const txt = JSON.stringify(aviso);
      t.falso(/suspend|ajust|cambi/i.test(txt),
        "nunca sugiere suspender ni ajustar: sería inventar un juicio clínico sobre un fármaco que, por definición, no reconoce");
    });

  },
};
