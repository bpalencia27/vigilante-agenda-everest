# Informe de Auditoría de Mutaciones

Este documento reporta los resultados de la auditoría de mutaciones manual sobre `vigilante_agenda.user.js` usando un banco que muestra 457/457 (456/457 pasan, 1 de Excel falla basal). A continuación se listan 40+ mutaciones aplicadas sobre una copia temporal, indicando cuáles sobrevivieron (revelando aserciones débiles en las suites).

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
| 4335 | Vaciar la función `_instalarCazaErrores` | No | `Telemetría de uso del panel (v12.5) -> _instalarCazaErrores: intercepta errores y rechazos solo del script propio` |
| 932 | `if (!resultDate && !_diagLabFechaLogged) {` &rarr; `if (resultDate && !_diagLabFechaLogged) {` | Sí | Falta asertar que el flag de una-sola-vez `_diagLabFechaLogged` evita desbordar la consola de logs repetidamente. |
| 2478 | `} catch (e) { return false; }` &rarr; `} catch (e) { return true; }` | Sí | Falta aserción que verifique el estado alterado o la acción por defecto tras atrapar un error específico en la API externa/localStorage. |
| 2485 | `} catch (e) {}` &rarr; `} catch (e) { return; }` | Sí | Falta una prueba que cubra la ruta de error/excepción simulando un fallo que obligue a pasar por este `catch` específico y aserte que la función continúa su ejecución sin abortar. |
| 2158 | `} catch (e) { evBuffer = []; }` &rarr; `} catch (e) {}` | Sí | Falta asertar que evBuffer se reinicia a `[]` al fallar el parseo desde localStorage. |
| 2099 | `} catch (e) {}` &rarr; `} catch (e) { return null; }` | Sí | Falta una prueba que cubra la ruta de error/excepción simulando un fallo que obligue a pasar por este `catch` específico y aserte que la función continúa su ejecución sin abortar. |
| 2282 | `} catch (e) {}` &rarr; `} catch (e) { return true; }` | Sí | Falta aserción que verifique el estado alterado o la acción por defecto tras atrapar un error específico en la API externa/localStorage. |
| 83 | `if (!s) return null;` &rarr; `if (s) return null;` | No | - |
| 5957 | `.catch((e) => console.warn("[Vigilante] falló el envío del SMS:", e));` &rarr; `.catch((e) => {});` | Sí | Falta asertar sobre el aviso en consola emitido cuando el Promise del envío del SMS lanza una excepción o es rechazado. |
| 933 | `_diagLabFechaLogged = true;` &rarr; `_diagLabFechaLogged = false;` | Sí | Falta asertar que el flag de una-sola-vez `_diagLabFechaLogged` evita desbordar la consola de logs repetidamente. |
| 934 | `console.warn` &rarr; `// console.warn` | Sí | No hay aserción sobre los llamados a `console.warn` (`console` no está mockeado de forma estricta para asegurar que se producen los avisos de depuración clínica). |
| 925 | `console.warn("[Vigilante] casilla ya escrita, se conserva el primer valor:", matched.key);` &rarr; `// console.warn(...);` | No | - |
| 873 | `if (code && item.codes.includes(code)) return item;` &rarr; `if (code && !item.codes.includes(code)) return item;` | No | - |
| 876 | `if (item.excluye && item.excluye.some((x) => name.includes(x))) continue;` &rarr; `if (item.excluye && !item.excluye.some((x) => name.includes(x))) continue;` | No | - |
| 881 | `return null;` &rarr; `return WHITELIST_13_LABS[0];` | No | - |
| 886 | `for (const id of [primaryId].concat(altIds || [])) {` &rarr; `for (const id of [primaryId]) {` | No | - |
| 887 | `if (!id) continue;` &rarr; `if (id) continue;` | No | - |
| 903 | `let count = 0;` &rarr; `let count = 1;` | No | - |
| 904 | `let pendientes = 0;` &rarr; `let pendientes = 1;` | No | - |
| 907 | `if (!Array.isArray(labsArray)) return { count: 0, pendientes: 0, sinCasilla: [] };` &rarr; `if (!Array.isArray(labsArray)) return {};` | Sí | Falta aserción fuerte que valide los valores de retorno para este caso extremo o error de tipo en el flujo secundario. |
| 911 | `if (!matched) return;` &rarr; `if (matched) return;` | No | - |
| 914 | `if (!resultVal) return;` &rarr; `if (resultVal) return;` | No | - |
| 920 | `if (Number(lab.idEstado) === 1 || String(resultVal).trim().toUpperCase() === "PENDIENTE")` &rarr; `if (Number(lab.idEstado) === 2 || String(resultVal).trim().toUpperCase() === "PENDIENTE")` | Sí | Falta aserción fuerte que valide los valores de retorno para este caso extremo o error de tipo en el flujo secundario. |
| 920 | `toUpperCase() === "PENDIENTE"` &rarr; `toLowerCase() === "pendiente"` | Sí | Falta aserción fuerte que valide los valores de retorno para este caso extremo o error de tipo en el flujo secundario. |
| 925 | `if (yaEscritas.has(matched.resultId)) { console.warn` &rarr; `if (!yaEscritas.has(matched.resultId)) { console.warn` | No | - |
| 941 | `count++;` &rarr; `count += 2;` | No | - |
| 952 | `return { count, pendientes, sinCasilla };` &rarr; `return { count: 0, pendientes: 0, sinCasilla: [] };` | No | - |
| 1247 | `if (!docId) return false;` &rarr; `if (docId) return false;` | No | - |
| 1257 | `if (!docId) return;` &rarr; `if (docId) return;` | No | - |
| 1260 | `if (!p.citas.includes(sDoc)) { p.citas.push(sDoc); writeJSON(PROC_KEY, p); state.lastSignature = ""; repaint(); }` &rarr; `if (p.citas.includes(sDoc)) { p.citas.push(sDoc); writeJSON(PROC_KEY, p); state.lastSignature = ""; repaint(); }` | No | - |
| 1260 | `p.citas.push(sDoc);` &rarr; `p.citas.pop();` | No | - |
| 1260 | `state.lastSignature = "";` &rarr; `state.lastSignature = "dummy";` | No | - |
| 1269 | `if (!docId) return;` &rarr; `if (docId) return;` | No | - |
| 2011 | `} catch (err) {` &rarr; `} catch (err) { return; }` | No | - |
| 2725 | `const ok = await loadPymBase(baseIntentos < 3).catch(() => false);` &rarr; `const ok = await loadPymBase(baseIntentos < 3).catch(() => true);` | Sí | Falta aserción que verifique el estado alterado o la acción por defecto tras atrapar un error específico en la API externa/localStorage. |
| 3581 | `} catch (e) {` &rarr; `} catch (e) { return true;` | No | - |
| 104 | `if (!d || isNaN(d)) return null;` &rarr; `if (!d && isNaN(d)) return null;` | No | - |
| 105 | `if (d > Date.now() + 86400000) return null;` &rarr; `if (d < Date.now() + 86400000) return null;` | No | - |
| 110 | `if (an < 100) an += 2000;` &rarr; `if (an > 100) an += 2000;` | No | - |
| 111 | `if (an < 2000 || an > 2100) return null;` &rarr; `if (an < 2000 || an > 2000) return null;` | No | - |
| 121 | `return null;` &rarr; `return false;` | No | - |

| 10984 | `(a.estado && a.estado.toLowerCase().includes("atendido") ? " atendido" : "")` &rarr; `(a.estado && a.estado.toLowerCase().includes("en sala") ? " atendido" : "")` | No | - |
| 11005 | `const atendidoLeyenda = esAtendido && a.color !== "ROJO";` &rarr; `const atendidoLeyenda = false;` | No | - |
| 11128 | `? (esAtendido || yaAbiertoHoy` &rarr; `? (false || yaAbiertoHoy` | No | - |
| 8822 | `<div class="vgl-labs-uro">…<span class="vgl-labs-uro-i">…</span>…</div>` &rarr; `…join("&lt;br&gt;")` (volver al chorizo previo) | No | - |
| 2844 | `if (actual === "" && guardado !== "") porAplicar.push(...)` &rarr; `if (guardado !== "") porAplicar.push(...)` (rediseño v12.9.0 a plantilla por posición; reemplaza la fila anterior de esta misma pareja de botones) | No | - |
| 8382 | `const franja = tieneDM ? "primera_mitad" : "sin_preferencia";` &rarr; `const franja = tieneDM && !tieneNefro ? "primera_mitad" : "sin_preferencia";` | No | - |
| 6660 | `.vgl-btn-action.vgl-btn-ambar,\n.vgl-btn-action.vgl-btn-ambar:hover{` &rarr; `.vgl-btn-ambar{` (clase suelta, misma especificidad que la regla base — el bug real de T1) | Sí, hasta corregirse | "el ámbar de «falta la toma de muestras» gana a la regla base pase lo que pase (cascada)" — restaurado |
| 11400/11443 | textos "abre la Historia Clínica de.../Historia clínica abierta..." &rarr; versión honesta "Registrar inicio de atención..." (incidente real en consultorio: apiMedicoAbrirHistoria() nunca navega, solo registra un timestamp; el médico creyó haber revisado al paciente sin haberlo hecho) | No | "botón Atender: ningún texto visible promete abrir/mostrar la historia clínica" |
| 7891/7892 | blindaje `:where(...:not([class]))` de `#vgl-labsv-modal`/`#vgl-postcita-panel` &rarr; se quitan ambos del `:where()` y se reintroduce la regla vieja `#vgl-labsv-modal b,#vgl-labsv-modal span,#vgl-labsv-modal div,#vgl-postcita-panel b,#vgl-postcita-panel span,#vgl-postcita-panel div{color:inherit}` (el bug real reportado en consulta: `id+tipo` gana por especificidad a `.vgl-postcita-title`/`.vgl-postcita-sub`, heredando el azul de Everest en vez de verde/gris propios — confirmado con Chromium sobre el CSS real extraído del harness) | Sí, hasta corregirse | "blindaje tipográfico: postcita-panel y labsv-modal usan :not([class]), no div/span/b a pelo" — restaurado |
| 6655 | `.vgl-btn-action.vgl-btn-ambar` &rarr; `.vgl-btn-ambar` y declarada antes de la base. | Sí | Suite 25 (Cascada CSS) detecta dependencia del orden de declaración. |
| 6240 | Añadir `.vgl-d-none{display:none !important}` y usar `el.root.classList.add('vgl-d-none')` antes de `style.display="flex"`. | Sí | Suite 25 (Cascada CSS) detecta conflicto !important vs inline style en `display`. |
| 2929 | botón "🩺 Normalidad fija": `if (actual === "") porAplicar.push(...)` &rarr; `porAplicar.push(...)` sin la condición (deja de respetar la casilla sagrada del médico) | Sí | "Normalidad fija: rellena SOLO las vacías, respeta las que ya tienen texto..." — restaurado |
| 2868 | v12.10.4: se quitaron "💾 Guardar plantilla" / "📋 Aplicar plantilla" a pedido del médico (solo quiere la plantilla fija, sin memoria del último paciente) y se reintrodujo un `if (!confirm(...)) return;` antes de aplicar "Normalidad fija" (el médico pidió explícitamente un solo clic, sin cuadro de confirmación) | Sí | "Normalidad fija: un solo clic rellena SOLO las vacías, sin pedir confirmación..." y "...avisa el desajuste sin dejar de aplicar" — restaurado |
| 6996 | v12.10.5: `.vgl-labsv-lead{color:var(--fg2) !important}` &rarr; `.vgl-labsv-lead{color:var(--fg2)}` sin `!important` (bug real reportado en consulta con captura: el azul de Everest ganaba porque esta regla no tenía forma de competir — a diferencia de `.vgl-labsv-t`/`.vgl-labsv-n`, protegidas por estilo inline) | Sí | "blindaje !important: lead/foot de los avisos flotantes y postcita-title/sub no pueden perder su color contra Everest" — restaurado |
| 8125 | `return FESTIVOS.has(...)` &rarr; `return false;` | No | - |
| 7031 | v12.10.7: `.vgl-labsv-t{...color:var(--c-rojo) !important...}` &rarr; sin `!important` | No | "blindaje !important: título/número de bigAlert, pymAlert, abandonoPESAlert y labsVencidosAlert..." — restaurado |
| 10797 | v12.10.7: `if (lbl2 && lbl2.classList)` &rarr; `if (lbl2.classList)` (sin el `&&`; esta misma línea ya había reaparecido rota una vez en una ronda de Jules) | No | "guard de classList tras closest(\"label\") siempre cortocircuita con &&..." — restaurado |
| 7031 | v12.10.7: `color:var(--c-rojo)` &rarr; `color:var(--c-alerta)` (token inventado por Jules que nunca se definió en ningún lado; causaba herencia del azul de Everest) | No | "no debe reaparecer --c-alerta/--rgb-alerta..." — restaurado |
| 1973 | `_canonNombreLab` (quitar reemplazo de separadores por espacios, `replace(/[\/\-_,.;:()]+/g, " ")`) | No | Falla `_canonNombreLab: convierte separadores especiales a espacios simples` y `_matchLabInWhitelist v12.6.8` |
| 2034 | `_findHbA1cFields` (cambiar el atributo para validación max de 30 a 20 `el.getAttribute("max") === "20"`) | No | Falla `_findHbA1cFields: encuentra el input correcto por type=number y max=30 y asocia la fecha hermana` |
| 11912 | `if (false) return;` | No | `boot() aborta tempranamente si #vgl-root ya existe en el DOM (guard)` |
| 9752 | v12.10.8: `const esSugerida = !!recHorario.sugerida && normalizeHora(horaTxt) === recHorario.sugerida;` &rarr; `const esSugerida = false;` | No | "un paciente diabético ve 'SUGERIDO' en el turno AM temprano..." — restaurado |
| 9547 | v12.10.8: `perfilDelPaciente = perfilPaciente(etiquetasPaciente);` &rarr; `perfilDelPaciente = { franja: "primera_mitad", adicionales: [] };` (perfil fijo, ignora las etiquetas reales del paciente) | No | "un paciente sin etiquetas de riesgo no ve ninguna insignia de sugerido..." — restaurado |
| 11576 | `setNgValue(el, _racGuardia.valor)` &rarr; `_racGuardia.activa = false` (apagar guardia en vez de restaurar) | No | - |
| 2247 | `if (Number(lab.idEstado) === 1 \|\| ...)` &rarr; `=== 2` (un analito PENDIENTE de Athenea deja de descartarse y su valor de arrastre entraría a la casilla como resultado vigente) | No — **ya no**; sobrevivía hasta hoy | "idEstado 1 con un valor numérico viejo en el campo NO se escribe" — restaurado |
| 2247 | `if (Number(lab.idEstado) === 1 \|\| String(resultVal).trim().toUpperCase() === "PENDIENTE")` &rarr; se quita la rama del texto, queda solo `idEstado === 1` | No — **ya no**; sobrevivía hasta hoy | "Resultado 'PENDIENTE' sin idEstado tampoco se escribe (la rama del texto, sola)" — restaurado |
| 10033 | `notify("AMBAR", "🧪 Falta la fecha guardada localmente...` &rarr; `notify("ROJO", "🧪 Falta la fecha mutada...` | No | "openLabSoloModal: paciente sin fecha guardada lanza notify y aborta" — restaurado |
| tests/suite_07:71 | quitar el `await` de un `t.casoAsync` (el bug original que mantuvo 8 pruebas de suite_05 y 2 de suite_07 sin ejecutarse, con el banco en verde) | No | "todo t.casoAsync se invoca con await" (suite_26) — restaurado |
| tests/suite_07:82 | reintroducir `api.zipRead = ...` sobre el `api` COMPARTIDO | No | "ninguna suite pisa el objeto `api` compartido" (suite_26) — restaurado |
| tests/suite_07:9 | quitar `async` de `pruebas(...)` | n/a — la mutación tira el runner con SyntaxError al cargar el módulo, así que el guard de suite_26 no llega a evaluarse. El fallo es ruidoso (código de salida ≠ 0, sin línea "comprobaciones"), que es justo lo que atrapa la compuerta de muerte silenciosa del CI. El chequeo se conserva como defensa en profundidad, no como el detector principal. | — |
| 7212 | v12.10.9: se retira la regla `#vgl-agendar-modal.light .vgl-agm-sbtn.vgl-agm-sbtn-sugerido, ...{background/color/border-color}` que le gana en especificidad a la base de tema claro | No | "Regla C - la insignia SUGERIDO no pierde su color en tema claro" (suite_25) — restaurado |
| 11820 | `const mask = (s) => { ... };` &rarr; `const mask = (s) => String(s);` (se quita el enmascarado del ID en downloadDiagnostic) | No | "downloadDiagnostic: enmascara correctamente los IDs y omite los nombres (cero PHI)" detectó la fuga de la cédula real inventada y falló las aserciones de enmascarado — restaurado |
