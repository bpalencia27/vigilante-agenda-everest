# Documentación y Gobierno de Telemetría — Vigilante de Agenda (R1.8)

**Fecha:** 2026-08-14  
**Hito:** M1 — Seguridad, Secretos, PHI y Cadena de Suministro  
**Componente:** Módulo de Reporte y Telemetría de Flota  
**Cumplimiento Legal:** Ley Estatutaria 1581 de 2012 (Habeas Data), Decreto 1377 de 2013, Resolución 1995 de 1999 (Confidencialidad de la Historia Clínica en Colombia).

---

## 1. Propósito y Filosofía de Privacidad

El Vigilante de Agenda asiste al médico durante la consulta en tiempo real dentro del EHR ("Everest" / Athenea). Para garantizar la máxima protección de los datos de salud de los pacientes:

1. **Cero PHI (Protected Health Information):** Ningún dato identificador del paciente (cédula, nombres, apellidos, dirección, teléfono, diagnóstico clínico específico o resultados numéricos de laboratorio) se transmite jamás a ningún servidor de telemetría externo.
2. **Desactivado de Fábrica (Default-Off):** Toda transmisión remota está **apagada por defecto** (`DEFAULTS.reporte = false`, `DEFAULTS.uxTelemetria = false`). El script no emite ningún paquete de red hacia Google Apps Script salvo que el usuario o la coordinación médica lo activen voluntariamente en el panel de Ajustes.
3. **Agregación en Origen:** Los contadores de acciones y tiempos se acumulan localmente en la memoria del navegador (`localStorage`) y solo se envían como totales agregados cada 30 minutos por la pestaña líder.
4. **Filtrado Riguroso de Errores:** Las excepciones no controladas pasan por un pipeline de saneamiento (`_sanearMensajeError`) que purga números largos (cédulas), URLs y cadenas con formato antes de generar cualquier reporte de depuración.

---

## 2. Arquitectura de Endpoints Externos

| Endpoint | Propósito | Protocolo / Método | Autenticación | Frecuencia Máxima |
|---|---|---|---|---|
| `https://script.google.com/macros/s/AKfycbwaSyv2nWxoeGKW1v6EpSKnnDgVv-cYKVNFe6j9VbNK1wOI3VOD0zIBHyXMgCT3zNBl/exec` | Tablero de Flota (Métricas Agregadas) | HTTP POST (`Content-Type: text/plain;charset=utf-8`) | Token estático `"vgl-2026"` | 1/día (Resumen, Entorno), cada 30 min (UX), en vivo con tope de 20/día (Fraude) y 5/día (Error) |
| `https://script.google.com/macros/s/AKfycbwXwwQdSGGMyt4X6Wf5YbJVRZjB_z_cYEVVpRoebO_VrobIhtHKD3nAJs689kq3R7tC/exec` | Chequeo de Versión Mínima & Kill-Switch Remoto | HTTP GET | Pública (solo lectura) | 1 consulta cada 5 minutos (solo pestaña líder) |

---

## 3. Tipos de Eventos y Esquema de Payloads

Todos los paquetes de telemetría enviados al Tablero comparten la estructura base:

```json
{
  "token": "vgl-2026",
  "equipo": "eq-3j8k2a",
  "ver": "14.1.5",
  "evento": "<tipo_evento>",
  "ts": "2026-08-14T21:44:00.000Z",
  "dia": "2026-08-14",
  "lote": "eq-3j8k2a-ks7z9-1"
}
```

### 3.1 Evento `resumen`
- **Frecuencia:** 1 vez al día por equipo al iniciar jornada (con candado en `localStorage`).
- **Payload:**
  ```json
  {
    "deDia": "2026-08-13",
    "fraude": 0,
    "inasistencia": 2,
    "atiempo": 18,
    "ultima": 1
  }
  ```
- **Uso:** Indicadores consolidados de puntualidad general de la jornada anterior.

### 3.2 Evento `fraude`
- **Frecuencia:** En vivo cuando un turno que estuvo en lista de espera sin presentarse (`fraudWatch`) es confirmado extemporáneamente (tope de 20 eventos al día).
- **Payload:**
  ```json
  {
    "hora": "08:20",
    "min": 15.5
  }
  ```
- **Gobernanza:** No contiene nombre, cédula ni identificador de la cita.

### 3.3 Evento `entorno`
- **Frecuencia:** 1 vez al día por equipo.
- **Payload:**
  ```json
  {
    "nav": "Chrome",
    "so": "Windows 10/11",
    "zona": "America/Bogota",
    "pantalla": "1920x1080",
    "gestor": "Tampermonkey"
  }
  ```
- **Uso:** Compatibilidad de navegadores y resolución en consultorios.

### 3.4 Evento `error`
- **Frecuencia:** En vivo al ocurrir una excepción en el código del script (máximo 5 errores con detalle al día por equipo).
- **Payload:**
  ```json
  {
    "origen": "js",
    "msg": "TypeError: Cannot read properties of undefined",
    "donde": "vigilante_agenda.user.js:1240",
    "migas": "panel.abrir>filtro.pym>cita.clic"
  }
  ```
- **Saneamiento:** `_sanearMensajeError` reemplaza URLs con `<url>`, purga secuencias de más de 6 dígitos consecutivos y recorta a 180 caracteres.

### 3.5 Evento `ux`
- **Frecuencia:** Cada 30 minutos (despachado únicamente por la pestaña líder).
- **Payload:**
  ```json
  {
    "deDia": "2026-08-14",
    "desde": "2026-08-14T21:00:00.000Z",
    "n": 42,
    "acciones": "{\"ajustes.abrir\":2,\"filtro.todos\":15,\"agendar.modal\":3,\"api.obtenerconsultas.ok\":14}"
  }
  ```
- **Gobernanza:** Claves alfanuméricas predefinidas en minúsculas; cero texto libre del DOM.

---

## 4. Gobernanza y Controles de Configuración

| Parámetro | Clave en `vgl_cfg` | Valor Predeterminado | Descripción |
|---|---|---|---|
| **Reporte Consolidado** | `reporte` | `false` (Default-Off) | Interruptor maestro de red. En `false`, la guarda `repOn()` bloquea el 100% de peticiones salientes. |
| **Métricas de Uso** | `uxTelemetria` | `false` (Default-Off) | Habilita o inhabilita la recolección local de métricas de clics UX. |
| **Identificador de Equipo** | `equipo` | `""` (vacío) | Etiqueta manual de la estación (ej. "Consultorio 3"). Si no se define, se genera un ID anónimo volátil `eq-xxxx`. |
| **URL Alternativa de Tablero** | `reporteUrl` | `""` (vacío) | Permite redirigir los reportes a un Google Apps Script propio de la IPS. |

### Procedimiento para Activar o Desactivar Telemetría
1. Abrir la interfaz de Everest en el navegador.
2. En el panel lateral del Vigilante de Agenda, pulsar el botón **⚙ Ajustes**.
3. Marcar la casilla **Mostrar opciones técnicas**.
4. Modificar según la política del consultorio las casillas:
   - **Reporte de atención consolidado**
   - **Métricas de uso del panel**
5. Los cambios se persisten inmediatamente en el almacenamiento local y se aplican sin necesidad de reiniciar la sesión médica.
