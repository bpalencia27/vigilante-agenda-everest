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
    "firstMatch", "qAll", "containerOf", "_abrigaOtraHora", "extractAgenda", "_cedulaDelContenedor", "seccionActiva",
    "extractPacienteAbierto", "captureDoctorInfo", "signatureOf", "_enModuloHCHealth", "_enPaginaExcluidaDeAvisos",
    "_contadorSospechaSelector", "_hayCedulaVisibleEnPantalla", "_vigilarSilencioVigilancia"
  ],

  pruebas(t, api, env, cargar) {
    // ---- ayudantes de nodos falsos ----
    const elTexto = (txt) => ({ textContent: txt });
    // contenedor de cita: responde solo a los selectores del mapa (querySelectorAll
    // devuelve el mismo elemento como lista — fix 18 M2M itera los .text-muted)
    const contFake = (mapa) => ({ querySelector: (sel) => (sel in mapa ? mapa[sel] : null), querySelectorAll: (sel) => (sel in mapa ? [mapa[sel]] : []) });
    // eslabón de la cadena de padres para containerOf (otrasHoras: qué .labelHora
    // adicionales abriga el eslabón — fix 22 M2M; por defecto ninguna)
    const padre = (arriba, tieneEstado, otrasHoras) => ({
      parentElement: arriba,
      querySelector: (sel) => (tieneEstado && sel === ".status-label" ? elTexto("En Sala") : null),
      querySelectorAll: (sel) => (sel === ".labelHora" ? otrasHoras || [] : []),
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

    t.caso("qAll: une los querySelectorAll de la lista de selectores, en orden (fix 17 M2M)", () => {
      const a1 = elTexto("a1"), b1 = elTexto("b1"), b2 = elTexto("b2");
      const root = { querySelectorAll: (s) => (s === ".a" ? [a1] : s === ".b" ? [b1, b2] : []) };
      const u = api.qAll(root, [".a", ".b"]);
      t.cierto(u.length === 3 && u[0] === a1 && u[1] === b1 && u[2] === b2, "debe concatenar TODOS los selectores de la lista");
      t.cierto(api.qAll(root, ".b").length === 2, "un string suelto debe envolverse como lista de uno");
      t.igual(api.qAll(root, [".nada"]), [], "lo que no casa no aporta nodos");
      t.igual(api.qAll(root, []), [], "lista vacía devuelve vacío");
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

    t.caso("containerOf: ancestro con estado que abriga OTRA cita no sirve (fix 22 M2M)", () => {
      const body = {};
      const otraHora = elTexto("08:00 a. m.");
      const hora = { closest: () => null, ownerDocument: { body }, parentElement: null };
      // nivel 2 tiene chip de estado PERO envuelve las dos horas de cita (nuestra y la vecina)
      const envolvente = padre(body, true, [hora, otraHora]);
      hora.parentElement = padre(envolvente, false, [hora]);
      t.igual(api.containerOf(hora), null, "un ancestro que abarca varias citas no puede ser el contenedor: mezclaría pacientes");
      // control: si el ancestro solo abriga la propia hora, el ascenso histórico sigue intacto
      const hora2 = { closest: () => null, ownerDocument: { body }, parentElement: null };
      const bueno = padre(body, true, [hora2]);
      hora2.parentElement = padre(bueno, false, [hora2]);
      t.cierto(api.containerOf(hora2) === bueno, "el ancestro que solo abriga SU cita sigue valiendo");
      // invocación directa del guard (lo ejercita sin pasar por containerOf)
      t.cierto(api._abrigaOtraHora(envolvente, hora) === true, "el wrapper con dos horas abriga otra cita");
      t.cierto(api._abrigaOtraHora(bueno, hora2) === false, "el contenedor propio no abriga otra cita");
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

    t.caso("extractAgenda: la cédula es el primer .text-muted que PARSEA, no el primero a ciegas (fix 18 M2M)", () => {
      const cont = {
        querySelector: (sel) => (sel === ".status-label" ? elTexto("Pendiente") : null),
        querySelectorAll: (sel) => (sel === ".text-muted" ? [
          elTexto("Correo: paciente@correo.com"),      // texto muted que NO es cédula
          elTexto(" C.C. 1.023.456.789 "),
        ] : []),
      };
      const hora = { textContent: "09:00 a. m.", closest: (s) => (s === ".card-body" ? cont : null) };
      const doc = { querySelectorAll: (sel) => (sel === ".labelHora" ? [hora] : []) };
      const r = api.extractAgenda(doc);
      t.igual(r.citas[0].doc_id, "1023456789", "debía saltar el .text-muted que no parsea y quedarse con la cédula");
      t.igual(r.citas[0].estado, "Pendiente");
      // invocación directa del extractor (lo ejercita sin pasar por extractAgenda)
      t.igual(api._cedulaDelContenedor(cont), "1023456789", "directa: devuelve la primera cédula que parsea");
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

    t.caso("extractAgenda: si el único ancestro con estado abriga varias citas, la cita queda huérfana (fix 22 M2M)", () => {
      const body = {};
      const hNuestra = { textContent: "09:00 a. m.", closest: () => null, ownerDocument: { body }, parentElement: null };
      const hVecina = { textContent: "09:20 a. m." };
      const wrapper = {
        parentElement: body,
        querySelector: (sel) => (sel === ".status-label" ? elTexto("En Sala") : null),
        querySelectorAll: (sel) => (sel === ".labelHora" ? [hNuestra, hVecina] : (sel === ".text-muted" ? [elTexto("1.111.111.111, CC del vecino")] : [])),
      };
      hNuestra.parentElement = wrapper;
      const doc = { querySelectorAll: (sel) => (sel === ".labelHora" ? [hNuestra] : []) };
      const r = api.extractAgenda(doc);
      t.igual(r.citas[0].estado, "Pendiente", "huérfana: el estado del vecino no se lee");
      t.igual(r.citas[0].doc_id, "", "huérfana: la cédula del vecino no se lee");
      t.igual(r.citas[0].nombre, "Paciente Everest", "huérfana: valor por defecto, no el nombre de otro paciente");
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

    // ---------- _enModuloHCHealth ----------
    // Reportado en consultorio: los avisos (Windows/toast/sonido) llegaban también
    // con la pestaña líder abierta en .../viva/Acceso/, un módulo de Everest sin
    // nada que ver con la agenda del día. _enModuloHCHealth distingue por ruta
    // (location.pathname), no por marcadores de DOM.
    t.caso("_enModuloHCHealth: true dentro de /viva/HCHealth/", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/";
      t.cierto(c.api._enModuloHCHealth());
      // también dentro de subrutas del mismo módulo (Órdenes, RCV, etc.)
      c.env.win.location.pathname = "/viva/HCHealth/Ordenamiento";
      t.cierto(c.api._enModuloHCHealth());
    });

    t.caso("_enModuloHCHealth: false en /viva/Acceso/ (asignación/reserva de turnos)", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/Acceso/";
      t.falso(c.api._enModuloHCHealth());
    });

    // v18.0.138 — orden del médico (4-sep): la pestaña principal/notificadora es
    // /viva/HCHealth/; todo el subárbol /viva/EverHealth/ queda fuera del módulo.
    // Esto revierte la aceptación de v17.6.3 de la forma /viva/EverHealth/HCHealth.
    t.caso("v18.0.138: _enModuloHCHealth false en /viva/EverHealth/HCHealth (reversión de v17.6.3)", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/EverHealth/HCHealth";
      t.falso(c.api._enModuloHCHealth());
      c.env.win.location.pathname = "/viva/EverHealth/HCHealth/Ordenamiento";
      t.falso(c.api._enModuloHCHealth());
    });

    t.caso("_enModuloHCHealth: false sin coincidencia y ante una excepción del DOM", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/otra/ruta/cualquiera";
      t.falso(c.api._enModuloHCHealth());
      Object.defineProperty(c.env.win.location, "pathname", { get() { throw new Error("roto"); } });
      t.falso(c.api._enModuloHCHealth());
    });

    // ---------- _enPaginaExcluidaDeAvisos ----------
    // v18.0.138 — orden del médico (4-sep): ni Vigilante ni notificaciones en
    // /viva/EverHealth/OrdenamientoHealth, /viva/EverHealth/Acceso ni
    // /viva/EverHealth/HCHealth — las notificaciones viven SOLO en /viva/HCHealth/.
    // v17.6.75 enumeraba tres pantallas sueltas; ahora TODO el subárbol /viva/EverHealth/
    // queda silenciado (el prefijo absorbe portada, Acceso, OrdenamientoHealth y HCHealth).
    t.caso("v18.0.138: _enPaginaExcluidaDeAvisos true en TODO el subárbol /viva/EverHealth/ y en /viva/Acceso", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/EverHealth/OrdenamientoHealth";
      t.cierto(c.api._enPaginaExcluidaDeAvisos());
      c.env.win.location.pathname = "/viva/EverHealth/Acceso";
      t.cierto(c.api._enPaginaExcluidaDeAvisos());
      c.env.win.location.pathname = "/viva/EverHealth/HCHealth";
      t.cierto(c.api._enPaginaExcluidaDeAvisos());
      c.env.win.location.pathname = "/viva/EverHealth/HCHealth/Ordenamiento";
      t.cierto(c.api._enPaginaExcluidaDeAvisos());
      c.env.win.location.pathname = "/viva/EverHealth/";
      t.cierto(c.api._enPaginaExcluidaDeAvisos());
      c.env.win.location.pathname = "/viva/EverHealth";   // sin barra final, mismo caso
      t.cierto(c.api._enPaginaExcluidaDeAvisos());
      c.env.win.location.pathname = "/viva/EverHealth/OtraPantalla";
      t.cierto(c.api._enPaginaExcluidaDeAvisos(), "cualquier pantalla futura bajo el subárbol también queda silenciada");
      c.env.win.location.pathname = "/viva/Acceso/";       // ruta de siempre, sin prefijo: se conserva
      t.cierto(c.api._enPaginaExcluidaDeAvisos());
    });

    t.caso("_enPaginaExcluidaDeAvisos: false en el módulo clínico /viva/HCHealth/ y en rutas ajenas", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/";
      t.falso(c.api._enPaginaExcluidaDeAvisos());
      c.env.win.location.pathname = "/viva/HCHealth/Ordenamiento";
      t.falso(c.api._enPaginaExcluidaDeAvisos(), "las subrutas del módulo clínico siguen notificando");
      c.env.win.location.pathname = "/otra/ruta/cualquiera";
      t.falso(c.api._enPaginaExcluidaDeAvisos());
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

    // =====================================================================
    // v18.0.146 — DETECTOR DE APAGADO SILENCIOSO (fix 4 de la auditoría M2M).
    // seccionActiva() es una lista blanca: si Everest renombra #anamesis o cambia
    // .labelHora/.status-label, devuelve "otra" para siempre y el Vigilante se
    // apaga sin avisar. El detector cuenta ticks sospechosos (sección "otra"
    // crónica con paciente visible en HCHealth, o historia abierta sin cédula
    // legible) y avisa UNA vez por sesión.
    // =====================================================================
    t.caso("_contadorSospechaSelector: cuenta, avisa una sola vez y se reinicia (v18.0.146)", () => {
      const c = cargar({ silencioso: true });
      t.cierto(typeof c.api._contadorSospechaSelector === "function", "la función pura del detector debe estar exportada");
      let r = c.api._contadorSospechaSelector(true, 0, false);
      t.igual(r.ticks, 1, "el primer tick sospechoso cuenta 1");
      t.falso(r.avisa, "un tick no alcanza el umbral de 24");
      r = c.api._contadorSospechaSelector(true, 23, false);
      t.cierto(r.avisa, "el tick 24 consecutivo debe disparar el aviso");
      r = c.api._contadorSospechaSelector(true, 24, true);
      t.falso(r.avisa, "con el aviso ya dado no vuelve a avisar en la sesión");
      t.igual(r.ticks, 25, "el contador sigue subiendo aunque ya no avise");
      r = c.api._contadorSospechaSelector(false, 20, false);
      t.igual(r.ticks, 0, "un tick no sospechoso (sección reconocida) reinicia el contador");
      t.falso(r.avisa);
    });

    t.caso('_vigilarSilencioVigilancia: "otra" crónica en HCHealth con paciente visible => aviso único (v18.0.146)', () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/";
      const appIndex = { querySelectorAll: (sel) => (sel === ".text-muted" ? [{ textContent: "C.C. 1.098.765.432", closest: () => null }] : []) };
      c.env.doc.querySelector = (sel) => (sel === "app-index" ? appIndex : null);
      c.env.doc.getElementById = () => null;
      let ultimo = null;
      for (let i = 1; i <= 24; i++) ultimo = c.api._vigilarSilencioVigilancia("otra");
      t.cierto(ultimo && typeof ultimo === "object", "el detector debe devolver su veredicto");
      t.igual(ultimo.otraTicks, 24, "24 ticks seguidos de «otra» con paciente visible en pantalla");
      t.cierto(ultimo.avisoOtra, "al llegar al umbral debe avisar: apagado silencioso detectado");
      t.cierto(c.api.__state._selRotoAviso === true, "el aviso queda marcado: UNA vez por sesión");
      const r25 = c.api._vigilarSilencioVigilancia("otra");
      t.igual(r25.otraTicks, 25, "el contador sigue contando");
      t.falso(r25.avisoOtra, "no repite el aviso dentro de la misma sesión");
      const rAgenda = c.api._vigilarSilencioVigilancia("agenda");
      t.igual(rAgenda.otraTicks, 0, "reconocer la agenda de nuevo reinicia el contador");
      t.falso(rAgenda.avisoOtra);
    });

    t.caso('_vigilarSilencioVigilancia: "otra" legítima (fuera de HCHealth o sin paciente) no acumula (v18.0.146)', () => {
      // Ruta ajena al módulo clínico (Acceso): ahí "otra" es una pantalla legítima, no una rotura
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/Acceso/";
      const appIndex = { querySelectorAll: (sel) => (sel === ".text-muted" ? [{ textContent: "C.C. 1.098.765.432", closest: () => null }] : []) };
      c.env.doc.querySelector = (sel) => (sel === "app-index" ? appIndex : null);
      c.env.doc.getElementById = () => null;
      let r = null;
      for (let i = 0; i < 30; i++) r = c.api._vigilarSilencioVigilancia("otra");
      t.cierto(!!r, "veredicto leído");
      t.igual(r.otraTicks, 0, "fuera de HCHealth «otra» es legítima: el contador no se mueve");
      t.falso(r.avisoOtra);
      t.cierto(c.api._hayCedulaVisibleEnPantalla() === true, "con .text-muted legible la cédula SÍ se ve en pantalla");
      // Dentro de HCHealth pero sin cédula legible (pantalla sin paciente): tampoco acumula
      const c2 = cargar({ silencioso: true });
      c2.env.win.location.pathname = "/viva/HCHealth/";
      const appIndex2 = { querySelectorAll: () => [] };
      c2.env.doc.querySelector = (sel) => (sel === "app-index" ? appIndex2 : null);
      c2.env.doc.getElementById = () => null;
      let r2 = null;
      for (let i = 0; i < 30; i++) r2 = c2.api._vigilarSilencioVigilancia("otra");
      t.igual(r2.otraTicks, 0, "sin cédula visible no hay paciente en pantalla: no es apagado silencioso");
      t.falso(r2.avisoOtra);
      t.cierto(c2.api._hayCedulaVisibleEnPantalla() === false, "sin .text-muted con cédula, la pantalla no muestra paciente");
    });

    t.caso("_vigilarSilencioVigilancia: historia abierta sin cédula legible => guard anti-cruce ciego, aviso único (v18.0.146)", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/";
      // Fase 1: historia con la cédula a la vista — todo normal, nunca acumula
      const appIndex = { querySelectorAll: (sel) => (sel === ".text-muted" ? [{ textContent: "C.C. 1.098.765.432", closest: () => null }] : []) };
      c.env.doc.querySelector = (sel) => (sel === "app-index" ? appIndex : null);
      c.env.doc.getElementById = (id) => (id === "anamesis" ? elTexto("") : null);
      let r = null;
      for (let i = 0; i < 30; i++) r = c.api._vigilarSilencioVigilancia("historia");
      t.igual(r.historiaTicks, 0, "con la cédula legible el guard no está ciego");
      t.falso(r.avisoHistoria);
      // Fase 2: .text-muted deja de existir (Everest cambió): la historia sigue
      // abierta pero ya no se puede leer DE QUIÉN es
      appIndex.querySelectorAll = () => [];
      let r2 = null;
      for (let i = 1; i <= 24; i++) r2 = c.api._vigilarSilencioVigilancia("historia");
      t.igual(r2.historiaTicks, 24, "24 ticks seguidos sin poder leer de quién es la historia");
      t.cierto(r2.avisoHistoria, "el guard ciego debe avisar");
      t.cierto(c.api.__state._selCiegoAviso === true, "marcado: una sola vez por sesión");
      const r25 = c.api._vigilarSilencioVigilancia("historia");
      t.falso(r25.avisoHistoria, "no repite el aviso en la sesión");
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

    t.caso("captureDoctorInfo: origen fiable fija el id; /api/Turno de Digiturno NO es fiable (v12.3.1)", () => {
      const c = cargar({ silencioso: true });
      c.api.captureDoctorInfo("https://neps.everestintelligent.com/apiviva/APIAcceso/api/ValidarSesion?UsuarioId=515");
      t.igual(c.api.__state.activeDoctor.id, 515);
      // v12.3.1 — el `/api/Turno` de Digiturno lleva un usuarioId que NO es el del médico:
      // es el del turno/paciente. Debe IGNORARSE por completo, sin pisar el id ya fijado.
      c.api.captureDoctorInfo('https://neps.everestintelligent.com/apiviva/ApiIntegracionEverestDigiturno/api/Turno {"usuarioId": 309}');
      t.igual(c.api.__state.activeDoctor.id, 515, "/api/Turno no fiable: el id de otro usuario NO pisa el ya fijado");
      // Con el id todavía en cero, /api/Turno tampoco debe fijarlo desde cero.
      c.api.__state.activeDoctor.id = 0;
      c.api.captureDoctorInfo('https://neps.everestintelligent.com/apiviva/ApiIntegracionEverestDigiturno/api/Turno {"usuarioId": 309}');
      t.igual(c.api.__state.activeDoctor.id, 0, "/api/Turno no fiable: tampoco fija el id partiendo de cero");
    });

    // =====================================================================
    // v17.6.2 — SNIFFER DE UsuarioId (pedido de Gemini, verificado con la captura real
    // del 2026-08-10 y las telemetrías del 22-ago): en `ConfirmarTicket` y
    // `FinalizarTicket` de ApiIntegracionEverestDigiturno el UsuarioId SÍ es el médico en
    // sesión (515) — es el MISMO id que el propio script usa en apiDigiturnoFinalizarTicket
    // (state.activeDoctor.id). Antes de esto, un equipo ajeno sin GetUsuarioPerfil ni login
    // en la red quedaba con el id en 0 y BuscarPaciente con UsuarioId=0 "no encontraba" a
    // nadie. Estas dos rutas vuelven a la lista blanca (el /api/Turno, NO: ese sigue siendo
    // de otro usuario). Y como siempre, el raspado no pisa un id ya fijado.
    // =====================================================================
    t.caso("captureDoctorInfo: ConfirmarTicket/FinalizarTicket de Digiturno SÍ fijan el id del médico (v17.6.2)", () => {
      const c = cargar({ silencioso: true });
      c.api.captureDoctorInfo("https://neps.everestintelligent.com/apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/ConfirmarTicket?TicketId=123&UsuarioId=515");
      t.igual(c.api.__state.activeDoctor.id, 515, "ConfirmarTicket: el UsuarioId es el médico en sesión (la captura real)");
    });

    t.caso("captureDoctorInfo: FinalizarTicket fija el id desde cero, y no pisa uno ya fijado", () => {
      const c = cargar({ silencioso: true });
      c.api.captureDoctorInfo("https://neps.everestintelligent.com/apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket?TicketId=0&UsuarioId=515");
      t.igual(c.api.__state.activeDoctor.id, 515, "FinalizarTicket: fija el id partiendo de cero (equipo ajeno sin GetUsuarioPerfil)");
      // Un eco de las propias llamadas del Vigilante viaja con OTRO UsuarioId (S.medicoId):
      // nunca debe pisar el id autoritativo ya resuelto.
      c.api.__state.activeDoctor.id = 888;
      c.api.captureDoctorInfo("https://neps.everestintelligent.com/apiviva/ApiIntegracionEverestDigiturno/api/Digiturno/FinalizarTicket?TicketId=0&UsuarioId=777");
      t.igual(c.api.__state.activeDoctor.id, 888, "un UsuarioId que llega cuando ya hay id fijado NO pisa el existente");
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
