// =====================================================================
//  SUITE 31 — Auto-Labs contra los rangos OFICIALES de la IPS (v14.1.8)
//
//  La suite 30 comprueba las funciones puras que leen la tabla de Everest. Esta
//  comprueba lo único que le importa al médico: que un valor implausible NO acabe
//  escrito en la historia clínica.
//
//  El caso que esto ataca ya mordió a este script. Una creatinina reportada en µmol/L
//  llega como 88 donde la casilla espera 1,0 mg/dL. La guarda de v14.1.3 impidió que
//  ese 88 se convirtiera en un estadio renal falso, pero Auto-Labs seguía escribiéndolo
//  en la casilla tal cual — y de la casilla se guarda en la historia, donde ya es un
//  dato clínico firmado.
//
//  La decisión de diseño que estas pruebas fijan: ante un valor implausible **no se
//  escribe**, y se le dice al médico qué llegó y qué esperaba la IPS. No escribir es
//  recuperable (el médico lo pone a mano sabiendo por qué); escribir un número
//  equivocado no lo es. Y NUNCA se propone el valor convertido: la sospecha de unidad
//  es una sospecha, no un hecho.
// =====================================================================
module.exports = {
  nombre: "Auto-Labs contra rangos oficiales (v14.1.8)",
  cubre: [
    "_objecionOficialAlValor", "_textoImplausibles", "injectLabsIntoCronicos", "_contextoOficialParaLabs",
    "_guardarTablaOficialVista", "_tablaOficialVigente", "_instalarOyenteTablaOficial",
    "_base64SinRelleno", "apiAccesoBuscarPaciente",
  ],

  async pruebas(t, api, env, cargar) {
    // Subconjunto de la tabla REAL capturada en consultorio el 12-08-2026.
    const TABLA = [
      { codigoExamen: "CREATININA", valorMinimo: 0.2, valorMaximo: 20.0, swRequerido: true, unidad: "mg/dL" },
      { codigoExamen: "HEMOGLOBINA", sexo: null, edadMin: 0, edadMax: 110, valorMinimo: 3.0, valorMaximo: 30.0, swRequerido: true, unidad: "g/dL" },
      { codigoExamen: "GLUCOSA_SUERO", valorMinimo: 20.0, valorMaximo: 1000.0, swRequerido: false, unidad: "mg/dL" },
      { codigoExamen: "RELACION_ALBUMINURIA_CREATININA", valorMinimo: 1.0, valorMaximo: 20000.0, swRequerido: false, unidad: "mg/g" },
    ];

    // ---------- la objeción, pieza a pieza ----------

    t.caso("EL CASO QUE MOTIVA TODO: una creatinina en µmol/L se objeta en vez de escribirse", () => {
      // Una creatinina NORMAL de 1,0 mg/dL reportada en µmol/L llega como 88. Everest
      // declara la creatinina plausible entre 0,2 y 20 mg/dL: 88 no cabe.
      const o = api._objecionOficialAlValor("CREATININA", "88", { tablaOficial: TABLA });
      t.cierto(!!o, "88 mg/dL no es una creatinina: hay que objetarla");
      t.igual(o.estado, "alto");
      t.igual(o.unidad, "mg/dL", "se dice en qué unidad esperaba la casilla — ese es el dato que resuelve la duda");
      t.igual(o.min, 0.2);
      t.igual(o.max, 20);
      t.igual(o.valor, "88", "se conserva el texto EXACTO que llegó, sin reinterpretarlo");
      // Y la creatinina real del mismo paciente sí pasa.
      t.igual(api._objecionOficialAlValor("CREATININA", "1.0", { tablaOficial: TABLA }), null);
      t.igual(api._objecionOficialAlValor("CREATININA", "4.5", { tablaOficial: TABLA }), null,
        "4,5 mg/dL es una creatinina alta de verdad, de un paciente enfermo: JAMÁS se objeta un valor clínicamente grave pero plausible");
    });

    t.caso("sin tabla oficial no se objeta NADA — Auto-Labs se comporta igual que antes de v14.1.8", () => {
      // Esto es lo que garantiza que el cambio no puede empeorar nada. Si Everest no
      // cargó la tabla, o el oyente no la vio, todo sigue como siempre.
      for (const sinTabla of [undefined, {}, { tablaOficial: null }, { tablaOficial: [] }, { tablaOficial: "no es tabla" }]) {
        t.igual(api._objecionOficialAlValor("CREATININA", "88", sinTabla), null,
          "sin tabla no hay con qué juzgar, así que no se objeta: el médico llena su historia igual");
      }
    });

    t.caso("un valor SIN número no se juzga: 'PENDIENTE' y compañía siguen su camino de siempre", () => {
      for (const crudo of ["PENDIENTE", "", "muestra hemolizada", "no reactivo", null, undefined]) {
        t.igual(api._objecionOficialAlValor("CREATININA", crudo, { tablaOficial: TABLA }), null,
          JSON.stringify(crudo) + ": sin número no hay nada que comparar, así que no se objeta");
      }
    });

    t.caso("una desigualdad SÍ se juzga por su magnitud — y el mismo '> 300' es legítimo en un analito y absurdo en otro", () => {
      // Los LIS reportan fuera de rango con desigualdad, y `_labNumerico` extrae el
      // número a propósito desde v12.10.15 (era el arreglo del umbral de albuminuria).
      // Aquí eso es exactamente lo que se quiere: la magnitud es lo que decide si el
      // número cabe en la casilla.
      //
      // El contraste es lo que enseña: "> 300" en una RAC es una albuminuria franca
      // perfectamente real (la IPS declara 1–20000 mg/g) y tiene que quedar escrita. El
      // MISMO texto en una creatinina son 300 mg/dL, que no existe — es la unidad
      // equivocada. Sin la tabla oficial las dos serían indistinguibles.
      t.igual(api._objecionOficialAlValor("RAC", "> 300", { tablaOficial: TABLA }), null,
        "una RAC de >300 mg/g es nefropatía franca: dato real y grave, se escribe");
      const creat = api._objecionOficialAlValor("CREATININA", "> 300", { tablaOficial: TABLA });
      t.cierto(!!creat, "300 mg/dL de creatinina no existe: se objeta");
      t.igual(creat.estado, "alto");
    });

    t.caso("un examen sin regla aplicable no se objeta — callar es lo correcto", () => {
      // HEMOGLOBINA es la única de la tabla real que acota por edad (0–110). Sin edad
      // legible no le aplica ninguna regla, y entonces NO se juzga: marcar como
      // implausible un valor que no se pudo comparar sería una alarma inventada.
      t.igual(api._objecionOficialAlValor("HEMOGLOBINA", "0.4", { tablaOficial: TABLA }), null,
        "sin edad del paciente, la hemoglobina no tiene rango oficial y no se juzga");
      const conEdad = api._objecionOficialAlValor("HEMOGLOBINA", "0.4", { tablaOficial: TABLA, edad: 45 });
      t.cierto(!!conEdad, "con la edad conocida sí se juzga, y 0,4 g/dL no es una hemoglobina");
      t.igual(conEdad.estado, "bajo");
      // Y un analito que no está mapeado tampoco se objeta jamás.
      t.igual(api._objecionOficialAlValor("UROANALISIS", "999999", { tablaOficial: TABLA }), null);
      t.igual(api._objecionOficialAlValor("PTH", "5", { tablaOficial: TABLA }), null, "PTH no está en esta tabla: sin regla, sin objeción");
    });

    t.caso("una regla que declara la UNIDAD pero ningún rango no bloquea nada", () => {
      // Caso que una mutación destapó: si la objeción se disparara con todo lo que no sea
      // "dentro", un `sin_regla` también bloquearía. Y `sin_regla` con regla existente es
      // un caso perfectamente posible — la IPS puede declarar la unidad de un examen sin
      // ponerle límites (es lo natural en uno cualitativo). Ese día, ese analito dejaría
      // de escribirse SIEMPRE, sin motivo y sin que nadie entendiera por qué.
      const soloUnidad = [{ codigoExamen: "CREATININA", valorMinimo: null, valorMaximo: null, unidad: "mg/dL" }];
      for (const v of ["1.1", "88", "0.001", "99999"]) {
        t.igual(api._objecionOficialAlValor("CREATININA", v, { tablaOficial: soloUnidad }), null,
          v + ": una regla sin límites no puede declarar nada fuera de rango");
      }
    });

    t.caso("una hemoglobina de 3,2 g/dL SÍ se escribe — 'plausible' no es 'normal'", () => {
      // El contrapunto imprescindible del caso anterior. La IPS declara la hemoglobina
      // plausible desde 3,0 g/dL. Un 3,2 es una urgencia transfusional Y un dato de
      // laboratorio perfectamente real: si Auto-Labs se negara a escribirlo, estaría
      // ocultando justo el resultado más grave de la historia.
      t.igual(api._objecionOficialAlValor("HEMOGLOBINA", "3.2", { tablaOficial: TABLA, edad: 45 }), null,
        "el valor más grave posible es el que MÁS falta hace que quede escrito");
      t.igual(api._objecionOficialAlValor("GLUCOSA_SUERO", "500", { tablaOficial: TABLA }), null,
        "una glicemia de 500 mg/dL es una descompensación real y plausible: se escribe");
    });

    // ---------- DE PUNTA A PUNTA: la casilla de la historia clínica ----------

    t.caso("EL DESENLACE: la creatinina de 88 NO llega a la casilla de la historia, y se reporta", () => {
      // Las pruebas de arriba comprueban la decisión. Esta comprueba el efecto, que es lo
      // único que le importa al paciente: qué queda escrito en su historia clínica.
      const c = cargar();
      let mockDOM = {};
      c.ctx.Event = class Event { constructor(tipo) { this.type = tipo; } };
      c.env.doc.getElementById = (id) => {
        if (!mockDOM[id]) return null;
        return {
          id, tagName: "INPUT", dispatchEvent: () => {},
          set value(v) { mockDOM[id].value = v; },
          get value() { return mockDOM[id].value; },
        };
      };

      mockDOM = { resultadoCreatinina: { value: "" }, fechaResultCreatinina: { value: "" } };
      const labs = [{ codigo: "903895", nombre: "CREATININA EN SUERO", Resultado: "88", Fecha: "2026-08-12" }];

      // Sin tabla oficial: se escribe, como siempre se hizo. Este es el comportamiento
      // que el script tuvo hasta v14.1.8, y el que sigue teniendo si Everest no dio tabla.
      const antes = c.api.injectLabsIntoCronicos(labs, null, {});
      t.igual(mockDOM.resultadoCreatinina.value, "88", "sin tabla oficial, el 88 entraba en la historia clínica");
      t.igual(antes.implausibles.length, 0);

      // Con la tabla oficial: no se escribe, y se dice por qué.
      mockDOM = { resultadoCreatinina: { value: "" }, fechaResultCreatinina: { value: "" } };
      const r = c.api.injectLabsIntoCronicos(labs, null, { tablaOficial: TABLA });
      t.igual(mockDOM.resultadoCreatinina.value, "", "la casilla queda VACÍA: el 88 no se guarda en la historia del paciente");
      t.igual(r.count, 0, "y no se cuenta como casilla diligenciada, que sería mentirle al médico");
      t.igual(r.implausibles.length, 1);
      t.igual(r.implausibles[0].key, "CREATININA");
      t.igual(r.implausibles[0].valor, "88");
      // La fecha tampoco se queda suelta: sin valor, una fecha sola no dice nada.
      t.igual(mockDOM.fechaResultCreatinina.value, "", "sin valor no se escribe la fecha: una fecha huérfana sugiere un resultado que no está");
    });

    t.caso("con la tabla oficial puesta, un resultado NORMAL se sigue escribiendo igual que siempre", () => {
      // El otro lado de la misma moneda: si la tabla oficial estorbara el trabajo normal,
      // el médico apagaría Auto-Labs y perdería todo lo demás.
      const c = cargar();
      let mockDOM = { resultadoCreatinina: { value: "" }, fechaResultCreatinina: { value: "" }, resultadoGlicemia: { value: "" }, fechaResultGlicemia: { value: "" } };
      c.ctx.Event = class Event { constructor(tipo) { this.type = tipo; } };
      c.env.doc.getElementById = (id) => {
        if (!mockDOM[id]) return null;
        return { id, tagName: "INPUT", dispatchEvent: () => {}, set value(v) { mockDOM[id].value = v; }, get value() { return mockDOM[id].value; } };
      };
      const labs = [
        { codigo: "903895", nombre: "CREATININA EN SUERO", Resultado: "1.1", Fecha: "2026-08-12" },
        { codigo: "903841", nombre: "GLUCOSA EN SUERO", Resultado: "126", Fecha: "2026-08-12" },
      ];
      const r = c.api.injectLabsIntoCronicos(labs, null, { tablaOficial: TABLA });
      t.igual(r.count, 2, "los dos resultados plausibles se escriben");
      t.igual(r.implausibles.length, 0);
      t.igual(mockDOM.resultadoCreatinina.value, "1.1");
      t.igual(mockDOM.resultadoGlicemia.value, "126");
    });

    // ---------- lo que se le dice al médico ----------

    t.caso("el aviso dice qué llegó y qué se esperaba, y NUNCA propone el valor convertido", () => {
      const txt = api._textoImplausibles([
        { key: "CREATININA", valor: "88", estado: "alto", unidad: "mg/dL", min: 0.2, max: 20, mensaje: "" },
      ]);
      t.cierto(txt.indexOf("CREATININA") !== -1, "nombra el analito");
      t.cierto(txt.indexOf("88") !== -1, "dice qué llegó");
      t.cierto(txt.indexOf("mg/dL") !== -1, "dice en qué unidad esperaba la casilla");
      t.cierto(txt.indexOf("0.2") !== -1 && txt.indexOf("20") !== -1, "dice el rango que la IPS espera");
      // La prohibición, fijada como prueba: 88 µmol/L equivalen a ~1,0 mg/dL. Ese número
      // NO puede aparecer, porque sugerirlo es convertir unidades a espaldas del
      // laboratorio y acabaría escrito en una historia clínica sin comprobarse.
      t.igual(/\b1[.,]0\b/.test(txt), false, "no se propone el valor convertido: la sospecha de unidad es una sospecha, no un hecho");
      t.igual(api._textoImplausibles([]), "", "sin objeciones, el aviso no dice nada");
      t.igual(api._textoImplausibles(null), "");
      t.igual(api._textoImplausibles("no es lista"), "");
    });

    t.caso("un rango abierto por un lado se muestra como abierto, no como un cero inventado", () => {
      const txt = api._textoImplausibles([{ key: "PTH", valor: "0.1", estado: "bajo", unidad: "pg/ml", min: 1, max: null, mensaje: "" }]);
      t.cierto(txt.indexOf("?") !== -1, "sin máximo declarado se muestra '?', no un número que la IPS nunca dijo");
    });

    // ---------- la tabla vista, y su caducidad ----------

    t.caso("la tabla que Everest cargó se guarda y se sirve; una tabla vacía o rara no se guarda", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._tablaOficialVigente(), null, "de entrada no hay ninguna tabla vista");
      t.igual(c.api._guardarTablaOficialVista(null), false);
      t.igual(c.api._guardarTablaOficialVista([]), false, "una respuesta vacía no es una tabla utilizable");
      t.igual(c.api._guardarTablaOficialVista("<html>login</html>"), false, "una página de login con HTTP 200 no es una tabla");
      t.igual(c.api._guardarTablaOficialVista({ error: "no autorizado" }), false);
      t.igual(c.api._tablaOficialVigente(), null, "y ninguna de esas dejó nada guardado");
      t.igual(c.api._guardarTablaOficialVista(TABLA), true);
      t.igual(c.api._tablaOficialVigente().length, TABLA.length);
    });

    // =====================================================================
    // v17.6.0 — RELOJES DE FRESCURA UNIFICADOS A 10 MIN: el de la tabla oficial
    // bajó de 30 a 10 (aprobado el 22-ago junto con el resto de la lista del
    // 20-ago) — era el más largo de los cuatro, porque "es configuración de la
    // IPS, no del paciente", pero podía quedar sirviendo una tabla que el resto
    // del script ya consideraba vieja según otro reloj. A los 15 minutos, el
    // reloj VIEJO la seguía sirviendo; el NUEVO ya no. El gancho
    // __envejecerTablaOficial vive solo en el cargador de pruebas (harness.js ya
    // declara que no toca el archivo de producción).
    // =====================================================================
    t.caso("v17.6.0 — el TTL de la tabla oficial bajó de 30 a 10 min: a los 15 min ya no se sirve (con el reloj viejo sí se habría servido)", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._guardarTablaOficialVista(TABLA), true);
      t.igual(c.api._tablaOficialVigente().length, TABLA.length, "recién vista: vigente");
      c.api.__envejecerTablaOficial(9 * 60000 + 30000); // 9m30s atrás: dentro de los 10 min nuevos
      t.cierto(!!c.api._tablaOficialVigente(), "a los 9m30s sigue vigente con el TTL nuevo");
      c.api.__envejecerTablaOficial(15 * 60000); // 15 min atrás: dentro de los 30 viejos, fuera de los 10 nuevos
      t.igual(c.api._tablaOficialVigente(), null,
        "a los 15 min: con el TTL viejo (30 min) todavía se habría servido; con el nuevo (10 min) ya no");
    });

    t.caso("el oyente no puede romper Everest, y no se instala dos veces", () => {
      // Lo que se prueba aquí no es que capture, sino que sea INOCUO. Es código que corre
      // dentro de la aplicación con la que el médico atiende: si lo rompe, no importa
      // nada de lo demás.
      const c = cargar({ silencioso: true });
      let abiertos = [];
      function XHRFalso() { this._listeners = {}; }
      XHRFalso.prototype.open = function (m, u) { abiertos.push(m + " " + u); return "valor original"; };
      XHRFalso.prototype.addEventListener = function (ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); };
      const win = { XMLHttpRequest: XHRFalso };

      t.igual(c.api._instalarOyenteTablaOficial(win), true);
      t.igual(c.api._instalarOyenteTablaOficial(win), false, "una segunda instalación no vuelve a envolver: envolver dos veces duplicaría todo");

      // Una petición cualquiera de Everest sigue funcionando exactamente igual.
      const x1 = new XHRFalso();
      t.igual(x1.open("GET", "/apiviva/APIAcceso/api/Paciente/BuscarPaciente?x=1"), "valor original",
        "el open envuelto devuelve lo que devolvía el original");
      t.igual(abiertos.length, 1, "y la llamada real llegó al original");
      t.igual((x1._listeners.load || []).length, 0, "a una URL que no interesa NO se le engancha nada");

      // Y ante la petición que sí interesa, se engancha un oyente de 'load' (no un onload,
      // que habría reemplazado el de Everest).
      const x2 = new XHRFalso();
      x2.open("GET", "/apiviva/APIHCHealth/api/Parametrizacion/GetValidacionExamenCronicos?citaId=MTIyMTk3NA");
      t.igual((x2._listeners.load || []).length, 1);

      // El oyente lee la respuesta y la guarda.
      x2.response = TABLA;
      x2._listeners.load[0]();
      t.igual(c.api._tablaOficialVigente().length, TABLA.length, "la tabla se capturó sin pedirla");
    });

    t.caso("si la respuesta del oyente es basura, no revienta ni guarda nada", () => {
      // Un fallo aquí correría DENTRO del ciclo de Everest. Tiene que ser imposible.
      const c = cargar({ silencioso: true });
      function XHRFalso() { this._listeners = {}; }
      XHRFalso.prototype.open = function () {};
      XHRFalso.prototype.addEventListener = function (ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); };
      c.api._instalarOyenteTablaOficial({ XMLHttpRequest: XHRFalso });
      const x = new XHRFalso();
      x.open("GET", "/GetValidacionExamenCronicos?citaId=X");
      const oyente = x._listeners.load[0];
      for (const basura of ["{roto", "<html>", null, 42]) {
        x.response = basura;
        t.noLanza(() => oyente(), "el oyente jamás puede lanzar hacia Everest (" + JSON.stringify(basura) + ")");
      }
      t.igual(c.api._tablaOficialVigente(), null, "y no guardó ninguna de esas");
      // Un cuerpo JSON en texto sí se entiende (Angular no siempre pone responseType json).
      x.response = JSON.stringify(TABLA);
      oyente();
      t.igual(c.api._tablaOficialVigente().length, TABLA.length);
    });

    t.caso("un XMLHttpRequest sin prototipo utilizable no se toca (y no se rompe nada al intentarlo)", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._instalarOyenteTablaOficial({}), false);
      t.igual(c.api._instalarOyenteTablaOficial(null), false);
      t.igual(c.api._instalarOyenteTablaOficial({ XMLHttpRequest: function () {} }), false,
        "sin open en el prototipo no hay nada que envolver");
    });

    // ---------- reunir el contexto no puede estorbar nunca ----------

    await t.casoAsync("_contextoOficialParaLabs: si nada se puede consultar, devuelve un contexto vacío y NO lanza", async () => {
      // Es la garantía de que v14.1.8 no puede empeorar nada. Este contexto se reúne justo
      // antes de escribir en la historia: si una consulta caída pudiera lanzar, tumbaría el
      // Auto-Labs entero y el médico se quedaría sin la función, no solo sin los rangos.
      const c = cargar({ silencioso: true, fetch: async () => { throw new Error("red caída"); } });
      let ctx = null;
      await t.noLanza(async () => { ctx = await c.api._contextoOficialParaLabs("1234567890"); },
        "reunir el contexto JAMÁS puede lanzar: se ejecuta en el camino de escritura");
      t.igual(ctx.tablaOficial, null, "sin tabla vista, no hay tabla");
      t.igual(ctx.edad, null);
      t.igual(ctx.sexo, "");
      // Y con eso, `_objecionOficialAlValor` no objeta nada: Auto-Labs escribe como siempre.
      t.igual(api._objecionOficialAlValor("CREATININA", "88", ctx), null);
    });

    await t.casoAsync("_contextoOficialParaLabs: entrega la tabla que el oyente capturó de Everest", async () => {
      const c = cargar({ silencioso: true, fetch: async () => { throw new Error("sin demografía"); } });
      c.api._guardarTablaOficialVista(TABLA);
      const ctx = await c.api._contextoOficialParaLabs("1234567890");
      t.igual(ctx.tablaOficial.length, TABLA.length, "la tabla escuchada llega al camino de escritura");
      // Aunque la demografía falle, la tabla sirve igual para los exámenes que no acotan
      // por edad — que en la tabla real son 27 de 28.
      t.cierto(!!c.api._objecionOficialAlValor("CREATININA", "88", ctx),
        "sin demografía, la creatinina se sigue pudiendo juzgar: su regla no depende de la edad");
    });

    // ---------- la latencia del clic ----------

    await t.casoAsync("apiAccesoBuscarPaciente se cachea por cédula — el clic de Auto-Labs no repite la cascada", async () => {
      // v14.1.8 metió esta búsqueda en el camino del clic, y la búsqueda prueba rutas EN
      // CASCADA: hasta 4 peticiones secuenciales antes de escribir la primera casilla,
      // encima de los 2-4 s que el médico ya esperó a Athenea. La relación cédula → id
      // interno no cambia, así que repetirla es puro coste.
      let llamadas = 0;
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          llamadas++;
          return { ok: true, status: 200, json: async () => ({ idPaciente: 4242 }), text: async () => "{}" };
        },
      });
      t.igual(await c.api.apiAccesoBuscarPaciente("1234567890"), 4242);
      const tras1 = llamadas;
      t.cierto(tras1 >= 1, "la primera vez sí consulta");
      t.igual(await c.api.apiAccesoBuscarPaciente("1234567890"), 4242, "y devuelve lo mismo");
      t.igual(llamadas, tras1, "la segunda vez NO vuelve a salir a la red");
      // Otra cédula es otro paciente: no puede heredar el id de la anterior.
      await c.api.apiAccesoBuscarPaciente("9876543210");
      t.cierto(llamadas > tras1, "una cédula DISTINTA sí dispara consulta nueva — jamás se mezclan pacientes");
    });

    await t.casoAsync("un fallo NO se cachea: el médico tiene que poder reintentar en el acto", async () => {
      // Un `null` significa "no se pudo" —red caída, sesión de Everest vencida, paciente
      // que aún no existe—, y eso cambia de un momento a otro. Cachearlo dejaría al médico
      // sin poder reintentar hasta que venciera el TTL, que es justo cuando más urge.
      let llamadas = 0;
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => { if (o && o.onerror) o.onerror(new Error("red")); },
        fetch: async () => { llamadas++; return { ok: false, status: 500, json: async () => null, text: async () => "" }; },
      });
      t.igual(await c.api.apiAccesoBuscarPaciente("1234567890"), null);
      const tras1 = llamadas;
      t.igual(await c.api.apiAccesoBuscarPaciente("1234567890"), null);
      t.cierto(llamadas > tras1, "tras un fallo, el siguiente intento SÍ vuelve a consultar");
    });

    // ---------- el identificador de la cita va codificado ----------

    t.caso("_base64SinRelleno reproduce lo que Everest manda de verdad", () => {
      // La captura real trae `citaId=MTIyMTk3NA`, que es base64 de "1221974" con el
      // relleno quitado. Mandar el número en claro pedía una cita que no existe.
      t.igual(api._base64SinRelleno("1221974"), "MTIyMTk3NA", "exactamente lo observado en el tráfico");
      t.igual(api._base64SinRelleno(1221974), "MTIyMTk3NA", "un número también vale: se convierte a texto");
      t.igual(api._base64SinRelleno(""), "");
      t.igual(api._base64SinRelleno(null), "");
      t.igual(api._base64SinRelleno(undefined), "");
      t.igual(/=/.test(api._base64SinRelleno("1")), false, "nunca se manda el relleno '='");
    });

    await t.casoAsync("la consulta manda el citaId CODIFICADO — en claro el servidor no encuentra la cita", async () => {
      // Esta prueba existe porque su ausencia dejó pasar el bug: la prueba de caché
      // comprobaba `url.includes("citaId=111")` y, al empezar a codificar, dejó de casar
      // en silencio sin que ninguna aserción se pusiera roja.
      let vistas = [];
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          vistas.push(String(url));
          return { ok: true, status: 200, json: async () => [{ codigoExamen: "CREATININA" }], text: async () => "[]" };
        },
      });
      await c.api.apiHcValidacionExamenCronicos("1221974");
      t.igual(vistas.length, 1);
      t.cierto(vistas[0].indexOf("citaId=MTIyMTk3NA") !== -1,
        "el citaId viaja en base64, como en la captura real: " + vistas[0]);
      t.igual(vistas[0].indexOf("citaId=1221974"), -1, "y NUNCA en claro");
    });
  },
};
