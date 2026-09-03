# Auditoría exhaustiva de rendimiento y ciberseguridad — 3 de septiembre de 2026

**Objeto:** `vigilante_agenda.user.js` v18.0.133 (47.320 líneas), rama `claude/pym-activities-display-issue-cki2ew`, commit `298e632`.
**Alcance:** rendimiento (CPU, timers, memoria, arranque) y ciberseguridad (inyección DOM/XSS, secretos y egreso de datos, red, almacenamiento, cadena de actualización). Auditoría de solo lectura: no se modificó ni una línea del script ni del banco de pruebas.
**Método:** mapeo completo de superficies (sumideros DOM, timers, listeners, almacenamiento, llamadas de red), cuatro barridos temáticos independientes y una ronda de refutación donde cada hallazgo se verificó personalmente contra el código antes de entrar en este informe. Todo hallazgo que resultó ser una decisión ya tomada por el dueño o por el médico, documentada en el propio código, se reclasificó y se lista en la sección 3, no como defecto.

---

## 1. Resumen ejecutivo

| Severidad | Hallazgos confirmados |
|---|---|
| ALTA | 3 (1 de seguridad de cadena de actualización, 1 de permanencia de datos, 1 de CPU) |
| MEDIA | 8 |
| BAJA | 13 |
| Refutados / by-design | 10 |

**Veredicto general.** La postura de seguridad del día a día es sólida: cero sumideros XSS abiertos en 146 mapeados, cero secretos vivos en el código, red contenida por `@connect`, tachado de PII hacia la IA con capa dedicada de nombres reales y arranque limpio y diferido. Los problemas reales están en tres frentes: la cadena de actualización tiene un control de integridad que existe pero está dormido (nadie publica el hash que él exige), el almacén del gestor de scripts acumula un volcado de hasta 12 MB que nadie purga, y el corazón del script —la cosecha de la agenda— repite cada 5 segundos trabajo que en gran parte no cambia entre ticks, que es el tirón de CPU que el propio código ya sospecha. Ninguno exige reescrituras: los tres tienen arreglos mínimos y locales.

---

## 2. Hallazgos confirmados

### 2.1 ALTOS

**A1. La cadena de actualización verifica un hash que nadie le envía.**
Dónde: `verificarIntegridadArranque` (L32789-32805) y su consumidor (L33859-33866); `TABLERO/VersionCheck.gs`.
Evidencia: el script computa el SHA-256 de sí mismo al arrancar, pero el consumidor solo actúa `if (data.expectedSha256 && ...)`. Verificado el `doGet` de `VersionCheck.gs` completo: envía `minVersion`, `force`, `killSwitch` y `canary`; jamás envía `expectedSha256`. La verificación de integridad está, por tanto, permanentemente inerte.
Impacto: si el gist de distribución se compromete (cuenta de GitHub, edición maliciosa, o simplemente un error de pegado), el navegador del médico instala y ejecuta código arbitrario sin que nada lo detecte. Es el único hallazgo con recorrido a ejecución de código.
Arreglo mínimo: que el TABLERO publique también `expectedSha256` (se actualiza en el mismo gesto de publicar versión) y que el consumidor exija coincidencia con mensaje visible. No requiere cambiar el formato de respuesta: un campo más.

**A2. `vgl_piloto` (hasta 12 MB) se escribe y nunca se purga.**
Dónde: L12718 (`PILOTO_KEY = "vgl_piloto"`) y L12738: `if (txt.length <= 12 * 1024 * 1024) GM_setValue(PILOTO_KEY, txt);`.
Evidencia: grep de `PILOTO_KEY` en todo el archivo: solo escrituras y lecturas, cero `GM_deleteValue`. Contraste en el mismo bloque: `vgl_pym` sí se purga a diario (`purgar()`, L12666-12679).
Impacto: dos caras. Permanencia indefinida de un volcado serializado del módulo piloto en el almacén del gestor de scripts, que sobrevive a cierres de sesión del consultorio; e hinchazón de ese almacén (12 MB es el tope de auto-límite del propio script), que degrada los respaldos y la sincronización del gestor y puede hacer fallar silenciosamente escrituras futuras de otras claves.
Arreglo mínimo: la misma purga diaria que ya tiene `vgl_pym`, con caducidad a N días. Un bloque hermano del que ya existe.

**A3. La cosecha repite cada tick trabajo que no cambió.**
Dónde: `_vglCosechaTodo` (L4985-4986), fusión y firma (L5170), reconocimiento interno del tirón (L33036, L33047).
Evidencia: cada tick (5 s; 2 s en ventana crítica) se ejecuta: barrido DOM completo (~52 `querySelectorAll`), `scrubPII` con 7 regex por campo, 3 `JSON.parse` del almacén, y doble serialización del almacén completo de hasta 80 pacientes para decidir si hubo cambio. El propio código señala esta zona como «sospechosos del tirón de 5 s».
Impacto: es la principal fuente de CPU sostenida del script, corriendo durante toda la jornada con la misma cadencia haya o no cambios en pantalla; en consultorio con PC modesto compite con la propia Everest.
Arreglo mínimo, en orden de costo/beneficio: (1) saltar la vuelta cuando el DOM no mutó —ya existe un `MutationObserver` en la página que puede marcar «sucio»; (2) firmar solo el delta del paciente tocado en vez del almacén completo (elimina también M2); (3) leer el almacén una vez por tick, no tres.

### 2.2 MEDIOS

**M1. `BroadcastChannel("vgl")` acepta cualquier mensaje con `.t`.**
Dónde: L9808 (`chan.onmessage = (e) => { if (e.data && e.data.t) state.shared = e.data; }`) y L10015 (`share(list)` difunde la agenda completa).
Impacto: cualquier otro script corriendo en el mismo origen puede inyectar una agenda falsa en `state.shared` (integridad, no confidencialidad); y la agenda viva viaja por un canal que cualquier pestaña del origen puede escuchar.
Arreglo mínimo: validar la forma del mensaje (campos y tipos esperados) antes de aceptarlo, y prefijar el canal con un identificador de sesión generado al arrancar.

**M2. Doble serialización del almacén completo para la comparación de firmas.**
Dónde: L5170 — `if (_firma(todo) === _firma(previoTodo)) return fusion;`.
Impacto: dos `JSON.stringify` del almacén de hasta 80 pacientes por tick, dentro del camino caliente de A3.
Arreglo mínimo: se disuelve con el punto (2) de A3.

**M3. La cosecha no espacia su cadencia con la pestaña oculta.**
Dónde: bloque del reloj (L9682-9702) y el bucle de cosecha.
Matiz importante: el reloj en Web Worker es by-design (pedido del médico del 18-ago) y correcto; el problema no es el reloj sino que el trabajo pesado que despertó (cosecha + serializaciones) corre a cadencia plena con la pestaña oculta.
Arreglo mínimo: con `document.hidden`, bajar la cadencia de cosecha de 5 s a 15 s; los avisos no pierden nada porque el worker mantiene el latido y basta re-cosechar al volver a visible.

**M4. `vgl_nosh_hist` no caduca nunca.**
Dónde: L32455 (`NO_SHOW_KEY`) y L32486, donde el propio comentario lo admite («no caduca nunca... ese mapa crece»).
Impacto: crecimiento lento pero indefinido en localStorage del historial de inasistencias.
Arreglo mínimo: tope de entradas o TTL de 180 días, aplicado en la misma escritura.

**M5. `console.log` de asignación de turno imprime identificador de paciente y fecha.**
Dónde: L28441 — `console.log("[Vigilante Agendamiento] Asignando turno RCV:", { turnoId, pacienteIdAcceso, fechaIso, ... })`.
Impacto: fuga de identificador + fecha de cita a la consola, donde persiste entre sesiones del devtools y puede salir en capturas de soporte. El resto del script usa `vglLog` con redacción; esta línea se quedó fuera.
Arreglo mínimo: migrar a `vglLog` con los campos redactados, como el resto.

**M6. Token `vgl-2026` embebido en userscript y Apps Script.**
Dónde: L11222 en el userscript; `TABLERO/Codigo.gs` L134 (`var TOKEN = "vgl-2026"`), verificados idénticos.
Impacto: quien tenga el userscript (artefacto que se distribuye) puede escribir filas al TABLERO. Es un riesgo conocido y en evaluación de rotación anual; se lista para que esa evaluación tenga fecha.
Arreglo mínimo, cuando se decida: rotar el token en ambos lados en el mismo release y anotar la fecha de la próxima rotación.

**M7. `_vglLoteDeshacer` retiene nodos DOM desvinculados.**
Dónde: L8251-8375 — el lote guarda pares `{el, prev}` y solo se libera (`= null`, L8375) al llenarse el siguiente.
Impacto: entre lote y lote, referencias a nodos ya retirados del DOM impiden su recolección.
Arreglo mínimo: liberar al aplicar el deshacer, y tope de pares por lote.

**M8. `diaNuevo()` no limpia tres estructuras de sesión.**
Dónde: L13508-13528 — `_vglContextoAvisado`, `_diagLabFechaPorCasilla` y `_acompEntendidoEnMs` se olvidan al cambiar de día y crecen por sesión.
Arreglo mínimo: vaciarlos dentro del propio `diaNuevo()`, junto a lo que ya limpia.

### 2.3 BAJOS

| # | Hallazgo | Dónde |
|---|---|---|
| B1 | `console.warn` con diagnósticos CIE-10 y códigos CUPS | L29967, L29976, L29977 |
| B2 | `console.warn` con identificador interno de paciente serializado | L2597 |
| B3 | `vgl_estilo_ejemplos` sin TTL | L41579 |
| B4 | El portapapeles retiene la nota tras copiar (sin borrado posterior) | bloque de copia |
| B5 | `doGet` del Apps Script es público; el token es la única puerta | `TABLERO/Codigo.gs` |
| B6 | Dos `createObjectURL` sin `revokeObjectURL` | L1138, L33386 |
| B7 | Blob del worker nunca revocado | L9710 |
| B8 | `vgl_n_*` solo se poda al arrancar, no al escribir | bloque de notas |
| B9 | `vgl_identidad_medico_cache` no descarta entradas vencidas | bloque de identidad |
| B10 | `MutationObserver` sin `disconnect` al cerrar su modal | L14298 |
| B11 | Búsqueda por `indexOf` sobre lista larga dentro de bucle (cuadrático) | L14613 |
| B12 | Regex de tachado con retrocesos anidados | L8690 |
| B13 | `setInterval` sin `clearInterval` en su camino de salida | L1164 |

---

## 3. Refutados y decisiones de diseño respetadas

Cada uno se verificó contra el código; se listan para que no vuelvan a reportarse y para dejar constancia de por qué no son defectos.

**R1. «Telemetría forzada» — by-design.** L8799: `reporte: true` con comentario explícito de la política del dueño (29-ago): telemetría siempre encendida como precio del script gratuito. Residuo real, y único pendiente: `docs/SECRETOS_EXPUESTOS.md` aún la describe como apagable por defecto; hay que sincronizar ese párrafo (tarea de documentación, no de código).

**R2. «Fechas reales viajan a la IA» — by-design.** L8668-8673 y L8704-8708: `conFechas` es decisión del médico (20-ago) para anclar la cronología de la Enfermedad Actual; nombres, documentos, teléfonos y correos se tachan siempre, en ambos canales.

**R3. «El espejo `espejo_vgl_ev_*` crece para siempre» — ya corregido.** v18.0.108 (L11169-11181) añadió la poda del espejo GM con la misma regla de 30 días que el original (`KEEP_DAYS = 30`, L11066). El hallazgo describía el estado anterior a esa versión. La retención de 30 días con nombre y documento es la misma política de la bitácora original.

**R4. «`vgl_cosecha` persiste 120 días en localStorage» — by-design con poda.** L4967-4971: el paso de `sessionStorage` a `localStorage` fue pedido explícito del médico (20-ago) para conservar lo aprendido entre citas; L4978-4984: poda documentada a 80 pacientes / 120 días. Queda, como nota opcional de minimización (no defecto): en un PC de consultorio compartido, un borrado manual accesible reduciría la exposición a la vez que respeta el pedido.

**R5. «`sanitizePII` no tacha nombres de persona» — refutado para el canal que importa.** Es cierto que `scrubPII` (L8718, alias `sanitizePII`) no reconoce nombres; pero el camino hacia la IA tiene su propia capa dedicada (L41943-42060): tacha literalmente el nombre real del paciente leído de la agenda, por tokens, insensible a mayúsculas sostenidas (v17.6.42), con partículas de apellido y palabras funcionales excluidas (v18.0.52) y ambos canales alineados por decisión del médico (02-sep, v18.0.102). El residuo —un nombre que coincide con palabra clínica— fue aceptado explícitamente por el médico (01/02-sep) tras medir que la alternativa destrozaba las notas.

**R6. «El reloj en Web Worker es complejidad sospechosa» — by-design.** L9682-9702: pedido del médico (18-ago); es la técnica estándar para escapar al estrangulamiento de timers ocultos de Chrome, documentada con sus límites y con caída segura a `setInterval`.

**R7. Cero sumideros XSS abiertos.** 146 sumideros de HTML mapeados (contra 73 en la auditoría XSS del 14-ago; todo el código posterior a v14.1.5 nunca se había auditado): categoría E (concatenación directa sin escape) = 0; 106 pasan por `escapeHtml` verificado, el resto son construcciones seguras por diseño. Cero `eval` y cero `new Function` en todo el archivo.

**R8. Cero secretos vivos.** La clave `AIza...` solo existe en fixtures sintéticos de prueba. Las credenciales Athenea ofuscadas (XOR + base64) son riesgo ya aceptado en auditorías previas.

**R9. Red contenida.** 58 llamadas de red a 14 destinos, todos declarados en `@connect`. El presupuesto de red y sus cortacircuitos ya fueron auditados y no se re-auditán aquí.

**R10. Arranque limpio.** Sin polling de arranque (cero coincidencias), `boot()` diferido a `DOMContentLoaded`, desempaque del módulo PyM en `requestIdleCallback`.

---

## 4. Plan de acción priorizado

**P1 — esta semana (los tres ALTOS, arreglos mínimos y locales):**
1. A1: publicar `expectedSha256` desde `VersionCheck.gs` y exigirlo en el consumidor (dos cambios pequeños, un solo release).
2. A2: purga diaria de `vgl_piloto` calcada de la de `vgl_pym`.
3. A3: saltar la cosecha cuando el DOM no mutó (bandera «sucio» desde el observer existente); con eso solo, el tirón de 5 s debería caer a casi cero en reposo.

**P2 — próxima ventana de mantenimiento:**
4. M1 (validación del BroadcastChannel), M2 (firma por delta, ya incluida en A3), M5 (migrar el `console.log` de L28441 a `vglLog` redactado).
5. M3 (cadencia 15 s con `document.hidden`), M4 (TTL de `vgl_nosh_hist`), M7 y M8 (liberación de lote y limpieza en `diaNuevo()`).

**P3 — a conveniencia:**
6. Los 13 BAJOS, idealmente agrupados por archivo/zona para tocar una vez.
7. Sincronizar el párrafo de telemetría de `docs/SECRETOS_EXPUESTOS.md` con la política real (R1) — es el único pendiente de documentación que dejó la refutación.
8. Dar fecha a la evaluación de rotación del token `vgl-2026` (M6).

---

## 5. Mapa de superficies (apéndice)

| Superficie | Cifra |
|---|---|
| Sumideros de HTML mapeados | 146 (73 en la auditoría del 14-ago) |
| Sumideros con concatenación directa sin escape | 0 |
| `eval` / `new Function` | 0 |
| Usos de `escapeHtml` | 301 |
| Timers (setTimeout/setInterval) | 135 |
| `addEventListener` | 245 |
| `GM_setValue`/`GM_getValue` | 126 |
| Llamadas de red (`GM_xmlhttpRequest`/fetch) | 58, a 14 destinos, todos en `@connect` |
| Observers (Mutation/Intersection/Resize) | 8 |
| `console.*` | 146 (4 con PHI residual: M5, B1, B2 y uno menor ya cubierto) |

## 6. Límites de esta auditoría

Auditoría estática y de solo lectura sobre el código fuente; no incluye ejecución instrumentada, pruebas de carga ni intento de explotación. Los tiempos de CPU se razonan desde el código y los comentarios de medición previos del propio script (L5321, L33036, L33047), no desde un perfilador nuevo. `TABLERO/Codigo.gs` se revisó en lo pertinente al token y al `doGet`; no fue objeto de auditoría completa por sí mismo. Este informe no contiene PHI: ningún dato de paciente real, nombre propio ni documento aparece en sus páginas.
