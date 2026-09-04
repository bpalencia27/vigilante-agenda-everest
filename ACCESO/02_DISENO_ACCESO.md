# ACCESO · 02 — DISEÑO (modelo de capacidades)
Fecha: 2026-09-04 · Basado en: especificación del dueño + entrevista respondida `1C 2B 3A 4A 5A 6A 7A`
Userscript v18.0.143 SIN TOCAR — este documento es diseño, no parche.

## 1. Superficie real de gating hoy (evidencia grep 2026-09-04)

- 4 llamadas directas a `mtrEsMedicoAutorizado()`: L8048 (dock), L8772 (redactor, compuesto con `S.iaRedaccion` + clave Gemini), L14992 y L15046 (gates del resumen/labs en el panel).
- El «quinto sitio» de la especificación resuelto: `_autorizado` se calcula UNA vez en L8048 y se reutiliza dentro del dock en L8070, 8117, 8166, 8217, 8228, 8241, 8262, 8280 (sub-gates de botones, avisos y secciones). No es una quinta llamada: es el hilo derivado del dock.
- 2 consumidores de `esMedicoRCVActivo()`: L22510 y L26821 (todo RCV/tablero).
- `blocklist`/`padrón`: 0 ocurrencias en el archivo (no existen).

## 2. Capacidades (una sola fuente de verdad)

```
centinela · notificaciones · agendar_labs (openLabSoloModal L29281) ·
laboratorios (openLaboratoriosModal L24159) · widget_examen_normal ·
widget_examenes_autolabs · aviso_paciente_nuevo ·
psic_odonto (PÚBLICA, 1C) · pym (PÚBLICA, 1C; módulo L30103 + GENERAR órdenes, 2B) ·
agendar_control (openAgendamientoModal L26807) · panel_paciente (L25885) ·
redactor_ia (L45364) · rcv (tablero, L22510/L26821)
```

| Perfil | Capacidades |
|---|---|
| COMPLETO | todas (13) |
| LABORATORIOS | centinela · notificaciones · agendar_labs · laboratorios · widget_examen_normal · widget_examenes_autolabs · aviso_paciente_nuevo (+ públicas psic_odonto, pym). NO: agendar_control, panel_paciente, redactor_ia, rcv |
| PÚBLICO (médico de Everest fuera del padrón, no bloqueado) | psic_odonto · pym (1C: «como hoy») |
| BLOQUEADO (blocklist gana SIEMPRE) | ninguna, silencio total (6A) |

Nota 2B — RESUELTA (mapeo de implementación 2026-09-04, declarar no asumir cumplido):
«generar orden PyM» y «ordenamiento (L30103)» son LA MISMA superficie. Evidencia grep pegada:
`openOrdenamientoModal` (DEF L30103) tiene UN solo llamador vivo, el widget bOrd «📋 ordenar
PyM» (L8192); `apiOrdenamientoGuardar` (DEF L29900, el POST GuardarOrdenamiento) tiene UN
solo llamador, L30601, dentro del confirm del MISMO modal; y el botón de Conducta «ordenar
lo pendiente» NO crea órdenes reales desde v17.35.0 — simula el gesto nativo de Paquetes sin
POST (comentario L30828-30864). Bloquear «ordenamiento» habría bloqueado justo lo que 2B
aprobó. La capacidad `ordenamiento` se FUSIONA en `pym` → quedan 13. El ordenamiento de la
Ruta de Crónicos (otro flujo, swHC:true, comentario L29897-29899) sigue cubierto por `rcv`.
Vetable sin costo: si el dueño pensaba en otra superficie, se separa de nuevo en B3.

## 3. Lista remota (D3) — fuente de verdad y respaldo

- Endpoint nuevo en el Apps Script del tablero: `?accion=listaAcceso` devuelve:
  `{ version:"2026-09-04.1", emitida:"…", perfiles:{ COMPLETO:[{uid,nombre}], LABORATORIOS:[{uid,nombre}] }, blocklist:[{uid,nombre,motivo}] }`
- Validación estricta ANTES de aplicar (schema + tipos + perfiles conocidos). Lista corrupta/incompleta → se CONSERVA la anterior + telemetría `acceso.lista.rechazada {motivo}`.
- Respaldo local: `localStorage vgl_acceso_lista` = última lista válida + `{version, descargada}` (versionada con fecha, 7A).
- Refresco: al arrancar el script + cada 4 h + al abrir ajustes. Fallo de red → se usa el respaldo local sin castigo.
- Cambiar el padrón NO publica versión nueva del userscript (5A/7A).

## 4. Identidad (D1) y gracia (D2) — resolución en orden

1. `uid` = `UsuarioId` de sesión (lectura existente L20528-20536). `uid` ∈ blocklist → BLOQUEADO (gana siempre, silencio).
2. `uid` ∈ perfiles.X → perfil X.
3. `uid` existe pero no aparece → respaldo por NOMBRE contra la lista remota (D1: nombre solo respaldo) → si matchea, perfil; si no → PÚBLICO.
4. Sin `uid` ni nombre → gracia D2: si `vgl_acceso_ultimo_ok` (<12 h) existe → último perfil vigente; vencida → PÚBLICO con capacidades privadas cerradas.

Interpretación declarada (vetable sin costo): las capacidades PÚBLICAS se montan aunque no
haya identidad (como hoy, 1C «parecido a hoy»); el blocklist solo aplica cuando hay identidad.
Ajuste futuro = editar lista remota, no publicar versión.

## 5. Tres capas de compuerta

- **Capa a — la UI no se construye**: cada builder consulta `accesoCap("…")` antes de montar. Anclajes: dock y derivadas (L8048-8280), redactor (L8772), gates resumen/labs (L14992, L15046), RCV (L22510, L26821), widgets y módulos por su `open*`.
- **Capa b — la apertura sale en seco**: primera línea de cada `open…Modal`/entrada de módulo: `if (!accesoCap("agendar_labs")) return;` — cubre temporizadores, flujos automáticos y atajos que no pasan por botón.
- **Capa c — la ESCRITURA re-comprueba**: guard común `accesoEscribir("cap")` (re-resuelve identidad+capacidad en el momento de escribir) en las 7 familias RED_ESCRITURA medidas en R0 (AgendarCita, CancelarCita, CancelarTurno, EnviarEmailOrdenamiento, EnviarMensajeTextoLaboratorio, EnviarSMS, GuardarOrdenamiento) + `apiRecordar`. Para capacidades públicas el guard solo verifica blocklist.
- **Envoltorios compatibles** (migración sin tocar los 6 call sites en el primer parche): `mtrEsMedicoAutorizado()` → `accesoPerfil()==="COMPLETO"`; `esMedicoRCVActivo()` → `accesoCap("rcv")`.

## 6. Aviso de paciente nuevo (4A — discreto)

- Detección en el procesamiento diario: cita de hoy con id de cita nunca visto → toast NO bloqueante (auto-cierre 8 s) + contador en el dock. Jamás modal.
- Dedup por **id de cita** (estable ante reordenamientos); una vez por paciente por día.
- Reinicio a medianoche: clave datada `vgl_aviso_pacientes_<YYYY-MM-DD>`.
- Presupuesto de interrupciones: máx 3 toasts por hora; superado el tope, solo incrementa el contador.
- Capacidad `aviso_paciente_nuevo` (COMPLETO y LABORATORIOS).

## 7. Telemetría de acceso (sin datos de paciente)

`acceso.perfil {perfil, via: uid|nombre|gracia|publico, versionLista}` ·
`acceso.bloqueado.intento {via}` · `acceso.cap.denegada {cap, capa}` ·
`acceso.lista.aplicada/rechazada {version, motivo}` · `acceso.gracia.usada`.
El uid del médico NO es PHI (es personal del consultorio); jamás datos de paciente.

## 8. Límite de seguridad (se le dice al dueño sin adornos)

Un userscript NO impone seguridad: corre en la máquina del usuario y cualquiera con
conocimiento lo desactiva o edita. Esto es CONTROL OPERATIVO de nuestros servicios.
Cerradura real (propuesta): el Apps Script rechaza `UsuarioId` fuera del padrón en cada
endpoint que consuma el script. La decisión es del dueño.

## 9. Pruebas obligatorias (antes de publicar)

1. Matriz perfil(4) × capacidad(13) × capa(3): nada se monta / nada se abre / nada se escribe según tabla §2.
2. Identidad: ausente · gracia <12 h · gracia vencida · uid en blocklist GANA sobre padrón.
3. Lista remota corrupta → conserva la anterior (verificar `vgl_acceso_lista`).
4. Variantes de nombre (tilde, orden, segundo apellido) NO cambian nada cuando hay `uid`.
5. Aviso paciente nuevo: no se repite (misma cita, reorden, medianoche).
6. Cada arreglo del userscript: banco rojo → parche → verde → MUTACIÓN (4 salidas pegadas) → banco.
7. Bump ÚNICO de versión al final, coordinado con R6 de ESTABILIDAD (probable `18.1.0`).
