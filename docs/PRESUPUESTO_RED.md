# Presupuesto Global de Red, Cortacircuitos y Modo Degradado (R3.9 / R3.4)

**Versión:** 1.0.0 (RC v14.1.6)  
**Fecha:** 2026-08-14  
**Hito:** M3 — Robustez, Concurrencia, Estado y Red  
**Alcance:** Userscript `vigilante_agenda.user.js` y Canales de Red (Everest, Athenea, SharePoint, Google Apps Script, Gist)  
**Cumplimiento Normativo y Clínico:** Integridad de Historias Clínicas, Prevención de Doble Escritura, Estabilidad de Red en IPS.

---

## 1. Declaración de Principios y Objetivos

El **Vigilante de Agenda** coexiste con el tráfico nativo del EHR Everest y el portal Athenea en consultorios médicos con conexiones de red corporativas (IPSec, VPN o enlaces de ancho de banda compartido). Un exceso de tráfico o reintentos no coordinados pueden:
1. Saturar la conexión de la sede médica ("thundering herd").
2. Bloquear la cuenta compartida de Athenea por intentos reiterados de login erróneo.
3. Duplicar citas o crear órdenes médicas redundantes ante caídas de red o demoras en el servidor.
4. Congelar la interfaz del usuario durante bloqueos sincrónicos de red.

Por tanto, el script establece un **Presupuesto Global de Red**, una **Máquina de Estados de Cortacircuitos (Circuit Breaker)** y una política estricta de **0 reintentos automáticos en escrituras clínicas**.

---

## 2. Presupuesto Global e Inventario de Endpoints

### 2.1 Presupuesto de Ancho de Banda
- **Estado estacionario en segundo plano:** $< 100\text{ KB/min}$ por estación de trabajo.
- **Pico transitorio de arranque / sincronización diaria:** $< 1.5\text{ MB}$ (descarga única diaria de archivo PyM Excel comprimido).

### 2.2 Inventario de Endpoints y Matriz de Tráfico

| Endpoint / Canal | Método | Frecuencia Máxima | Timeout | Concurrencia | Política de Reintento | Fallback / Modo Degradado |
|---|---|---|---|---|---|---|
| **Everest `/ObtenerConsultas`** | `GET` | 4 peticiones / min | 9.000 ms | 1 en vuelo | Backoff con jitter (1s, 2s, 4s). Max 3 fallos $\rightarrow$ `OPEN` | Scraping directo desde DOM de "Citas del día" |
| **Everest `GetValidacionExamenCronicos`** | `GET` | 1 por apertura de paciente | 8.000 ms | 1 en vuelo | 0 reintentos automáticos | Matriz estática `WHITELIST_13_LABS` |
| **Everest `ObtenerPaqueteProgramasCups`** | `GET` | 1 por apertura Conducta PyM | 8.000 ms | 1 en vuelo | 0 reintentos automáticos | Catálogo local de CUPS verificados |
| **Everest `GuardarOrdenamiento`** | `POST` | 1 por clic del médico | 15.000 ms | 1 (Lock estricto) | **0 REINTENTOS** (Idempotencia clínica) | Notificación de fallo para orden manual |
| **Everest `AsignarTurno`** | `POST` | 1 por clic del médico | 15.000 ms | 1 (Lock estricto) | **0 REINTENTOS** (Idempotencia clínica) | Notificación de fallo para asignación manual |
| **Athenea `/Account/Login`** | `POST` | 1 intento tras caída de sesión | 15.000 ms | 1 en vuelo | 1 intento; si 401/403 $\rightarrow$ Bloqueo inmediato | Bloqueo de auto-login (`atheneaLoginBloqueado = true`) |
| **Athenea `/Resultados/BusquedaPaciente`** | `GET` | 1 cada 3 min (Keep-alive) | 15.000 ms | 1 en vuelo | 0 reintentos agresivos | Consulta bajo demanda en apertura |
| **Athenea `/Resultados/DescargarResultado`** | `GET` | 2 concurrentes máx | 30.000 ms | 2 en vuelo | Max 1 reintento con año previo | Falla segura (casilla vacía) |
| **SharePoint Descarga PyM Excel** | `GET` | 1 al día / bajo demanda | 60.000 ms | 1 en vuelo | 1 reintento forzando refresco de link | Uso de caché local persistida (`vgl_pym`) |
| **Google Apps Script Telemetría** | `POST` | 1 lote cada 5-30 min | 20.000 ms | 1 en vuelo | Cola en memoria (`repQ`, máx 30) | Descarte selectivo de métricas UX antes de clínicas |
| **Gist Kill-Switch / Versión** | `GET` | 1 cada 4 horas / arranque | 15.000 ms | 1 en vuelo | 0 reintentos | Continuación en versión actual |

---

## 3. Máquina de Estados del Cortacircuitos (Circuit Breaker)

Para evitar sobrecargar los servidores de la IPS durante incidentes de infraestructura o lentitud extrema, el Vigilante implementa un cortacircuitos de 3 estados para las llamadas de consulta:

```
                 ┌──────────────────────────────────────┐
                 │                CLOSED                │
                 │   - Peticiones normales activas      │
                 │   - Contador de fallos = 0           │
                 └──────────────────┬───────────────────┘
                                    │
                       3 fallos consecutivos
                       o 50% fallos en ventana
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │                 OPEN                 │
                 │   - Fail-Fast inmediato              │
                 │   - 0 peticiones de red reales       │
                 │   - Modo local / DOM fallback        │
                 │   - Temporizador: T_reset (60s..300s)│
                 └──────────────────┬───────────────────┘
                                    │
                           T_reset expira
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │              HALF-OPEN               │
                 │   - Permite 1 petición de sondeo     │
                 │     (Canary Probe)                   │
                 └──────────────┬───────────────────────┘
                                │
                  ┌─────────────┴─────────────┐
             Sonda Exitosa               Sonda Fallida
                  │                           │
                  ▼                           ▼
            Volver a CLOSED           Volver a OPEN
         (Restablecer contadores)  (Duplicar T_reset con jitter)
```

### 3.1 Parámetros Operativos del Cortacircuitos
- **Umbral de Disparo a OPEN:** 3 fallos HTTP 5xx consecutivos o 3 timeouts consecutivos.
- **Duración Inicial de OPEN ($T_{\text{reset}}$):** 60.000 ms (1 minuto).
- **Crecimiento de $T_{\text{reset}}$ ante fallas repetidas:** Exponencial con tope de 300.000 ms (5 minutos).
- **Comportamiento en OPEN:** Las peticiones retornan inmediatamente `null` o el estado en caché sin abrir conexiones TCP/HTTP ni bloquear el hilo de ejecución.

---

## 4. Algoritmo de Backoff Exponencial con Jitter

Para las solicitudes de lectura (`GET` / `HEAD`) que admiten reintento, el intervalo entre intentos se calcula según:

$$T_{\text{espera}} = \min\left(T_{\text{max}}, T_{\text{base}} \times 2^{\text{intento}}\right) + \text{uniform}(0, \text{jitter\_max})$$

Donde:
- $T_{\text{base}} = 500\text{ ms}$
- $T_{\text{max}} = 60.000\text{ ms}$
- $\text{jitter\_max} = 500\text{ ms}$
- $\text{uniform}(0, \text{jitter\_max})$ introduce una distribución uniforme pseudoaleatoria que desincroniza las reconexiones de múltiples consultorios simultáneos tras un corte de red.

---

## 5. Política Estricta de Escrituras Clínicas (0 Reintentos)

### 5.1 Riesgo de la Doble Escritura
En las operaciones de:
1. `AsignarTurno`: Creación de cita real en la agenda institucional.
2. `GuardarOrdenamiento`: Emisión de órdenes médicas en la historia clínica.

Un reintento automático tras un timeout o error transitorio de conexión puede provocar:
- **Doble cita asignada** para el mismo paciente o en huecos consecutivos.
- **Duplicación de paquetes de órdenes**, generando sobrecostos a la IPS o confusión al paciente.

### 5.2 Regla de Idempotencia
- **Máximo de Intentos:** 1 intento único (`maxRetries = 0`).
- **Bloqueo de Reentrada en UI:** Los botones de confirmación se desactivan inmediatamente (`btn.disabled = true`, texto «⏳ Procesando...») para prevenir dobles clics del médico.
- **Respuesta ante Fallo:** Si la petición falla o no responde antes del timeout (15 s), el script:
  1. No reintenta en segundo plano.
  2. Muestra un aviso claro: *"No se pudo confirmar la operación con el servidor de Everest. Verifique manualmente antes de reintentar."*
  3. Desbloquea la interfaz permitiendo al médico inspeccionar el estado real del EHR.

---

## 6. Blindaje de Sesión Athenea y Guardia Anti-Bloqueo

### 6.1 Protección de Credenciales Institucionales
En muchas sedes, las credenciales del portal Athenea son compartidas por varios consultorios. Un ciclo de reintentos con contraseña vencida o cambiada provoca el bloqueo de la IP o la cuenta en toda la institución.

### 6.2 Reglas de Autologin (`atheneaAutoLogin`)
1. Si `/Account/Login` responde con código HTTP 401, 403 o la página de login reaparece con mensaje de credenciales erróneas:
   - Se establece `atheneaLoginBloqueado = true` de forma permanente para la sesión.
   - Se cancelan de inmediato todos los intentos de autologin posteriores.
   - Se emite una alerta visual ámbar única: *"Credenciales de Athenea no válidas. Inicie sesión manualmente."*
2. Prohibido reintentar en bucle bajo cualquier circunstancia.

---

## 7. Gobernanza de la Cola de Telemetría (`repQ`)

Para evitar fugas de memoria o peticiones gigantescas cuando el servidor de Google Apps Script está inaccesible:
- **Límite de Capacidad:** Máximo 30 filas en cola (`repQ`).
- **Política de Descarte Selectivo:** Si la cola supera el límite:
  1. Se descartan prioritariamente los eventos de interfaz de usuario (`ux`).
  2. Se protegen y retienen los eventos de resumen clínico y auditoría (`resumen`, `auditoria`).
- **Lote de Envío:** Un lote por petición cada 5 a 30 minutos, con carga útil comprimida o consolidada.

---

## 8. Verificación Automatizada (Suite 33)

El cumplimiento de esta política se valida en `tests/suite_33_robustez_concurrencia_red.js` mediante:
1. Verificación de transiciones del Circuit Breaker (`CLOSED` $\rightarrow$ `OPEN` $\rightarrow$ `HALF-OPEN` $\rightarrow$ `CLOSED`).
2. Comprobación de que peticiones en estado `OPEN` no ejecutan llamadas a `fetch`.
3. Verificación de que `_pageFetchJsonCore` con métodos de escritura (`POST`) ejecuta exactamente 1 intento ante fallos HTTP 500 o timeout.
4. Verificación de la aplicación de jitter en los delays de reintento de solicitudes de lectura.
5. Verificación de que el fallo de login en Athenea activa `atheneaLoginBloqueado` y detiene reintentos.
6. Verificación del descarte prioritario de eventos `ux` en `repFlush`.
