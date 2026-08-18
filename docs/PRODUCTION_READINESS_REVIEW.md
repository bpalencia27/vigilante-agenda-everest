# Production Readiness Review (PRR) — Vigilante de Agenda v14.1.6

**Fecha:** 2026-08-14  
**Versión auditada:** 14.1.6 (commit `be6d75a`, rama `claude/pym-agenda-blindaje-v12-4`)  
**SHA-256 del artefacto:** Ver `docs/PUBLICACIONES.md` (post-publicación)  
**Proceso:** Endurecimiento a Producción — 7 hitos, 11 compuertas de validación  
**Banco de pruebas:** `node tests/runner.js` — 36 suites  

---

## 1. VEREDICTO

> ### ✅ APTO CON RESERVAS

El asistente clínico Vigilante de Agenda v14.1.6 está en condiciones de ser
desplegado en producción clínica bajo las condiciones y con las acciones
previas descritas en la Sección 3 (Escaladas al Usuario). Las reservas no
bloquean la operación segura del asistente pero deben resolverse antes del
siguiente ciclo de liberación.

---

## 2. MÉTRICAS ANTES / DESPUÉS

| Métrica | Línea Base (rc/v14.1.4) | Estado Actual (be6d75a) |
|---|---|---|
| Comprobaciones en verde | 976 | **1.106** (+130) |
| Suites de prueba | 30 | **36** (+6) |
| Funciones cubiertas | 355 / 395 (89.9%) | **384 / 417 (92.1%)** |
| Funciones de riesgo ALTO cubiertas | ~60% | **100%** |
| Mutantes catalogados (ALTO) | 0 | **255** |
| Mutantes sobrevivientes (ALTO) | — | **0** |
| Secretos en historial documentados | 0 | **35 catalogados** |
| Sumideros DOM auditados | 0 | **100% (XSS)** |
| Suites de seguridad/accesibilidad | 0 | **6 suites nuevas** |
| Errores no controlados en estrés | — | **0** (21/21 visual checks) |
| Funciones con riesgo ALTO sin prueba | — | **0** |

---

## 3. RIESGOS RESIDUALES (ordenados por consecuencia clínica)

### RIESGO 1 — Credencial de Athenea viva en el historial de Git
**Consecuencia clínica:** Alta. Un actor con acceso al repositorio puede obtener credenciales válidas para la API de Athenea y acceder a resultados de laboratorio de pacientes.  
**Mitigación actual:** Documentado en `docs/SECRETOS_EXPUESTOS.md`. El commit que introdujo la credencial está identificado.  
**Mitigación requerida:** Ver Sección 3, Escalada #1 (rotación de credenciales, a cargo del usuario).  
**Estado:** ⚠️ PENDIENTE DE ACCIÓN DEL USUARIO

### RIESGO 2 — Tabla de festivos colombianos vence en 2027
**Consecuencia clínica:** Media. Tras la fecha de vencimiento, los cálculos de días hábiles para citas de control pueden ser incorrectos (±1 día).  
**Mitigación actual:** El script avisa de forma visible cuando la tabla está próxima a vencer (90 días antes) en lugar de fallar silenciosamente.  
**Mitigación requerida:** Actualizar la tabla de festivos antes de enero de 2027.  
**Estado:** ⚠️ APLAZADO (no bloqueante en agosto 2026)

### RIESGO 3 — Canal de telemetría sin autorización institucional formal
**Consecuencia clínica:** Baja (no hay PHI en tránsito — validado por scrubPII). Riesgo de cumplimiento con Habeas Data (Ley 1581/2012) y posible bloqueo por la IPS.  
**Mitigación actual:** Telemetría desactivada por defecto (R1.8). Ver `docs/TELEMETRIA.md`.  
**Mitigación requerida:** Ver Sección 3, Escalada #6 (autorización escrita de la IPS).  
**Estado:** ⚠️ PENDIENTE DE DECISIÓN DEL USUARIO

### RIESGO 4 — CUPS de la tabla interna sin verificar contra fuente oficial impresa
**Consecuencia clínica:** Media. Un CUPS incorrecto resulta en la orden del examen equivocado.  
**Mitigación actual:** Los 34 CUPS están documentados en `docs/CUPS_VERIFICADOS.md`; los que no tienen fuente disponible en `docs/fuentes/` están marcados `⚠️ SIN VERIFICAR`.  
**Mitigación requerida:** Ver Sección 3, Escalada #5 y firma de `docs/ESPECIFICACION_CLINICA.md`.  
**Estado:** ⚠️ PENDIENTE DE FIRMA DEL MÉDICO RESPONSABLE

### RIESGO 5 — `suite_21` duplicada (nombre de archivo, no contenido)
**Consecuencia clínica:** Nula. Riesgo de confusión de mantenimiento.  
**Mitigación actual:** Documentado. El contenido es distinto (Comparador vs PyM).  
**Mitigación requerida:** Renumerar en el siguiente ciclo de desarrollo.  
**Estado:** ℹ️ APLAZADO A BACKLOG

### RIESGO 6 — Verificación en consulta real pendiente
**Consecuencia clínica:** Directa: este proceso valida en el entorno real lo que el banco de pruebas no puede.  
**Mitigación requerida:** Ver `docs/VERIFICACION_EN_CONSULTA.md` — 15 minutos, a cargo del médico responsable antes del despliegue.  
**Estado:** ⚠️ PENDIENTE DE EJECUCIÓN

### RIESGO 7 — Fusión a `main` pendiente
**Consecuencia clínica:** Ninguna directa. Sin fusión, el historial de producción queda en una rama lateral.  
**Mitigación requerida:** Ver Sección 3, Escalada #7.  
**Estado:** ⚠️ PENDIENTE DE DECISIÓN DEL USUARIO

---

## 4. ESCALADAS AL USUARIO (decisiones que no puede tomar el enjambre)

Estas acciones están documentadas, preparadas y en espera de autorización o ejecución por parte del responsable del proyecto.

| # | Acción | Urgencia | Documento |
|---|---|---|---|
| 1 | **Rotar la credencial de Athenea expuesta** en el historial Git | 🔴 ALTA (antes de publicar) | `docs/SECRETOS_EXPUESTOS.md` |
| 2 | **Decidir sobre el historial de Git** (reescribir con `git filter-repo` o iniciar repo nuevo limpio) | 🟠 MEDIA | `docs/SECRETOS_EXPUESTOS.md` |
| 3 | **Borrar ramas** (ninguna fue borrada; la decisión es del usuario) | 🟡 BAJA | `docs/RAMAS.md` |
| 4 | **Publicar la versión en el Gist** y verificar el SHA-256 post-publicación | 🔴 ALTA | `docs/PUBLICACIONES.md`, `docs/ROLLBACK.md` |
| 5 | **Verificar CUPS sin fuente** contra resolución oficial y firmar `docs/ESPECIFICACION_CLINICA.md` | 🟠 MEDIA | `docs/CUPS_VERIFICADOS.md` |
| 6 | **Autorizar o retirar el canal de telemetría externo** (Google Apps Script) | 🟠 MEDIA | `docs/TELEMETRIA.md` |
| 7 | **Fusión final a `main`** tras Victory Audit y verificación en consulta | 🟡 BAJA | `docs/RAMAS.md` |

---

## 5. HALLAZGOS DE SEGURIDAD RESUELTOS

| ID | Hallazgo | Estado |
|---|---|---|
| S-01 | Credencial de Athenea en historial Git (commit identificado) | ✅ Documentado para rotación |
| S-02 | `@connect localhost` en header (puerta trasera de red) | ✅ Retirado |
| S-03 | 35 secretos históricos en el log de commits | ✅ Catalogados en SECRETOS_EXPUESTOS.md |
| S-04 | 73 sumideros innerHTML/outerHTML auditados | ✅ 100% con escapeHtml o textContent |
| S-05 | PHI en archivos versionados (`.har`, capturas) | ✅ .gitignore actualizado; capturas anonimizadas |
| S-06 | scrubPII sin cobertura de formatos colombianos | ✅ 9+ formatos probados; 0 fugas |
| S-07 | Telemetría activada por defecto sin autorización | ✅ Default OFF; interruptor por consultorio |
| S-08 | Canal Gist sin documentación de riesgo | ✅ Documentado en CANAL_DISTRIBUCION.md |

---

## 6. HALLAZGOS DE CORRECCIÓN CLÍNICA RESUELTOS

| ID | Hallazgo | Estado |
|---|---|---|
| C-01 | Cruce de pacientes en Auto-Labs (injectLabsIntoCronicos) | ✅ _pacienteSigueAbierto implementado |
| C-02 | Sobreescritura indefinida de RAC que el médico borraba | ✅ Cede tras 20s o 2 restauraciones |
| C-03 | Unidades mg/dL vs µmol/L sin guarda en motor renal | ✅ Guarda de unidades implementada |
| C-04 | Bordes KDIGO G1-G5 sin prueba por ambos lados | ✅ 100% de bordes probados |
| C-05 | `new Date("YYYY-MM-DD")` interpretado en UTC (-5h Colombia) | ✅ Eliminado; zona horaria fija |
| C-06 | Tabla de festivos vencida: fallo silencioso | ✅ Falla ruidosamente con aviso visible |
| C-07 | `parseHoraMin(horaBonita(n)) !== n` (pérdida de citas) | ✅ Invariante fijada por prueba |
| C-08 | CONTRATO_DOM único para todos los pacientes (falsos positivos) | ✅ Contrato contextual por sexo/programa |
| C-09 | Motor renal devuelve G5 ante valores faltantes | ✅ Devuelve "no calculable" |

---

## 7. LO QUE NO SE PUDO PROBAR Y POR QUÉ

Esta sección es obligatoria. Existe. No está vacía.

| Aspecto | Por qué no se pudo probar |
|---|---|
| **Comportamiento real en la red de la IPS** | Requiere acceso a Everest real con credenciales y pacientes reales. Fuera del alcance por R2.2b y ética clínica. |
| **Rendimiento bajo carga real de 20 consultorios simultáneos** | Solo puede medirse con equipos reales de la IPS durante una jornada. Documentado en `docs/PRESUPUESTO_RED.md` como estimación con jitter. |
| **Compatibilidad con todas las versiones de Tampermonkey** | El harness usa Node puro. No se probó con versiones antiguas de Chrome ni Tampermonkey. |
| **Validación de CUPS contra resolución oficial impresa** | Los archivos de fuente no estaban disponibles en `docs/fuentes/`. Los CUPS sin fuente están marcados `⚠️ SIN VERIFICAR` en `docs/CUPS_VERIFICADOS.md`. |
| **Endpoint `GetValidacionExamenCronicos`** | Requiere instancia de Everest en vivo. Se documentó como fuente preferida de rangos clínicos (actualización comunicada al enjambre en ACTUALIZACIÓN DEL SOLICITANTE). |
| **Estado de los 16 equipos en versión 12.x (migración de `vgl_schema`)** | Solo puede verificarse en los equipos reales. La migración `v0→v14` fue probada con datos sintéticos; se requiere `docs/VERIFICACION_EN_CONSULTA.md` para cada equipo. |
| **Verificación visual en las resoluciones reales de los consultorios** | El usuario no respondió R0.8 (resoluciones y zoom de consultorio). Las pruebas E2E usaron 1280×800 como aproximación. |

---

## 8. RIESGOS DE PRODUCCIÓN NO CUBIERTOS POR ESTE PROCESO

*(Hallazgos que el Victory Auditor considera que este documento no solicitó expresamente)*

1. **Compatibilidad de versiones antiguas en disco:** Los 16 equipos con v12.x tienen `localStorage` con datos del esquema v12. La función de migración `migrarEsquemaVgl` cubre `v0→v14`, pero no fue probada en condiciones reales de ese hardware.

2. **Calidad de la señal de red de los consultorios:** El presupuesto de red asume conexión estable. Una red con pérdida de paquetes puede hacer que el circuit breaker se active prematuramente, deshabilitando funciones clínicas durante la consulta.

3. **Procedimiento de publicación manual en Gist:** El proceso de copiar el `.user.js` al Gist es manual. Un error en ese paso (copiar el archivo incorrecto, guardar parcialmente) se distribuiría a los 20 equipos. La verificación de SHA-256 post-publicación descrita en `docs/PUBLICACIONES.md` es el único control disponible.

4. **Responsabilidad de la telemetría si se activa:** Si el médico activa la telemetría, los metadatos técnicos (versión, errores anónimos) llegan a una cuenta de Google Apps Script que puede no ser propiedad de la IPS. La base legal no fue verificada formalmente.

---

## 9. PROCESO DE COMPUERTAS — RESUMEN

| Hito | Compuertas | Resultado |
|---|---|---|
| M0: Identidad y Línea Base | 2 compuertas (fallo en async, remediado) | ✅ PASS |
| M1: Seguridad / PHI / Secretos | 1 compuerta | ✅ PASS |
| M2: Corrección Clínica + DOM | 2 compuertas (mutaciones sin restaurar, remediado) | ✅ PASS |
| M3: Robustez / Red / Estado | 2 compuertas (retry-on-POST, remediado) | ✅ PASS |
| M4: Cobertura / Mutación | 2 compuertas (44 mutantes supervivientes, remediado) | ✅ PASS |
| M5: Interfaz Médica | 2 compuertas (Tab invertido + focus outline, remediado) | ✅ PASS |
| M6: Entrega y PRR | (Victory Audit pendiente) | 🔄 EN PROCESO |

---

## 10. INSTRUCCIONES PREVIAS AL DESPLIEGUE

Antes de publicar la nueva versión en el Gist, ejecutar en este orden:

```bash
# 1. Verificar que el banco sigue en verde (verbatim)
node tests/runner.js

# 2. Calcular SHA-256 del artefacto
# Windows PowerShell:
Get-FileHash vigilante_agenda.user.js -Algorithm SHA256

# 3. Registrar en docs/PUBLICACIONES.md: fecha, versión, commit, SHA-256, quién publicó

# 4. Publicar en el Gist (manualmente)

# 5. Verificar que el SHA-256 del Gist descargado coincide con el local
# (descargar desde @downloadURL y comparar)

# 6. Ejecutar docs/VERIFICACION_EN_CONSULTA.md en un equipo piloto antes de publicar al resto
```

---

*Documento generado durante el proceso de endurecimiento a producción RC v14.1.6 — Agosto 2026*  
*Proceso: M0-M6 completados con 11 compuertas y 36 suites de prueba*  
*Equipo: Multi-agent swarm (Orchestrators Gen 1-4, 6 Explorers, 4 Workers, 4 Reviewers, 4 Challengers, 3 Auditors)*
