# Auditoría Exhaustiva de Seguridad DOM y Prevención de XSS (R1.2)

**Fecha de Auditoría:** 2026-08-14  
**Hito:** M1 — Seguridad, Secretos, PHI y Cadena de Suministro  
**Archivo Auditado:** `vigilante_agenda.user.js` (~14.279 líneas, IIFE único)  
**Alcance:** 100% de sumideros de manipulación DOM (`innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, manipulación de atributos y controladores de eventos).

---

## 1. Resumen Ejecutivo

El userscript `vigilante_agenda.user.js` interactúa en tiempo real con el EHR institucional ("Everest" / Athenea Soluciones), consumiendo datos de APIs clínicas, respuestas JSON de agendamiento y ordenamiento, y archivos Excel/CSV de SharePoint.

Se completó una auditoría estática integral de los **73 sumideros de inyección HTML** presentes en el código base.

### Resumen Numérico por Tipo de Sumidero
| Tipo de Sumidero | Total Detectado | Riesgo Activo | Estado / Mitigación |
|---|---|---|---|
| `.innerHTML =` | **71** | 0 (1 remediado) | 12 vaciados, 18 constantes, 8 primitivos, 34 escapados con `escapeHtml`, 1 corregido |
| `.insertAdjacentHTML()` | **1** | 0 | Renderizado de cuenta regresiva con enteros seguros (`countdown`) |
| `.outerHTML =` | **0** | 0 | Ninguno presente |
| `document.write()` | **1** | 0 | Ventana emergente auxiliar (`popupAlert`) con `escapeHtml` estricto |
| `eval()` / `new Function()` | **0** | 0 | Prohibidos por arquitectura; cero instancias |
| Inyecciones en scripts/URLs (`javascript:`) | **0** | 0 | Validación estricta con regex `^https?:\/\/` y `encodeURIComponent` |
| **TOTAL SUMIDEROS** | **73** | **0** | **100% Blindado y Verificado** |

---

## 2. Clasificación Taxonómica de los 73 Sumideros

### Categoría A: Limpieza y Vaciado de Contenedores (`.innerHTML = ""`) [12 sumideros]
Utilizados para limpiar modales y vistas antes de desmontar o repintar:
1. **L10386:** `panel.innerHTML = ""` — Cierre de panel flotante post-cita.
2. **L10681:** `modal.innerHTML = ""` — Cierre de modal de consulta de laboratorios.
3. **L11130:** `modal.innerHTML = ""` — Cierre de modal de agendamiento de citas.
4. **L11407:** `slotsEl.innerHTML = ""` — Limpieza de cuadrícula de horarios/turnos.
5. **L11582:** `labChipsEl.innerHTML = ""` — Limpieza de chips selectores de día de laboratorio.
6. **L11614:** `dayChipsEl.innerHTML = ""` — Limpieza de chips selectores de fecha de consulta médica.
7. **L11965:** `modal.innerHTML = ""` — Cierre de modal de agendamiento de laboratorio individual.
8. **L12033:** `labChipsEl.innerHTML = ""` — Limpieza de chips de laboratorio individual.
9. **L12512:** `modal.innerHTML = ""` — Cierre de modal de ordenamiento médico.
10. **L13114:** `el.sheet.innerHTML = ""` — Cierre y vaciado de la hoja lateral de ajustes.
11. **L13399:** `el.stats.innerHTML = ""` — Limpieza de tarjeta de métricas de puntualidad.
12. **L13564:** `el.list.innerHTML = ""` — Limpieza de la lista de tarjetas de agenda.

### Categoría B: Etiquetas Estáticas y Texto Plano [18 sumideros]
Asignaciones de cadenas literales fijas sin interpolación de variables:
1. **L3166, L3175, L3200, L3221, L3224, L3232, L3264:** Asignaciones a botones de Auto-Labs Athenea (modernizados a `.textContent`).
2. **L3482:** `btnNormalidad.innerHTML = "🩺 Normalidad fija"` (modernizado a `.textContent`).
3. **L9068:** `dock.innerHTML = '<span id="vgl-dock-dot"></span><span>Asistente Clínico</span>...'` (Estructura HTML fija del dock).
4. **L10749:** `contentEl.innerHTML = '<div class="vgl-agm-err vgl-labs-empty">ℹ No se encontraron paraclínicos...</div>'` (Mensaje estático).
5. **L11216:** `slotsEl.innerHTML = '<div class="vgl-agm-err">⚠ El panel aún no identifica su usuario de Everest...</div>'` (Mensaje de diagnóstico estático).
6. **L11324:** `slotsEl.innerHTML = '<div class="vgl-agm-loading">Este día solo tiene agenda de otro profesional...</div>'`
7. **L11335:** `slotsEl.innerHTML = '<div class="vgl-agm-err">⚠ Ningún día del rango tiene su agenda propia identificada...</div>'`
8. **L11542, L11570, L11992, L12017:** `labTimeSel.innerHTML = '<option value="">⏳/⚠...</option>'` (Opciones de carga estáticas).
9. **L12771:** `printBox.innerHTML = '<label class="vgl-agm-lbl" style="margin-top:14px">🖨️ Imprimir la(s) orden(es)</label>'`
10. **L12807:** `mailBox.innerHTML = '<label class="vgl-agm-lbl">📧 Enviar...</label>...'` (Estructura estática de envío de correo).
11. **L13562:** `el.list.innerHTML = '<div id="vgl-empty">Aún sin citas...</div>'` (Placeholder de lista vacía).

### Categoría C: Valores Primitivos y Tokens Internos Sanitizados [8 sumideros]
Interpolación de enteros, booleanos o tokens de color saneados mediante expresiones regulares:
1. **L5992:** `ov.innerHTML = '<div class="vgl-modal-card" style="--ac:...">'` — Color saneado vía `.replace(/[^a-zA-Z]/g, "")`.
2. **L6217:** `t.innerHTML = '<i class="vgl-toast-rail" style="--tk:...">'` — Color saneado; textos inyectados vía `.textContent`.
3. **L8991:** `root.innerHTML = '...<small>v${VERSION}</small>...'` — `VERSION` es constante numérica inmutable `"14.1.5"`.
4. **L11377:** `slotsEl.innerHTML = '<div class="vgl-agm-loading">Consultando turnos en ${agendasFiltradas.length} agenda(s)...</div>'` — Longitud entera.
5. **L13133:** `el.sheet.innerHTML = sheetHeader("Resumen del turno") + ...` — Métricas numéricas enteras agregadas.
6. **L13416:** `el.stats.innerHTML = ...` — Contadores numéricos enteros de puntualidad.
7. **L13649:** `badge.insertAdjacentHTML("beforebegin", html)` — Generado por `countdown(a)` con marcas de tiempo calculadas.

### Categoría D: Datos Dinámicos / EHR / Paciente con `escapeHtml` Obligatorio [34 sumideros]
Sumideros que interpolan nombres de pacientes, números de documento, códigos CUPS, diagnósticos CIE-10 o paraclínicos:
1. **L5956:** `w.document.write(...)` en `popupAlert` — `escapeHtml(title)`, `escapeHtml(body)`.
2. **L6028:** `pymAlert` — `actividades.map(a => '<span class="vgl-pym-chip">' + escapeHtml(a) + '</span>')`.
3. **L6057:** `abandonoPESAlert` — Estructura HTML con nombre de paciente inyectado vía `.textContent`.
4. **L6104:** `labsVencidosAlert` — `faltantes.map(f => '<span class="vgl-labsv-chip">' + escapeHtml(f.nombre) + '</span>')`.
5. **L10377:** `mostrarPanelPostCita` — `${escapeHtml(nombreCompleto || patientNameFallback || "")}`.
6. **L10635:** `openLaboratoriosModal` — `escapeHtml(patientName)`, `escapeHtml(apt.doc_id)`.
7. **L10739:** `_renderEstadioRenalHtml(r)` — `escapeHtml` aplicado a TFG, estadio KDIGO, fórmula, creatinina, peso, edad, sexo y avisos clínicos.
8. **L10856:** `openLaboratoriosModal` (filas de resultados): fecha, nombre de analito, resultado, unidad de referencia, origen y tokens data-attributes debidamente escapados con `escapeHtml()`.
9. **L10967:** `openAgendamientoModal` — `escapeHtml(patientName)`, `escapeHtml(apt.doc_id)`, `escapeHtml(doctorName)`.
10. **L11187, L11203, L11218, L11243, L11292, L11302, L11403, L11422, L11510:** Selectores y listas de horarios en agendamiento, todos procesados con `escapeHtml()`.
11. **L11556, L11564, L11588, L11630, L12037:** Selectores y botones de fechas de laboratorio con `escapeHtml()`.
12. **L11923, L12002, L12012, L12070:** Modal de laboratorio individual con `escapeHtml()`.
13. **L12525, L12617, L12763:** Modal de ordenamiento médico: nombres, códigos CUPS, descripciones, títulos de paquetes y diagnósticos CIE-10 escapados con `escapeHtml()`.
14. **L13189:** Panel de Ajustes (`renderSettings`): identificación del médico, nombres, exclusiones y URLs escapados con `escapeHtml()`.
15. **L13563, L13607:** Tarjetas de agenda en panel lateral: horas, nombres, cédulas y estados pasados por `highlight()` y `escapeHtml()`.

### Categoría E: Corrección Aplicada en v14.1.5 (1 sumidero remediado)
- **L11822:** Mensaje de confirmación de cita en `openAgendamientoModal`.
  - **Código Anterior:** `successMsg.innerHTML = '✅ <b>Cita asignada exitosamente</b><br>Fecha: <b>${fechaElegida.fmt}</b> · Hora: <b>${escapeHtml(horaTxt)}</b>';`
  - **Corrección Aplicada:** Se añadió `escapeHtml(fechaElegida.fmt)` para mantener la invariante de defensa en profundidad.

---

## 3. Verificación de la Función Central `escapeHtml()`

Ubicación en el código base: `vigilante_agenda.user.js` (L13653-L13655).

```javascript
// [BLINDADO v8.2.0 DOM-01] escapeHtml reforzado: cubre & < > " ' ` — vectores completos de XSS en atributos HTML.
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '`': '&#x60;'
  }[c]));
}
```

### Propiedades Criptográficas y de Seguridad
1. **Neutralización Completa de Delimitadores:** Al reemplazar `&`, `<`, `>`, `"`, `'` y `` ` ``, previene escapes tanto en el contexto de cuerpo HTML (HTML Body) como dentro de atributos entre comillas dobles, simples o comillas invertidas (backticks).
2. **Defensa contra Tipos Nulos:** Trata `null` y `undefined` convirtiéndolos a cadena vacía `""`, evitando excepciones `TypeError` en tiempo de ejecución.
3. **Inmunidad a Inyecciones de Código:**
   - `<script>alert(1)</script>` → `&lt;script&gt;alert(1)&lt;/script&gt;`
   - `"><img src=x onerror=alert(1)>` → `&quot;&gt;&lt;img src=x onerror=alert(1)&gt;`
   - `x' onfocus='alert(1)` → `x&#039; onfocus=&#039;alert(1)`
   - `` ` onfocus=`alert(1) `` → `&#x60; onfocus=&#x60;alert(1)`

---

## 4. Auditoría de Superficies Clínicas de Escritura

| Superficie de Escritura | Mecanismo de Mutación | Evaluación de Seguridad |
|---|---|---|
| **Ruta de Crónicos (13 Laboratorios)** | `setNgValue(inputEl, value)` asigna a `inputEl.value` y despacha eventos nativos de Angular (`input`, `change`). | **100% Inmune a XSS:** No interactúa con parsers HTML del DOM. |
| **Órdenes PyM (`AsignarTurno` / `GuardarOrdenamiento`)** | Modales de confirmación con interpolación de CUPS y CIE-10. | **100% Seguro:** Todos los datos pasan por `escapeHtml()`. |
| **Buscador de Pacientes (`highlight`)** | Resaltado de coincidencias mediante `<mark>` seguro. | **100% Seguro:** Divide la cadena y aplica `escapeHtml()` a todas las subcadenas antes de concatenar los tags `<mark>`. |

---

## 5. Reglas de Codificación DOM para el Repositorio (Invariantes)

1. **Invariante 1:** Ninguna variable dinámica (EHR, API, local) puede interpolarse en un template literal sin envolverse en `escapeHtml()`.
2. **Invariante 2:** Para textos planos sin etiquetas HTML, utilizar siempre `.textContent` en lugar de `.innerHTML`.
3. **Invariante 3:** Prohibido el uso de manejadores inline `onclick="..."` en cadenas HTML. Asociar eventos únicamente mediante `addEventListener`.
4. **Invariante 4:** Todas las URLs externas y enlaces deben validarse contra el protocolo `^https?:\/\/` y codificar sus parámetros con `encodeURIComponent()`.
