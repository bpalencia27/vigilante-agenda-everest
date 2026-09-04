# ACCESO · 00 — ESTADO Y DIAGNÓSTICO (Misión B)
Fecha de cierre: 2026-09-04 · Userscript **v18.1.0** (desde `6d5f633` = v18.0.143, producción en
3 consultorios). CÓDIGO: **ESCRITO, PROBADO Y CERRADO** (B1–B6 completos). Diseño en
`02_DISENO_ACCESO.md`; implementación con banco rojo→parche→verde→mutación por arreglo.

## Resultado (lo que quedó en v18.1.0)

| Fase | Qué cerró | Evidencia |
|---|---|---|
| B1 | Modelo de capacidades con UNA fuente de verdad: 13 capacidades (2 públicas, 7 de laboratorios, 4 solo-COMPLETO); `mtrEsMedicoAutorizado`/`esMedicoRCVActivo` quedaron como envoltorios de `accesoCap()` | suite_78 |
| B2 | Lista remota desde el tablero (hoja `acceso`): refresco al arrancar + cada 4 h + al abrir ajustes; validada antes de aplicar; caché local `vgl_acceso_lista` como respaldo sin castigo; blocklist gana SIEMPRE y en silencio | suite_78 |
| B3 | Identidad por `UsuarioId` con nombre de respaldo; sin identidad → gracia 12 h (`vgl_acceso_ultimo_ok`) y después PÚBLICO con lo privado cerrado | suite_78 |
| B4 | Capa c: `accesoEscribir(cap)` re-comprueba identidad+capacidad en el momento de escribir en los embudos de red (tabla `ACCESO_ESCRITURA_URLS`) + `apiRecordar` | suite_78 |
| B5 | Aviso de paciente nuevo: dedup por cita (`vgl_aviso_hist_<uid>`), bootstrap silencioso, máx 3 toasts/h, contador en el dock, clave datada SIN nombres, capacidad `aviso_paciente_nuevo` | suite_79 (14 casos, verde a la primera) |
| B6 | Telemetría de denegaciones sin PHI: SOLO capa c cuenta (`_accesoDenegAnota`); memoria → disco cada 30 min (clave datada `vgl_acceso_deneg_<YYYY-MM-DD>` con poda); al tablero 1×/día si hubo denegaciones (`reportar("acceso_deneg", {uid, perfil, cuentas})`, candado `vgl_rep_acceso_deneg`); anti-tormenta >32 claves. Matriz 4 perfiles × 13 capacidades × 3 capas verificada | suite_80 (9 casos) |

Banco al cierre: **3317 pruebas / 0 fallos / exit 0** (`npm test`, progresión 3294 → 3308 → 3317).
`node --check` OK. Cambios: userscript +541 líneas, `TABLERO/Codigo.gs` (hojas `acceso` y
`acceso_uid`) +168, `TABLERO/simulacion_local.js` +68, 15 suites ampliadas, 3 suites nuevas
(78, 79, 80).

## Matriz final (13 capacidades × 4 perfiles)

- **PÚBLICO** (2 sí): `psic_odonto`, `pym`.
- **LABORATORIOS** (9 sí): las 2 públicas + `centinela`, `notificaciones`, `agendar_labs`, `laboratorios`, `widget_examen_normal`, `widget_examenes_autolabs`, `aviso_paciente_nuevo`.
- **COMPLETO** (13 sí): todas + `agendar_control`, `panel_paciente`, `redactor_ia`, `rcv`. Capacidad desconocida → `false` en todos MENOS COMPLETO (COMPLETO = «todo», por diseño, documentado en suite_80).
- **BLOQUEADO** (0 sí): ni las públicas. El script no se construye, en silencio.

## Diagnóstico original (2026-09-04, ANTES de escribir código — se conserva como registro)

**QUÉ HACÍA v18.0.143:**

1. Lista embebida `MTR_MEDICOS_AUTORIZADOS` (L10452-10457): 4 nombres completos en MAYÚSCULAS; `mtrNormalizarNombre` (L10458) quita tildes, pasa a mayúsculas y colapsa espacios; `mtrEsMedicoAutorizado` (L10463-10470) comparaba ese nombre contra `state.activeDoctor.name` — `false` si no hay nombre o si el `try/catch` revienta.
2. SEGUNDA lista paralela `RCV_DOCTORS` (L22454): 8 tokens de apellido; `esMedicoRCVActivo` (L22462-22466) hacia match por token COMPLETO (fix v17.6.47 contra substring). Dos listas = dos fuentes de verdad que podían divergir.
3. Puertas: 4 llamadas a `mtrEsMedicoAutorizado` (dock, redactor, 2 más) + 2 a `esMedicoRCVActivo`. Las 6 de capa "a" (la UI no se construye); NINGUNA re-comprobaba en la escritura.
4. Identidad: se leía `PAGEWIN.UsuarioId` y `UsuarioNombreCompleto` (L20528-20536) pero el control usaba SOLO EL NOMBRE normalizado — frágil (segundo apellido, homónimos). El `UsuarioId` de `apiEnviarOrdenPorCorreo` es del PACIENTE — no confundir.
5. "Los demás médicos" veían script parcial — CONTRA la especificación nueva: quien no está en el padrón no debe ver NADA, en silencio.

**LO QUE LE FALTABA:** identidad por uid con gracia (D1/D2), modelo de capacidades con una
fuente de verdad (D3), capas b y c, lista remota + blocklist, perfiles COMPLETO/LABORATORIOS,
aviso de paciente nuevo y telemetría sin PHI. Todo eso ES v18.1.0.

## Límite que se le dice al dueño sin adornos

Un userscript NO impone seguridad: corre en la máquina de quien lo usa; cualquiera con
conocimiento puede editarlo o usar la consola y saltarse TODO. Esto es CONTROL OPERATIVO
(evitar errores y uso indebido de NUESTROS servicios), no barrera. La cerradura real la tiene
el servidor: PROPUESTA — que el Apps Script del tablero rechace identificadores (`UsuarioId`)
fuera del padrón en cada endpoint que consuma el script.

## Fases

- [x] Lectura inicial · [x] Diagnóstico 10 líneas · [x] Entrevista 1-7 redactada y RESPONDIDA (`1C 2B 3A 4A 5A 6A 7A`)
- [x] Diseño: capacidades · 3 capas · D1/D2/D3 · blocklist · aviso paciente nuevo · telemetría (`02_DISENO_ACCESO.md`)
- [x] Implementación: banco rojo→parche→verde→mutación; matriz 4×13×3 (suites 78/79/80, 58 casos nuevos)
- [x] Bump único de versión: **18.1.0** (encabezado + respaldo `VERSION` + literal suite_75) + CHANGELOG
- [x] Push + Gist PATCH + verificación raw_url · revocación de PAT al final de TODO (ver `REPORTE_M2M.md`)

## Pendiente del DUEÑO (no bloquea la publicación)

1. **Desplegar el TABLERO antes que el userscript** (orden obligatorio): el Apps Script nuevo publica la hoja `acceso`.
2. **Armar el padrón**: leer los uids reales que el tablero anota en la hoja `acceso_uid` (llegan solos cuando cada médico abre sesión) y copiarlos a `acceso` con su perfil; blocklist con uid+motivo.
3. Mientras `acceso` esté vacía: todos caen a PÚBLICO (con gracia de 12 h sobre el último perfil vigente) — nada se rompe, pero nadie ve sus módulos privados.
4. Evento nuevo en el tablero: `acceso_deneg` (uid, perfil, cuentas) — llega 1×/día solo si hubo denegaciones de escritura.
