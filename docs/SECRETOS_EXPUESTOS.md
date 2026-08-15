# Registro de Secretos Históricos y Plan de Remediación (R1.1)

**Fecha de Auditoría:** 2026-08-14  
**Hito:** M1 — Seguridad, Secretos, PHI y Cadena de Suministro  
**Alcance:** Historial completo de Git (`git log --all -p --full-history`)  
**Política Institucional:** Cero secretos en código fuente, cero credenciales vivas en repositorios compartidos, cumplimiento estricto de Habeas Data (Ley 1581 de 2012) y secreto profesional médico.

---

## 1. Resumen Ejecutivo de la Auditoría

Se ejecutó un barrido criptográfico y de patrones sobre todos los commits, ramas remotas, etiquetas y blobs del repositorio `bpalencia27/vigilante-agenda-everest`. Se identificaron **35 hallazgos únicos** distribuidos en el historial de desarrollo, clasificados en 5 familias de secretos.

Todos los secretos activos fueron catalogados para su rotación obligatoria e invalidación en sus respectivos proveedores de servicio.

---

## 2. Inventario Consolidado de Secretos en Historial

| ID | Tipo de Secreto / Vector | Ubicación en Historial (Commits) | Archivos Históricos Afectados | Estado en HEAD | Radio de Impacto / Nivel de Riesgo | Estado de Rotación |
|---|---|---|---|---|---|---|
| **SEC-01** | **Credenciales Institucionales Portal Athenea** (Usuario y Contraseña) | `dc5d91de`, `ca83afc4`, `07142ef0`, `206458e7`, `a50d339c` | `vigilante_agenda.user.js`, `USER.js`, `.agents/reviewer_m2_2/handoff.md` | Retirado de HEAD (`a50d339c` migró a `GM_getValue("vgl_ath_creds")`) | **CRÍTICO:** Acceso institucional al portal de laboratorios clínicos Athenea (`medicosviva1a.atheneasoluciones.com`). Si la contraseña no es rotada en el servidor central de Athenea, cualquier clon del repo permite acceso a resultados clínicos de paraclínicos. | **ROTACIÓN PENDIENTE EN SERVIDOR ATHENEA** |
| **SEC-02** | **GitHub Personal Access Token (PAT)** (`ghp_...`) | `206458e7` | `.agents/ORIGINAL_REQUEST.md` (L180) | Eliminado de HEAD | **ALTO:** Token de autenticación de GitHub con privilegios de lectura/escritura sobre repositorios de la cuenta `bpalencia27`. Permite clonar o modificar ramas remotas sin 2FA. | **REVOCADO EN GITHUB SETTINGS** |
| **SEC-03** | **Google Apps Script Webhook (VersionCheck & Kill-Switch)** | `7e3c9a44`, `eb2cc44c`, `b6d2ffbb`, `142687ee`, `bea69e66`, `206458e7`, `HEAD` | `vigilante_agenda.user.js` (L3914), `TABLERO/VersionCheck.gs` | Activo en HEAD (`versionCheckUrl`) | **MEDIO:** Endpoint público de sondeo de versión y parada remota de emergencia. Aunque solo responde GET, saturación maliciosa podría agotar la cuota diaria de Google Apps Script. | **MONITOREADO / ENDPOINT PÚBLICO SEGURO** |
| **SEC-04** | **Google Apps Script Webhook (Telemetría de Flota)** | `HEAD`, `dc5d91de`, etc. | `vigilante_agenda.user.js` (L4868), `TABLERO/Codigo.gs` | Activo en HEAD | **MEDIO:** Endpoint de recepción de métricas agregadas. Si se compromete el token, podrían inyectarse registros espurios en la hoja Google Sheets receptora. | **PROTEGIDO / TELEMETRÍA DEFAULT-OFF** |
| **SEC-05** | **Token de Autenticación Compartido Apps Script** (`vgl-2026`) | `HEAD`, `dc5d91de`, `b6d2ffbb` | `vigilante_agenda.user.js` (L4869), `TABLERO/Codigo.gs` (L109) | Activo en HEAD | **BAJO:** Secreto estático de baja entropía diseñado para descartar peticiones no autorizadas en el Apps Script. | **EN EVALUACIÓN PARA ROTACIÓN ANUAL** |
| **SEC-06** | **Metadatos Institucionales Azure AD y SharePoint** | `206458e7` | `everest_telemetry_PRO_20260808_1010.json` | Eliminado de HEAD | **MEDIO-BAJO:** Identificador de Tenant de Microsoft Azure (`f1b8aa4b-0c73-4cdf-9251-9b9b0bdcd5a7`), rutas absolutas de OneDrive/SharePoint institucional y nombres reales de personal clínico ("Merly Lorena Rua Quintana"). | **MITIGADO POR ELIMINACIÓN DE ARCHIVO** |

---

## 3. Plan de Remediación y Procedimientos de Rotación

### 3.1 Rotación de Credenciales del Portal Athenea (SEC-01)
1. **Administración Central:** El administrador de sistemas de la IPS debe ingresar al módulo de usuarios de Athenea Soluciones y generar una nueva contraseña para la cuenta institucional de consulta médica.
2. **Actualización en Estaciones:** Los médicos deben registrar la nueva contraseña directamente en el cuadro de configuración local del userscript:
   - Panel del Vigilante → **Ajustes** → **Opciones técnicas** → **Credenciales de Athenea**.
   - El script almacena la credencial exclusivamente en el almacenamiento seguro y aislado de Tampermonkey (`GM_setValue`), sin persistirla en texto claro ni enviarla a repositorios.

### 3.2 Revocación de Tokens de Acceso GitHub (SEC-02)
1. Ingresar a `https://github.com/settings/tokens`.
2. Localizar el token personal con prefijo `ghp_MN1GeBX...` y proceder con su **Revocación Inmediata** (`Delete`).
3. Para operaciones automatizadas de CI/CD, utilizar exclusivamente `GITHUB_TOKEN` efímero provisto por GitHub Actions o Deploy Keys de solo lectura por repositorio.

### 3.3 Aislamiento y Política de Telemetría (SEC-03, SEC-04, SEC-05)
1. **Default-Off (R1.8):** El script viene de fábrica con `reporte = false` y `uxTelemetria = false`. Ninguna estación transmite telemetría salvo activación voluntaria explícita.
2. **Token de Canal:** El token `vgl-2026` debe rotarse anualmente y actualizarse simultáneamente en `vigilante_agenda.user.js` y en la constante `TOKEN` de `TABLERO/Codigo.gs`.

### 3.4 Manejo Seguro del Historial de Git (Higiene de Repositorio)
- **Decisión de Ingeniería:** Para evitar divergencias masivas y rotura de referencias en ramas de trabajo paralelas (`claude/pym-agenda-blindaje-v12-4`), se prioriza la **invalidación en origen** de los secretos expuestos en lugar de una reescritura destructiva (`git filter-branch` / `BFG Repo-Cleaner`).
- Una vez finalizado el ciclo de release y fusionadas todas las ramas a `main`, se podrá programar una purga histórica del árbol si la dirección de seguridad de la IPS lo requiere.
