# Informe — Análisis de la ineficacia observada de la regla de actualización obligatoria (bloqueo por versión obsoleta)

Fecha del informe: 2026-09-07 (anclado a la sonda viva del TABLERO, `timestamp 2026-09-07T18:22:52Z`).
Alcance: regla implementada en v18.4.1 (`aplicarBloqueoVersionObsoleta` / `vgl_version_lock` / `_vglCandadoVersionArranque`) y su cadena completa de activación: repo → commit → Gist → Tampermonkey → TABLERO (`MIN_VERSION`) → bloqueo.
Método: sondas en vivo contra el canal de distribución real y el plano de control, revisión del código en HEAD (`d5b38d7`, v18.4.5), registro git y documentos del propio repo. Cero PHI.

---

## 0. Conclusión ejecutiva

La implementación **no tiene defectos de lógica detectables** (banco 3415+/0 con la regla incluida; ver §2). No bloqueó a nadie durante el día observado porque **la regla no estaba distribuida ni armada durante ese período**, y porque **estructuralmente no puede bloquear a versiones anteriores a la 18.4.1** (el código de bloqueo no existe en los equipos viejos y no hay forma de inyectárselo). Tres condiciones de la cadena de activación se cumplieron recién en las últimas horas, en parte durante este mismo análisis:

| # | Condición necesaria para que bloquee | Estado durante el día observado | Estado ahora (verificado en vivo) |
|---|---|---|---|
| 1 | El código de la regla publicado en el Gist | ❌ El Gist servía **18.0.4** (última release oficial registrada: 31-ago, `docs/PUBLICACIONES.md` L26) | ✅ **18.4.5** (publicado minutos antes de la segunda sonda; primer fetch del análisis aún leyó 18.0.4 del edge de CDN) |
| 2 | `minVersion` desplegado en el TABLERO > versión del equipo | ❌ Respuesta cacheada del 31-ago muestra `minVersion 18.0.3` (sin presión ni siquiera para el aviso pasivo) | ✅ `minVersion 18.4.4` (sonda fresca 18:22Z) |
| 3 | El equipo tiene instalada una versión ≥ 18.4.1 (la primera con la regla) | ❌ Flota esencialmente en ≤18.3.6 (ver §1) | ⏳ Cada Tampermonkey la tomará en su ciclo (~diario) al servir el Gist 18.4.5 |

Mientras 1 o 2 fallan, ni siquiera el aviso pasivo preexistente (recarga + resumen) se disparaba: con `minVersion 18.0.3`, todo equipo ≥ 18.0.3 estaba "al día" para el servidor. Ese es exactamente el comportamiento observado: **versiones viejas operando sin ningún problema ni presión**.

---

## 1. Casos confirmados de uso de versiones antiguas (punto 1 del pedido)

Lo verificable desde el repo, sin inventar datos:

- **Evidencia estructural (viva)**: el Gist sirvió **18.0.4** como tope hasta horas de hoy (registro oficial `docs/PUBLICACIONES.md` L26: única release registrada, 2026-08-31T03:30Z, estado `CANDIDATE`; y mi primera sonda de hoy leyó 18.0.4 del edge). Por tanto, **todo equipo que se actualizó por Tampermonkey en la semana corría como máximo 18.0.4** — una versión ~4 semanas y ~140 parches atrás, plenamente funcional porque el TABLERO desplegado exigía solo 18.0.3.
- **Evidencia histórica de flota**: `REPORTE_M2M.md` (telemetría del 31-ago): de 23 equipos activos, **12 seguían en v17.0.2** sin ninguno de los arreglos de la jornada. Es la última fotografía de flota disponible en el repo.
- **Funcionalidades ejecutables sin inconconvenientes en versiones viejas**: todas las que existían hasta cada versión — el bloqueo no puede reached-back (ver §4, C4). No hay registro de funcionalidad degradada: la regla es lo único que las versiones viejas no tienen.
- **Dato por usuario de HOY (equipo, versión exacta, acciones)**: no existe en el repo; vive en la hoja de reportes del TABLERO de Apps Script (cada fila de `reportar()` lleva `equipo`, `ver`, `evento`, `dia`). Receta para completarlo sin inventar: abrir la hoja del despliegue `AKfycbwXw...689kq3R7tC`, filtrar `dia = 2026-09-06`, proyectar `equipo, ver` distintos, y contrastar contra los eventos `verlock` (que solo pueden emitir equipos ≥18.4.1). Casilla vacía antes que dato inventado.

## 2. Revisión técnica del código y cambios introducidos (punto 2)

Código verificado en HEAD `d5b38d7` (v18.4.5, working tree limpio — la regla está commiteada):

| Elemento | Ubicación (v18.4.5) | Estado |
|---|---|---|
| Rama post-recarga de `checkVersionMinimum` → `aplicarBloqueoVersionObsoleta(minVer)` | L37173 | ✅ intacta |
| Candado persistente `VGL_VERSION_LOCK_GM` + modal solo-actualización + `_vglCandadoVersionArranque` | L36826+ | ✅ intacta |
| Chequeo de arranque en `boot()` antes del kill remoto | L37513 | ✅ intacta |
| Pruebas (5 casos hermanos en suite_17) + 3 mutaciones verificadas | `tests/suite_17_nucleo.js`, `tests/INFORME_MUTACIONES.md` | ✅ en verde |

Errores de **configuración/despliegue** (no de lógica) detectados en la cadena:

- **C1 — Drift del plano de control**: el despliegue vivo del TABLERO quedó una semana en `18.0.3` mientras el repo decía `18.0.142` (deriva ya documentada una vez en `docs/ENJAMBRE_AUDITORIA_20260831.md` L91). El RUNBOOK exige re-desplegar `VersionCheck.gs` "sin cambiar la URL" al publicar; no se hizo con la 18.0.142. Ahora el drift se invirtió: deploy 18.4.4 > repo 18.0.142 → **el repo quedó atrasado respecto a producción** (síntoma del mismo problema de proceso).
- **C2 — Publicación tardía del canal**: entre la 18.0.4 (31-ago) y la 18.4.5 (hoy, horas de la tarde) el Gist no sirvió NINGUNA versión con la regla. Los documentos intermedios del equipo se contradicen entre sí sobre qué servía el Gist (`REPORTE_M2M.md` L230: "gist sirve 18.1.0"; `AUDITORIA/REGISTRO_ARRANQUE.md` L11-13: "18.3.6 publicado en gist, raw≡local"; registro oficial `PUBLICACIONES.md`: nada posterior a 18.0.4) — tres versiones distintas reclamadas como publicadas, y el registro oficial sin actualizar. Falta una sola puerta de publicación.
- **C3 — Interruptor apagado por diseño**: con el acuerdo del dueño ("se activa cuando terminen las tareas paralelas"), `MIN_VERSION` del repo quedó en 18.0.142 < 18.4.x. No es defecto, pero contribuye a que hoy no bloquee nada: la primera condición que la regla exige (servidor exige > instalada) recién se dio con el despliegue 18.4.4 de hoy.

## 3. Comportamiento observado vs. objetivos originales (punto 3)

| Objetivo (pedido original) | Cumplido hoy | Desviación y causa |
|---|---|---|
| 1. Verificación de versión local vs. última del canal | ⚠️ Parcial | El mecanismo existe (chequeo cada 5 min) pero el TABLERO desplegado decía 18.0.3: "la última" conocida por los equipos era vieja (C1) |
| 2. Bloqueo funcional irreversible de versiones obsoletas | ❌ En el día observado | Código no distribuido (C2) + interruptor apagado (C3) + **imposible retroactivamente** para <18.4.1 (C4) |
| 3. Flujo guiado de actualización sin acceso alternativo | ✅ (para ≥18.4.1) | Modal con único botón + candado que sobrevive F5 y se limpia solo al actualizar |
| 4. Log de casos de versión obsoleta | ⚠️ Parcial | `vglLog` + telemetría `verlock` implementados, pero ningún equipo podía emitirlos hoy (no tenían el código) |
| 5. Validación sin falsos bloqueos | ✅ | Fail-open por error de red y candado autolimpiable probados (suite_17; banco 3415/0 el 06-sep, 3467/0 el 07-sep según commit `38d3a65`) |

Grado de desviación: la regla cumple su especificación **para la población ≥18.4.1 hacia adelante**; el objetivo declarado "cualquier usuario con versión anterior no podrá seguir utilizándolo" es **alcanzable solo por progresión** (todos pasan por 18.4.5 al actualizarse, y a partir de ahí quedan bajo la regla), no de forma inmediata para los ya rezagados.

## 4. Puntos críticos que impidieron el efecto (punto 4)

- **C4 (crítico, estructural) — Sin retroactividad posible**: el bloqueo vive en el cliente. Un equipo con 18.0.4/17.x no contiene la regla y ninguna subida de `MIN_VERSION` puede bloquearlo; su código preexistente a lo sumo recarga una vez y muestra el aviso pasivo. Las ÚNICAS palancas sobre equipos ya viejos son: (a) el ciclo de auto-actualización de Tampermonkey contra el Gist (~diario), (b) el aviso pasivo (requiere `MIN_VERSION` desplegado > su versión), y (c) el **kill-switch remoto** (`KILL_SWITCH` en el TABLERO, presente desde v7.8.1/R5.3), que SÍ apaga versiones viejas — pero muestra "Pausa de seguridad remota" sin flujo de actualización, y es un instrumento de emergencia, no de política de versiones.
- **C1 — Plano de control desincronizado** (detallado en §2): durante la semana ni siquiera el aviso pasivo corría.
- **C2 — Canal de distribución estancado 7 días** (31-ago → 07-sep) y con registros contradictorios entre tareas paralelas.
- **C5 — Adopción dependiente del ciclo de Tampermonkey**: aun con todo publicado, cada equipo tarda hasta ~24 h en tomar la 18.4.5; hasta entonces no posee la regla.
- **Hallazgo colateral**: mi primera sonda del Gist leyó 18.0.4 del edge de CDN y la segunda (con query anti-caché) 18.4.5 — la publicación ocurrió **durante este análisis**. Cualquier verificación del canal debe hacerse con parámetro anti-caché (`.../raw/gistfile1.txt?nocache=<ts>`), o leerá una copia vieja.

## 5. Recomendaciones (punto 5)

1. **Orden de activación (ya corregido en producción, mantenerlo como runbook)**: publicar el Gist PRIMERO, esperar ≥24 h (ciclo TM), y solo entonces subir `MIN_VERSION`. Regla dura: **`MIN_VERSION` desplegado ≤ `@version` publicado en el Gist`** — si el servidor exige una versión que el Gist aún no sirve, los equipos actualizados al tope del canal quedan bloqueados con un botón que instala lo mismo que ya tienen (bloqueo eterno hasta publicar).
2. **Sincronizar el repo con producción**: `TABLERO/VersionCheck.gs` dice 18.0.142 y el despliegue vive en 18.4.4 — actualizar el repo (y `EXPECTED_SHA256`/`EXPECTED_SHA_VERSION` según el protocolo de A1) para que el drift no vuelva a enmascarar el estado real.
3. **Una sola puerta de publicación**: todo pase por `docs/PUBLICACIONES.md` (hoy registra hasta 18.0.4 mientras el Gist sirve 18.4.5) y por la verificación "cuatro puntos sincronizados" que ya exige la suite_30 (REPORTE_M2M §116). Considerar una comprobación automática en el banco: `@version` repo == `@version` del Gist (con anti-caché) y `MIN_VERSION` repo ≤ Gist.
4. **Para los ya rezagados (si se exige bloqueo YA)**: la única palanca real es el `KILL_SWITCH` con `scope` por lista de equipos (sabotea el aviso de pausa, no ofrece actualización — usar solo como último recurso consciente del costo clínico), o esperar 24–48 h de ciclo TM tras la publicación de hoy. Recomendado: esperar y monitorear.
5. **Monitoreo del cumplimiento**: en la hoja del TABLERO, vigilar (a) `ver` distintos por día — la meta es que a 48 h de la publicación el 100 % reporte 18.4.5; (b) eventos `verlock` (solo ≥18.4.1) — cada uno es un equipo bloqueado que requería actualización; (c) `updnew|*` como señal de ciclos TM lentos.
6. **No re-publicar el Gist sin banco en verde** (regla ya del repo): la 18.4.5 salió con 3467/0 registrado (`38d3a65`); mantener ese estándar.

## Anexo — Reproducción de las sondas (evidencia de §0)

```text
GET https://gist.githubusercontent.com/bpalencia27/d231aab6.../raw/gistfile1.txt?nocache=<ts>   → @version 18.4.5   (hoy; sin ?nocache leyó 18.0.4 del edge de CDN minutos antes)
GET https://script.google.com/macros/s/AKfycbwXw...689kq3R7tC/exec?nocache=<ts>               → {"minVersion":"18.4.4", "force":false, "killSwitch":{active:false}, ts 2026-09-07T18:22:52Z}
GET (misma URL, copia cacheada del 31-ago)                                                    → {"minVersion":"18.0.3", ts 2026-08-31T03:02:58Z}
git: HEAD d5b38d7 (v18.4.5) contiene la regla (L36826/L37173/L37513); working tree limpio.
```

## Anexo 2 — Certificación del banco contra copia congelada (post-análisis)

El árbol vivo se reescribe por tareas paralelas mientras el banco corre (varias corridas completas murieron con "no se encontró el cierre del IIFE" por snapshots a medio escribir, y una con el proceso node terminado a mitad por contención del entorno). Para certificar sin carreras se congeló una copia (`vigilante_agenda.user.js` + `tests/` + `package.json`) y se corrió ahí:

- `suite_17_nucleo` (toda el área de la regla: bloqueo, diferimiento por consulta, fail-open, candado de arranque): **exit 0, en verde**.
- `suite_30_killswitch_canario`: **11/12 en verde**. La única falla NO es de la regla: «R5.1 Cuádruple sincronización — `const VERSION` debe coincidir con `@version`: esperaba "18.4.5" y obtuvo "18.4.6"» — una tarea paralela dejó el fallback de `const VERSION` (L1038) en 18.4.6 con el encabezado aún en 18.4.5, en plena preparación de la siguiente release. En producción no afecta (VERSION viene de `GM_info.script.version`), pero es evidencia en vivo del problema de proceso C2: varias manos suben versiones a la vez sin una sola puerta. **Hallazgo NO tocado** (propiedad de la tarea que prepara la 18.4.6).
- Banco completo de referencia con la regla incluida: **3415/0** (06-sep, corrida propia) y **3467/0** (07-sep, commit `38d3a65` del enjambre, "banco final v18.4.4 + registro del deploy, gist verificado").

