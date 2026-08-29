// Diagnóstico temporal #3b: labs vacío, ordenamiento sin coincidencia, v15 banner
const { cargar } = require("./tests/harness.js");

function enriquecerDom(c) {
  const doc = c.env.doc;
  const crearBase = doc.createElement;
  doc.createElement = function (tag) {
    const e = crearBase(tag);
    const memo = new Map();
    e.querySelector = (sel) => {
      if (!memo.has(sel)) memo.set(sel, doc.createElement("div"));
      return memo.get(sel);
    };
    e.querySelectorAll = () => [];
    return e;
  };
  doc.createDocumentFragment = () => {
    const f = doc.createElement("div");
    f._esFragmento = true;
    return f;
  };
}

(async () => {
  // ---- openLaboratoriosModal sin datos (fallo de red) ----
  let labsSinDatos = false;
  const cModal = await cargar({
    silencioso: true,
    gmxhr: (o) => {
      if (labsSinDatos) { if (o.onerror) o.onerror("sin red"); return; }
      const url = o.url;
      if (url.endsWith("/Resultados/BusquedaPaciente")) o.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="TOK1">' });
      else if (url.endsWith("/Resultados/BuscarPaciente")) o.onload({ status: 200, responseText: '<input name="IdPaciente" value="55555"><input name="__RequestVerificationToken" value="TOK2">' });
      else if (url.endsWith("/Resultados/DatosPaciente")) o.onload({ status: 200, responseText: 'CC 12345678 <form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"></form>' });
      else if (url.includes("consultaDetalleSolicitud")) o.onload({ status: 200, responseText: JSON.stringify({ dataObject: JSON.stringify([{ NombreParametro: "CREATININA", Resultado: "1.2", Fecha: "2026-08-01", ValoresReferencia: "Elevado" }]) }) });
      else if (o.onerror) o.onerror("url no simulada");
    },
  });
  enriquecerDom(cModal);
  const ultimoModal = (id) => cModal.env.doc.body.children.filter((n) => n.id === id).pop();
  labsSinDatos = true;
  await cModal.api.openLaboratoriosModal({ doc_id: "87654321", nombre: "PEDRO" });
  const contenidoLabs = ultimoModal("vgl-labs-modal").querySelector("#vgl-labs-content");
  console.log("== Labs: 'No pude leer el portal'?", contenidoLabs.innerHTML.includes("No pude leer el portal de Athenea"));
  console.log("== Labs: 'Esto NO quiere decir que no tenga ninguno'?", contenidoLabs.innerHTML.includes("Esto NO quiere decir que no tenga ninguno"));
  console.log("== Labs: 'no tiene ningún paraclínico'?", contenidoLabs.innerHTML.includes("no tiene ningún paraclínico registrado"));
  console.log("== Labs: 'resultado de ejemplo'?", contenidoLabs.innerHTML.includes("No se muestra ningún resultado de ejemplo"));
  labsSinDatos = false;

  // ---- openOrdenamientoModal sin coincidencia ----
  const cOrd = await cargar({ silencioso: true });
  enriquecerDom(cOrd);
  const ultimoOrd = () => cOrd.env.doc.body.children.filter((n) => n.id === "vgl-ordenar-modal").pop();

  // Caso 1: estado de fábrica (lista NO cargada)
  await cOrd.api.openOrdenamientoModal({ doc_id: "999", nombre: "PEDRO GOMEZ", pym: [] });
  const m1 = ultimoOrd();
  console.log("\n== Ord sin lista: 'No tengo cargada la lista'?", m1.innerHTML.includes("No tengo cargada la lista de prevención de hoy"));
  console.log("== Ord sin lista: 'Sin actividades para ordenar'?", m1.innerHTML.includes("Sin actividades para ordenar"));
  console.log("== Ord sin lista: 'No hay lista que consultar'?", m1.innerHTML.includes("No hay lista que consultar"));
  console.log("== Ord sin lista: items?", m1.innerHTML.split("vgl-ord-item").length - 1, "| checked?", m1.innerHTML.includes(" checked"));

  // Caso 2: lista de HOY cargada, paciente en ella sin pendientes
  const h = new Date();
  const hoy = h.getFullYear() + "-" + String(h.getMonth() + 1).padStart(2, "0") + "-" + String(h.getDate()).padStart(2, "0");
  cOrd.api.__state.pymFile = "Agenda_Dia_CMB.xlsx";
  cOrd.api.__state.pymDia = hoy;
  cOrd.api.__state.pymTodos = new Set(["999"]);
  cOrd.api.__state.pymFallback = false;
  await cOrd.api.openOrdenamientoModal({ doc_id: "999", nombre: "PEDRO GOMEZ", pym: [] });
  const m2 = ultimoOrd();
  console.log("\n== Ord con lista: 'no tiene actividades pendientes'?", m2.innerHTML.includes("no tiene actividades pendientes"));
  console.log("== Ord con lista: 'Sin actividades para ordenar'?", m2.innerHTML.includes("Sin actividades para ordenar"));
  console.log("== Ord con lista: items?", m2.innerHTML.split("vgl-ord-item").length - 1, "| checked?", m2.innerHTML.includes(" checked"));

  // ---- v15 banner ----
  console.log("\n== __S.bannerPym:", JSON.stringify(cOrd.api.__S.bannerPym), "| avisoPymModal:", JSON.stringify(cOrd.api.__S.avisoPymModal));
  console.log("== localStorage vgl_v15_banner:", JSON.stringify(cOrd.env.win.localStorage.getItem("vgl_v15_banner")));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
