// =====================================================================
//  DIAGNÓSTICO DE IDENTIDAD DEL MÉDICO EN SESIÓN — v1 (2026-08-10)
//
//  Para qué: descubrir DÓNDE publica Everest la identidad del usuario
//  que inició sesión (login / id / nombre), para que el Vigilante pueda
//  identificar a CUALQUIER médico y no solo al autor.
//
//  Cómo usarlo:
//   1. Iniciar sesión en Everest: https://neps.everestintelligent.com/viva/HCHealth/
//      (sirve cualquier módulo; ideal ejecutarlo también en /viva/Acceso/)
//   2. F12 -> pestaña Consola -> pegar TODO este archivo -> Enter.
//   3. El informe queda impreso y copiado al portapapeles (si el navegador
//      lo permite). Pegar el resultado completo de vuelta en el chat.
//
//  Es de SOLO LECTURA: no modifica nada. Hace una única petición GET de
//  validación (GetUsuarioPerfil) si encuentra candidatos a login.
//  Los tokens se muestran RECORTADOS y de los JWT solo se decodifican los
//  campos de identidad (nunca la firma).
// =====================================================================
(async function () {
  const out = [];
  const w = (s) => out.push(s);
  const corto = (v, n) => { const s = String(v); return s.length > (n || 90) ? s.slice(0, n || 90) + "…(" + s.length + " chars)" : s; };
  const RE_IDENT = /usuario|login|medico|profesional|user|sesion|session|perfil|auth|token|account|iden/i;

  w("======= DIAGNÓSTICO IDENTIDAD MÉDICO · " + location.href + " =======");
  w("fecha: " + new Date().toISOString());

  // ---------- 0. Contexto: Vigilante e iframes ----------
  w("\n--- 0. CONTEXTO ---");
  try {
    w("origin: " + location.origin);
    w("iframes: " + document.querySelectorAll("iframe").length);
    document.querySelectorAll("iframe").forEach((f, i) => w("   iframe[" + i + "].src = " + corto(f.src || "(sin src)", 100)));
    w("Vigilante PerformanceObserver (__vglPO): " + (window.__vglPO ? "activo" : "(no presente en este contexto)"));
    try { w("vgl_cfg: " + corto(localStorage.getItem("vgl_cfg") || "(no existe)", 300)); } catch (e) {}
    try { w("vgl_api_url: " + corto(localStorage.getItem("vgl_api_url") || "(no existe)", 200)); } catch (e) {}
  } catch (e) { w("ERROR contexto: " + e.message); }

  // ---------- 1. Globales de window ----------
  w("\n--- 1. GLOBALES DE WINDOW (nombre coincide con identidad) ---");
  try {
    const props = Object.getOwnPropertyNames(window).filter((k) => RE_IDENT.test(k));
    if (!props.length) w("(ninguna propiedad propia de window coincide)");
    for (const k of props) {
      try {
        const v = window[k];
        const t = typeof v;
        if (t === "function") { w(k + " : function"); continue; }
        if (v && t === "object") {
          let keys = [];
          try { keys = Object.keys(v).slice(0, 25); } catch (e) {}
          w(k + " : object { " + keys.join(", ") + " }");
          // Si el objeto tiene campos de identidad, mostrarlos
          for (const kk of keys) {
            if (RE_IDENT.test(kk) || /^id$|nombre|name|codigo/i.test(kk)) {
              try { const vv = v[kk]; if (vv != null && typeof vv !== "object" && typeof vv !== "function") w("   · " + k + "." + kk + " = " + corto(vv)); } catch (e) {}
            }
          }
        } else {
          w(k + " : " + t + " = " + corto(v));
        }
      } catch (e) { w(k + " : (ilegible: " + e.message + ")"); }
    }
    // Candidatos concretos que el Vigilante ya sabe leer
    for (const k of ["UsuarioId", "UsuarioLogin", "UsuarioNombreCompleto"]) {
      w("window." + k + " = " + (window[k] === undefined ? "(no existe)" : corto(window[k])));
    }
  } catch (e) { w("ERROR globales: " + e.message); }

  // ---------- 2. localStorage y sessionStorage ----------
  const volcarStorage = (nombre, st) => {
    w("\n--- 2. " + nombre + " (" + st.length + " claves) ---");
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i);
      let v = "";
      try { v = st.getItem(k) || ""; } catch (e) { w(k + " : (ilegible)"); continue; }
      // ¿JWT? (tres segmentos base64url) -> decodificar SOLO el payload, sin firma
      const jwt = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(v.trim())
        ? v.trim() : (v.includes('"') && /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\./.test(v) ? (v.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) || [null])[0] : null);
      if (jwt) {
        try {
          const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          const claves = Object.keys(payload);
          w(k + " : JWT · claims = [" + claves.join(", ") + "]");
          for (const c of claves) {
            if (/sub|name|unique|preferred|upn|email|login|usuario|user|^id$|codigo|perfil|role|medic|exp/i.test(c)) {
              w("   · " + c + " = " + corto(payload[c], 70));
            }
          }
        } catch (e) { w(k + " : JWT (payload no decodificable)"); }
        continue;
      }
      // ¿JSON? -> mostrar claves y solo los valores de identidad
      if (/^[[{]/.test(v.trim())) {
        try {
          const o = JSON.parse(v);
          const claves = Object.keys(o).slice(0, 30);
          w(k + " : JSON { " + claves.join(", ") + " }");
          for (const kk of claves) {
            const vv = o[kk];
            if ((RE_IDENT.test(kk) || /^id$|nombre|name|codigo|documento/i.test(kk)) && vv != null && typeof vv !== "object") {
              w("   · " + kk + " = " + corto(vv, 70));
            }
          }
        } catch (e) { w(k + " : (parece JSON, no parsea) " + corto(v, 60)); }
        continue;
      }
      w(k + " = " + corto(v, 80));
    }
    if (!st.length) w("(vacío)");
  };
  try { volcarStorage("localStorage", localStorage); } catch (e) { w("ERROR localStorage: " + e.message); }
  try { volcarStorage("sessionStorage", sessionStorage); } catch (e) { w("ERROR sessionStorage: " + e.message); }

  // ---------- 3. Cookies (solo nombres; valores JWT decodificados) ----------
  w("\n--- 3. COOKIES ---");
  try {
    const cks = document.cookie ? document.cookie.split(/;\s*/) : [];
    if (!cks.length) w("(sin cookies legibles desde JS — puede haber HttpOnly)");
    for (const c of cks) {
      const eq = c.indexOf("=");
      const nombre = eq >= 0 ? c.slice(0, eq) : c;
      const val = eq >= 0 ? c.slice(eq + 1) : "";
      if (/^eyJ/.test(val) && val.split(".").length === 3) {
        try {
          const p = JSON.parse(atob(val.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          w(nombre + " : JWT · " + JSON.stringify(Object.keys(p)));
        } catch (e) { w(nombre + " : JWT (no decodificable)"); }
      } else {
        w(nombre + " = " + corto(val, 40));
      }
    }
  } catch (e) { w("ERROR cookies: " + e.message); }

  // ---------- 4. Registro de red (performance) ----------
  w("\n--- 4. LLAMADAS /apiviva/ VISTAS EN ESTA PÁGINA ---");
  try {
    const entradas = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => /\/apiviva\//i.test(u));
    w("total /apiviva/: " + entradas.length + " (búfer de performance: " + performance.getEntriesByType("resource").length + ")");
    const interesantes = entradas.filter((u) => /GetUsuarioPerfil|UsuarioId=|Login|Usuario|Perfil|Sesion/i.test(u));
    w("con pinta de identidad (" + interesantes.length + "):");
    [...new Set(interesantes)].slice(0, 25).forEach((u) => w("   " + u));
    w("primeras 12 del módulo (las que dispara al cargar):");
    [...new Set(entradas)].slice(0, 12).forEach((u) => w("   " + u));
  } catch (e) { w("ERROR performance: " + e.message); }

  // ---------- 5. La interfaz: dónde pinta Everest el nombre del usuario ----------
  w("\n--- 5. NOMBRE DEL USUARIO EN LA INTERFAZ ---");
  try {
    w("document.title = " + corto(document.title, 80));
    const els = document.querySelectorAll('[class*="user" i],[class*="usuario" i],[id*="user" i],[id*="usuario" i],[class*="perfil" i],[id*="perfil" i],[class*="sesion" i],header,nav');
    const vistos = new Set();
    let n = 0;
    for (const el of els) {
      const txt = (el.innerText || "").trim().replace(/\s+/g, " ");
      if (txt && txt.length >= 5 && txt.length <= 120 && !vistos.has(txt)) {
        vistos.add(txt);
        w("   <" + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : "") + "> " + corto(txt, 100));
        if (++n >= 12) break;
      }
    }
    if (!n) w("(ningún elemento candidato con texto)");
  } catch (e) { w("ERROR DOM: " + e.message); }

  // ---------- 6. Framework de la SPA ----------
  w("\n--- 6. FRAMEWORK ---");
  try {
    w("angularJS: " + (window.angular ? window.angular.version && window.angular.version.full : "(no)"));
    const ngv = document.querySelector("[ng-version]");
    w("angular moderno: " + (ngv ? ngv.getAttribute("ng-version") : "(no)"));
    w("react: " + (window.React || document.querySelector("[data-reactroot]") ? "sí" : "(no)"));
    w("jQuery: " + (window.jQuery ? window.jQuery.fn.jquery : "(no)"));
  } catch (e) { w("ERROR framework: " + e.message); }

  // ---------- 7. Validación: GetUsuarioPerfil con los candidatos hallados ----------
  w("\n--- 7. VALIDACIÓN GetUsuarioPerfil ---");
  try {
    const candidatos = new Set();
    // de globales
    if (window.UsuarioLogin) candidatos.add(String(window.UsuarioLogin).trim());
    // de storage: cualquier valor corto de clave con "login"/"user"
    for (const st of [localStorage, sessionStorage]) {
      for (let i = 0; i < st.length; i++) {
        const k = st.key(i);
        if (/login|username|usuario/i.test(k)) {
          const v = (st.getItem(k) || "").trim();
          if (v && v.length <= 40 && !/\s/.test(v) && !v.includes("{")) candidatos.add(v.replace(/^"|"$/g, ""));
        }
      }
    }
    // de JWT en storage: claims típicos
    for (const st of [localStorage, sessionStorage]) {
      for (let i = 0; i < st.length; i++) {
        const v = st.getItem(st.key(i)) || "";
        const m = v.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
        if (m) {
          try {
            const p = JSON.parse(atob(m[0].split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
            for (const c of ["unique_name", "preferred_username", "sub", "upn", "login", "usuario", "UserName", "userName"]) {
              const vv = p[c];
              if (vv && typeof vv === "string" && vv.length <= 40 && !/\s/.test(vv)) candidatos.add(vv);
            }
          } catch (e) {}
        }
      }
    }
    // También del registro de red: cualquier login= en /apiviva/ es el de la sesión
    try {
      performance.getEntriesByType("resource").forEach((e) => {
        const m = /\/apiviva\/[^?#]+\?[^#]*\blogin=([^&#]+)/i.exec(e.name || "");
        if (m && m[1]) candidatos.add(decodeURIComponent(m[1]));
      });
    } catch (e) {}
    w("candidatos a login: " + (candidatos.size ? [...candidatos].join(", ") : "(ninguno)"));
    // Si no se halló ninguno, se le pregunta al médico (él conoce su login de Everest)
    if (!candidatos.size) {
      try {
        const escrito = prompt("Diagnóstico Vigilante: escriba su LOGIN de Everest (el usuario con el que inicia sesión). Cancele si prefiere no probarlo.");
        if (escrito && escrito.trim()) candidatos.add(escrito.trim());
      } catch (e) {}
    }
    let probados = 0;
    for (const login of candidatos) {
      if (probados >= 3) break;
      probados++;
      try {
        const r = await fetch("/apiviva/APIAcceso/api/ParametrizacionLista/GetUsuarioPerfil/" + encodeURIComponent(login), { headers: { Accept: "application/json" } });
        if (!r.ok) { w("   GetUsuarioPerfil(" + login + ") -> HTTP " + r.status); continue; }
        const j = await r.json();
        const d = j && j.data;
        w("   GetUsuarioPerfil(" + login + ") -> " + (d ? "id=" + d.id + " · nombreCompleto=" + corto(d.nombreCompleto, 60) + " · perfilCodigo=" + d.perfilCodigo : "sin data: " + corto(JSON.stringify(j), 100)));
        // Confirmar también la ruta que la app usa con login= (vista en captura real)
        try {
          const r2 = await fetch("/apiviva/APIMedicoHealth/api/Medico/ObtenerEspecialidadMedico?login=" + encodeURIComponent(login), { headers: { Accept: "application/json" } });
          w("   ObtenerEspecialidadMedico(" + login + ") -> HTTP " + r2.status + (r2.ok ? " · " + corto(await r2.text(), 140) : ""));
        } catch (e) { w("   ObtenerEspecialidadMedico -> ERROR " + e.message); }
      } catch (e) { w("   " + login + " -> ERROR " + e.message); }
    }
    if (!candidatos.size) w("(sin candidatos: revisar secciones 1, 2 y 5 del informe)");
    w("NOTA: para confirmar qué llama Everest DURANTE el login: F12 -> Network -> 'Preserve log' -> cerrar sesión y volver a entrar -> filtrar por 'apiviva' -> exportar HAR.");
  } catch (e) { w("ERROR validación: " + e.message); }

  w("\n======= FIN DEL DIAGNÓSTICO =======");
  const informe = out.join("\n");
  console.log(informe);
  try { copy(informe); console.log("%c(informe copiado al portapapeles)", "color:#4a4"); } catch (e) { console.log("(seleccione y copie el texto de arriba)"); }
})();
