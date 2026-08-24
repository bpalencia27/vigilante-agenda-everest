# Registro Oficial de Publicaciones y Procedencia de Releases (R1.9)

**Propósito:** Garantizar la trazabilidad criptográfica y procedencia inmutable de cada versión distribuida del Vigilante de Agenda (`vigilante_agenda.user.js`), vinculando de forma unívoca el commit de Git con el artefacto distribuido a los consultorios.

---

## 1. Registro Histórico de Releases y Procedencia

| Versión | Fecha (UTC) | Commit Git (`HEAD`) | SHA-256 (`vigilante_agenda.user.js`) | Líneas | Tamaño (Bytes) | Responsable | Estado |
|---|---|---|---|---|---|---|---|
| `17.6.10` | 2026-08-23T00:00:00Z | `[PENDIENTE-CI-MERGE]` | `BD3D1A2D8C202E41A9345D2E0FE7927BD306602DEB5DAB66A2702FA06A12DD4D` | 33788 | 2102159 | TraeDesign | `CANDIDATE` |
| `17.6.9` | 2026-08-23T00:00:00Z | `[PENDIENTE-CI-MERGE]` | `6B349C4FA4B9A9AD5C607639B653E19EA990022A321EEF5C75D4C34ACFBAC53A` | 33913 | 2108564 | TraeDesign | `CANDIDATE` |
| `17.6.8` | 2026-08-23T00:00:00Z | `[PENDIENTE-CI-MERGE]` | `B247205E7B671CECFF4BF45CB7E5B85C5C8CA5417BE8CF9DC68207211612114F` | 33877 | 2106536 | TraeDesign | `CANDIDATE` |
| `17.6.7` | 2026-08-23T00:00:00Z | `[PENDIENTE-CI-MERGE]` | `0ED488E17E98E78A6E3565D1AF4EF5A68403465FF4DB7BB7F593D280A352A34A` | 33789 | 2100070 | TraeDesign | `CANDIDATE` |
| `17.6.6` | 2026-08-23T00:00:00Z | `[PENDIENTE-CI-MERGE]` | `4357C901C39518E0F5EF216F0EEA001FF6F757F7ACAB87E9CC4C385F6A88F325` | 33607 | 2087241 | TraeDesign | `CANDIDATE` |
| `17.6.5` | 2026-08-23T00:00:00Z | `[PENDIENTE-CI-MERGE]` | `23E7E8D2FECBF8316618D0BA80C83E54A9BDC771756539F4F34B465F025D6B78` | 33533 | 2081321 | TraeDesign | `CANDIDATE` |
| `17.6.4` | 2026-08-23T00:00:00Z | `[PENDIENTE-CI-MERGE]` | `E4A47C61D8908C94762B8D3AA0EC664DDD3EF0AAAE5D021972E32400F599B7E6` | 33431 | 2074270 | TraeDesign | `CANDIDATE` |
| `17.6.3` | 2026-08-23T00:00:00Z | `[PENDIENTE-CI-MERGE]` | `B75E57D364EB0FA7735DAA8BC7D5CE63D524A893CF20435E599E7C8DC423B4A2` | 33430 | 2107378 | TraeDesign | `CANDIDATE` |
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
