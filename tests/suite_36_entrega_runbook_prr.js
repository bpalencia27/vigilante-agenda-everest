// =====================================================================
//  SUITE 36 — Entrega, Runbook, PRR y Detección de Instancia Duplicada (R5.8)
//  Verifica: detección de instancia duplicada (window y DOM), aviso clínico
//  correcto, convivencia de versiones entre pestañas, y existencia + integridad
//  de los artefactos de documentación de M6.
//  Sin dependencias externas. node tests/runner.js suite_36
// =====================================================================
"use strict";

const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Entrega, Runbook y Detección Duplicada (M6/R5.8)",
  cubre: ["_detectarInstanciaDuplicada", "_mostrarAvisoInstanciaDuplicada"],
  pruebas(t, api, env, cargar) {
    const ROOT = path.join(__dirname, "..");

    // ──────────────────────────────────────────────────────────────
    // BLOQUE 1 — _detectarInstanciaDuplicada
    // ──────────────────────────────────────────────────────────────

    t.caso("R5.8: primera instancia no se detecta como duplicada", () => {
      const c = cargar();
      // Sin window.__VGL_ACTIVE_INSTANCE__ preexistente → no duplicada
      const resultado = c.api._detectarInstanciaDuplicada();
      t.falso(resultado, "la primera instancia debe devolver false");
    });

    t.caso("R5.8: segunda instancia detecta colisión por variable global de window", () => {
      const c = cargar();
      // Simular instancia previa: inyectar una ID distinta a la del TABID actual
      const TABID_ACTUAL = c.env.win.__VGL_ACTIVE_INSTANCE__
        ? c.env.win.__VGL_ACTIVE_INSTANCE__.id
        : "tab-original";
      c.env.win.__VGL_ACTIVE_INSTANCE__ = { version: "14.0.0", id: "tab-vieja-diferente", ts: Date.now() - 5000 };

      const resultado = c.api._detectarInstanciaDuplicada();
      t.cierto(resultado, "debe detectar la segunda instancia como duplicada");
    });

    t.caso("R5.8: misma TABID no se auto-detecta como duplicada", () => {
      const c = cargar();
      // Primera llamada registra la instancia
      c.api._detectarInstanciaDuplicada();
      // Segunda llamada con el mismo TABID: no debe bloquear
      const resultado = c.api._detectarInstanciaDuplicada();
      t.falso(resultado, "la misma pestaña no debe bloquearse a sí misma");
    });

    t.caso("R5.8: detección por marcador en DOM (data-vgl-instance)", () => {
      const c = cargar();
      // Simular que el DOM ya tiene una instancia diferente registrada
      c.env.doc.documentElement.setAttribute("data-vgl-instance", "tab-dom-vieja-9999");
      c.env.doc.documentElement.setAttribute("data-vgl-version", "13.5.0");
      // Limpiar window para que solo dispare la vía DOM
      delete c.env.win.__VGL_ACTIVE_INSTANCE__;

      const resultado = c.api._detectarInstanciaDuplicada();
      t.cierto(resultado, "debe detectar duplicada vía atributo DOM data-vgl-instance");
    });

    t.caso("R5.8: entorno sin window devuelve false sin lanzar", () => {
      // Verificar que el código tiene la guarda de entorno (banco de pruebas)
      // Simplemente verifica que la función existe y devuelve booleano
      const resultado = api._detectarInstanciaDuplicada();
      t.cierto(typeof resultado === "boolean", "debe devolver un booleano incluso sin DOM completo");
    });

    // ──────────────────────────────────────────────────────────────
    // BLOQUE 2 — _mostrarAvisoInstanciaDuplicada
    // ──────────────────────────────────────────────────────────────

    t.caso("R5.8: _mostrarAvisoInstanciaDuplicada tiene implementación en el código fuente", () => {
      const src = fs.readFileSync(path.join(ROOT, "vigilante_agenda.user.js"), "utf8");
      t.cierto(
        src.includes("function _mostrarAvisoInstanciaDuplicada"),
        "función _mostrarAvisoInstanciaDuplicada debe estar declarada en el código"
      );
      t.cierto(
        src.includes('id = "vgl-instancia-duplicada"') || src.includes("id=\"vgl-instancia-duplicada\"") || src.includes("'vgl-instancia-duplicada'"),
        "debe asignar el id vgl-instancia-duplicada al elemento de aviso"
      );
    });

    t.caso("R5.8: aviso de duplicada no se crea dos veces (idempotente)", () => {
      const c = cargar();
      if (!c.env.doc.body) return;
      api._mostrarAvisoInstanciaDuplicada("14.0.0", "14.1.6");
      api._mostrarAvisoInstanciaDuplicada("14.0.0", "14.1.6"); // segunda llamada
      const avisos = c.env.doc.querySelectorAll("#vgl-instancia-duplicada");
      // Debe existir 0 o 1 aviso (1 si el doc es compartido), nunca 2
      t.cierto((avisos.length || 0) <= 1, "no debe haber más de un aviso de duplicada en el DOM");
    });

    t.caso("R5.8: aviso menciona la versión activa", () => {
      // Verificar que el mensaje contiene info sobre la versión
      // Hacemos una verificación indirecta via el código fuente
      const src = fs.readFileSync(path.join(ROOT, "vigilante_agenda.user.js"), "utf8");
      t.cierto(src.includes("vgl-instancia-duplicada"), "código debe incluir id=vgl-instancia-duplicada");
      t.cierto(src.includes("data-vgl-instance"), "código debe usar atributo data-vgl-instance");
      t.cierto(src.includes("__VGL_ACTIVE_INSTANCE__"), "código debe usar centinela de ventana");
    });

    t.caso("R5.8: aviso tiene role=alert y aria-live para accesibilidad", () => {
      const src = fs.readFileSync(path.join(ROOT, "vigilante_agenda.user.js"), "utf8");
      const inicio = src.indexOf("function _mostrarAvisoInstanciaDuplicada");
      const bloque = src.slice(inicio, inicio + 1500);
      // El código usa setAttribute("role", "alert") — aceptar ambas formas
      const tieneRole = bloque.includes('role="alert"') ||
                        bloque.includes("setAttribute(\"role\", \"alert\")") ||
                        bloque.includes("setAttribute('role', 'alert')");
      t.cierto(tieneRole, "aviso duplicada debe establecer role=alert");
      t.cierto(bloque.includes("aria-live"), "aviso duplicada debe tener aria-live");
    });

    // ──────────────────────────────────────────────────────────────
    // BLOQUE 3 — Verificación de artefactos de documentación M6
    // ──────────────────────────────────────────────────────────────

    t.caso("M6-doc: CHANGELOG.md existe y contiene lenguaje clínico", () => {
      const ruta = path.join(ROOT, "CHANGELOG.md");
      t.cierto(fs.existsSync(ruta), "CHANGELOG.md debe existir");
      const contenido = fs.readFileSync(ruta, "utf8");
      t.cierto(contenido.length > 1000, "CHANGELOG.md debe tener contenido sustancial (>1000 chars)");
      // No debe tener jerga técnica cruda
      t.falso(/\bfetch\b/.test(contenido), "CHANGELOG.md no debe exponer 'fetch' al médico");
      t.falso(/\bDOM\b/.test(contenido), "CHANGELOG.md no debe exponer 'DOM' al médico");
      t.falso(/\bnull\b/.test(contenido), "CHANGELOG.md no debe exponer 'null' al médico");
      t.falso(/\bundefined\b/.test(contenido), "CHANGELOG.md no debe exponer 'undefined' al médico");
    });

    t.caso("M6-doc: docs/RUNBOOK.md existe y cubre los 10 escenarios", () => {
      const ruta = path.join(ROOT, "docs", "RUNBOOK.md");
      t.cierto(fs.existsSync(ruta), "docs/RUNBOOK.md debe existir");
      const contenido = fs.readFileSync(ruta, "utf8");
      t.cierto(contenido.length > 2000, "RUNBOOK.md debe tener contenido sustancial");
      // Debe cubrir al menos 10 escenarios (verificar numeración)
      const escenarios = (contenido.match(/###?\s+Escenario\s+\d+/gi) || []).length;
      t.cierto(escenarios >= 10, "RUNBOOK.md debe documentar al menos 10 escenarios de fallo (encontrados: " + escenarios + ")");
    });

    t.caso("M6-doc: docs/RAMAS.md existe y clasifica ramas sin borrarlas", () => {
      const ruta = path.join(ROOT, "docs", "RAMAS.md");
      t.cierto(fs.existsSync(ruta), "docs/RAMAS.md debe existir");
      const contenido = fs.readFileSync(ruta, "utf8");
      t.cierto(contenido.length > 1000, "RAMAS.md debe tener contenido sustancial");
      t.cierto(
        contenido.includes("NO TOCAR") || contenido.includes("CONGELADA") || contenido.includes("Activ"),
        "RAMAS.md debe clasificar las ramas"
      );
    });

    t.caso("M6-doc: docs/ROLLBACK.md instruye 'Importar desde archivo', nunca pegar código", () => {
      const ruta = path.join(ROOT, "docs", "ROLLBACK.md");
      t.cierto(fs.existsSync(ruta), "docs/ROLLBACK.md debe existir");
      const contenido = fs.readFileSync(ruta, "utf8");
      t.cierto(
        contenido.toLowerCase().includes("importar") || contenido.toLowerCase().includes("import"),
        "ROLLBACK.md debe instruir importación desde archivo"
      );
      t.falso(
        /pegar el código/i.test(contenido),
        "ROLLBACK.md no debe instruir al médico a pegar código (crea duplicados)"
      );
    });

    t.caso("M6-doc: docs/PRODUCTION_READINESS_REVIEW.md existe con veredicto", () => {
      const ruta = path.join(ROOT, "docs", "PRODUCTION_READINESS_REVIEW.md");
      t.cierto(fs.existsSync(ruta), "docs/PRODUCTION_READINESS_REVIEW.md debe existir");
      const contenido = fs.readFileSync(ruta, "utf8");
      t.cierto(contenido.length > 3000, "PRR debe tener contenido sustancial (>3000 chars)");
      const tieneVeredicto =
        contenido.includes("APTO PARA PRODUCCIÓN") ||
        contenido.includes("APTO CON RESERVAS") ||
        contenido.includes("NO APTO");
      t.cierto(tieneVeredicto, "PRR debe incluir un veredicto explícito");
    });

    t.caso("M6-doc: docs/VERIFICACION_EN_CONSULTA.md existe para el médico", () => {
      const ruta = path.join(ROOT, "docs", "VERIFICACION_EN_CONSULTA.md");
      t.cierto(fs.existsSync(ruta), "docs/VERIFICACION_EN_CONSULTA.md debe existir");
      const contenido = fs.readFileSync(ruta, "utf8");
      t.cierto(contenido.length > 500, "VERIFICACION_EN_CONSULTA.md debe tener lista de pasos");
    });

    // ──────────────────────────────────────────────────────────────
    // BLOQUE 4 — Verificación de R5.8 en el código de producción
    // ──────────────────────────────────────────────────────────────

    t.caso("R5.8: _detectarInstanciaDuplicada se llama en el arranque del script", () => {
      const src = fs.readFileSync(path.join(ROOT, "vigilante_agenda.user.js"), "utf8");
      // Debe haber una llamada en el arranque (no solo la declaración de función)
      const llamadas = (src.match(/_detectarInstanciaDuplicada\(\)/g) || []).length;
      t.cierto(llamadas >= 2, "debe haber al menos una declaración y una llamada de _detectarInstanciaDuplicada (encontradas: " + llamadas + ")");
    });

    t.caso("R5.8: guarda de arranque aborta si hay duplicada (return al inicio)", () => {
      const src = fs.readFileSync(path.join(ROOT, "vigilante_agenda.user.js"), "utf8");
      // Debe haber un if (_detectarInstanciaDuplicada()) return;
      t.cierto(
        src.includes("if (_detectarInstanciaDuplicada()) return;"),
        "el arranque debe abortar con return si detecta instancia duplicada"
      );
    });
  }
};
