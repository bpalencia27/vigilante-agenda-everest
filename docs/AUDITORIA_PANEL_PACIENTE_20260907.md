# Auditoría del panel modal de paciente (#vgl-panel-modal)

Fecha: 2026-09-07 · Objeto: `openPanelPacienteModal` y su cadena (L26747-27150+ de `vigilante_agenda.user.js`).
Método: lectura de código con evidencia de línea + historial de regresiones documentado en comentarios y en `tests/INFORME_MUTACIONES.md`. Cero PHI en este documento.

## 1. Qué es y cómo abre

Panel flotante con 5 pestañas (Resumen · Tendencias · Medicamentos · Exámenes · Riesgo renal) que fusionó Ficha/Riesgo/Tablero (v16.8.0). Antes de pintarse pueden interponerse hasta DOS diálogos previos: el reconciliador de contradicciones (L26775) y el llenado de campos en blanco (L26810).

## 2. Hallazgos

### Usabilidad (UX)

| # | Hallazgo | Evidencia | Severidad |
|---|---|---|---|
| U1 | Hasta 2 diálogos previos antes de ver el panel (reconciliador → llenado). Si el médico solo quiere VER, la fricción acumulada puede sentirse como bloqueo | L26775-26820 | Media |
| U2 | El switch de pestañas NO hace peticiones nuevas (`pintar("")` reutiliza `_resumen`) — respuesta instantánea | L26951, L26964 | ✔ Fortaleza |
| U3 | La edición en línea (meta HbA1c, años de DM) valida y muestra el error EN la fila, sin repintar el cuerpo (no se pierde lo escrito) | L27013-27045 | ✔ Fortaleza (nació de una regresión: v17.6.0 escribía el aviso en la barra de la AGENDA) |
| U4 | Frescura de datos honesta: distingue «recién calculado» / «hace N min» / «no puedo precisar» y avisa si el peso que rige Cockcroft-Gault es de otra fecha | L26916-26935 | ✔ Fortaleza (corrigió una etiqueta que se reiniciaba a lo tranquilizador, v17.0.2) |
| U5 | Esquina inferior derecha congestionada: el panel compite con post-cita, toast del piloto y Deshacer (auditado en `docs/uiux/ui_estetico_20260902.md`) | — | Media (ya priorizada por UX previa) |
| U6 | «Buscar laboratorios nuevos» deshabilita el botón mientras trabaja y conserva los últimos datos buenos si Athenea falla | L26969-26989 | ✔ Fortaleza (v18.0.131) |

### Rendimiento

| # | Hallazgo | Evidencia | Severidad |
|---|---|---|---|
| R1 | Apertura desde caché (`mtrCacheResumenLeer`) → primer pintado sin espera de red | L27094 | ✔ Fortaleza |
| R2 | Vigilancia de 20 s con autolimpieza; un panel MINIMIZADO se considera dormido y cancela su temporizador (antes latía toda la jornada reteniendo el resumen) | L26831-26845 | ✔ Fortaleza (v17.0.2) |
| R3 | Repintado automático cuando OTRO módulo invalida la caché (firma de medicamentos) — sin polling extra | L26860-26872 | ✔ Fortaleza |
| R4 | El refresco manual (`fresco:true`) depende de Athenea (portal externo): sin barra de progreso ni tope de tiempo visible en el propio panel; el único feedback es «Buscando…» | L26970-26983 | Media |
| R5 | `pintar()` reconstruye `innerHTML` del cuerpo completo en cada tick de vigilancia aunque nada haya cambiado (la firma solo se compara para meds) | L26874-26943 | Baja |

### Accesibilidad (a11y)

| # | Hallazgo | Evidencia | Severidad |
|---|---|---|---|
| A1 | `role=dialog`, `aria-modal`, cierre por ✕ con `aria-label`, Escape vía `_activarAccesibilidadModal` | L26828-26857 | ✔ Base sólida |
| A2 | La pestaña activa expone estado (al día/revisar/sin dato) derivado de los MISMOS datos del tablero (no-divergencia v17.24.0) | L26878-26895 | ✔ Fortaleza |
| A3 | El repintado del cuerpo no tiene `aria-live`: un lector de pantalla no anuncia que el contenido se renovó tras «Buscar laboratorios nuevos» | L26936-26943 | Media |
| A4 | Botones de pestaña son `<button>` (foco nativo); las tarjetas-bento usan Enter/Espacio (L26967) | — | ✔ |
| A5 | Colores colgados de tokens (`--fg/--fg2/--t-*`) con `!important` en las reglas fuera de `#vgl-root` — blindaje verificado contra el CSS de Everest | L18532-18547 | ✔ Fortaleza |

### Seguridad y datos sensibles

| # | Hallazgo | Evidencia | Severidad |
|---|---|---|---|
| S1 | Nombre y valores escapados (`escapeHtml`) en título, avisos y filas; los payloads del usuario jamás entran crudos | L26849, L26936-26939 | ✔ |
| S2 | El cierre vacía `innerHTML` y remueve el nodo (no queda DOM huérfano con datos) | L26840-26845 | ✔ |
| S3 | `dataset.vglDoc` identifica de quién es el panel (trazabilidad anti-cruce de pacientes) | L26830 | ✔ |
| S4 | Memoria clínica persistida CIFRADA en disco (AES-GCM, suites 75/76/H5) — el panel solo la lee | suites H5 | ✔ |
| S5 | El panel muestra diagnóstico, riesgo y medicamentos en pantalla completa: en sala compartida es legible a distancia; no hay modo «vista reducida» ni mascarado del documento en el título | L26846-26854 | Media |
| S6 | Compuerta de capacidades antes de abrir (`panel_paciente` es de COMPLETO): un perfil LABORATORIOS no puede abrirlo | L26750 | ✔ |

## 3. Propuesta de mejoras (priorizada)

**P1 — alto valor, riesgo bajo**
1. `aria-live="polite"` en `#vgl-panel-cuerpo` (A3): una línea en la plantilla; anuncia los repintados.
2. Mascarar el documento en el subtítulo (`···111`) con un clic para revelar (S5), mismo patrón de `_mtrCelularMascarado`.
3. Feedback temporal en «Buscar laboratorios nuevos» (R4): convertir el texto en cronómetro suave («Buscando… 3 s») usando el patrón de `esperar` ya existente en otros módulos; y documentar el tope real de `_fetchConTope` para Athenea.

**P2 — valor medio**
4. Botón «Ahora no» en el llenado de campos para saltarlo sin cerrar el panel (U1) — ya existe la salida «Ahora no» en el reconciliador de MEDIDAS; unificar el patrón.
5. `pintar()` con firma corta del resumen completo (no solo meds) para omitir el repintado idéntico (R5).

**P3 — depende de la auditoría UX global**
6. Presupuesto de esquinas (U5): la solución ya está diseñada en `docs/uiux/ui_estetico_20260902.md` (escalonar post-cita/sp/deshacer a `right:728px`).

## 4. Pruebas de validación sugeridas

- Cada mejora P1/P2 entra como **caso hermano** en `suite_15`/`suite_63` con aserción positiva (el arnés lee `innerHTML`, nunca `textContent`) y **fila en `tests/INFORME_MUTACIONES.md`** (romper → rojo → restaurar → verde).
- El mascarado del documento: caso con documento de 10 dígitos → el HTML pintado no contiene el documento completo, y el clic de revelar lo muestra (dos aserciones: una negativa y una positiva).
- `aria-live`: aserción sobre el atributo del contenedor en la plantilla (prueba de fuente, patrón ya usado por la suite de embudos).
- Verificación visual (regla del proyecto para color/tamaño computado): Playwright sobre `tests/harness.js` + `buildOverlay()` con `getComputedStyle`, no `innerHTML.includes`.

## 5. Conclusión

El panel está en estado **sólido**: las regresiones históricas (temporador zombi, aviso en la barra equivocada, etiqueta de frescura) ya están cerradas y blindadas por el banco. Las carencias restantes son de **anuncio de cambios (a11y), privacidad visual y feedback de red**, todas P1/P2 y de superficie — ninguna toca la lectura o el cálculo clínico.
