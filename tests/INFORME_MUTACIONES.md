# Informe de Auditoría de Mutaciones

Este documento reporta los resultados de la auditoría de mutaciones manual sobre `vigilante_agenda.user.js` usando un banco que muestra 457/457 (456/457 pasan, 1 de Excel falla basal). A continuación se listan 40+ mutaciones aplicadas sobre una copia temporal, indicando cuáles sobrevivieron (revelando aserciones débiles en las suites).

| Línea | Mutación Aplicada | ¿Sobrevivió? | Aserción Faltante (si sobrevivió) |
|---|---|---|---|
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
| 8125 | `return FESTIVOS.has(...)` &rarr; `return false;` | No | - |
