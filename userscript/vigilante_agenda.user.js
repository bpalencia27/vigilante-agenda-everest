// ==UserScript==
// @name         Vigilante de Agenda — Copiloto Everest PyM
// @namespace    vigilante-agenda-everest
// @version      7.8.3
// @description  MODO LIGERO: vigila la agenda de Everest por la vía directa del API (unos kB por consulta, sin copia de fondo), baja la base PyM de la sede UNA vez al día y avisa por notificaciones de Windows. Reporte MÍNIMO al tablero (resumen diario + fraudes, sin datos de pacientes). Sin rondas periódicas ni interceptación de red.
// @author       bpalencia27
// @match        *://neps.everestintelligent.com/*
// @match        *://*.everestintelligent.com/*
// @match        *://viva1aips-my.sharepoint.com/*
// @run-at       document-start
// @noframes
// @connect      viva1aips-my.sharepoint.com
// @connect      sharepoint.com
// @connect      microsoftonline.com
// @connect      login.live.com
// @connect      svc.ms
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      googleusercontent.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt
// @downloadURL  https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt
// ==/UserScript==

// --- AUTOACTUALIZACIÓN -------------------------------------------------------
// Activada (v7.4.0): Tampermonkey revisa este Gist secreto solo y actualiza cada
// equipo cuando @version suba. Para publicar una versión nueva: editar el Gist
// https://gist.github.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91 (pegar el
// archivo completo, subir @version, "Update secret gist") — nada más que hacer en
// los consultorios. Guía completa: 3_ACTUALIZAR_TODOS_LOS_EQUIPOS.txt
// ----------------------------------------------------------------------------

/*
  v7.8.3 — ACCESO AUTOMÁTICO A SHAREPOINT SIN LOGIN MANUAL (pedido explícito: varios PCs,
  sin credenciales de administrador de Microsoft 365 disponibles para automatizar por
  Azure AD/Graph API). Se usa el enlace de "Compartir" que SharePoint ya genera para la
  carpeta del PyM (CONFIG.SP.shareLink): visitarlo le da al navegador acceso de lectura
  a esa carpeta sin que nadie escriba usuario/contraseña. El script "recarga" ese enlace
  solo (primeShareAccess) cada ~25 min y, si el listado falla (401/403), reintenta una
  vez forzando la recarga antes de avisar que la sesión pudo vencer. El botón manual
  «Abrir SharePoint» de Ajustes sigue existiendo como respaldo si el enlace compartido
  llegara a caducar o a revocarse. NINGUNA credencial viaja en el script ni en el Gist.

  v7.8.0 — RENDIMIENTO DE FONDO PARA EQUIPOS LENTOS (medido con réplicas reales, no estimado)
  El congelamiento de pestañas al cargar venía de la tubería del PyM, que corría entera
  en el hilo de la página. Banco de pruebas con una réplica exacta de la base piloto
  (13,7 MB, 90.000 filas, mismo esquema de columnas del Agenda_Dia_CMB real):
    ANTES: peor bloqueo único 2,8 s · 6,0 s totales bloqueados · pico 511 MB de RAM ·
           caché de 10,8 MB (a 1 MB del tope de 12 MB que la descartaba EN SILENCIO y
           obligaba a re-descargar los ~14 MB en CADA recarga, todo el día).
    AHORA: peor bloqueo 0,16 s · 0,4 s totales · pico 244 MB · caché de 2,8 MB.
    (En un PC de consultorio, multiplicar por 4-8: de ~20-40 s congelado a nunca >1 s.)
  Cómo:
  - STREAMING + FUSIÓN: la hoja se descomprime por trozos y cada fila se indexa y se
    descarta al vuelo. Nunca existen ni el string de 110 MB de XML ni el arreglo de
    90.000 filas. sharedStrings también va en streaming. (readPymWorkbookStream)
  - PRESUPUESTO DE TIEMPO: se cede el hilo cada ~15 ms MEDIDOS (MessageChannel, sin el
    clamp de 4 ms de setTimeout), no cada N filas: en un equipo lento cede más seguido
    él solo. Aplica a parseo, indexado, caché y desempaquetado. (makeYielder)
  - CACHÉ COMPACTA v3 con diccionario de etiquetas (~4x más pequeña: 2,8 MB vs 10,8).
    Adiós al acantilado silencioso de los 12 MB; si algún día se superara, AVISA.
  - BOOT DIFERIDO: cada pestaña ya no parsea la caché en plena carga de la página;
    se desempaqueta por tandas cuando el navegador está libre (requestIdleCallback).
  - CONEXIÓN SHAREPOINT REPARADA: al vencerse la sesión, SharePoint redirige a
    login.microsoftonline.com / *.svc.ms, dominios que NO estaban en @connect —
    Tampermonkey cortaba ahí y salía el mensaje engañoso "no dejó salir la conexión".
    Se añadieron los dominios, el diagnóstico ahora lo dice claro, y hay botón
    «Abrir SharePoint» en Ajustes para reactivar la sesión y que el captador de esa
    pestaña haga el resto solo. Verificación de equivalencia: el nuevo lector produce
    EXACTAMENTE el mismo resultado que el anterior en todos los casos de prueba
    (multi-hoja, encabezado en fila 4+, inlineStr, ceros a la izquierda, exclusiones).

  v7.4.0 — AUDITORÍA UI/UX (equipo de 6 lentes: contraste/daltonismo, jerarquía visual,
  interacción/teclado, ergonomía clínica, rendimiento en equipos lentos, consistencia de
  sistema) + reparación de lo seguro y de mayor consenso:
  - Contraste WCAG AA recalculado en badges, cuenta regresiva morada/ámbar, botones
    on/off, contador de fraudes y --fg3 (antes fallaba 4.5:1 en varios, sobre todo claro).
  - Tarjeta de fraude ahora dice "⛔ FRAUDE" en texto (no solo tinte de fondo); el mismo
    refuerzo de tarjeta se extendió a MORADO (última llamada) y AMBAR (inasistencia).
  - Foco de teclado visible en TODOS los controles (antes solo el buscador lo tenía).
  - blur reducido de 30px a 14px en el panel/dock, RETIRADO de los toasts y del modal de
    fraude (pasan a fondo sólido) — menos costo de GPU en los equipos lentos que motivaron
    este proyecto. El modal de fraude además dejó de ignorar el tema claro/oscuro.
  - Panel responsive (max-width + @media) para ventanas angostas; nombre de paciente con
    tooltip completo y ya no se traga la cédula; cuenta regresiva en palabra ("en"/"hace")
    en vez de signo +/−; "no aparece en la base" deja de usar el color de una alerta real.
  Detalle completo y backlog de propuestas no aplicadas: ver conversación / memoria.

  v7.6.0 — RECORDATORIO DE PyM AL ABRIR LA HISTORIA CLÍNICA
  Al abrir la historia clínica de un paciente con PyM pendiente, sale UNA vez al día
  (por paciente) un aviso calmado — estilo propio en teal, NO el rojo de fraude — que
  hay que cerrar a mano, recordando qué actividades ordenar. Detección: confirmado con
  diagnóstico real en Everest que la pestaña #anamesis solo existe en esa vista, y que
  la cédula vive en un .text-muted del bloque de datos del paciente (mismo patrón de
  clase que "Citas del día" — reutiliza extractDoc()). Sin nombre raspado del DOM: se
  cruza la cédula contra la agenda que el Vigilante ya tiene cargada. Toggle en Ajustes
  (activado por defecto) + botón "Probar" para verlo sin esperar un paciente real.

  v7.5.0 — SEGUNDA TANDA (backlog de la auditoría + seguridad + auto-update)
  - COLA DE AVISOS CON PRIORIDAD REAL: ROJO/MORADO van al frente y nunca se autodescartan;
    AZUL/VERDE/AMBAR se cierran solos a los 9 s. Al recortar por exceso (máx. 4 visibles)
    se quita primero el más viejo que NO sea crítico. Antes un aviso MORADO podía quedar
    tapado detrás de avisos rutinarios sin cerrar — probado en vivo con 6 avisos mezclados.
  - Confirmación antes de "Restablecer todo" en Ajustes (antes un clic borraba todo sin
    preguntar). Recordatorio (máx. 1 vez/mes) si pasan 60+ días sin ver una versión nueva
    — pista de que el auto-update pudo quedar roto, sin ser una alarma falsa.
  - Blur apagado durante el arrastre del panel (arrastre más fluido en GPU vieja) y nuevo
    toggle "Modo rendimiento" en Ajustes que lo apaga del todo.
  - Tokens de los 5 colores de alerta (--c-rojo/morado/ambar/verde/azul) y de los 3 radios
    de superficie (--r-chip/card/surface): antes cada valor se repetía como literal en
    8-11 sitios distintos de la hoja de estilos.
  - v7.4.2 trajo el aviso "✅ Vigilante actualizado" (una vez, al detectar que Tampermonkey
    instaló una versión nueva del Gist) y activó el auto-update de verdad.

  v7.3.5 — MODO LIGERO
  Diseñado para equipos lentos: nada corre en segundo plano salvo lo imprescindible.
  - VIGILANCIA: vía directa del API de Everest (unos kB por consulta, con la sesión
    ya abierta; sigue vigilando aunque la pestaña esté en una historia clínica). La
    llamada se aprende con el registro de rendimiento del navegador (PerformanceObserver;
    no se intercepta ni se clona nada). Respaldo: se lee la página que está delante.
  - PyM: la base de la sede se baja UNA vez al día por su identificador de SharePoint
    (o se captura sola al abrir la base en SharePoint); «Abrir PyM» para carga manual.
  - AVISOS: un solo canal a la vez con escalamiento (Windows → aviso en la página),
    identificador por evento para no repetir jamás, y solo el FRAUDE es persistente.
  - Sin clon de fondo ni ganchos de red: ese código se ELIMINÓ por completo (no es
    que esté apagado: ya no existe).
  - REPORTE MÍNIMO al tablero (Hoja de Google, v7.3.6): SOLO el resumen del día
    anterior (1 fila/día) y los fraudes en vivo (hora + minutos, sin cédula ni
    nombre, tope 20/día). Nada de pings, errores ni diagnósticos automáticos.
  PRIVACIDAD: ningún dato de pacientes sale del navegador. Conexiones externas:
  la DESCARGA de la base (SharePoint de la IPS) y las filas mínimas del tablero.
*/

(function () {
  "use strict";
  if (window.top !== window.self) return; // nunca correr dentro de un frame
  const VERSION = "7.8.3"; // fuente única de la versión (título + diagnóstico)

  // fetch ORIGINAL, guardado en document-start (antes de que Angular y el propio
  // Vigilante envuelvan el de la página). Las consultas al API van por aquí: así no
  // pasan por ningún envoltorio ajeno ni por el registro de red del propio script,
  // que clonaría cada respuesta y gastaría memoria en cada sondeo.
  const FETCH0 = (function () {
    try { const f = window.fetch; if (typeof f !== "function") return null; return (u, o) => f.call(window, u, o); } catch (e) { return null; }
  })();

  const PAGEWIN = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window; // ventana real de la página (sandbox de Tampermonkey)

  // =====================================================================
  //  CESIÓN DEL HILO POR PRESUPUESTO DE TIEMPO (v7.8)
  //  Todo trabajo pesado (leer el Excel, indexar, caché) pasa por aquí: cada
  //  ~15 ms MEDIDOS se devuelve el control al navegador. MessageChannel y no
  //  setTimeout: los timeouts anidados se recortan a 4 ms mínimo y harían el
  //  trabajo total mucho más lento; el canal de mensajes despacha de inmediato.
  //  En un equipo lento cada tramo rinde menos filas, así que cede MÁS seguido
  //  él solo — es autoadaptativo, sin números mágicos por modelo de PC.
  // =====================================================================
  const YIELD_MC = (typeof MessageChannel !== "undefined") ? new MessageChannel() : null;
  // COLA (no ranura única): cada cesión pendiente guarda SU resolución y cada mensaje
  // del canal despierta exactamente a una, en orden. Con una ranura única, dos tareas
  // cediendo a la vez (lector de la base + sondeo de caché de 60 s) se pisaban y una
  // quedaba colgada para siempre — lo cazó la auditoría adversarial, reproducido 5/5.
  const yieldQueue = [];
  if (YIELD_MC) YIELD_MC.port1.onmessage = () => { const r = yieldQueue.shift(); if (r) r(); };
  function yieldNow() {
    if (YIELD_MC) return new Promise((r) => { yieldQueue.push(r); YIELD_MC.port2.postMessage(0); });
    return new Promise((r) => setTimeout(r, 0));
  }
  function makeYielder(budgetMs) {
    const budget = budgetMs || 15;
    let last = performance.now();
    return async function () {
      const now = performance.now();
      if (now - last < budget) return false;
      await yieldNow();
      last = performance.now();
      return true;
    };
  }
  // Ejecutar cuando el navegador esté libre (con tope): para diferir trabajo del boot.
  function idleRun(fn, timeoutMs) {
    try { if (typeof requestIdleCallback === "function") { requestIdleCallback(() => fn(), { timeout: timeoutMs || 4000 }); return; } } catch (e) {}
    setTimeout(fn, 700);
  }

  // =====================================================================
  //  AJUSTES DEL USUARIO (v5.0) — se guardan en el navegador y sobreviven
  //  a los reinicios. Se editan desde el botón "Ajustes" del panel.
  // =====================================================================
  const SETTINGS_KEY = "vgl_cfg";
  const DEFAULTS = {
    tolerancia: 6.0,          // minutos de gracia antes de marcar inasistencia
    refresco: 5,              // segundos entre lecturas
    tema: "oscuro",           // oscuro | claro | auto (sigue a Windows)
    sonido: true,             // tonos por color
    volumen: 0.15,            // 0.02 – 0.60
    insistir: true,           // el rojo repite el sonido hasta reconocer
    popup: false,             // ventana emergente en la barra de tareas
    cartel: false,            // cartel grande dentro de Everest (apagado: solo Windows)
    parpadeo: false,          // pestaña + favicon parpadeando (apagado: solo Windows)
    excluir: "vdrl,sifilis,hepatitis,hepb,hepc,hvc,vhc,hbv,vhb", // PyM a ocultar (VIH nunca se oculta)
    recordatorio: "07:30",    // avisa si a esta hora aún no hay PyM cargado ("" = nunca)
    baseAuto: true,           // bajar la base PyM de la sede UNA vez al día (por identificador)
    respaldoId: "",           // opcional: otro archivo de base (enlace o identificador)
    reporte: true,            // reporte MÍNIMO al tablero (resumen diario + fraudes; nada más)
    equipo: "",               // etiqueta del PUESTO (ej. "Consultorio 3"), NO un dato personal
    reporteUrl: "",           // opcional: otra Web App de Google (vacío = la de fábrica)
    modoRendimiento: false,   // apaga el blur/vidrio por completo (equipos muy viejos)
    recordatorioPym: true,    // recordatorio (calmado) de PyM pendiente al abrir la historia
    abandonoPES: true,        // alarma de abandono en riesgo cardiovascular (Abandonados_PES="Si")
  };
  function readJSON(k, def) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : def; } catch (e) { return def; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  const S = Object.assign({}, DEFAULTS, readJSON(SETTINGS_KEY, {}));
  // Migración desde v4.x: la ventana emergente se guardaba en una clave aparte.
  try { const viejo = localStorage.getItem("vgl_popup"); if (viejo !== null && !("popup" in (readJSON(SETTINGS_KEY, {}) || {}))) S.popup = viejo === "1"; } catch (e) {}
  // Migración a v7.3 MODO LIGERO (una sola vez): en instalaciones que ya tenían ajustes
  // guardados se apagan los canales extra.
  try {
    if (localStorage.getItem("vgl_v73") !== "1") {
      localStorage.setItem("vgl_v73", "1");
      S.cartel = false; S.parpadeo = false; S.popup = false;
      writeJSON(SETTINGS_KEY, S);
    }
  } catch (e) {}
  function saveSettings() { writeJSON(SETTINGS_KEY, S); applySettings(); }
  function applySettings() {
    CONFIG.TOLERANCIA_MIN = clampNum(S.tolerancia, 0.5, 60, DEFAULTS.tolerancia);
    CONFIG.POLL_MS = clampNum(S.refresco, 2, 120, DEFAULTS.refresco) * 1000;
    CONFIG.EXCLUDE_PYM = String(S.excluir || "").split(",").map((x) => stripAccents(x.trim().toLowerCase())).filter(Boolean);
    if (S.respaldoId && /\S/.test(S.respaldoId)) { const g = parseSpDocId(S.respaldoId); if (g) CONFIG.SP.respaldo = { id: g, name: "Base PyM (enlace personalizado)" }; }
    applyTheme();
    restartPolling();
  }
  function clampNum(v, lo, hi, def) { const n = parseFloat(v); if (!isFinite(n)) return def; return Math.min(hi, Math.max(lo, n)); }
  function darkPreferred() { try { return !PAGEWIN.matchMedia || PAGEWIN.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return true; } }
  function isLight() { return S.tema === "claro" || (S.tema === "auto" && !darkPreferred()); }
  function applyTheme() {
    try {
      const r = document.getElementById("vgl-root"); if (r) { r.classList.toggle("light", isLight()); r.classList.toggle("perf", !!S.modoRendimiento); }
      const d = document.getElementById("vgl-dock"); if (d) { d.classList.toggle("light", isLight()); d.classList.toggle("perf", !!S.modoRendimiento); }
      const t = document.getElementById("vgl-toasts"); if (t) t.classList.toggle("light", isLight());
    } catch (e) {}
  }

  const CONFIG = {
    POLL_MS: 5000,
    TOLERANCIA_MIN: 6.0,
    // Actividades PyM a OCULTAR porque la meta ya está cumplida en la IPS (ETS: solo se
    // conserva VIH). Coincidencia por texto sin acentos/minúsculas contra encabezado+etiqueta.
    // VIH SIEMPRE se conserva. Edita esta lista si cambian las metas.
    // (hvc/vhc/hbv/vhb = como aparece la hepatitis en la base piloto)
    EXCLUDE_PYM: ["vdrl", "sifilis", "hepatitis", "hepb", "hepc", "hvc", "vhc", "hbv", "vhb"],
    // SharePoint: SOLO la base de la sede, bajada por identificador único (sourcedoc).
    SP: {
      host: "viva1aips-my.sharepoint.com",
      web: "/personal/director_bello_viva1a_com_co",
      // v7.7: carpeta donde aparece el PyM del día real (confirmada por captura real:
      // Merly Lorena Rua Quintana > INTRANET > ACTIVIDADES DE PYM, archivo suelto en
      // la raíz, tipo "Agenda_Dia_CMB_20260806.xlsx"). Es la PRIMERA opción; la base
      // piloto de abajo queda como respaldo mientras no aparezca la de hoy.
      folder: "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM",
      respaldo: {
        id: "809a098b-69d1-44fe-9e51-b01f07290807",
        name: "BASE PILOTO DE CONSULTA  BELLO MAYO.xlsx",
      },
      // v7.8.3: enlace de compartir de la carpeta (generado desde SharePoint: "Compartir"
      // → "Cualquier persona con el vínculo" / "Personas de la organización"). Visitarlo
      // le da a ESTE navegador una cookie de acceso anónimo válida para esa carpeta, sin
      // que el médico tenga que iniciar sesión en SharePoint con su usuario. Se "recarga"
      // cada cierto tiempo (primeShareAccess) antes de listar/descargar.
      shareLink: "https://viva1aips-my.sharepoint.com/:f:/g/personal/director_bello_viva1a_com_co/IgCsGP_chaHvTKYH9v-QZ2Q1AQuJo3umR5gDLjKlkUqgPS4?e=jscdBl",
    },
    SEL: {
      hora: ".labelHora", estado: ".status-label", contenedor: [".card-body", ".card"],
      documento: ".text-muted", nombre: [".text-uppercase.fw-bold", ".text-uppercase"],
      modalidad: ".fw-bold.mb-0", fecha: ".fecha",
    },
  };
  // Paleta del sistema (estilo macOS, modo oscuro).
  const COLORS = { VERDE: "#30D158", AMBAR: "#FF9F0A", ROJO: "#FF453A", AZUL: "#0A84FF", MORADO: "#BF5AF2" };
  const TINT = { VERDE: "rgba(48,209,88,.20)", AMBAR: "rgba(255,159,10,.20)", ROJO: "rgba(255,69,58,.22)", AZUL: "rgba(10,132,255,.20)", MORADO: "rgba(191,90,242,.20)" };
  // v7.8.1: etiquetas ACCIONABLES, confirmadas por el médico del programa (no adivinadas):
  //  - Tamización CMB = riesgo cardiometabólico según Resolución 3280/2018 (el nombre del
  //    archivo "Agenda_Dia_CMB" es la sede/contrato, NO la prueba — se aclaró a propósito).
  //  - Tamización mama = examen clínico de mama Y mamografía juntos bajo un solo estado.
  //  - Tamización colon = Sangre Oculta en Materia Fecal (SOMF), no una colonoscopia.
  //  - Cita_AV/OD/PF pasan de nombrar la cita a decir la remisión concreta.
  //  - Tamización cérvix: el TIPO de prueba (VPH / citología-CCU) se funde en el mismo
  //    chip cuando el dato lo trae — ver PRUEBA_CERVIX y detalleTipoCervix() más abajo.
  const FRIENDLY = {
    VALORACION_INTEGRAL: "Valoración integral", TAMIZACION_CMB: "Tamización riesgo cardiometabólico (Res. 3280)",
    CITA_PF: "Remitir a Planificación Familiar", CITA_AV: "Remitir a Optometría", CITA_OD: "Remitir a Odontología",
    TAMIZACION_CERVIX: "Tamización cérvix", TAMIZACION_PROSTATA: "Tamización próstata (PSA)",
    PRUEBA_CERVIX: "Tamización cérvix", TAMIZACION_MAMA: "Tamización mama (examen clínico + mamografía)",
    TAMIZACION_COLON: "Sangre oculta en materia fecal (SOMF)",
    TAMIZACION_HEPC: "Tamización Hepatitis C", TAMIZACION_HEPB: "Tamización Hepatitis B",
    TAMIZACION_VDRL: "Tamización VDRL (Sífilis)", TAMIZACION_HB: "Tamización Hemoglobina",
    TAMIZACION_VIH: "Tamización VIH", TAMIZACION_HTO: "Tamización Hematocrito",
  };
  // Tipo de prueba de cérvix a partir del valor crudo de PRUEBA_CERVIX ("Tamizar con
  // VPH" / "Tamizar con CCU" en la base real) — se muestra dentro del chip de
  // Tamización cérvix en vez de como un chip "Prueba cérvix" aparte y genérico.
  function detalleTipoCervix(valorCrudo) {
    const s = stripAccents(String(valorCrudo || "").toLowerCase());
    if (s.includes("vph")) return "VPH";
    if (s.includes("ccu") || s.includes("citolog")) return "citología (CCU)";
    return String(valorCrudo || "").trim();               // valor tal cual si no se reconoce
  }
  const DOC_EXACT = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO", "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"];

  const state = {
    pym: new Map(), pymTodos: null, pymAbandono: new Set(), pymFile: "", pymMTime: "", pymFP: "", pymFallback: false, pymHoja: "", historical: new Map(),
    fraudWatch: new Set(), alertedFraud: new Set(), warnedTimes: new Set(),
    lastSignature: "", minimized: false, lastSnapshot: null,
    notified: new Map(), summarized: false, osNotif: false,
    lastVersionCheck: 0, versionCheckUrl: "https://script.google.com/macros/s/AKfycbwXwwQdSGGMyt4X6Wf5YbJVRZjB_z_cYEVVpRoebO_VrobIhtHKD3nAJs689kq3R7tC/exec",
    leader: false, shared: null,
    // v5.0
    filtro: "todas", busqueda: "", muteUntil: 0, sheet: null, lastRefresh: null,
    apiCitas: null, apiEn: 0,
    // v7.8.1: true SOLO si el propio script recogió el panel a la pastilla por estar
    // fuera de agenda/historia clínica — para no pelear con un "×" que el médico haya
    // pulsado a propósito (ese no se auto-restaura al volver a una vista permitida).
    autoDocked: false,
    // Última ventana elegida DE VERDAD por el médico (×/−/+, doble clic, o restaurada
    // al abrir la página). El auto-recogido/auto-restaurado por sección nunca la toca.
    userWinState: "full",
  };
  let pollTimer = null;
  function restartPolling() { if (!el || !el.root) return; if (pollTimer) clearInterval(pollTimer); pollTimer = setInterval(tick, CONFIG.POLL_MS); }
  // ---- Coordinación entre pestañas: SOLO UNA vigila y notifica (evita avisos repetidos) ----
  const TABID = String(Math.random()).slice(2) + Date.now();
  const LEADER_KEY = "vgl_leader";
  // El liderazgo debe durar SIEMPRE mas que varios ciclos de refresco. Con refresco alto
  // (Ajustes permite hasta 120 s) el TTL fijo de 14 s hacia que el mando rebotara sin parar
  // entre pestañas, y en cada relevo se perdian o repetian avisos.
  const leaderTTL = () => Math.max(14000, (CONFIG.POLL_MS || 5000) * 3 + 4000);
  let chan = null;
  try { chan = new BroadcastChannel("vgl"); chan.onmessage = (e) => { if (e.data && e.data.t) state.shared = e.data; }; } catch (e) {}
  function heartbeat() {
    try {
      const now = Date.now(), raw = localStorage.getItem(LEADER_KEY), o = raw ? JSON.parse(raw) : null;
      if (!o || o.id === TABID || now - (o.t || 0) > leaderTTL()) { localStorage.setItem(LEADER_KEY, JSON.stringify({ id: TABID, t: now })); state.leader = true; }
      else state.leader = false;
    } catch (e) { state.leader = true; }
    return state.leader;
  }
  function share(list) { try { if (chan) chan.postMessage({ t: Date.now(), list }); } catch (e) {} }
  try { window.addEventListener("beforeunload", () => { try { const o = JSON.parse(localStorage.getItem(LEADER_KEY) || "{}"); if (o.id === TABID) localStorage.removeItem(LEADER_KEY); } catch (e) {} }); } catch (e) {}

  const limpio = (s) => (s || "").replace(/\s+/g, " ").trim();
  function normalizeKey(val) {
    if (val === null || val === undefined) return "";
    let s = String(val).trim();
    if (s.endsWith(".0")) s = s.slice(0, -2);
    // Celdas numéricas que Excel entrega en notación científica ("1.23457E+9"):
    // sin esto, quedarían como "1234579" y el cruce con la agenda fallaría.
    if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(s)) { const n = Number(s); if (isFinite(n)) s = n.toFixed(0); }
    // Solo dígitos y SIN ceros a la izquierda: si la base guarda la cédula rellenada
    // ("0005150076") y la agenda la trae limpia ("5150076"), deben ser la misma clave.
    return s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  }
  function extractDoc(t) { if (!t) return ""; const first = t.split(",")[0].replace(/[.\s]/g, ""); let m = /^(\d{5,15})$/.exec(first); if (m) return m[1]; m = /(\d{5,15})/.exec(t.replace(/[.\s]/g, "")); return m ? m[1] : ""; }
  // Se ejecuta más de un millón de veces con las bases grandes: primero los descartes
  // baratos (vacío o texto largo) y solo después se normaliza la cadena.
  function isPending(val) {
    if (val === null || val === undefined || val === "") return false;
    const s = typeof val === "string" ? val : String(val);
    if (s.length > 32) return false;
    const t = s.trim().toLowerCase();
    return t === "susceptible" || t === "pendiente" || t.startsWith("tamizar");
  }
  // v7.8.1: exacto "Si"/"Sí" (sin acento insensible, sin distinguir mayúsculas) para
  // ABANDONADOS_PES — a propósito NO usa .includes() para no confundir con "Sin dato"
  // u otros valores que casualmente empiecen distinto. Un "No" (o vacío) nunca cuenta.
  function esSi(val) {
    if (val === null || val === undefined) return false;
    return stripAccents(String(val).trim().toLowerCase()) === "si";
  }
  function friendly(h) {
    if (FRIENDLY[h]) return FRIENDLY[h];
    const bruto = String(h == null ? "" : h).replace(/_/g, " ").trim();
    // Si el encabezado ya viene escrito como texto normal ("Última tamización CMB"),
    // se respeta tal cual; solo se arregla el que viene TODO EN MAYÚSCULAS.
    if (/[a-záéíóúñ]/.test(bruto)) return bruto;
    const t = bruto.toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function activityLabel(header, val) { const f = friendly(header); const s = String(val).trim().toLowerCase(); if (s === "susceptible" || s === "pendiente") return f; return `${f} — ${String(val).trim()}`; }
  function stripAccents(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function isExcludedActivity(header, label) {
    const hay = stripAccents((header + " " + label).toLowerCase());
    if (hay.includes("vih")) return false; // VIH siempre se conserva
    return CONFIG.EXCLUDE_PYM.some((k) => hay.includes(k));
  }
  function getActivities(docId) { return state.pym.get(normalizeKey(docId)) || []; }

  // v7.8: el indexado ya no recibe la tabla entera — es INCREMENTAL. El lector en
  // streaming le entrega una fila a la vez y la fila se descarta al instante: nunca
  // existe el arreglo completo de 90.000 filas en memoria.
  function makeIndexer(headersRaw) {
    const crudos = headersRaw || [];
    // Array.from (no .map) para que los huecos de las hojas reales no se salten.
    const headers = Array.from({ length: crudos.length }, (_, i) => (crudos[i] == null || crudos[i] === "" ? `COL_${i}` : String(crudos[i]).trim().toUpperCase()));
    const docIdx = findDocIdx(headers);
    if (docIdx < 0) throw new Error("No se encontró columna de documento/cédula. Columnas: " + headers.slice(0, 12).join(", "));
    // TODOS los documentos de la hoja (tengan o no pendientes): permite distinguir en el
    // panel "sin PyM pendiente" (está en la base, al día) de "no aparece en la base"
    // (paciente nuevo o cédula que no cruza) — dos cosas muy distintas para auditar.
    const map = new Map();
    const todos = new Set();
    // Memoria por columna: calcular la etiqueta y si se oculta implica normalizar acentos,
    // que es carísimo. Como el vocabulario de valores es diminuto ("Susceptible", "Tamizar
    // con CCU"…), se calcula una vez por columna+valor en lugar de por celda.
    const memo = [];
    // v7.8.1: PRUEBA_CERVIX se funde dentro del chip de TAMIZACION_CERVIX (VPH/citología)
    // en vez de salir como un chip "Prueba cérvix" aparte y genérico — confirmado con el
    // médico del programa. Se resuelven los índices UNA vez, no en cada fila.
    const cervixTamIdx = headers.indexOf("TAMIZACION_CERVIX");
    const cervixPruebaIdx = headers.indexOf("PRUEBA_CERVIX");
    // v7.8.1: ABANDONADOS_PES (o ABANDONADO_PES en la base vieja) — "Si" significa que el
    // paciente tiene abandono en el Programa de riesgo cardiovascular (PES) y su atención
    // de hoy debe PRIORIZAR el control de riesgo cardiovascular. No es una "actividad
    // pendiente" más (su vocabulario es Si/No, no Susceptible/Tamizar), así que se rastrea
    // aparte para poder darle color propio en la agenda y una alarma al abrir la historia.
    const abandonoIdx = headers.indexOf("ABANDONADOS_PES") >= 0 ? headers.indexOf("ABANDONADOS_PES") : headers.indexOf("ABANDONADO_PES");
    const abandono = new Set();
    return {
      map, todos, abandono,
      push(row) {
        const docKey = normalizeKey(row[docIdx]); if (!docKey) return;
        todos.add(docKey);
        if (abandonoIdx >= 0 && esSi(row[abandonoIdx])) abandono.add(docKey);
        const bucket = map.get(docKey) || [];
        let detalleCervix = "", cervixYaAgregado = false;
        if (cervixPruebaIdx >= 0) {
          const pv = row[cervixPruebaIdx];
          if (isPending(pv)) detalleCervix = detalleTipoCervix(pv);
        }
        for (let i = 0; i < headers.length; i++) {
          if (i === docIdx || i === cervixPruebaIdx || i === abandonoIdx) continue;
          const celda = row[i];
          if (!isPending(celda)) continue;
          let label;
          if (i === cervixTamIdx && detalleCervix) {
            // Con el TIPO de prueba disponible, ese detalle manda sobre el valor crudo
            // de Tamizacion_cervix (que normalmente es solo "Susceptible"/"Pendiente"
            // y no aporta nada que el médico no sepa ya).
            label = "Tamización cérvix — " + detalleCervix;
            cervixYaAgregado = true;
          } else {
            const clave = String(celda);
            let cm = memo[i] || (memo[i] = new Map());
            label = cm.get(clave);
            if (label === undefined) {
              // Etiqueta con el encabezado ORIGINAL (conserva tildes y mayúsculas);
              // la decisión de ocultar usa la versión en mayúsculas.
              const l = activityLabel((crudos && crudos[i]) || headers[i], celda);
              label = isExcludedActivity(headers[i], l) ? null : l;
              cm.set(clave, label);
            }
            if (label === null) continue;
            if (i === cervixTamIdx) cervixYaAgregado = true;
          }
          if (!bucket.includes(label)) bucket.push(label);
        }
        // Caso raro pero posible: Prueba_cervix trae un tipo de prueba pendiente pero
        // Tamizacion_cervix NO estaba pendiente en esa fila (p. ej. datos inconsistentes
        // entre columnas). No se pierde la información: se agrega igual.
        if (detalleCervix && !cervixYaAgregado) {
          const label = "Tamización cérvix — " + detalleCervix;
          if (!bucket.includes(label)) bucket.push(label);
        }
        // Solo se guardan los pacientes que SÍ tienen algo pendiente. Así el número que
        // muestra el panel es el útil, y si por error se leyera la hoja equivocada el
        // contador se va a cero y salta a la vista en lugar de engañar.
        if (bucket.length) map.set(docKey, bucket);
      },
    };
  }
  // Para tablas ya materializadas (CSV): misma lógica, cediendo el hilo por tandas.
  async function indexRowsAsync(headersRaw, rows, maybeYield) {
    const ix = makeIndexer(headersRaw);
    for (let i = 0; i < rows.length; i++) {
      ix.push(rows[i]);
      if (maybeYield && (i & 1023) === 0) await maybeYield();
    }
    return { map: ix.map, todos: ix.todos, abandono: ix.abandono };
  }
  function parseCSV(text) { return text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length).map((l) => l.split(",")); }

  // =====================================================================
  //  LECTOR DE EXCEL BLINDADO (v5.4) + STREAMING (v7.8)
  //  Pensado para aguantar archivos reales, no solo el PyM diario limpio:
  //   - Libros con VARIAS hojas: elige la correcta por CONTENIDO (la que
  //     tenga columna de documento y celdas "Susceptible"), no la primera.
  //   - Hojas gigantes (decenas de MB): v7.8 — se descomprimen POR TROZOS y
  //     cada fila se indexa y se descarta al vuelo. La base piloto infla a
  //     110 MB de XML: antes ese string vivía entero en memoria (y solo
  //     decodificarlo congelaba el hilo 2,8 s); ahora nunca existe.
  //   - Encabezado que no está en la fila 1 (hojas con títulos o logos).
  //   - Sin librerías externas: la red corporativa bloquea los CDN.
  // =====================================================================
  const XLSX_LIMITS = { scanBytes: 300000, maxRows: 300000, maxBufChars: 8 * 1024 * 1024 };

  // Inflado con tope opcional: para "espiar" el principio de una hoja enorme
  // sin descomprimirla entera (así elegir hoja cuesta milisegundos).
  async function inflateRaw(bytes, maxBytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    if (!maxBytes) { const ab = await new Response(stream).arrayBuffer(); return new Uint8Array(ab); }
    const reader = stream.getReader();
    const trozos = []; let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        trozos.push(value); total += value.length;
        if (total >= maxBytes) break;
      }
    } finally { try { reader.cancel(); } catch (e) {} }
    const out = new Uint8Array(total); let p = 0;
    for (const t of trozos) { out.set(t, p); p += t.length; }
    return out;
  }
  function colToIdx(ref) { const m = /^([A-Z]+)/.exec(ref || ""); if (!m) return -1; let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; }
  function unescXml(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, "&");
  }
  // Trozos descomprimidos de una entrada del ZIP, según van saliendo (v7.8).
  async function* zipEntryChunks(zip, name) {
    const f = zip.files[name];
    if (!f) return;
    const lh = f.localOff;
    const start = lh + 30 + zip.dv.getUint16(lh + 26, true) + zip.dv.getUint16(lh + 28, true);
    const comp = zip.bytes.subarray(start, start + f.compSize);
    if (f.method === 0) { yield comp; return; }
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([comp]).stream().pipeThrough(ds);
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally { try { reader.releaseLock(); } catch (e) {} }
  }
  // sharedStrings: soporta texto con formato (varios <t> dentro de un <si>).
  // v7.8: en STREAMING — el XML de textos nunca se retiene completo, y se cede
  // el hilo por presupuesto de tiempo mientras se procesa.
  async function parseSharedStringsStream(zip, maybeYield) {
    const out = [];
    if (!zip.files["xl/sharedStrings.xml"]) return out;
    const td = new TextDecoder("utf-8");
    let buf = "";
    const siRe = /<si\b(?:\s*\/>|[^>]*>([\s\S]*?)<\/si>)/g;
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    for await (const chunk of zipEntryChunks(zip, "xl/sharedStrings.xml")) {
      buf += td.decode(chunk, { stream: true });
      siRe.lastIndex = 0;
      let m, consumed = 0;
      while ((m = siRe.exec(buf)) !== null) {
        const cuerpo = m[1] || "";
        let s = "";
        tRe.lastIndex = 0;
        let t;
        while ((t = tRe.exec(cuerpo)) !== null) s += t[1];
        out.push(unescXml(s));
        consumed = siRe.lastIndex;
        await maybeYield();
      }
      if (consumed) buf = buf.slice(consumed);
      if (buf.length > 4 * 1024 * 1024) throw new Error("sharedStrings ilegible (una entrada de >4 MB)");
    }
    return out;
  }
  // Parseo de UNA fila (mismas reglas de siempre: huecos rellenos, inlineStr,
  // sharedStrings, referencia de columna). La usa el lector en streaming.
  const CELL_RE = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;
  function parseRowBody(cuerpo, shared) {
    const arr = [];
    if (cuerpo) {
      CELL_RE.lastIndex = 0;
      let cm, libre = 0;
      while ((cm = CELL_RE.exec(cuerpo)) !== null) {
        const attrs = cm[1] || "", body = cm[2] || "";
        const refM = /r="([A-Z]+)\d+"/.exec(attrs);
        let idx = refM ? colToIdx(refM[1]) : -1;
        if (idx < 0) idx = libre;
        libre = idx + 1;
        const tM = /t="([^"]+)"/.exec(attrs), tipo = tM ? tM[1] : "";
        let val = "";
        if (tipo === "inlineStr") {
          const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t;
          while ((t = tRe.exec(body)) !== null) val += t[1];
          val = unescXml(val);
        } else {
          const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
          val = vM ? vM[1] : "";
          if (tipo === "s") { const i = parseInt(val, 10); val = (shared && shared[i] !== undefined) ? shared[i] : ""; }
          else val = unescXml(val);
        }
        arr[idx] = val;
      }
    }
    for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = "";
    return arr;
  }
  function scanSheetRows(xml, shared, maxRows) {
    const filas = [];
    const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g;
    const cellRe = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;
    let rm;
    while ((rm = rowRe.exec(xml)) !== null) {
      const cuerpo = rm[2];
      const arr = [];
      if (cuerpo) {
        cellRe.lastIndex = 0;
        let cm, libre = 0;
        while ((cm = cellRe.exec(cuerpo)) !== null) {
          const attrs = cm[1] || "", body = cm[2] || "";
          const refM = /r="([A-Z]+)\d+"/.exec(attrs);
          let idx = refM ? colToIdx(refM[1]) : -1;
          if (idx < 0) idx = libre;
          libre = idx + 1;
          const tM = /t="([^"]+)"/.exec(attrs), tipo = tM ? tM[1] : "";
          let val = "";
          if (tipo === "inlineStr") {
            const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t;
            while ((t = tRe.exec(body)) !== null) val += t[1];
            val = unescXml(val);
          } else {
            const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
            val = vM ? vM[1] : "";
            if (tipo === "s") { const i = parseInt(val, 10); val = (shared && shared[i] !== undefined) ? shared[i] : ""; }
            else val = unescXml(val);
          }
          arr[idx] = val;
        }
      }
      // Las hojas reales saltan celdas vacías, lo que deja "huecos" en el arreglo.
      // Se rellenan: si no, .map() los ignora y el resto del código recibe undefined.
      for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = "";
      filas.push(arr);
      if (filas.length >= (maxRows || XLSX_LIMITS.maxRows)) break;
    }
    return filas;
  }
  // Índice del ZIP (sin descomprimir contenidos todavía).
  function zipIndex(arrayBuffer) {
    const dv = new DataView(arrayBuffer), bytes = new Uint8Array(arrayBuffer), td = new TextDecoder();
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error("el archivo no es un .xlsx válido");
    let cdCount = dv.getUint16(eocd + 10, true), cdOffset = dv.getUint32(eocd + 16, true);
    // ZIP64: libros muy grandes traen los tamaños reales en otro bloque.
    if (cdOffset === 0xffffffff || cdCount === 0xffff) {
      for (let i = eocd - 20; i >= 0 && i > eocd - 200; i--) {
        if (dv.getUint32(i, true) === 0x07064b50) {
          const z64 = Number(dv.getBigUint64(i + 8, true));
          if (dv.getUint32(z64, true) === 0x06064b50) { cdCount = Number(dv.getBigUint64(z64 + 32, true)); cdOffset = Number(dv.getBigUint64(z64 + 48, true)); }
          break;
        }
      }
    }
    const files = {}; let p = cdOffset;
    for (let n = 0; n < cdCount; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), compSize = dv.getUint32(p + 20, true), uncSize = dv.getUint32(p + 24, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      files[td.decode(bytes.subarray(p + 46, p + 46 + nameLen))] = { method, compSize, uncSize, localOff };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return { dv, bytes, files };
  }
  async function zipRead(zip, name, maxBytes) {
    const f = zip.files[name]; if (!f) return null;
    const lh = f.localOff;
    const start = lh + 30 + zip.dv.getUint16(lh + 26, true) + zip.dv.getUint16(lh + 28, true);
    const comp = zip.bytes.subarray(start, start + f.compSize);
    const raw = f.method === 0 ? (maxBytes ? comp.subarray(0, maxBytes) : comp) : await inflateRaw(comp, maxBytes);
    return new TextDecoder("utf-8").decode(raw);
  }
  // Orden real de las hojas (workbook.xml + rels). Si algo falla, cae a sheetN.
  function sheetOrder(wbXml, relsXml) {
    const rmap = {};
    if (relsXml) { const re = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*>/g; let m; while ((m = re.exec(relsXml)) !== null) rmap[m[1]] = m[2].replace(/^\/?xl\//, "").replace(/^\//, ""); }
    const out = [];
    if (wbXml) {
      const re = /<sheet\b([^>]*)\/?>/g; let m;
      while ((m = re.exec(wbXml)) !== null) {
        const a = m[1];
        const nm = /name="([^"]*)"/.exec(a), rid = /r:id="([^"]*)"/.exec(a);
        const tgt = rid && rmap[rid[1]];
        if (tgt) out.push({ name: nm ? unescXml(nm[1]) : tgt, path: "xl/" + tgt });
      }
    }
    return out;
  }
  // ¿Sirve esta hoja? Puntaje por contenido: columna de documento + "Susceptible".
  function scoreSheet(filas) {
    let mejor = { score: -1, headerRow: -1, pend: 0 };
    const tope = Math.min(filas.length, 15);
    for (let h = 0; h < tope; h++) {
      const cruda = filas[h] || [];
      const cab = Array.from({ length: cruda.length }, (_, i) => String(cruda[i] == null ? "" : cruda[i]).trim().toUpperCase());
      if (cab.filter(Boolean).length < 2) continue;
      if (findDocIdx(cab) < 0) continue;
      let pend = 0;
      for (let r = h + 1; r < Math.min(filas.length, h + 400); r++) {
        const fila = filas[r] || [];
        for (let c = 0; c < fila.length; c++) if (isPending(fila[c])) pend++;
      }
      const score = 100 + Math.min(300, pend) - h;
      if (score > mejor.score) mejor = { score, headerRow: h, pend };
    }
    return mejor;
  }
  function findDocIdx(headers) {
    const h = (headers || []).map((x) => String(x == null ? "" : x));
    for (const cand of DOC_EXACT) { const k = h.indexOf(cand); if (k >= 0) return k; }
    return h.findIndex((x) => x.includes("IDENT") || x.includes("CEDULA") || x.includes("DOCUMENTO"));
  }
  // Lee el libro en STREAMING y devuelve el ÍNDICE ya construido (v7.8):
  // { headers, map, todos, sheetName, rowCount, sheets }. La elección de hoja sigue
  // siendo por muestra barata; la lectura completa va fila a fila: parsear -> indexar
  // -> descartar, cediendo el hilo por presupuesto de tiempo. Nunca se materializa
  // ni el XML completo de la hoja ni la tabla de filas.
  async function readPymWorkbookStream(arrayBuffer) {
    const maybeYield = makeYielder(15);
    const zip = zipIndex(arrayBuffer);
    const shared = await parseSharedStringsStream(zip, maybeYield);
    let hojas = sheetOrder(await zipRead(zip, "xl/workbook.xml"), await zipRead(zip, "xl/_rels/workbook.xml.rels"));
    if (!hojas.length) hojas = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort().map((p) => ({ name: p, path: p }));
    if (!hojas.length) throw new Error("el libro no tiene hojas legibles");

    // 1) Espiar solo el principio de cada hoja para elegir la buena (barato).
    const cand = [];
    for (const h of hojas) {
      const info = zip.files[h.path]; if (!info) continue;
      try {
        const muestra = await zipRead(zip, h.path, XLSX_LIMITS.scanBytes);
        const filas = scanSheetRows(muestra || "", shared, 400);
        const sc = scoreSheet(filas);
        if (sc.score > 0) cand.push({ h, sc, size: info.uncSize || 0 });
      } catch (e) { /* hoja ilegible: se ignora */ }
      await maybeYield();
    }
    cand.sort((a, b) => b.sc.score - a.sc.score);
    const elegida = cand[0] || { h: hojas[0], sc: { headerRow: 0 } };
    const headerRow = Math.max(0, elegida.sc.headerRow || 0);

    // 2) Streaming de la hoja elegida: cada fila completa se parsea, se indexa y se tira.
    progreso("Leyendo «" + elegida.h.name + "»…");
    const td = new TextDecoder("utf-8");
    const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g;
    let buf = "", nRow = 0, headers = null, indexer = null;
    for await (const chunk of zipEntryChunks(zip, elegida.h.path)) {
      buf += td.decode(chunk, { stream: true });
      rowRe.lastIndex = 0;
      let m, consumed = 0;
      while ((m = rowRe.exec(buf)) !== null) {
        const fila = parseRowBody(m[2], shared);
        if (nRow === headerRow) { headers = fila; indexer = makeIndexer(headers); }
        else if (nRow > headerRow && indexer) indexer.push(fila);
        nRow++;
        consumed = rowRe.lastIndex;
        if (nRow >= XLSX_LIMITS.maxRows) break;
        if (await maybeYield()) {
          if ((nRow & 8191) === 0) progreso("Leyendo el archivo… " + nRow.toLocaleString("es") + " filas");
        }
      }
      if (consumed) buf = buf.slice(consumed);
      if (nRow >= XLSX_LIMITS.maxRows) break;
      // Una "fila" que no cierra en 8 MB no es una fila: archivo corrupto o no tabular.
      if (buf.length > XLSX_LIMITS.maxBufChars) throw new Error("la hoja «" + elegida.h.name + "» no se puede leer por filas");
    }
    if (!indexer) throw new Error("no encontré la fila de encabezados en «" + elegida.h.name + "»");
    return { headers, map: indexer.map, todos: indexer.todos, abandono: indexer.abandono, sheetName: elegida.h.name, rowCount: nRow, sheets: hojas.map((x) => x.name) };
  }
  function afterPymLoaded(fileName) {
    state.pymFile = fileName;
    if (state.lastSnapshot) state.lastSnapshot.list.forEach((a) => { a.pym = getActivities(a.doc_id); });
    state.lastSignature = ""; tick();
    setSummary(`PyM cargado: ${state.pym.size} paciente(s) — ${fileName}`);
  }
  // Huella de un archivo PyM: identifica "el mismo archivo" sin depender solo de la fecha.
  function pymFP(name, mtime) { return String(name || "") + "|" + String(mtime || ""); }

  // =====================================================================
  //  CACHÉ COMPACTA v3 (v7.8) — diccionario de etiquetas.
  //  Las mismas ~30 etiquetas ("Tamización VIH", "Valoración integral"…) se
  //  repetían decenas de miles de veces en el JSON viejo. Ahora se guardan UNA
  //  vez y cada paciente lleva solo sus índices: 2,8 MB donde antes había 10,8
  //  (medido con la réplica de la base piloto). Empaquetar y desempaquetar
  //  ceden el hilo por tandas: ninguna pestaña se congela por la caché.
  // =====================================================================
  async function packPym(map, todos, abandono, meta, maybeYield) {
    const labels = []; const lidx = new Map();
    const parts = new Array(map.size); let n = 0;
    for (const [k, arr] of map) {
      let ids = "";
      for (const l of arr) {
        let i = lidx.get(l);
        if (i === undefined) { i = labels.length; lidx.set(l, i); labels.push(l); }
        ids += (ids ? "." : "") + i;
      }
      parts[n++] = k + ":" + ids;
      if (maybeYield && (n & 4095) === 0) await maybeYield();
    }
    const p = parts.join("|");
    if (maybeYield) await maybeYield();
    const t = Array.from(todos || []).join(",");
    if (maybeYield) await maybeYield();
    // v7.8.1: cédulas con Abandonados_PES="Si" (riesgo cardiovascular) — clave "ab".
    const ab = Array.from(abandono || []).join(",");
    if (maybeYield) await maybeYield();
    return JSON.stringify(Object.assign({ v: 3, labels, p, t, ab }, meta || {}));
  }
  async function unpackPym(txt, maybeYield) {
    const o = JSON.parse(txt);
    if (o.v !== 3) return null;                       // formato viejo: se descarta
    const labels = o.labels || [];
    const map = new Map();
    const parts = o.p ? o.p.split("|") : [];
    for (let i = 0; i < parts.length; i++) {
      const c = parts[i].indexOf(":");
      if (c < 0) continue;
      const ids = parts[i].slice(c + 1);
      const arr = ids ? ids.split(".").map((x) => labels[+x]).filter((x) => x !== undefined) : [];
      map.set(parts[i].slice(0, c), arr);
      if (maybeYield && (i & 2047) === 0) await maybeYield();
    }
    const todos = new Set();
    const t = o.t ? o.t.split(",") : [];
    for (let i = 0; i < t.length; i++) { if (t[i]) todos.add(t[i]); if (maybeYield && (i & 8191) === 0) await maybeYield(); }
    // Caché de una versión anterior a v7.8.1 sin "ab": abandono vacío, no un error.
    const abandono = new Set();
    const ab = o.ab ? o.ab.split(",") : [];
    for (let i = 0; i < ab.length; i++) { if (ab[i]) abandono.add(ab[i]); if (maybeYield && (i & 8191) === 0) await maybeYield(); }
    return { map, todos, abandono, meta: o };
  }

  // v7.8: se aplica un ÍNDICE ya construido ({map, todos, abandono}) — el lector en
  // streaming lo entrega directo, sin pasar por una tabla intermedia de filas.
  function applyPymIdx(idx, fileName, mtime, nombreReal) {
    state.pym = idx.map; state.pymTodos = idx.todos;
    state.pymAbandono = idx.abandono || new Set();
    state.pymMTime = mtime || "";
    // La huella usa el nombre CRUDO del archivo (sin las etiquetas que se le añaden para
    // mostrar), para que coincida con lo que devuelve SharePoint en la siguiente ronda.
    state.pymFP = pymFP(nombreReal || fileName, mtime);
    afterPymLoaded(fileName);
    // La caché se escribe DESPUÉS y por tandas: el panel ya está usable.
    savePymCache(fileName);
    try {
      // La fecha va TAMBIÉN en una clave diminuta: así comprobar "¿la caché es de hoy?"
      // no obliga a interpretar varios MB de JSON cada ronda.
      localStorage.setItem("vgl_pym_dia", todayStamp());
    } catch (e) {}
  }
  async function savePymCache(fileName) {
    try {
      if (typeof GM_setValue === "undefined") return;
      const txt = await packPym(state.pym, state.pymTodos, state.pymAbandono, { date: todayStamp(), name: fileName, mtime: state.pymMTime, fp: state.pymFP, fb: !!state.pymFallback }, makeYielder(15));
      if (txt.length <= 12 * 1024 * 1024) { GM_setValue("vgl_pym", txt); GM_setValue("vgl_pym_dia", todayStamp()); GM_setValue("vgl_pym_esfallback", state.pymFallback ? "1" : ""); }
      else {
        // Ya NO es un fallo silencioso (v7.8): con el formato compacto esto exigiría una
        // base ~4 veces mayor que la actual; si algún día pasa, que se sepa.
        GM_setValue("vgl_pym", ""); GM_setValue("vgl_pym_dia", "");
        setSummary("La base indexada no cabe en la caché (" + Math.round(txt.length / 1048576) + " MB): cada recarga volverá a leerla. Repórtalo.", "warn");
      }
    } catch (e) {}
  }

  // =====================================================================
  //  CONTADORES DEL DÍA + BITÁCORA DE AUDITORÍA (v5.0)
  //  Se guardan por fecha en el navegador; sirven para el reporte del turno
  //  y para ver la tendencia de la semana. Se conservan 30 días y se purgan.
  // =====================================================================
  const STATS_KEY = "vgl_stats", EVENTS_KEY = "vgl_events", KEEP_DAYS = 30;
  function allStats() { return readJSON(STATS_KEY, {}) || {}; }
  function statsToday() { const a = allStats(); return a[todayStamp()] || { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 }; }
  function bumpStat(kind) {
    const a = allStats(), d = todayStamp();
    a[d] = a[d] || { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 };
    a[d][kind] = (a[d][kind] || 0) + 1;
    purgeOld(a); writeJSON(STATS_KEY, a);
    frCache.dia = "";   // invalida el contador en memoria que usa la barra de estadísticas
  }
  function purgeOld(obj) {
    const lim = new Date(); lim.setDate(lim.getDate() - KEEP_DAYS);
    for (const k of Object.keys(obj)) { const d = new Date(k + "T00:00:00"); if (!isFinite(d) || d < lim) delete obj[k]; }
  }
  function lastDays(n) {
    const a = allStats(), out = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); out.push({ fecha: k, ...(a[k] || { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 }) }); }
    return out;
  }
  // Bitácora: se guarda para poder exportar el turno aunque se recargue la página.
  // UN ARCHIVO POR DÍA. Antes todo vivía en una sola clave y cada evento reescribía los
  // 30 días completos (hasta 13 MB y 194 ms por evento, con riesgo de superar la cuota
  // del navegador y perder la evidencia en silencio). Ahora se escribe solo el día en
  // curso, y además en tandas de 2 s en vez de en cada evento.
  const evKey = (d) => "vgl_ev_" + (d || todayStamp());
  let evBuffer = [], evTimer = null, evDia = "";
  function evFlush() {
    evTimer = null;
    if (!evBuffer.length) return;
    try {
      const d = evDia || todayStamp(), k = evKey(d);
      const hoy = (readJSON(k, []) || []).concat(evBuffer);
      evBuffer = [];
      writeJSON(k, hoy.length > 3000 ? hoy.slice(-3000) : hoy);
    } catch (e) { evBuffer = []; }
  }
  function logEvent(ev) {
    try {
      const d = todayStamp();
      if (evDia && evDia !== d) evFlush();       // el turno cruzó la medianoche
      evDia = d;
      evBuffer.push(ev);
      if (evBuffer.length >= 200) { evFlush(); return; }
      // El FRAUDE se escribe en el acto, sin esperar a la tanda. Es la evidencia que
      // justifica todo esto: si el equipo se apaga o se cierra el navegador en esos dos
      // segundos, el registro se habría perdido. Son pocos al día, así que no pesa.
      if (ev && ev.ev === "FRAUDE_EXTEMPORANEO") { if (evTimer) { clearTimeout(evTimer); evTimer = null; } evFlush(); return; }
      if (!evTimer) evTimer = setTimeout(evFlush, 2000);
    } catch (e) {}
  }
  function eventsOf(day) { evFlush(); return readJSON(evKey(day), []) || []; }
  // Limpieza de días viejos: una sola vez al arrancar, no en cada evento.
  function purgeEventDays() {
    try {
      const lim = new Date(); lim.setDate(lim.getDate() - KEEP_DAYS);
      const viejas = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf("vgl_ev_") !== 0) continue;
        const f = new Date(k.slice(7) + "T00:00:00");
        if (!isFinite(f) || f < lim) viejas.push(k);
      }
      viejas.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(EVENTS_KEY);        // formato antiguo (un solo blob gigante)
    } catch (e) {}
  }
  try { window.addEventListener("beforeunload", evFlush); } catch (e) {}
  function csvCell(v) { const s = String(v === undefined || v === null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function downloadBlob(blob, filename) {
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); } catch (e) {}
  }
  // Reporte del turno en CSV (se abre tal cual en Excel; separador ";" para Excel en español).
  function exportAudit(day) {
    const d = day || todayStamp(), evs = eventsOf(d), st = allStats()[d] || { fraude: 0, inasistencia: 0, atiempo: 0 };
    const head = ["Hora", "Evento", "Hora cita", "Documento", "Estado", "Estado previo", "Minutos", "Paciente"];
    const lines = [
      "REPORTE DE AUDITORIA - VIGILANTE DE AGENDA v" + VERSION,
      "Fecha;" + d,
      "Confirmaciones extemporaneas (FRAUDE);" + (st.fraude || 0),
      "Inasistencias registradas;" + (st.inasistencia || 0),
      "Ingresos a tiempo;" + (st.atiempo || 0),
      "Eventos registrados;" + evs.length,
      "",
      head.join(";"),
    ];
    for (const e of evs) lines.push([e.t, e.ev, e.hora, e.doc, e.estado, e.previo || "", e.min === undefined ? "" : e.min, e.nombre || ""].map(csvCell).join(";"));
    // BOM para que Excel respete las tildes.
    downloadBlob(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), "auditoria_vigilante_" + d + ".csv");
    setSummary("Reporte del " + d + " descargado (" + evs.length + " evento(s)).");
  }

  // La telemetría de errores quedó retirada; tapón para los puntos que aún la llaman.
  const telError = () => {};

  // =====================================================================
  //  REPORTE MÍNIMO AL TABLERO (v7.3.6) — Hoja de Google vía Apps Script.
  //  SOLO dos tipos de fila, para que la hoja no se llene de basura:
  //    "resumen" — 1 vez al día: conteos del día ANTERIOR (fraude/inasistencia/
  //                a tiempo/última llamada), con candado para no repetirse.
  //    "fraude"  — 1 fila por fraude EN VIVO (hora de la cita y minutos tarde;
  //                SIN cédula ni nombre), tope 20/día.
  //  Nada de pings de arranque, errores, ni diagnósticos automáticos.
  //  Cola diminuta (máx. 30) por si no hay red; se reintenta cada 10 min.
  // =====================================================================
  const TABLERO = {
    url: "https://script.google.com/macros/s/AKfycbwaSyv2nWxoeGKW1v6EpSKnnDgVv-cYKVNFe6j9VbNK1wOI3VOD0zIBHyXMgCT3zNBl/exec",
    token: "vgl-2026", // debe coincidir con el TOKEN del Apps Script (ver carpeta TABLERO)
  };
  const repUrl = () => (S.reporteUrl && /^https?:/i.test(S.reporteUrl)) ? S.reporteUrl.trim() : TABLERO.url;
  const repOn = () => !!S.reporte && !!repUrl() && typeof GM_xmlhttpRequest !== "undefined";
  // true = la Hoja lo recibió de verdad (Google a veces contesta 200 con una página
  // de login o error HTML: eso NO cuenta como recibido).
  function repPost(obj) {
    return new Promise((res) => {
      try {
        GM_xmlhttpRequest({
          method: "POST", url: repUrl(), data: JSON.stringify(obj),
          headers: { "Content-Type": "text/plain;charset=utf-8" }, timeout: 20000, // text/plain = sin preflight CORS
          onload: (r) => res(r.status >= 200 && r.status < 400 && !/accounts\.google|ServiceLogin/i.test(String(r.finalUrl || "")) && !/^\s*</.test(String(r.responseText || "").slice(0, 200))),
          onerror: () => res(false), ontimeout: () => res(false),
        });
      } catch (e) { res(false); }
    });
  }
  let repQ = null, repFlushing = false;
  function repQLoad() { if (repQ) return; try { repQ = JSON.parse(GM_getValue("vgl_repq", "[]")) || []; } catch (e) { repQ = []; } }
  function repQSave() { try { GM_setValue("vgl_repq", JSON.stringify((repQ || []).slice(-30))); } catch (e) {} }
  async function repFlush() {
    if (repFlushing || !repOn()) return;
    repQLoad(); if (!repQ.length) return;
    repFlushing = true;
    try { let g = 0; while (repQ.length && g++ < 10) { if (await repPost(repQ[0])) { repQ.shift(); repQSave(); } else break; } }
    finally { repFlushing = false; }
  }
  function reportar(evento, extra) {
    if (!repOn()) return;
    repQLoad();
    repQ.push(Object.assign({ token: TABLERO.token, equipo: (S.equipo || "").slice(0, 40), ver: VERSION, evento, ts: new Date().toISOString(), dia: todayStamp() }, extra || {}));
    repQSave(); repFlush();
  }
  // Resumen del día ANTERIOR, una sola vez (candado por fecha en el navegador).
  function repDailySummary() {
    if (!repOn()) return;
    try {
      const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
      const k = ayer.getFullYear() + "-" + String(ayer.getMonth() + 1).padStart(2, "0") + "-" + String(ayer.getDate()).padStart(2, "0");
      if (localStorage.getItem("vgl_rep_sum") === k) return;
      localStorage.setItem("vgl_rep_sum", k);
      const st = (allStats() || {})[k]; if (!st) return; // sin actividad ese día: ni fila
      reportar("resumen", { deDia: k, fraude: st.fraude || 0, inasistencia: st.inasistencia || 0, atiempo: st.atiempo || 0, ultima: st.ultima || 0 });
    } catch (e) {}
  }
  // Fraude en vivo: hora de la cita y minutos de retraso. SIN datos del paciente.
  let repFrN = 0, repFrDia = "";
  function reportarFraude(hora, min) {
    if (!repOn()) return;
    const d = todayStamp(); if (repFrDia !== d) { repFrDia = d; repFrN = 0; }
    if (repFrN >= 20) return; repFrN++;
    reportar("fraude", { hora: hora || "", min: Math.round((min || 0) * 10) / 10 });
  }

  // ================== SharePoint: PyM del día automático ==================
  function todayStamp() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function spBase() { return "https://" + CONFIG.SP.host + CONFIG.SP.web; }
  // v7.7: encuentra el archivo del PyM de HOY en la carpeta de SharePoint, por su
  // nombre — sin adivinar formatos raros: prueba las variantes de fecha más comunes
  // (20260806, 2026-08-06, 06-08-2026, 6/8/2026…) y solo acepta una coincidencia
  // EXACTA con hoy. Si no hay ninguna, no elige "el más reciente" a ciegas — mejor
  // caer al piloto que cargar sin darse cuenta la agenda de otro día.
  function todayTokens() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    const Y = d.getFullYear(), M = p(d.getMonth() + 1), D = p(d.getDate()), m = d.getMonth() + 1, day = d.getDate();
    // v7.8: también el mes EN LETRAS ("6 de agosto", "06 agosto"), por si algún día
    // suben el archivo con el nombre escrito así en vez de con la fecha numérica.
    const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][d.getMonth()];
    return [`${Y}${M}${D}`, `${Y}-${M}-${D}`, `${Y}_${M}_${D}`, `${D}${M}${Y}`, `${D}-${M}-${Y}`, `${D}_${M}_${Y}`, `${day}-${m}-${Y}`, `${day}/${m}/${Y}`,
      `${day} de ${MES}`, `${D} de ${MES}`, `${day} ${MES}`, `${D} ${MES}`];
  }
  function normName(s) { return String(s || "").replace(/[.\s_\-\/]/g, "").toLowerCase(); }
  // ¿El nombre contiene el token SIN que sea cola de otro número? Evita que el día 6
  // acepte un archivo del "26 de agosto" (el "6deagosto" vive dentro de "26deagosto").
  // OJO: esta guarda SOLO aplica a los tokens con mes en letras. A los numéricos NO:
  // un "Agenda_v2_20260806.xlsx" real quedaría rechazado porque al normalizar la "2"
  // de "v2" queda pegada a la fecha (medido en el banco de pruebas) — esos conservan
  // la coincidencia simple de siempre.
  function nameHasToken(n, t) {
    let i = -1;
    while ((i = n.indexOf(t, i + 1)) >= 0) { const prev = n[i - 1]; if (!(prev >= "0" && prev <= "9")) return true; }
    return false;
  }
  function esNombreDeHoy(name) {
    const toks = todayTokens().map(normName);
    const n = normName(name);
    return toks.some((t) => (/[a-z]/.test(t) ? nameHasToken(n, t) : n.includes(t)));
  }
  function pickTodaysFile(files) {
    const xls = (files || []).filter((f) => /\.(xlsx|xlsm|csv)$/i.test(f.Name || "") && !/^~\$/.test(f.Name || ""));
    if (!xls.length) return null;
    return xls.find((f) => esNombreDeHoy(f.Name)) || null;
  }
  // v7.8: si el PyM de HOY subió en formato .xls ANTIGUO (binario de Excel 97-2003),
  // no se puede leer desde el navegador — pero callarlo sería peor: se detecta y se
  // avisa UNA vez al día, para que pidan re-guardarlo como .xlsx.
  function xlsViejoDeHoy(files) {
    return (files || []).find((f) => /\.xls$/i.test(f.Name || "") && !/^~\$/.test(f.Name || "") && esNombreDeHoy(f.Name)) || null;
  }
  // encodeURI (no encodeURIComponent): las barras del camino deben quedar como barras.
  function spListUrl(folder) { return spBase() + "/_api/web/GetFolderByServerRelativeUrl('" + encodeURI(folder || CONFIG.SP.folder) + "')/Files?$select=Name,ServerRelativeUrl,TimeLastModified&$orderby=TimeLastModified%20desc&$top=60"; }
  const spRows = (j) => (j && (j.value || (j.d && j.d.results))) || [];
  function spDownloadUrl(sru) { return spBase() + "/_api/web/GetFileByServerRelativeUrl('" + encodeURI(sru) + "')/$value"; }
  // Listado (JSON), vía Everest con GM_xmlhttpRequest + cookies de SharePoint. Corto:
  // si la carpeta no responde en 12 s, no va a responder — mejor no dejar el panel quieto.
  const gmJson = async (url) => { const r = await gmGet(url, "json", "application/json;odata=nometadata", 12000); return r.response || (r.responseText ? JSON.parse(r.responseText) : {}); };

  // v7.8.3: "PRIME" del enlace compartido de la carpeta — sin login manual. Visitar el
  // enlace de "Compartir" de SharePoint le da a ESTE navegador (mismo dominio, mismas
  // cookies que ya usan spListUrl/spDownloadUrl) acceso de solo lectura a esa carpeta,
  // SIN que nadie tenga que iniciar sesión con su usuario. Se repite cada ~25 min (la
  // cookie de acceso anónimo de SharePoint expira; "recargar" el enlace la renueva) y
  // SIEMPRE antes de listar/descargar si la última vez falló con 401/403.
  let shareAccessAt = 0;
  async function primeShareAccess(force) {
    const link = CONFIG.SP.shareLink;
    if (!link || typeof GM_xmlhttpRequest === "undefined") return false;
    if (!force && Date.now() - shareAccessAt < 25 * 60 * 1000) return true;
    try { await gmGet(link, "", "", 15000); shareAccessAt = Date.now(); return true; }
    catch (e) { return false; }
  }
  // Del enlace de un ARCHIVO de SharePoint saca su identificador único (sourcedoc).
  // Acepta el enlace completo, el GUID con llaves o el GUID pelado.
  function parseSpDocId(u) {
    try {
      const s = decodeURIComponent(String(u || ""));
      const m = /sourcedoc=\{?([0-9a-fA-F-]{36})\}?/.exec(s) || /\{([0-9a-fA-F-]{36})\}/.exec(s) || /^\s*([0-9a-fA-F-]{36})\s*$/.exec(s);
      return m ? m[1].toLowerCase() : "";
    } catch (e) { return ""; }
  }
  // Dos formas de bajar un archivo por identificador (si una falla se prueba la otra).
  function spFallbackUrls(id) {
    const g = String(id || "").replace(/[{}]/g, "").toLowerCase();
    return [
      spBase() + "/_api/web/GetFileById('" + g + "')/$value",
      spBase() + "/_layouts/15/download.aspx?UniqueId=" + g,
    ];
  }
  // v7.8: devuelve directamente el ÍNDICE ({map, todos}); nunca la tabla de filas.
  async function readPym(name, buffer) {
    if (/\.csv$/i.test(name)) {
      const all = parseCSV(new TextDecoder().decode(new Uint8Array(buffer)));
      return indexRowsAsync(all[0] || [], all.slice(1), makeYielder(15));
    }
    const r = await readPymWorkbookStream(buffer);
    state.pymHoja = r.sheetName || "";
    return { map: r.map, todos: r.todos, abandono: r.abandono };
  }
  // Tiempo de espera POR LLAMADA: los listados deben rendirse rápido (si SharePoint no
  // responde en 12 s, no va a responder) para no dejar al usuario mirando un panel quieto;
  // las descargas sí necesitan margen porque la base piloto pesa 13 MB.
  function gmGet(url, responseType, accept, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === "undefined") { reject(new Error("permiso GM_xmlhttpRequest no concedido")); return; }
      GM_xmlhttpRequest({ method: "GET", url, responseType: responseType || "", headers: accept ? { Accept: accept } : {}, timeout: timeoutMs || 60000,
        onload: (r) => (r.status >= 200 && r.status < 300) ? resolve(r) : reject(new Error("HTTP " + r.status)),
        onerror: () => reject(new Error("error de red/permiso")), ontimeout: () => reject(new Error("se agotó el tiempo")) });
    });
  }
  const T_DESCARGA = 120000; // margen para la descarga: la base pesa ~14 MB
  // v7.8: ASÍNCRONA y por tandas. Antes cada pestaña interpretaba hasta 12 MB de JSON
  // de un solo golpe EN PLENA CARGA de la página (340 ms medidos en CPU rápida; segundos
  // en los equipos del consultorio, multiplicado por pestaña). Ahora: comprobación de
  // fecha barata sin desempaquetar, y el desempaquetado cede el hilo cada ~15 ms.
  let cacheCargando = false;
  async function loadPymFromCache() {
    if (cacheCargando) return false;
    cacheCargando = true;
    try {
      if (typeof GM_getValue === "undefined") return false;
      const raw = GM_getValue("vgl_pym", ""); if (!raw) return false;
      // Purga de días anteriores: no conservamos datos de pacientes de jornadas pasadas.
      // OJO: se borra TAMBIÉN la marca "vgl_pym_dia"; si queda puesta, el captador de la
      // pestaña de SharePoint cree que la base de hoy ya está y no vuelve a capturarla.
      const purgar = () => { try { GM_setValue("vgl_pym", ""); GM_setValue("vgl_pym_dia", ""); } catch (e2) {} };
      // Un paquete que no sea v3 (p. ej. la caché v2 del día de la actualización) se
      // descarta por el PREFIJO, sin pagar el JSON.parse de varios MB solo para tirarlo.
      if (raw.lastIndexOf('{"v":3', 0) !== 0) { purgar(); return false; }
      // La fecha viaja al FINAL del paquete (los metadatos van tras los datos): mirar la
      // cola evita desempaquetar varios MB solo para descubrir que es de ayer.
      const rapida = /"date":"(\d{4}-\d{2}-\d{2})"/.exec(raw.slice(-800));
      if (rapida && rapida[1] !== todayStamp()) { purgar(); return false; }
      const u = await unpackPym(raw, makeYielder(15));
      if (!u) { purgar(); return false; }               // formato v2 u otro: se re-indexa
      if (u.meta.date !== todayStamp()) { purgar(); return false; }
      if (state.pymFile) return true;                    // algo se cargó mientras se desempaquetaba
      state.pym = u.map; state.pymTodos = u.todos; state.pymAbandono = u.abandono || new Set(); state.pymMTime = u.meta.mtime || ""; state.pymFP = u.meta.fp || ""; state.pymFallback = !!u.meta.fb; afterPymLoaded((u.meta.name || "PyM") + " (auto)"); return true;
    } catch (e) { return false; } finally { cacheCargando = false; } }
  // ¿La respuesta es de verdad un Excel? (.xlsx = ZIP, empieza por "PK"). Si SharePoint
  // devuelve la página de inicio de sesión con estado 200, aquí se cae la careta.
  function esLibroValido(buf, nombre) {
    if (!buf || !buf.byteLength) return false;
    if (/\.csv$/i.test(nombre || "")) return true;
    const u8 = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
    return u8[0] === 0x50 && u8[1] === 0x4B;
  }
  // v7.8.1: un .xlsx PROTEGIDO CON CONTRASEÑA no es un ZIP — es un contenedor OLE/CFB
  // cifrado (firma D0 CF 11 E0). esLibroValido() ya lo rechaza (no empieza por "PK"),
  // pero antes caía en el mismo error genérico "no es un Excel" que una sesión vencida.
  // Se distingue para que el aviso diga la verdad, en vez de mandar a reabrir SharePoint
  // sin motivo cuando el problema real es que hay que quitarle la contraseña al archivo.
  function esXlsxCifrado(buf) {
    if (!buf || buf.byteLength < 8) return false;
    const u8 = new Uint8Array(buf, 0, 8);
    return u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;
  }
  // Avisos de progreso: que nunca parezca colgado mientras trabaja.
  function progreso(txt) { try { if (!state.pymFile) setSummary("⏳ " + txt); } catch (e) {} }

  // ---- BASE PILOTO PERSISTENTE (v7.8.1, pedido explícito del programa) ----
  // La copia INDEXADA de la piloto queda GUARDADA entre días en el almacén de
  // Tampermonkey. Al necesitarla se muestra AL INSTANTE (sin red, sin releer 14 MB) y
  // solo se comprueba 1-2 VECES AL DÍA (mañana/tarde, una consulta de metadatos de
  // ~1 KB) si cambió en SharePoint. Sin red, o sin cambios: se usa SIEMPRE la última
  // copia guardada — nunca se vuelve a pagar la descarga completa solo por rutina.
  // El PyM del DÍA conserva su ciclo propio (cada 10 min); «Abrir PyM» manda siempre.
  let baseIntentos = 0;
  const PILOTO_KEY = "vgl_piloto", PILOTO_CHK = "vgl_piloto_chk";
  function pilotoId() { const fb = CONFIG.SP.respaldo; return (fb && fb.id ? String(fb.id) : "").replace(/[{}]/g, "").toLowerCase(); }
  async function pilotoDesdeCache() {
    try {
      if (typeof GM_getValue === "undefined") return false;
      const raw = GM_getValue(PILOTO_KEY, ""); if (!raw || raw.lastIndexOf('{"v":3', 0) !== 0) return false;
      const u = await unpackPym(raw, makeYielder(15));
      if (!u || (u.meta.id || "") !== pilotoId()) return false;   // cambió el enlace configurado en Ajustes
      if (state.pymFile) return true;
      state.pym = u.map; state.pymTodos = u.todos; state.pymAbandono = u.abandono || new Set(); state.pymMTime = u.meta.mtime || ""; state.pymFP = u.meta.fp || "";
      state.pymFallback = true;
      afterPymLoaded((u.meta.name || "Base piloto") + " (base piloto — aún no llega la de hoy)");
      return true;
    } catch (e) { return false; }
  }
  async function pilotoGuardar(idx, meta) {
    try {
      if (typeof GM_setValue === "undefined") return;
      const txt = await packPym(idx.map, idx.todos, idx.abandono, Object.assign({ date: todayStamp(), fb: true, id: pilotoId() }, meta || {}), makeYielder(15));
      if (txt.length <= 12 * 1024 * 1024) GM_setValue(PILOTO_KEY, txt);
    } catch (e) {}
  }
  // Metadatos del archivo piloto (unos bytes): saber si cambió SIN bajarlo entero.
  async function pilotoMeta() {
    try {
      const j = await gmJson(spBase() + "/_api/web/GetFileById('" + pilotoId() + "')?$select=Name,TimeLastModified");
      const o = (j && j.d) ? j.d : j;
      return (o && o.TimeLastModified) ? { name: o.Name || "", mtime: o.TimeLastModified } : null;
    } catch (e) { return null; }
  }
  // Revisión de frescura: como máximo UNA vez por franja (mañana / tarde) por día, y
  // solo mientras se esté usando la piloto (si ya llegó el PyM real, no aplica).
  let pilotoChkEnCurso = false;
  async function pilotoFreshCheck() {
    try {
      if (pilotoChkEnCurso || !S.baseAuto || !state.pymFallback || typeof GM_getValue === "undefined") return;
      if (!heartbeat()) return;
      const franja = todayStamp() + "|" + (new Date().getHours() < 12 ? "am" : "pm");
      if (GM_getValue(PILOTO_CHK, "") === franja) return;
      pilotoChkEnCurso = true;
      GM_setValue(PILOTO_CHK, franja);
      const m = await pilotoMeta();
      if (!m || (m.mtime && m.mtime === state.pymMTime)) return;  // sin metadatos o sin cambios: sigue la copia
      const ok = await loadPymBaseDescarga(true, m);
      if (ok) notify("AZUL", "📋 Base piloto actualizada", (m.name || "Base piloto") + "\nSe bajó la versión nueva desde SharePoint.", false, "pilotoupd|" + franja);
    } catch (e) {} finally { pilotoChkEnCurso = false; }
  }
  async function loadPymBase(silent) {
    if (!S.baseAuto) return false;
    const fb = CONFIG.SP.respaldo;
    if (!fb || !fb.id || typeof GM_xmlhttpRequest === "undefined") return false;
    if (state.pymFile) return true;                    // ya hay algo cargado (caché o manual)
    // v7.8.1: PRIMERO la copia guardada (cero red, instantánea). La frescura se
    // revisa aparte, 1-2 veces al día, sin bloquear el arranque.
    if (await pilotoDesdeCache()) { pilotoFreshCheck(); return true; }
    return loadPymBaseDescarga(silent, await pilotoMeta());
  }
  async function loadPymBaseDescarga(silent, meta) {
    const fb = CONFIG.SP.respaldo;
    if (!fb || !fb.id || typeof GM_xmlhttpRequest === "undefined") return false;
    progreso("Bajando la base PyM de la sede… (pesa ~14 MB, puede tardar medio minuto)");
    // Las dos rutas del mismo archivo se prueban UNA TRAS OTRA, no a la vez: en
    // paralelo serían dos descargas de ~14 MB el mismo día. Medido en la red de la
    // sede: 13.6 MB en 15-19 s por ruta; el margen de 120 s sobra.
    const errores = [];
    let buf = null;
    for (const url of spFallbackUrls(fb.id)) {
      try {
        const dl = await gmGet(url, "arraybuffer", "", T_DESCARGA);
        if (!esLibroValido(dl.response, fb.name)) throw new Error(esXlsxCifrado(dl.response) ? "el archivo tiene contraseña" : "no es un Excel");
        buf = dl.response; break;
      } catch (e) { errores.push((e && e.message) || "error"); }
    }
    if (!buf) {
      // Diagnóstico CLARO (antes fallaba en silencio y nadie sabía por qué):
      // v7.8: el caso /red|permiso/ casi siempre era la SESIÓN de SharePoint vencida:
      // la petición redirige a login.microsoftonline.com y Tampermonkey la cortaba ahí
      // (esos dominios ya están en @connect, pero sin sesión igual no hay archivo).
      // v7.8.1: el archivo CON CONTRASEÑA se distingue del resto — no es un problema de
      // sesión, es que hay que quitarle la protección antes de subirlo.
      const razon = errores.find((x) => /contraseña/i.test(x)) ? "el archivo de SharePoint tiene CONTRASEÑA — pide que lo guarden sin protección (Excel: Archivo → Información → Proteger libro → Quitar contraseña)"
        : errores.find((x) => /red|permiso/i.test(x)) ? "la conexión no salió (permiso de Tampermonkey, o sesión de SharePoint vencida que redirige al login)"
        : errores.find((x) => /401|403/.test(x)) ? "SharePoint rechazó la sesión (401/403)"
        : errores.find((x) => /no es un Excel/i.test(x)) ? "SharePoint contestó su página de inicio de sesión en vez del archivo"
        : (errores[0] || "sin respuesta");
      if (!silent) setSummary("No bajó la base PyM — " + razon + ". Arreglo: Ajustes → «Abrir SharePoint», entra con tu usuario y espera el aviso de captura (o usa «Abrir PyM»).", "warn");
      console.warn("[Vigilante] base PyM:", errores.join(" · "));
      return false;
    }
    // En la revisión de frescura, state.pymFile YA está puesto (es la copia vieja de la
    // piloto): solo se aborta si lo cargado NO es la piloto (PyM real o carga manual).
    if (state.pymFile && !state.pymFallback) return true;
    progreso("Leyendo la base…");
    const idx = await readPym(fb.name, buf);
    if (state.pymFile && !state.pymFallback) return true;
    // La copia persistente se guarda ANTES de aplicar (orden determinista) y con los
    // metadatos reales del archivo, para que la próxima revisión de frescura compare bien.
    await pilotoGuardar(idx, { name: (meta && meta.name) || fb.name, mtime: (meta && meta.mtime) || "", fp: pymFP(fb.name, (meta && meta.mtime) || "") });
    // v7.7: esta es la base PILOTO (respaldo) — antes esta línea decía "false" por error
    // y el panel nunca alcanzaba a avisar "⚠ RESPALDO". Ahora sí marca correctamente que
    // NO es el PyM real del día, para que loadPymDiario() sepa que puede reemplazarla.
    state.pymFallback = true;
    applyPymIdx(idx, ((meta && meta.name) || fb.name) + " (base piloto — aún no llega la de hoy)", (meta && meta.mtime) || "", fb.name);
    notify("AMBAR", "📋 Usando la base piloto (mientras llega la de hoy)", fb.name + "\n" + state.pym.size + " paciente(s). Es una base de referencia, NO la agenda de hoy — puede tener actividades desactualizadas. Se reemplaza sola apenas aparezca el PyM real de hoy en SharePoint.", false);
    return true;
  }
  // v7.7: PyM DEL DÍA — primera opción. Busca en la carpeta de SharePoint (confirmada
  // por captura real) el archivo cuyo nombre trae la fecha de hoy y lo descarga directo,
  // sin que el médico entre a SharePoint. Si ya está cargado y no cambió, no hace nada
  // (compara la huella nombre+fecha de modificación — no vuelve a descargar los mismos
  // ~5-15 MB cada vez). Se llama periódicamente: la primera vez que lo encuentra
  // REEMPLAZA lo que hubiera (incluida la base piloto, vía el mismo applyPymIdx() que ya
  // sustituye todo el mapa de PyM, no lo mezcla).
  let diarioEnCurso = false;
  // v7.8.1: contador de chequeos SEGUIDOS en los que ni siquiera se pudo LISTAR la
  // carpeta (la sesión de SharePoint murió a media jornada — el caso más peligroso,
  // porque antes fallaba en silencio total y el médico seguía con la piloto sin
  // enterarse de que el PyM real podía llevar horas subido). A los 30 min (3
  // chequeos de 10 min) se avisa UNA sola vez al día.
  let diarioFallosSesion = 0;
  async function loadPymDiario(silent) {
    if (diarioEnCurso || typeof GM_xmlhttpRequest === "undefined") return false;
    diarioEnCurso = true;
    try {
      // v7.8.3: renueva el acceso por el enlace compartido ANTES de listar — así la
      // gran mayoría de los equipos nunca ven un 401/403 en primer lugar.
      await primeShareAccess();
      let filas;
      try {
        filas = spRows(await gmJson(spListUrl()));
        diarioFallosSesion = 0;                          // listó bien: la sesión está viva
      } catch (eList) {
        // Un solo reintento: fuerza refrescar el enlace compartido (por si la cookie
        // ya había expirado) y vuelve a listar antes de darse por vencido.
        try { await primeShareAccess(true); filas = spRows(await gmJson(spListUrl())); diarioFallosSesion = 0; }
        catch (eList2) {
          diarioFallosSesion++;
          filas = [];
          if (diarioFallosSesion === 3 && state.leader) {
            notify("AMBAR", "🔒 Posible sesión de SharePoint vencida", "Llevo media hora sin poder revisar la carpeta del PyM — si el archivo de hoy ya está subido, no lo estoy viendo.\nAbre SharePoint una vez (Ajustes → «Abrir SharePoint») para renovar la sesión.", false, "sesionvencida|" + todayStamp());
          }
        }
      }
      const sel = pickTodaysFile(filas);
      if (!sel) {
        // ¿Subieron el de hoy pero en .xls antiguo? Avisar claro en vez de quedarse mudo.
        const viejo = xlsViejoDeHoy(filas);
        if (viejo && state.leader) notify("AMBAR", "📋 El PyM de hoy está en formato .xls antiguo", viejo.Name + "\nEse formato no se puede leer desde el navegador. Pide que lo guarden como .xlsx (Excel: Guardar como → Libro de Excel) y se cargará solo en el siguiente chequeo.", false, "xlsviejo|" + todayStamp());
        if (!silent) setSummary("Aún no aparece el PyM de hoy en SharePoint. " + (state.pymFile ? "Sigo con lo que hay cargado." : "Buscando también la base piloto mientras tanto."), "warn");
        return false;
      }
      // Ya es exactamente este archivo (mismo nombre + misma fecha de modificación):
      // nada que hacer, ahorra la descarga.
      if (state.pymFP === pymFP(sel.Name, sel.TimeLastModified)) return true;
      progreso("Descargando el PyM de hoy (" + sel.Name + ")…");
      const dl = await gmGet(spDownloadUrl(sel.ServerRelativeUrl), "arraybuffer", "", T_DESCARGA);
      if (!esLibroValido(dl.response, sel.Name)) throw new Error(esXlsxCifrado(dl.response) ? "el archivo tiene contraseña — pide que la quiten antes de subirlo" : "no es un Excel (¿sesión caída?)");
      const idx = await readPym(sel.Name, dl.response);
      const eraRespaldo = state.pymFallback;
      state.pymFallback = false;
      applyPymIdx(idx, sel.Name + " (PyM de hoy)", sel.TimeLastModified, sel.Name);
      notify("AZUL", eraRespaldo ? "📋 Ya llegó el PyM real de hoy" : "📋 PyM del día cargado",
        sel.Name + "\n" + state.pym.size + " paciente(s) con actividades." + (eraRespaldo ? " Se reemplazó la base piloto." : ""), false);
      return true;
    } catch (e) {
      if (!silent) setSummary("No pude leer el PyM del día (" + ((e && e.message) || e) + "). " + (state.pymFile ? "Sigo con lo que hay cargado." : "Probando la base piloto."), "warn");
      return false;
    } finally { diarioEnCurso = false; }
  }
  // CAPTADOR LIGERO en la pestaña de SharePoint (v7.3.2). Si la descarga desde
  // Everest falla (permiso de Tampermonkey, sesión, 403…), este es el plan seguro:
  // cuando usted abre SharePoint, la base se baja AQUÍ MISMO con fetch de la propia
  // pestaña (misma sesión, mismos permisos con los que ya está viendo el archivo) y
  // se comparte con Everest por el almacén de Tampermonkey. Solo actúa si falta la
  // base de hoy; no monta panel, no observa nada, no repite rondas.
  async function bootSharepointLite() {
    try {
      if (typeof GM_setValue === "undefined" || typeof GM_getValue === "undefined") return;
      if (!S.baseAuto) return;
      // "Ya está" SOLO si es de hoy, el paquete existe de verdad, Y no es la base
      // piloto (si es piloto, seguimos intentando conseguir el PyM real de hoy).
      const yaListo = GM_getValue("vgl_pym_dia", "") === todayStamp() && !GM_getValue("vgl_pym_esfallback", "1") && String(GM_getValue("vgl_pym", "") || "").length > 100;
      if (yaListo) return;
      spToast("Buscando el PyM de hoy…");
      // v7.7: PRIMERA opción — el PyM real de hoy, listando la carpeta (misma sesión,
      // sin permisos extra). Solo si no aparece se usa la base piloto de respaldo.
      let nombre = "", buf = null, esFallback = true, mtime = "";
      try {
        const rl = await fetch(spListUrl(), { credentials: "include", headers: { Accept: "application/json;odata=nometadata" } });
        if (rl.ok) {
          const sel = pickTodaysFile(spRows(await rl.json()));
          if (sel) {
            const rd = await fetch(spDownloadUrl(sel.ServerRelativeUrl), { credentials: "include" });
            if (rd.ok) { const b = await rd.arrayBuffer(); if (esLibroValido(b, sel.Name)) { buf = b; nombre = sel.Name; mtime = sel.TimeLastModified || ""; esFallback = false; } }
          }
        }
      } catch (e) {}
      if (!buf) {
        let fb = CONFIG.SP.respaldo;
        if (S.respaldoId && /\S/.test(S.respaldoId)) { const g = parseSpDocId(S.respaldoId); if (g) fb = { id: g, name: "Base PyM (enlace personalizado)" }; }
        if (!fb || !fb.id) return;
        let err = "";
        for (const url of spFallbackUrls(fb.id)) {
          try {
            const r = await fetch(url, { credentials: "include" });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const b = await r.arrayBuffer();
            if (!esLibroValido(b, fb.name)) throw new Error("no es un Excel");
            buf = b; nombre = fb.name; break;
          } catch (e) { err = (e && e.message) || "error"; }
        }
        if (!buf) { spToast("No pude bajar el PyM (" + err + "). Ábrelo una vez con tu usuario y recarga esta página."); return; }
      }
      const idx = await readPym(nombre, buf);
      const txt = await packPym(idx.map, idx.todos, idx.abandono, { date: todayStamp(), name: nombre + (esFallback ? " (base piloto — aún no llega la de hoy)" : " (PyM de hoy)"), mtime, fp: pymFP(nombre, mtime), fb: esFallback }, makeYielder(15));
      if (txt.length <= 12 * 1024 * 1024) { GM_setValue("vgl_pym", txt); GM_setValue("vgl_pym_dia", todayStamp()); GM_setValue("vgl_pym_esfallback", esFallback ? "1" : ""); }
      spToast((esFallback ? "⚠ Sin PyM de hoy — se usará la base piloto (referencia): " : "✓ PyM de hoy capturado: ") + nombre + " — " + idx.map.size + " paciente(s). Ya está disponible en Everest.");
    } catch (e) { try { spToast("No pude capturar el PyM: " + ((e && e.message) || e)); } catch (x) {} }
  }

  // Hasta 3 intentos espaciados por si la sesión de SharePoint aún no está lista al
  // arrancar el turno. Solo descarga la pestaña líder; las demás esperan la caché.
  function schedulePymBase() {
    if (state.pymFile || baseIntentos >= 3) return;
    const espera = baseIntentos === 0 ? 2000 : baseIntentos === 1 ? 45000 : 180000;
    baseIntentos++;
    setTimeout(async () => {
      if (state.pymFile || await loadPymFromCache()) return;
      if (!heartbeat()) { schedulePymBase(); return; }
      console.log("[Vigilante] base PyM: intento " + baseIntentos + " de 3");
      // El ÚLTIMO intento habla: si falla, el motivo queda a la vista en el panel
      // (antes los tres intentos eran mudos y el "PyM sin cargar" no se explicaba).
      const ok = await loadPymBase(baseIntentos < 3).catch(() => false);
      if (!ok) schedulePymBase();
    }, espera);
  }
  function spToast(msg) {
    try { let t = document.getElementById("vgl-sp"); if (!t) { t = document.createElement("div"); t.id = "vgl-sp"; t.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;max-width:430px;background:#0B1220;color:#F1F5F9;border:1px solid #3B4B63;border-left:6px solid #10B981;border-radius:8px;padding:12px 14px;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.5)"; (document.body || document.documentElement).appendChild(t); } t.textContent = "🛡️ Vigilante PyM · " + msg; } catch (e) {}
  }

  function loadPymFile(file) {
    const name = file.name.toLowerCase(); const reader = new FileReader();
    reader.onerror = () => setSummary("No se pudo leer el archivo PyM.", "error");
    if (name.endsWith(".csv")) { reader.onload = async (e) => { try { const all = parseCSV(String(e.target.result)); const idx = await indexRowsAsync(all[0] || [], all.slice(1), makeYielder(15)); state.pymFallback = false; applyPymIdx(idx, file.name); } catch (err) { setSummary("Error CSV: " + err.message, "error"); } }; reader.readAsText(file, "UTF-8"); }
    else { reader.onload = async (e) => { try { if (typeof DecompressionStream === "undefined") throw new Error("Navegador sin soporte .xlsx; usa .csv."); const r = await readPymWorkbookStream(e.target.result); state.pymFallback = false; state.pymHoja = r.sheetName || ""; applyPymIdx({ map: r.map, todos: r.todos, abandono: r.abandono }, file.name + (r.sheetName ? " · hoja «" + r.sheetName + "»" : "")); } catch (err) { setSummary("Error .xlsx (" + err.message + "). Prueba .csv.", "error"); telError("xlsx", (err && err.message) || String(err)); } }; reader.readAsArrayBuffer(file); }
  }

  // ---- Extracción del DOM (parametrizada por documento: sirve para la página o para el clon) ----
  function firstMatch(root, selList) { const arr = Array.isArray(selList) ? selList : [selList]; for (const s of arr) { const el = root.querySelector(s); if (el) return el; } return null; }
  function containerOf(elHora) {
    for (const s of CONFIG.SEL.contenedor) { const c = elHora.closest(s); if (c) return c; }
    const body = elHora.ownerDocument.body; let n = elHora.parentElement, saltos = 0;
    while (n && n !== body && saltos < 8) { if (n.querySelector(CONFIG.SEL.estado)) return n; n = n.parentElement; saltos++; }
    return null;
  }
  function extractAgenda(doc) {
    doc = doc || document;
    const horas = Array.from(doc.querySelectorAll(CONFIG.SEL.hora));
    if (horas.length === 0) return { visible: false, citas: [] };
    const citas = horas.map((h, i) => {
      const cont = containerOf(h); let estado = "", documento = "", nombre = "", modalidad = "";
      if (cont) {
        estado = limpio((cont.querySelector(CONFIG.SEL.estado) || {}).textContent);
        documento = limpio((firstMatch(cont, CONFIG.SEL.documento) || {}).textContent);
        nombre = limpio((firstMatch(cont, CONFIG.SEL.nombre) || {}).textContent);
        modalidad = limpio((cont.querySelector(CONFIG.SEL.modalidad) || {}).textContent);
      }
      return { hora_texto: limpio(h.textContent), doc_id: extractDoc(documento), nombre: nombre || "Paciente Everest", modalidad, estado: estado || "Pendiente", index: i };
    });
    return { visible: true, citas };
  }

  // =====================================================================
  //  SECCIÓN ACTIVA (v7.8.1) — Everest es una SPA Angular: la página NO recarga al
  //  cambiar de pantalla (Angular solo reemplaza el DOM interno), así que el script,
  //  inyectado UNA sola vez por Tampermonkey al abrir Everest, seguía vigilando (leer
  //  el DOM, sondear el API, mostrar el panel) en CUALQUIER sección, no solo en las
  //  dos donde tiene sentido: agenda del día e historia clínica.
  //  Detección por LISTA BLANCA (no hace falta conocer todas las demás pantallas de
  //  Everest): los MISMOS marcadores de DOM que el script ya usaba para leer la
  //  agenda (.labelHora, CONFIG.SEL.hora) y el recordatorio de PyM (#anamesis).
  //  Fuera de las dos, tick() se apaga entero (DOM, API, panel) y se recoge a la
  //  pastilla flotante; al volver, se restaura sola.
  // =====================================================================
  function seccionActiva() {
    try {
      if (document.getElementById("anamesis")) return "historia";
      // v7.8.1: exige HORA + ESTADO juntos (no solo .labelHora) — un médico puede tener
      // a la vez la agenda y una pantalla de "Asignación de citas" (que probablemente
      // también muestre horas, para reservar turnos) en pestañas distintas; con un solo
      // marcador esa pantalla podría confundirse con la lista de "Citas del día" y abrir
      // el panel donde no corresponde. Exigir el PAR completo (hora Y el chip de estado
      // "En Sala"/"Sin presentarse"/"Atendido", que una pantalla de RESERVA de turnos no
      // tendría — ahí no hay estados de asistencia, solo horarios disponibles) es mucho
      // más específico de la vista real que vigila el script.
      if (document.querySelector(CONFIG.SEL.hora) && document.querySelector(CONFIG.SEL.estado)) return "agenda";
      return "otra";
    } catch (e) { return "agenda"; }              // ante la duda, no apagar la vigilancia
  }

  // =====================================================================
  //  RECORDATORIO DE PyM AL ABRIR LA HISTORIA CLÍNICA (v7.6)
  //  Confirmado con diagnóstico real en Everest: la pestaña #anamesis SOLO existe
  //  en la vista de historia clínica (ancla barata y confiable), y la cédula vive
  //  en un .text-muted dentro del bloque de datos del paciente — el MISMO patrón
  //  de clase que Everest ya usa en "Citas del día" (reutiliza extractDoc()).
  // =====================================================================
  function extractPacienteAbierto() {
    try {
      if (!document.getElementById("anamesis")) return "";     // no estamos en historia clínica
      const contenedor = document.querySelector("app-index") || document;
      for (const el of contenedor.querySelectorAll(".text-muted")) {
        if (el.closest("#vgl-root")) continue;                 // nunca leer el propio panel
        const doc = extractDoc(limpio(el.textContent));
        if (doc) return doc;
      }
      return "";
    } catch (e) { return ""; }
  }
  // Una vez por paciente por día: se apoya en el mismo registro (avisoYaVisto/Marcar)
  // que ya usan las notificaciones — nada nuevo que mantener.
  function checkRecordatorioPym() {
    try {
      if (!S.recordatorioPym) return;
      const doc = extractPacienteAbierto(); if (!doc) return;
      const key = normalizeKey(doc); if (!key) return;
      const pend = getActivities(key); if (!pend.length) return;
      const uid = "pymrem|" + key;
      if (avisoYaVisto(uid)) return;
      avisoMarcarVisto(uid);
      const cita = (state.lastSnapshot && state.lastSnapshot.list || []).find((a) => normalizeKey(a.doc_id) === key);
      pymAlert(cita ? cita.nombre : "", pend);
    } catch (e) {}
  }

  // ---- Color / alerta ----
  // Interpreta la hora venga como venga. La pantalla de Everest la escribe
  // "7:30 a. m.", pero el API la puede mandar en 24 h ("07:30", "19:05:00") o
  // como fecha completa ("2026-08-04T07:30:00"). Antes solo se aceptaba el
  // formato de la pantalla: con cualquier otro, TODAS las citas quedaban con
  // 0 minutos transcurridos y no saltaba ni un solo fraude, en silencio.
  // Devuelve minutos desde medianoche, o null si de verdad no se entiende.
  function parseHoraMin(ts) {
    const s = String(ts == null ? "" : ts).trim();
    if (!s) return null;
    const m = /(\d{1,2}):(\d{2})(?::\d{2})?/.exec(s);
    if (!m) return null;
    let h = parseInt(m[1], 10); const mi = parseInt(m[2], 10);
    if (!(h >= 0 && h <= 23) || !(mi >= 0 && mi <= 59)) return null;
    const ap = /([AaPp])\.?\s*[Mm]/.exec(s.slice(m.index + m[0].length));
    if (ap) { h = h % 12; if (/[Pp]/.test(ap[1])) h += 12; }
    return h * 60 + mi;
  }
  // Vuelve a escribirla como la muestra Everest, para que el panel se lea igual
  // venga del API o de la pantalla.
  function horaBonita(min) {
    if (min == null) return "";
    const h24 = Math.floor(min / 60) % 24, mi = min % 60, h12 = (h24 % 12) === 0 ? 12 : (h24 % 12);
    return h12 + ":" + String(mi).padStart(2, "0") + (h24 < 12 ? " a. m." : " p. m.");
  }
  function elapsedMin(ts, now) {
    const min = parseHoraMin(ts);
    if (min == null) { if (!state.warnedTimes.has(ts)) { state.warnedTimes.add(ts); console.warn("[Vigilante] hora no interpretable:", ts); } return 0; }
    const apt = new Date(now); apt.setHours(0, min, 0, 0);
    return (now - apt) / 60000;
  }
  // La clave incluye la HORA además del documento. Con la cédula sola, un paciente con dos
  // citas el mismo día (sobrecupo) compartía estado: si faltaba a la primera, al llegar
  // puntual a la segunda se le acusaba de FRAUDE, y las dos filas se pisaban en cada
  // lectura disparando alertas y contadores en bucle.
  function apptKey(a) { return (a.doc_id ? a.doc_id : a.nombre + "|" + a.index) + "@" + (a.hora_texto || ""); }
  // Reinicio al cambiar de día: sin esto, una pestaña dejada abierta toda la noche seguía
  // con la lista de "sospechosos" de ayer y marcaba fraude a quien volviera hoy.
  let diaActual = "";
  function diaNuevo() {
    const d = todayStamp();
    if (!diaActual) { diaActual = d; return; }
    if (diaActual === d) return;
    diaActual = d;
    state.historical.clear(); state.notified.clear();
    state.fraudWatch.clear(); state.alertedFraud.clear(); state.warnedTimes.clear();
    state.summarized = false; state.lastSignature = ""; statsSig = ""; frCache.dia = "";
    try { evFlush(); } catch (e) {}
    setSummary("Nuevo día: se reinició el seguimiento.");
    // v7.8.1: si la pestaña quedó abierta toda la noche (turno que cruza medianoche), el
    // PyM que tiene cargado es el de AYER. Antes se seguía mostrando "al día"/"sin
    // pendiente" cruzado contra la base vieja hasta el siguiente tick del intervalo de
    // 10 min — una ventana en la que el cruce PyM podía leerse como de hoy sin serlo.
    // Ahora se dispara YA la búsqueda del PyM real de hoy (la líder; el resto espera).
    if (heartbeat() && typeof GM_xmlhttpRequest !== "undefined") loadPymDiario(true).catch(() => {});
  }
  function colorAndAlert(a, now) {
    const st = (a.estado || "").toLowerCase(); const key = apptKey(a); const elapsed = elapsedMin(a.hora_texto, now); const pym = getActivities(a.doc_id);
    const prev = state.historical.get(key) || "";
    const grace = CONFIG.TOLERANCIA_MIN, prealert = CONFIG.TOLERANCIA_MIN - 1.0; let color = "AZUL", sound = false, reason = "", arrival = false;
    if (st.includes("en sala")) {
      if (state.fraudWatch.has(key)) { color = "ROJO"; if (!state.alertedFraud.has(key)) { sound = true; state.alertedFraud.add(key); } }
      else { color = "VERDE"; if (prev.includes("sin presentarse")) arrival = true; } // llegada a tiempo tras estar "Sin presentarse"
    }
    else if (st.includes("atendido")) {
      // Si el paciente estaba en la lista de sospechosos (pasó la tolerancia sin
      // presentarse) y aparece ya "Atendido", eso ES una confirmación extemporánea.
      // Antes esta rama solo miraba alertedFraud, así que cuando la agenda saltaba de
      // "Sin presentarse" directo a "Atendido" —sin pasar visiblemente por "En Sala"—
      // el fraude se pintaba VERDE y no quedaba registrado en ninguna parte.
      if (state.alertedFraud.has(key)) color = "ROJO";
      else if (state.fraudWatch.has(key)) { color = "ROJO"; sound = true; state.alertedFraud.add(key); }
      else color = "VERDE";
    }
    else if (st.includes("sin presentarse")) { if (elapsed >= grace) { color = "AMBAR"; state.fraudWatch.add(key); } else if (elapsed >= prealert) { color = "MORADO"; reason = "tiempo"; } else color = "AZUL"; }
    else { if (elapsed >= prealert) { color = "MORADO"; reason = "tiempo"; } else if (pym.length >= 3) { color = "MORADO"; reason = "pym"; } else color = "AZUL"; }
    const stamp = new Date().toLocaleTimeString(), mins = Math.round(elapsed * 10) / 10;
    if (!state.leader) { state.historical.set(key, st); return { ...a, key, color, reason, arrival, sound: false, elapsed: Math.round(elapsed * 10) / 10, pym }; }
    if (sound) { logEvent({ t: stamp, ev: "FRAUDE_EXTEMPORANEO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, min: mins, nombre: a.nombre }); reportarFraude(a.hora_texto, mins); }
    else if (st !== prev && prev !== "") logEvent({ t: stamp, ev: "CAMBIO_ESTADO", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, previo: prev, min: mins, nombre: a.nombre });
    state.historical.set(key, st);
    return { ...a, key, color, reason, arrival, sound, elapsed: Math.round(elapsed * 10) / 10, pym };
  }

  let audioCtx = null;
  function beep(freq, ms, off) { try { if (!S.sonido || muted()) return; audioCtx = audioCtx || new (PAGEWIN.AudioContext || PAGEWIN.webkitAudioContext || window.AudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value = freq; o.type = "square"; const t0 = audioCtx.currentTime + off; g.gain.setValueAtTime(clampNum(S.volumen, 0.02, 0.6, 0.15), t0); o.start(t0); o.stop(t0 + ms / 1000); } catch (e) {} }
  // Silencio temporal ("Silenciar 15 min"): calla sonido/ventana/cartel, pero NUNCA deja
  // de registrar el evento ni de mostrarlo en el panel.
  function muted() { return Date.now() < state.muteUntil; }
  function muteFor(min) { state.muteUntil = Date.now() + min * 60000; stopNag(); paintMute(); setSummary("Silenciado " + min + " min. El registro sigue activo."); }
  function unmute() { state.muteUntil = 0; paintMute(); setSummary("Sonido reactivado."); }
  function fraudSound() { beep(1000, 400, 0); beep(1200, 400, 0.45); }

  // =====================================================================
  //  CANALES DE AVISO QUE **NO** DEPENDEN DE WINDOWS
  //  (para equipos donde la política de la empresa bloquea las
  //   notificaciones del sistema). Todos se apagan al "reconocer".
  // =====================================================================
  const TONE = { ROJO: [1000, 1240], MORADO: [900, 680], AMBAR: [760, 620], VERDE: [680, 1020], AZUL: [620, 820], PES: [520, 780] };
  function playTone(color) { const t = TONE[color] || TONE.AZUL; beep(t[0], 380, 0); beep(t[1], 380, 0.42); }

  // (1) SONIDO INSISTENTE: el audio suena aunque el navegador esté minimizado o
  //     estés en Word. Se repite hasta que reconozcas la alerta.
  let nagTimer = null, nagLeft = 0, nagColor = "ROJO";
  function startNag(color) { stopNag(); if (!S.insistir) { playTone(color); return; } nagColor = color; nagLeft = 40; playTone(color); nagTimer = setInterval(() => { if (nagLeft-- <= 0) { stopNag(); return; } playTone(nagColor); }, 9000); }
  function stopNag() { if (nagTimer) clearInterval(nagTimer); nagTimer = null; }

  // (2) PESTAÑA QUE PARPADEA: título + favicon. Visible en la barra de pestañas
  //     aunque estés en otra pestaña del navegador.
  let flashTimer = null, origTitle = null, origIcon = null, flashOn = false;
  function faviconUrl(color) {
    const c = COLORS[color] || COLORS.AZUL;
    return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="${c}"/></svg>`);
  }
  function setFavicon(href) {
    try {
      let l = document.querySelector("link[rel~='icon'][data-vgl]");
      if (!l) { l = document.createElement("link"); l.rel = "icon"; l.setAttribute("data-vgl", "1"); document.head.appendChild(l); }
      if (href) l.href = href; else l.remove();
    } catch (e) {}
  }
  function startFlash(text, color) {
    stopFlash();
    if (!S.parpadeo) return;
    if (origTitle === null) origTitle = document.title;
    try { const cur = document.querySelector("link[rel~='icon']:not([data-vgl])"); origIcon = cur ? cur.href : null; } catch (e) {}
    flashTimer = setInterval(() => {
      flashOn = !flashOn;
      try { document.title = flashOn ? text : (origTitle || "Everest"); } catch (e) {}
      setFavicon(flashOn ? faviconUrl(color) : (origIcon || faviconUrl("AZUL")));
    }, 900);
  }
  function stopFlash() {
    if (flashTimer) clearInterval(flashTimer); flashTimer = null;
    try { if (origTitle !== null) document.title = origTitle; } catch (e) {}
    setFavicon(null);
  }

  // (3) VENTANA EMERGENTE REAL: es una ventana del navegador, así que aparece en la
  //     BARRA DE TAREAS de Windows y parpadea — se nota aunque estés en otra app.
  //     Requiere permitir ventanas emergentes para el sitio (permiso del sitio, no del SO).
  let popupWarned = false;
  function popupAlert(color, title, body) {
    if (!S.popup || muted()) return;
    try {
      const w = window.open("", "vglAlerta", "width=470,height=290,menubar=no,toolbar=no,location=no,status=no");
      if (!w) {
        if (!popupWarned) { popupWarned = true; setSummary("Para la ventana emergente: permite «Ventanas emergentes» en el candado de la barra de direcciones.", "warn"); }
        return;
      }
      const c = COLORS[color] || COLORS.AZUL;
      w.document.open();
      w.document.write(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>
        <body style="margin:0;font-family:-apple-system,'Segoe UI',sans-serif;background:#0B1220;color:#f5f5f7;display:flex;align-items:center;justify-content:center;height:100vh">
        <div style="padding:24px;text-align:center;max-width:420px">
          <div style="width:16px;height:16px;border-radius:50%;background:${c};margin:0 auto 14px;box-shadow:0 0 16px ${c}"></div>
          <div style="font-size:17px;font-weight:700;margin-bottom:8px">${escapeHtml(title)}</div>
          <div style="font-size:14px;opacity:.85;white-space:pre-line;line-height:1.45">${escapeHtml(body)}</div>
          <button onclick="window.close()" style="margin-top:18px;background:${c};color:#001;border:0;border-radius:9px;padding:9px 20px;font-size:14px;font-weight:700;cursor:pointer">Entendido</button>
        </div></body>`);
      w.document.close();
      try { w.focus(); } catch (e) {}
    } catch (e) {}
  }

  // (4) CARTEL GRANDE dentro de Everest para el FRAUDE: imposible de ignorar
  //     cuando el navegador está a la vista.
  function bigAlert(color, title, body) {
    if (!S.cartel) return;
    try {
      let ov = document.getElementById("vgl-modal");
      if (ov) ov.remove();
      const c = COLORS[color] || COLORS.AZUL;
      ov = document.createElement("div"); ov.id = "vgl-modal";
      if (isLight()) ov.classList.add("light"); // el modal vive fuera de #vgl-root: hereda el tema a mano
      ov.innerHTML = `<div class="vgl-modal-card" style="border-color:${c}">
          <div class="vgl-modal-dot" style="background:${c};box-shadow:0 0 22px ${c}"></div>
          <div class="vgl-modal-t"></div><div class="vgl-modal-b"></div>
          <button class="vgl-modal-ok" style="background:${c}">Entendido</button>
        </div>`;
      ov.querySelector(".vgl-modal-t").textContent = title;
      ov.querySelector(".vgl-modal-b").textContent = body;
      const ok = ov.querySelector(".vgl-modal-ok");
      ok.addEventListener("click", () => { ov.remove(); acknowledge(); });
      document.body.appendChild(ov);
      // Autofoco + Enter/Esc: el bloqueo sigue siendo total (hay que reconocerlo), pero
      // se resuelve con una sola tecla sin soltar el flujo de trabajo con el teclado.
      try { ok.focus(); } catch (e2) {}
      ov.addEventListener("keydown", (e2) => { if (e2.key === "Enter" || e2.key === "Escape") { e2.preventDefault(); ok.click(); } });
    } catch (e) {}
  }

  // Reconocer: apaga sonido insistente, parpadeo y cartel.
  function acknowledge() { stopNag(); stopFlash(); const m = document.getElementById("vgl-modal"); if (m) m.remove(); }

  // v7.6: recordatorio de PyM al abrir la historia clínica de un paciente pendiente.
  // A propósito NO usa bigAlert(): no insiste con sonido, no repite, no se ve como una
  // alarma — es una ayuda puntual, se reconoce con un clic y no vuelve a salir hoy para
  // ese paciente. Copy pensado para leerse de un vistazo antes de seguir con la nota.
  function pymAlert(nombre, actividades) {
    try {
      let ov = document.getElementById("vgl-pym-modal");
      if (ov) ov.remove();
      ov = document.createElement("div"); ov.id = "vgl-pym-modal";
      if (isLight()) ov.classList.add("light");
      const chips = actividades.map((a) => `<span class="vgl-pym-chip">${escapeHtml(a)}</span>`).join("");
      ov.innerHTML = `<div class="vgl-pym-card">
          <div class="vgl-pym-ic">🩺</div>
          <div class="vgl-pym-t">Antes de cerrar esta historia</div>
          <div class="vgl-pym-n"></div>
          <div class="vgl-pym-lead">Tiene pendiente ordenar:</div>
          <div class="vgl-pym-list">${chips}</div>
          <div class="vgl-pym-foot">Este recordatorio no vuelve a salir hoy para este paciente.</div>
          <button class="vgl-pym-ok">Entendido</button>
        </div>`;
      ov.querySelector(".vgl-pym-n").textContent = nombre || "Paciente";
      const ok = ov.querySelector(".vgl-pym-ok");
      ok.addEventListener("click", () => ov.remove());
      document.body.appendChild(ov);
      try { ok.focus(); } catch (e2) {}
      ov.addEventListener("keydown", (e2) => { if (e2.key === "Enter" || e2.key === "Escape") { e2.preventDefault(); ok.click(); } });
    } catch (e) {}
  }

  // v7.8.1: ALARMA de abandono PES al abrir la historia clínica. A diferencia del
  // recordatorio de PyM (calmado, teal, sin sonido), esta SÍ suena una vez — el médico
  // pidió explícitamente "avisar" con algo que se note, porque implica reorientar la
  // atención de HOY hacia el control de riesgo cardiovascular. Sigue sin insistir
  // (un tono, no un bucle) y se reconoce con un clic; no repite hoy para este paciente.
  function abandonoPESAlert(nombre) {
    try {
      let ov = document.getElementById("vgl-pes-modal");
      if (ov) ov.remove();
      ov = document.createElement("div"); ov.id = "vgl-pes-modal";
      if (isLight()) ov.classList.add("light");
      ov.innerHTML = `<div class="vgl-pes-card">
          <div class="vgl-pes-ic">🫀</div>
          <div class="vgl-pes-t">Prioridad de hoy: riesgo cardiovascular</div>
          <div class="vgl-pes-n"></div>
          <div class="vgl-pes-lead">Este paciente tiene <b>abandono registrado</b> en el Programa de riesgo cardiovascular (PES). Priorice el control de riesgo cardiovascular en la atención de hoy.</div>
          <div class="vgl-pes-foot">Esta alarma no vuelve a salir hoy para este paciente.</div>
          <button class="vgl-pes-ok">Entendido</button>
        </div>`;
      ov.querySelector(".vgl-pes-n").textContent = nombre || "Paciente";
      const ok = ov.querySelector(".vgl-pes-ok");
      ok.addEventListener("click", () => ov.remove());
      document.body.appendChild(ov);
      try { ok.focus(); } catch (e2) {}
      ov.addEventListener("keydown", (e2) => { if (e2.key === "Enter" || e2.key === "Escape") { e2.preventDefault(); ok.click(); } });
      playTone("PES");
    } catch (e) {}
  }
  // Una vez por paciente por día, con el mismo registro de "vistos" que ya usan los
  // demás avisos — nada nuevo que mantener. Independiente del recordatorio de PyM: un
  // paciente puede tener ambas cosas (o solo una) y ambos avisos salen por separado.
  function checkAbandonoPES() {
    try {
      if (!S.abandonoPES) return;
      const doc = extractPacienteAbierto(); if (!doc) return;
      const key = normalizeKey(doc); if (!key) return;
      if (!state.pymAbandono || !state.pymAbandono.has(key)) return;
      const uid = "pes|" + key;
      if (avisoYaVisto(uid)) return;
      avisoMarcarVisto(uid);
      const cita = (state.lastSnapshot && state.lastSnapshot.list || []).find((a) => normalizeKey(a.doc_id) === key);
      abandonoPESAlert(cita ? cita.nombre : "");
    } catch (e) {}
  }

  // ---- NOTIFICACIONES POR COLORES (recuperado de la v2.5): toast en Windows + respaldo en la página ----
  function colorDot(color) {
    const c = COLORS[color] || COLORS.AZUL;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="${c}"/></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  // Anti-duplicado entre pestañas: si otra pestaña de Everest ya lanzó este aviso hace <12s, no repetir.
  function crossTabDup(id) { try { const k = "vgl_n_" + id, now = Date.now(), prev = +(localStorage.getItem(k) || 0); if (now - prev < 12000) return true; localStorage.setItem(k, String(now)); return false; } catch (e) { return false; } }
  // REGISTRO PERSISTENTE POR IDENTIFICADOR (v7.3.5): cada aviso lleva un id y queda
  // anotado en el navegador. Un aviso ya mostrado NO se repite: ni al recargar la
  // página, ni al cambiar de pestaña, ni al reabrir Everest. Se limpia solo cada día.
  const SEEN_KEY = "vgl_vistos";
  function avisoYaVisto(uid) {
    if (!uid) return false;
    try {
      const o = readJSON(SEEN_KEY, {}) || {};
      if (o._dia !== todayStamp()) return false;        // registro de otro día: no aplica
      return !!o[uid];
    } catch (e) { return false; }
  }
  function avisoMarcarVisto(uid) {
    if (!uid) return;
    try {
      let o = readJSON(SEEN_KEY, {}) || {};
      if (o._dia !== todayStamp()) o = { _dia: todayStamp() };   // día nuevo: registro nuevo
      o[uid] = Date.now();
      writeJSON(SEEN_KEY, o);
    } catch (e) {}
  }
  function osNotify(color, title, body, persist, uid) {
    if (avisoYaVisto(uid)) return;                       // ya se mostró hoy: NUNCA repetir
    if (typeof Notification === "undefined" || Notification.permission !== "granted") { avisoMarcarVisto(uid); showToast(color, title, body, persist); return; }
    if (crossTabDup("os|" + (uid || title))) return;
    avisoMarcarVisto(uid);
    let done = false; const fb = () => { if (done) return; done = true; showToast(color, title, body, persist); };
    try {
      // requireInteraction SOLO para el fraude (persist): lo demás se cierra solo. Las
      // notificaciones persistentes que nadie cierra quedan vivas en el Centro de
      // actividades de Windows y REAPARECEN horas después — el famoso aviso fantasma.
      const n = new Notification(title, { body, icon: colorDot(color), badge: colorDot(color), requireInteraction: !!persist, tag: "vgl-" + (uid || title) });
      try { n.onshow = () => { done = true; }; n.onerror = fb; n.onclick = () => { try { window.focus(); } catch (e2) {} try { n.close(); } catch (e2) {} }; } catch (e) {}
      // Cierre automático: 20 s los avisos normales, 3 min el fraude (el sonido insistente
      // sigue por su lado hasta reconocer). Así nada queda pegado en el Centro de actividades.
      setTimeout(() => { try { n.close(); } catch (e2) {} }, persist ? 180000 : 20000);
      // Si Windows suprime el aviso (No molestar / política), 'show' no se dispara:
      // a los 1.6 s se ESCALA al aviso dentro del navegador. Un canal a la vez.
      setTimeout(fb, 1600);
    } catch (e) { fb(); }
  }
  // v7.5: cola de avisos con PRIORIDAD real. Antes se apilaban por orden de llegada,
  // máx. 4 visibles, ninguno se cerraba solo — un aviso MORADO ("última llamada", ~1 min
  // de margen) podía quedar tapado detrás de avisos rutinarios viejos sin cerrar. Ahora:
  // ROJO/MORADO van al FRENTE y nunca se autodescartan; AZUL/VERDE/AMBAR van al final y
  // se cierran solos a los 9 s. Al recortar por exceso, se quita primero el más viejo
  // que NO sea crítico (un crítico solo se quita si ya no hay ningún otro que sacar).
  function showToast(color, title, body, persist) {
    try {
      const wrap = document.getElementById("vgl-toasts"); if (!wrap) return;
      const col = COLORS[color] || COLORS.AZUL, tint = TINT[color] || TINT.AZUL;
      const icon = { ROJO: "⛔", MORADO: "⏳", AMBAR: "⚠", VERDE: "✅", AZUL: "🛡️" }[color] || "🛡️";
      const t = document.createElement("div"); t.className = "vgl-toast";
      t.innerHTML = `<div class="vgl-toast-ic" style="background:${tint};color:${col}"></div><div class="vgl-toast-main"><div class="vgl-toast-title"></div><div class="vgl-toast-b"></div></div><span class="vgl-toast-x">×</span>`;
      t.querySelector(".vgl-toast-ic").textContent = icon;
      t.querySelector(".vgl-toast-title").textContent = title;
      t.querySelector(".vgl-toast-b").textContent = body;
      const cerrar = () => { t.classList.add("out"); setTimeout(() => { try { t.remove(); } catch (e2) {} }, 260); };
      t.addEventListener("click", cerrar);
      const critico = color === "ROJO" || color === "MORADO";
      t.__vglCritico = critico;
      if (critico) wrap.prepend(t); else { wrap.appendChild(t); setTimeout(cerrar, 9000); }
      const vivos = () => [...wrap.children].filter((n) => !n.classList.contains("out"));
      while (vivos().length > 4) {
        const lista = vivos();
        const quitar = [...lista].reverse().find((n) => !n.__vglCritico) || lista[lista.length - 1];
        if (!quitar) break;
        quitar.remove();
      }
    } catch (e) {}
  }
  // Solo Windows. El toast dentro de la página queda como RESPALDO únicamente si Windows
  // no está disponible (permiso no concedido/denegado), para no perder un aviso de fraude.
  function notify(color, title, body, persist, uid) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") { osNotify(color, title, body, persist, uid); }
    else { showToast(color, title, body, persist); }
  }
  // persist SOLO en el fraude: es el único aviso que debe exigir interacción. El resto
  // se cierra solo (los persistentes sin cerrar quedan en el Centro de actividades de
  // Windows y REAPARECEN horas después como fantasmas).
  const NOTIFY = {
    ROJO: { icon: "⛔", label: "Confirmación extemporánea (FRAUDE)", sound: true, persist: true },
    MORADO: { icon: "⏳", label: "Última llamada: ~1 min para confirmar o pierde la cita", persist: false },
    AMBAR: { icon: "⚠", label: "Inasistencia registrada", persist: false },
    VERDE: { icon: "✅", label: "Confirmado a tiempo (pasó a En Sala)", persist: false },
  };
  // Clave de notificación: el MORADO se distingue por motivo (tiempo vs 3+ PyM) para no confundirlos.
  function nkey(a) { return a.color === "MORADO" ? "MORADO:" + (a.reason || "") : a.color; }
  function maybeNotify(a) {
    const k = nkey(a); const prev = state.notified.get(a.key); if (prev === k) return; state.notified.set(a.key, k);
    // PRIMERA VEZ que se ve esta cita: se siembra en silencio. Los avisos son SOLO por
    // cambios vistos EN DIRECTO. Sin esto, al arrancar tarde o al cambiar la fuente de
    // lectura (página <-> API cambia la identidad de las citas) se venían encima todos
    // los avisos viejos de una sola vez.
    if (prev === undefined) return;
    if (a.color === "MORADO" && a.reason !== "tiempo") return; // el morado por "3+ PyM" no es urgente: no se notifica
    if (a.color === "VERDE" && !a.arrival) return; // solo la transición "Sin presentarse" -> "En Sala" (llegada a tiempo)
    const cfg = NOTIFY[a.color]; if (!cfg) return;
    // Contador del día (queda guardado por fecha para el reporte y la tendencia semanal).
    bumpStat(a.color === "ROJO" ? "fraude" : a.color === "AMBAR" ? "inasistencia" : a.color === "VERDE" ? "atiempo" : "ultima");
    // Bitácora completa para el reporte (el ROJO ya quedó registrado al detectarlo).
    if (a.color !== "ROJO") logEvent({ t: new Date().toLocaleTimeString(), ev: a.color === "AMBAR" ? "INASISTENCIA" : a.color === "VERDE" ? "INGRESO_A_TIEMPO" : "ULTIMA_LLAMADA", hora: a.hora_texto, doc: a.doc_id, estado: a.estado, min: a.elapsed, nombre: a.nombre });
    const title = `${cfg.icon} ${a.hora_texto} · ${a.estado}`;
    const body = `${a.nombre}${a.doc_id ? " (" + a.doc_id + ")" : ""}\n${cfg.label}`;
    notify(a.color, title, body, cfg.persist, a.key + "|" + a.color);
    // Canales que no dependen de Windows (siempre activos):
    if (a.color === "ROJO") { startNag("ROJO"); bigAlert("ROJO", title, body); }   // fraude: insiste hasta reconocer
    else playTone(a.color);                                                        // resto: un tono propio por color
    startFlash(`${cfg.icon} ${a.estado} · ${a.hora_texto}`, a.color);              // pestaña parpadeando
    popupAlert(a.color, title, body);                                              // ventana en la barra de tareas (si está activada)
  }
  function updateBell() {
    const b = document.getElementById("vgl-bell"); if (!b) return;
    const perm = (typeof Notification !== "undefined") ? Notification.permission : "unsupported";
    b.classList.toggle("on", perm === "granted");
    b.classList.toggle("off", perm === "denied");
    b.textContent = perm === "granted" ? "Alertas ✓" : perm === "denied" ? "Alertas ✕" : "Alertas";
    b.title = perm === "granted" ? "Notificaciones de Windows activas" : perm === "denied" ? "BLOQUEADAS: candado de la barra de direcciones → Notificaciones → Permitir" : "Activar notificaciones de Windows";
  }
  // Prueba manual: dispara una de cada color para verificar que Windows las muestra.
  function testNotifications() {
    if (typeof Notification === "undefined") { setSummary("Este navegador no soporta notificaciones de escritorio.", "error"); return; }
    if (Notification.permission === "denied") {
      setSummary("Notificaciones BLOQUEADAS: clic en el candado de la barra de direcciones → Notificaciones → Permitir, y recarga.", "error");
      showToast("ROJO", "⛔ Prueba (solo navegador)", "Windows está bloqueado para este sitio. Actívalo en el candado de la barra de direcciones.", true);
      return;
    }
    if (Notification.permission !== "granted") { setSummary("Pulsa «Permitir» en el aviso del navegador…"); enableOsNotifications(); return; }
    // UN SOLO CANAL A LA VEZ: la prueba usa la misma cascada que las alertas reales
    // (Windows y, solo si Windows no la muestra, el aviso dentro del navegador).
    // NO es persistente: se cierra sola a los 20 s y no deja fantasmas en Windows.
    const t = new Date().toLocaleTimeString();
    osNotify("ROJO", "⛔ Prueba " + t + " · En Sala", "PACIENTE DE PRUEBA\nConfirmación extemporánea (FRAUDE)\n(Este aviso se cierra solo)", false, "prueba|" + Date.now());
    playTone("ROJO");
    // Los canales extra solo se ejercitan si están activados en Ajustes (se gatean solos).
    bigAlert("ROJO", "⛔ PRUEBA · cartel", "Este cartel salió porque está activado en Ajustes.");
    startFlash("⛔ PRUEBA de alerta", "ROJO");
    popupAlert("ROJO", "⛔ PRUEBA", "Esta ventana salió porque está activada en Ajustes.");
    setSummary("Prueba enviada. Debe verse UNA notificación de Windows (+ sonido). Se cierra sola: no queda pegada en el Centro de actividades.");
  }
  function enableOsNotifications() {
    try {
      if (typeof Notification === "undefined") { setSummary("Este navegador no soporta notificaciones de escritorio.", "warn"); return; }
      Notification.requestPermission().then((p) => {
        state.osNotif = (p === "granted");
        if (p === "granted") notify("AZUL", "🔔 Avisos activados", "Recibirás fraude e inasistencia como notificación de Windows, aunque estés en otra ventana.", false);
        else setSummary("Permiso denegado: los avisos saldrán dentro del navegador.", "warn");
        updateBell();
      });
    } catch (e) {}
  }


  // =====================================================================
  //  LECTURA DIRECTA DEL API (v7.0) — el camino más eficiente posible.
  //  Everest pide su agenda con:
  //     GET /apiviva/APIMedicoHealth/api/Medico/ObtenerConsultas?especialidadId=..&profesionalId=..
  //  autenticado SOLO con las cookies de sesión (no hay token). Como el script
  //  corre en la misma página, puede repetir esa llamada tal cual: sin clon,
  //  sin recargar nada, unos pocos kB por consulta.
  //  La URL NO se configura: se aprende observando la llamada que la propia
  //  aplicación hace al abrir la agenda o al pulsar "Consultar".
  //  Si algo no encaja (campos irreconocibles, respuesta vacía, error de red),
  //  se vuelve solo al método de siempre. Nunca se queda sin vigilar.
  // =====================================================================
  const API = { url: "", visto: 0, campos: null, fallos: 0, ok: 0, ultimo: 0, enVuelo: false, ms: 0, noF0: false };
  const API_RE = /\/ObtenerConsultas\?/i;
  // Vocabulario de estados que el script sabe interpretar. Si lo que llega no se
  // parece a esto, el API se descarta y se sigue por el camino de siempre.
  const EST_RE = /en sala|sin presentar|atendid|pendiente|confirmad|cancelad|agendad|asignad|no asisti|inasist|reprogram|programad|espera|admitid|admision|llamad|triage|ausente/i;
  try { API.url = localStorage.getItem("vgl_api_url") || ""; } catch (e) {}
  function apiRecordar(url) {
    try {
      if (!url || !API_RE.test(url)) return;
      const abs = url.indexOf("http") === 0 ? url : (location.origin + (url[0] === "/" ? "" : "/") + url);
      if (abs === API.url) { API.visto = Date.now(); return; }
      API.url = abs; API.visto = Date.now(); API.fallos = 0;
      localStorage.setItem("vgl_api_url", abs);
      console.log("[Vigilante] llamada de agenda aprendida");
    } catch (e) {}
  }
  // Segunda vía para aprender la llamada, SIN interceptar nada: el navegador ya
  // guarda todas las peticiones de la pestaña en su registro de rendimiento. Sirve
  // aunque la aplicación hiciera la llamada antes de instalarse el script y aunque
  // Angular vuelva a envolver XMLHttpRequest por encima del nuestro (que es
  // justamente lo que hacía que la captura se quedara en blanco).
  function apiSniffPerf(win) {
    try {
      const p = (win || window).performance;
      const ent = p && p.getEntriesByType ? p.getEntriesByType("resource") : null;
      if (!ent) return;
      for (let i = ent.length - 1; i >= 0; i--) if (API_RE.test(ent[i].name)) { apiRecordar(ent[i].name); return; }
    } catch (e) {}
  }
  // Mejor todavía: un observador. Avisa en cuanto la aplicación hace la llamada, sin
  // repasar la lista una y otra vez, y sin que importe que el registro se llene y
  // descarte las peticiones viejas (Everest hace cientos al arrancar). Con
  // buffered:true también repasa las que ya hubiera antes de instalarse.
  function apiObservar(win) {
    try {
      const w = win || window;
      if (!w.PerformanceObserver || w.__vglPO) return;
      const po = new w.PerformanceObserver((l) => { const es = l.getEntries(); for (let i = 0; i < es.length; i++) if (API_RE.test(es[i].name)) apiRecordar(es[i].name); });
      po.observe({ type: "resource", buffered: true });
      w.__vglPO = po;
    } catch (e) {}
  }
  // El arreglo de citas, aunque venga envuelto ({ data: [...] }, { Consultas: [...] }).
  function apiLista(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return null;
    for (const k in data) { const v = data[k]; if (Array.isArray(v) && (!v.length || typeof v[0] === "object")) return v; }
    return null;
  }
  // Detecta qué campo es qué mirando los VALORES, no solo el nombre: un nombre de
  // campo puede ser cualquier cosa, pero una hora parece una hora y un estado se
  // repite en muchas filas. Así aguanta que Everest renombre sus campos.
  function apiCampos(lista) {
    const fila = lista.find((x) => x && typeof x === "object");
    if (!fila) return null;
    const claves = Object.keys(fila), muestra = lista.slice(0, 60);
    const vals = (k) => muestra.map((o) => (o ? o[k] : undefined));
    // HORA: la columna que más filas convierte en hora válida. Se penalizan las de
    // "fin", "creación" o "nacimiento", que también parecen horas y no lo son.
    let hora = null, mejorH = 0;
    for (const k of claves) {
      const v = vals(k); let ok = 0;
      for (const x of v) if ((typeof x === "string" || typeof x === "number") && parseHoraMin(x) != null) ok++;
      if (!ok) continue;
      let sc = ok / v.length;
      if (/hora|hour|time/i.test(k)) sc += 0.5;
      if (/inicio|cita|program|asignad|atencion/i.test(k)) sc += 0.3;
      if (/fin|final|termin|salida|creaci|registro|nacim|modific/i.test(k)) sc -= 1;
      if (sc > mejorH) { mejorH = sc; hora = k; }
    }
    // ESTADO: columna de texto con POCOS valores distintos y que se parecen a los
    // estados conocidos. Un nombre de paciente nunca pasa este filtro.
    let estado = null, mejorE = 0;
    for (const k of claves) {
      const v = vals(k).filter((x) => typeof x === "string" && x.trim());
      if (v.length < muestra.length * 0.5) continue;
      const dist = new Set(v.map((x) => x.trim().toLowerCase()));
      if (dist.size > 12) continue;
      let hit = 0; for (const d of dist) if (EST_RE.test(d)) hit++;
      if (!hit) continue;
      let sc = hit / dist.size;
      if (/estado|status|situacion/i.test(k)) sc += 0.5;
      if (sc > mejorE) { mejorE = sc; estado = k; }
    }
    const buscar = (re) => claves.find((k) => re.test(k));
    const doc = buscar(/(nro|num)\w*(doc|ident)|documento|identificacion|cedula/i) || buscar(/^doc|ident/i);
    // Ojo: excluir al médico y a la especialidad, o el panel mostraría el nombre
    // del profesional en todas las tarjetas en vez del paciente.
    const nombres = claves.filter((k) => /nombre|apellido|paciente/i.test(k) && !/medico|profesional|especial|usuario|sede|eps|entidad|empresa|convenio/i.test(k) && typeof fila[k] === "string");
    if (!hora || !estado || mejorH < 0.5) return null;
    return { hora, estado, doc, nombres };
  }
  // Devuelve: arreglo de citas · [] si la agenda está vacía (dato válido) · null si
  // la respuesta no se entiende (eso sí es un fallo).
  function apiParse(lista) {
    if (!Array.isArray(lista)) return null;
    if (!lista.length) return [];
    const c = API.campos || apiCampos(lista);
    if (!c) return null;
    const citas = []; let buenas = 0;
    for (let i = 0; i < lista.length; i++) {
      const r = lista[i] || {}, min = parseHoraMin(r[c.hora]);
      if (min != null) buenas++;
      citas.push({
        hora_texto: min != null ? horaBonita(min) : limpio(String(r[c.hora] == null ? "" : r[c.hora])),
        doc_id: extractDoc(String(c.doc ? (r[c.doc] == null ? "" : r[c.doc]) : "")),
        nombre: limpio(c.nombres.map((k) => r[k]).filter(Boolean).join(" ")) || "Paciente Everest",
        modalidad: "", estado: limpio(String(r[c.estado] == null ? "" : r[c.estado])) || "Pendiente", index: i,
      });
    }
    // GUARDAS. Si algo no cuadra NO se usa el API: más vale seguir por el camino
    // lento que colorear mal y dejar pasar un fraude.
    if (buenas < citas.length * 0.6) return null;                 // horas ilegibles
    if (!citas.some((a) => EST_RE.test(a.estado))) return null;   // estados desconocidos
    API.campos = c;
    return citas;
  }
  // Tope de tamaño. Una agenda del día son unos 15 kB; 8 MB es 500 veces más. Si
  // llega algo mucho mayor (un error del servidor que devuelve media base de datos,
  // o una redirección rara), no se lee entero: solo digerir 30 MB de texto congela
  // el hilo principal casi un cuarto de segundo, y eso el médico lo NOTA.
  const API_MAX = 8 * 1024 * 1024;
  async function leerConTope(r, max) {
    const cl = +(r.headers.get("content-length") || 0);
    if (cl > max) { try { if (r.body && r.body.cancel) r.body.cancel(); } catch (e) {} throw new Error("respuesta demasiado grande (" + Math.round(cl / 1048576) + " MB)"); }
    if (cl || !r.body || !r.body.getReader) return r.text();   // tamaño conocido y razonable
    // Sin content-length (troceada): se lee vigilando cuánto lleva.
    const rd = r.body.getReader(), tr = []; let n = 0;
    try {
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        n += value.length;
        if (n > max) { try { rd.cancel(); } catch (e) {} throw new Error("respuesta demasiado grande"); }
        tr.push(value);
      }
    } finally { try { rd.releaseLock(); } catch (e) {} }
    const out = new Uint8Array(n); let q = 0;
    for (const t of tr) { out.set(t, q); q += t.length; }
    return new TextDecoder("utf-8").decode(out);
  }
  async function apiLeerAgenda() {
    if (!API.url || API.enVuelo) return null;
    API.enVuelo = true;
    const t0 = Date.now();
    const ctl = (typeof AbortController === "function") ? new AbortController() : null;
    // Corte por tiempo: sin esto, una consulta colgada dejaba peticiones
    // amontonándose una encima de otra y ahogaba la pestaña.
    const corte = setTimeout(() => { try { if (ctl) ctl.abort(); } catch (e) {} }, 9000);
    try {
      const opt = { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" };
      if (ctl) opt.signal = ctl.signal;
      let r = null;
      if (FETCH0 && !API.noF0) {
        try { r = await FETCH0(API.url, opt); }
        catch (e) { if (/illegal invocation/i.test((e && e.message) || "")) API.noF0 = true; else throw e; }
      }
      if (!r) r = await fetch(API.url, opt);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const txt = (await leerConTope(r, API_MAX) || "").trim();
      API.ms = Date.now() - t0;
      if (!txt) { API.fallos = 0; return []; }        // cuerpo vacío: agenda vacía, no es un fallo
      const citas = apiParse(apiLista(JSON.parse(txt)));
      if (citas === null) { API.fallos++; if (API.fallos === 3) telError("api", "respuesta no reconocida"); return null; }
      API.fallos = 0; API.ok++;
      return citas;
    } catch (e) {
      API.fallos++;
      if (API.fallos === 3) telError("api", (e && e.message) || String(e));
      return null;
    } finally { clearTimeout(corte); API.enVuelo = false; }
  }
  // ¿Se puede intentar el API? Tras 5 fallos seguidos se deja descansar, pero se
  // reintenta cada 5 min: una caída pasajera (reinicio del servidor, corte de la VPN)
  // no debe dejar el camino directo muerto hasta que alguien recargue la página.
  const apiUtil = () => !!API.url && (API.fallos < 5 || Date.now() - (API.ultimo || 0) > 300000);
  // ¿Se puede CONFIAR en él para pintar la agenda? Basta con que empiece a fallar para
  // que deje de ser la fuente: más vale volver al clon que enseñar estados de hace rato.
  const apiSano = () => API.ok > 0 && API.fallos < 2;
  // Espera entre consultas. Si el API está fallando NO se va más lento: se va a un
  // ritmo fijo y contenido (10–30 s) para agotar los 5 intentos en un par de minutos.
  // Con un frenado creciente clásico, rendirse costaba un cuarto de hora.
  const apiEspera = (base) => (API.fallos >= 5 ? 300000 : API.fallos ? Math.min(30000, 5000 * (1 + API.fallos)) : Math.max(4000, base));

  // ---- Sondeo del API en MODO LIGERO (v7.3.1) ----
  // Ritmo adaptativo, calcado del que usaba el clon pero sin clon: rápido SOLO
  // cuando una cita está cerca de la tolerancia (que es cuando puede colarse un
  // fraude), y muy tranquilo el resto del día. Cada consulta son unos pocos kB.
  function apiCadencia() {
    const lst = (state.lastSnapshot && state.lastSnapshot.list) || [];
    let cerca = Infinity, pendientes = 0;
    for (const a of lst) {
      const s = (a.estado || "").toLowerCase();
      if (s.includes("atendido") || s.includes("en sala")) continue;  // ya resuelta
      pendientes++;
      const resta = CONFIG.TOLERANCIA_MIN - (a.elapsed || 0);
      if (resta < -25) continue;                                      // muy pasada: ya no cambiará
      cerca = Math.min(cerca, Math.abs(resta));
    }
    if (!pendientes) return 60000;    // nada pendiente: 1 vez por minuto (ver llegar al primero)
    if (cerca <= 2.5) return 6000;    // ventana crítica de la tolerancia
    if (cerca <= 10) return 18000;
    return 45000;
  }
  function tickApi() {
    if (!apiUtil()) return;
    const cada = apiEspera(apiCadencia());
    if (API.enVuelo || Date.now() - (API.ultimo || 0) < cada) return;
    API.ultimo = Date.now();
    apiLeerAgenda().then((citas) => { if (citas) { state.apiCitas = citas; state.apiEn = Date.now(); } });
  }


  // ---- Overlay ----
  let el = {};
  let winState = "full";
  // Controles de ventana estilo macOS: full / min (solo barra) / dock (pastilla flotante).
  // v7.8.1: "auto" distingue un cambio de ventana DECIDIDO POR EL MÉDICO (clic en ×/−/+,
  // doble clic, restaurar al abrir la página) de uno hecho por el propio script al entrar
  // o salir de una sección permitida. Solo el primero se GUARDA (persiste entre recargas);
  // el segundo es puramente visual y nunca pisa la preferencia real del médico.
  function setWinState(s, auto) {
    winState = s; if (!el.root) return;
    el.root.classList.toggle("min", s === "min");
    el.root.style.display = (s === "dock") ? "none" : "flex";
    if (el.dock) el.dock.style.display = (s === "dock") ? "flex" : "none";
    if (!auto) { state.userWinState = s; savePos(); }
  }
  function buildOverlay() {
    const style = document.createElement("style");
    style.textContent = `
      /* ---- Tema: todo el panel usa variables, así el modo claro es un solo interruptor ---- */
      #vgl-root,#vgl-dock,#vgl-toasts,#vgl-modal,#vgl-pym-modal,#vgl-pes-modal{
        /* v7.4: --bg sube de .72 a .90 de opacidad. Auditoría de contraste: como Everest
           SIEMPRE tiene fondo claro detrás, un panel oscuro al 72% se ve en pantalla como
           gris medio (no casi-negro), y eso arrastraba a varios textos por debajo de 4.5:1
           WCAG. Con .90 el fondo real se acerca al nominal y el efecto "vidrio" se conserva. */
        --bg:rgba(28,28,30,.90);--bg2:rgba(255,255,255,.05);--bg3:rgba(255,255,255,.08);--bg4:rgba(255,255,255,.15);
        /* v7.5: tokens de los 5 colores de alerta y de los 3 radios de superficie —
           antes cada uno se repetía como literal en 8-11 sitios distintos; un cambio
           de tono había que buscarlo a mano por toda la hoja. */
        --c-rojo:#ff453a;--c-morado:#bf5af2;--c-ambar:#ff9f0a;--c-verde:#30d158;--c-azul:#0a84ff;--c-recordatorio:#20c9b5;
        /* v7.8.1: abandono en el Programa de riesgo cardiovascular (PES) — color PROPIO,
           distinto del rojo de fraude, para no confundir dos alertas de naturaleza
           distinta. #c2255c con texto blanco: 5.7:1 de contraste, pasa WCAG AA. */
        --c-pes:#c2255c;
        --r-chip:8px;--r-card:14px;--r-surface:18px;
        /* --fg3 pasa de blanco con alpha a un gris OPACO fijo: el alpha heredaba el mismo
           problema de "se compone con lo que hay detrás" que --bg (ver arriba). */
        --fg:#ffffff;--fg2:rgba(245,245,247,.86);--fg3:#c7c7cc;--line:rgba(255,255,255,.07);
        --edge:rgba(255,255,255,.12);--toast:rgba(40,40,44,.94);--shadow:0 24px 70px rgba(0,0,0,.55),0 2px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08)}
      #vgl-root.light,#vgl-dock.light,#vgl-toasts.light,#vgl-modal.light,#vgl-pym-modal.light,#vgl-pes-modal.light{
        --bg:rgba(248,248,250,.86);--bg2:rgba(0,0,0,.04);--bg3:rgba(0,0,0,.06);--bg4:rgba(0,0,0,.11);
        --fg:#111112;--fg2:rgba(29,29,31,.82);--fg3:#5b5b5e;--line:rgba(0,0,0,.08);
        --edge:rgba(0,0,0,.10);--toast:rgba(252,252,254,.96);--shadow:0 24px 70px rgba(0,0,0,.22),0 2px 10px rgba(0,0,0,.10),inset 0 1px 0 rgba(255,255,255,.7)}

      #vgl-root{position:fixed;bottom:22px;right:22px;width:470px;max-width:calc(100vw - 44px);max-height:80vh;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--r-surface);
        background:var(--bg);-webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);
        border:1px solid var(--edge);box-shadow:var(--shadow);
        color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-size:13px}
      /* v7.4: el blur bajó de 30px a 14px (a partir de ~14px el ojo casi no distingue más
         desenfoque, pero el costo de GPU en equipos viejos sigue subiendo con el radio) —
         va directo a la razón de ser de esta versión: equipos lentos. */
      @media (max-width:560px){ #vgl-root{width:calc(100vw - 24px);right:12px;bottom:12px} }
      /* v7.5: sin blur durante el arrastre (perf) Y con "Modo rendimiento" activo (perf).
         Mismo fondo sólido en los dos casos: var(--bg) ya viene bastante opaco (.90/.86). */
      #vgl-root.vgl-dragging,#vgl-root.perf{backdrop-filter:none;-webkit-backdrop-filter:none}
      #vgl-dock.perf{backdrop-filter:none;-webkit-backdrop-filter:none}
      #vgl-root *{box-sizing:border-box}
      /* Foco de teclado: ANTES solo #vgl-q lo tenía en toda la hoja. Silenciar/Ajustes
         cambian el comportamiento de detección de fraude — no deben poder activarse "a
         ciegas" navegando con Tab. Una sola regla, reutiliza el azul ya existente. */
      .vgl-btn:focus-visible,.vgl-fchip:focus-visible,.vgl-tl:focus-visible{outline:2px solid var(--c-azul);outline-offset:2px}
      .vgl-sw:focus-within i{outline:2px solid var(--c-azul);outline-offset:2px}
      /* BLINDAJE: Everest tiene estilos globales (b, mark, small…) que se cuelan al panel
         y pintaban los nombres de azul sobre fondo oscuro. Aquí se neutralizan. */
      #vgl-root b,#vgl-root i,#vgl-root small,#vgl-root mark,#vgl-root span,#vgl-root label{color:inherit}
      #vgl-toasts b,#vgl-toasts span{color:inherit}
      #vgl-head{height:42px;display:flex;align-items:center;gap:10px;padding:0 14px;cursor:move;user-select:none;border-bottom:1px solid var(--line);background:linear-gradient(rgba(255,255,255,.05),rgba(255,255,255,0));flex:0 0 auto}
      #vgl-tls{display:flex;align-items:center;gap:8px}
      .vgl-tl{width:13px;height:13px;border-radius:50%;cursor:pointer;border:0;padding:0;transition:filter .15s;font-size:10px;line-height:13px;text-align:center;color:transparent;font-weight:700;font-family:-apple-system,'Segoe UI',sans-serif}
      #vgl-tls:hover .vgl-tl{color:rgba(0,0,0,.55)}
      .vgl-tl:hover{filter:brightness(1.12)}
      .vgl-tl.close{background:#ff5f57}.vgl-tl.min{background:#febc2e}.vgl-tl.zoom{background:#28c840}
      /* Área de clic ampliada SIN cambiar el tamaño visual del punto (13px sigue viéndose
         igual; el padding+background-clip da ~25x25px de zona pulsable, más cerca del
         mínimo táctil recomendado). #vgl-tls define el gap para que no queden pegados. */
      .vgl-tl{padding:6px;background-clip:content-box;box-sizing:content-box}
      #vgl-tls{gap:8px}
      #vgl-title{flex:1;text-align:center;font-weight:600;font-size:13px;letter-spacing:.2px;color:var(--fg);opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #vgl-title small{opacity:.5;font-weight:500;margin-left:5px;font-size:11px}
      #vgl-dot{width:8px;height:8px;border-radius:50%;background:#8e8e93;flex:0 0 auto;transition:background .3s,box-shadow .3s}
      #vgl-dot.bg{background:var(--c-verde);box-shadow:0 0 8px rgba(48,209,88,.85)}
      #vgl-dot.page{background:var(--c-azul);box-shadow:0 0 8px rgba(10,132,255,.75)}
      #vgl-dot.stale{background:var(--c-ambar);box-shadow:0 0 8px rgba(255,159,10,.75)}
      #vgl-tools{display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap;flex:0 0 auto}
      .vgl-btn{appearance:none;border:0;border-radius:9px;padding:6px 11px;font-size:12px;font-weight:500;cursor:pointer;color:var(--fg);background:var(--bg3);transition:background .15s,transform .1s;font-family:inherit;white-space:nowrap}
      .vgl-btn:hover{background:var(--bg4)}
      .vgl-btn:active{transform:scale(.96)}
      .vgl-btn.primary{background:var(--c-azul);color:#fff;font-weight:600;box-shadow:0 2px 8px rgba(10,132,255,.4)}
      .vgl-btn.primary:hover{background:#3a9bff}
      /* v7.4: valores de contraste recalculados (WCAG AA) — los anteriores fallaban 4.5:1
         sobre todo en tema claro (.on ≈2.83:1, .off ≈3.70:1). */
      .vgl-btn.on{background:rgba(48,209,88,.22);color:#0f6b2c;font-weight:600}
      #vgl-root:not(.light) .vgl-btn.on{color:var(--c-verde)}
      .vgl-btn.off{background:rgba(255,69,58,.30);color:#a3160f;font-weight:600}
      #vgl-root:not(.light) .vgl-btn.off{color:var(--c-rojo)}
      .vgl-btn.icon{padding:6px 9px}
      /* ---- Buscador + filtros rápidos ---- */
      #vgl-find{display:flex;align-items:center;gap:6px;padding:0 12px 9px;flex-wrap:wrap;border-bottom:1px solid var(--line);flex:0 0 auto}
      #vgl-q{flex:1 1 100%;min-width:140px;margin-bottom:2px;appearance:none;border:1px solid var(--edge);background:var(--bg2);color:var(--fg);border-radius:9px;padding:6px 10px;font-size:12px;font-family:inherit;outline:none}
      #vgl-q:focus{border-color:var(--c-azul);box-shadow:0 0 0 3px rgba(10,132,255,.22)}
      #vgl-q::placeholder{color:var(--fg3)}
      .vgl-fchip{cursor:pointer;font-size:11px;font-weight:600;padding:4px 9px;border-radius:var(--r-chip);background:var(--bg3);color:var(--fg);border:1px solid transparent;white-space:nowrap;font-family:inherit}
      .vgl-fchip:hover{background:var(--bg3)}
      .vgl-fchip.sel{background:rgba(10,132,255,.18);color:var(--c-azul);border-color:rgba(10,132,255,.35)}
      #vgl-sum{font-size:12px;color:var(--fg);padding:8px 14px;border-bottom:1px solid var(--line);font-weight:500;letter-spacing:.1px;flex:0 0 auto}
      #vgl-sum.warn{color:#c98a00}#vgl-sum.error{color:#d1322a}
      #vgl-root:not(.light) #vgl-sum.warn{color:#ffd60a}
      #vgl-root:not(.light) #vgl-sum.error{color:#ff6961}
      #vgl-stats{display:flex;gap:6px;padding:0 12px 9px;flex-wrap:wrap;border-bottom:1px solid var(--line);flex:0 0 auto}
      #vgl-stats:empty{display:none}
      .vgl-stat{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:500;color:var(--fg2);background:var(--bg2);padding:3px 9px;border-radius:var(--r-chip)}
      .vgl-stat b{font-weight:700;color:var(--fg);font-variant-numeric:tabular-nums}
      .vgl-stat .vgl-d{width:7px;height:7px;border-radius:50%;flex:0 0 auto}
      .vgl-stat.hot{background:rgba(255,69,58,.24);color:var(--c-rojo);order:-1;font-size:12px;padding:4px 10px;font-weight:800}
      .vgl-stat.hot b{color:var(--c-rojo)}
      #vgl-root.light .vgl-stat.hot{color:#a3160f}
      #vgl-root.light .vgl-stat.hot b{color:#a3160f}
      @keyframes vglPulse{0%,100%{box-shadow:0 0 8px rgba(48,209,88,.85),0 0 0 0 rgba(48,209,88,.45)}50%{box-shadow:0 0 8px rgba(48,209,88,.85),0 0 0 6px rgba(48,209,88,0)}}
      #vgl-dot.bg{animation:vglPulse 2.4s ease-out infinite}
      @keyframes vglCardIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      .vgl-card{animation:vglCardIn .26s ease both}
      #vgl-list{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;flex:1 1 auto}
      #vgl-list::-webkit-scrollbar{width:9px}
      #vgl-list::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:6px;border:2px solid transparent;background-clip:content-box}
      #vgl-root.stale #vgl-list{opacity:.75}
      .vgl-card{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-card);padding:9px 11px;transition:background .15s;border-left:3px solid transparent}
      .vgl-card:hover{background:var(--bg3)}
      /* v7.4: refuerzo de tarjeta completa (antes SOLO existía para rojo) — ahora también
         morado (última llamada, la ventana más corta de todas) y ámbar (inasistencia).
         Verde/azul no llevan tinte: son estados resueltos/informativos, no alertas activas. */
      .vgl-card.rojo{background:rgba(255,69,58,.18);border-color:rgba(255,69,58,.5);border-left-color:var(--c-rojo)}
      .vgl-card.rojo:hover{background:rgba(255,69,58,.24)}
      .vgl-card.morado{background:rgba(191,90,242,.14);border-color:rgba(191,90,242,.45);border-left-color:var(--c-morado)}
      .vgl-card.morado:hover{background:rgba(191,90,242,.20)}
      .vgl-card.ambar{background:rgba(255,159,10,.12);border-color:rgba(255,159,10,.4);border-left-color:var(--c-ambar)}
      .vgl-card.ambar:hover{background:rgba(255,159,10,.18)}
      /* v7.8.1: abandono PES — SIEMPRE por encima del color de asistencia (mismo peso
         visual que el refuerzo de fraude), va DESPUÉS en la hoja para ganar el empate de
         especificidad si un paciente cae en dos categorías a la vez (p. ej. sin
         presentarse Y con abandono PES: ambas banderas de texto conviven, el borde manda
         el de mayor prioridad clínica). */
      .vgl-card.pes{background:rgba(194,37,92,.14);border-color:rgba(194,37,92,.45);border-left-color:var(--c-pes)}
      .vgl-card.pes:hover{background:rgba(194,37,92,.20)}
      .vgl-card.hit{box-shadow:0 0 0 2px rgba(255,214,10,.55)}
      /* Bandera de fraude explícita: texto, no solo color — para daltonismo y para que no
         se "olvide" el motivo de la alerta al volver a mirar la tarjeta más tarde. */
      .vgl-flag{font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:var(--r-chip);background:var(--c-rojo);color:#fff;white-space:nowrap;letter-spacing:.3px}
      .vgl-flag.pes{background:var(--c-pes)}
      .vgl-row{display:flex;align-items:center;gap:9px}
      .vgl-cdot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
      .vgl-time{font-weight:600;font-size:13px;color:var(--fg);white-space:nowrap;font-variant-numeric:tabular-nums}
      .vgl-name{font-size:12.5px;color:var(--fg);flex:1;min-width:0;font-weight:500}
      .vgl-name b{font-weight:700;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;max-width:100%;vertical-align:bottom}
      .vgl-name mark{background:rgba(255,214,10,.35);color:inherit;border-radius:3px;padding:0 1px}
      .vgl-doc{color:var(--fg2);font-weight:400;flex-shrink:0}
      /* v7.4: color del badge pasa a var(--fg) (el texto de mayor contraste garantizado
         del sistema, en ambos temas) — el matiz semántico queda en el fondo tintado, ya
         más saturado, más el color-dot y el acento de borde de la tarjeta. Antes el badge
         de fraude escribía rojo sobre rojo (~3.4:1, por debajo de 4.5:1). */
      .vgl-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:var(--r-chip);white-space:nowrap;letter-spacing:.2px;color:var(--fg)}
      /* Cuenta regresiva: cuánto le falta al paciente para perder la cita */
      .vgl-cd{font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums;padding:2px 7px;border-radius:var(--r-chip);white-space:nowrap;background:var(--bg3);color:var(--fg2)}
      .vgl-cd.warn{background:rgba(191,90,242,.20);color:#e3bdfb}
      #vgl-root.light .vgl-cd.warn{color:#7a1fa6}
      .vgl-cd.late{background:rgba(255,159,10,.20);color:#ffcf94}
      #vgl-root.light .vgl-cd.late{color:#7a4b00}
      .vgl-pyms{margin-top:7px;display:flex;flex-wrap:wrap;gap:4px}
      .vgl-chip{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:var(--r-chip);background:rgba(10,132,255,.16);color:#0a6fd8;white-space:nowrap}
      #vgl-root:not(.light) .vgl-chip{color:#5aa9ff}
      .vgl-none{margin-top:6px;font-size:11px;color:var(--fg2);font-style:italic}
      /* v7.4: "no aparece en la base" es un problema de DATOS, no una alerta clínica —
         antes usaba el mismo ámbar que "inasistencia", con riesgo de confundirlas. Color
         neutro (el mismo gris de "sin origen de datos" del punto superior) en vez de un
         color de alerta real. */
      .vgl-none.falta{color:var(--fg3);font-style:normal;font-weight:600}
      #vgl-empty{color:var(--fg3);text-align:center;padding:26px 10px;font-size:12px;line-height:1.5}
      #vgl-root.min #vgl-tools,#vgl-root.min #vgl-sum,#vgl-root.min #vgl-stats,#vgl-root.min #vgl-list,#vgl-root.min #vgl-find,#vgl-root.min #vgl-sheet{display:none}
      /* ---- Hoja deslizante (Ajustes / Resumen): estilo "sheet" de macOS ---- */
      #vgl-sheet{display:none;flex:1 1 auto;overflow-y:auto;padding:12px 14px 16px;animation:vglSheet .22s cubic-bezier(.2,.9,.3,1)}
      /* v7.4: #vgl-stats SIGUE visible con Ajustes/Resumen abiertos — antes desaparecía
         del todo y, si algo cambiaba detrás (una inasistencia, un fraude), no había ningún
         indicio de que había novedades hasta cerrar la hoja. */
      #vgl-root.sheet #vgl-list,#vgl-root.sheet #vgl-find{display:none}
      #vgl-root.sheet #vgl-sheet{display:block}
      @keyframes vglSheet{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      .vgl-sh-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
      .vgl-sh-t{font-size:14px;font-weight:700;color:var(--fg)}
      .vgl-grp{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-card);padding:4px 12px;margin-bottom:10px}
      .vgl-fld{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}
      .vgl-fld:last-child{border-bottom:0}
      .vgl-fld label{font-size:12.5px;color:var(--fg);font-weight:500}
      .vgl-fld .vgl-hint{display:block;font-size:10.5px;color:var(--fg2);font-weight:400;margin-top:2px;max-width:250px;line-height:1.35}
      .vgl-fld input[type=text],.vgl-fld input[type=number],.vgl-fld input[type=time],.vgl-fld select{appearance:none;border:1px solid var(--edge);background:var(--bg2);color:var(--fg);border-radius:8px;padding:5px 8px;font-size:12px;font-family:inherit;outline:none;min-width:96px;max-width:160px}
      .vgl-fld input:focus,.vgl-fld select:focus{border-color:var(--c-azul)}
      .vgl-fld input[type=range]{width:120px;accent-color:var(--c-azul)}
      /* Interruptor estilo iOS */
      .vgl-sw{position:relative;width:42px;height:25px;flex:0 0 auto;cursor:pointer}
      .vgl-sw input{opacity:0;width:0;height:0;position:absolute}
      .vgl-sw i{position:absolute;inset:0;border-radius:25px;background:var(--bg4);transition:background .18s}
      .vgl-sw i:after{content:"";position:absolute;top:2px;left:2px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .18s}
      .vgl-sw input:checked + i{background:var(--c-verde)}
      .vgl-sw input:checked + i:after{transform:translateX(17px)}
      .vgl-bars{display:flex;align-items:flex-end;gap:7px;height:74px;padding:8px 4px 0}
      .vgl-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
      .vgl-bar .vgl-col{width:100%;display:flex;flex-direction:column-reverse;gap:2px;height:52px;justify-content:flex-start}
      .vgl-bar .vgl-seg{width:100%;border-radius:3px;min-height:2px}
      .vgl-bar .vgl-lb{font-size:9.5px;color:var(--fg3);font-weight:600}
      .vgl-kpis{display:flex;gap:8px;margin-bottom:10px}
      .vgl-kpi{flex:1;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r-card);padding:10px 8px;text-align:center}
      .vgl-kpi .vgl-n{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}
      .vgl-kpi .vgl-l{font-size:10px;color:var(--fg3);margin-top:4px;font-weight:600;letter-spacing:.2px}
      #vgl-dock{position:fixed;bottom:22px;right:22px;z-index:2147483647;display:none;align-items:center;gap:8px;cursor:pointer;padding:9px 14px;border-radius:var(--r-surface);
        background:var(--bg);-webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);
        border:1px solid var(--edge);box-shadow:0 12px 34px rgba(0,0,0,.5);color:var(--fg);font-family:-apple-system,'Segoe UI',system-ui,sans-serif;font-size:12.5px;font-weight:600;transition:transform .12s}
      #vgl-dock:hover{transform:translateY(-1px)}
      #vgl-dock-dot{width:9px;height:9px;border-radius:50%;background:var(--c-verde);box-shadow:0 0 8px rgba(48,209,88,.85)}
      #vgl-dock b{background:var(--c-rojo);color:#fff;border-radius:var(--r-chip);padding:1px 6px;font-size:10.5px}
      #vgl-toasts{position:fixed;top:16px;right:16px;z-index:2147483646;display:flex;flex-direction:column;gap:10px;max-width:390px;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;pointer-events:none}
      /* v7.4: los toasts (hasta 4 a la vez, cada uno con su propia capa) YA NO llevan
         backdrop-filter — piezas pequeñas y transitorias donde el blur aporta poco frente
         a su costo en GPU; --toast ya viene más opaco (.94/.96) para compensar. */
      .vgl-toast{display:flex;gap:11px;align-items:flex-start;padding:13px 14px;border-radius:var(--r-card);pointer-events:auto;color:var(--fg);
        background:var(--toast);
        border:1px solid var(--edge);box-shadow:0 16px 44px rgba(0,0,0,.5);animation:vglIn .32s cubic-bezier(.2,.9,.3,1)}
      @keyframes vglIn{from{opacity:0;transform:translateX(24px) scale(.98)}to{opacity:1;transform:none}}
      .vgl-toast-ic{width:34px;height:34px;border-radius:9px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:18px}
      .vgl-toast-main{flex:1;min-width:0}
      .vgl-toast-title{font-weight:600;font-size:13px;letter-spacing:.1px}
      .vgl-toast-b{margin-top:3px;font-size:12px;color:var(--fg2);white-space:pre-line;line-height:1.4}
      .vgl-toast{cursor:pointer}
      .vgl-toast-x{cursor:pointer;color:var(--fg3);font-size:16px;line-height:1;padding:2px 5px;border-radius:6px}
      .vgl-toast-x:hover{background:var(--bg4)}
      .vgl-toast.out{opacity:0;transform:translateX(24px) scale(.98);transition:opacity .25s,transform .25s}
      /* v7.4: el fondo del modal ahora es sólido (rgba(0,0,0,.72), sin backdrop-filter):
         el área que cubre es TODA la pantalla de Everest, el blur más caro de toda la app
         justo en el momento de mayor gravedad. Y ya no ignora el tema: usa var(--bg)/
         var(--fg)/var(--fg2) como el resto del panel — antes tenía colores fijos que se
         quedaban oscuros aunque el usuario hubiera elegido tema claro. El borde rojo SÍ
         sigue fijo: es semántico (fraude), no de tema. */
      #vgl-modal{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);animation:vglIn .25s ease}
      .vgl-modal-card{background:var(--bg);border:2px solid var(--c-rojo);border-radius:var(--r-surface);padding:28px 32px;max-width:460px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.6);font-family:-apple-system,'Segoe UI',system-ui,sans-serif}
      .vgl-modal-dot{width:18px;height:18px;border-radius:50%;margin:0 auto 14px}
      .vgl-modal-t{font-size:18px;font-weight:700;color:var(--fg);margin-bottom:8px}
      .vgl-modal-b{font-size:14px;color:var(--fg2);white-space:pre-line;line-height:1.5}
      .vgl-modal-ok{margin-top:20px;border:0;border-radius:10px;padding:10px 26px;font-size:14px;font-weight:700;color:#001;cursor:pointer;font-family:inherit}
      /* v7.6: recordatorio de PyM al abrir una historia clínica — estilo PROPIO, calmado,
         deliberadamente distinto del cartel rojo de fraude (no es una alarma, es una
         ayuda). Reutiliza la estructura del modal pero con acento teal y sin insistir. */
      #vgl-pym-modal{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);animation:vglIn .25s ease}
      .vgl-pym-card{background:var(--bg);border:2px solid var(--c-recordatorio);border-radius:var(--r-surface);padding:26px 30px;max-width:420px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.5);font-family:-apple-system,'Segoe UI',system-ui,sans-serif}
      .vgl-pym-ic{width:44px;height:44px;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:rgba(32,201,181,.16);border:1px solid rgba(32,201,181,.4)}
      .vgl-pym-t{font-size:16px;font-weight:700;color:var(--fg);margin-bottom:2px}
      .vgl-pym-n{font-size:13px;font-weight:600;color:var(--c-recordatorio);margin-bottom:14px}
      .vgl-pym-lead{font-size:12.5px;color:var(--fg2);margin-bottom:10px}
      .vgl-pym-list{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px}
      .vgl-pym-chip{font-size:12px;font-weight:600;padding:5px 12px;border-radius:var(--r-chip);background:rgba(32,201,181,.14);color:var(--fg);border:1px solid rgba(32,201,181,.35)}
      .vgl-pym-foot{font-size:10.5px;color:var(--fg3);margin-bottom:4px}
      .vgl-pym-ok{border:0;border-radius:10px;padding:9px 24px;font-size:13px;font-weight:700;color:#001;cursor:pointer;font-family:inherit;background:var(--c-recordatorio)}
      /* v7.8.1: alarma de abandono PES — misma estructura del recordatorio de PyM, pero
         con acento --c-pes (carmesí) para que se distinga a simple vista de la ayuda
         calmada teal: esta SÍ es una alarma de prioridad clínica, no una sugerencia. */
      #vgl-pes-modal{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);animation:vglIn .25s ease}
      .vgl-pes-card{background:var(--bg);border:2px solid var(--c-pes);border-radius:var(--r-surface);padding:26px 30px;max-width:420px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.5);font-family:-apple-system,'Segoe UI',system-ui,sans-serif}
      .vgl-pes-ic{width:44px;height:44px;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:rgba(194,37,92,.16);border:1px solid rgba(194,37,92,.4)}
      .vgl-pes-t{font-size:16px;font-weight:700;color:var(--fg);margin-bottom:2px}
      .vgl-pes-n{font-size:13px;font-weight:600;color:var(--c-pes);margin-bottom:14px}
      .vgl-pes-lead{font-size:12.5px;color:var(--fg2);margin-bottom:14px;line-height:1.5}
      .vgl-pes-foot{font-size:10.5px;color:var(--fg3);margin-bottom:4px}
      .vgl-pes-ok{border:0;border-radius:10px;padding:9px 24px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;background:var(--c-pes)}
    `;
    document.head.appendChild(style);
    const root = document.createElement("div"); root.id = "vgl-root";
    root.innerHTML = `
      <div id="vgl-head">
        <div id="vgl-tls">
          <button class="vgl-tl close" id="vgl-tl-close" title="Ocultar (se colapsa a una pastilla)">×</button>
          <button class="vgl-tl min" id="vgl-tl-min" title="Minimizar (solo la barra)">−</button>
          <button class="vgl-tl zoom" id="vgl-tl-zoom" title="Restaurar tamaño completo">+</button>
        </div>
        <div id="vgl-title">Vigilante PyM<small>v${VERSION}</small></div>
        <span id="vgl-dot" title="origen de datos"></span>
      </div>
      <div id="vgl-tools">
        <button class="vgl-btn primary" id="vgl-load" title="Cargar el PyM del día desde un archivo (.xlsx / .csv)">Abrir PyM</button>
        <button class="vgl-btn" id="vgl-bell" title="Activar notificaciones de Windows">Alertas</button>
        <button class="vgl-btn" id="vgl-mute" title="Silenciar el sonido 15 minutos (se sigue registrando todo)">Silenciar</button>
        <button class="vgl-btn" id="vgl-rep" title="Resumen del turno, tendencia y reporte de auditoría">Resumen</button>
        <button class="vgl-btn" id="vgl-cfg" title="Ajustes">Ajustes</button>
      </div>
      <div id="vgl-find">
        <input id="vgl-q" type="text" spellcheck="false" placeholder="Buscar paciente o cédula…">
        <button class="vgl-fchip sel" data-f="todas">Todas</button>
        <button class="vgl-fchip" data-f="riesgo" title="Fraude, última llamada e inasistencias">Riesgo</button>
        <button class="vgl-fchip" data-f="sinpres">Sin presentarse</button>
        <button class="vgl-fchip" data-f="ensala">En sala</button>
        <button class="vgl-fchip" data-f="pym">Con PyM</button>
      </div>
      <div id="vgl-sum">Iniciando monitoreo…</div>
      <div id="vgl-stats"></div>
      <div id="vgl-list"><div id="vgl-empty">Entra una vez a "Citas del día": ahí se aprende la consulta de la agenda y la vigilancia sigue sola.</div></div>
      <div id="vgl-sheet"></div>
      <input type="file" id="vgl-file" accept=".xlsx,.xlsm,.csv" style="display:none">
    `;
    document.body.appendChild(root);
    el = { root, sum: root.querySelector("#vgl-sum"), stats: root.querySelector("#vgl-stats"), list: root.querySelector("#vgl-list"), file: root.querySelector("#vgl-file"), dot: root.querySelector("#vgl-dot"), sheet: root.querySelector("#vgl-sheet"), q: root.querySelector("#vgl-q") };
    root.querySelector("#vgl-load").addEventListener("click", () => el.file.click());
    root.querySelector("#vgl-bell").addEventListener("click", enableOsNotifications);
    root.querySelector("#vgl-rep").addEventListener("click", () => toggleSheet("resumen"));
    root.querySelector("#vgl-cfg").addEventListener("click", () => toggleSheet("ajustes"));
    root.querySelector("#vgl-mute").addEventListener("click", () => (muted() ? unmute() : muteFor(15)));
    // Buscador: filtra en vivo y resalta la coincidencia.
    el.q.addEventListener("input", () => { state.busqueda = el.q.value.trim().toLowerCase(); state.lastSignature = ""; repaint(); });
    el.q.addEventListener("keydown", (e) => { if (e.key === "Escape") { el.q.value = ""; state.busqueda = ""; state.lastSignature = ""; repaint(); } e.stopPropagation(); });
    root.querySelectorAll(".vgl-fchip").forEach((c) => c.addEventListener("click", () => {
      state.filtro = c.dataset.f; state.lastSignature = "";
      root.querySelectorAll(".vgl-fchip").forEach((x) => x.classList.toggle("sel", x === c));
      if (root.classList.contains("sheet")) closeSheet();
      repaint();
    }));
    // Al volver a la pestaña o hacer clic en el panel: reconocer (apaga sonido y parpadeo).
    root.addEventListener("click", (e) => { if (!e.target.closest("#vgl-sheet")) acknowledge(); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") stopFlash(); });
    el.file.addEventListener("change", (e) => { if (e.target.files[0]) loadPymFile(e.target.files[0]); e.target.value = ""; });
    root.querySelector("#vgl-tl-close").addEventListener("click", () => setWinState("dock"));
    root.querySelector("#vgl-tl-min").addEventListener("click", () => setWinState(winState === "min" ? "full" : "min"));
    root.querySelector("#vgl-tl-zoom").addEventListener("click", () => setWinState("full"));
    root.querySelector("#vgl-head").addEventListener("dblclick", (e) => { if (e.target.closest("button")) return; setWinState(winState === "min" ? "full" : "min"); });
    const dock = document.createElement("div"); dock.id = "vgl-dock"; dock.title = "Mostrar Vigilante PyM (Alt+V)";
    dock.innerHTML = `<span id="vgl-dock-dot"></span><span>Vigilante PyM</span><b id="vgl-dock-b" style="display:none">0</b>`;
    dock.addEventListener("click", () => setWinState("full"));
    document.body.appendChild(dock); el.dock = dock; el.dockB = dock.querySelector("#vgl-dock-b");
    const toasts = document.createElement("div"); toasts.id = "vgl-toasts"; document.body.appendChild(toasts);
    makeDraggable(root, root.querySelector("#vgl-head"));
    // Atajo de teclado: Alt+V muestra u oculta el panel sin tocar el mouse.
    document.addEventListener("keydown", (e) => { if (e.altKey && !e.ctrlKey && (e.key === "v" || e.key === "V")) { e.preventDefault(); setWinState(winState === "dock" ? "full" : "dock"); } });
    restorePos(); applyTheme(); paintMute(); updateBell();
    // El tema "auto" sigue al modo claro/oscuro de Windows en vivo.
    try { if (PAGEWIN.matchMedia) PAGEWIN.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S.tema === "auto") applyTheme(); }); } catch (e) {}
  }

  // ---- Posición y estado de la ventana: se recuerdan entre sesiones ----
  function savePos() { try { const r = el.root.getBoundingClientRect(); writeJSON("vgl_pos", { left: Math.round(r.left), top: Math.round(r.top), win: winState }); } catch (e) {} }
  function restorePos() {
    const p = readJSON("vgl_pos", null); if (!p) return;
    try {
      if (typeof p.left === "number" && typeof p.top === "number") {
        const L = Math.min(Math.max(0, p.left), Math.max(0, innerWidth - 120)), T = Math.min(Math.max(0, p.top), Math.max(0, innerHeight - 60));
        el.root.style.left = L + "px"; el.root.style.top = T + "px"; el.root.style.right = "auto"; el.root.style.bottom = "auto";
      }
      if (p.win && p.win !== "full") setWinState(p.win);
    } catch (e) {}
  }

  // ---- Hoja deslizante: Resumen del turno / Ajustes ----
  function closeSheet() { state.sheet = null; el.root.classList.remove("sheet"); el.sheet.innerHTML = ""; }
  function toggleSheet(kind) { if (state.sheet === kind) { closeSheet(); return; } state.sheet = kind; el.root.classList.add("sheet"); if (kind === "resumen") renderResumen(); else renderSettings(); }
  function sheetHeader(title, extraHtml) {
    return `<div class="vgl-sh-h"><span class="vgl-sh-t">${escapeHtml(title)}</span><span>${extraHtml || ""}<button class="vgl-btn" data-x="1" style="margin-left:6px">Cerrar</button></span></div>`;
  }
  function wireClose() { const b = el.sheet.querySelector('[data-x="1"]'); if (b) b.addEventListener("click", closeSheet); }

  // Resumen del turno: KPIs de hoy + barras de los últimos 7 días + exportar auditoría.
  function renderResumen() {
    const hoy = statsToday(), dias = lastDays(7), evs = eventsOf();
    const max = Math.max(1, ...dias.map((d) => (d.fraude || 0) + (d.inasistencia || 0) + (d.atiempo || 0)));
    const dow = ["do", "lu", "ma", "mi", "ju", "vi", "sá"];
    const bars = dias.map((d) => {
      const t = new Date(d.fecha + "T00:00:00");
      const seg = (n, c) => (n ? `<div class="vgl-seg" style="height:${Math.max(2, Math.round((n / max) * 52))}px;background:${c}" title="${n}"></div>` : "");
      return `<div class="vgl-bar"><div class="vgl-col">${seg(d.atiempo, COLORS.VERDE)}${seg(d.inasistencia, COLORS.AMBAR)}${seg(d.fraude, COLORS.ROJO)}</div><span class="vgl-lb">${dow[t.getDay()]} ${t.getDate()}</span></div>`;
    }).join("");
    el.sheet.innerHTML = sheetHeader("Resumen del turno") + `
      <div class="vgl-kpis">
        <div class="vgl-kpi"><div class="vgl-n" style="color:${COLORS.ROJO}">${hoy.fraude || 0}</div><div class="vgl-l">FRAUDES</div></div>
        <div class="vgl-kpi"><div class="vgl-n" style="color:${COLORS.AMBAR}">${hoy.inasistencia || 0}</div><div class="vgl-l">INASISTENCIAS</div></div>
        <div class="vgl-kpi"><div class="vgl-n" style="color:${COLORS.VERDE}">${hoy.atiempo || 0}</div><div class="vgl-l">A TIEMPO</div></div>
      </div>
      <div class="vgl-grp" style="padding:8px 12px 10px">
        <div style="font-size:11px;color:var(--fg3);font-weight:600;letter-spacing:.3px">ÚLTIMOS 7 DÍAS</div>
        <div class="vgl-bars">${bars}</div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>Eventos registrados hoy<span class="vgl-hint">Cambios de estado y alertas, con hora exacta.</span></label><b style="font-variant-numeric:tabular-nums">${evs.length}</b></div>
        <div class="vgl-fld"><label>Reporte de auditoría<span class="vgl-hint">Archivo .csv que se abre en Excel. No sale del computador.</span></label><button class="vgl-btn primary" id="vgl-exp">Descargar</button></div>
        <div class="vgl-fld"><label>Copiar resumen<span class="vgl-hint">Para pegarlo en un correo o en el acta del turno.</span></label><button class="vgl-btn" id="vgl-copy">Copiar</button></div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>Archivo PyM en uso<span class="vgl-hint">${escapeHtml(state.pymFile || "ninguno")}</span></label><b style="font-variant-numeric:tabular-nums">${state.pym.size}</b></div>
        <div class="vgl-fld"><label>Diagnóstico técnico<span class="vgl-hint">Sin datos de pacientes. Úsalo si algo deja de funcionar.</span></label><button class="vgl-btn" id="vgl-diag">Diag</button></div>
      </div>`;
    wireClose();
    el.sheet.querySelector("#vgl-exp").addEventListener("click", () => exportAudit());
    el.sheet.querySelector("#vgl-diag").addEventListener("click", downloadDiagnostic);
    el.sheet.querySelector("#vgl-copy").addEventListener("click", copySummary);
  }
  function copySummary() {
    const h = statsToday(), lst = (state.lastSnapshot && state.lastSnapshot.list) || [];
    const cnt = (f) => lst.filter((a) => f((a.estado || "").toLowerCase())).length;
    const txt = ["Vigilante de Agenda — " + todayStamp(),
      "Citas en agenda: " + lst.length,
      "En sala ahora: " + cnt((s) => s.includes("en sala")) + " · Atendidas: " + cnt((s) => s.includes("atendido")) + " · Sin presentarse: " + cnt((s) => s.includes("sin presentarse")),
      "Confirmaciones extemporáneas (fraude): " + (h.fraude || 0),
      "Inasistencias registradas: " + (h.inasistencia || 0),
      "Ingresos a tiempo: " + (h.atiempo || 0),
      "PyM: " + (state.pymFile || "sin cargar")].join("\n");
    try { navigator.clipboard.writeText(txt).then(() => setSummary("Resumen copiado al portapapeles."), () => setSummary("No pude copiar; revisa los permisos del navegador.", "warn")); }
    catch (e) { setSummary("No pude copiar; revisa los permisos del navegador.", "warn"); }
  }

  // Ajustes: todo lo configurable, sin tocar el código.
  function renderSettings() {
    const sw = (id, on) => `<label class="vgl-sw"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><i></i></label>`;
    el.sheet.innerHTML = sheetHeader("Ajustes") + `
      <div class="vgl-grp">
        <div class="vgl-fld"><label>Tolerancia<span class="vgl-hint">Minutos de gracia antes de marcar inasistencia. El aviso morado sale 1 min antes.</span></label><input type="number" id="c-tol" step="0.5" min="0.5" max="60" value="${S.tolerancia}"></div>
        <div class="vgl-fld"><label>Refresco<span class="vgl-hint">Segundos entre lecturas de la agenda.</span></label><input type="number" id="c-ref" step="1" min="2" max="120" value="${S.refresco}"></div>
        <div class="vgl-fld"><label>Tema<span class="vgl-hint">"Automático" sigue el modo claro/oscuro de Windows.</span></label>
          <select id="c-tema"><option value="oscuro">Oscuro</option><option value="claro">Claro</option><option value="auto">Automático</option></select></div>
        <div class="vgl-fld"><label>Modo rendimiento<span class="vgl-hint">Apaga el efecto de vidrio (blur) por completo. Actívalo en el equipo más viejo del consultorio si el panel se siente pesado.</span></label>${sw("c-perf", S.modoRendimiento)}</div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>Sonido<span class="vgl-hint">Un tono distinto por color de alerta.</span></label>${sw("c-snd", S.sonido)}</div>
        <div class="vgl-fld"><label>Volumen</label><input type="range" id="c-vol" min="2" max="60" value="${Math.round(S.volumen * 100)}"></div>
        <div class="vgl-fld"><label>Insistir en el fraude<span class="vgl-hint">El rojo repite el sonido cada 9 s hasta que lo reconozcas.</span></label>${sw("c-ins", S.insistir)}</div>
        <div class="vgl-fld"><label>Cartel grande<span class="vgl-hint">Aviso a pantalla completa dentro de Everest cuando hay fraude.</span></label>${sw("c-car", S.cartel)}</div>
        <div class="vgl-fld"><label>Pestaña parpadeando<span class="vgl-hint">Título e ícono del navegador titilan hasta que vuelvas.</span></label>${sw("c-par", S.parpadeo)}</div>
        <div class="vgl-fld"><label>Ventana emergente<span class="vgl-hint">Aparece en la barra de tareas de Windows. Hay que permitir ventanas emergentes al sitio.</span></label>${sw("c-pop", S.popup)}</div>
        <div class="vgl-fld"><label>Probar los avisos<span class="vgl-hint">Dispara una alerta de prueba de cada tipo.</span></label><button class="vgl-btn" id="c-test">Probar</button></div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>PyM que se ocultan<span class="vgl-hint">Separadas por coma. VIH nunca se oculta, aunque lo escribas.</span></label><input type="text" id="c-exc" value="${escapeHtml(S.excluir)}"></div>
        <div class="vgl-fld"><label>Recordar cargar el PyM<span class="vgl-hint">Si a esta hora no hay PyM, avisa. Vacío = nunca.</span></label><input type="time" id="c-rec" value="${escapeHtml(S.recordatorio)}"></div>
        <div class="vgl-fld"><label>Recordatorio al abrir la historia<span class="vgl-hint">Si el paciente tiene PyM pendiente, sale un aviso (que hay que cerrar a mano) recordando qué ordenar. Una vez por paciente al día.</span></label>${sw("c-pymrem", S.recordatorioPym)}</div>
        <div class="vgl-fld"><label>Probar el recordatorio<span class="vgl-hint">Muestra un ejemplo con datos de prueba, sin esperar a un paciente real.</span></label><button class="vgl-btn" id="c-pymtest">Probar</button></div>
        <div class="vgl-fld"><label>Alarma de abandono PES<span class="vgl-hint">Si el paciente tiene abandono registrado en el Programa de riesgo cardiovascular (Abandonados_PES = "Si"), resalta su tarjeta en la agenda y suena una alarma al abrir su historia clínica.</span></label>${sw("c-pes", S.abandonoPES)}</div>
        <div class="vgl-fld"><label>Probar la alarma PES<span class="vgl-hint">Muestra un ejemplo con datos de prueba, sin esperar a un paciente real.</span></label><button class="vgl-btn" id="c-pestest">Probar</button></div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>PyM automático<span class="vgl-hint">PRIMERO busca el PyM real de HOY en SharePoint (carpeta ACTIVIDADES DE PYM, revisa cada 10 min); si aún no aparece, usa la base piloto de respaldo y la reemplaza sola en cuanto encuentre la de hoy. «Abrir PyM» siempre puede reemplazar cualquiera de las dos a mano.</span></label>${sw("c-base", S.baseAuto)}</div>
        <div class="vgl-fld"><label>Enlace de la base piloto<span class="vgl-hint">${escapeHtml((CONFIG.SP.respaldo && CONFIG.SP.respaldo.name) || "ninguna")} — el respaldo, NO el PyM del día. Si cambian el archivo de respaldo, pegue aquí el enlace: sirve el de la BARRA DE DIRECCIONES con el archivo abierto (no hace falta «Copiar vínculo»).</span></label><input type="text" id="c-fbid" placeholder="(el de fábrica)" value="${escapeHtml(S.respaldoId)}"></div>
        <div class="vgl-fld"><label>Buscar el PyM de hoy ahora<span class="vgl-hint" id="c-basen">Busca el PyM de hoy en SharePoint de inmediato; si no aparece, baja la base piloto. Reemplaza lo que esté cargado.</span></label><button class="vgl-btn" id="c-basego">Buscar</button></div>
        <div class="vgl-fld"><label>Abrir SharePoint<span class="vgl-hint">Abre el OneDrive de la IPS en otra pestaña. Si la descarga directa falla (casi siempre es la sesión vencida: SharePoint redirige al login), entra una vez con tu usuario: el Vigilante captura el PyM ahí solo y lo comparte con Everest.</span></label><button class="vgl-btn" id="c-spabrir">Abrir</button></div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>Reporte al tablero<span class="vgl-hint">Hoja de Google del programa. SOLO manda el resumen de ayer (1 fila/día) y los fraudes en vivo (sin cédulas ni nombres). Nada más.</span></label>${sw("c-rep", S.reporte)}</div>
        <div class="vgl-fld"><label>Nombre del puesto<span class="vgl-hint">Para saber de qué equipo viene la fila (ej. "Consultorio 3"). No es un dato personal.</span></label><input type="text" id="c-eq" placeholder="(opcional)" value="${escapeHtml(S.equipo)}"></div>
        <div class="vgl-fld"><label>Probar envío<span class="vgl-hint" id="c-repn">Manda una fila de prueba y confirma si la Hoja la recibió.</span></label><button class="vgl-btn" id="c-repgo">Probar</button></div>
        <div class="vgl-fld"><label>URL del tablero (avanzado)<span class="vgl-hint">Web App de Google. Ya viene puesta; no la toques salvo que republiques el Apps Script.</span></label><input type="text" id="c-repurl" placeholder="(la de fábrica)" value="${escapeHtml(S.reporteUrl)}"></div>
      </div>
      <div class="vgl-grp">
        <div class="vgl-fld"><label>Restablecer todo<span class="vgl-hint">Vuelve a los valores de fábrica. No borra el historial.</span></label><button class="vgl-btn off" id="c-reset">Restablecer</button></div>
      </div>`;
    wireClose();
    const q = (id) => el.sheet.querySelector(id);
    q("#c-tema").value = S.tema;
    const bind = (id, key, get) => { const n = q(id); n.addEventListener("change", () => { S[key] = get(n); saveSettings(); state.lastSignature = ""; repaint(); }); };
    bind("#c-tol", "tolerancia", (n) => clampNum(n.value, 0.5, 60, DEFAULTS.tolerancia));
    bind("#c-ref", "refresco", (n) => clampNum(n.value, 2, 120, DEFAULTS.refresco));
    bind("#c-tema", "tema", (n) => n.value);
    bind("#c-perf", "modoRendimiento", (n) => n.checked);
    bind("#c-snd", "sonido", (n) => n.checked);
    bind("#c-ins", "insistir", (n) => n.checked);
    bind("#c-car", "cartel", (n) => n.checked);
    bind("#c-par", "parpadeo", (n) => n.checked);
    bind("#c-exc", "excluir", (n) => n.value);
    bind("#c-rec", "recordatorio", (n) => n.value);
    bind("#c-pymrem", "recordatorioPym", (n) => n.checked);
    q("#c-pymtest").addEventListener("click", () => pymAlert("Paciente de prueba", ["Tamización VIH", "Tamización de mama"]));
    bind("#c-pes", "abandonoPES", (n) => n.checked);
    q("#c-pestest").addEventListener("click", () => abandonoPESAlert("Paciente de prueba"));
    bind("#c-base", "baseAuto", (n) => n.checked);
    bind("#c-rep", "reporte", (n) => n.checked);
    bind("#c-eq", "equipo", (n) => n.value.slice(0, 40));
    q("#c-repurl").addEventListener("change", () => { S.reporteUrl = q("#c-repurl").value.trim(); saveSettings(); setSummary(repOn() ? "Tablero configurado." : "Reporte apagado o sin URL.", repOn() ? "" : "warn"); });
    q("#c-repgo").addEventListener("click", async () => {
      const n = q("#c-repn"), b = q("#c-repgo");
      if (!repOn()) { n.textContent = S.reporte ? "Falta el permiso GM_xmlhttpRequest: reinstala el script." : "Actívalo primero con el interruptor de arriba."; return; }
      b.disabled = true; n.textContent = "Enviando a la Hoja…";
      const ok = await repPost({ token: TABLERO.token, equipo: (S.equipo || "").slice(0, 40), ver: VERSION, evento: "prueba", ts: new Date().toISOString(), dia: todayStamp() });
      b.disabled = false;
      n.textContent = ok ? "✅ Recibido: en la pestaña «reportes» de la Hoja debe haber una fila nueva con evento «prueba»."
        : "❌ No llegó. Revisa: permiso de Tampermonkey a script.google.com («Siempre permitir») y que la Web App esté publicada con acceso «Cualquier persona».";
      setSummary(ok ? "El tablero recibió la fila de prueba." : "La fila de prueba no llegó al tablero.", ok ? "" : "warn");
      if (ok) repFlush();
    });
    q("#c-fbid").addEventListener("change", () => {
      const v = q("#c-fbid").value.trim();
      if (v && !parseSpDocId(v)) { setSummary("Ese enlace no trae un identificador de archivo válido.", "warn"); return; }
      S.respaldoId = v; saveSettings();
      setSummary(v ? "Enlace de la base guardado." : "Se usará el archivo de fábrica.");
    });
    q("#c-basego").addEventListener("click", async () => {
      const n = q("#c-basen"), b = q("#c-basego");
      b.disabled = true; n.textContent = "Buscando el PyM de hoy…";
      const prev = state.pymFile; state.pymFile = "";        // fuerza el reemplazo
      let ok = await loadPymDiario(false).catch(() => false);
      if (!ok) { n.textContent = "No está el de hoy; probando la base piloto…"; ok = await loadPymBase(false).catch(() => false); }
      if (!ok) state.pymFile = prev;
      b.disabled = false;
      n.textContent = ok ? (state.pymFallback ? "⚠ No apareció el PyM de hoy — se cargó la base piloto (referencia, puede estar desactualizada): " : "✓ PyM de HOY cargado: ") + state.pym.size + " paciente(s)."
        : "No se pudo. Usa «Abrir SharePoint» (abajo), inicia sesión si lo pide y espera el aviso de captura — o usa «Abrir PyM».";
    });
    // v7.8: reactivar la sesión de SharePoint con un clic. El captador que ya corre en
    // esa pestaña baja el PyM con las cookies de la propia página y lo comparte por el
    // almacén de Tampermonkey; el sondeo de cada minuto lo recoge aquí solo.
    q("#c-spabrir").addEventListener("click", () => {
      try { window.open(spBase(), "_blank"); } catch (e) {}
      setSummary("SharePoint abierto en otra pestaña. Si pide usuario, inicia sesión; el PyM se captura solo y aparece aquí en un momento.");
    });
    q("#c-vol").addEventListener("change", () => { S.volumen = clampNum(q("#c-vol").value, 2, 60, 15) / 100; saveSettings(); playTone("AZUL"); });
    q("#c-pop").addEventListener("change", () => { S.popup = q("#c-pop").checked; saveSettings(); if (S.popup) popupAlert("AZUL", "🛡️ Ventana de alerta activada", "Así se verá una alerta.\nAparece en la barra de tareas de Windows."); });
    q("#c-test").addEventListener("click", testNotifications);
    // v7.5: confirmación antes de borrar TODOS los ajustes — un solo clic sin preguntar
    // podía echar a perder una tolerancia o exclusiones de PyM personalizadas sin querer.
    q("#c-reset").addEventListener("click", () => {
      if (!confirm("¿Restablecer TODOS los ajustes a los valores de fábrica?\n\nNo borra el historial ni el PyM ya cargado, pero sí la tolerancia, el sonido, las exclusiones de PyM y todo lo demás que haya personalizado.")) return;
      Object.assign(S, DEFAULTS); saveSettings(); renderSettings(); setSummary("Ajustes restablecidos.");
    });
    // El PyM que ya está cargado se re-filtra al cambiar la lista de exclusiones.
    q("#c-exc").addEventListener("change", () => setSummary("Los cambios en las PyM ocultas se aplican al volver a cargar el archivo (botón «Abrir PyM»).", "warn"));
  }

  function paintMute() {
    const b = document.getElementById("vgl-mute"); if (!b) return;
    const on = muted();
    b.classList.toggle("off", on);
    b.textContent = on ? "🔕 " + Math.max(1, Math.ceil((state.muteUntil - Date.now()) / 60000)) + " min" : "Silenciar";
    b.title = on ? "Silenciado. Clic para reactivar el sonido." : "Silenciar el sonido 15 minutos (se sigue registrando todo)";
  }
  function repaint() { if (state.lastSnapshot) render(state.lastSnapshot.list, state.lastSnapshot.source, state.lastSnapshot.at); }

  function makeDraggable(root, handle) {
    let dx = 0, dy = 0, dragging = false;
    // v7.5: el navegador no puede "cachear" un backdrop-filter mientras el elemento se
    // mueve — tiene que re-muestrear lo que hay detrás en cada frame. En GPU vieja eso
    // se siente como arrastre entrecortado justo cuando se mueve el panel para despejar
    // la vista. La clase "vgl-dragging" apaga el blur (fondo sólido de --toast) SOLO
    // mientras dura el arrastre, y se restaura al soltar.
    handle.addEventListener("mousedown", (e) => { if (e.target.closest("button")) return; dragging = true; root.classList.add("vgl-dragging"); const r = root.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; root.style.bottom = "auto"; root.style.right = "auto"; e.preventDefault(); });
    document.addEventListener("mousemove", (e) => { if (!dragging) return; root.style.left = Math.max(0, e.clientX - dx) + "px"; root.style.top = Math.max(0, e.clientY - dy) + "px"; });
    document.addEventListener("mouseup", () => { if (dragging) { dragging = false; root.classList.remove("vgl-dragging"); savePos(); } });
  }
  function setSummary(text, level) { if (!el.sum) return; el.sum.className = level || ""; el.sum.textContent = (level === "error" ? "⚠ " : level === "warn" ? "⏸ " : "") + text; }
  function signatureOf(list) { return list.map((a) => `${a.key}~${a.estado}~${a.color}~${a.pym.join("·")}`).join("||"); }
  // Barra de estadísticas: "En sala" = confirmadas del momento; "Atendidas" ya culminaron
  // (no cuentan como actuales). Se añade el contador de fraudes del día.
  let statsSig = "", frCache = { dia: "", n: 0 };
  // El contador de fraudes se guarda en memoria y solo se relee cuando cambia (bumpStat
  // lo invalida). Antes se leía y se interpretaba localStorage en CADA tick: 8.640 veces
  // por jornada solo para pintar un número que casi nunca cambia.
  function fraudesHoy() {
    const d = todayStamp();
    if (frCache.dia !== d) { frCache = { dia: d, n: statsToday().fraude || 0 }; }
    return frCache.n;
  }
  function renderStats(list) {
    if (!el.stats) return;
    if (!list.length) { if (statsSig !== "") { statsSig = ""; el.stats.innerHTML = ""; } return; }
    // v7.4.1: "Sin presentarse" se partió en dos leyendas. Antes mezclaba, bajo el mismo
    // número, al paciente que TODAVÍA puede llegar (aún no vence la tolerancia) con el que
    // YA la perdió (pasó la tolerancia = AMBAR, lo mismo que ya cuenta como "inasistencia"
    // en el resto de la app). Ahora "Sin presentarse" es SOLO el primer caso; el segundo
    // pasa a "Inasistencias" (mismo término que ya usa el Resumen del turno y los avisos).
    let ensala = 0, pend = 0, inasist = 0, atend = 0;
    for (const a of list) {
      const s = (a.estado || "").toLowerCase();
      if (s.includes("en sala")) ensala++;
      else if (s.includes("sin presentarse")) { if (a.color === "AMBAR") inasist++; else pend++; }
      else if (s.includes("atendido")) atend++;
    }
    const fr = fraudesHoy();
    const sig = ensala + "|" + pend + "|" + inasist + "|" + atend + "|" + fr;
    if (sig === statsSig) return;              // nada cambió: no se toca el DOM
    statsSig = sig;
    el.stats.innerHTML =
      `<span class="vgl-stat"><span class="vgl-d" style="background:${COLORS.VERDE}"></span>En sala <b>${ensala}</b></span>` +
      `<span class="vgl-stat"><span class="vgl-d" style="background:${COLORS.AZUL}"></span>Sin presentarse <b>${pend}</b></span>` +
      `<span class="vgl-stat"><span class="vgl-d" style="background:${COLORS.AMBAR}"></span>Inasistencias <b>${inasist}</b></span>` +
      `<span class="vgl-stat"><span class="vgl-d" style="background:var(--fg3)"></span>Atendidas <b>${atend}</b></span>` +
      (fr ? `<span class="vgl-stat hot" title="Confirmaciones extemporáneas detectadas hoy">⛔ Fraudes hoy <b>${fr}</b></span>` : "");
    if (el.dockB) { el.dockB.style.display = fr ? "inline-block" : "none"; el.dockB.textContent = String(fr); }
  }

  // v7.8.1: ¿tiene abandono registrado en el Programa de riesgo cardiovascular (PES)?
  // Solo "Si" cuenta (esSi() en el indexador) — un "No" nunca llega a este conjunto.
  function tieneAbandonoPES(a) { return S.abandonoPES && state.pymAbandono && state.pymAbandono.has(normalizeKey(a.doc_id)); }
  // ---- Buscador y filtros rápidos ----
  function matchesSearch(a) {
    const q = state.busqueda; if (!q) return true;
    if (stripAccents((a.nombre || "").toLowerCase()).includes(stripAccents(q))) return true;
    const digitos = q.replace(/\D/g, "");
    return !!digitos && String(a.doc_id || "").includes(digitos);
  }
  function matchesFilter(a) {
    const s = (a.estado || "").toLowerCase();
    switch (state.filtro) {
      // v7.8.1: abandono PES entra también a "Riesgo" — es exactamente eso, un paciente
      // que hoy debe priorizar el control de riesgo cardiovascular.
      case "riesgo": return a.color === "ROJO" || a.color === "AMBAR" || (a.color === "MORADO" && a.reason === "tiempo") || tieneAbandonoPES(a);
      case "sinpres": return s.includes("sin presentarse");
      case "ensala": return s.includes("en sala");
      case "pym": return a.pym && a.pym.length > 0;
      default: return true;
    }
  }
  function highlight(txt) {
    const q = state.busqueda; const safe = escapeHtml(txt);
    if (!q) return safe;
    const i = txt.toLowerCase().indexOf(q); if (i < 0) return safe;
    return escapeHtml(txt.slice(0, i)) + "<mark>" + escapeHtml(txt.slice(i, i + q.length)) + "</mark>" + escapeHtml(txt.slice(i + q.length));
  }
  // Cuenta regresiva: cuánto le queda al paciente antes de perder la cita (o cuánto lleva pasado).
  function countdown(a) {
    const s = (a.estado || "").toLowerCase();
    if (s.includes("en sala") || s.includes("atendido") || !a.hora_texto) return "";
    const rest = CONFIG.TOLERANCIA_MIN - (a.elapsed || 0);
    // Solo tiene sentido cerca de la hora de la cita: si falta más de 1½ h, no se muestra.
    if (rest > 90 || rest < -180) return "";
    const abs = Math.abs(rest);
    let cuanto;
    if (abs >= 60) cuanto = Math.floor(abs / 60) + "h" + String(Math.round(abs % 60)).padStart(2, "0");
    else { const mm = Math.floor(abs), ss = Math.round((abs - mm) * 60); cuanto = mm + ":" + String(Math.min(59, ss)).padStart(2, "0"); }
    // v7.4: palabra corta en vez de signo matemático — bajo presión, un "−"/"+" de 10.5px
    // junto a una hora en el mismo formato numérico es fácil de pasar por alto o confundir.
    // Se mantiene compacto (mismo orden de longitud que el signo) para no romper la fila.
    const txt = (rest >= 0 ? "en " : "hace ") + cuanto;
    const cls = rest <= 0 ? " late" : rest <= 1 ? " warn" : "";
    const tip = rest >= 0 ? "Le quedan " + cuanto + " para confirmar" : "Lleva " + cuanto + " pasado de la tolerancia";
    return `<span class="vgl-cd${cls}" title="${tip}">${txt}</span>`;
  }

  function render(list, source, at) {
    const sinCruce = state.pymFile && state.pym.size > 0 && list.length > 0 && list.every((a) => !a.pym || !a.pym.length);
    // v7.8.3: texto más claro cuando se está usando la base PILOTO (no la de hoy) — antes
    // decía solo "⚠ RESPALDO", una palabra que no explica QUÉ significa ni QUÉ hacer.
    const pymTxt = state.pymFile
      ? (`PyM: ${state.pym.size}` + (state.pymFallback ? " · ⚠ base piloto (aún no llega la de hoy)" : "") + (sinCruce ? " ⚠ SIN CRUCE (Ajustes→Diag)" : ""))
      : "PyM sin cargar";
    const hora = at ? at.toLocaleTimeString() : "—";
    const mute = muted() ? " · 🔕" : "";
    if (el.dot) el.dot.className = source === "api" ? "bg" : source === "pagina" ? "page" : source === "compartido" ? "page" : "stale";
    if (source === "api") setSummary(`Vigilando (directo) · ${list.length} cita(s) · act. ${hora} · ${pymTxt}${mute}`);
    else if (source === "pagina") setSummary(`En Citas del día · ${list.length} cita(s) · act. ${hora} · ${pymTxt}${mute}`);
    else if (source === "compartido") setSummary(`Espejo · ${list.length} cita(s) · act. ${hora} · ${pymTxt}${mute}`);
    else if (list.length) setSummary(`Última lectura ${hora} · vuelve a "Citas del día" para refrescar · ${pymTxt}${mute}`, "warn");
    else setSummary(`Esperando "Citas del día"… · ${pymTxt}`);
    el.root.classList.toggle("stale", !source && list.length > 0);
    renderStats(list);
    paintMute();

    const vista = list.filter((a) => matchesFilter(a) && matchesSearch(a));
    // La firma YA NO incluye los minutos transcurridos. Antes sí, y como esos minutos
    // cambian a la vez para todas las citas, la lista entera se reconstruía cada minuto
    // (721 veces por jornada) devolviendo el desplazamiento al principio en plena lectura.
    // Ahora la cuenta regresiva se refresca en el sitio, sin recrear las tarjetas.
    const sig = (source || "C") + "|" + state.filtro + "|" + state.busqueda + "|" + signatureOf(vista);
    if (sig === state.lastSignature) { refrescarCuentas(vista); return; }
    state.lastSignature = sig;
    if (!list.length) { el.list.innerHTML = `<div id="vgl-empty">Aún sin citas.<br>Entra una vez a "Citas del día" para leer la agenda.</div>`; return; }
    if (!vista.length) { el.list.innerHTML = `<div id="vgl-empty">Ninguna cita coincide con el filtro.<br><span style="opacity:.7">${escapeHtml(list.length + " cita(s) ocultas")}</span></div>`; return; }
    el.list.innerHTML = "";
    for (const a of vista) {
      const col = COLORS[a.color] || COLORS.AZUL, tint = TINT[a.color] || TINT.AZUL;
      const card = document.createElement("div");
      // v7.4: refuerzo de tarjeta completa para ROJO/MORADO/AMBAR (antes solo ROJO tenía
      // clase propia). Verde/azul se quedan sin tinte: son estados resueltos/informativos.
      const colorCls = (a.color === "ROJO" || a.color === "MORADO" || a.color === "AMBAR") ? " " + a.color.toLowerCase() : "";
      const esPes = tieneAbandonoPES(a);
      card.className = "vgl-card" + colorCls + (a.color === "ROJO" ? " rojo" : "") + (esPes ? " pes" : "") + (state.busqueda && matchesSearch(a) ? " hit" : "");
      // Tres lecturas distintas y honestas: tiene pendientes / está al día / NO cruza
      // con la base (paciente nuevo o cédula que no coincide — eso hay que verlo).
      const enBase = !state.pymTodos || !state.pymTodos.size || state.pymTodos.has(normalizeKey(a.doc_id));
      // v7.8: sin base cargada NO se dice "Al día" (era mentira piadosa): se dice la verdad.
      const pyms = a.pym.length
        ? `<div class="vgl-pyms">${a.pym.map((p) => `<span class="vgl-chip">${escapeHtml(p)}</span>`).join("")}</div>`
        : (!state.pymFile ? `<div class="vgl-none falta">PyM sin cargar</div>`
          : enBase ? `<div class="vgl-none">Al día · sin PyM pendiente</div>`
                   : `<div class="vgl-none falta">Dato faltante: sin registro en PyM</div>`);
      // Bandera de fraude EXPLÍCITA en texto (no solo color): así no depende de memorizar
      // el código de color, y sigue diciendo "fraude" aunque el estado cambie más tarde.
      const flag = a.color === "ROJO" ? `<span class="vgl-flag">⛔ FRAUDE</span>` : "";
      // v7.8.1: bandera de abandono PES, en texto — igual de explícita que la de fraude,
      // convive con ella si un paciente cayera en ambas categorías a la vez.
      const pesFlag = esPes ? `<span class="vgl-flag pes">❤ ABANDONO PES</span>` : "";
      card.innerHTML = `
        <div class="vgl-row">
          <span class="vgl-cdot" style="background:${col}"></span>
          <span class="vgl-time">${escapeHtml(a.hora_texto)}</span>
          <span class="vgl-name" title="${escapeHtml(a.nombre)}"><b>${highlight(a.nombre)}</b>${a.doc_id ? ` <span class="vgl-doc">${highlight(String(a.doc_id))}</span>` : ""}</span>
          ${countdown(a)}
          ${flag}${pesFlag}
          <span class="vgl-badge" style="background:${tint}">${escapeHtml(a.estado)}</span>
        </div>${pyms}`;
      card.__vglKey = a.key;
      el.list.appendChild(card);
    }
  }
  // Refresca SOLO el texto de la cuenta regresiva de cada tarjeta ya pintada. Cuesta unos
  // pocos microsegundos frente a recrear la lista entera.
  function refrescarCuentas(vista) {
    try {
      const cards = el.list ? el.list.children : null;
      if (!cards || cards.length !== vista.length) return;
      for (let i = 0; i < vista.length; i++) {
        const card = cards[i], a = vista[i];
        if (!card || card.__vglKey !== a.key) return;      // el orden cambió: lo hará el repintado normal
        const cd = card.querySelector(".vgl-cd"), html = countdown(a);
        if (!html) { if (cd) cd.remove(); continue; }
        const m = /class="vgl-cd([^"]*)"[^>]*title="([^"]*)"[^>]*>([^<]*)</.exec(html);
        if (!m) continue;
        if (cd) { cd.className = "vgl-cd" + m[1]; cd.title = m[2]; cd.textContent = m[3]; }
        else { const badge = card.querySelector(".vgl-badge"); if (badge) badge.insertAdjacentHTML("beforebegin", html); }
      }
    } catch (e) {}
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // Saludo AZUL: UNA sola vez al día en todo el navegador (antes salía en cada pestaña/recarga).
  // v7.3.3: si el Vigilante arranca TARDE (turno ya empezado), NO se dispara ningún aviso
  // de lo que ya pasó: sale este ÚNICO resumen de lo corrido y desde ahí solo se avisa
  // lo que ocurra en vivo (la siembra silenciosa de maybeNotify garantiza lo segundo).
  function helloOncePerDay(list) {
    try { if (localStorage.getItem("vgl_hello") === todayStamp()) return; localStorage.setItem("vgl_hello", todayStamp()); } catch (e) {}
    let atend = 0, sala = 0, pend = 0, vencidas = 0;
    for (const a of list) {
      const s = (a.estado || "").toLowerCase();
      if (s.includes("atendido")) atend++;
      else if (s.includes("en sala")) sala++;
      else if (s.includes("sin presentarse")) { pend++; if (a.color === "AMBAR") vencidas++; }
    }
    notify("AZUL", "ℹ Vigilante activo — resumen de lo corrido",
      `${list.length} cita(s): ${atend} atendida(s) · ${sala} en sala · ${pend} sin presentarse` +
      (vencidas ? ` (${vencidas} ya pasada(s) de tolerancia)` : "") +
      `.\nDe lo anterior no aviso nada más; desde ahora, solo lo que pase en vivo.`, false);
  }
  function tick() {
    try {
      const leader = heartbeat();
      diaNuevo();                                    // reinicio limpio si el turno cruzó la medianoche
      // v7.8.1: fuera de agenda del día / historia clínica, NO se vigila — ni lectura
      // de DOM, ni sondeo del API, ni panel abierto. Se recoge sola a la pastilla
      // flotante (el "×" real del usuario NO se toca: autoDocked distingue uno de otro)
      // y se restaura sola al volver a una de las dos vistas permitidas. heartbeat() y
      // diaNuevo() SIEMPRE corren primero (baratos, importantes: continuidad del
      // liderazgo entre pestañas y limpieza de medianoche aunque el médico esté en
      // otra pantalla en ese instante).
      if (seccionActiva() === "otra") {
        if (el.root && winState !== "dock") { state.autoDocked = true; setWinState("dock", true); }
        return;
      }
      // Al volver a una sección permitida, se restaura la ÚLTIMA ventana que el médico
      // eligió de verdad (state.userWinState) — no siempre "full": si la había dejado
      // minimizada, sigue minimizada; si la había cerrado a mano, ver más abajo.
      if (state.autoDocked) { state.autoDocked = false; setWinState(state.userWinState, true); }
      const now = new Date();
      // v7.3 MODO LIGERO: primero el API (unos kB por consulta, con la sesión ya
      // abierta: funciona aunque la pestaña esté en una historia clínica) y, como
      // respaldo, la página que el usuario tiene delante. SIN clon de fondo.
      let data = null, source = null;
      if (leader && apiSano() && state.apiCitas && Date.now() - (state.apiEn || 0) < 180000) {
        data = { visible: true, citas: state.apiCitas }; source = "api";
      }
      if (!data || !data.citas.length) {
        const dPag = extractAgenda(document);
        if (dPag.visible && dPag.citas.length) { data = dPag; source = "pagina"; }
      }
      if (data && data.citas.length) {
        const processed = data.citas.map((a) => colorAndAlert(a, now));
        if (!state.summarized) {
          // Estado inicial: se SIEMBRA sin notificar (no-inferencia v2.5: solo eventos EN DIRECTO).
          state.summarized = true;
          processed.forEach((a) => state.notified.set(a.key, nkey(a)));
          if (leader) helloOncePerDay(processed);
        } else if (leader) {
          processed.forEach(maybeNotify);
        }
        state.lastSnapshot = { at: now, list: processed, source };
        if (leader) share(processed);
        render(processed, source, now);
      } else if (state.shared && Date.now() - state.shared.t < 60000) {
        render(state.shared.list, "compartido", new Date(state.shared.t));
      } else if (state.lastSnapshot) { render(state.lastSnapshot.list, null, state.lastSnapshot.at); }
      else { render([], null, null); }
      // Vía directa, SIEMPRE al final (haya datos o no): si aún no se aprendió la
      // llamada se busca en el registro de rendimiento; si ya se aprendió, se sondea.
      if (leader) {
        if (!API.url) apiSniffPerf(window);
        tickApi();
        checkRecordatorioPym();
        checkAbandonoPES();
      }
    } catch (e) { console.error("[Vigilante] tick:", e); }
  }

  function downloadDiagnostic() {
    const ddoc = document; const KEEP = new Set(["class", "role", "routerlink", "type", "name"]); const out = [];
    const sels = [".labelHora", ".status-label", ".card", ".card-body", ".text-muted", ".text-uppercase", ".fw-bold.mb-0", ".fecha", ".text-uppercase.fw-bold"];
    const counts = {}; sels.forEach((s) => { try { counts[s] = ddoc.querySelectorAll(s).length; } catch (e) { counts[s] = "err"; } });
    const freq = {}; ddoc.querySelectorAll("*").forEach((n) => (n.classList ? [...n.classList] : []).forEach((c) => (freq[c] = (freq[c] || 0) + 1)));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 120);
    const san = (node) => { const c = node.cloneNode(true); const w = (x) => { if (x.nodeType === 3) { if (x.textContent && x.textContent.trim()) x.textContent = "···"; return; } if (x.nodeType !== 1) return; [...(x.attributes || [])].forEach((a) => { if (!KEEP.has(a.name) && !a.name.startsWith("data-")) x.removeAttribute(a.name); else if (a.name.startsWith("data-")) x.setAttribute(a.name, ""); }); [...x.childNodes].forEach(w); }; w(c); return c.outerHTML; };
    let card = ""; try { const h = ddoc.querySelector(".labelHora"); const c = h && containerOf(h); card = c ? san(c).slice(0, 15000) : "(no se encontró .labelHora)"; } catch (e) { card = "err: " + e; }
    out.push("===== DIAGNÓSTICO — VIGILANTE v" + VERSION + " =====", "Fecha: " + new Date().toISOString(), "URL: " + location.href, "Título: " + document.title,
      "\n--- CONTEO DE SELECTORES ---", JSON.stringify(counts, null, 2),
      "\n--- CLASES MÁS FRECUENTES (top 120) ---", top.map(([c, n]) => n + "  ." + c).join("\n"),
      "\n--- PRIMERA TARJETA (HTML sanitizado) ---", card,
      "\n--- NOTIFICACIONES ---",
      "Soporte Notification: " + (typeof Notification !== "undefined"),
      "Permiso actual: " + (typeof Notification !== "undefined" ? Notification.permission : "n/a"),
      "Visibilidad de la pestaña: " + document.visibilityState,
      "Silenciado: " + (muted() ? "sí" : "no"),
      "\n--- AJUSTES ACTIVOS ---", JSON.stringify(S, null, 2),
      "\n--- CONTADORES (últimos 7 días) ---", JSON.stringify(lastDays(7), null, 2),
      "\n--- PyM ---", "Archivo: " + (state.pymFile || "sin cargar"), "Pacientes con pendientes: " + state.pym.size,
      "Documentos totales en la hoja: " + (state.pymTodos ? state.pymTodos.size : "n/a"),
      "Base automática activa: " + (S.baseAuto ? "sí" : "no") + " · id: " + ((CONFIG.SP.respaldo && CONFIG.SP.respaldo.id) || "n/a"),
      "\n--- CRUCE PyM ↔ AGENDA (v7.3.3) ---", (function () {
        try {
          const mask = (s) => { s = String(s == null ? "" : s); return s ? s.slice(0, 3) + "…(" + s.length + " díg.)" : "(vacío)"; };
          const out = ["Hoja elegida: " + (state.pymHoja || "n/a")];
          const keys = []; for (const k of state.pym.keys()) { keys.push(k); if (keys.length >= 8) break; }
          out.push("Muestra de claves de la base: " + (keys.map(mask).join(" · ") || "(ninguna)"));
          const dist = {}; let n = 0;
          for (const k of state.pym.keys()) { dist[k.length] = (dist[k.length] || 0) + 1; if (++n >= 40000) break; }
          out.push("Longitudes de clave en la base {dígitos: cuántas}: " + JSON.stringify(dist));
          const lst = (state.lastSnapshot && state.lastSnapshot.list) || [];
          let hit = 0;
          const det = lst.map((a) => { const k = normalizeKey(a.doc_id); const ok = state.pym.has(k); if (ok) hit++; return mask(k) + (ok ? "✓" : "✗"); });
          out.push("Citas de hoy (" + lst.length + "): " + (det.join(" · ") || "(sin lectura)"));
          out.push("COINCIDEN: " + hit + "/" + lst.length + (hit ? "" : "  ← si es 0, la columna que la hoja usa como documento NO es la cédula, o el formato no cruza"));
          return out.join("\n");
        } catch (e) { return "err: " + e; }
      })(),
      "\n--- LECTURA DIRECTA DEL API ---",
      "Llamada aprendida: " + (API.url ? "SÍ" : "todavía no"),
      "Lecturas correctas: " + API.ok + " · fallos seguidos: " + API.fallos + " · última respuesta: " + (API.ms || 0) + " ms",
      "Campos detectados: " + (API.campos ? JSON.stringify(API.campos) : "ninguno aún"));
    const blob = new Blob([out.join("\n")], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "diagnostico_vigilante_SANITIZADO.txt"; document.body.appendChild(a); a.click(); a.remove();
    setSummary("Diagnóstico descargado (solo local, sin datos de pacientes). Revisa Descargas.");
  }


  // Recordatorio: si a la hora configurada todavía no hay PyM cargado, avisa (una vez al día).
  function pymReminderCheck() {
    try {
      if (!state.leader || !S.recordatorio || state.pymFile) return;
      const parts = String(S.recordatorio).split(":"), h = parseInt(parts[0], 10), m = parseInt(parts[1] || "0", 10);
      if (!isFinite(h)) return;
      const now = new Date();
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + (isFinite(m) ? m : 0)) return;
      if (localStorage.getItem("vgl_rem") === todayStamp()) return;
      localStorage.setItem("vgl_rem", todayStamp());
      notify("AMBAR", "📋 Falta el PyM de hoy", "Todavía no se ha cargado el archivo de actividades PyM.\nPulsa «Abrir PyM» en el panel del Vigilante y elige el archivo del día.", false, "rem|" + todayStamp());
      playTone("AMBAR");
    } catch (e) {}
  }

  // v7.4.1: avisa UNA vez cuando Tampermonkey acaba de instalar una versión nueva del
  // Gist — así el personal sabe que el auto-update funcionó de verdad, sin tener que
  // fijarse en el numerito de versión del panel. Compara contra la última versión que
  // ESTE equipo vio arrancar; si cambió, es que se acaba de actualizar. La primera vez
  // que se instala el script (no hay versión anterior guardada) NO avisa — para eso ya
  // está el saludo "Vigilante activo" que sale una vez al día.
  function avisarSiActualizado() {
    try {
      const anterior = GM_getValue("vgl_last_ver", "");
      const cambio = anterior !== VERSION;
      if (anterior && cambio) {
        notify("AZUL", "✅ Vigilante actualizado", `Ya tienes la última versión (v${VERSION}).`, false, "verupd|" + VERSION);
      }
      if (cambio) {
        GM_setValue("vgl_last_ver", VERSION);
        GM_setValue("vgl_ver_desde", todayStamp()); // reinicia el contador de "desde cuándo" cada vez que SÍ hay una actualización real
      }
    } catch (e) {}
  }
  // v7.5: recordatorio (NO alarma) si pasa MUCHO tiempo sin ver una versión nueva — es
  // una pista de que el auto-update pudo quedar roto (Gist borrado, URL cambiada,
  // permiso de Tampermonkey revocado), pero perfectamente normal si nada cambió. Avisa
  // como máximo 1 vez al mes para no fastidiar.
  function chequearAutoUpdateLento() {
    try {
      const hoy = todayStamp();
      if (!GM_getValue("vgl_ver_desde", "")) { GM_setValue("vgl_ver_desde", hoy); return; }
      const desde = GM_getValue("vgl_ver_desde", hoy);
      const dias = Math.floor((new Date(hoy) - new Date(desde)) / 86400000);
      if (dias < 60) return;
      const ultimoAviso = GM_getValue("vgl_ver_aviso", "");
      if (ultimoAviso && Math.floor((new Date(hoy) - new Date(ultimoAviso)) / 86400000) < 30) return;
      GM_setValue("vgl_ver_aviso", hoy);
      notify("AZUL", "🔄 Recordatorio de actualización",
        `Llevas ${dias} días en la v${VERSION} sin ver una versión nueva.\nSi esperabas una y no llegó, revisa Tampermonkey → Panel de control → menú → «Check for userscript updates».`,
        false, "verold|" + hoy);
    } catch (e) {}
  }

  // v7.8.1: chequea versión mínima requerida contra Google Apps Script público
  // Si la versión actual es menor y NO hay historia clínica abierta, fuerza reload + limpia caché
  function checkVersionMinimum() {
    try {
      if (Date.now() - (state.lastVersionCheck || 0) < 300000) return; // chequea max 1 vez cada 5 min
      state.lastVersionCheck = Date.now();

      if (!state.versionCheckUrl || state.versionCheckUrl.includes("YOUR_DEPLOYMENT_ID")) return;

      GM_xmlhttpRequest({
        method: "GET",
        url: state.versionCheckUrl,
        timeout: 5000,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            const minVer = String(data.minVersion || "").trim();
            if (!minVer) return;

            // Comparar versiones: "7.8.1" vs "7.8.0" — parsea como [major, minor, patch]
            const parse = (v) => String(v).split(".").map(x => parseInt(x, 10) || 0);
            const [maj, min, pat] = parse(VERSION);
            const [minMaj, minMin, minPat] = parse(minVer);

            const needsUpdate = (minMaj > maj) || (minMaj === maj && minMin > min) ||
                                (minMaj === maj && minMin === min && minPat > pat);
            const forceReload = data.force === true;

            if (needsUpdate || forceReload) {
              // v7.8.1: SOLO reload si NO hay historia clínica abierta (evita pérdida de datos)
              if (seccionActiva() === "historia") {
                setSummary(`📦 Actualización v${minVer} disponible — se aplicará cuando cierres la historia clínica`, "info");
                return;
              }
              localStorage.clear();
              setSummary(`🔄 Vigilante se actualiza a v${minVer}...`, "info");
              setTimeout(() => location.reload(true), 2000);
            }
          } catch (e) { console.error("[Vigilante] version check parse:", e); }
        },
        onerror: () => { /* silencio si falla */ }
      });
    } catch (e) { console.error("[Vigilante] checkVersionMinimum:", e); }
  }

  function boot() {
    if (document.getElementById("vgl-root")) return;
    purgeEventDays();                 // limpia bitácoras de más de 30 días (una sola vez)
    buildOverlay();
    applySettings();   // aplica tus ajustes guardados (tolerancia, refresco, tema, sonido…) y arranca el reloj
    avisarSiActualizado();
    setTimeout(chequearAutoUpdateLento, 6000);
    heartbeat();
    tick();
    checkVersionMinimum();            // v7.8.1: chequea versión mínima cada 5 min
    setInterval(checkVersionMinimum, 300000); // repite cada 5 minutos
    setInterval(paintMute, 15000);
    setInterval(pymReminderCheck, 60000);
    // Reporte mínimo al tablero: el resumen de AYER (una vez) y el reintento de la
    // cola cada 10 min (sale de inmediato si no hay nada pendiente).
    setTimeout(repDailySummary, 8000);
    setInterval(repFlush, 600000);
    // PyM del día (v7.7): primero la caché de hoy. Si no hay, se intenta el PyM REAL
    // de hoy en SharePoint (primera opción); si aún no aparece, cae a la base piloto
    // mientras tanto (sus propios 3 reintentos espaciados). Pase lo que pase, sigue
    // revisando el diario cada 10 min — así en cuanto lo suban, reemplaza SOLO lo que
    // hubiera cargado (incluida la base piloto). «Abrir PyM» siempre puede reemplazar.
    // v7.8: DIFERIDO a un momento libre del navegador (requestIdleCallback) — la página
    // de Everest termina de cargar primero; el PyM se materializa por tandas después.
    idleRun(async () => {
      if (await loadPymFromCache()) return;
      if (heartbeat()) { const ok = await loadPymDiario(true).catch(() => false); if (!ok) schedulePymBase(); }
      else schedulePymBase();
    }, 4000);
    // v7.8.1: SIEMPRE se vuelve a listar la carpeta (una consulta de ~60 filas, unos KB —
    // barato) aunque el PyM real de hoy ya esté cargado. Antes ("v7.7.1: deja de revisar")
    // el chequeo se APAGABA por completo en cuanto cargaba el de hoy — así que una
    // corrección subida a mediodía con el MISMO nombre (mtime nuevo), o un archivo
    // equivocado cargado a mano con «Abrir PyM», quedaban pegados el resto del turno SIN
    // ninguna forma de corregirse solos (hallazgo de la auditoría adversarial). La huella
    // nombre+fecha-de-modificación (pymFP, dentro de loadPymDiario) sigue siendo la que
    // decide si hace falta VOLVER A DESCARGAR — solo cambia que ahora sí se vuelve a mirar.
    setInterval(() => {
      if (!heartbeat()) return;
      loadPymDiario(true);
      // v7.8.1: si después de todo esto sigue sin haber NADA cargado (ni PyM de hoy ni
      // piloto — p. ej. los 3 intentos del arranque se agotaron por una falla pasajera de
      // red a las 6 a.m.), se reintenta la piloto aquí. Sin esto, la promesa de "si no
      // está el de hoy, usa la piloto mientras tanto" solo regía los primeros ~4 minutos
      // de vida de la pestaña (hallazgo de la auditoría adversarial).
      if (!state.pymFile) loadPymBase(true);
      // Revisión de frescura de la PILOTO (máx. 1 vez por franja mañana/tarde; se
      // autolimita adentro, así que colgarla de este mismo intervalo no cuesta nada).
      pilotoFreshCheck();
    }, 10 * 60 * 1000);
    // Enganche del captador: si la base se capturó en la pestaña de SharePoint DESPUÉS
    // de arrancar Everest, se toma sola. Solo mira mientras no haya nada cargado; en
    // cuanto hay PyM, esta revisión no cuesta nada (sale de una).
    // v7.8: además, si aquí quedó la base PILOTO pero el captador ya consiguió el PyM
    // REAL de hoy, se adopta el real desde la caché compartida — sin depender de que la
    // descarga directa desde Everest (que pudo ser justo la que falló) lo reintente.
    setInterval(() => {
      try {
        if (!state.pymFile) { loadPymFromCache(); return; }
        if (state.pymFallback && typeof GM_getValue !== "undefined" &&
            GM_getValue("vgl_pym_dia", "") === todayStamp() && GM_getValue("vgl_pym_esfallback", "1") === "") {
          const raw = GM_getValue("vgl_pym", "");
          if (raw && raw.lastIndexOf('{"v":3', 0) === 0) {
            unpackPym(raw, makeYielder(15)).then((u) => {
              if (u && u.meta.date === todayStamp() && !u.meta.fb && state.pymFallback) {
                state.pym = u.map; state.pymTodos = u.todos; state.pymAbandono = u.abandono || new Set(); state.pymMTime = u.meta.mtime || ""; state.pymFP = u.meta.fp || ""; state.pymFallback = false;
                afterPymLoaded((u.meta.name || "PyM") + " (auto)");
                notify("AZUL", "📋 Ya llegó el PyM real de hoy", (u.meta.name || "PyM") + "\n" + state.pym.size + " paciente(s). Se reemplazó la base piloto.", false, "pymreal|" + todayStamp());
              }
            }).catch(() => {});
          }
        }
      } catch (e) {}
    }, 60000);
    console.log("[Vigilante] userscript v" + VERSION + " activo (MODO LIGERO: lectura de la página + PyM manual).");
  }

  // v7.3 MODO LIGERO: sin ganchos de red (no se envuelve fetch/XHR ni se clona
  // ninguna respuesta) y sin cosechador de SharePoint. Para la vía directa del API
  // solo se usa el OBSERVADOR DE RENDIMIENTO del propio navegador: una lista de URLs
  // que el navegador ya lleva de todos modos; costo prácticamente cero.
  if (/sharepoint\.com$/i.test(location.hostname)) {
    // En SharePoint SOLO corre el captador ligero de la base (y solo si falta la de hoy).
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { bootSharepointLite(); });
    else bootSharepointLite();
    return;
  }
  apiObservar(window); // document-start: aprende la llamada de la agenda en cuanto Everest la haga
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();