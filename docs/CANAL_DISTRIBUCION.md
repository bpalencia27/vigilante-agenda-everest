# Análisis de Riesgo del Canal de Distribución y Cadena de Suministro (R1.7)

**Fecha:** 2026-08-14  
**Hito:** M1 — Seguridad, Secretos, PHI y Cadena de Suministro  
**Componente:** Userscript Tampermonkey (`vigilante_agenda.user.js`)  
**Audiencia:** Operaciones de TI, Seguridad de la Información, Coordinación Médica.

---

## 1. Arquitectura Actual de Distribución

El userscript opera actualmente bajo un esquema híbrido de actualización:

```
┌────────────────────────────────────────────────────────────────┐
│                   GitHub Secret Gist (CDN)                     │
│  https://gist.githubusercontent.com/.../gistfile1.txt          │
└──────────────────────────────┬─────────────────────────────────┘
                               │
            Sondeo Periódico   │  Descarga Completa
              Tampermonkey     │  (Si @version remota > local)
                               ▼
┌────────────────────────────────────────────────────────────────┐
│             Navegador del Consultorio (Tampermonkey)           │
│                  vigilante_agenda.user.js                      │
└──────────────────────────────┬─────────────────────────────────┘
                               │
            Petición GET       │  Cada 5 minutos
        (checkVersionMinimum)  │  minVersion + killSwitch
                               ▼
┌────────────────────────────────────────────────────────────────┐
│            Google Apps Script Web App (VersionCheck)           │
│        Control de versión mínima y parada de emergencia        │
└────────────────────────────────────────────────────────────────┘
```

1. **Canal Estático (Tampermonkey):**
   - `@updateURL`: `https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt`
   - `@downloadURL`: `https://gist.githubusercontent.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91/raw/gistfile1.txt`
   - Tampermonkey consulta la cabecera en segundo plano. Si el valor de `@version` en el Gist es superior al instalado localmente, descarga el script completo y lo reemplaza.
   - **Segundo archivo del mismo Gist (v18.0.4):** `VGL_UPDATE_GIST_URL` apunta a `.../raw/gistfile2.txt` — es el canal del aviso proactivo "⬆ Actualización vN disponible" (estilo Windows Update) que el propio script consulta 1 vez al día (`mtrCheckActualizacionGist`). **Ambos archivos deben actualizarse SIEMPRE con el mismo contenido** en cada publicación.
2. **Canal Dinámico (Google Apps Script):**
   - `versionCheckUrl`: `https://script.google.com/macros/s/AKfycbwXwwQdSGGMyt4X6Wf5YbJVRZjB_z_cYEVVpRoebO_VrobIhtHKD3nAJs689kq3R7tC/exec`
   - Se ejecuta cada 5 minutos (`checkVersionMinimum`). Si la versión instalada es inferior a `minVersion` y no hay una consulta médica activa (`seccionActiva() !== "historia"`), fuerza una recarga controlada del navegador.

---

## 2. Matriz de Amenazas y Análisis de Riesgo

| Vector de Ataque / Fallo | Mecanismo de Explotación | Impacto Clínico y Operativo | Severidad | Mitigación Implementada / Propuesta |
|---|---|---|---|---|
| **Compromiso de Cuenta GitHub / Gist** | Un atacante obtiene credenciales de la cuenta `bpalencia27` y modifica el contenido del Gist con un payload malicioso. | Inyección de código malicioso en todos los consultorios. Exfiltración masiva de historias clínicas y órdenes falsas. | **CRÍTICA** | 1. Habilitación obligatoria de 2FA / llaves FIDO2 en la cuenta GitHub.<br>2. Transición a GitHub Releases con etiquetas firmadas por GPG.<br>3. Autocomprobación de integridad SHA-256 en arranque (`verificarIntegridadArranque`). |
| **Envenenamiento de Caché CDN / Split-Brain** | Los servidores edge de Fastly/GitHub CDN mantienen en caché versiones previas del Gist de forma heterogénea durante ~5-15 min. | Consultorios de la misma sede ejecutando versiones distintas simultáneamente (reglas de laboratorio desalineadas). | **MEDIA** | Forzar encabezados de expiración mediante URLs asociadas a commits inmutables o tags de Release (`/releases/download/v14.1.5/...`). |
| **Imposibilidad de Downgrade Automático (Rollback Lag)** | Tampermonkey solo actualiza si `@version` es estrictamente mayor. Si se detecta un bug crítico y se restaura el Gist al commit anterior, Tampermonkey ignora la actualización. | Los equipos quedan atascados en la versión defectuosa hasta que el usuario actualice manualmente. | **ALTA** | Procedimiento de Rollback de Emergencia (R5.4): Publicar de inmediato un parche de versión superior (ej. `14.1.6`) cuyo contenido sea el código estable anterior (`14.1.4`). |
| **Agotamiento de Cuota de Google Apps Script** | Una ráfaga de peticiones simultáneas desde múltiples consultorios puede superar las cuotas diarias de ejecución de Google Apps Script. | El chequeo de versión mínima no responde. El script opera en modo *fail-open* (no bloquea al médico). | **BAJA** | Implementación de jitter aleatorio (±30s) en el intervalo de sondeo y delegación del chequeo exclusivamente a la pestaña líder (`leader`). |

---

## 3. Plan de Transición: De Gist a GitHub Releases Oficiales

Para eliminar la dependencia de un Gist editable sin historial firmado:

### Fase 1: Versionado Inmutable con GitHub Releases
1. Los artefactos de producción se publicarán como archivos adjuntos a GitHub Releases oficiales (ej. `https://github.com/bpalencia27/vigilante-agenda-everest/releases/download/v14.1.5/vigilante_agenda.user.js`).
2. Cada release estará respaldado por un tag de Git firmado criptográficamente.
3. El hash SHA-256 del archivo se publicará de manera inmutable en `docs/PUBLICACIONES.md`.

### Fase 2: Actualización de Directivas de Cabecera
Actualizar las directivas del userscript para apuntar al repositorio oficial:
```javascript
// @updateURL    https://github.com/bpalencia27/vigilante-agenda-everest/releases/latest/download/vigilante_agenda.user.js
// @downloadURL  https://github.com/bpalencia27/vigilante-agenda-everest/releases/latest/download/vigilante_agenda.user.js
```

---

## 4. Protocolo de Congelamiento y Rollback de Emergencia

En caso de detectarse un defecto crítico en producción:

1. **Activación de Kill-Switch Remoto:**
   - En el panel de control de Google Apps Script (`TABLERO/VersionCheck.gs`), establecer `killSwitch: true`.
   - Todas las estaciones conectadas recibirán la orden en menos de 5 minutos y suspenderán la ejecución de automatizaciones de agenda y laboratorios de forma segura.
2. **Rollback de Código por Versión Superior (Forward-Rollback):**
   - No intentar bajar el número de `@version` en el canal de distribución.
   - Tomar el archivo estable verificado (ej. `v14.1.4`).
   - Incrementar su cabecera al siguiente parche disponible (ej. `v14.1.6`).
   - Desplegarlo inmediatamente en el canal de distribución para que Tampermonkey lo adopte en todas las estaciones.
