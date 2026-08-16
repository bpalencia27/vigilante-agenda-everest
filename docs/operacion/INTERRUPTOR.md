# Interruptor de Emergencia: Apagado Local y Remoto

> **Documento Operativo de Seguridad Clínica (G1).**  
> **Destinatarios:** Médico en consultorio, soporte técnico y equipo de desarrollo.  
> **Objetivo:** Garantizar la detención inmediata y confiable del script ante cualquier anomalía en vivo.

---

## 1. El Problema Operativo de la Distribución en Vivo

El userscript se distribuye mediante el mecanismo de auto-actualización de Tampermonkey desde un Gist institucional. Cuando se incrementa la cabecera `@version`, Tampermonkey descarga y aplica la nueva versión **simultáneamente en los ~20 consultorios de la IPS** en su siguiente ciclo de comprobación (o al recargar la pestaña de Everest).

Si una versión contiene un error imprevisto (ej. inyección de datos cruzados, desplazamiento de citas o bucles de renderizado), **se requiere un mecanismo de desconexión inmediata**.

---

## 2. Interruptor Local (Primer Nivel de Defensa)

El interruptor local es el único mecanismo de apagado **100% garantizado** en mitad de una consulta médica, ya que opera en la memoria del navegador del médico **sin requerir conexión a internet ni autorización externa**.

### 2.1. Métodos de Activación por el Médico
1. **Atajo de Teclado Inmediato (`Ctrl + Shift + Q` / `Alt + K`):**
   - Diseñado para accionarse en menos de **0.5 segundos** sin apartar las manos del teclado.
2. **Botón Físico de Emergencia en la UI:**
   - Ubicado en la esquina superior derecha del panel lateral `#vgl-root` con icono visible `🛑 Pausar Vigilante`.
   - Cumple con la Ley de Fitts: área de toque de `min-height: 44px`.

### 2.2. Comportamiento Inmediato tras la Activación
- **Desconexión Síncrona:** Cancela inmediatamente todos los `setInterval`, `requestAnimationFrame` y observadores `MutationObserver`.
- **Ocultamiento Visual:** El panel lateral y las marcas de color en la agenda desaparecen instantáneamente para no confundir al médico.
- **Persistencia en Navegador:** Se almacena `localStorage.setItem("vgl_kill_switch_local", "1")`. Si el médico recarga la página (`F5`), el script lee la bandera al inicio y **aborta su ejecución antes de registrar ningún oyente de eventos**.
- **Reversibilidad:** El médico puede reactivar el script en cualquier momento haciendo clic en el icono de Tampermonkey en la barra de extensiones de Chrome y seleccionando la opción *"Reactivar Vigilante de Agenda"*, o ingresando a la configuración mediante `Ctrl + Shift + S`.

---

## 3. Interruptor Remoto (Segundo Nivel de Defensa)

Para apagar el script en todos los consultorios a la vez ante un reporte crítico, se evaluaron tres mecanismos arquitectónicos:

### 3.1. Evaluación Comparativa de Vías de Apagado Remoto

| Mecanismo | Latencia de Propagación | Disponibilidad si Cae la Red | Riesgo de Seguridad (Compromiso del Canal) | Veredicto |
|---|---|---|---|---|
| **Vía A: Archivo de Estado en Apps Script / Tablero** (`@connect script.google.com`) | **1 a 5 segundos** (en la siguiente petición del latido o cambio de paciente). | Falla si Google/red institucional está caído. | Medio. Quien controle el Apps Script puede inyectar banderas booleanas de apagado, pero **no código arbitrario**. | **Recomendada (Principal)** |
| **Vía B: Publicar Versión Stub Inerte en Gist** (`@version` superior con IIFE vacío) | **1 a 6 horas** (depende del intervalo de auto-actualización de Tampermonkey en cada puesto). | No aplica si el médico no recarga o si el proxy bloquea raw.githubusercontent.com. | Alto. Quien controle el Gist puede distribuir código arbitrario con privilegios de userscript. | **Secundaria (Fallback)** |
| **Vía C: Bandera en Cabecera de Respuesta de Telemetría** | **Inmediata** al enviar el siguiente lote de telemetría. | Solo se activa si el script ya está interactuando con la red. | Bajo. Limitado al payload de respuesta. | **Complementaria** |

---

## 4. La Pregunta Central: ¿Qué hace el Asistente si la Comprobación Remota Falla?

Cuando el consultorio pierde conexión a internet o el servidor remoto no responde:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DILEMA DE DISPONIBILIDAD                           │
│                                                                             │
│  [Opción 1: Apagado Total]    [Opción 2: Operación Total]   [Opción 3: MODO SEGURO] │
│  (Fallo Cerrado Total)        (Fallo Abierto Total)         (Fallo Abierto/Cerrado) │
│                                                                             │
│  ❌ Deja al médico ciego.     ❌ Sigue escribiendo con      ✅ Informa y lee.       │
│  Médico pierde alertas PyM    versión posiblemente rota.   ⛔ Bloquea escrituras.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Análisis del Impacto en el Paciente
1. **Opción 1 (Apagado Total):** El script se apaga por completo. Si se cayó la red externa pero Everest interno funciona, el médico pierde el soporte visual de alertas de nefropatía y la guía de PyM en pacientes complejos.
2. **Opción 2 (Operación Total):** El script sigue funcionando al 100%. Si una versión defectuosa estaba corrompiendo datos y se emitió la orden de apagado remoto, los consultorios sin internet continuarán escribiendo datos erróneos en historias clínicas reales.
3. **Opción 3 (Intermedia — MODO SEGURO: Fallo Abierto para Informar, Fallo Cerrado para Escribir):**
   - **Lectura e Información HABILITADAS:** El médico sigue viendo colores de agenda, tiempos de espera y panel de alertas PyM.
   - **Escrituras DESHABILITADAS:** Se bloquea `injectLabsIntoCronicos` (Auto-Labs), el guardado automático de órdenes en Conducta (`apiOrdenamientoGuardar`) y la asignación de turnos (`apiAccesoAsignarTurno`).

> ### 📢 Decisión Escalada al Usuario
> **Recomendación de Ingeniería:** Adoptar la **Opción 3 (Modo Seguro)**. Garantiza que el médico no pierda la visualización de datos clínicos de soporte vital, mientras protege la base de datos de Everest contra escrituras automatizadas no verificadas.

---

## 5. Granularidad del Interruptor

El interruptor soporta tres niveles de granularidad configurable en el payload del comando de apagado:

```json
{
  "killSwitch": {
    "activo": true,
    "nivel": "bloqueo_escrituras",
    "superficies": {
      "autoLabs": false,
      "conductaOrdenes": false,
      "agendaAsignacion": false,
      "alertasVisuales": true,
      "panelLectura": true
    },
    "mensajeMedico": "Mantenimiento preventivo en módulo de órdenes. Inyección automática pausada.",
    "fechaExpiracion": "2026-08-16T23:59:59Z"
  }
}
```

---

## 6. Auto-Degradación Preventiva en la Sesión

El userscript no debe esperar a una intervención humana si detecta anomalías internas. Se definen dos reglas automáticas de auto-degradación:

1. **Regla $N=2$ (Fallos de Contrato DOM):** Si en 2 cambios de paciente consecutivos el script no localiza los selectores críticos (`#anamesis` o `input#resultadoCreatinina`), activa automáticamente el Modo Seguro y notifica al médico.
2. **Regla $M=3$ (Excepciones No Capturadas):** Si el manejador global `window.onerror` registra 3 excepciones originadas en el archivo del script dentro de una ventana de 10 minutos, el script se desactiva por completo para evitar fugas de memoria o degradación del rendimiento de Everest.

---

## 7. Referencias y Documentación Oficial Citada

1. **Tampermonkey Documentation (Update Mechanism):**
   - *Fuente:* [Tampermonkey Docs - `@updateURL` & `@downloadURL`](https://www.tampermonkey.net/documentation.php).
   - Tampermonkey ejecuta las comprobaciones de actualización de forma asíncrona en segundo plano según el intervalo configurado por el usuario (mínimo 6 horas por defecto, configurable en la pestaña de Ajustes de la extensión).
2. **Chrome Extensions Storage & Content Scripts Isolation:**
   - *Fuente:* [Chrome Extensions Architecture - Content Scripts Context](https://developer.chrome.com/docs/extensions/mv3/content_scripts/).
   - `localStorage` del dominio `everestintelligent.com` persiste entre recargas de página pero es específico del origen y perfil del navegador.
