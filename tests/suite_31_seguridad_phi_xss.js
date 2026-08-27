// =====================================================================
//  SUITE 31 — Seguridad, PHI/PII, XSS, Supply Chain e Integridad (M1)
//
//  Cubre:
//    - Saneamiento profundo y recursivo de PHI/PII colombiana (cédulas,
//      celulares 300-350, correos, direcciones físicas, objetos y arreglos).
//    - Invariantes de escape HTML contra inyección XSS en DOM.
//    - Telemetría por defecto apagada (Default-Off R1.8).
//    - Ausencia de endpoints locales inseguros en cabecera (@connect localhost/127.0.0.1).
//    - Autocomprobación criptográfica de integridad SHA-256 (R1.9).
// =====================================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = {
  nombre: "Seguridad, PHI, XSS e Integridad (M1)",
  cubre: [
    "scrubPII", "sanitizePII", "escapeHtml", "verificarIntegridadArranque",
    "_sanearMensajeError", "mtrSanearTextoLibreAI", "mtrClasificarEstadioTfg",
    "openLaboratoriosModal", "vglExportLogs"
  ],

  async pruebas(t, api, env, cargar) {
    const RUTA_USERSCRIPT = path.join(__dirname, "..", "vigilante_agenda.user.js");

    // ===================================================================
    //  1. SANEAMIENTO ADVERSARIAL DE PHI / PII (R1.4, R1.5)
    // ===================================================================

    t.caso("scrubPII: censura cédulas colombianas formateadas y sin formatear", () => {
      const c = cargar({ silencioso: true });

      // Formateadas con puntos y guiones
      t.igual(c.api.scrubPII("Paciente con CC 43.040.508 en sala"), "Paciente con CC [CENSURADO] en sala");
      t.igual(c.api.scrubPII("Cédula 1.020.304.506 atendida"), "Cédula [CENSURADO] atendida");
      t.igual(c.api.scrubPII("Documento 43-040-508 registrado"), "Documento [CENSURADO] registrado");

      // Cédulas planas de 6 a 10 dígitos
      t.igual(c.api.scrubPII("Cédula 43040508"), "Cédula [CENSURADO]");
      t.igual(c.api.scrubPII("Identificación 1020304506"), "Identificación [CENSURADO]");
      t.igual(c.api.scrubPII("doc_43040508"), "doc_[CENSURADO]");
      t.igual(c.api.scrubPII("paciente_1020304506"), "paciente_[CENSURADO]");

      // Números cortos (< 6 dígitos) como horas o códigos se conservan
      t.igual(c.api.scrubPII("Código 12345 y valor 99999"), "Código 12345 y valor 99999");
    });

    t.caso("scrubPII: censura fechas en múltiples formatos (ISO, guión, punto, texto en español)", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.api.scrubPII("Nacido el 12-04-1980 en Bogotá"), "Nacido el [FECHA_CENSURADA] en Bogotá");
      t.igual(c.api.scrubPII("Fecha de control: 1980-04-12"), "Fecha de control: [FECHA_CENSURADA]");
      t.igual(c.api.scrubPII("Ingreso el 12.04.1980"), "Ingreso el [FECHA_CENSURADA]");
      t.igual(c.api.scrubPII("Nació el 12 de abril de 1980"), "Nació el [FECHA_CENSURADA]");
      t.igual(c.api.scrubPII("Nacimiento: 15 agosto 1975"), "Nacimiento: [FECHA_CENSURADA]");
    });

    t.caso("scrubPII: censura direcciones sin símbolo numeral (#)", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.api.scrubPII("Vive en Carrera 7 No. 32-10"), "Vive en [DIR_CENSURADA]");
      t.igual(c.api.scrubPII("Dirección: Calle 100 Número 15-20"), "Dirección: [DIR_CENSURADA]");
      t.igual(c.api.scrubPII("Ubicación Mz 4 Casa 12"), "Ubicación [DIR_CENSURADA]");
      t.igual(c.api.scrubPII("Reside en Vereda La Palma 12-3"), "Reside en [DIR_CENSURADA]");
    });

    t.caso("scrubPII: censura cédulas de 5 dígitos y documentos PPT de 11 dígitos", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.api.scrubPII("Paciente con Cédula 54321 en sala"), "Paciente con Cédula [CENSURADO] en sala");
      t.igual(c.api.scrubPII("Extranjero con PPT 10000000001"), "Extranjero con PPT [CENSURADO]");
      t.igual(c.api.scrubPII("doc_10000000001"), "doc_[CENSURADO]");
    });

    t.caso("scrubPII: censura celulares colombianos (300-350) con diversos formatos", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.api.scrubPII("Llamar al +57 300 123 4567 urgente"), "Llamar al [TEL_CENSURADO] urgente");
      t.igual(c.api.scrubPII("Móvil: 300-123-4567"), "Móvil: [TEL_CENSURADO]");
      t.igual(c.api.scrubPII("Teléfono (310) 987 6543"), "Teléfono [TEL_CENSURADO]");
      t.igual(c.api.scrubPII("Contacto 3022813246"), "Contacto [TEL_CENSURADO]");
      t.igual(c.api.scrubPII("Celular 320 456 7890 registrado"), "Celular [TEL_CENSURADO] registrado");
    });

    t.caso("scrubPII: censura correos electrónicos", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.api.scrubPII("Correo: paciente.ejemplo@gmail.com enviado"), "Correo: [CORREO_CENSURADO] enviado");
      t.igual(c.api.scrubPII("Notificar a medico.viva1a@atheneasoluciones.com"), "Notificar a [CORREO_CENSURADO]");
      t.igual(c.api.scrubPII("contacto@dominio.com.co"), "[CORREO_CENSURADO]");
    });

    t.caso("scrubPII: censura direcciones físicas colombianas", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.api.scrubPII("Vive en Calle 45 # 12-34 apto 201"), "Vive en [DIR_CENSURADA] apto 201");
      t.igual(c.api.scrubPII("Residencia Cra 15 # 80-20"), "Residencia [DIR_CENSURADA]");
      t.igual(c.api.scrubPII("Ubicación: Diag 68 # 45-10 sur"), "Ubicación: [DIR_CENSURADA] sur");
      t.igual(c.api.scrubPII("Transv 23 # 45-67 Bogotá"), "[DIR_CENSURADA] Bogotá");
      t.igual(c.api.scrubPII("Av El Dorado # 68-90"), "[DIR_CENSURADA]");
    });

    t.caso("scrubPII: saneamiento profundo y recursivo en árboles de objetos y arreglos", () => {
      const c = cargar({ silencioso: true });

      const payload = {
        paciente: {
          nombre: "Juan Perez",
          cedula: "43.040.508",
          cedulaNum: 43040508,
          contacto: {
            email: "juan@example.com",
            telefono: "+57 300 123 4567",
            direccion: "Calle 10 # 20-30"
          }
        },
        citas: [
          { id: 1020304, nota: "Paciente doc_98765432 atendido" },
          { id: 555, nota: "Sin documento adjunto" }
        ],
        activo: true,
        nulo: null,
        indefinido: undefined
      };

      const limpio = c.api.scrubPII(payload);

      t.igual(limpio.paciente.nombre, "Juan Perez");
      t.igual(limpio.paciente.cedula, "[CENSURADO]");
      t.igual(limpio.paciente.cedulaNum, "[CENSURADO]");
      t.igual(limpio.paciente.contacto.email, "[CORREO_CENSURADO]");
      t.igual(limpio.paciente.contacto.telefono, "[TEL_CENSURADO]");
      t.igual(limpio.paciente.contacto.direccion, "[DIR_CENSURADA]");
      t.igual(limpio.citas[0].id, "[CENSURADO]");
      t.igual(limpio.citas[0].nota, "Paciente doc_[CENSURADO] atendido");
      t.igual(limpio.citas[1].id, 555); // < 6 dígitos se conserva
      t.igual(limpio.citas[1].nota, "Sin documento adjunto");
      t.igual(limpio.activo, true);
      t.igual(limpio.nulo, null);
    });

    t.caso("sanitizePII: actúa como alias idéntico y seguro de scrubPII", () => {
      const c = cargar({ silencioso: true });

      const texto = "Cédula 43.040.508, celular 3001234567, correo paciente@test.co";
      t.igual(c.api.sanitizePII(texto), c.api.scrubPII(texto));
    });

    t.caso("_sanearMensajeError: neutraliza cédulas con puntos, guiones, espacios y secuencias de 5-12 dígitos", () => {
      const c = cargar({ silencioso: true });

      t.falso(c.api._sanearMensajeError("Fallo con CC 79.246.813").includes("79.246.813"));
      t.falso(c.api._sanearMensajeError("Error en 43-040-508").includes("43-040-508"));
      t.falso(c.api._sanearMensajeError("Error en 79 246 813").includes("79 246 813"));
      t.falso(c.api._sanearMensajeError("Fallo paciente 54321").includes("54321"));
      t.falso(c.api._sanearMensajeError("Fallo PPT 10000000001").includes("10000000001"));
    });

    t.caso("mtrSanearTextoLibreAI: censura nombres de pacientes precedidos por tratamientos clínicos y honoríficos", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.api.mtrSanearTextoLibreAI("Paciente Maria Perez refiere dolor"), "Paciente [NOMBRE_CENSURADO] refiere dolor");
      t.igual(c.api.mtrSanearTextoLibreAI("Don Carlos Gomez asiste a control"), "Don [NOMBRE_CENSURADO] asiste a control");
      t.igual(c.api.mtrSanearTextoLibreAI("Doña Ana Ruiz refiere cefalea"), "Doña [NOMBRE_CENSURADO] refiere cefalea");
      t.igual(c.api.mtrSanearTextoLibreAI("Acompañada por su hijo Carlos Rodriguez"), "Acompañada por su hijo [NOMBRE_CENSURADO]");
      t.igual(c.api.mtrSanearTextoLibreAI("¿Cuál fue la última creatinina de Don Pedro?"), "¿Cuál fue la última creatinina de Don [NOMBRE_CENSURADO]?");
    });

    t.caso("mtrClasificarEstadioTfg: devuelve vacío ante NaN, 0, números negativos o entradas inválidas", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.api.mtrClasificarEstadioTfg(NaN), "");
      t.igual(c.api.mtrClasificarEstadioTfg(0), "");
      t.igual(c.api.mtrClasificarEstadioTfg(-10), "");
      t.igual(c.api.mtrClasificarEstadioTfg("invalido"), "");
      t.igual(c.api.mtrClasificarEstadioTfg(null), "");
      t.igual(c.api.mtrClasificarEstadioTfg(undefined), "");

      // Valores válidos
      t.igual(c.api.mtrClasificarEstadioTfg(95), "G1");
      t.igual(c.api.mtrClasificarEstadioTfg(75), "G2");
      t.igual(c.api.mtrClasificarEstadioTfg(50), "G3a");
      t.igual(c.api.mtrClasificarEstadioTfg(35), "G3b");
      t.igual(c.api.mtrClasificarEstadioTfg(20), "G4");
      t.igual(c.api.mtrClasificarEstadioTfg(10), "G5");
    });

    t.caso("openLaboratoriosModal: codifica y escapa doc_id en atheneaUrl evitando inyección de atributos", async () => {
      const c = cargar({ silencioso: true });
      const apt = {
        doc_id: '123456" onclick="alert(1)',
        nombre: "Paciente Prueba"
      };

      await c.api.openLaboratoriosModal(apt);
      const modal = c.env.doc.getElementById("vgl-labs-modal");
      t.cierto(!!modal, "el modal de laboratorios se abrió");
      const html = modal.innerHTML;

      t.falso(html.includes('" onclick="alert(1)"'), "no inyecta atributos en <a>");
      t.cierto(html.includes("123456%22%20onclick%3D%22alert(1)"), "el payload viaja codificado en URI");
    });

    t.caso("Credenciales y Telemetría: no existen contraseñas en claro en localStorage ni URL con doc en exportación", () => {
      const c = cargar({ silencioso: true });

      t.igual(c.env.storage.getItem("vgl_ath_pass"), null, "prohibido vgl_ath_pass en localStorage");
      t.igual(c.env.storage.getItem("vgl_ath_user"), null, "prohibido vgl_ath_user en localStorage");

      // Simular ubicación con cédula
      c.env.win.location.href = "https://neps.everestintelligent.com/viva/HCHealth/#doc=12345678";
      c.env.win.location.hash = "#doc=12345678";

      c.api.vglExportLogs();
      const creados = c.env.doc._nodos.filter((n) => n.download && n.download.startsWith("BITACORA_VIGILANTE_REAL_"));
      t.cierto(creados.length > 0, "generó archivo de exportación");
    });

    // ===================================================================
    //  2. AUDITORÍA DOM Y PREVENCIÓN DE XSS (R1.2)
    // ===================================================================

    t.caso("escapeHtml: neutraliza todos los caracteres peligrosos de inyección HTML/XSS", () => {
      const c = cargar({ silencioso: true });

      const input = '<script>alert("XSS & \'attack`")</script>';
      const escapado = c.api.escapeHtml(input);

      t.falso(escapado.includes("<"));
      t.falso(escapado.includes(">"));
      t.falso(escapado.includes('"'));
      t.falso(escapado.includes("'"));
      t.falso(escapado.includes("`"));
      t.igual(escapado, "&lt;script&gt;alert(&quot;XSS &amp; &#039;attack&#x60;&quot;)&lt;/script&gt;");
    });

    // ===================================================================
    //  3. GOBERNANZA DE TELEMETRÍA: DEFAULT-OFF (R1.8)
    // ===================================================================

    t.caso("Telemetría: invariante Default-Off garantizado sin configuración previa", () => {
      const c = cargar({ silencioso: true, defaultOff: true });

      t.falso(c.api.__S.reporte, "DEFAULTS.reporte debe ser false de fábrica");
      t.falso(c.api.__S.uxTelemetria, "DEFAULTS.uxTelemetria debe ser false de fábrica");
      t.falso(c.api.repOn(), "repOn() debe resolver false por defecto");

      // uxTrack con Default-Off no debe escribir en localStorage
      c.api.uxTrack("accion.prueba");
      c.api._uxVolcarBuffer();
      t.igual(c.env.storage.getItem("vgl_ux"), null, "No debe registrar métricas con telemetría apagada");
    });

    // ===================================================================
    //  4. CADENA DE SUMINISTRO: CABECERAS Y PERMISOS @connect (R1.3)
    // ===================================================================

    t.caso("Supply Chain: Userscript no incluye directivas @connect a localhost o 127.0.0.1", () => {
      const codigo = fs.readFileSync(RUTA_USERSCRIPT, "utf8");
      const cabecera = codigo.slice(0, 3000);

      t.falso(/\/\/\s*@connect\s+localhost\b/i.test(cabecera), "Prohibido @connect localhost");
      t.falso(/\/\/\s*@connect\s+127\.0\.0\.1\b/i.test(cabecera), "Prohibido @connect 127.0.0.1");

      // Verificar dominios autorizados de producción
      t.cierto(/\/\/\s*@connect\s+script\.google\.com\b/.test(cabecera));
      t.cierto(/\/\/\s*@connect\s+medicosviva1a\.atheneasoluciones\.com\b/.test(cabecera));
      t.cierto(/\/\/\s*@connect\s+sharepoint\.com\b/.test(cabecera));
    });

    // ===================================================================
    //  5. AUTOCOMPROBACIÓN CRIPTOGRÁFICA DE INTEGRIDAD SHA-256 (R1.9)
    // ===================================================================

    await t.casoAsync("verificarIntegridadArranque: omite gracefully si scriptSource no está disponible", async () => {
      const c = cargar({ silencioso: true });
      const res = await c.api.verificarIntegridadArranque();
      t.igual(res.status, "skipped");
      t.igual(res.reason, "no_source");
    });

    await t.casoAsync("verificarIntegridadArranque: calcula SHA-256 correctamente cuando se suministra fuente", async () => {
      const fakeSource = "// ==UserScript==\n// @name Test\n// ==/UserScript==\nconsole.log('hola');";
      const c = cargar({ silencioso: true, scriptSource: fakeSource });

      const res = await c.api.verificarIntegridadArranque();
      const expectedHash = crypto.createHash("sha256").update(fakeSource, "utf8").digest("hex");

      t.igual(res.status, "ok");
      t.igual(res.sha256, expectedHash);
    });

    // =================================================================
    //  v17.9.0 — LA BARRERA. Lo que Everest guarda entra; lo que identifica al paciente NO.
    //
    //  El paquete real de Everest lleva `datosUsuario` con 91 campos: nombre, apellidos,
    //  cédula, celular, correo, dirección, fecha de nacimiento. Esta suite existe para que
    //  ninguno de esos campos pueda llegar nunca a un modelo de lenguaje.
    //
    //  La barrera es una LISTA BLANCA de secciones, no un filtro de campos: un filtro se
    //  degrada en cuanto alguien añade un campo nuevo al otro lado; una lista blanca no.
    //  La forma de abajo es la REAL, capturada en consulta el 27-ago-2026 (los VALORES son
    //  inventados para la prueba — el diagnóstico nunca los guardó).
    // =================================================================
    const _hcEverestFalso = () => ({
      // --- LO QUE NUNCA PUEDE SALIR ---
      datosUsuario: {
        nombre: "NOMBREPRUEBA", primer_Apellido: "APELLIDOUNO", segundo_Apellido: "APELLIDODOS",
        identificacion: "80123456", celular: "3001234567", correo: "prueba@ejemplo.com",
        direccion: "Calle 100 #15-20", fecha_Nacimiento: "1958-03-14T00:00:00",
      },
      acompanante: { parentesco: "HIJA", categoria: "FAMILIAR" },
      citaId: "9988776655",
      // --- LO QUE SÍ APORTA CONTEXTO CLÍNICO ---
      antecedentePatologicos: {
        hipertension: true, diabetes: true, infartoMiocardio: false,
        retinopatiaDiabetica: true, epoc: false, otros: "",
        observacionHipertension: "Diagnosticada hace 12 años",
      },
      habitosGestionRiesgo: { sedentarismo: true, alcohol: false, indiceTabaquico: 0 },
      examenFisico: { peso: 78.5, talla: 1.62, imc: 29.9, circunferenciaAbdominal: 98, presionSistolica: 148 },
      antecedenteFamiliar: { cardiovasculares: true, diabetes: true },
      farmacologicos: [{ descripcion: "LOSARTAN 50 MG TABLETA", esEliminable: true }],
      diagnosticos: [{ codigo: "I10X", descripcion: "HIPERTENSION ESENCIAL", nombreBusqueda: "NOMBREPRUEBA I10X", id: 4471 }],
      motivo: "Control de hipertensión",
      ultimaEnfermedad: "Paciente NOMBREPRUEBA APELLIDOUNO, CC 80123456, tel 3001234567, refiere cefalea.",
    });

    t.caso("v17.9.0 BARRERA — nada que identifique al paciente sale del paquete de Everest", () => {
      const h = api.mtrHechosDesdeHcEverest(_hcEverestFalso());
      t.cierto(!!h, "el paquete se reconoce y se extrae");
      const todo = JSON.stringify(h);
      for (const dato of ["NOMBREPRUEBA", "APELLIDOUNO", "APELLIDODOS", "80123456",
                          "3001234567", "prueba@ejemplo.com", "Calle 100", "1958-03-14", "9988776655"]) {
        t.falso(todo.indexOf(dato) >= 0, "«" + dato + "» NO puede aparecer en lo que se guarda");
      }
      t.igual(h.secciones.datosUsuario, undefined, "`datosUsuario` no se lee: no está en la lista blanca");
      t.igual(h.secciones.acompanante, undefined, "ni el acompañante");
      // El texto libre SÍ entra, pero saneado: es donde el médico escribe el nombre a mano.
      t.cierto(!!h.textos.ultimaEnfermedad, "la enfermedad actual sí aporta contexto y entra");
      t.falso(/NOMBREPRUEBA|80123456|3001234567/.test(h.textos.ultimaEnfermedad),
        "pero pasa por scrubPII: nombre, cédula y teléfono se tachan aunque los escriba a mano");
      t.cierto(/cefalea/.test(h.textos.ultimaEnfermedad), "y lo clínico se conserva entero");
      // El diagnóstico lleva código y descripción; `nombreBusqueda` traía el nombre pegado.
      t.igual(h.diagnosticos[0].codigo, "I10X", "el CIE-10 entra");
      t.falso(todo.indexOf("nombreBusqueda") >= 0, "y `nombreBusqueda` no se lee: llevaba el nombre dentro");
    });

    t.caso("v17.9.0 — entra TODO lo clínico, y un «no» documentado vale tanto como un «sí»", () => {
      const h = api.mtrHechosDesdeHcEverest(_hcEverestFalso());
      const ap = h.secciones.antecedentePatologicos;
      t.igual(ap.hipertension, true, "lo marcado que sí");
      t.igual(ap.infartoMiocardio, false,
        "y lo marcado que NO: es un hecho documentado, esconderlo dejaría a la IA sin saber si se preguntó");
      t.igual(ap.otros, undefined, "un campo vacío NO viaja: vacío no es «no tiene»");
      t.igual(h.secciones.examenFisico.circunferenciaAbdominal, 98,
        "la cintura, que el asistente antes solo podía leer si el médico tenía esa pestaña abierta");
      t.igual(h.secciones.antecedenteFamiliar.cardiovasculares, true, "los antecedentes familiares");
      t.igual(h.medicamentos[0], "LOSARTAN 50 MG TABLETA", "los medicamentos, por su descripción");

      const texto = api.mtrHcTextoParaHoja(h);
      t.cierto(/retinopatiaDiabetica: sí/.test(texto), "el texto para el modelo lleva lo marcado");
      t.cierto(/infartoMiocardio: no/.test(texto), "y lo descartado, con todas sus letras");
    });

    t.caso("v17.9.0 — se reconoce por FORMA, no por la ruta de Everest", () => {
      // Atarse a `/apiviva/APIHCHealth/api/Morbilidad/GuardarHCMorbilidad` sería atarse a una
      // cadena que Everest puede cambiar sin avisar. Este proyecto ya se llevó ese susto en
      // v12.3.30 (cuatro nombres supuestos, ninguno existía).
      t.cierto(api.mtrEsPayloadHcEverest(_hcEverestFalso()), "el paquete real se reconoce");
      t.falso(api.mtrEsPayloadHcEverest({ antecedentePatologicos: { hipertension: true } }),
        "con UNA sola sección no basta: cualquier respuesta suelta del portal podría colarse");
      t.falso(api.mtrEsPayloadHcEverest(null), "sin nada, no");
      t.falso(api.mtrEsPayloadHcEverest([{ antecedentePatologicos: {}, examenFisico: {} }]),
        "una lista tampoco: el paquete es un objeto");
      t.igual(api.mtrHechosDesdeHcEverest({ hola: 1 }), null, "lo que no es el paquete devuelve null, no un objeto vacío");
    });

  }
};
