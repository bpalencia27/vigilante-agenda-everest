# Inventario Visual Completo — Vigilante de Agenda Everest (v14.1.9 / v15)

> **Fase 0 — Cartografía del Sistema Visual**
> Base: `feat/motor-portado` @ `9af2ea9` (Rama `ui/rediseno-v15` en `E:\VA_ui_rediseno`).
> Generado con análisis estático directo sobre `vigilante_agenda.user.js` (16.846 líneas).

---

## 1. Métricas Globales del Código CSS y Marcado

| Parámetro | Valor Verificado | Ubicación / Observaciones |
|---|---|---|
| **Bloque CSS Principal (`buildOverlay`)** | **2.142 líneas** (131.776 bytes) | Líneas 7535 a 9676 de `vigilante_agenda.user.js` |
| **Bloque CSS Motor (`_mtrEstilosFarmaco`)** | **27 líneas** (1.782 bytes) | Líneas 16817 a 16843 de `vigilante_agenda.user.js` |
| **Total de clases `.vgl-*` únicas** | **223 clases** | 100% de coincidencia y alcanzabilidad entre CSS y JS |
| **Total de IDs `#vgl-*` únicos** | **41 en CSS / 86 en JS** | Los IDs en JS incluyen controles interactivos internos |
| **Tokens CSS declarados (`:root` / temas)** | **46 tokens únicos** | `--bg*`, `--fg*`, `--c-*`, `--t-*`, `--z-*`, `--r-*`, `--surface*` |
| **Temas soportados** | **2 temas + Auto** | Oscuro OLED (predeterminado), Claro, Auto (OS scheme) |
| **Perfil de rendimiento** | **Clase `.perf`** | Apaga `backdrop-filter`, desenfoques y sombras pesadas |

---

## 2. Inventario Detallado de Superficies Visuales

### Superficie 1: Panel Principal de la Agenda (`#vgl-root`)
- **Propósito**: Superficie primaria de trabajo que el médico consulta permanentemente durante su turno de 6-8 horas.
- **Estructura DOM**:
  - `header.vgl-head`: Título, reloj en vivo, selector de fecha, botón de colapso/dock, botón de ajustes, botón de actualización.
  - `nav.vgl-tabs`: Pestañas principales de navegación (`Citas`, `Pacientes`, `Alertas`, `PyM`, `Farmacología`).
  - `div.vgl-filtros`: Barra de búsqueda rápida (cédula/nombre), chips de filtro por estado de llegada (`Todos`, `Verde`, `Morado`, `Ámbar`, `Rojo`, `Atendidos`).
  - `main.vgl-citas-lista`: Contenedor virtualizado/scrolleable con las tarjetas de cita de cada paciente (`.vgl-cita-card`).
  - `footer.vgl-foot`: Resumen del turno, contador de atendidos, pendientes, inasistencias y tiempo promedio.
- **Clases Clave**: `.vgl-root`, `.vgl-head`, `.vgl-cita-card`, `.vgl-cita-hora`, `.vgl-cita-paciente`, `.vgl-cita-doc`, `.vgl-cita-tag`, `.vgl-estado-dot`.

### Superficie 2: Dock y Acciones Flotantes (`#vgl-dock`, `#vgl-acciones-dock`)
- **Propósito**: Modo minimizado tipo píldora flotante para no obstruir el EHR cuando el médico atiende o redacta.
- **Estructura DOM**:
  - `#vgl-dock`: Píldora compacta con indicador LED de estado, contador de pacientes en sala y botón de reapertura.
  - `#vgl-acciones-dock`: Menú contextual de acceso rápido a herramientas clínicas (Auto-Labs, Ordenar, Calculadora TFG).
- **Clases Clave**: `.vgl-dock-btn`, `.vgl-dock-badge`, `.vgl-dock-menu`, `.vgl-dock-item`.

### Superficie 3: Modales de Flujo de Trabajo Clínico
- **Modales Existentes**:
  1. `#vgl-labs-modal` / `#vgl-labsv-modal`: Revisión y auditoría de laboratorios crónicos y analitos vencidos por estadio renal.
  2. `#vgl-ordenar-modal`: Panel de generación y selección de órdenes de laboratorio (CUPS).
  3. `#vgl-agendar-modal`: Flujo de asignación de citas de control y seguimiento RCV.
  4. `#vgl-postcita-panel`: Panel de conducta y verificación de tareas pendientes antes de cerrar la historia clínica.
- **Clases Clave**: `.vgl-modal-backdrop`, `.vgl-modal-card`, `.vgl-modal-header`, `.vgl-modal-body`, `.vgl-modal-footer`, `.vgl-btn-primary`, `.vgl-btn-secondary`, `.vgl-btn-danger`.

### Superficie 4: Sistema de Alertas, Toasts y Diálogos Críticos
- **Estructura DOM**:
  - `#vgl-toasts`: Contenedor apilado en esquina superior/inferior para notificaciones breves autodescartables.
  - `#vgl-modal`: Diálogo modal de interrupción para alertas clínicas de fraude, pacientes sin presentarse o bloqueos.
- **Clases Clave**: `.vgl-toast`, `.vgl-toast-rojo`, `.vgl-toast-ambar`, `.vgl-toast-verde`, `.vgl-toast-azul`, `.vgl-dialog-title`, `.vgl-dialog-msg`.

### Superficie 5: Banner y Modales de Promoción y Mantenimiento de la Salud (PyM / PES)
- **Estructura DOM**:
  - `#vgl-pym-banner`: Franja superior persistente que destaca pacientes con actividades PyM pendientes (VIH, Tamizajes).
  - `#vgl-pym-modal`: Detalle interactivo de metas de tamizaje y rutas de detección temprana.
  - `#vgl-pes-modal`: Interfaz de retención y alertas para el Programa de Prevención de Abandono (PES).
- **Clases Clave**: `.vgl-pym-banner`, `.vgl-pym-chip`, `.vgl-pym-count`, `.vgl-pym-alerta`, `.vgl-pes-alerta`.

### Superficie 6: Panel de Configuración y Ajustes (`#vgl-settings`)
- **Propósito**: Configuración de tolerancias de tiempo, umbrales de alerta, selector de tema, activación de bandera `S.motorPortado`, sonido y canales de notificación.
- **Clases Clave**: `.vgl-settings-panel`, `.vgl-setting-row`, `.vgl-toggle-switch`, `.vgl-select-group`, `.vgl-slider-control`.

### Superficie 7: Capa de Presentación Farmacológica y Dosis Renal (`vgl-mtr-*`)
- **Propósito**: Presentación visual de alertas de seguridad de medicamentos, interacciones fármaco-fármaco y ajuste de dosis renal.
- **Clases Clave**:
  - `.vgl-mtr-bloque`: Tarjeta contenedor de farmacología.
  - `.vgl-mtr-crit`: Alerta roja de interacción o contraindicación crítica (prioridad máxima en triaje).
  - `.vgl-mtr-alto`: Alerta ámbar de precaución o ajuste de dosis requerido.
  - `.vgl-mtr-info`: Alerta azul de recomendación o monitoreo.
  - `.vgl-mtr-sinjuicio`: Estado ámbar cuando no fue posible consultar medicamentos ("no hay juicio clínico disponible").
  - `.vgl-mtr-limpio`: Estado verde/neutro cuando se analizaron todos los fármacos y no hay hallazgos adversos.
  - `.vgl-mtr-conducta`, `.vgl-mtr-msg`, `.vgl-mtr-meds`, `.vgl-mtr-mec`, `.vgl-mtr-pie`.

### Superficie 8: HUD Espacial de Notificación y Centinela (`#vgl-sp`, `#vgl-instancia-duplicada`)
- **Propósito**: Notificación fuera de pantalla principal e intercepción ante apertura simultánea de múltiples pestañas.

---

## 3. Matriz de Componentes y su Estado de Alcanzabilidad

| Componente | Clases Asociadas | Estado en Producción | Observaciones |
|---|---|:---:|---|
| **Cita Card (Triaje)** | `.vgl-cita-card`, `.vgl-cita-v*`, `.vgl-cita-a*`, `.vgl-cita-r*` | Activo | Código de 5 colores clínico estricto |
| **Chips de Analitos** | `.vgl-lab-chip`, `.vgl-chip-vencido`, `.vgl-chip-vigente` | Activo | Respeta vigencia KDIGO / Tabla 50 |
| **Dock Flotante** | `.vgl-dock`, `.vgl-dock-btn`, `.vgl-dock-count` | Activo | Accesible en todo momento con `min-height: 44px` |
| **Banner PyM** | `.vgl-pym-banner`, `.vgl-pym-btn`, `.vgl-pym-pill` | Activo | Red de seguridad D4 probada |
| **Tarjeta Farmacológica** | `.vgl-mtr-bloque`, `.vgl-mtr-crit`, `.vgl-mtr-alto` | Activo (detrás de bandera) | Probada con 15.222 vectores dorados |
| **Selector de Tema** | `.vgl-theme-toggle`, `.vgl-theme-dark`, `.vgl-theme-light` | Activo | Paridad de tokens garantizada por Suite 25 |
