# Canal de Distribución, Canario y Ventana de Publicación

> **Documento Operativo de Despliegue Seguro (G2).**  
> **Destinatarios:** Equipo de ingeniería, auditor de seguridad y médico líder del piloto.  
> **Objetivo:** Establecer un flujo de despliegue controlado que impida la propagación masiva de errores en consultas en vivo.

---

## 1. El Desafío de la Distribución en Tampermonkey

Tampermonkey no cuenta con un sistema nativo de despliegue porcentual o escalonado (*canary release* tipo 10% → 50% → 100%). Cuando se publica un nuevo archivo en el `@updateURL`, la extensión descarga la versión para **todos los puestos que apunten a esa URL** en su siguiente ciclo de sincronización.

---

## 2. Arquitectura de Despliegue en Dos Canales (Gist Dual)

Para habilitar un entorno de pruebas en condiciones reales sin arriesgar la operación de toda la IPS, se implementa una arquitectura basada en **dos Gists independientes**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FLUJO DE PROMOCIÓN                               │
│                                                                             │
│   [Rama de Desarrollo]                                                      │
│            │                                                                │
│            ▼ (Commit verificado y suites en verde)                          │
│   [CANAL CANARIO] (Gist A: @updateURL_canario)                              │
│            │                                                                │
│            ├─► Instalado en: 2 Puestos Piloto (Consultorio 1 y 2)           │
│            │   Duración: Mínimo 1 Jornada Completa (8 horas de consulta)    │
│            │   Monitoreo: 0 excepciones, 0 objeciones clínicas              │
│            ▼                                                                │
│   [CANAL ESTABLE] (Gist B: @updateURL_estable)                              │
│            │                                                                │
│            └─► Instalado en: 18 Puestos Restantes de la IPS                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Configuración de Metadatos de Cabecera

#### Canal Canario (`vigilante_agenda_canary.user.js`):
```javascript
// ==UserScript==
// @name         Vigilante de Agenda Everest (Canario)
// @namespace    https://github.com/bpalencia27/vigilante-agenda-everest
// @version      14.2.0-canary.1
// @updateURL    https://gist.githubusercontent.com/.../raw/vigilante_agenda_canary.user.js
// @downloadURL  https://gist.githubusercontent.com/.../raw/vigilante_agenda_canary.user.js
// ==/UserScript==
```

#### Canal Estable (`vigilante_agenda.user.js`):
```javascript
// ==UserScript==
// @name         Vigilante de Agenda Everest
// @namespace    https://github.com/bpalencia27/vigilante-agenda-everest
// @version      14.2.0
// @updateURL    https://gist.githubusercontent.com/.../raw/vigilante_agenda.user.js
// @downloadURL  https://gist.githubusercontent.com/.../raw/vigilante_agenda.user.js
// ==/UserScript==
```

---

## 3. Protocolo de Validación en Canario y Señales de Promoción

La promoción de una versión desde el canal Canario hacia el canal Estable **requiere la satisfacción estricta de una lista de verificación positiva** (no basta con *"no escuchar quejas"*):

### Lista de Chequeo Obligatoria para Promoción
1. [ ] **Tiempo Mínimo en Producción Real:** Al menos **1 día hábil completo** (mínimo 15 consultas reales atendidas en el puesto canario).
2. [ ] **Cero Incidentes de Integridad:** Ningún reporte de valores de laboratorio cruzados, casillas de fecha vacías o nombres desalineados.
3. [ ] **Telemetría Limpia:** Cero excepciones no capturadas reportadas en la consola de telemetría de Google Apps Script.
4. [ ] **Comprobación de Rendimiento:** Sin quejas de congelamiento de pantalla en equipos con procesador Celeron/Core i3.
5. [ ] **Validación Explícita del Médico Piloto:** Conformidad verbal o escrita del médico evaluador.

---

## 4. Ventana Horaria de Publicación

Está **estrictamente prohibido** publicar actualizaciones en el canal Estable durante los siguientes horarios de alta afluencia clínica:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VENTANAS HORARIAS DE PUBLICACIÓN                         │
│                                                                             │
│  06:00 - 12:30  ───►  🔴 PROHIBIDO (Consulta Matutina Activa)               │
│  12:30 - 13:30  ───►  🟡 VENTANA CANARIO (Pausa de almuerzo / Puestos piloto)│
│  13:30 - 18:30  ───►  🔴 PROHIBIDO (Consulta Vespertina Activa)             │
│  18:30 - 21:00  ───►  🟢 VENTANA ESTABLE (Cierre de jornada / Despliegue IPS)│
│  Viernes tarde  ───►  🔴 PROHIBIDO (No desplegar antes de fin de semana)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Análisis de Riesgos y Seguridad del Canal Gist

### 5.1. Vectores de Amenaza y Mitigaciones
1. **Compromiso de Cuenta de GitHub:**
   - *Riesgo:* Un atacante con acceso a la cuenta que aloja el Gist podría distribuir código malicioso que se ejecutaría con privilegios en las sesiones de Everest de todos los médicos.
   - *Mitigación:* Autenticación Multifactor (2FA) obligatoria mediante llave física (FIDO2/WebAuthn) o app autenticadora en la cuenta de GitHub; Gists gestionados bajo una Organización con permisos de escritura restringidos y firma de commits obligatoria.
2. **Caída o Bloqueo del Dominio `gist.githubusercontent.com`:**
   - *Riesgo:* El proxy corporativo de la IPS o una caída de GitHub bloquea la URL de actualización.
   - *Impacto:* Cero caída operativa. Tampermonkey conserva la versión localmente en el navegador del médico y continúa ejecutándola con total normalidad.
3. **Inyección de Scripts No Autorizados:**
   - *Mitigación:* Cabecera `@connect` estrictamente acotada a los 3 orígenes requeridos (`everestintelligent.com`, `medicosviva1a.atheneasoluciones.com`, `script.google.com`). Cualquier intento de exfiltración a dominios externos es bloqueado por el sandbox de Tampermonkey.
