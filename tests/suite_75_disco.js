// =====================================================================
//  SUITE 75 — Memoria en el disco del médico (v18.0.136)
//
//  Cubre el módulo completo de historias en disco: el renderer .md puro
//  (vglDiscoHistoriaMarkdown), la carpeta persistente (FS Access API con
//  handle en IndexedDB), la cosecha blindada contra la cuota llena, el
//  rescate inmediato, la restauración al activar, la migración única, el
//  arranque con permisos y el banner de autorización (una vez por sesión).
//
//  Decisión delegada por el médico, probada aquí tal cual: carpeta POR
//  CÉDULA («Historias/{ced}/{ced} AAAA-MM-DD.md») y formato MARKDOWN.
// =====================================================================
"use strict";

module.exports = {
  nombre: "Memoria en disco del médico (Suite 75)",
  cubre: [
    "vglDiscoHistoriaMarkdown", "vglDiscoMemoriaProgramar",
    "vglDiscoHistoriaProgramar", "vglDiscoRescatarCosecha",
    "vglDiscoMigrar", "_vglCarpetaRecuperarCrudo", "_vglDiscoActivar",
    "_vglDiscoArranque", "_vglDiscoEscribirMdAhora",
    "_vglDiscoMemoriaRestaurar", "vglDiscoBannerPintar",
    "vglDiscoBannerQuitar", "_vglDiscoBannerAceptar",
    "_vglDiscoBannerRechazar", "_vglCosechaGuardar",
    "_vglCosechaLeer", "reportar", "repDailySummary",
  ],

  async pruebas(t, api, env, cargar) {
    const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

    // Instante congelado para los sellos: 5 de marzo de 2026, 10:15 local.
    const MS_FIJA = Date.parse("2026-03-05T10:15:00-05:00");
    const cajaD = new Date(MS_FIJA);
    const FECHA = "2026-03-05";
    const HORA = "10:15";
    const AYER = "2026-03-04";

    // Fecha congelada dentro del vm (patrón de la suite 11); caja.iso mutable.
    function congelarFecha(c, isoInicial) {
      const OriginalDate = c.ctx.Date || Date;
      const caja = { iso: isoInicial };
      const FakeDate = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) super(caja.iso);
          else super(...args);
        }
      };
      FakeDate.now = () => new OriginalDate(caja.iso).getTime();
      c.ctx.Date = FakeDate;
      return caja;
    }

    // Red simulada: registra cada GM_xmlhttpRequest y contesta según "modo".
    function crearRed() {
      const red = { posts: [], modo: "ok", status: 200, cuerpo: '{"ok":true}', finalUrl: "" };
      red.gmxhr = (o) => {
        red.posts.push(o);
        if (red.modo === "lanza") throw new Error("GM roto");
        if (red.modo === "error") { o.onerror && o.onerror(new Error("sin red")); return; }
        o.onload({ status: red.status, responseText: red.cuerpo, finalUrl: red.finalUrl });
      };
      red.cuerpos = () => red.posts.map((p) => JSON.parse(p.data));
      return red;
    }

    // ---------- Cuota del navegador y banner ----------
    // Hace que setItem(clave) lance QuotaExceededError (el resto sigue ok).
    function forzarCuota(c, clave) {
      const st = c.env.storage;
      const original = st.setItem.bind(st);
      st.setItem = (k, v) => {
        if (k === clave) {
          const e = new Error("cuota llena");
          e.name = "QuotaExceededError";
          throw e;
        }
        return original(k, v);
      };
    }
    // Banner visible = nodo con id "vgl-disco-banner" colgado del árbol.
    const bannerNodo = (c) =>
      c.env.doc._nodos.find((n) => n.id === "vgl-disco-banner" && n._parent) || null;
    const bannersVisibles = (c) =>
      c.env.doc._nodos.filter((n) => n.id === "vgl-disco-banner" && n._parent).length;
    // El DOM falso no define parentNode al colgar (solo _parent), y
    // vglDiscoBannerQuitar desengancha por parentNode: lo pegamos a mano tras
    // cada pintado para que quitar/repintar/rechazar desenganchen de verdad.
    const pegarPadres = (c) => {
      c.env.doc._nodos.forEach((n) => { if (n._parent) n.parentNode = n._parent; });
    };

    // ---------- Escenario base ----------
    // vm cargado sin gmxhr (así repOn() es falso y no hay ruido de red), reloj
    // congelado y FS simulado instalado SOBRE el contexto del vm tras cargar.
    function escenario(opciones) {
      const op = opciones || {};
      const c = cargar({
        silencioso: true,
        almacen: op.almacen,
        gmxhr: op.gmxhr,
      });
      const caja = congelarFecha(c, op.iso || "2026-03-05T10:15:00");
      const raiz = { tipo: "dir", nombre: "RAIZ", hijos: [], archivos: [] };
      const f = idbFake(op.conHandle ? { handles: { historias: op.conHandle } } : { handles: {} });
      if (!op.sinFS) {
        c.env.win.indexedDB = op.sinIndexedDB ? undefined : f;
        c.env.win.showDirectoryPicker = () => {
          throw new Error("showDirectoryPicker: no debía llamarse aquí");
        };
      }
      return { c, caja, raiz, f };
    }

    // Siembra Vigilante de Agenda/Memoria/vgl_cosecha.json con el envoltorio
    // real {v,ts,cosecha}. TODO vive DEBAJO de la subcarpeta raíz del script.
    function sembrarMemoria(raiz, cosecha, ts) {
      let vgl = raiz.hijos.find((x) => x.tipo === "dir" && x.nombre === "Vigilante de Agenda");
      if (!vgl) {
        vgl = { tipo: "dir", nombre: "Vigilante de Agenda", hijos: [], archivos: [] };
        raiz.hijos.push(vgl);
      }
      const mem = { tipo: "dir", nombre: "Memoria", hijos: [], archivos: [] };
      vgl.hijos.push(mem);
      sembrarArchivo(mem, "vgl_cosecha.json",
        JSON.stringify({ v: 1, ts: ts === undefined ? 1 : ts, cosecha }));
      return mem;
    }
    const dirMemoria = (raiz) => dirEn(raiz, ["Vigilante de Agenda", "Memoria"]);

    // ===================== BLOQUE A — renderer .md puro =====================
    // El renderer es puro: un solo vm compartido para todo el bloque.
    const escA = escenario({});
    const render = (docId, reg) => escA.c.api.vglDiscoHistoriaMarkdown(docId, reg);
    const api0 = (reg) => render("1093800", reg);
    const REG_COMPLETO = {
      ts: MS_FIJA,
      confirmaciones: {
        acepta: { v: true, ts: MS_FIJA },
        rechaza: { v: false, ts: MS_FIJA },
        sinFecha: { v: true },
        invalida: "texto",        // escalar: se excluye
        apagada: { v: "Sí" },     // v no booleana: se excluye
      },
      factores: {
        obj: { v: "Hipertensión", ts: MS_FIJA },
        objSinTs: { v: 42 },
        escalar: "EPOC",
        numero: 7,
        vacio: "",                // valor falso: fuera
      },
      hcEverest: { ts: MS_FIJA, dx: "DM2", vacio: "", otro: "ERC" },
      nivel: ["A", "B"],   // claves libres de primer nivel → «Otros datos»
      nota: "valor",
    };

    t.caso("A1: markdown completo — confirmaciones, factores, Everest y notas", () => {
      const md = api0(REG_COMPLETO);
      t.igual(md.split("\n")[0], "# Historia del paciente 1093800", "título con la cédula");
      t.cierto(md.includes("_Memoria del Vigilante de Agenda. Actualizada el " + FECHA +
        " a las " + HORA + "._"), "línea de actualización con fecha y hora congeladas");
      t.cierto(md.includes("- Sí — acepta _(respondido el " + FECHA + ")_"), "Sí con fecha");
      t.cierto(md.includes("- No — rechaza _(respondido el " + FECHA + ")_"), "No con fecha");
      t.cierto(md.includes("- Sí — sinFecha"), "Sí sin fecha no imprime parentesis");
      t.falso(md.includes("invalida"), "confirmación escalar fuera");
      t.falso(md.includes("apagada"), "v no booleana fuera");
      t.cierto(md.includes("- **obj:** Hipertensión _(" + FECHA + ")_"), "factor objeto con fecha");
      t.cierto(md.includes("- **objSinTs:** 42"), "factor objeto sin fecha");
      t.cierto(md.includes("- **escalar:** EPOC"), "factor escalar");
      t.cierto(md.includes("- **numero:** 7"), "factor numérico");
      t.falso(md.includes("vacio"), "factor falso fuera");
      t.cierto(md.includes("- **dx:** DM2"), "clave Everest truthy");
      t.cierto(md.includes("- **otro:** ERC"), "otra clave Everest");
      t.cierto(md.includes("- **nota:** valor"), "notas libres");
      t.cierto(md.includes("- **nivel:** [\"A\",\"B\"]"), "valor objeto serializado");
      t.cierto(md.endsWith("No sustituye la historia clínica oficial._"), "cierra con el pie");
      t.falso(md.endsWith("\n"), "sin salto final");
    });

    t.caso("A2: determinismo y bordes de la cédula", () => {
      // El renderer ordena las claves de PRIMER nivel (las anidadas van tal cual):
      // el determinismo se prueba con claves libres de primer nivel.
      const uno = api0({ ts: MS_FIJA, zz: "2", aa: "1" });
      const dosEscritoAlReves = api0({ aa: "1", zz: "2", ts: MS_FIJA });
      t.igual(uno, dosEscritoAlReves, "el orden de las claves no altera el archivo");
      t.cierto(uno.indexOf("- **aa:** 1") < uno.indexOf("- **zz:** 2"), "claves ordenadas alfabéticamente");
      t.cierto(render("XYZ", { ts: MS_FIJA }).startsWith("# Historia del paciente XYZ"),
        "cédula no numérica se conserva");
      t.cierto(render(null, { ts: MS_FIJA }).includes("# Historia del paciente sin-cedula"),
        "docId nulo cae a sin-cedula");
      const raro = render("XY\u0001Z\tQ", { ts: MS_FIJA });
      t.cierto(raro.includes("# Historia del paciente XY Z Q"),
        "controles y tabulaciones se sanean a un espacio");
    });

    t.caso("A3: registros degenerados no generan secciones ni explotan", () => {
      for (const reg of [null, "texto", [1, 2], {}]) {
        const md = api0(reg);
        t.cierto(md.startsWith("# Historia del paciente 1093800"), "siempre hay título");
        t.cierto(md.includes("_Memoria del Vigilante de Agenda. Actualizada el " + FECHA),
          "la fecha cae al reloj vivo (congelado) cuando el registro no trae ts");
        t.falso(md.includes("- Sí"), "sin confirmaciones");
        t.falso(md.includes("**"), "sin factores ni notas");
      }
    });

    // =========== BLOQUE B — recuperación del handle persistente ===========
    await t.casoAsync("B1: sin API, sin handle guardado y handle legado sin permisos", async () => {
      const e1 = escenario({ sinIndexedDB: true });
      const r1 = await e1.c.api._vglCarpetaRecuperarCrudo();
      t.igual(r1.perm, "sinapi", "sin indexedDB");
      t.igual(r1.h, null, "sin handle");

      const e2 = escenario({});
      const r2 = await e2.c.api._vglCarpetaRecuperarCrudo();
      t.igual(r2.perm, "sinhandle", "almacén vacío");
      t.igual(r2.h, null, "sin handle");

      const e3 = escenario({});
      const h3 = handleDe(e3.raiz); // legado: sin queryPermission
      e3.f._stores.handles.historias = h3;
      const r3 = await e3.c.api._vglCarpetaRecuperarCrudo();
      t.igual(r3.perm, "granted", "handle legado cuenta como concedido");
      t.igual(r3.h, h3, "el handle viaja por identidad");

      const e4 = escenario({});
      const h4 = handleDe(e4.raiz, { query: "granted" });
      e4.f._stores.handles.historias = h4;
      const r4 = await e4.c.api._vglCarpetaRecuperarCrudo();
      t.igual(r4.perm, "granted", "query granted");
      t.igual(r4.h, h4, "el handle viaja por identidad");
    });

    await t.casoAsync("B2: permiso por renovar, denegado y query roto", async () => {
      const e5 = escenario({});
      const h5 = handleDe(e5.raiz, { query: "prompt" });
      e5.f._stores.handles.historias = h5;
      const r5 = await e5.c.api._vglCarpetaRecuperarCrudo();
      t.igual(r5.perm, "prompt", "permiso por renovar");
      t.igual(r5.h, h5, "el handle viaja para el banner de reactivar");

      const e6 = escenario({});
      const h6 = handleDe(e6.raiz, { query: "denied" });
      e6.f._stores.handles.historias = h6;
      const r6 = await e6.c.api._vglCarpetaRecuperarCrudo();
      t.igual(r6.perm, "denied", "denegado");
      t.igual(r6.h, h6, "handle presente");

      const e7 = escenario({});
      const h7 = handleDe(e7.raiz, { query: "lanza" });
      e7.f._stores.handles.historias = h7;
      const r7 = await e7.c.api._vglCarpetaRecuperarCrudo();
      t.igual(r7.perm, "error", "query roto se reporta como error");
      t.igual(r7.h, h7, "handle presente");
    });

    // ============ BLOQUE C — cosecha blindada contra la cuota llena ============
    await t.casoAsync("C1: cuota llena SIN carpeta — guardar devuelve null y no deja basura", async () => {
      const e = escenario({});
      forzarCuota(e.c, "vgl_cosecha");
      const r = e.c.api._vglCosechaGuardar("1093800", { confirmaciones: { ok: { v: true } } });
      t.igual(r, null, "sin carpeta no hay a dónde rescatar");
      t.igual(e.c.env.almacen["vgl_cosecha"], undefined, "el almacén no cambió");
      t.falso(tieneDir(e.raiz, ["Vigilante de Agenda", "Historias"]), "nada en el disco");
    });

    await t.casoAsync("C2: cuota llena CON carpeta — la memoria baja al disco intacta", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      forzarCuota(e.c, "vgl_cosecha");
      const r = e.c.api._vglCosechaGuardar("1.093.800", { confirmaciones: { ok: { v: true } } });
      t.cierto(r && typeof r === "object", "devuelve la fusión aunque el navegador diga que no");
      t.cierto(r.confirmaciones && r.confirmaciones.ok.v === true, "los datos nuevos van dentro");
      await dormir(120);
      const mem = memoriaDisco(e.raiz);
      t.cierto(!!mem, "Memoria/vgl_cosecha.json escrita");
      const reg = mem && mem.cosecha && mem.cosecha["1.093.800"];
      t.cierto(!!reg, "con almacén vacío la clave viaja cruda, tal como la escribió el flujo");
      t.cierto(reg && reg.confirmaciones && reg.confirmaciones.ok.v === true, "contenido íntegro en el disco");
      const md = contenidoDe(e.raiz, ["Vigilante de Agenda", "Historias", "1093800", { archivo: "1093800 " + FECHA + ".md" }]);
      t.cierto(typeof md === "string" && md.includes("# Historia del paciente 1093800"),
        "la historia .md usa la cédula canónica en la ruta");
    });

    await t.casoAsync("C3: la clave previa canónica y la nueva con puntos son UN paciente", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({
        "1093800": { ts: 1, plan: "cronico" },
      });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      forzarCuota(e.c, "vgl_cosecha");
      e.c.api._vglCosechaGuardar("1.093.800", { confirmaciones: { nuevo: { v: true } } });
      await dormir(120);
      const cosecha = memoriaDisco(e.raiz).cosecha;
      t.igual(Object.keys(cosecha).length, 1, "una sola clave de paciente en el disco");
      const reg = cosecha["1093800"];
      t.cierto(!!(reg && reg.plan === "cronico" && reg.confirmaciones && reg.confirmaciones.nuevo),
        "la clave cruda se redirigió a la canónica y fusionó");
    });

    // =============== BLOQUE D — espejo diferido (debounce) ===============
    await t.casoAsync("D1: tras guardar, el disco se actualiza solo una vez, diferido", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      e.c.api._vglCosechaGuardar("1093800", { confirmaciones: { ok: { v: true, ts: MS_FIJA } } });
      e.c.api.vglDiscoMemoriaProgramar(); // cobertura: espejo de Memoria programado a mano
      t.igual(memoriaDisco(e.raiz), null, "nada síncrono: todo pasa por el debounce");
      await dormir(4300); // el debounce real (VGL_DISCO_DEBOUNCE_MS) es de 4 s de calma
      const mem = memoriaDisco(e.raiz);
      t.cierto(!!(mem && mem.cosecha && mem.cosecha["1093800"]), "Memoria tras el debounce");
      t.cierto(!!mem && mem.v === 1, "envoltorio con versión");
      const md = contenidoDe(e.raiz, ["Vigilante de Agenda", "Historias", "1093800", { archivo: "1093800 " + FECHA + ".md" }]);
      t.cierto(typeof md === "string" && md.includes("- Sí — ok"), "la historia .md refleja la confirmación");
    });

    await t.casoAsync("D2: programar la historia con docId vacío es un no-op", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      e.c.api.vglDiscoHistoriaProgramar("");
      await dormir(150);
      t.falso(tieneDir(e.raiz, ["Vigilante de Agenda", "Historias"]), "sin docId no se crea ni la carpeta");
      t.igual(memoriaDisco(e.raiz), null, "tampoco Memoria");
    });

    await t.casoAsync("D3: si la carpeta se pierde antes del disparo, no se escribe nada", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      e.c.api._vglCosechaGuardar("1093800", { confirmaciones: { ok: { v: true } } });
      e.c.api.__setCarpetaHandleParaTest(null); // el médico cerró el permiso
      await dormir(4300); // el disparo del debounce llega con la carpeta ya retirada
      t.igual(memoriaDisco(e.raiz), null, "el guardián al disparar evita escrituras huérfanas");
      t.falso(tieneDir(e.raiz, ["Vigilante de Agenda", "Historias"]), "sin carpeta Historias");
    });

    // ========== BLOQUE E — escritura inmediata y lectura tolerante ==========
    await t.casoAsync("E1: cédulas inválidas se rechazan sin tocar el disco", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({
        "1093800": { ts: MS_FIJA, confirmaciones: { ok: { v: true } } },
      });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      t.falso(await e.c.api._vglDiscoEscribirMdAhora("abc"), "letras no son cédula");
      t.falso(await e.c.api._vglDiscoEscribirMdAhora(null), "nulo no es cédula");
      t.falso(tieneDir(e.raiz, ["Vigilante de Agenda", "Historias"]), "sin carpeta Historias");
    });

    await t.casoAsync("E2: escritura inmediata con registro explícito y con cosecha", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      const ok = await e.c.api._vglDiscoEscribirMdAhora("1093800",
        { ts: MS_FIJA, confirmaciones: { ok: { v: true, ts: MS_FIJA } } });
      t.cierto(ok, "escribió con registro explícito");
      const md = contenidoDe(e.raiz, ["Vigilante de Agenda", "Historias", "1093800", { archivo: "1093800 " + FECHA + ".md" }]);
      t.cierto(typeof md === "string", "archivo con la fecha del sello del registro");
      t.cierto(md.includes("# Historia del paciente 1093800"), "título correcto");

      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({ "1093800": { ts: MS_FIJA, otros: { nota: "x" } } });
      const e2 = escenario({ almacen });
      e2.c.api.__setCarpetaHandleParaTest(handleDe(e2.raiz));
      t.cierto(await e2.c.api._vglDiscoEscribirMdAhora("1093800"),
        "sin registro explícito cae a la cosecha guardada");
      t.cierto(typeof contenidoDe(e2.raiz, ["Vigilante de Agenda", "Historias", "1093800", { archivo: "1093800 " + FECHA + ".md" }]) === "string",
        "el .md se creó desde la cosecha");
    });

    await t.casoAsync("E3: sin carpeta activa, la escritura inmediata LANZA", async () => {
      const e = escenario({});
      await t.lanza(() => e.c.api._vglDiscoEscribirMdAhora("1093800", { ts: MS_FIJA }),
        "debe rechazar con «sin carpeta activa»");
    });

    t.caso("E4: _vglCosechaLeer tolera las tres formas de la cédula", () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({ "1093800": { ts: 5, otros: { nota: "x" } } });
      const e = escenario({ almacen });
      const directo = e.c.api._vglCosechaLeer("1093800");
      t.cierto(directo && directo.ts === 5, "forma canónica directa");
      t.cierto(e.c.api._vglCosechaLeer("1.093.800") !== null, "con puntos halla la misma entrada");
      t.cierto(e.c.api._vglCosechaLeer("00001093800") !== null, "con ceros a la izquierda también");
      t.igual(e.c.api._vglCosechaLeer("9999999"), null, "paciente desconocido devuelve null");
    });

    // =============== BLOQUE F — rescate inmediato a disco ===============
    await t.casoAsync("F1: sin carpeta el rescate no promete nada", async () => {
      const e = escenario({});
      t.falso(await e.c.api.vglDiscoRescatarCosecha("1093800", { ts: MS_FIJA }), "sin carpeta, falso");
    });

    await t.casoAsync("F2: con cosecha explícita, Memoria e historia bajan completas", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      const todo = {
        "1093800": { ts: MS_FIJA, confirmaciones: { ok: { v: true } } },
        "9876543": { ts: MS_FIJA, otros: { nota: "x" } },
      };
      t.cierto(await e.c.api.vglDiscoRescatarCosecha("1093800", todo["1093800"], todo), "rescató");
      const mem = memoriaDisco(e.raiz);
      t.cierto(!!(mem && mem.cosecha && mem.cosecha["9876543"]), "la cosecha COMPLETA llegó a Memoria");
      t.cierto(typeof contenidoDe(e.raiz, ["Vigilante de Agenda", "Historias", "1093800", { archivo: "1093800 " + FECHA + ".md" }]) === "string",
        "y la historia del paciente tocado también");
    });

    await t.casoAsync("F3: sin cosecha explícita, reconstruye desde la memoria viva", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({
        "1093800": { ts: 1, confirmaciones: { viejo: { v: true } } },
      });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      const fusion = { ts: MS_FIJA, confirmaciones: { viejo: { v: true }, nuevo: { v: true } } };
      t.cierto(await e.c.api.vglDiscoRescatarCosecha("1093800", fusion, null),
        "reconstruye el total a partir de lo que aún vive en caché");
      const mem = memoriaDisco(e.raiz);
      t.cierto(!!(mem && mem.cosecha && mem.cosecha["1093800"]), "el paciente está en Memoria");
      t.igual(mem && mem.cosecha["1093800"].ts, MS_FIJA, "con la fusión nueva, no con la vieja");
    });

    await t.casoAsync("F4: fusión nula rescata la cosecha pero no escribe historias", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      t.cierto(await e.c.api.vglDiscoRescatarCosecha(null, null, {}),
        "sin paciente tocado igual salva la cosecha completa");
      t.cierto(!!memoriaDisco(e.raiz), "Memoria escrita");
      t.falso(tieneDir(e.raiz, ["Vigilante de Agenda", "Historias"]), "sin historias .md");
    });

    // ============== BLOQUE G — restauración al activar la carpeta ==============
    await t.casoAsync("G1: sin carpeta o sin archivo de Memoria no hay restauración", async () => {
      const e1 = escenario({});
      t.falso(await e1.c.api._vglDiscoMemoriaRestaurar(), "sin carpeta, falso");
      const e2 = escenario({});
      e2.c.api.__setCarpetaHandleParaTest(handleDe(e2.raiz));
      t.falso(await e2.c.api._vglDiscoMemoriaRestaurar(), "carpeta sin Memoria, falso");
      t.falso(tieneDir(e2.raiz, ["Vigilante de Agenda", "Memoria"]), "no inventa el archivo");
    });

    await t.casoAsync("G2: el disco más fresco que el navegador gana y se persiste", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({ "1093800": { ts: 100, otros: { nota: "vieja" } } });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      sembrarMemoria(e.raiz, { "1093800": { ts: MS_FIJA, confirmaciones: { ok: { v: true } } } }, MS_FIJA);
      t.cierto(await e.c.api._vglDiscoMemoriaRestaurar(), "restauró");
      const guardado = JSON.parse(e.c.env.almacen["vgl_cosecha"]);
      t.igual(guardado["1093800"].ts, MS_FIJA, "el navegador adoptó la versión del disco");
      t.igual(e.c.api._vglCosechaTodo()["1093800"].ts, MS_FIJA, "la caché viva también");
    });

    await t.casoAsync("G3: el disco atrasado no se impone ni reescribe nada", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({ "1093800": { ts: MS_FIJA } });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      sembrarMemoria(e.raiz, { "1093800": { ts: 50 } }, 50);
      t.falso(await e.c.api._vglDiscoMemoriaRestaurar(), "nada que fusionar");
      const guardado = JSON.parse(e.c.env.almacen["vgl_cosecha"]);
      t.igual(guardado["1093800"].ts, MS_FIJA, "el almacén quedó intacto");
    });

    await t.casoAsync("G4: si la cuota no deja persistir, la restauración igual cuenta", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({ "1093800": { ts: 100 } });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      sembrarMemoria(e.raiz, { "1093800": { ts: MS_FIJA } }, MS_FIJA);
      forzarCuota(e.c, "vgl_cosecha");
      t.cierto(await e.c.api._vglDiscoMemoriaRestaurar(),
        "true: la sesión ya ve los datos aunque el disco del navegador no pueda guardarlos");
      const guardado = JSON.parse(e.c.env.almacen["vgl_cosecha"]);
      t.igual(guardado["1093800"].ts, 100, "el almacén del navegador no cambió (cuota)");
      t.igual(e.c.api._vglCosechaTodo()["1093800"].ts, MS_FIJA, "la caché viva sí refleja el disco");
    });

    await t.casoAsync("G5: un JSON corrupto en el disco se ignora sin estrellarse", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      const vgl = { tipo: "dir", nombre: "Vigilante de Agenda", hijos: [], archivos: [] };
      e.raiz.hijos.push(vgl);
      const mem = { tipo: "dir", nombre: "Memoria", hijos: [], archivos: [] };
      vgl.hijos.push(mem);
      sembrarArchivo(mem, "vgl_cosecha.json", "{corrupto");
      t.falso(await e.c.api._vglDiscoMemoriaRestaurar(), "JSON roto, falso");
    });

    // ================= BLOQUE H — migración única =================
    await t.casoAsync("H1: sin carpeta no hay migración", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({ "1093800": { ts: MS_FIJA } });
      const e = escenario({ almacen });
      t.falso(await e.c.api.vglDiscoMigrar(), "sin carpeta, falso");
      t.igual(e.c.env.almacen["vgl_disco_migrado"], undefined, "sin candado");
    });

    await t.casoAsync("H2: ya migrado en esta máquina no repite trabajo", async () => {
      const almacen = { vgl_disco_migrado: "1" };
      almacen["vgl_cosecha"] = JSON.stringify({ "1093800": { ts: MS_FIJA } });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      t.falso(await e.c.api.vglDiscoMigrar(), "candado puesto, falso");
      t.falso(tieneDir(e.raiz, ["Vigilante de Agenda", "Historias"]), "no reescribe historias");
      t.igual(memoriaDisco(e.raiz), null, "ni Memoria");
    });

    await t.casoAsync("H3: la primera vez baja una historia por paciente y pone el candado", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({
        "1093800": { ts: MS_FIJA, confirmaciones: { ok: { v: true } } },
        "9876543": { ts: MS_FIJA, otros: { nota: "x" } },
      });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      t.cierto(await e.c.api.vglDiscoMigrar(), "migró");
      t.cierto(typeof contenidoDe(e.raiz, ["Vigilante de Agenda", "Historias", "1093800", { archivo: "1093800 " + FECHA + ".md" }]) === "string",
        "historia del primer paciente");
      t.cierto(typeof contenidoDe(e.raiz, ["Vigilante de Agenda", "Historias", "9876543", { archivo: "9876543 " + FECHA + ".md" }]) === "string",
        "historia del segundo paciente");
      t.cierto(!!memoriaDisco(e.raiz), "Memoria también");
      t.igual(e.c.env.almacen["vgl_disco_migrado"], "1", "candado permanente");
      t.falso(await e.c.api.vglDiscoMigrar(), "y no vuelve a migrar");
    });

    await t.casoAsync("H4: cosecha vacía igual deja la máquina lista", async () => {
      const e = escenario({});
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      t.cierto(await e.c.api.vglDiscoMigrar(), "true aunque no haya nada que copiar");
      const mem = memoriaDisco(e.raiz);
      t.cierto(!!mem, "Memoria creada");
      t.igual(mem && Object.keys(mem.cosecha).length, 0, "cosecha vacía");
      t.falso(tieneDir(e.raiz, ["Vigilante de Agenda", "Historias"]), "sin historias");
      t.igual(e.c.env.almacen["vgl_disco_migrado"], "1", "candado puesto");
    });

    // Handle de ARCHIVO (File System Access API): lectura y escritura que
    // acumula el contenido en "texto" para inspección desde la prueba.
    function handleArchivoDe(archivo) {
      const h = { nombre: archivo.nombre, texto: archivo.texto || "" };
      h.getFile = async () => ({
        text: async () => h.texto,
        name: h.nombre,
      });
      h.createWritable = async () => {
        const w = { abierto: true, chunk: "" };
        w.write = async (datos) => { w.chunk += datos; };
        w.close = async () => {
          archivo.texto = w.chunk; // persiste en el nodo del árbol simulado
          h.texto = archivo.texto; // la suite escribe siempre el archivo completo
          w.abierto = false;
        };
        return w;
      };
      return h;
    }

    // Handle de CARPETA. perms: {query:"granted"|"prompt"|"denied"|"lanza",
    // request:"granted"|"denied"|"lanza"|undefined} — si "lanza", el método
    // arroja Error. Sin perms no expone queryPermission/requestPermission.
    function handleDe(dir, perms) {
      const h = { nombre: dir.nombre, _dir: dir };
      const apply = (perm) => {
        if (perm === "lanza") throw new Error("permiso roto");
        return perm;
      };
      if (perms) {
        h.queryPermission = async () => apply(perms.query);
        if (perms.request) h.requestPermission = async () => apply(perms.request);
      }
      h.getDirectoryHandle = async (nombre, op) => {
        let sub = dir.hijos.find((x) => x.tipo === "dir" && x.nombre === nombre);
        if (!sub) {
          if (!op || !op.create) throw new Error("NotFoundError: " + nombre);
          sub = { tipo: "dir", nombre, hijos: [], archivos: [] };
          dir.hijos.push(sub);
        }
        return handleDe(sub, perms);
      };
      h.getFileHandle = async (nombre, op) => {
        let ar = dir.archivos.find((x) => x.nombre === nombre);
        if (!ar) {
          if (!op || !op.create) throw new Error("NotFoundError: " + nombre);
          ar = { tipo: "archivo", nombre, texto: "" };
          dir.archivos.push(ar);
        }
        return handleArchivoDe(ar);
      };
      return h;
    }

    // ---------- Utilidades de inspección sobre la raíz simulada ----------
    // RUTA: ["Historias","1093800"] → subcarpeta, o con {archivo} al final.
    function dirEn(raiz, ruta) {
      let d = raiz;
      for (const paso of ruta) {
        if (paso.archivo !== undefined) {
          return d.archivos.find((x) => x.nombre === paso.archivo) || null;
        }
        d = d.hijos.find((x) => x.tipo === "dir" && x.nombre === paso);
        if (!d) return null;
      }
      return d;
    }
    function tieneDir(raiz, ruta) {
      const d = dirEn(raiz, ruta);
      return !!(d && d.tipo === "dir");
    }
    function contenidoDe(raiz, ruta) {
      const ar = dirEn(raiz, ruta);
      return ar && ar.tipo === "archivo" ? ar.texto : null;
    }
    function sembrarArchivo(dir, nombre, texto) {
      dir.archivos.push({ tipo: "archivo", nombre, texto });
    }
    // Contenido parseado de Vigilante de Agenda/Memoria/vgl_cosecha.json (null si no existe).
    function memoriaDisco(raiz) {
      const texto = contenidoDe(raiz, ["Vigilante de Agenda", "Memoria", { archivo: "vgl_cosecha.json" }]);
      if (texto === null) return null;
      try { return JSON.parse(texto); } catch (e) { return undefined; }
    }

    // IndexedDB simulado: open() entrega la base en un timer; transaction
    // acepta string o arreglo; get resuelve con result ya poblado; put
    // escribe inmediatamente. _stores es inspeccionable desde la prueba.
    function idbFake(sembrado) {
      const f = { _stores: sembrado || {} };
      f.open = () => {
        const db = {};
        db.objectStoreNames = {
          contains: (n) => Object.prototype.hasOwnProperty.call(f._stores, n),
        };
        db.createObjectStore = (n) => {
          if (!f._stores[n]) f._stores[n] = {}; // nunca pisa lo sembrado
          return f._stores[n];
        };
        db.transaction = (nombres) => {
          const lista = Array.isArray(nombres) ? nombres : [nombres];
          for (const n of lista) {
            if (!f._stores[n]) throw new Error("NotFoundError: store " + n);
          }
          const tx = {};
          tx.objectStore = (n) => {
            const st = f._stores[n];
            return {
              get: (clave) => {
                const req = { result: st[clave] }; // disponible de inmediato
                setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
                return req;
              },
              put: (valor, clave) => {
                st[clave] = valor; // escritura inmediata
                const req = {};
                setTimeout(() => {
                  req.onsuccess && req.onsuccess({ target: req });
                  tx.oncomplete && tx.oncomplete({ target: tx });
                }, 0);
                return req;
              },
            };
          };
          return tx;
        };
        const req = {};
        setTimeout(() => {
          req.result = db; // _vglCarpetaDb resuelve con req.result, no con e.target.result
          req.onupgradeneeded && req.onupgradeneeded({ target: { result: db } });
          req.onsuccess && req.onsuccess({ target: req });
        }, 0);
        return req;
      };
      return f;
    }

    // ================= BLOQUE I — activar (restaura + migra + espejo) =================
    await t.casoAsync("I1: sin carpeta elegida, activar no promete nada", async () => {
      const e = escenario({});
      t.falso(await e.c.api._vglDiscoActivar("prueba"), "sin handle, falso");
      t.igual(memoriaDisco(e.raiz), null, "no toca el disco");
    });

    await t.casoAsync("I2: con carpeta restaura, migra y escribe el espejo YA", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({
        "1093800": { ts: MS_FIJA, confirmaciones: { ok: { v: true } } },
      });
      const e = escenario({ almacen });
      e.c.api.__setCarpetaHandleParaTest(handleDe(e.raiz));
      t.cierto(await e.c.api._vglDiscoActivar("prueba"), "activó");
      t.cierto(typeof contenidoDe(e.raiz, ["Vigilante de Agenda", "Historias", "1093800", { archivo: "1093800 " + FECHA + ".md" }]) === "string",
        "la historia bajó en la misma llamada (todo es awaited)");
      const mem = memoriaDisco(e.raiz);
      t.cierto(!!mem && !!mem.cosecha["1093800"], "Memoria con el paciente");
      t.igual(e.c.env.almacen["vgl_disco_migrado"], "1", "candado de migración puesto");
    });

    // ================= BLOQUE J — arranque (orquestador del boot) =================
    await t.casoAsync("J1: sin FS Access API el arranque no hace nada", async () => {
      const e = escenario({ sinFS: true });
      t.falso(await e.c.api._vglDiscoArranque(), "sin API, falso");
      t.igual(bannersVisibles(e.c), 0, "sin banner: no hay a quién pedirle carpeta");
    });

    await t.casoAsync("J2: permiso vigente revive la carpeta y activa sin preguntar", async () => {
      const almacen = {};
      almacen["vgl_cosecha"] = JSON.stringify({ "1093800": { ts: MS_FIJA } });
      const e = escenario({ almacen });
      e.f._stores.handles.historias = handleDe(e.raiz, { query: "granted" });
      t.cierto(await e.c.api._vglDiscoArranque(), "revivió y activó");
      t.igual(bannersVisibles(e.c), 0, "con permiso vigente no se molesta al médico");
      t.cierto(!!memoriaDisco(e.raiz), "el espejo quedó escrito");
      t.igual(e.c.env.almacen["vgl_disco_migrado"], "1", "migró la primera vez");
    });

    await t.casoAsync("J3: permiso caído a «prompt» pide REACTIVAR, no volver a buscar", async () => {
      const e = escenario({});
      e.f._stores.handles.historias = handleDe(e.raiz, { query: "prompt" });
      t.falso(await e.c.api._vglDiscoArranque(), "no activa solo");
      const b = bannerNodo(e.c);
      t.cierto(!!b, "hay banner");
      t.cierto(String(b.innerHTML).indexOf("Reactivar la carpeta del Vigilante") >= 0,
        "título de reactivación");
      t.cierto(String(b.innerHTML).indexOf("Reactivar carpeta") >= 0, "botón de un clic");
    });

    await t.casoAsync("J4: primera vez en el equipo ofrece ELEGIR la carpeta", async () => {
      const e = escenario({});
      t.falso(await e.c.api._vglDiscoArranque(), "almacén vacío, falso");
      const b = bannerNodo(e.c);
      t.cierto(!!b, "hay banner");
      t.cierto(String(b.innerHTML).indexOf("Guardar historias en este computador") >= 0,
        "título de primera vez");
      t.cierto(String(b.innerHTML).indexOf("Elegir carpeta…") >= 0, "botón elegir");
    });

    await t.casoAsync("J5: permiso DENEGADO: silencio en el arranque (se reactiva desde Ajustes)", async () => {
      const e = escenario({});
      e.f._stores.handles.historias = handleDe(e.raiz, { query: "denied" });
      t.falso(await e.c.api._vglDiscoArranque(), "falso");
      t.igual(bannersVisibles(e.c), 0, "sin banner: el médico ya dijo que no");
    });

    // ================= BLOQUE K — banner: pintar, repintar y callar =================
    t.caso("K1: pintar «elegir» arma el aviso completo de primera vez", () => {
      const e = escenario({});
      t.cierto(e.c.api.vglDiscoBannerPintar("elegir"), "pintó");
      pegarPadres(e.c);
      const html = String(bannerNodo(e.c).innerHTML);
      t.cierto(html.indexOf("Guardar historias en este computador") >= 0, "título");
      t.cierto(html.indexOf("Elegir carpeta…") >= 0 && html.indexOf("Ahora no") >= 0, "los dos botones");
      t.cierto(html.indexOf("una sola vez") >= 0, "explica que la decisión es para siempre");
    });

    t.caso("K1b: pintar «reactivar» habla de permiso caído, sin buscar carpeta", () => {
      const e = escenario({});
      t.cierto(e.c.api.vglDiscoBannerPintar("reactivar"), "pintó");
      pegarPadres(e.c);
      const html = String(bannerNodo(e.c).innerHTML);
      t.cierto(html.indexOf("Reactivar la carpeta del Vigilante") >= 0, "título");
      t.cierto(html.indexOf("no hace falta volver a buscar la carpeta") >= 0, "mensaje clave");
    });

    t.caso("K2: repintar no acumula banners", () => {
      const e = escenario({});
      e.c.api.vglDiscoBannerPintar("elegir");
      pegarPadres(e.c);
      e.c.api.vglDiscoBannerPintar("elegir");
      pegarPadres(e.c);
      e.c.api.vglDiscoBannerPintar("reactivar");
      pegarPadres(e.c);
      t.igual(bannersVisibles(e.c), 1, "siempre uno");
    });

    t.caso("K3: «Ahora no» calla el banner SOLO por esta sesión", () => {
      const e = escenario({});
      e.c.api.vglDiscoBannerPintar("elegir");
      pegarPadres(e.c);
      e.c.api._vglDiscoBannerRechazar();
      t.igual(bannersVisibles(e.c), 0, "se fue");
      t.igual(e.c.env.win.sessionStorage.getItem("vgl_disco_banner"), "off", "marca de sesión");
      t.falso(e.c.api.vglDiscoBannerPintar("elegir"), "y no vuelve a pintar hoy");
    });

    t.caso("K4: quitar es idempotente", () => {
      const e = escenario({});
      e.c.api.vglDiscoBannerQuitar();
      e.c.api.vglDiscoBannerPintar("elegir");
      pegarPadres(e.c);
      e.c.api.vglDiscoBannerQuitar();
      e.c.api.vglDiscoBannerQuitar();
      t.igual(bannersVisibles(e.c), 0, "sin banner y sin explotar");
    });

    // ============ BLOQUE L — aceptar: primera vez y reactivación ============
    await t.casoAsync("L1: primera vez — el médico elige carpeta y queda PERMANENTE en el equipo", async () => {
      const e = escenario({}); // almacén vacío: primera vez
      const elegida = { tipo: "dir", nombre: "ELEGIDA", hijos: [], archivos: [] };
      const hPicker = handleDe(elegida);
      e.c.env.win.showDirectoryPicker = async () => hPicker;
      e.c.api.vglDiscoBannerPintar("elegir"); // el banner real está puesto cuando el médico acepta
      pegarPadres(e.c);
      t.cierto(await e.c.api._vglDiscoBannerAceptar(), "aceptó y activó");
      t.igual(bannersVisibles(e.c), 0, "el banner se fue");
      await dormir(30); // el put de IndexedDB responde en un timer
      t.cierto(e.f._stores.handles.historias === hPicker,
        "el handle quedó guardado en ESTE equipo, por identidad");
      t.cierto(!!memoriaDisco(elegida), "el espejo se escribió en la carpeta elegida");
      t.igual(e.c.env.almacen["vgl_disco_migrado"], "1", "candado de migración");
    });

    await t.casoAsync("L2: reactivación denegada vuelve a ofrecer el banner", async () => {
      const e = escenario({});
      e.f._stores.handles.historias = handleDe(e.raiz, { query: "denied", request: "denied" });
      t.falso(await e.c.api._vglDiscoBannerAceptar(), "no activó");
      const b = bannerNodo(e.c);
      t.cierto(!!b && String(b.innerHTML).indexOf("Reactivar la carpeta del Vigilante") >= 0,
        "banner de reactivación de vuelta");
    });

    await t.casoAsync("L3: reactivación que revienta tampoco rompe nada", async () => {
      const e = escenario({});
      e.f._stores.handles.historias = handleDe(e.raiz, { query: "denied", request: "lanza" });
      t.falso(await e.c.api._vglDiscoBannerAceptar(), "falso controlado");
      t.cierto(!!bannerNodo(e.c), "banner de reactivación");
    });

    await t.casoAsync("L4: cancelar el diálogo NO silencia el banner", async () => {
      const e = escenario({});
      const cancelar = new Error("cerró el diálogo");
      cancelar.name = "AbortError";
      e.c.env.win.showDirectoryPicker = async () => { throw cancelar; };
      e.c.api.vglDiscoBannerPintar("elegir"); // el banner está puesto al cancelar el diálogo
      pegarPadres(e.c);
      t.falso(await e.c.api._vglDiscoBannerAceptar(), "no activó");
      const b = bannerNodo(e.c);
      t.cierto(!!b && String(b.innerHTML).indexOf("Elegir carpeta…") >= 0,
        "el banner de elegir sigue ahí");
      t.falso(e.c.env.win.sessionStorage.getItem("vgl_disco_banner") === "off",
        "cancelar no es «Ahora no»: el banner no queda callado");
    });

    // ========= BLOQUE M — reportes: fila viva y resumen que no entierra días =========
    await t.casoAsync("M1: con el reporte apagado no se arma ni la fila", async () => {
      const red = crearRed();
      const e = escenario({ gmxhr: red.gmxhr });
      e.c.api.__S.reporte = false;
      t.falso(e.c.api.reportar("x"), "apagado, falso");
      t.igual(e.c.env.gm["vgl_repq"], undefined, "ni tocó la cola");
      t.igual(red.posts.length, 0, "ni un POST");
    });

    await t.casoAsync("M2: la fila lleva versión, lote, día y el extra del evento", async () => {
      const red = crearRed();
      const e = escenario({ gmxhr: red.gmxhr });
      t.cierto(e.c.api.reportar("prueba", { cosa: 1 }), "encoló");
      await dormir(20);
      t.igual(red.posts.length, 1, "un POST");
      const fila = red.cuerpos()[0];
      t.igual(fila.evento, "prueba");
      t.igual(fila.dia, FECHA, "día del reloj congelado");
      t.igual(fila.ver, "18.0.138", "versión viva");
      t.igual(fila.cosa, 1, "extra mergeado");
      t.cierto(typeof fila.token === "string" && fila.token.length > 0, "token del tablero");
      t.cierto(/-/.test(String(fila.lote)), "lote trazable");
      t.cierto(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(String(fila.ts)), "ts ISO");
    });

    await t.casoAsync("M3: sin red la fila sobrevive en la cola y el retorno lo dice", async () => {
      const red = crearRed();
      red.modo = "error";
      const e = escenario({ gmxhr: red.gmxhr });
      t.cierto(e.c.api.reportar("prueba"), "true: ENCOLADA es la promesa del circuito");
      await dormir(20);
      t.igual(JSON.parse(e.c.env.gm["vgl_repq"]).length, 1, "la fila quedó en la cola");
    });

    await t.casoAsync("M4: el resumen diario ya no entierra un día sin fila (v18.0.136)", async () => {
      const red = crearRed();
      const e = escenario({ gmxhr: red.gmxhr });
      e.c.api.repDailySummary(); // sin stats de ayer
      await dormir(20);
      t.igual(red.posts.length, 0, "sin actividad: ni fila");
      t.igual(e.c.env.almacen["vgl_rep_sum"], undefined, "y SIN candado: el día no queda enterrado");
      // las stats de ayer aparecen después (la cuota por fin cedió, llegaron tarde)
      e.c.env.almacen["vgl_stats"] = JSON.stringify(
        { [AYER]: { fraude: 1, inasistencia: 2, atiempo: 3, ultima: 99 } });
      e.c.api.repDailySummary();
      await dormir(20);
      t.igual(red.posts.length, 1, "ahora sí sale el resumen");
      const fila = red.cuerpos()[0];
      t.igual(fila.evento, "resumen");
      t.igual(fila.deDia, AYER, "resumen del día anterior");
      t.igual(e.c.env.almacen["vgl_rep_sum"], AYER, "candado recién ahora");
      e.c.api.repDailySummary();
      await dormir(20);
      t.igual(red.posts.length, 1, "con fila entregada no se repite");
    });
  },
};