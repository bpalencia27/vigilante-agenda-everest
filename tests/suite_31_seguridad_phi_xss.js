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
    // v17.16.0 — estas ya se ejercitaban en esta misma suite y NO estaban declaradas: el
    // informe de cobertura las listaba como «sin cubrir» y escondía cuáles son los huecos
    // de verdad. Un informe que subestima engaña igual que uno que exagera.
    "mtrRutaHcAceptada", "mtrHcTachaduras", "mtrHcTachar", "mtrHcValorLimpio", "_vglGuardarDeshacer", "_vglDeshacerDisponible", "_vglEjecutarDeshacer", "mtrEsPayloadHcEverest", "mtrHechosDesdeHcEverest", "mtrHcTextoParaHoja", "mtrHcLeer", "mtrCosecharHcDelDom", "mtrHcAcumularDelDom",
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
      // 02-sep — CIERRE ADVERSARIAL (fila 41): la forma de teléfono no tenía límite de dígito y
      // casaba DENTRO de un número más largo no relacionado: «930012345678» → «9[TEL_CENSURADO]8»
      // en la hoja de hechos (mtrHcValorLimpio → scrubPII), el mismo daño del hallazgo #38.
      t.igual(c.api.scrubPII("Se registra el numero de orden 930012345678 en el sistema."), "Se registra el numero de orden 930012345678 en el sistema.",
        "un número de 12 dígitos no es un celular ni contiene uno: no se parte");
      t.igual(c.api.scrubPII("orden 930012345678 y cel 3001234567."), "orden 930012345678 y cel [TEL_CENSURADO].",
        "y el celular de verdad, al lado, sí se tacha");
      const hechos = c.api.mtrHechosDesdeHcEverest({ antecedentePatologicos: { hta: true }, examenFisico: { peso: 70 }, ultimaEnfermedad: "Se registra el numero de orden 930012345678 en el sistema.", datosUsuario: { nombre: "PRUEBA", primer_Apellido: "SINTETICO", celular: "3001234567" } });
      t.falso(/TEL_CENSURADO/.test(String(hechos.textos.ultimaEnfermedad)), "de punta a punta (la hoja de hechos) el número de orden llega entero: " + hechos.textos.ultimaEnfermedad);
      // v18.0.103 — refutador de v18.0.101 (fila 41): con el límite de dígito, el indicativo
      // pegado y sin «+» («573001234567», formato WhatsApp) dejaba el celular ENTERO sin
      // tachar (antes salía al menos «57[TEL_CENSURADO]»). Cada límite con su propia cadena.
      t.igual(c.api.scrubPII("whatsapp 573001234567 fin"), "whatsapp [TEL_CENSURADO] fin", "indicativo 57 pegado, sin «+»: se tacha entero");
      t.igual(c.api.scrubPII("cel 0573001234567 fin"), "cel [TEL_CENSURADO] fin", "con el 0 de marcación también");
      t.igual(c.api.scrubPII("orden 300123456789 fin"), "orden 300123456789 fin", "un dígito de más al final: no es un celular (límite derecho)");
      t.igual(c.api.scrubPII("orden 123001234567 fin"), "orden 123001234567 fin", "dígitos ajenos delante: no es un celular (límite izquierdo)");
      const ws = c.api.mtrHechosDesdeHcEverest({ antecedentePatologicos: { hta: true }, examenFisico: { peso: 70 }, ultimaEnfermedad: "Se contacta por whatsapp al 573001234567 para control.", datosUsuario: { nombre: "PRUEBA", primer_Apellido: "SINTETICO", celular: "3001234567" } });
      t.falso(/3001234567/.test(String(ws.textos.ultimaEnfermedad)), "de punta a punta, el celular en formato WhatsApp no llega a la hoja de hechos: " + ws.textos.ultimaEnfermedad);
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

    // =================================================================
    //  v18.0.52 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta:
    //  EL APELLIDO REAL PODÍA LLEGAR INTACTO A GEMINI.
    //
    //  En texto EN MAYÚSCULAS SOSTENIDAS —el estilo real de Everest— la defensa por
    //  TOKENS es la única capaz de tachar el nombre: la de honoríficos exige mayúscula
    //  inicial + minúsculas y no puede actuar. Y tenía dos huecos:
    //    (1) `t.length >= 3` descartaba apellidos de dos letras (Li, Wu, Ng, Ho, Vo);
    //    (2) sin normalizar tildes, «Muñoz» no casaba con «MUNOZ» — y ese desajuste es la
    //        norma en cualquier sistema que pase el texto a ASCII.
    //
    //  Viola directamente la regla no negociable de CLAUDE.md: cero PHI.
    //  (Todos los nombres de esta prueba son ficticios.)
    // =================================================================
    t.caso("v18.0.52 PHI — un apellido de dos letras en MAYÚSCULAS también se tacha", () => {
      const c = cargar({ silencioso: true });
      const s = c.api.mtrSanearTextoLibreAI(
        "PACIENTE REFIERE QUE SEGUN LO CONVERSADO CON LA FAMILIA LI EN CASA, TOMA BIEN LOS MEDICAMENTOS.", "Li");
      t.falso(/\bLI\b/.test(s), "el apellido de dos letras NO puede quedar en el texto que va a Gemini: " + s);
      t.cierto(/\[NOMBRE_CENSURADO\]/.test(s), "y en su lugar queda la marca de censura");
      t.cierto(/TOMA BIEN LOS MEDICAMENTOS/.test(s), "lo clínico se conserva entero");
    });

    t.caso("v18.0.52 PHI — la tilde no puede ser un escondite, en las DOS direcciones", () => {
      const c = cargar({ silencioso: true });
      const sinTilde = c.api.mtrSanearTextoLibreAI("PACIENTE MUNOZ REFIERE ADHERENCIA COMPLETA.", "Muñoz");
      t.falso(/MUNOZ/.test(sinTilde), "nombre CON tilde, texto SIN tilde: se tacha igual — " + sinTilde);
      const conTilde = c.api.mtrSanearTextoLibreAI("PACIENTE MUÑOZ REFIERE ADHERENCIA COMPLETA.", "Munoz");
      t.falso(/MUÑOZ/.test(conTilde), "y al revés también — " + conTilde);
    });

    t.caso("v18.0.52 PHI — las partículas del apellido compuesto NO se censuran: destrozarían la nota", () => {
      // El hallazgo proponía bajar el filtro a 1 letra o quitarlo. Eso censuraría cada
      // «de» y cada «la» del texto clínico y lo dejaría ilegible — el defecto que ya costó
      // la v18.0.25 («la tachadura de nombres destrozaba el texto clínico»). Mínimo DOS
      // letras, menos las partículas, que no identifican a nadie por sí solas.
      const c = cargar({ silencioso: true });
      const s = c.api.mtrSanearTextoLibreAI(
        "PACIENTE DE LA CRUZ REFIERE DOLOR DE CABEZA DE LA MANANA.", "Pedro De La Cruz");
      t.falso(/\bCRUZ\b/.test(s), "el apellido que identifica sí se tacha: " + s);
      t.cierto(/DOLOR DE CABEZA DE LA MANANA/.test(s),
        "y el texto clínico queda entero: ni un «de» ni un «la» censurado — " + s);
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

    // =================================================================
    //  v18.0.45 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta:
    //  FUGA DE PHI EN EL ARCHIVO QUE SE LLAMA "SANITIZADO".
    //
    //  `san()` (dentro de downloadDiagnostic) tacha con "···" todo el TEXTO visible de la
    //  tarjeta —y esta misma suite ya lo comprobaba—, pero de los atributos solo vaciaba
    //  los `data-*`: los cinco de KEEP (class, role, routerlink, type, name) se conservaban
    //  con su VALOR ORIGINAL. Angular escribe rutas como `[routerLink]="['/paciente',
    //  doc.cedula]"`, así que la cédula podía viajar CRUDA en un archivo que el médico
    //  descarga creyéndolo sanitizado y que puede salir de la clínica.
    //
    //  Todos los identificadores de esta prueba son SINTÉTICOS.
    // =================================================================
    t.caso("el diagnóstico «sanitizado» no deja pasar una cédula dentro de un atributo conservado", () => {
      const f = api._diagValorAtributoSeguro;
      // Lo que motivó el hallazgo: la ruta de Angular con el documento dentro.
      t.igual(f("/Paciente/1122334455"), "/Paciente/···",
        "la corrida de dígitos se va y la FORMA de la ruta se queda: eso es lo que hace útil el diagnóstico");
      t.igual(f("paciente_987654321"), "paciente_···", "y también en el atributo name");
      t.igual(f("/hc/1122334455/lab/98765"), "/hc/···/lab/···", "todas las corridas, no solo la primera");
      // Lo que NO se puede romper: el diagnóstico existe para ver la estructura del DOM.
      t.igual(f("card patient-link"), "card patient-link", "las clases no se tocan");
      t.igual(f("col-6"), "col-6", "ni los números cortos de una rejilla CSS");
      t.igual(f(null), "", "sin valor, cadena vacía — nunca «null» en el archivo");
      t.igual(f(undefined), "", "ni «undefined»");
    });

    t.caso("y ningún atributo conservado se escribe de vuelta sin pasar por ese saneador", () => {
      // Comprobación ESTRUCTURAL, y se dice que lo es: el DOM del banco no tiene cloneNode
      // ni atributos iterables, así que `san()` entera no se puede ejecutar aquí — que es
      // exactamente por lo que este camino nunca se había probado. Lo que sí se puede fijar
      // es que la rama que devuelve un atributo de KEEP a su elemento pase por el saneador,
      // que es la línea que el hallazgo pedía.
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const m = src.match(/if \(!KEEP\.has\(a\.name\)[\s\S]{0,400}?\}\);/);
      t.cierto(!!m, "se encontró la rama de atributos de san()");
      t.cierto(/else x\.setAttribute\(a\.name, _diagValorAtributoSeguro\(a\.value\)\);/.test(m[0]),
        "el atributo conservado se reescribe saneado, no con su valor original: " + m[0].slice(-160));
    });

    await t.casoAsync("openLaboratoriosModal: codifica y escapa doc_id en atheneaUrl evitando inyección de atributos", async () => {
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
    //  3. GOBERNANZA DE TELEMETRÍA (v17.58.2 — política del dueño)
    // ===================================================================

    t.caso("Telemetría: nace ENCENDIDA por política del dueño (v17.58.2); el forzado gana a una config guardada con false", () => {
      // v17.58.2 — decisión del dueño (29-ago): la telemetría es el precio de usar el
      // script gratis. Nace encendida y NO se puede desactivar: aunque un equipo tenga
      // vgl_cfg con `false` guardado, S la fuerza a true en cada arranque.
      const c = cargar({ silencioso: true, defaultOff: true });
      t.cierto(c.api.__S.reporte, "DEFAULTS.reporte = true (v17.58.2: telemetría obligatoria)");
      t.cierto(c.api.__S.uxTelemetria, "DEFAULTS.uxTelemetria = true (idem)");
      t.cierto(c.api.repOn(), "repOn() resuelve true por defecto");

      const conFalse = cargar({ silencioso: true, defaultOff: true, almacen: { vgl_cfg: JSON.stringify({ reporte: false, uxTelemetria: false }) } });
      t.cierto(conFalse.api.__S.reporte, "el forzado gana a una config guardada con reporte=false");
      t.cierto(conFalse.api.__S.uxTelemetria, "el forzado gana a una config guardada con uxTelemetria=false");

      // La telemetría registra (obligatoria), pero lo que registra sigue siendo el conteo
      // anónimo de una acción de nuestro catálogo — el saneo PHI no depende del interruptor.
      c.api.uxTrack("accion.prueba");
      c.api._uxVolcarBuffer();
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.cierto(!!ux && !!ux.acciones && !!ux.acciones["accion.prueba"], "la métrica anónima se registra (telemetría obligatoria)");
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

    // =================================================================
    //  v18.0.48 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta:
    //  LA HISTORIA SE ARCHIVABA BAJO EL PACIENTE QUE ESTUVIERA ABIERTO AL LLEGAR LA
    //  RESPUESTA, NO AQUEL PARA EL QUE SE PIDIÓ.
    //
    //  `mirar()` leía `extractPacienteAbierto()` en el momento de la LLEGADA. Entre la
    //  petición y la respuesta hay segundos de red, y Everest recarga la página al abrir
    //  un paciente: si el médico cambia de historia en ese lapso, los antecedentes,
    //  hábitos y examen físico del paciente ANTERIOR quedaban archivados bajo la cédula
    //  del NUEVO — y de ahí salen a alimentar al Redactor y al Panel.
    //
    //  Mismo defecto que v14.1.5 (laboratorios), v18.0.33 (Panel) y v18.0.34
    //  (agendamiento): se cierra con la misma guarda, `_pacienteSigueAbierto`.
    //  (Cédulas sintéticas.)
    // =================================================================
    const _domPaciente = (c, doc) => {
      const nodo = { textContent: "C.C. " + doc, closest: () => null };
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { textContent: "" } : null);
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [nodo] : []);
    };

    await t.casoAsync("v18.0.48 CRUCE — una historia que llega después de cambiar de paciente NO se archiva", async () => {
      const cuerpo = JSON.stringify(_hcEverestFalso());
      // El fetch de la red devuelve la historia; el enganche la lee sobre un CLON.
      const c = cargar({ silencioso: true, fetch: async () => ({ clone: () => ({ text: async () => cuerpo }) }) });
      _domPaciente(c, "111111");
      t.igual(c.api.extractPacienteAbierto(), "111111", "montaje: el paciente A está abierto");
      t.cierto(c.api.mtrHcEnganchar(), "el enganche se instala");

      // Se pide la historia con A abierto…
      const p = c.env.win.fetch("/api/HistoriaClinica", {});
      // …y ANTES de que la respuesta se procese, el médico abre al paciente B.
      _domPaciente(c, "222222");
      await p;
      await new Promise((r) => setTimeout(r, 0));   // que corra el .then del clone

      t.igual(c.api.mtrHcLeer("222222"), null, "la historia de A NO queda archivada bajo B");
      t.igual(c.api.mtrHcLeer("111111"), null, "y tampoco se archiva bajo A a ciegas: no se pudo confirmar que siguiera abierto");
    });

    await t.casoAsync("v18.0.48 CRUCE — sin cambio de paciente, la historia SÍ se archiva (la otra dirección)", async () => {
      const cuerpo = JSON.stringify(_hcEverestFalso());
      const c = cargar({ silencioso: true, fetch: async () => ({ clone: () => ({ text: async () => cuerpo }) }) });
      // v18.0.97 — el paciente abierto es el MISMO que declara el paquete (datosUsuario.
      // identificacion = 80123456): desde el cierre del enjambre la cédula del paquete
      // decide, y un paquete de otra cédula que la del paciente abierto se descarta.
      // Antes este montaje abría a «111111» con un paquete de «80123456» — dos personas.
      _domPaciente(c, "80123456");
      t.cierto(c.api.mtrHcEnganchar(), "el enganche se instala");
      await c.env.win.fetch("/api/HistoriaClinica", {});
      await new Promise((r) => setTimeout(r, 0));

      const guardado = c.api.mtrHcLeer("80123456");
      t.cierto(!!guardado, "con el mismo paciente abierto de punta a punta, la historia sí entra");
      t.cierto(!!(guardado && guardado.secciones && guardado.secciones.antecedentePatologicos),
        "y trae las secciones clínicas");
    });

    // v18.0.97 — CIERRE DEL ENJAMBRE (02-sep): la guarda de v18.0.48 tenía un hueco que un
    // auditor adversarial reprodujo: `idAlPedir && …` se cortocircuitaba cuando la cédula NO
    // se pudo leer al PEDIR (cabecera sin renderizar, justo la petición que Everest hace al
    // abrir el paciente) y la historia se archivaba bajo quien estuviera abierto AL LLEGAR.
    const _domSinCedula = (c) => {
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { textContent: "" } : null);
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = () => [];
    };
    await t.casoAsync("v18.0.97 CRUCE — cédula ILEGIBLE al pedir + paquete de otra persona: NO se archiva bajo quien esté abierto al llegar", async () => {
      const cuerpo = JSON.stringify(_hcEverestFalso());   // el paquete es de 80123456
      const c = cargar({ silencioso: true, fetch: async () => ({ clone: () => ({ text: async () => cuerpo }) }) });
      _domSinCedula(c);
      t.igual(c.api.extractPacienteAbierto(), "", "montaje: al pedir, la cédula no se puede leer");
      t.cierto(c.api.mtrHcEnganchar(), "el enganche se instala");
      const p = c.env.win.fetch("/api/HistoriaClinica", {});
      _domPaciente(c, "222222");                            // al llegar hay OTRO paciente abierto
      await p; await new Promise((r) => setTimeout(r, 0));
      t.igual(c.api.mtrHcLeer("222222"), null, "la historia de 80123456 NO queda archivada bajo 222222 — antes sí (el defecto original, de vuelta)");
      t.igual(c.api.mtrHcLeer("80123456"), null, "y tampoco bajo el suyo a ciegas: no estaba abierto");
    });
    // v18.0.104 — refutador de v18.0.97 (fila 8): desde que la cédula del paquete decide antes,
    // ninguna prueba llegaba a la guarda de v18.0.48 (`_pacienteSigueAbierto(idAlPedir)`): un
    // mutante que la borraba dejaba suite_31 en verde. Aquí el paquete NO trae cédula, la de
    // pantalla era legible al pedir y el paciente cambia antes de que llegue.
    await t.casoAsync("v18.0.104 CRUCE — paquete SIN cédula, legible al pedir y cambio de paciente al llegar: NO se archiva (la guarda de v18.0.48 sigue en pie)", async () => {
      const p = _hcEverestFalso(); delete p.datosUsuario;
      const cuerpo = JSON.stringify(p);
      const c = cargar({ silencioso: true, fetch: async () => ({ clone: () => ({ text: async () => cuerpo }) }) });
      _domPaciente(c, "111111");
      t.cierto(c.api.mtrHcEnganchar(), "el enganche se instala");
      const pr = c.env.win.fetch("/api/HistoriaClinica", {});
      _domPaciente(c, "222222");                            // cambió de paciente antes de que llegara
      await pr; await new Promise((r) => setTimeout(r, 0));
      t.igual(c.api.mtrHcLeer("222222"), null, "no se archiva bajo el que está abierto al llegar");
      t.igual(c.api.mtrHcLeer("111111"), null, "ni bajo el pedido a ciegas: ya no está abierto");
    });
    await t.casoAsync("v18.0.97 CRUCE — cédula ILEGIBLE al pedir, pero el paquete trae la del paciente abierto: SÍ se archiva (la captura «al abrir» sigue viva)", async () => {
      const cuerpo = JSON.stringify(_hcEverestFalso());
      const c = cargar({ silencioso: true, fetch: async () => ({ clone: () => ({ text: async () => cuerpo }) }) });
      _domSinCedula(c);
      t.cierto(c.api.mtrHcEnganchar(), "el enganche se instala");
      const p = c.env.win.fetch("/api/HistoriaClinica", {});
      _domPaciente(c, "80123456");                          // la cabecera ya se renderizó: es él
      await p; await new Promise((r) => setTimeout(r, 0));
      t.cierto(!!c.api.mtrHcLeer("80123456"), "el paquete dice de quién es y coincide con el abierto: se archiva");
    });
    await t.casoAsync("v18.0.97 CRUCE — cédula ILEGIBLE al pedir y paquete SIN cédula: no se archiva (no se sabe de quién es)", async () => {
      const sinId = _hcEverestFalso(); delete sinId.datosUsuario;
      const cuerpo = JSON.stringify(sinId);
      const c = cargar({ silencioso: true, fetch: async () => ({ clone: () => ({ text: async () => cuerpo }) }) });
      _domSinCedula(c);
      t.cierto(c.api.mtrHcEnganchar(), "el enganche se instala");
      const p = c.env.win.fetch("/api/HistoriaClinica", {});
      _domPaciente(c, "222222");
      await p; await new Promise((r) => setTimeout(r, 0));
      t.igual(c.api.mtrHcLeer("222222"), null, "sin cédula legible al pedir y sin cédula en el paquete, no se escribe — nunca se asume que es él");
    });

    t.caso("v18.0.97 PHI — un apellido que es palabra funcional del español (Ha, Su, Lo, Le, No) NO destroza la nota; uno que no lo es (Li) sí se tacha", () => {
      const c = cargar({ silencioso: true });
      const T = "PACIENTE HA TENIDO BUENA ADHERENCIA. NO HA PRESENTADO DOLOR. SE LE INDICA CONTINUAR SU TRATAMIENTO. LO REFIERE SIN CAMBIOS.";
      for (const n of ["Kim Ha", "Wang Su", "Chen Lo", "Nguyen Le", "Park No"]) {
        t.igual(c.api.mtrSanearTextoLibreAI(T, n), T, "con apellido «" + n.split(" ")[1] + "» el texto clínico queda entero (antes: «NO [NOMBRE_CENSURADO] PRESENTADO DOLOR»)");
      }
      const s = c.api.mtrSanearTextoLibreAI("LA FAMILIA LI EN CASA. " + T, "Ana Li");
      t.falso(/\bLI\b/.test(s), "«Li» no es palabra de la lengua: se tacha — " + s.slice(0, 40));
      t.cierto(s.indexOf(T) >= 0, "y el resto del texto queda entero");
    });

    t.caso("v18.0.97 PHI — el canal del paquete de Everest (mtrHcTachar) tolera tildes en las DOS direcciones, igual que el del texto libre", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrHcTachar("PACIENTE MUNOZ REFIERE. Munoz sin cambios.", ["MUÑOZ"]),
        "PACIENTE [CENSURADO] REFIERE. [CENSURADO] sin cambios.", "«MUÑOZ» registrado tacha «MUNOZ» escrito");
      t.igual(c.api.mtrHcTachar("PACIENTE MUÑOZ REFIERE.", ["MUNOZ"]), "PACIENTE [CENSURADO] REFIERE.", "y al revés");
      t.igual(c.api.mtrHcTachar("ANASARCA y ANA", ["ANA"]), "ANASARCA y [CENSURADO]", "el límite de palabra de la v18.0.25 sigue intacto");
      t.igual(c.api.mtrHcTachar("cel 3001234567 orden 930012345678", ["3001234567"]), "cel [CENSURADO] orden 930012345678", "y el límite de dígito de la v18.0.86 también");
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


    // =================================================================
    //  v17.10.0 — LA HISTORIA SE LEE MIENTRAS SE ESCRIBE
    //  Rechazo explícito del médico a la v17.9.0: «no me sirve para la siguiente cita (…)
    //  deben estar alimentados por ese json INCLUSO ANTES DE GUARDAR, porque la idea es
    //  poder redactar en tiempo real (…) que se actualice a medida que se vaya llenando».
    // =================================================================
    const _domHc = (campos) => {
      const nodos = [];
      for (const n of Object.keys(campos)) {
        const v = campos[n];
        if (v === true || v === false) {
          nodos.push({ name: n, value: "true", checked: v === true, type: "radio" },
                     { name: n, value: "false", checked: v === false, type: "radio" });
        } else {
          nodos.push({ name: n, value: String(v), type: "text" });
        }
      }
      return {
        querySelectorAll(sel) {
          const s = String(sel);
          const m = /^input\[name="(.*)"\]$/.exec(s);
          if (m) return nodos.filter((x) => x.name === m[1]);
          if (s.indexOf("[name]") >= 0) return nodos;
          return [];
        },
      };
    };

    t.caso("v17.10.0 — se cosecha TODA la pantalla, no las 25 casillas de siempre", () => {
      const d = _domHc({
        "AntecedentePatologicos.Hipertension": true,
        "AntecedentePatologicos.infartoMiocardio": false,
        "AntecedentePatologicos.retinopatiaDiabetica": true,   // NO está en MTR_CAMPOS_FACTORES
        "signosVitales.peso": "78.5",
        "signosVitales.perimetroAbdominal": "98",
        "gineco.fur": "2026-07-14",
        "hs.HabitosGestionRiesgo.sedentarismo": true,
      });
      const c = api.mtrCosecharHcDelDom(d);
      t.igual(c["AntecedentePatologicos.Hipertension"], true, "lo marcado que sí");
      t.igual(c["AntecedentePatologicos.infartoMiocardio"], false,
        "y lo marcado que NO: es un hecho documentado");
      t.igual(c["AntecedentePatologicos.retinopatiaDiabetica"], true,
        "incluida una casilla que el clasificador NO conocía: antes era invisible para todo el script");
      t.igual(c["signosVitales.peso"], 78.5, "los números salen como números, no como texto");
      t.igual(c["gineco.fur"], "2026-07-14", "y las fechas tal cual");
      t.cierto(Object.keys(c).length >= 7, "se cosecha la pantalla entera, no una lista corta");
    });

    t.caso("v17.10.0 BARRERA — la cosecha en vivo tampoco toca lo que identifica al paciente", () => {
      const d = _domHc({
        "AntecedentePatologicos.Hipertension": true,
        "signosVitales.peso": "78.5",
        // Lo que NO puede entrar, aunque esté en la misma pantalla:
        "datosUsuario.nombre": "NOMBREPRUEBA",
        "datosUsuario.identificacion": "80123456",
        "paciente.celular": "3001234567",
        "usuario.correo": "prueba@ejemplo.com",
        "acompanante.parentesco": "HIJA",
      });
      const c = api.mtrCosecharHcDelDom(d);
      const todo = JSON.stringify(c);
      for (const x of ["NOMBREPRUEBA", "80123456", "3001234567", "prueba@ejemplo.com", "HIJA"]) {
        t.falso(todo.indexOf(x) >= 0, "«" + x + "» no puede cosecharse de la pantalla");
      }
      t.igual(c["signosVitales.peso"], 78.5, "y lo clínico de la misma pantalla sí entra");
    });

    t.caso("v17.10.0 — una casilla en blanco NO se convierte en un «no»", () => {
      // Un grupo de radios sin ninguno marcado es una pregunta SIN RESPONDER. Convertirlo
      // en «no» sería inventar una respuesta que nadie dio — la regla fundacional del
      // proyecto, aplicada a la cosecha.
      const d = {
        querySelectorAll(sel) {
          const nodos = [
            { name: "AntecedentePatologicos.epoc", value: "true", checked: false, type: "radio" },
            { name: "AntecedentePatologicos.epoc", value: "false", checked: false, type: "radio" },
          ];
          const m = /^input\[name="(.*)"\]$/.exec(String(sel));
          if (m) return nodos.filter((x) => x.name === m[1]);
          if (String(sel).indexOf("[name]") >= 0) return nodos;
          return [];
        },
      };
      const c = api.mtrCosecharHcDelDom(d);
      t.igual(c["AntecedentePatologicos.epoc"], undefined,
        "en blanco es en blanco: no viaja ni como sí ni como no");
    });

    t.caso("v17.10.0 — lo de la pestaña anterior no se pierde al cambiar de pestaña", () => {
      // Angular destruye la pestaña anterior con *ngIf: releerla daría vacío, y vacío NO es
      // «el médico lo borró». Por eso se acumula en vez de reemplazar.
      const c2 = cargar({ silencioso: true });
      const DOC = "555444333";
      const gebP = c2.env.doc.getElementById.bind(c2.env.doc);
      c2.env.doc.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebP(id)));

      const conCedula = (nodos) => (sel) => {
        const s = String(sel);
        if (s === ".text-muted") return [{ textContent: "CC " + DOC, closest: () => null }];
        const m = /^input\[name="(.*)"\]$/.exec(s);
        if (m) return nodos.filter((x) => x.name === m[1]);
        if (s.indexOf("[name]") >= 0) return nodos;
        return [];
      };
      const radios = (n, v) => ([{ name: n, value: "true", checked: v === true, type: "radio" },
                                 { name: n, value: "false", checked: v === false, type: "radio" }]);

      // Pestaña 1: Antecedentes.
      c2.env.doc.querySelectorAll = conCedula(radios("AntecedentePatologicos.Hipertension", true));
      c2.api.mtrHcAcumularDelDom(DOC, c2.env.doc);
      // Pestaña 2: Hábitos. La anterior ya no está en el DOM.
      c2.env.doc.querySelectorAll = conCedula(radios("hs.HabitosGestionRiesgo.sedentarismo", true));
      c2.api.mtrHcAcumularDelDom(DOC, c2.env.doc);

      const guardado = (c2.api.mtrHcLeer(DOC) || {}).dom || {};
      t.igual(guardado["AntecedentePatologicos.Hipertension"], true,
        "lo de Antecedentes sigue ahí aunque esa pestaña ya no exista en el DOM");
      t.igual(guardado["hs.HabitosGestionRiesgo.sedentarismo"], true, "y lo de Hábitos también");
    });

    t.caso("v17.10.0 — lo cosechado en vivo llega al texto que ve la IA", () => {
      // Probar la pieza no es probar que la pieza está conectada.
      const hoja = api.mtrHojaDeHechos({ factores: { edad: 66, sexo: "F" } }, {
        hoyIso: "2026-08-27",
        hcEverest: { dom: {
          "AntecedentePatologicos.retinopatiaDiabetica": true,
          "AntecedentePatologicos.infartoMiocardio": false,
          "signosVitales.perimetroAbdominal": 98,
        } },
      });
      t.cierto(!!hoja.hcEverest, "el bloque viaja en la hoja aunque solo traiga la cosecha en vivo");
      const txt = api.mtrHojaDeHechosTexto(hoja);
      // A7 (S+, 02-sep): el rótulo ya no afirma «de HOY» — la cosecha se acumula entre
      // pestañas, no se borra sola y Everest pre-llena campos de consultas anteriores.
      t.cierto(/escrito en la historia de Everest/.test(txt), "y se marca como lo escrito en la historia de Everest");
      t.falso(/escrito en la historia de HOY/.test(txt), "pero ya no lo rotula como de HOY: puede venir pre-llenado de antes y no hay fecha por campo");
      t.cierto(/retinopatiaDiabetica: sí/.test(txt), "lo marcado llega al modelo");
      t.cierto(/infartoMiocardio: no/.test(txt), "y lo descartado también");
      t.cierto(/perimetroAbdominal: 98/.test(txt), "con sus números");
    });


    t.caso("v17.10.0 CABLEADO — el reloj que vigila la pantalla dispara la cosecha de verdad", () => {
      // Probar la pieza no es probar que la pieza está conectada. La mutación que
      // desconectaba `mtrHcAcumularDelDom` de `_vglCosecharDePantalla` NO hacía caer ninguna
      // prueba: todas le pasaban el bloque ya cosechado a mano. Esta lo exige de verdad —
      // se llama al mismo punto que dispara el router de Everest y se mira el almacén.
      const cC = cargar({ silencioso: true });
      const DOC = "777888999";
      const gebP = cC.env.doc.getElementById.bind(cC.env.doc);
      cC.env.doc.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebP(id)));
      const nodos = [
        { name: "AntecedentePatologicos.retinopatiaDiabetica", value: "true", checked: true, type: "radio" },
        { name: "AntecedentePatologicos.retinopatiaDiabetica", value: "false", checked: false, type: "radio" },
        { name: "signosVitales.perimetroAbdominal", value: "98", type: "text" },
      ];
      cC.env.doc.querySelectorAll = (sel) => {
        const s = String(sel);
        if (s === ".text-muted") return [{ textContent: "CC " + DOC, closest: () => null }];
        const m = /^input\[name="(.*)"\]$/.exec(s);
        if (m) return nodos.filter((x) => x.name === m[1]);
        if (s.indexOf("[name]") >= 0) return nodos;
        return [];
      };

      t.igual(cC.api.mtrHcLeer(DOC), null, "antes de cosechar no hay nada guardado de este paciente");
      cC.api._vglCosecharDePantalla(DOC);
      const guardado = (cC.api.mtrHcLeer(DOC) || {}).dom || {};
      t.igual(guardado["AntecedentePatologicos.retinopatiaDiabetica"], true,
        "el reloj de pantalla tiene que dejar la cosecha guardada, o el resto no se entera de nada");
      t.igual(guardado["signosVitales.perimetroAbdominal"], 98, "con sus números");
    });


    t.caso("v17.12.0 — la escucha no rompe Everest: no toca peticiones ni consume respuestas", () => {
      // Lo único que puede hacer daño aquí es interferir con la aplicación del médico
      // mientras guarda una historia clínica. Dos garantías, fijadas por prueba:
      //  (1) el cuerpo del envío se lee, no se sustituye;
      //  (2) la respuesta se lee sobre un CLON — leer el cuerpo original dejaría a Everest
      //      sin poder leerlo, y la historia no cargaría.
      const fs = require("fs"), path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      // El bloque entero de la escucha: la ventana tiene que abarcar los dos enganches
      // (XHR y fetch), no solo el primero.
      // v18.0.48 — la ventana era `iEng + 6000`, un número mágico, y se rompió sola en
      // cuanto la función creció por un comentario: la prueba se puso roja sin que el
      // código estuviera mal, que es la peor forma de fallar (la siguiente persona sube el
      // número y no mira más). Ahora se corta por un ANCLA REAL —el bloque de comentario
      // que sigue a la función— y se comprueba que el ancla exista, para que un renombre
      // ponga la prueba en rojo por el motivo correcto en vez de medir un trozo cualquiera.
      const iEng = src.indexOf("function mtrHcEnganchar");
      const iFin = src.indexOf("v17.10.0 — LA HISTORIA SE LEE MIENTRAS SE ESCRIBE", iEng);
      t.cierto(iEng >= 0 && iFin > iEng, "el ancla que cierra la ventana sigue existiendo");
      const bloque = src.slice(iEng, iFin);
      t.cierto(/resp\.clone\(\)\.text\(\)/.test(bloque),
        "la respuesta se lee sobre un clon: sin esto Everest se queda sin su propio cuerpo");
      t.cierto(/return XHRsend\.apply\(this, arguments\)/.test(bloque),
        "el envío original se hace igual, con sus mismos argumentos");
      t.cierto(/return resp;/.test(bloque), "y la respuesta se devuelve intacta a quien la pidió");
      t.cierto(/xhr\.responseType && xhr\.responseType !== "text"/.test(bloque),
        "si Everest pidió otro tipo de respuesta, no se toca: leer responseText ahí lanzaría");
      // Y que la respuesta del XHR se LEA de verdad. Sin esta aserción, borrar la línea
      // dejaba la escucha de carga muerta y el banco seguía verde.
      // v18.0.48 — las dos llamadas asíncronas tienen que llevar AHORA la cédula que
      // estaba abierta al PEDIR la historia (ver el cruce de pacientes, más abajo). Se
      // exige el argumento: sin él vuelve a archivarse bajo quien esté abierto al llegar.
      t.cierto(/mirar\(xhr\.responseText, "carga", idAlPedir\)/.test(bloque),
        "la respuesta del XHR se pasa al detector CON el paciente para el que se pidió");
      t.cierto(/mirar\(t, "carga", idAlPedir\)/.test(bloque), "y la de fetch, igual");
    });

    t.caso("v17.12.0 — la carga se reconoce con el MISMO detector que el guardado", () => {
      // No se ha supuesto ni un campo del endpoint de carga: se reconoce por forma. Si
      // Everest lo manda, se captura; si no, no pasa nada.
      const paqueteComoLoMandaAlCargar = {
        antecedentePatologicos: { hipertension: true, infartoMiocardio: false },
        examenFisico: { peso: 78.5, circunferenciaAbdominal: 98 },
        habitosGestionRiesgo: { sedentarismo: true },
        datosUsuario: { nombre: "NOMBREPRUEBA", identificacion: "80123456" },
      };
      t.cierto(api.mtrEsPayloadHcEverest(paqueteComoLoMandaAlCargar),
        "el mismo detector reconoce la carga sin conocer su ruta");
      const h = api.mtrHechosDesdeHcEverest(paqueteComoLoMandaAlCargar);
      t.igual(h.secciones.antecedentePatologicos.infartoMiocardio, false,
        "y lo descartado por el médico llega igual que lo marcado");
      const todo = JSON.stringify(h);
      t.falso(todo.indexOf("NOMBREPRUEBA") >= 0, "la barrera es la misma: la identidad no entra");
      t.falso(todo.indexOf("80123456") >= 0, "ni la cédula");
    });

    t.caso("v17.26.0 — el bloque de seguridad farmacológica SE FUE de Laboratorios (vive solo en Conducta)", () => {
      // Historia del contenedor: v17.12.0 lo insertó en el modal de Laboratorios (antes
      // se calculaba y se tiraba). El médico lo probó en vivo el 28-ago contra un
      // paciente real y reportó que ese lugar es erróneo: el juicio farmacológico debe
      // vivir en Conducta (#vgl-cw-farmaco, v17.25.0), no en el modal de resultados de
      // laboratorio. Esta prueba invierte la de v17.12.0 a propósito — ahora vigila que
      // el contenedor NO vuelva a aparecer en Laboratorios, para que una futura edición
      // no reintroduzca por accidente el mismo error que el médico ya reportó.
      const fs = require("fs"), path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/id="vgl-labs-farmaco"/.test(src),
        "el contenedor de avisos farmacológicos ya no existe en el modal de Laboratorios");
      t.falso(/cajaF\.innerHTML = extraFarmaco/.test(src),
        "y tampoco queda código de inserción huérfano apuntando a él");
      // mtrRenderAvisosHtml sigue viva: la usan el widget de Conducta (#vgl-cw-farmaco,
      // ver tests/suite_71_widget_conducta.js) y el panel de Medicamentos del Ordenar —
      // solo se le retiró UN llamador (el de Laboratorios), no la función.
      const cM = cargar({ silencioso: true, almacen: { vgl_cfg: JSON.stringify({ motorPortado: true }) } });
      const html = String(cM.api.mtrRenderAvisosHtml({ citaId: "P1", tfgCkdEpi: 25, tfgCockcroftGault: 24 }) || "");
      t.cierto(html.length > 0, "el bloque sigue produciendo HTML de verdad para sus llamadores actuales");
      t.cierto(/Seguridad farmacológica/.test(html), "con su rótulo");
      t.cierto(/No significa que no haya riesgo/.test(html),
        "y cuando no puede juzgar lo dice, en vez de callarse: la regla de la casa");
    });

    t.caso("v17.25.0 — el recuadro de función renal del modal de Laboratorios se INSERTA, no se tira (mismo patrón que #603, otra vez)", () => {
      // Auditoría del módulo de Laboratorios (28-ago, noche): _renderEstadioRenalHtml
      // (R1b, v14.1.1) calculaba TFG/estadio/discordancia con su propio CSS ya escrito
      // (.vgl-labs-renal-*) y probado de punta a punta — y nunca se insertaba en ningún
      // sitio: no había ni un contenedor en la plantilla del modal para recibirlo. El
      // propio catch de más abajo ("recuadro renal no disponible") ya hablaba de un
      // recuadro que nunca llegó a pintarse.
      const fs = require("fs"), path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/id="vgl-labs-renal"/.test(src), "el contenedor existe en el modal");
      t.cierto(/if \(cajaR && vivo\(\)\) cajaR\.innerHTML = _renderEstadioRenalHtml\(r\)/.test(src),
        "y lo calculado se escribe DENTRO de él: sin esta línea el cálculo de función renal era trabajo perdido");
      // Y produce algo real, incluidos los estados vacíos honestos que ya tenía.
      const html = String(api._renderEstadioRenalHtml({
        estadio: "G2", tfg: 72, formula: "CKD-EPI 2021",
        entradas: { creatininaCruda: 1.0, peso: 68, edad: 55, sexo: "F" },
      }) || "");
      t.cierto(html.indexOf("vgl-labs-renal-tfg") >= 0, "pinta la TFG");
      t.cierto(html.indexOf("72") >= 0 && html.indexOf("G2") >= 0, "con el valor y el estadio reales");
      const vacio = String(api._renderEstadioRenalHtml({ faltan: ["edad_pediatrica"] }) || "");
      t.cierto(vacio.indexOf("menores de 18") >= 0, "y el caso pediátrico sigue diciendo por qué, no inventa un estadio");
    });

    // =================================================================
    //  v17.14.0 — LA BARRERA DE PHI TAMBIÉN APLICA AL REPOSITORIO
    //
    //  Auditoría del 27-ago: las capturas de red de agosto llevaban PHI REAL
    //  sin redactar —nombre completo, cédula, dirección, celular y correo de
    //  cinco pacientes, más el registro médico de tres profesionales—, y un
    //  celular real se había copiado a un fixture de pruebas. Ya había SEIS
    //  commits previos titulados «fix(phi)» sobre estos mismos archivos: la
    //  redacción a ojo, repetida seis veces, seguía dejando datos. Se vuelve
    //  mecánica.
    //
    //  Decisión del médico (27-ago): valores sintéticos que preservan la forma
    //  (la captura sigue sirviendo de evidencia de la API), y NO se reescribe
    //  el historial de git — la redacción es hacia adelante.
    // =================================================================
    t.caso("v17.14.0 — ningún archivo del repositorio trae la PHI real que se redactó", () => {
      const raiz = path.join(__dirname, "..");
      // Los identificadores concretos que estaban publicados. Un archivo que vuelva a
      // traer cualquiera de ellos es una regresión, no un dato nuevo.
      const PROHIBIDOS = ["32304889", "43077616", "21448257", "1128397873", "7379688",
        "3132975614", "3504447019", "3105066018", "1035853169", "1143449208",
        "CLARA DE JESUS", "PALACIO BORJA", "MARTA CELENY", "ROSADEL", "TAPIAS RIVERA",
        "JOSE LUIS DURANGO", "RICMAR", "clarapalacio", "tatiana-valencia",
        "SERRAMONTE", "POTRERITO"];
      const saltar = new Set(["node_modules", ".git", ".github"]);
      const archivos = [];
      const recorrer = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (saltar.has(e.name)) continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) recorrer(full);
          else if (/\.(js|json|md|py|txt|html|css)$/.test(e.name)) archivos.push(full);
        }
      };
      recorrer(raiz);
      t.cierto(archivos.length > 50, "el barrido recorre el repositorio de verdad (" + archivos.length + " archivos)");
      const sucios = [];
      for (const f of archivos) {
        // Esta misma prueba nombra los prohibidos: leerse a sí misma daría siempre rojo.
        if (f.endsWith("suite_31_seguridad_phi_xss.js")) continue;
        let t2 = "";
        try { t2 = fs.readFileSync(f, "utf8"); } catch (e) { continue; }
        for (const mal of PROHIBIDOS) if (t2.indexOf(mal) >= 0) sucios.push(path.relative(raiz, f) + " → " + mal);
      }
      t.igual(sucios.join(" | "), "", "ningún archivo trae PHI real redactada");
    });

    t.caso("v17.14.0 — una captura de red no puede traer un correo de dominio personal", () => {
      // Regla estructural, no lista de casos: un correo @gmail/@hotmail/@outlook/@yahoo
      // dentro de una captura es, por definición, el de una persona real — los sintéticos
      // usan @ejemplo.com. Es lo que atrapa la PRÓXIMA captura, no la de agosto.
      const raiz = path.join(__dirname, "..");
      const capturas = fs.readdirSync(raiz).filter((f) => /^captura_.*\.json$/.test(f));
      t.cierto(capturas.length >= 2, "hay capturas de red versionadas (" + capturas.length + ")");
      const RE_PERSONAL = /[\w.+-]+@(?:gmail|hotmail|outlook|yahoo|live|icloud)\.[\w.]+/gi;
      const sucios = [];
      for (const f of capturas) {
        const t2 = fs.readFileSync(path.join(raiz, f), "utf8");
        const h = t2.match(RE_PERSONAL);
        if (h) sucios.push(f + " → " + h.join(", "));
      }
      t.igual(sucios.join(" | "), "", "ninguna captura trae un correo personal real");
    });

    // =================================================================
    //  v17.16.0 — EL NÚCLEO DE LA BARRERA DE PHI, PROBADO DE FRENTE
    //
    //  Las tres funciones que impiden que el nombre y la cédula del paciente
    //  lleguen a Gemini estaban SIN una sola prueba directa: el informe de
    //  cobertura las listaba entre las «sin cubrir». Y son justo las que un
    //  reinicio del worker dejó desactivadas una vez en el árbol de trabajo,
    //  en mitad de una mutación (documentado en INFORME_MUTACIONES.md).
    //
    //  Aquí no hay ambigüedad sobre qué se está protegiendo: si estas tres
    //  fallan, sale PHI real del consultorio hacia un servicio de terceros.
    // =================================================================

    t.caso("v17.16.0 — mtrRutaHcAceptada: la lista blanca no deja pasar los datos del paciente", () => {
      // Lista BLANCA, no negra: lo que no está nombrado NO pasa. Así, cuando Everest añada
      // un campo nuevo con datos personales, el comportamiento por defecto es excluirlo.
      t.cierto(api.mtrRutaHcAceptada("antecedentePatologicos.hipertension"), "los antecedentes sí");
      t.cierto(api.mtrRutaHcAceptada("ExamenFisico.RuidosCardiacos"), "el examen físico sí, sin importar la caja");
      t.cierto(api.mtrRutaHcAceptada("hs.habitosGestionRiesgo.sedentarismo"), "los hábitos sí, con su prefijo real");

      // Lo que JAMÁS puede pasar.
      t.falso(api.mtrRutaHcAceptada("datosUsuario.nombre"), "el nombre del paciente NO");
      t.falso(api.mtrRutaHcAceptada("datosUsuario.identificacion"), "la cédula NO");
      t.falso(api.mtrRutaHcAceptada("datosUsuario.celular"), "el celular NO");
      t.falso(api.mtrRutaHcAceptada("acompanante.nombre"), "ni el acompañante");
      t.falso(api.mtrRutaHcAceptada(""), "sin nombre de campo, no");
      t.falso(api.mtrRutaHcAceptada(null), "ni con null");
      // Y el prefijo se exige AL PRINCIPIO: un campo que solo CONTENGA la palabra no entra.
      t.falso(api.mtrRutaHcAceptada("datosUsuario.examenfisico.nombre"),
        "el prefijo se ancla al inicio: si bastara con contenerlo, un campo de datosUsuario colado dentro se llevaría el nombre del paciente");
    });

    t.caso("v17.16.0 — mtrHcTachaduras y mtrHcTachar: tachar un nombre exige conocerlo", () => {
      // scrubPII reconoce correos, teléfonos y cédulas porque tienen FORMA. Un nombre propio
      // no la tiene, y el médico lo escribe a mano en la enfermedad actual. La salida fue
      // leer la identidad SOLO para construir las tachaduras, y descartarla sin guardarla.
      const payload = { datosUsuario: {
        nombre: "MARTHA LUCIA", primer_Apellido: "PEREZ", segundo_Apellido: "GOMEZ",
        identificacion: "40123456", celular: "3009876543", correo: "m.perez@ejemplo.com",
      } };
      const tach = api.mtrHcTachaduras(payload);
      for (const esperado of ["MARTHA", "LUCIA", "PEREZ", "GOMEZ", "40123456", "3009876543"]) {
        t.cierto(tach.indexOf(esperado) >= 0, "«" + esperado + "» entra en la lista de tachaduras");
      }
      // Las más largas primero, o tachar «MARTHA» dejaría «[CENSURADO] LUCIA» a medias.
      const ordenado = tach.every((x, i) => i === 0 || tach[i - 1].length >= x.length);
      t.cierto(ordenado, "ordenadas de más larga a más corta: si no, una tachadura corta parte a la larga");

      // Los fragmentos de menos de 3 caracteres NO entran: tachar «DE» destrozaría el texto.
      t.falso(api.mtrHcTachaduras({ datosUsuario: { nombre: "ANA DE LA CRUZ" } }).indexOf("DE") >= 0,
        "las partículas de 2 letras no se tachan: arrasarían con el texto clínico");

      const texto = "PACIENTE MARTHA LUCIA PEREZ GOMEZ, CC 40123456, REFIERE CEFALEA DE 3 DIAS.";
      const limpio = api.mtrHcTachar(texto, tach);
      for (const prohibido of ["MARTHA", "LUCIA", "PEREZ", "GOMEZ", "40123456"]) {
        t.falso(limpio.indexOf(prohibido) >= 0, "«" + prohibido + "» no sobrevive al tachado");
      }
      t.cierto(/CEFALEA DE 3 DIAS/.test(limpio), "y lo clínico sí sobrevive: tachar no es borrar la nota");

      // Insensible a mayúsculas: el médico escribe como escribe.
      t.falso(api.mtrHcTachar("la señora Martha Lucia refiere...", tach).toLowerCase().indexOf("martha") >= 0,
        "tacha aunque él lo escriba en minúscula");

      // Un nombre con caracteres de expresión regular no puede romper el tachado.
      t.igual(api.mtrHcTachar("hola (JUAN) adios", ["(JUAN)"]), "hola [CENSURADO] adios",
        "los paréntesis del nombre se escapan en vez de reventar la expresión regular");

      // v18.0.86 — HALLAZGO DE ENJAMBRE #38. El límite de PALABRA (letras españolas) que
      // v18.0.25 fijó para nombres no protege a las tachaduras NUMÉRICAS de la adyacencia
      // de OTROS dígitos: un celular que aparece como subcadena dentro de un número más
      // largo (una orden, un código de barras) se tachaba igual, partiéndolo en dos.
      const conOrdenClinica = "Se registra el numero de orden 930012345678 en el sistema de laboratorio para seguimiento.";
      t.igual(api.mtrHcTachar(conOrdenClinica, ["3001234567"]), conOrdenClinica,
        "un número clínico NO relacionado que contiene el celular como subcadena sobrevive intacto — antes quedaba partido con [CENSURADO] en medio");
      // Pero el celular SÍ se sigue tachando cuando aparece de verdad, como token propio.
      t.igual(api.mtrHcTachar("Contactar al celular 3001234567 para confirmar.", ["3001234567"]),
        "Contactar al celular [CENSURADO] para confirmar.",
        "el celular real, no pegado a otro número, se sigue tachando igual que siempre");

      // Sin identidad no se inventa una tachadura, y el texto pasa igual.
      t.igual(api.mtrHcTachaduras({}), [], "sin datosUsuario, ninguna tachadura");
      t.igual(api.mtrHcTachar("texto intacto", []), "texto intacto", "y sin tachaduras el texto no se toca");
      t.igual(api.mtrHcTachar(null, ["X"]), "", "un texto nulo sale como cadena vacía, nunca como «null»");
    });

    t.caso("v17.16.0 — mtrHcValorLimpio: lo que NO es un dato clínico simple no viaja", () => {
      // Última pieza de la cadena de la barrera: normaliza cada valor cosechado antes de
      // que entre en la hoja de hechos. Su regla es de LISTA BLANCA por tipo — booleano,
      // número finito y cadena saneada — y todo lo demás sale como null.
      t.igual(api.mtrHcValorLimpio(true), true, "un booleano pasa: «marcado que sí» es un hecho");
      t.igual(api.mtrHcValorLimpio(false), false, "y «marcado que no» también, que no es lo mismo que ausente");
      t.igual(api.mtrHcValorLimpio(72), 72, "un número finito pasa");
      t.igual(api.mtrHcValorLimpio(Infinity), null, "uno no finito, no");
      t.igual(api.mtrHcValorLimpio(NaN), null, "NaN tampoco");
      t.igual(api.mtrHcValorLimpio(null), null, "null sigue siendo null");
      t.igual(api.mtrHcValorLimpio(undefined), null, "y undefined también");
      t.igual(api.mtrHcValorLimpio("   "), null, "una cadena en blanco no es un dato: no viaja");
      t.igual(api.mtrHcValorLimpio({ a: 1 }), null, "un objeto anidado se descarta entero");
      t.igual(api.mtrHcValorLimpio([1, 2]), null, "una lista también");
      t.igual(api.mtrHcValorLimpio("x".repeat(500)).length, 300,
        "el texto se acota a 300: un campo libre entero no puede colarse en la hoja");
      // Y pasa por el saneador: un dato con forma reconocible se tacha aquí también.
      t.falso(/3009876543/.test(String(api.mtrHcValorLimpio("llamar al 3009876543"))),
        "un celular escrito dentro de un campo clínico se sanea antes de viajar");
    });

    t.caso("v17.16.0 — el Deshacer: una sola ranura, con caducidad y aviso al sustituirla", () => {
      // Es la red de la inserción en la historia (y de la vía de REEMPLAZO de la v17.13.0).
      // Estaba entre las «sin cubrir». Su regla incómoda es que la ranura es ÚNICA: guardar
      // un lote nuevo destruye el anterior, y por eso se avisa antes de hacerlo.
      const c = cargar({ silencioso: true });
      t.falso(c.api._vglDeshacerDisponible(), "sin nada guardado, no hay nada que deshacer");

      // Sin dueño anotado: el deshacer corriente.
      const caja = { value: "TEXTO NUEVO", isConnected: true, dispatchEvent: () => {} };
      c.api._vglGuardarDeshacer("", [{ el: caja, prev: "LO QUE HABIA ANTES" }], "Redactor IA");
      t.cierto(c.api._vglDeshacerDisponible(), "guardado un lote, sí se puede deshacer");
      t.igual(c.api._vglEjecutarDeshacer(), 1, "deshacer devuelve cuántas casillas restauró");
      t.igual(caja.value, "LO QUE HABIA ANTES", "y la casilla vuelve EXACTAMENTE a lo que el médico tenía");

      // LA GUARDA, que es lo que de verdad hay que fijar y esta prueba descubrió al
      // escribirse: si la historia abierta ya NO es la del paciente en que se escribió, el
      // deshacer NO toca nada. Restaurar «lo que había antes» en la casilla de OTRO
      // paciente sería escribirle el texto de un tercero en su historia clínica.
      const cOtro = cargar({ silencioso: true });
      const cajaOtro = { value: "TEXTO NUEVO", isConnected: true, dispatchEvent: () => {} };
      cOtro.api._vglGuardarDeshacer("111111111", [{ el: cajaOtro, prev: "LO DEL OTRO PACIENTE" }], "Redactor IA");
      t.igual(cOtro.api._vglEjecutarDeshacer(), 0,
        "con otra historia abierta no se deshace nada");
      t.igual(cajaOtro.value, "TEXTO NUEVO",
        "y la casilla queda intacta: nunca se le escribe a un paciente el texto de otro");

      // =================================================================
      //  v18.0.59 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta:
      //  «DESHACER» REVERTÍA UNA CASILLA DISTINTA DE LA QUE EL MÉDICO CREÍA.
      //
      //  El aviso de arriba («ya no se puede deshacer X») solo se daba cuando la etiqueta
      //  CAMBIABA. Pulsando el MISMO botón dos veces —Athenea respondió distinto, o solo
      //  se reintentó— la etiqueta es idéntica: no había aviso y el primer lote se perdía
      //  igual. El médico pulsa «↩ Deshacer» creyendo que revierte la casilla mala del
      //  primer clic, ve el toast verde «volvió exactamente a como estaba», y ese dato
      //  sigue escrito en la historia sin forma de deshacerlo.
      // =================================================================
      const cDos = cargar({ silencioso: true });
      const nodoDoc = { textContent: "C.C. 111111", closest: () => null };
      cDos.env.doc.getElementById = (id) => (id === "anamesis" ? { textContent: "" } : null);
      cDos.env.doc.querySelector = () => null;
      cDos.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [nodoDoc] : []);
      const cas = (v) => ({ value: v, type: "text", isConnected: true, dispatchEvent: () => true, setAttribute: () => {}, getAttribute: () => null });

      const cA = cas(""), cB = cas("");
      cDos.api._vglGuardarDeshacer("111111", [{ el: cA, prev: "" }], "Exámenes");
      cA.value = "120";                                   // lo que escribió el clic 1
      cDos.api._vglGuardarDeshacer("111111", [{ el: cB, prev: "" }], "Exámenes");
      cB.value = "80";                                    // lo que escribió el clic 2
      t.igual(cDos.api._vglEjecutarDeshacer(), 2,
        "el MISMO botón dos veces acumula: deshacer revierte LAS DOS casillas, no solo la última");
      t.igual(cA.value, "", "la del primer clic vuelve — antes se quedaba escrita sin remedio");
      t.igual(cB.value, "", "y la del segundo también");

      // El detalle que decide la corrección: si la MISMA casilla se escribe dos veces, se
      // conserva el valor MÁS VIEJO. Deshacer devuelve la casilla a como estaba antes de la
      // PRIMERA escritura automática, no a como la dejó el clic anterior (que también era
      // nuestro).
      const cC = cas("lo que el médico tenía");
      cDos.api._vglGuardarDeshacer("111111", [{ el: cC, prev: "lo que el médico tenía" }], "Otro botón");
      cC.value = "primera escritura";
      cDos.api._vglGuardarDeshacer("111111", [{ el: cC, prev: "primera escritura" }], "Otro botón");
      cC.value = "segunda escritura";
      cDos.api._vglEjecutarDeshacer();
      t.igual(cC.value, "lo que el médico tenía",
        "vuelve al valor ANTERIOR A TODO lo automático, no a un valor que también escribimos nosotros");

      // 02-sep — CIERRE ADVERSARIAL (fila 20): la acumulación de arriba exige el MISMO paciente,
      // y «el mismo» solo se puede afirmar con cédula. Con la cabecera ilegible (docId "" en las
      // dos llamadas) dos historias distintas se acumulaban en un lote, y «Deshacer» en el
      // segundo paciente restauraba la casilla del primero — incluida una que el médico ya
      // había escrito a mano. Sin cédula, el lote se sustituye (con su aviso), como antes.
      const cSin = cargar({ silencioso: true });
      const X = cas("");
      cSin.api._vglGuardarDeshacer("", [{ el: X, prev: "" }], "Examen normal");
      X.value = "TEXTO QUE EL MÉDICO ESCRIBIÓ A MANO EN OTRA HISTORIA";
      const Y = cas("");
      cSin.api._vglGuardarDeshacer("", [{ el: Y, prev: "" }], "Examen normal");
      Y.value = "Normal";
      t.igual(cSin.api._vglEjecutarDeshacer(), 1, "sin cédula NO se acumula: el lote se sustituye y Deshacer solo toca el último");
      t.igual(X.value, "TEXTO QUE EL MÉDICO ESCRIBIÓ A MANO EN OTRA HISTORIA", "la casilla del otro paciente, escrita a mano, queda intacta");
      t.igual(Y.value, "", "y la del lote vigente sí vuelve");
      // v18.0.104 — refutador de v18.0.99 (fila 20, residuo): con el lote SIN cédula no había
      // forma de comprobar el paciente al deshacer; dentro de los 5 min, ya con otra historia
      // abierta (cédula legible ahora), se restauraba un nodo que Angular pudo reutilizar.
      const Z = cas("");
      cSin.api._vglGuardarDeshacer("", [{ el: Z, prev: "" }], "Examen normal");
      Z.value = "Normal";
      cSin.env.doc.getElementById = (id) => (id === "anamesis" ? { textContent: "" } : null);   // hay historia abierta…
      cSin.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "C.C. 111111", closest: () => null }] : []);   // …y ahora con cédula legible
      t.igual(cSin.api.extractPacienteAbierto(), "111111", "montaje: la cédula se lee ahora");
      t.igual(cSin.api._vglEjecutarDeshacer(), 0, "ahora sí se lee una cédula y el lote no la tenía: no se puede confirmar el paciente → no se deshace");
      t.igual(Z.value, "Normal", "la casilla queda como está");

      // Una lista vacía no crea una ranura fantasma que luego prometa un deshacer imposible.
      const c2 = cargar({ silencioso: true });
      c2.api._vglGuardarDeshacer("222", [], "vacío");
      t.falso(c2.api._vglDeshacerDisponible(), "un lote vacío no arma un Deshacer que no puede deshacer nada");

      // La caducidad: pasados 5 minutos, la promesa deja de estar en pie.
      const c3 = cargar({ silencioso: true });
      const caja3 = { value: "X", isConnected: true, dispatchEvent: () => {} };
      c3.api._vglGuardarDeshacer("", [{ el: caja3, prev: "Y" }], "lote");
      t.cierto(c3.api._vglDeshacerDisponible(), "recién guardado, disponible");
      t.igual(c3.api._vglEjecutarDeshacer(), 1, "y se puede ejecutar");
    });

  }
};
