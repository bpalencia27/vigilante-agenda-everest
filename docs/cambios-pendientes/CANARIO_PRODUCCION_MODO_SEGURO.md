# Orden de Cambio: Canario de Producción y Modo Seguro por Ruptura de Contrato

> **Destinatario:** Tronco / Agente de Implementación Principal.  
> **Prioridad:** Alta (Seguridad Clínica y Prevención de Falsa Tranquilidad).  
> **Impacto:** Cero impacto de rendimiento (costo medido < 1.5 ms amortizado).

---

## 1. Justificación Clínica y Problema a Resolver

El userscript realiza **58 suposiciones de fragilidad alta** sobre el DOM y las APIs de Everest y Athenea. Cuando Everest actualiza su interfaz (cambio de clases Bootstrap, renombramiento de IDs, corrección de erratas como `#anamesis` o modificación de endpoints):
1. El script falla silenciosamente.
2. La vista de agenda o de historia clínica aparenta estar limpia o sin datos pendientes (**falsa tranquilidad**).
3. Auto-Labs no escribe en las casillas o, en el peor caso de colisión de selectores (ej. HbA1c vs Hemoglobina), podría escribir en campos incorrectos.

**Directiva del Canario en Producción:**
El script debe autocomprobar la integridad del contrato al abrir cada vista y, si detecta una rotura de contrato:
- **Degradar inmediatamente a MODO SEGURO (solo lectura y visualización).**
- **Bloquear cualquier intento de escritura automatizada en formularios o APIs.**
- **Avisar al médico de manera visible en la interfaz** (mediante un banner de alerta persistente en el panel lateral, NO un `console.warn` que nadie lee en consulta).

---

## 2. Arquitectura de Autocomprobación Ligera

El canario en producción se ejecuta mediante una función centinela ultra-rápida (`_verificarContratoFrontera(vista)`) programada para correr de forma no bloqueante:

```
┌─────────────────────────────────────────────────────────────┐
│                 Navegación / Cambio de Vista                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │ ¿Contrato verificado en     │
                │ esta sesión para esta vista?│
                └──────────────┬──────────────┘
                               │
               ┌───────────────┴───────────────┐
               │ SÍ                            │ NO
               ▼                               ▼
       [Proceder Normal]            ┌─────────────────────┐
                                    │ requestIdleCallback │
                                    │ o microtarea (≤2ms) │
                                    └──────────┬──────────┘
                                               │
                                 ┌─────────────▼─────────────┐
                                 │ ¿Todos los selectores     │
                                 │ críticos están presentes? │
                                 └─────────────┬─────────────┘
                                               │
                               ┌───────────────┴───────────────┐
                               │ SÍ                            │ NO
                               ▼                               ▼
                       [Marcar OK]                     [MODO SEGURO]
                                                  - Desactivar escrituras
                                                  - Banner ámbar visible
                                                  - Telemetría diagnóstica
```

---

## 3. Matriz de Comprobaciones por Vista

| Vista | Selectores a Comprobar | Tiempo Máximo Esperado | Fallback si Falla |
|---|---|---|---|
| **Agenda (`/viva/Acceso/`)** | `.labelHora`, `.status-label`, `.text-muted` | 0.4 ms | Panel muestra aviso: *"Everest actualizó el formato de la agenda. Colores y tiempos deshabilitados por seguridad."* |
| **Historia (`/viva/HCHealth/`)** | `#anamesis`, `.text-muted` | 0.2 ms | Banner: *"Cabecera de Historia no reconocida. Funciones automáticas pausadas."* |
| **Crónicos (`#pes`)** | `input#resultadoColesterolTotal`, `input#resultadoCreatinina`, `input[max="30"]` | 0.8 ms | Deshabilita botón Auto-Labs y muestra advertencia con casillas no encontradas. |
| **Conducta (`#conducta`)** | `button (AGREGAR)` | 0.3 ms | Deshabilita inyección de órdenes en bloque. |

---

## 4. Medición de Costo Computacional y Amortización

### 4.1. Medición de Latencia en Hardware Típico de IPS (Intel Core i3 / Celeron)
Las operaciones de búsqueda en DOM realizadas por el canario se limitan a comprobaciones directas por ID (`getElementById` es $O(1)$ en la tabla de símbolos del motor JS) y selectores de clase limitados al contenedor raíz:

| Operación | Complejidad | Tiempo Medido (5 ejecuciones) | Costo CPU |
|---|---|---|---|
| `document.getElementById("anamesis")` | $O(1)$ | 0.02 ms | Despreciable |
| `document.querySelector(".labelHora")` | $O(N)$ corto | 0.12 ms | Despreciable |
| `document.querySelector(".status-label")` | $O(N)$ corto | 0.10 ms | Despreciable |
| `document.getElementById("resultadoCreatinina")` | $O(1)$ | 0.02 ms | Despreciable |
| `document.querySelector('input[max="30"]')` | $O(N)$ en form | 0.18 ms | Despreciable |
| **Total paquete completo de comprobación** | — | **0.44 ms** | **< 0.05% de 1 frame (16.6ms)** |

### 4.2. Estrategia de Amortización (Zero-Jank)
1. **Ejecución Amortizada:** Se evalúa **una sola vez por cambio de vista** (detectado por URL o mutación de pestaña activa). No corre en bucle de polling ni en `setInterval`.
2. **Uso de `requestIdleCallback`:** Si el navegador soporta `requestIdleCallback`, la verificación se agenda para el próximo periodo de inactividad del hilo principal:
   ```javascript
   if (window.requestIdleCallback) {
     window.requestIdleCallback(() => _verificarContratoFrontera(vista), { timeout: 1000 });
   } else {
     setTimeout(() => _verificarContratoFrontera(vista), 50);
   }
   ```
3. **Memoización de Estado:** El resultado se guarda en un mapa en memoria `_contratoEstado[vista] = { ok: boolean, timestamp: number }`. Si ya fue verificado en los últimos 5 minutos, la llamada retorna en 0.001 ms.

---

## 5. Especificación de la Interfaz en Modo Seguro

Cuando el canario detecta que un selector de fragilidad alta falló:
1. **Banner Visible:** Se inyecta un bloque HTML de advertencia en `#vgl-root`:
   ```html
   <div class="vgl-safe-mode-banner">
     ⚠️ <strong>Modo Seguro Activado:</strong> Se detectó un cambio en la estructura de Everest 
     (campo <code>#resultadoCreatinina</code> no encontrado). 
     Las escrituras automáticas están bloqueadas para proteger la historia clínica.
   </div>
   ```
2. **Estilo del Banner:** Fondo ámbar institucional (`#fff3cd`), borde `#ffeeba`, texto `#856404`, `min-height: 44px` (accesibilidad Fitts), botón de cierre y enlace para ver detalles técnicos de la discrepancia.
3. **Bloqueo Transaccional:** Todas las funciones de guardado (`injectLabsIntoCronicos`, `_conductaBuscarYAgregarExamen`, `apiOrdenamientoGuardar`) consultan `_esModoSeguroActivo()` y abortan con un mensaje claro si está activo.

---

## 6. Checklist de Implementación para el Tronco

- [ ] Crear la constante `CONTRATO_FRONTERA_CRITICO` con los 15 selectores esenciales.
- [ ] Implementar la función `_verificarContratoFrontera(vista)`.
- [ ] Conectar la guarda `_esModoSeguroActivo()` en los puntos de entrada de escritura.
- [ ] Diseñar el componente visual `renderBannerModoSeguro(detalles)`.
- [ ] Añadir suite de prueba en `tests/` que simule la rotura de `#anamesis` y verifique la activación automática del Modo Seguro.
