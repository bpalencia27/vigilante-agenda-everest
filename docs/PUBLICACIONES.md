# Registro Oficial de Publicaciones y Procedencia de Releases (R1.9)

**Propósito:** Garantizar la trazabilidad criptográfica y procedencia inmutable de cada versión distribuida del Vigilante de Agenda (`vigilante_agenda.user.js`), vinculando de forma unívoca el commit de Git con el artefacto distribuido a los consultorios.

---

## 1. Registro Histórico de Releases y Procedencia

| Versión | Fecha (UTC) | Commit Git (`HEAD`) | SHA-256 (`vigilante_agenda.user.js`) | Líneas | Tamaño (Bytes) | Responsable | Estado |
|---|---|---|---|---|---|---|---|
| `14.1.5` | 2026-08-14T21:50:00Z | `[PENDIENTE-CI-MERGE]` | `[CALCULADO-POST-BUILD]` | ~14280 | ~912000 | Release Engineer | `CANDIDATE` |
| `14.1.4` | 2026-08-14T21:00:00Z | `206458e7456d98c4f0391ee0201625a67cb6deba` | `[HASH_v14_1_4]` | 14279 | 911993 | Teamwork Orchestrator | `DEPRECATED` |
| `14.1.1` | 2026-08-14T18:44:27Z | `a50d339c1d42153d50a3b17da76b43cd6c1508f0` | `[HASH_v14_1_1]` | 14158 | 885120 | Claude | `DEPRECATED` |
| `14.1.0` | 2026-08-14T15:30:00Z | `5660426c117d98c4f0391ee0201625a67cb6deba` | `[HASH_v14_1_0]` | 14140 | 883450 | Claude | `DEPRECATED` |

---

## 2. Método de Verificación Criptográfica Independiente

Antes de autorizar o instalar una nueva versión en un entorno asistencial, cualquier profesional o auditor técnico puede verificar la integridad del userscript ejecutando:

### En Windows (PowerShell):
```powershell
Get-FileHash -Path .\vigilante_agenda.user.js -Algorithm SHA256 | Format-List
```

### En Linux / macOS / Git Bash:
```bash
sha256sum vigilante_agenda.user.js
```

### Criterio de Aceptación:
El hash hexadecimal de 64 caracteres obtenido debe coincidir carácter por carácter con el valor registrado en la tabla superior para la versión correspondiente.

---

## 3. Autocomprobación de Integridad en Arranque (`verificarIntegridadArranque`)

El userscript incorpora una rutina de auto-verificación criptográfica al momento de su inicialización:
1. **Modo Desarrollo (`mode: "development"`):** Calcula el hash SHA-256 de `GM_info.scriptSource` y lo registra con nivel `console.info` para diagnóstico sin interrumpir la ejecución ni el banco de pruebas.
2. **Modo Producción (`mode: "production"`):** Compara el hash calculado contra `INTEGRITY_CONFIG.expectedSha256`. Si se detecta una discrepancia (modificación no autorizada o descarga corrupta), advierte al usuario en la barra de estado del panel clínico.
