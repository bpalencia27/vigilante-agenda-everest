# Informe — Método oficial para forzar la actualización de todos los equipos con versiones antiguas

Fecha: 2026-09-07. Fuente de censo: `REPORTE-VIGILANTE (2).xlsx` (rama `claude/v14-continuacion`, URL provista por el dueño; descargado del raw de GitHub, 3,8 MB, 11 hojas, datos hasta 2026-09-07T17:09Z). Comparación: `REPORTE-VIGILANTE (3).xlsx` (local, más antiguo: corta el 28-ago). Cero PHI: solo conteos y versiones.

---

## 1. Resumen ejecutivo

- **Sí existe método oficial automático** — y ya está publicado: el canal Gist+Tampermonkey (oficial del gestor) más los aceleradores del propio proyecto (`MIN_VERSION`, aviso proactivo y, desde 18.4.1, el bloqueo irreversible con flujo de actualización).
- **No existe —ni en Tampermonkey ni en el proyecto— un mecanismo para instalar código a distancia en equipos que ya corren versiones viejas.** El "forzado" real es: publicar → cada Tampermonkey actualiza solo en su ciclo (~24–48 h) → `MIN_VERSION` empuja recarga/aviso a los rezagados → quien pasa por 18.4.5 queda bajo la regla de bloqueo permanente.
- **Censo del (2).xlsx: 88 equipos, 0 (cero) en ≥18.4.1** — el 100 % de la flota reportada está por debajo de la regla de actualización obligatoria. El clúster más grande: v17.0.2 (26 equipos, 30 %).

## 2. Censo de flota (hoja `entorno`, última versión vista por equipo)

Rango de reportes: 2026-08-12 → 2026-09-07T11:06Z. Equipos distintos: **88**.

| Versión | Equipos | % | Cohorte de capacidades remotas |
|---|---|---|---|
| 17.0.2 | 26 | 30 % | minVersion-push + aviso proactivo |
| 8.2.2000 | 11 | 13 % | minVersion-push (sin aviso proactivo: es < v14.2.0) |
| 18.0.4 | 10 | 11 % | push + aviso + (onda kill-switch R5.3) |
| 14.0.0 | 8 | 9 % | push (aviso proactivo no: < 14.2.0) |
| 18.0.32 | 8 | 9 % | push + aviso |
| 12.10.2000 | 5 | 6 % | push |
| 12.6.2009 | 3 | 3 % | push |
| 15.2.2000 | 3 | 3 % | push + aviso |
| 18.1.1 / 14.2.2001 / 16.2.2006 / 16.0.0 / 18.0.137 | 2 c/u | 11 % | mixtas |
| 18.0.130 / 18.0.5 / 18.3.1 / 18.3.2 | 1 c/u | 5 % | mixtas |
| **≥ 18.4.1 (con bloqueo irreversible)** | **0** | **0 %** | — |

- Actividad real: la hoja `uso` (18.489 filas, hasta hoy 17:09Z) registra uso de panel en los mismos 88 equipos; equipos con reporte de entorno en las últimas 72 h: 10 (17.0.2×3, 18.1.1×2, 18.0.137×2, 18.0.130, 18.3.1, 18.3.2) — es decir, el subconjunto que reporta a diario.
- La hoja `resumen_flota` del TABLERO ya expone por equipo: versión, ¿al día?, último reporte — es la herramienta de seguimiento natural para esta campaña.
- Nota metodológica: "última versión vista" puede sobreestimar la antigüedad de equipos que dejaron de reportar; para seguimiento usar "Último reporte" de `resumen_flota`.

## 3. ¿Existe una solución oficial?

### 3.1 Del proveedor del gestor (Tampermonkey) — SÍ, automática pero no forzable a distancia
- Mecanismo oficial: sondeo periódico de `@updateURL`; si `@version` del Gist > instalada, TM descarga y reemplaza solo (documentado en `docs/CANAL_DISTRIBUCION.md` §1).
- Límites oficiales: el intervalo de sondeo se configura **localmente** en cada navegador; **no hay API** (`GM_*`) ni cabecera que permita al servidor o al propio script viejo disparar la instalación en el acto. La única vía manual oficial es TM → Utilidades → «Buscar actualizaciones de userscripts» (es la que el modal de bloqueo guía).
- Todo lo demás (inyección remota de código, auto-instalación silenciosa) está fuera del modelo de seguridad de TM y del proyecto — no es vía.

### 3.2 Del desarrollador original (el propio repo) — SÍ, cuatro palancas documentadas
1. **Publicación del Gist** (`@updateURL`/`@downloadURL`, cabecera del userscript): el método oficial de distribución; el comentario del código cita la guía `3_ACTUALIZAR_TODOS_LOS_EQUIPOS.txt` — **archivo inexistente en el árbol actual** (hallazgo: guía perdida o nunca commiteada; solo queda la referencia en el comentario).
2. **`MIN_VERSION` del TABLERO** (v7.8.1+, alcanza a TODA la flota del censo): recarga controlada + aviso, respetando consulta activa (`docs/CANAL_DISTRIBUCION.md` §1.2, ya activada hoy en 18.4.4).
3. **Bloqueo irreversible por versión obsoleta** (≥18.4.1, publicado hoy en el Gist 18.4.5): candado `vgl_version_lock` + modal solo-actualización + telemetría `verlock` (informe anterior).
4. **Kill-switch remoto de emergencia** (onda R5.3, ~v18.0.x): apaga equipos — último recurso, sin flujo de actualización.
- Plan oficial futuro no implementado: **GitHub Releases con tags firmados** (`CANAL_DISTRIBUCION.md` §3, Fases 1–2) — eliminaría el Gist editable y el riesgo CDN split-brain; los headers siguen apuntando al Gist.

## 4. Viabilidad del forzado automático (matriz por cohorte, con censo)

| Población | ¿Quién la puede actualizar automáticamente? | Vía oficial | Plazo esperado |
|---|---|---|---|
| 88/88 equipos (< 18.4.1) | Tampermonkey, por sí solo | Gist 18.4.5 ya publicado | 24–48 h por equipo (ciclo TM) |
| idem, rezagados tras 48 h | MIN_VERSION 18.4.4 ya desplegada | recarga + aviso pasivo (≥7.8.1 = todos) | inmediato al abrir Everest |
| Quienes pasen por 18.4.5 | Regla de actualización obligatoria | bloqueo irreversible ante próxima obsolescencia | permanente |
| Rezagados crónicos ≥ ~18.0.x | Operador (último recurso) | kill-switch por scope | minutos — costo clínico alto |

**Conclusión**: la combinación oficial ya desplegada hoy (Gist 18.4.5 + MIN_VERSION 18.4.4) ES el método oficial de forzamiento automático disponible. No hay —ni puede haber, con seguridad— un botón que actualice al instante los 88 equipos: la instalación final siempre la decide el ciclo de TM en cada navegador.

## 5. Plan de implementación (pasos)

Ya ejecutado hoy (por el enjambre de tareas): publicación Gist **18.4.5** y despliegue TABLERO **18.4.4** (verificado con sondas anti-caché, informe anterior).

Pendientes, en orden:
1. **Sincronizar el repo con producción**: `TABLERO/VersionCheck.gs` quedó en 18.0.142 (drift invertido); subir MIN_VERSION repo → 18.4.4 y `EXPECTED_SHA256`/`EXPECTED_SHA_VERSION` según protocolo A1.
2. **Registrar la publicación** en `docs/PUBLICACIONES.md` (hoy registra hasta 18.0.4).
3. **Monitoreo a 24/48/72 h** con export del TABLERO (hoja `resumen_flota`): meta = 100 % de equipos activos reportando `ver 18.4.5`; eventos `verlock` = equipos que intentaron quedar rezagados y fueron bloqueados.
4. **Escalada solo si a 72 h quedan rezagados crónicos**: aviso al médico/coordinación y, en caso extremo, kill-switch por lista de equipos — nunca como primer paso.
5. **Regla dura permanente**: `MIN_VERSION` desplegado ≤ `@version` publicado en el Gist (si el servidor exige más de lo que el Gist sirve, los equipos al día quedan bloqueados sin poder actualizarse).

## 6. Requisitos técnicos

- GitHub con 2FA (dueño del Gist; vector CRÍTICO según `CANAL_DISTRIBUCION.md` §2).
- Cuota de Apps Script: el sondeo cada 5 min ya tiene jitter/relevo de pestaña líder (idem §2).
- Verificaciones del canal SIEMPRE con query anti-caché (CDN sirve copias 5–15 min).
- No publicar sin banco en verde (estándar vigente: 3467/0 en v18.4.4).
- Guards clínicos intactos: consulta activa nunca interrumpida, fail-open ante fallo de red.

## 7. Pruebas necesarias

1. Banco completo `node tests/runner.js` en verde antes y después de cada publicación.
2. Suite_30 (sincronía cuádruple de versión: `@version` = `const VERSION` = package.json = GM_info).
3. Sondas: Gist `?nocache=` → `@version` 18.4.5; `/exec?nocache=` → `minVersion` ≤ 18.4.5.
4. Verificación por equipo: export del TABLERO → hoja `entorno`/`uso` con `ver = 18.4.5` creciendo 24→72 h; eventos `verlock` revisados uno a uno.
5. Drill de rollback (forward-rollback R5.4, `docs/ROLLBACK.md`): tener listo el parche n+1 con contenido estable antes de cualquier publicación mayor.

## 8. Hallazgos adicionales

- `3_ACTUALIZAR_TODOS_LOS_EQUIPOS.txt` (guía oficial citada en el código) no existe en el árbol.
- `CANAL_DISTRIBUCION.md` §1.2 quedó desactualizado: dice que `VGL_UPDATE_GIST_URL` apunta a `gistfile2.txt`; desde v18.0.19 la URL se toma de `GM_info` (gistfile1) — el doc cuenta la historia del bug que ya se corrigió como si fuera el estado actual.
- 11 equipos en 8.2.2000 (≈5 semanas de atraso) reportan `entorno` — el aviso proactivo diario (v14.2.0) no los alcanza; solo el push de MIN_VERSION y el ciclo TM.

## Anexo — Metodología

El xlsx se descargó del raw de GitHub y se descomprimió (OOXML estándar). Parser temporal en Node (sin dependencias, `%TEMP%`): `sharedStrings.xml` + hojas → censo por columna `ver`/`equipo` con última versión vista por equipo. `(3).xlsx` local se procesó igual para comparación (más antiguo: hasta 28-ago, 53 equipos en `uso`). Archivos temporales eliminados tras el análisis.
