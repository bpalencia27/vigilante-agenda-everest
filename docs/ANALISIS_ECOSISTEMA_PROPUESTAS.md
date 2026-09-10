# Análisis del ecosistema Everest y propuestas de funcionalidades adicionales

Fecha: 2026-09-08 · Base: v18.8.0 (commit `7f580c4`) · Estado: propuesta para decisión del médico.

Este documento analiza el ecosistema actual del Vigilante de Agenda sobre el EHR Everest
(Athenea Soluciones, Angular SPA) y propone funcionalidades adicionales priorizadas por
impacto en la experiencia del usuario, la eficiencia operativa y la seguridad clínica.
**Cero PHI**: no hay datos reales de pacientes en este documento.

---

## 1. El ecosistema actual (inventario por capas)

### 1.1 Integraciones externas que el script ya domina

| Integración | Uso actual | Autenticación |
|---|---|---|
| Everest `neps.everestintelligent.com/apiviva/*` | Agenda, consultas, órdenes PyM, labs Annar/Citi, SMS/correo, histórico de signos vitales, medicamentos, pestañas por especialidad (~27 endpoints catalogados en `RUM_ENDPOINTS`, L22747-22783) | Cookies de sesión del médico; la URL base se **aprende observando** las llamadas de Everest (`apiObservar`) |
| Athenea `medicosviva1a.atheneasoluciones.com` | Auto-login institucional, resultados de laboratorio, PDF real del informe | Cuenta compartida, credenciales ofuscadas (`vgl_ath_creds`), token antifalsificación raspado |
| AppCita `appcita.viva1a.com.co:8051` | Turnos y agendamiento de toma de muestras, SMS de laboratorio | API anónima con candados anti-doble-escritura |
| SharePoint `viva1aips-my.sharepoint.com` | Base única PyM SEPTIEMBRE (XLSX ~22,5 MB, 06:00/12:00 Bogotá) | Enlace de compartir anónimo (`shareLink`), refresco de cookie cada ~25 min |
| Apps Script (tablero propio) | Telemetría anónima con acuse real `ok/dup/no/err`, cola con reintento | Token fijo `"vgl-2026"` en el fuente |
| Gist propio | Actualización del propio userscript (`@updateURL`) + verificación diaria | Público (secreto) |
| IA: DeepSeek / z.ai / Gemini | Redactor de casillas con escalera deepseek > z.ai > Gemini | Claves por médico, ofuscadas en GM |

### 1.2 Módulos funcionales existentes (resumen)

Panel Centinela con tarjetas por estado · dock de acciones · acceso directo a HC (M1) ·
pestañas de impresión desde el dock (M2) · módulo Ordenar con órdenes múltiples
CIE-10/CUPS y anti-duplicado triple (M3) · agendamiento exprés 1-clic con anulación real ·
toma de muestras (AppCita) · auto-labs Athenea con inyección en casillas y «Deshacer» ·
redactor IA con grounding (hoja de hechos + censor + sello de trazabilidad) · panel del
paciente (riesgo CV, función renal, hoja educativa imprimible) · lanzador asistido de HC
con chip de contexto y prefetch especulativo · memoria clínica local cifrada (AES-GCM) ·
telemetría anónima con kill-switch, deadman y bloqueo por versión mínima · toggles por
médico con UI solo para perfil completo · caché experimental de catálogos Everest.

### 1.3 Capacidades de infraestructura reutilizables (clave para las propuestas)

1. **Aprendizaje de API**: `apiObservar` aprende la URL base y cada endpoint observado
   queda catalogado en RUM sin cablear nada.
2. **Interceptores de red**: `mtrHcEnganchar` (XHR+fetch de la HC en vivo),
   `_perfCacheEst` (caché de catálogos), ambos con fail-open/fail-closed conscientes.
3. **Cifrado en reposo**: AES-GCM con WebCrypto ya en producción para la cosecha clínica.
4. **Barrera anti-identificables**: lista blanca de campos clínicos + revisión D1-D6
   antes de cualquier envío de IA — reutilizable para cualquier flujo nuevo.
5. **Compuerta de escritura por perfil**: `accesoEscribirUrl` corta POST según capacidad
   del médico — cualquier botón nuevo de escritura hereda la política si se registra.
6. **Telemetría anónima con acuse real**: cualquier métrica nueva es una clave nueva,
   no un flujo nuevo.
7. **Reloj de fondo con liderazgo entre pestañas**: cualquier «a las 17:30…» ya tiene
   dónde vivir sin timers duplicados.

---

## 2. Metodología de priorización

Cada propuesta se puntúa en tres ejes (alto/medio/bajo) y se clasifica:

- **P1 — Hacer ya** (bajo esfuerzo o alto valor, sin dependencias externas).
- **P2 — Hacer pronto** (requiere una captura en vivo del médico o una decisión).
- **P3 — Evaluar con evidencia** (valor real pero dependencia de datos o del dueño).
- **Aparcadas** (interesantes, no maduras).

Criterio rector: **casilla vacía antes que dato inventado** — ninguna propuesta se
implementa sin evidencia real del DOM/API; las que dependen de capturas en vivo lo dicen.

---

## 3. Propuestas priorizadas

### P1·A — Rotación del token del tablero y auditoría de Apps Script
**Seguridad · Esfuerzo bajo · Sin dependencias**

- **Descripción**: el token `"vgl-2026"` (fuente L12617) es fijo y público en el código.
  Rotarlo por médico (valor en Ajustes técnicos, ofuscado como las claves IA) y auditar
  `TABLERO/` para confirmar que ninguna hoja guarda PHI (los eventos ya se sanean en el
  cliente, pero el tablero recibe lo que el cliente manda — la verificación es de servidor).
- **Usuarios**: todos (defensa de la telemetría como canal de fuga si alguien clonara el script).
- **Viabilidad técnica**: alta. `_vglOfusca` + `mtrGuardarClave*` + un `GM_setValue`
  nuevo; el cambio es de lectura del token en `reportar` (L12617) y de regeneración en el
  tablero (Apps Script).
- **Endpoints**: ninguno nuevo — `script.google.com/macros/s/…/exec` sigue; cambia el
  token que viaja en el POST.
- **Cambios frontend/DOM**: un campo «Token del tablero» en Ajustes técnicos (patrón de
  los campos de clave IA, máscara incluida). Sin DOM de Everest.
- **Criterios de éxito**: (1) suite nueva aserta que el token del fuente no es el literal
  `vgl-2026` fijo sino leído de GM; (2) el tablero rechaza tokens viejos con `no`; (3)
  mutación verificada (token literal reintroducido → roja).

### P1·B — Respaldo exportable de la memoria clínica local (decisión D3 pendiente)
**Seguridad/continuidad · Esfuerzo medio · Pendiente explícito en el código (L5383)**

- **Descripción**: exportar a archivo la cosecha clínica cifrada (y su clave de equipo)
  para migración de equipo o respaldo ante fallo del navegador; importar con verificación
  de integridad. El comentario del código lo declara «todavía sin implementar».
- **Usuarios**: el médico (continuidad), administrador TI (migraciones).
- **Viabilidad técnica**: alta — AES-GCM (`VGLC1:` + sobre, L5165-5234) ya existe;
  exportar es serializar el sobre a un Blob y descargarlo; importar es leer el archivo,
  validar el sobre y sustituir el valor GM. Ninguna red involucrada.
- **Endpoints**: ninguno.
- **Cambios frontend/DOM**: dos botones en Ajustes técnicos («Exportar memoria» /
  «Importar memoria») con confirmación explícita y aviso de que el archivo está cifrado
  y solo sirve con la clave de equipo. Cero DOM de Everest.
- **Criterios de éxito**: (1) round-trip export→import en suite con contenido sintético
  (cero PHI) idéntico tras el ciclo; (2) un archivo alterado se rechaza sin corromper el
  estado actual; (3) mutación verificada.

### P1·C — Migración de claves de XOR a AES-GCM
**Seguridad · Esfuerzo medio**

- **Descripción**: las credenciales de Athenea y las claves IA viven en XOR+base64,
  declarado «no-cifrado» en el propio fuente (L2428-2443). La infraestructura AES-GCM
  con WebCrypto ya existe para la cosecha; migrar las claves a sobre `VGLC1:` con
  compatibilidad hacia atrás (leer viejo → regrabar cifrado).
- **Usuarios**: todos (el equipo de consultorio es compartido; hoy, cualquiera con
  acceso al perfil del navegador y al fuente puede revertir el XOR).
- **Viabilidad técnica**: media-alta. El patrón de degradación sin WebCrypto ya está
  documentado para la cosecha; se replica. Riesgo controlado: la migración se prueba
  con suite 70/99 intactas (los lectores de clave no cambian su API).
- **Endpoints**: ninguno.
- **Cambios frontend/DOM**: ninguno visible.
- **Criterios de éxito**: (1) `mtrLeerClave*` devuelve lo mismo tras migrar; (2) el
  almacén no contiene la clave reversible con solo mirar el valor; (3) banco completo
  verde incluyendo suites 70 y 99.

### P2·A — Captura del endpoint con que Everest CARGA la HC al abrir al paciente
**Habilitador transversal · Esfuerzo medio · Requiere UNA captura en vivo**

- **Descripción**: el módulo VGL-HC solo ve hoy lo que el médico toca durante la
  consulta; el endpoint de carga inicial de la HC «aún no está capturado» (L52241-52245).
  Capturarlo habilita: histórico completo sin depender de la navegación del médico,
  verificación de cierre, comparación con la consulta anterior y mejor grounding del
  panel del paciente y del redactor.
- **Usuarios**: el médico (menos clics para reponer contexto), el panel del paciente.
- **Viabilidad técnica**: alta una vez capturado — `apiObservar` ya aprende URLs y
  `mtrHcEnganchar` ya intercepta XHR+fetch de la HC; solo falta identificar el patrón
  real (probablemente un GET al abrir la pestaña HC) y registrarlo en `RUM_ENDPOINTS`
  con su etiqueta.
- **Requisito de evidencia**: el médico abre UNA historia clínica con las DevTools en
  la pestaña Red grabando (HAR), como en las capturas anteriores de Agendamiento/Ordenamiento.
- **Endpoints**: ninguno a modificar; se **observa** el existente.
- **Cambios frontend/DOM**: cero al inicio; después, el prefetch especulativo (v18.5.2)
  puede alimentarse del payload completo en vez de heurísticas de DOM.
- **Criterios de éxito**: (1) el patrón capturado queda en `RUM_ENDPOINTS` con prueba
  que lo fija; (2) una suite con un payload sintético de HC verifica que `mtrHcEnganchar`
  lo acepta y lo tacha; (3) cero llamadas nuevas de red propias (se observa, no se pide).

### P2·B — Checklist asistido de cierre de consulta (activar y blindar `checkCierre`)
**Eficiencia operativa · Esfuerzo medio**

- **Descripción**: `checkCierre` existe como toggle (defecto off, DEFAULTS L9638+).
  Propuesta: al detectar el gesto de cierre, verificar contra la agenda real
  (`ObtenerEstadoCita`, ya en RUM) que la cita quedó cerrada y, si no, ofrecer el
  checklist mínimo (diagnóstico escrito, conducta escrita, orden generada si aplica)
  leyendo las pestañas ya ancladas (VGL_PESTANAS). Nada se inventa: cada ítem se
  verifica contra el DOM real o el estado real de la API.
- **Usuarios**: el médico (cierre completo a la primera), administradores (menos citas
  reabiertas).
- **Viabilidad técnica**: alta — endpoints y selectores ya existen; es componer
  `obsConsultaCerrar` (telemetría ya presente) + `ObtenerEstadoCita` + lectores de casillas.
- **Endpoints**: ninguno nuevo (se usa `ObtenerEstadoCita` ya observado).
- **Cambios frontend/DOM**: un panel modal propio (`#vgl-cierre-panel`, patrón de
  `#vgl-postcita-panel` con la regla CSS de `!important` fuera de `#vgl-root`) que
  aparece tras el gesto de cierre y lista los ítems con marca real.
- **Criterios de éxito**: (1) suite que simula estados de cita y DOM de pestañas →
  checklist correcto en cada combinación; (2) cero avisos con la cita ya cerrada;
  (3) telemetría `cierre.checklist.{ok,falta,omitido}` sin texto; (4) mutación verificada.

### P2·C — Semáforo de citas del día sin cerrar (fin de jornada)
**Eficiencia operativa · Esfuerzo medio-bajo**

- **Descripción**: a una hora configurable (defecto 17:30), el panel resume las citas
  del día cuyo estado real (de la agenda ya pintada o de `ObtenerEstadoCita`) no es de
  atendida/cerrada, SIN abrir historias: solo nombres de estado y horas, cero PHI.
- **Usuarios**: el médico (cierre del día), administradores (menos citas olvidadas).
- **Viabilidad técnica**: alta — los estados ya se leen para las tarjetas del panel;
  es un filtro + un aviso con el sistema `notify` (1 aviso = 1 canal, ya en política).
- **Endpoints**: ninguno nuevo.
- **Cambios frontend/DOM**: una fila resumen en el panel Centinela al caer la tarde
  (o un aviso con la cuenta), sin ventanas nuevas.
- **Criterios de éxito**: (1) suite con estados sintéticos → el semáforo cuenta solo
  lo correcto; (2) el aviso no se repite (una vez por jornada, patrón `vgl_ia_feedback_dia`);
  (3) mutación verificada.

### P3·A — Activación del motor farmacológico portado (con pruebas)
**Seguridad clínica · Esfuerzo medio**

- **Descripción**: el motor portado (`MTR_REGLAS`, L41594: avisos de dosis por
  TFG/estadio, interacciones) ya existe pero **nace apagado** (L9703). Propuesta:
  blindarlo con suite propia + mutaciones y exponer el toggle en Ajustes técnicos para
  que el médico lo encienda cuando confíe en él en su práctica.
- **Usuarios**: el médico (segunda mirada farmacológica en consulta).
- **Viabilidad técnica**: alta — la lógica está; falta el collar de pruebas y la
  decisión de encendido, que es del médico.
- **Endpoints**: ninguno (usa los medicamentos ya cargados vía `CargarMedicamentosPaciente`).
- **Cambios frontend/DOM**: el toggle ya está; moverlo de la sección técnica a
  «Funcionalidades por médico» si el médico lo decide.
- **Criterios de éxito**: (1) suite de reglas sintéticas (dosis por TFG, interacción
  conocida) 100 % verde; (2) mutación en una regla → roja; (3) cero avisos cuando no
  hay medicamento cargado (fail-closed).

### P3·B — Reporte semanal agregado para el jefe de la IPS (sin PHI)
**Administradores · Esfuerzo medio · Requiere OK del dueño**

- **Descripción**: el tablero Apps Script ya recibe telemetría por evento. Agregar un
  resumen semanal por consultorio: pacientes vistos, órdenes generadas, envíos de SMS,
  uso del redactor (solo conteos, ninguna cifra clínica ni identidad). El dueño decide
  si lo quiere y quién lo ve.
- **Usuarios**: el propietario/administradores de la IPS.
- **Viabilidad técnica**: media-alta — es código en `TABLERO/` (Apps Script) + una hoja
  nueva; el cliente ya envía lo necesario. Requiere consentimiento explícito del dueño
  (la política actual es telemetría mínima de soporte, no de gestión).
- **Endpoints**: el mismo del tablero; se añade una consulta al Script.
- **Cambios frontend/DOM**: ninguno.
- **Criterios de éxito**: (1) el resumen se genera con datos sintéticos de una semana
  sin que ninguna celda contenga texto libre de paciente; (2) el dueño aprueba el
  alcance ANTES de encender; (3) kill-switch remoto sigue cortando todo el flujo.

### P3·C — Cierre de M4: impresión post-cierre con captura en vivo
**Eficiencia operativa · Esfuerzo medio · Requiere UNA captura en vivo**

- **Descripción**: lo que falta de M4 (acceso directo a la impresión de los documentos
  que Everest deja al cerrar la consulta) no tiene ancla: ninguna captura HAR/DOM cubre
  el flujo post-cierre. Paso concreto: una captura al cerrar UNA consulta real y anclar
  los accesos al DOM real, igual que M2 ancló `a#impDiagnostica`/`a#conducta`.
- **Usuarios**: el médico (menos clics al terminar).
- **Viabilidad técnica**: alta una vez capturado (patrón M2 probado: clic sintético
  sobre ancla real, fail-closed con aviso ámbar).
- **Endpoints**: ninguno nuevo.
- **Cambios frontend/DOM**: botones en el dock o en el panel post-cierre sobre las
  anclas reales capturadas.
- **Criterios de éxito**: (1) captura en vivo documentada; (2) suite con el DOM
  sintético equivalente; (3) mutación verificada del guard de presencia.

### Aparcadas (documentadas para no perderlas)

- **Prefetch del payload completo de la HC** al entrar en sala (depende de P2·A).
- **Resumen post-consulta automático** (borrador de cierre para el médico a partir de
  la consulta, con el redactor IA y la barrera existente) — depende de P2·A y de la
  decisión del médico sobre el alcance de la IA.
- **Detección proactiva de «no aparece nada»**: convertir el diagnóstico de compuerta
  (`vgl_compuerta_diagnostico`) en aviso automático cuando una médica sin identidad
  abre la agenda (incidente documentado L39387) — candidata a P1 si el médico la pide.
- **Filtro de la base única por `Fecha_Cita` máxima por documento** (auditoría H6):
  si en consultorio se ven chips resueltos, el siguiente paso es filtrar filas multi-día.

---

## 4. Riesgos transversales y dependencias

1. **Las capturas en vivo son del médico**: P2·A, P3·C y el respaldo de M4 dependen de
   10 minutos del médico con DevTools; sin ellas no se toca nada (regla de oro).
2. **Nada se escribe sin confirmación**: toda propuesta de escritura nueva debe pasar
   por `accesoEscribirUrl` (política por perfil ya vigente).
3. **Cero PHI en cada paso**: las pruebas usan datos sintéticos (DOC-1…); los criterios
   de éxito de las propuestas con red exigen que la barrera anti-identificables existente
   siga delante de cualquier envío.
4. **Rendimiento**: el banco mide la cascada de red por flujo (suite 94); ninguna
   propuesta debe añadir peticiones sin que la suite 94 lo registre.
