// =====================================================================
//  SUITE 14 — Extracción del DOM de Everest
//  Cubre la capa que lee la pantalla de "Citas del día" y la historia
//  clínica: selectores encadenados (firstMatch), búsqueda del contenedor
//  de la cita (containerOf), armado de la agenda (extractAgenda), la
//  lista blanca de secciones (seccionActiva), la cédula del paciente
//  abierto (extractPacienteAbierto), la identidad del médico en sesión
//  (captureDoctorInfo) y la firma de repintado (signatureOf).
//  Todas las funciones aceptan nodos/documentos inyectables o leen el
//  document global del harness, así que se prueban con nodos falsos.
// =====================================================================
module.exports = {
  nombre: "Extracción del DOM de Everest (Suite 14)",
  cubre: [
    "firstMatch", "containerOf", "extractAgenda", "seccionActiva",
    "extractPacienteAbierto", "captureDoctorInfo", "signatureOf"
  ],

  pruebas(t, api, env, cargar) {
    // ---- ayudantes de nodos falsos ----
    const elTexto = (txt) => ({ textContent: txt });
    // contenedor de cita: responde solo a los selectores del mapa
    const contFake = (mapa) => ({ querySelector: (sel) => (sel in mapa ? mapa[sel] : null) });
    // eslabón de la cadena de padres para containerOf
    const padre = (arriba, tieneEstado) => ({
      parentElement: arriba,
      querySelector: (sel) => (tieneEstado && sel === ".status-label" ? elTexto("En Sala") : null),
    });

    // ---------- firstMatch ----------
    t.caso("firstMatch: recorre la lista y devuelve el primer selector que casa", () => {
      const objetivo = elTexto("hallado");
      const root = { querySelector: (s) => (s === ".b" ? objetivo : null) };
      t.cierto(api.firstMatch(root, [".a", ".b"]) === objetivo, "debía devolver el nodo de .b");
      // el orden manda: si el primero casa, no sigue mirando
      const primero = elTexto("primero"), segundo = elTexto("segundo");
      const root2 = { querySelector: (s) => (s === ".a" ? primero : s === ".b" ? segundo : null) };
      t.cierto(api.firstMatch(root2, [".a", ".b"]) === primero, "debía quedarse con el primero que casa");
    });

    t.caso("firstMatch: acepta un selector suelto (string) y devuelve null si nada casa", () => {
      const objetivo = elTexto("x");
      const root = { querySelector: (s) => (s === ".unico" ? objetivo : null) };
      t.cierto(api.firstMatch(root, ".unico") === objetivo, "un string debe envolverse como lista de uno");
      t.igual(api.firstMatch(root, [".nada", ".tampoco"]), null);
      t.igual(api.firstMatch(root, []), null, "lista vacía no puede casar nada");
    });

    // ---------- containerOf ----------
    t.caso("containerOf: encuentra el contenedor por closest (.card-body y .card)", () => {
      const cardBody = contFake({});
      const hora1 = { closest: (s) => (s === ".card-body" ? cardBody : null) };
      t.cierto(api.containerOf(hora1) === cardBody, "debía salir por .card-body");
      // si .card-body no existe, cae al segundo selector de CONFIG.SEL.contenedor
      const card = contFake({});
      const hora2 = { closest: (s) => (s === ".card" ? card : null) };
      t.cierto(api.containerOf(hora2) === card, "debía caer al selector .card");
    });

    t.caso("containerOf: sin closest, asciende por los padres hasta hallar el chip de estado", () => {
      const body = {};
      const abuelo = padre(body, true);          // este sí tiene .status-label
      const papa = padre(abuelo, false);
      const hora = { closest: () => null, ownerDocument: { body }, parentElement: papa };
      t.cierto(api.containerOf(hora) === abuelo, "debía devolver el ancestro con .status-label");
    });

    t.caso("containerOf: se rinde en el body y tras 8 saltos (devuelve null)", () => {
      const body = {};
      // el padre directo ya es el body: no hay dónde buscar
      const pegadoAlBody = { closest: () => null, ownerDocument: { body }, parentElement: body };
      t.igual(api.containerOf(pegadoAlBody), null);
      // el estado vive en el nivel 9: la búsqueda se corta en 8 saltos
      let cadena = padre(body, true);                       // nivel 9 (con estado)
      for (let i = 0; i < 8; i++) cadena = padre(cadena, false); // niveles 1..8 sin estado
      const lejos = { closest: () => null, ownerDocument: { body }, parentElement: cadena };
      t.igual(api.containerOf(lejos), null, "a 9 niveles no debe encontrarlo");
      // en cambio, a exactamente 8 saltos todavía llega
      let cadena8 = padre(body, true);                      // nivel 8 (con estado)
      for (let i = 0; i < 7; i++) cadena8 = padre(cadena8, false); // niveles 1..7
      const alBorde = { closest: () => null, ownerDocument: { body }, parentElement: cadena8 };
      t.cierto(!!api.containerOf(alBorde), "en el salto 8 aún debe encontrarlo");
    });

    // ---------- extractAgenda ----------
    t.caso("extractAgenda: sin .labelHora devuelve visible:false y lista vacía", () => {
      const docVacio = { querySelectorAll: () => [] };
      const r = api.extractAgenda(docVacio);
      t.falso(r.visible);
      t.igual(r.citas, []);
    });

    t.caso("extractAgenda: arma la cita completa (hora, cédula, nombre, modalidad, estado)", () => {
      const cont = contFake({
        ".status-label": elTexto("  En   Sala  "),
        ".text-muted": elTexto("1.098.765.432, CC"),
        ".text-uppercase.fw-bold": elTexto("  PEREZ   JUAN "),
        ".fw-bold.mb-0": elTexto(" Presencial "),
      });
      const hora = { textContent: " 07:00  a. m. ", closest: (s) => (s === ".card-body" ? cont : null) };
      const doc = { querySelectorAll: (sel) => (sel === ".labelHora" ? [hora] : []) };
      const r = api.extractAgenda(doc);
      t.cierto(r.visible);
      t.igual(r.citas.length, 1);
      const c0 = r.citas[0];
      t.igual(c0.hora_texto, "07:00 a. m.", "limpio() debe colapsar espacios");
      t.igual(c0.doc_id, "1098765432", "la cédula sale sin puntos vía extractDoc");
      t.igual(c0.nombre, "PEREZ JUAN");
      t.igual(c0.modalidad, "Presencial");
      t.igual(c0.estado, "En Sala");
      t.igual(c0.index, 0);
    });

    t.caso("extractAgenda: cita huérfana (sin contenedor) usa los valores por defecto", () => {
      const body = {};
      const horaSola = { textContent: "07:20 a. m.", closest: () => null, ownerDocument: { body }, parentElement: null };
      const doc = { querySelectorAll: (sel) => (sel === ".labelHora" ? [horaSola] : []) };
      const r = api.extractAgenda(doc);
      const c0 = r.citas[0];
      t.igual(c0.estado, "Pendiente", "sin chip de estado debe asumir Pendiente");
      t.igual(c0.nombre, "Paciente Everest", "sin nombre debe usar el genérico");
      t.igual(c0.doc_id, "");
      t.igual(c0.modalidad, "");
    });

    t.caso("extractAgenda: el nombre cae al selector alterno .text-uppercase y el índice cuenta citas", () => {
      const contSinFwBold = contFake({
        ".status-label": elTexto("Atendido"),
        ".text-uppercase": elTexto("MARIA GOMEZ"),
      });
      const h1 = { textContent: "08:00 a. m.", closest: (s) => (s === ".card-body" ? contSinFwBold : null) };
      const body = {};
      const h2 = { textContent: "08:20 a. m.", closest: () => null, ownerDocument: { body }, parentElement: null };
      const doc = { querySelectorAll: (sel) => (sel === ".labelHora" ? [h1, h2] : []) };
      const r = api.extractAgenda(doc);
      t.igual(r.citas[0].nombre, "MARIA GOMEZ", "debía usar el segundo selector de CONFIG.SEL.nombre");
      t.igual(r.citas[0].estado, "Atendido");
      t.igual(r.citas[1].index, 1, "el índice debe seguir el orden de la pantalla");
    });

    // ---------- seccionActiva ----------
    t.caso("seccionActiva: #anamesis manda -> historia (aunque también haya marcadores de agenda)", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = (id) => (id === "anamesis" ? elTexto("") : null);
      c.env.doc.querySelector = () => elTexto("");   // todo casa: no debe importar
      t.igual(c.api.seccionActiva(), "historia");
    });

    t.caso("seccionActiva: exige hora Y estado juntos para declarar agenda", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = () => null;
      // solo la hora (pantalla de reserva de turnos): NO es la agenda del día
      c.env.doc.querySelector = (sel) => (sel === ".labelHora" ? elTexto("") : null);
      t.igual(c.api.seccionActiva(), "otra", "con .labelHora suelto no debe abrirse el panel");
      // hora + chip de estado: ahora sí
      c.env.doc.querySelector = (sel) => (sel === ".labelHora" || sel === ".status-label" ? elTexto("") : null);
      t.igual(c.api.seccionActiva(), "agenda");
      // sin ningún marcador
      c.env.doc.querySelector = () => null;
      t.igual(c.api.seccionActiva(), "otra");
    });

    t.caso("seccionActiva: ante una excepción del DOM devuelve otra (apagar por prudencia)", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = () => { throw new Error("DOM roto"); };
      t.igual(c.api.seccionActiva(), "otra");
    });

    // ---------- extractPacienteAbierto ----------
    t.caso("extractPacienteAbierto: sin #anamesis (no es historia clínica) devuelve vacío", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = () => null;
      t.igual(c.api.extractPacienteAbierto(), "");
    });

    t.caso("extractPacienteAbierto: lee la cédula del .text-muted saltándose el propio panel", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = (id) => (id === "anamesis" ? elTexto("") : null);
      c.env.doc.querySelector = () => null;          // sin app-index: cae al document entero
      const delPanel = { textContent: "55.666.777", closest: (s) => (s === "#vgl-root" ? elTexto("") : null) };
      const delPaciente = { textContent: "  C.C.  1.098.765.432 ", closest: () => null };
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [delPanel, delPaciente] : []);
      t.igual(c.api.extractPacienteAbierto(), "1098765432", "nunca debe leer la cédula pintada por el propio panel");
    });

    t.caso("extractPacienteAbierto: usa app-index como contenedor cuando existe", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = (id) => (id === "anamesis" ? elTexto("") : null);
      const appIndex = {
        querySelectorAll: (sel) => (sel === ".text-muted" ? [{ textContent: "39.876.543, CC", closest: () => null }] : []),
      };
      c.env.doc.querySelector = (sel) => (sel === "app-index" ? appIndex : null);
      // si leyera el document entero encontraría otra cédula: no debe pasar
      c.env.doc.querySelectorAll = () => [{ textContent: "99.999.999", closest: () => null }];
      t.igual(c.api.extractPacienteAbierto(), "39876543");
    });

    t.caso("extractPacienteAbierto: sin dígitos válidos en los .text-muted devuelve vacío", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = (id) => (id === "anamesis" ? elTexto("") : null);
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [
        { textContent: "Correo: paciente@mail.com", closest: () => null },
        { textContent: "Tel: 123", closest: () => null },   // muy corto para ser cédula
      ] : []);
      t.igual(c.api.extractPacienteAbierto(), "");
    });

    // ---------- captureDoctorInfo ----------
    t.caso("captureDoctorInfo: toma id y nombre de las variables globales de Everest (PAGEWIN)", () => {
      const c = cargar({ silencioso: true });
      c.ctx.UsuarioId = "515";
      c.ctx.UsuarioNombreCompleto = "  DRA ANA MARIA LOPEZ ";
      c.api.captureDoctorInfo();
      t.igual(c.api.__state.activeDoctor.id, 515);
      t.igual(c.api.__state.activeDoctor.name, "DRA ANA MARIA LOPEZ");
      // sin nombre completo, UsuarioLogin sirve de respaldo
      const c2 = cargar({ silencioso: true });
      c2.ctx.UsuarioLogin = "amaria.lopez";
      c2.api.captureDoctorInfo();
      t.igual(c2.api.__state.activeDoctor.name, "amaria.lopez");
    });

    t.caso("captureDoctorInfo: PAGEWIN no pisa un id ni un nombre ya fijados", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.activeDoctor.id = 515;
      c.api.__state.activeDoctor.name = "DRA ANA MARIA LOPEZ";
      c.ctx.UsuarioId = "999";
      c.ctx.UsuarioNombreCompleto = "OTRO NOMBRE CUALQUIERA";
      c.api.captureDoctorInfo();
      t.igual(c.api.__state.activeDoctor.id, 515, "el id global solo aplica cuando aún no hay médico");
      t.igual(c.api.__state.activeDoctor.name, "DRA ANA MARIA LOPEZ");
    });

    t.caso("captureDoctorInfo: lista blanca de origen — APIEnvioCorreo no puede fijar el id (Incidente v11.0.1)", () => {
      const c = cargar({ silencioso: true });
      // varios servicios llaman "UsuarioId" al id del PACIENTE: no son fuente fiable
      c.api.captureDoctorInfo("https://neps.everestintelligent.com/apiviva/APIEnvioCorreo/api/Enviar?UsuarioId=999");
      t.igual(c.api.__state.activeDoctor.id, 0);
      // un host ajeno tampoco, aunque imite la ruta de APIAcceso
      c.api.captureDoctorInfo("https://evil.example.com/apiviva/APIAcceso/api/x?UsuarioId=777");
      t.igual(c.api.__state.activeDoctor.id, 0);
    });

    t.caso("captureDoctorInfo: origen fiable fija el id; Digiturno NO es fiable (v12.3.1)", () => {
      const c = cargar({ silencioso: true });
      c.api.captureDoctorInfo("https://neps.everestintelligent.com/apiviva/APIAcceso/api/ValidarSesion?UsuarioId=515");
      t.igual(c.api.__state.activeDoctor.id, 515);
      // v12.3.1 — Digiturno se RETIRÓ de la lista blanca a propósito: su "usuarioId" es el
      // id de OTRO usuario (no necesariamente el médico), y confiar en él fue exactamente
      // el bug real de identidad de esta sesión (UsuarioId de un médico distinto colándose
      // como médico activo). Debe IGNORARSE por completo, sin pisar el id ya fijado.
      c.api.captureDoctorInfo('https://neps.everestintelligent.com/apiviva/ApiIntegracionEverestDigiturno/api/Turno {"usuarioId": 309}');
      t.igual(c.api.__state.activeDoctor.id, 515, "Digiturno no fiable: el id de otro usuario NO pisa el ya fijado");
      // Con el id todavía en cero, Digiturno tampoco debe fijarlo desde cero.
      c.api.__state.activeDoctor.id = 0;
      c.api.captureDoctorInfo('https://neps.everestintelligent.com/apiviva/ApiIntegracionEverestDigiturno/api/Turno {"usuarioId": 309}');
      t.igual(c.api.__state.activeDoctor.id, 0, "Digiturno no fiable: tampoco fija el id partiendo de cero");
    });

    t.caso("captureDoctorInfo: nombre decodificado (+ y %20), corto rechazado, entrada no string no lanza", () => {
      const c = cargar({ silencioso: true });
      c.api.captureDoctorInfo("https://neps.everestintelligent.com/apiviva/APIAcceso/api/x?UsuarioNombreCompleto=ANA+MARIA%20LOPEZ&otra=1");
      t.igual(c.api.__state.activeDoctor.name, "ANA MARIA LOPEZ");
      // un nombre de 3 letras o menos no identifica a nadie: se descarta
      c.api.__state.activeDoctor.name = "";
      c.api.captureDoctorInfo("https://neps.everestintelligent.com/apiviva/APIAcceso/api/x?UsuarioNombreCompleto=ABC");
      t.igual(c.api.__state.activeDoctor.name, "");
      // entradas basura: salir en silencio sin tocar el estado
      t.noLanza(() => c.api.captureDoctorInfo(null));
      t.noLanza(() => c.api.captureDoctorInfo(123));
      t.noLanza(() => c.api.captureDoctorInfo({}));
      t.igual(c.api.__state.activeDoctor.id, 0);
      t.igual(c.api.__state.activeDoctor.name, "");
    });

    // ---------- signatureOf ----------
    t.caso("signatureOf: compone la firma key~estado~color~pym separada por ||", () => {
      t.igual(api.signatureOf([]), "");
      const lista = [
        { key: "123@07:00 AM", estado: "En Sala", color: "VERDE", pym: ["CMB", "MAMA"] },
        { key: "456@07:20 AM", estado: "Pendiente", color: "AZUL", pym: [] },
      ];
      t.igual(api.signatureOf(lista), "123@07:00 AM~En Sala~VERDE~CMB·MAMA||456@07:20 AM~Pendiente~AZUL~");
    });

    t.caso("signatureOf: cualquier cambio (estado, color o PyM) altera la firma y fuerza repintado", () => {
      const base = [{ key: "123@07:00 AM", estado: "Pendiente", color: "AZUL", pym: ["CMB"] }];
      const firma = api.signatureOf(base);
      t.cierto(firma !== api.signatureOf([{ ...base[0], estado: "En Sala" }]), "cambiar el estado debe cambiar la firma");
      t.cierto(firma !== api.signatureOf([{ ...base[0], color: "VERDE" }]), "cambiar el color debe cambiar la firma");
      t.cierto(firma !== api.signatureOf([{ ...base[0], pym: ["CMB", "COLON"] }]), "cambiar el PyM debe cambiar la firma");
      // y la misma lista produce la misma firma (idempotencia del repintado)
      t.igual(api.signatureOf(base), firma);
    });
  }
};
