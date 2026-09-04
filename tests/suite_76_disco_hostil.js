// =====================================================================
//  SUITE 76 — El disco bajo condiciones hostiles (v18.0.137)
//
//  La suite 75 probó el módulo de disco en el camino feliz: una pestaña,
//  permisos firmes, carpeta viva. Esta suite ataca lo que el consultorio
//  le hace de verdad al disco:
//
//    BLOQUE A — DOS PESTAÑAS a la vez: pacientes distintos, el mismo
//      paciente y la carrera exacta por el mismo archivo .md.
//    BLOQUE B — el permiso SE REVOCA entre guardados y OneDrive RETIENE
//      el archivo (close lanza sin persistir).
//    BLOQUE C — la carpeta DESAPARECE: antes del guardado, cambiada a
//      mitad de mes, y justo después de escribir.
//    BLOQUE D — fallos TRANSITORIOS de createWritable: uno suelto, en
//      cascada y junto a la cuota llena del navegador.
//    BLOQUE E — el paciente REABRE días después: el reloj corre y los
//      archivos de días anteriores no se tocan.
//
//  El reintento acotado de _vglDiscoEscribirArchivo (VGL_DISCO_REINTENTOS)
//  es el arreglo de v18.0.137: con el código de la 136 caían A3, B2, D1 y
//  D3 — el disco perdía la escritura al primer rebote transitorio.
// =====================================================================
"use strict";

module.exports = {
  nombre: "El disco hostil del consultorio (Suite 76)",
  cubre: [
    "vglDiscoHistoriaMarkdown", "vglDiscoMemoriaProgramar",
    "vglDiscoHistoriaProgramar", "vglDiscoRescatarCosecha",
    "vglDiscoMigrar", "_vglCarpetaRecuperarCrudo", "_vglDiscoActivar",
    "_vglDiscoEscribirMdAhora", "_vglDiscoMemoriaRestaurar",
    "_vglCosechaGuardar", "_vglCosechaLeer", "_vglCosechaTodo",
    "_vglConfirmacionGuardar", "_vglDiscoLeerArchivo",
  ],

  async pruebas(t, api, env, cargar) {
    const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

    // Dos pacientes del consultorio.
    const CED = "1093800";
    const CED2 = "9876543";

    // Hoy es 5 de marzo de 2026; DIA3 es el día de la consulta anterior:
    // el paciente reaparece dos días después y el reloj ya corrió.
    const MS_FIJA = Date.parse("2026-03-05T10:15:00-05:00");
    const FECHA = "2026-03-05";
    const MS_DIA3 = Date.parse("2026-03-03T10:15:00-05:00");
    const DIA3 = "2026-03-03";

    // Ruta canónica del .md de un paciente en un día (carpeta por cédula).
    const RUTA_MD = (ced, fecha) =>
      ["Vigilante de Agenda", "Historias", ced, { archivo: ced + " " + fecha + ".md" }];

    // Reloj congelado dentro del vm; caja.iso se adelanta a mano (patrón 75).
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

    // Cuota del navegador: setItem(clave) lanza QuotaExceededError (patrón 75).
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

    // ---------- Escenario de UNA pestaña ----------
    // vm silencioso, reloj congelado, FS simulado y el handle YA inyectado
    // por el setter de pruebas (la carpeta quedó elegida en sesión real).
    // perms y estado son MUTABLES y compartidos con todos los handles hijos:
    // moverlos desde la prueba simula revocar el permiso o borrar la carpeta.
    function escenario(opciones) {
      const op = opciones || {};
      const c = cargar({ silencioso: true, almacen: op.almacen });
      const caja = congelarFecha(c, op.iso || "2026-03-05T10:15:00");
      const raiz = { tipo: "dir", nombre: "RAIZ", hijos: [], archivos: [] };
      const estado = { huerfana: false, revocada: false };
      const perms = { query: "granted" };
      const handle = handleDe(raiz, perms, estado);
      c.env.win.indexedDB = idbFake(op.conHandle
        ? { handles: { historias: handle } } : { handles: {} });
      c.env.win.showDirectoryPicker = () => {
        throw new Error("showDirectoryPicker: no debía llamarse aquí");
      };
      c.api.__setCarpetaHandleParaTest(handle);
      return { c, caja, raiz, estado, perms, handle };
    }

    // ---------- Dos PESTAÑAS de verdad ----------
    // UN localStorage (el mismo navegador), UNA carpeta y UN handle, pero
    // DOS vm: cada uno con SU cola de escritura y SU debounce, exactamente
    // como dos pestañas apuntando a la carpeta elegida del mismo navegador.
    function dosPestanas(opciones) {
      const op = opciones || {};
      const almacen = op.almacen || {};
      const raiz = { tipo: "dir", nombre: "RAIZ", hijos: [], archivos: [] };
      const estado = { huerfana: false, revocada: false };
      const perms = { query: "granted" };
      const handle = handleDe(raiz, perms, estado);
      const idb = idbFake({ handles: {} });
      const a = cargar({ silencioso: true, almacen });
      const b = cargar({ silencioso: true, almacen });
      const cajaA = congelarFecha(a, op.iso || "2026-03-05T10:15:00");
      const cajaB = congelarFecha(b, op.iso || "2026-03-05T10:15:00");
      [a, b].forEach((c) => {
        c.env.win.indexedDB = idb;
        c.env.win.showDirectoryPicker = () => {
          throw new Error("showDirectoryPicker: no debía llamarse aquí");
        };
        c.api.__setCarpetaHandleParaTest(handle);
      });
      return { a, b, cajaA, cajaB, raiz, estado, perms, handle, almacen };
    }

    // Handle de ARCHIVO hostil (extiende el de la 75): cuenta llamadas,
    // REBOTA cuando hay otro writable abierto sobre el mismo archivo
    // (dos pestañas / OneDrive / antivirus lo retienen), puede fallar
    // createWritable N veces (fallo transitorio) y close puede lanzar SIN
    // persistir (retención de sincronización en la nube). Los contadores
    // viven EN EL NODO del árbol para sobrevivir a que el módulo pida un
    // handle NUEVO del mismo archivo en cada intento.
    function handleArchivoDe(archivo) {
      const h = { nombre: archivo.nombre, texto: archivo.texto || "" };
      h.getFile = async () => ({ text: async () => h.texto, name: h.nombre });
      h.createWritable = async () => {
        archivo._createWritableLlamadas = (archivo._createWritableLlamadas || 0) + 1;
        if (archivo._bloqueoConcurrente && (archivo._abiertos || 0) > 0) {
          archivo._rebotes = (archivo._rebotes || 0) + 1;
          if (archivo._alRebote) archivo._alRebote();
          const e = new Error("el archivo está retenido por otra pestaña");
          e.name = "NoModificationAllowedError";
          throw e;
        }
        if ((archivo._fallasCreateWritable || 0) > 0) {
          archivo._fallasCreateWritable -= 1;
          const e = new Error("createWritable transitorio");
          e.name = "InvalidStateError";
          throw e;
        }
        archivo._abiertos = (archivo._abiertos || 0) + 1;
        if (archivo._pausaWrite) await archivo._pausaWrite; // congela DENTRO
        const w = { abierto: true, chunk: "" };
        w.write = async (datos) => { w.chunk += datos; };
        w.close = async () => {
          if ((archivo._fallasClose || 0) > 0) {
            archivo._fallasClose -= 1;
            const e = new Error("OneDrive retuvo el archivo al cerrar");
            e.name = "NoModificationAllowedError";
            throw e; // SIN persistir y SIN liberar _abiertos
          }
          archivo.texto = w.chunk; // persiste en el nodo del árbol simulado
          h.texto = archivo.texto;
          w.abierto = false;
          archivo._abiertos -= 1;
        };
        return w;
      };
      return h;
    }

    // Handle de CARPETA con estado mutable COMPARTIDO y propagado a los
    // hijos: huerfana simula la carpeta borrada o renombrada desde el
    // explorador; revocada simula el permiso retirado en la configuración
    // del sitio. perms.query se lee AL LLAMAR, para mutarlo en caliente.
    function handleDe(dir, perms, estado) {
      const est = estado || {};
      const h = { nombre: dir.nombre, _dir: dir };
      const guardian = () => {
        if (est.huerfana) {
          const e = new Error("la carpeta desapareció");
          e.name = "NotFoundError";
          throw e;
        }
        if (est.revocada) {
          const e = new Error("permiso retirado");
          e.name = "NotAllowedError";
          throw e;
        }
      };
      if (perms) {
        const apply = (perm) => {
          if (perm === "lanza") throw new Error("permiso roto");
          return perm;
        };
        h.queryPermission = async () => apply(perms.query);
        if (perms.request) h.requestPermission = async () => apply(perms.request);
      }
      h.getDirectoryHandle = async (nombre, op) => {
        guardian();
        let sub = dir.hijos.find((x) => x.tipo === "dir" && x.nombre === nombre);
        if (!sub) {
          if (!op || !op.create) throw new Error("NotFoundError: " + nombre);
          sub = { tipo: "dir", nombre, hijos: [], archivos: [] };
          dir.hijos.push(sub);
        }
        return handleDe(sub, perms, est);
      };
      h.getFileHandle = async (nombre, op) => {
        guardian();
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
    // Contenido parseado de Vigilante de Agenda/Memoria/vgl_cosecha.json.
    function memoriaDisco(raiz) {
      const texto = contenidoDe(raiz, ["Vigilante de Agenda", "Memoria", { archivo: "vgl_cosecha.json" }]);
      if (texto === null) return null;
      try { return JSON.parse(texto); } catch (e) { return undefined; }
    }

    // Materializa la ruta completa de un .md (sin escribirle contenido) y
    // devuelve el NODO del archivo, para armarle trampas ANTES de que el
    // módulo escriba: conteos, rebotes y pausas viven en ese nodo.
    async function tocarMd(handle, ced, fecha) {
      const d1 = await handle.getDirectoryHandle("Vigilante de Agenda", { create: true });
      const d2 = await d1.getDirectoryHandle("Historias", { create: true });
      const d3 = await d2.getDirectoryHandle(ced, { create: true });
      await d3.getFileHandle(ced + " " + fecha + ".md", { create: true });
    }
    function nodoArchivo(raiz, ced, fecha) {
      const dirCed = dirEn(raiz, ["Vigilante de Agenda", "Historias", ced]);
      if (!dirCed) return null;
      return dirCed.archivos.find((x) => x.nombre === ced + " " + fecha + ".md") || null;
    }

    // Siembra Vigilante de Agenda/Memoria/vgl_cosecha.json con el envoltorio
    // real {v,ts,cosecha} (patrón 75): lo usa el bloque E para simular que
    // otro día, otra pestaña u otra máquina dejó memoria en la carpeta.
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

    // IndexedDB simulado (patrón 75, verbatim): open() entrega la base en
    // un timer; transaction acepta string o arreglo; get resuelve con
    // result ya poblado; put escribe inmediatamente. _stores es
    // inspeccionable desde la prueba.
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
          req.result = db; // _vglCarpetaDb resuelve con req.result
          req.onupgradeneeded && req.onupgradeneeded({ target: { result: db } });
          req.onsuccess && req.onsuccess({ target: req });
        }, 0);
        return req;
      };
      return f;
    }

    // ============ BLOQUE A — DOS PESTAÑAS SOBRE LA MISMA CARPETA ============
    // El médico deja el paciente abierto en dos ventanas del mismo navegador:
    // UN localStorage, UNA carpeta, DOS colas de escritura y DOS debounces.
    await t.casoAsync("A1: pacientes distintos en dos pestañas — ambos .md y una sola Memoria", async () => {
      const p = dosPestanas({});
      p.a.api._vglCosechaGuardar(CED, { confirmaciones: { pestanaUno: { v: true } } });
      p.b.api._vglCosechaGuardar(CED2, { confirmaciones: { pestanaDos: { v: true } } });
      p.b.api.vglDiscoMemoriaProgramar(); // cobertura: espejo programado desde la otra pestaña
      await dormir(4300); // ambos debounces (4 s) disparan sobre la MISMA carpeta
      const md1 = contenidoDe(p.raiz, RUTA_MD(CED, FECHA));
      const md2 = contenidoDe(p.raiz, RUTA_MD(CED2, FECHA));
      t.cierto(typeof md1 === "string" && md1.includes("# Historia del paciente " + CED),
        "la pestaña A dejó su historia");
      t.cierto(typeof md2 === "string" && md2.includes("# Historia del paciente " + CED2),
        "la pestaña B dejó la suya, sin pisarse");
      const memo = memoriaDisco(p.raiz);
      t.cierto(!!(memo && memo.cosecha && memo.cosecha[CED] && memo.cosecha[CED2]),
        "la Memoria del disco junta a los dos pacientes");
      const todo = p.a.api._vglCosechaTodo();
      t.cierto(!!(todo && todo[CED] && todo[CED2]),
        "el navegador de la pestaña A también ve la cosecha completa");
    });

    await t.casoAsync("A2: el MISMO paciente en dos pestañas — la historia crece, no se bifurca", async () => {
      const p = dosPestanas({});
      p.a.api._vglCosechaGuardar(CED, { confirmaciones: { pestanaA: { v: true, ts: MS_FIJA } } });
      await dormir(4300); // la pestaña A dispara sola primero
      // La segunda confirmación va por la vía REAL de producción: el contrato
      // de _vglCosechaGuardar es fusión PLANA (quien llama fusiona a mano, ver
      // su comentario en el userscript), así que entregarle un mapa parcial de
      // confirmaciones BORRARÍA lo dejado por la pestaña A.
      p.b.api._vglConfirmacionGuardar(CED, "pestanaB", true);
      await dormir(4300); // la pestaña B reescribe CON lo que la A dejó
      const reg = p.b.api._vglCosechaLeer(CED);
      t.cierto(!!(reg && reg.confirmaciones && reg.confirmaciones.pestanaA && reg.confirmaciones.pestanaB),
        "el registro del paciente tiene ambas confirmaciones");
      const memo = memoriaDisco(p.raiz);
      const md = contenidoDe(p.raiz, RUTA_MD(CED, FECHA));
      t.cierto(typeof md === "string" && md.includes("- Sí — pestanaA") && md.includes("- Sí — pestanaB"),
        "el .md del día crece con las dos pestañas");
      t.igual(md, p.b.api.vglDiscoHistoriaMarkdown(CED, memo.cosecha[CED]),
        "y es byte a byte el render del registro fusionado");
    });

    await t.casoAsync("A3: carrera exacta por el mismo .md — el rebote no pierde la escritura (v18.0.137)", async () => {
      const p = dosPestanas({});
      await tocarMd(p.handle, CED, DIA3); // el archivo del día ya existe (consulta anterior)
      const nodo = nodoArchivo(p.raiz, CED, DIA3);
      t.cierto(!!nodo, "nodo del .md listo para la trampa");
      // Trampa determinista: A congela su writable ABIERTO; B rebota al llegar.
      let soltar = () => {};
      const pausa = new Promise((ok) => { soltar = ok; });
      let avisarRebote = () => {};
      const rebote = new Promise((ok) => { avisarRebote = ok; });
      nodo._bloqueoConcurrente = true;
      nodo._pausaWrite = pausa;
      nodo._alRebote = avisarRebote;
      const REG_A = { ts: MS_DIA3, confirmaciones: { ganaA: { v: true, ts: MS_DIA3 } } };
      const REG_B = { ts: MS_DIA3, confirmaciones: { ganaB: { v: true, ts: MS_DIA3 } } };
      const pA = p.a.api._vglDiscoEscribirMdAhora(CED, REG_A); // A abre y se congela
      await dormir(5);
      const pB = p.b.api._vglDiscoEscribirMdAhora(CED, REG_B); // B llega y REBOTA
      await rebote; // B ya rebotó: sin reintento, su historia se perdía (caída de la 136)
      soltar(); // OneDrive suelta el archivo: A completa su escritura
      t.cierto(await pA, "la escritura de A completa");
      t.igual(contenidoDe(p.raiz, RUTA_MD(CED, DIA3)), p.a.api.vglDiscoHistoriaMarkdown(CED, REG_A),
        "el disco tiene la historia de A");
      t.cierto(await pB, "la de B también llega, tras su reintento acotado");
      t.cierto(nodo._createWritableLlamadas >= 3, "tres intentos contados: A más el rebote y el reintento de B");
      t.igual(contenidoDe(p.raiz, RUTA_MD(CED, DIA3)), p.b.api.vglDiscoHistoriaMarkdown(CED, REG_B),
        "y el archivo final es la historia de B, sin pérdidas");
    });

    // ======== BLOQUE B — EL PERMISO SE REVOCA Y ONEDRIVE RETIENE EL ARCHIVO ========
    await t.casoAsync("B1: permiso revocado ENTRE guardados — el disco queda intacto y nada revienta", async () => {
      const e = escenario({});
      e.c.api._vglCosechaGuardar(CED, { confirmaciones: { b1uno: { v: true } } });
      await dormir(4300);
      const mdAntes = contenidoDe(e.raiz, RUTA_MD(CED, FECHA));
      const memoAntes = contenidoDe(e.raiz,
        ["Vigilante de Agenda", "Memoria", { archivo: "vgl_cosecha.json" }]);
      t.cierto(typeof mdAntes === "string" && mdAntes.includes("- Sí — b1uno"), "primera escritura en disco");
      e.estado.revocada = true; // el médico retira el permiso en la configuración del sitio
      e.c.api._vglCosechaGuardar(CED, { notas: "revisado por junta" }); // clave DISTINTA
      await dormir(4300); // el disparo llega con el permiso ya retirado
      t.igual(contenidoDe(e.raiz, RUTA_MD(CED, FECHA)), mdAntes,
        "el .md no se corrompe: queda exactamente como estaba");
      t.igual(contenidoDe(e.raiz,
        ["Vigilante de Agenda", "Memoria", { archivo: "vgl_cosecha.json" }]), memoAntes,
        "la Memoria tampoco se toca");
      t.cierto(!!e.c.api._vglCosechaLeer(CED).notas,
        "pero el navegador SÍ guardó lo nuevo: al reactivar la carpeta, se recupera");
    });

    await t.casoAsync("B2: OneDrive retiene el archivo al cerrar — el reintento persiste la fusión (v18.0.137)", async () => {
      const e = escenario({});
      e.c.api._vglCosechaGuardar(CED, { confirmaciones: { b2uno: { v: true } } });
      await dormir(4300);
      const nodo = nodoArchivo(e.raiz, CED, FECHA);
      t.cierto(!!nodo, "el .md del día ya existe");
      nodo._fallasClose = 1; // close lanza SIN persistir: la sincronización retiene el archivo
      // Vía de producción para la segunda confirmación: la fusión profunda la
      // hace _vglConfirmacionGuardar (la interna fusiona plano, ver A2).
      e.c.api._vglConfirmacionGuardar(CED, "b2dos", true);
      await dormir(4300);
      const md = contenidoDe(e.raiz, RUTA_MD(CED, FECHA));
      t.cierto(typeof md === "string" && md.includes("- Sí — b2uno") && md.includes("- Sí — b2dos"),
        "el .md termina con AMBAS confirmaciones: la caída del close no enterró la fusión");
      t.cierto(nodo._createWritableLlamadas >= 2, "el close fallido obligó a reabrir el archivo");
    });

    await t.casoAsync("B3: el permiso cambia en caliente — RecuperarCrudo lo reporta sin abrir diálogos", async () => {
      const e = escenario({ conHandle: true }); // handle sembrado en IndexedDB, como tras reinicio
      const lecturas = [];
      for (const permiso of ["granted", "denied", "prompt", "granted"]) {
        e.perms.query = permiso; // la configuración del sitio cambia mientras el script vive
        const r = await e.c.api._vglCarpetaRecuperarCrudo();
        t.igual(r && r.perm, permiso, "permiso reportado: " + permiso);
        lecturas.push(r);
      }
      t.cierto(lecturas.every((r) => r && r.h === e.handle),
        "siempre el mismo handle de IndexedDB, sin pedir permiso nuevo");
    });

    // ============ BLOQUE C — LA CARPETA DESAPARECE O SE CAMBIA ============
    await t.casoAsync("C1: carpeta borrada ANTES del guardado — escribir ahora avisa, no miente", async () => {
      const e = escenario({});
      e.estado.huerfana = true; // borraron o renombraron la carpeta desde el explorador
      await t.lanza(() => e.c.api._vglDiscoEscribirMdAhora(CED, { ts: MS_FIJA }));
      t.falso(tieneDir(e.raiz, ["Vigilante de Agenda"]),
        "el árbol simulado queda intacto: no se crea nada en la nada");
    });

    await t.casoAsync("C2: carpeta cambiada a mitad de mes — cada raíz con lo suyo, sin mezclas", async () => {
      const e = escenario({});
      e.c.api._vglCosechaGuardar(CED, { confirmaciones: { c2uno: { v: true } } });
      await dormir(4300);
      const mdA = contenidoDe(e.raiz, RUTA_MD(CED, FECHA));
      const memoA = contenidoDe(e.raiz,
        ["Vigilante de Agenda", "Memoria", { archivo: "vgl_cosecha.json" }]);
      t.cierto(typeof mdA === "string" && mdA.includes("- Sí — c2uno"), "primera carpeta con su historia");
      // El médico elige OTRA carpeta (una raíz DISTINTA e independiente).
      const raizB = { tipo: "dir", nombre: "RAIZ2", hijos: [], archivos: [] };
      e.c.api.__setCarpetaHandleParaTest(handleDe(raizB, { query: "granted" }, {}));
      // La caché de directorios se invalida con el handle: una LECTURA por
      // la vía del script justo tras el cambio no puede caer en la carpeta
      // vieja (vería su vgl_cosecha.json en vez del vacío de la nueva).
      const memoTrasCambio = await e.c.api._vglDiscoLeerArchivo(
        ["Vigilante de Agenda", "Memoria"], "vgl_cosecha.json");
      t.igual(memoTrasCambio, null,
        "la lectura tras el cambio ve la carpeta nueva vacía: la caché de directorios se invalidó");
      // Vía de producción: fusiona c2dos con la c2uno que vive en el navegador
      // (fusión plana de la interna, ver A2).
      e.c.api._vglConfirmacionGuardar(CED, "c2dos", true);
      await dormir(4300);
      const mdB = contenidoDe(raizB, RUTA_MD(CED, FECHA));
      t.cierto(typeof mdB === "string" && mdB.includes("- Sí — c2uno") && mdB.includes("- Sí — c2dos"),
        "la nueva carpeta recibe la historia COMPLETA, no solo lo nuevo");
      t.cierto(!!(memoriaDisco(raizB).cosecha[CED]), "y su propia Memoria");
      t.igual(contenidoDe(e.raiz, RUTA_MD(CED, FECHA)), mdA,
        "la carpeta vieja queda congelada byte a byte");
      t.igual(contenidoDe(e.raiz,
        ["Vigilante de Agenda", "Memoria", { archivo: "vgl_cosecha.json" }]), memoA,
        "la Memoria vieja tampoco se reescribe");
    });

    await t.casoAsync("C3: carpeta borrada JUSTO DESPUÉS de guardar — el fallo se traga y nada se pierde", async () => {
      const e = escenario({});
      e.c.api._vglCosechaGuardar(CED, { confirmaciones: { c3uno: { v: true } } });
      await dormir(4300);
      const mdAntes = contenidoDe(e.raiz, RUTA_MD(CED, FECHA));
      const memoAntes = contenidoDe(e.raiz,
        ["Vigilante de Agenda", "Memoria", { archivo: "vgl_cosecha.json" }]);
      e.estado.huerfana = true; // la carpeta muere entre el guardado y el disparo
      e.c.api._vglCosechaGuardar(CED, { confirmaciones: { c3dos: { v: true } } });
      await dormir(4300);
      t.igual(contenidoDe(e.raiz, RUTA_MD(CED, FECHA)), mdAntes, "el .md intacto");
      t.igual(contenidoDe(e.raiz,
        ["Vigilante de Agenda", "Memoria", { archivo: "vgl_cosecha.json" }]), memoAntes,
        "la Memoria intacta");
      const enNavegador = JSON.parse(e.c.env.almacen["vgl_cosecha"] || "{}");
      t.cierto(!!(enNavegador[CED] && enNavegador[CED].confirmaciones &&
        enNavegador[CED].confirmaciones.c3dos),
        "lo nuevo vive en el navegador: la consulta NO se pierde mientras la carpeta no vuelva");
    });

    // ===== BLOQUE D — FALLOS TRANSITORIOS DE createWritable ========
    await t.casoAsync("D1: un fallo suelto de createWritable — el reintento lo supera (v18.0.137)", async () => {
      const e = escenario({});
      await tocarMd(e.handle, CED, FECHA);
      const nodo = nodoArchivo(e.raiz, CED, FECHA);
      nodo._fallasCreateWritable = 1; // el antivirus lo retiene UNA vez, solo una
      const ok = await e.c.api._vglDiscoEscribirMdAhora(CED,
        { ts: MS_FIJA, confirmaciones: { d1directa: { v: true } } });
      t.cierto(ok, "la escritura inmediata devolvió true");
      const md = contenidoDe(e.raiz, RUTA_MD(CED, FECHA));
      t.cierto(typeof md === "string" && md.includes("- Sí — d1directa"),
        "y el .md quedó escrito pese al fallo");
      t.cierto(nodo._createWritableLlamadas >= 2, "el segundo intento hizo el trabajo");
    });

    await t.casoAsync("D2: fallos en cascada — sin crash, archivo vacío, y sana al volver", async () => {
      const e = escenario({});
      await tocarMd(e.handle, CED, FECHA);
      const nodo = nodoArchivo(e.raiz, CED, FECHA);
      nodo._fallasCreateWritable = 99; // la carpeta quedó bloqueada TODO el turno
      e.c.api._vglCosechaGuardar(CED, { confirmaciones: { d2a: { v: true } } });
      await dormir(4300); // el disparo llega, fracasa todo, y el proceso SIGUE VIVO
      t.igual(contenidoDe(e.raiz, RUTA_MD(CED, FECHA)), "",
        "el archivo EXISTE vacío (tocarMd lo creó): no es null ni basura parcial");
      const enNavegador = JSON.parse(e.c.env.almacen["vgl_cosecha"] || "{}");
      t.cierto(!!(enNavegador[CED] && enNavegador[CED].confirmaciones &&
        enNavegador[CED].confirmaciones.d2a),
        "mientras tanto el navegador guardó la consulta completa");
      nodo._fallasCreateWritable = 0; // la nube termina de sincronizar: ya se puede escribir
      // Vía de producción: fusiona d2c con la d2a del turno bloqueado
      // (fusión plana de la interna, ver A2).
      e.c.api._vglConfirmacionGuardar(CED, "d2c", true);
      await dormir(4300);
      const md = contenidoDe(e.raiz, RUTA_MD(CED, FECHA));
      t.cierto(typeof md === "string" && md.includes("- Sí — d2a") && md.includes("- Sí — d2c"),
        "al sanar la carpeta, la historia baja COMPLETA, con lo del turno bloqueado");
    });

    await t.casoAsync("D3: fallo transitorio JUNTO a la cuota llena — el rescate no se rinde (v18.0.137)", async () => {
      const e = escenario({});
      await tocarMd(e.handle, CED, FECHA);
      const nodo = nodoArchivo(e.raiz, CED, FECHA);
      nodo._fallasCreateWritable = 1; // y de paso el navegador rechaza el localStorage
      forzarCuota(e.c, "vgl_cosecha");
      e.c.api._vglCosechaGuardar(CED, { confirmaciones: { d3a: { v: true } } });
      await dormir(120); // el rescate de cuota corre YA, sin retardo
      const mem = memoriaDisco(e.raiz);
      t.cierto(!!(mem && mem.cosecha && mem.cosecha[CED]), "la Memoria bajó al disco intacta");
      await dormir(900); // el reintento del .md tarda en vencer al bloqueo
      const md = contenidoDe(e.raiz, RUTA_MD(CED, FECHA));
      t.cierto(typeof md === "string" && md.includes("# Historia del paciente " + CED),
        "y la historia .md también, pese a fallo + cuota a la vez");
      t.cierto(await e.c.api.vglDiscoRescatarCosecha(CED,
        { ts: MS_FIJA, confirmaciones: { directa: { v: true } } }, null),
        "cobertura: el rescate directo también vence un fallo transitorio");
    });

    // ========= BLOQUE E — EL PACIENTE REABRE DÍAS DESPUÉS: EL RELOJ CORRE =========
    // La memoria clínica vive semanas y el archivo del día se sella con la fecha
    // de la CONSULTA, no con la del reloj de quien lo escribe. Reabrir al paciente
    // dos días después debe nacer un .md nuevo sin tocar el del día anterior.
    await t.casoAsync("E1: el paciente REABRE dos días después — nace un .md nuevo y el viejo queda intacto", async () => {
      const e = escenario({ iso: "2026-03-03T10:15:00" }); // hoy es la consulta ANTERIOR
      e.c.api._vglCosechaGuardar(CED, { confirmaciones: { e1uno: { v: true } } });
      await dormir(4300); // el disparo sella la historia con el día 3
      const mdDia3 = contenidoDe(e.raiz, RUTA_MD(CED, DIA3));
      t.cierto(typeof mdDia3 === "string" && mdDia3.includes("- Sí — e1uno"),
        "la historia de la consulta anterior quedó en su archivo del día 3");
      e.caja.iso = "2026-03-05T10:15:00"; // DOS DÍAS DESPUÉS el mismo paciente vuelve
      // Vía de producción: la historia de hoy nace con TODO lo aprendido —
      // la e1uno de la consulta anterior se fusiona, no se abandona.
      e.c.api._vglConfirmacionGuardar(CED, "e1dos", true);
      await dormir(4300);
      const mdHoy = contenidoDe(e.raiz, RUTA_MD(CED, FECHA));
      t.cierto(typeof mdHoy === "string" && mdHoy.includes("- Sí — e1dos"),
        "la consulta de hoy abre su propio archivo del día 5");
      t.igual(contenidoDe(e.raiz, RUTA_MD(CED, DIA3)), mdDia3,
        "y la historia del día anterior queda byte a byte intacta");
    });

    await t.casoAsync("E2: la historia programada de un registro atrasado cae en SU día, no en el de hoy", async () => {
      const almacen = {
        vgl_cosecha: JSON.stringify({
          [CED]: { ts: MS_DIA3, confirmaciones: { previa: { v: true } } },
        }),
      };
      const e = escenario({ almacen }); // hoy es el 5; el registro quedó sellado el día 3
      e.c.api.vglDiscoHistoriaProgramar(CED); // cobertura del programador diferido
      await dormir(4300); // el disparo lee el registro AL DISPARAR (clave de la 75)
      const mdAtrasado = contenidoDe(e.raiz, RUTA_MD(CED, DIA3));
      t.cierto(typeof mdAtrasado === "string" && mdAtrasado.includes("- Sí — previa"),
        "la historia se archivó con la fecha de la CONSULTA, no con la del reloj");
      t.cierto(contenidoDe(e.raiz, RUTA_MD(CED, FECHA)) === null,
        "y no nace ningún archivo de hoy para un paciente que no se vio hoy");
    });

    await t.casoAsync("E3: activar la carpeta días después — restaura la memoria y migra UNA sola vez", async () => {
      const almacen = {};
      const e = escenario({ almacen });
      // La semana pasada el navegador quedó purgado por cuota; la carpeta conserva
      // al paciente del día 3 con su confirmación. Hoy el médico reactiva la carpeta.
      sembrarMemoria(e.raiz, { [CED]: { ts: MS_DIA3, confirmaciones: { previa: { v: true } } } }, MS_DIA3);
      t.cierto(await e.c.api._vglDiscoMemoriaRestaurar(),
        "la memoria del disco, más fresca que la del navegador vacío, se restaura");
      t.cierto(await e.c.api._vglDiscoActivar("prueba"),
        "la activación completa revive la carpeta sin abrir un solo diálogo");
      const mdDia3 = contenidoDe(e.raiz, RUTA_MD(CED, DIA3));
      t.cierto(typeof mdDia3 === "string" && mdDia3.includes("- Sí — previa"),
        "la migración volcó la historia del paciente con su confirmación de aquel día");
      t.cierto(contenidoDe(e.raiz, RUTA_MD(CED, FECHA)) === null,
        "sin archivo de HOY: el sello del registro manda sobre el reloj");
      t.falso(await e.c.api.vglDiscoMigrar(),
        "una segunda migración no corre: el candado ya quedó marcado");
      t.igual(almacen["vgl_disco_migrado"], "1",
        "el candado vive a la vista en el almacén del navegador");
    });
  },
};
