# Especificación Unificada de Dirección de Arte — Rediseño v15

> **Fase 1 — Síntesis y Dirección de Arte**
> Documento rector para la implementación visual del Vigilante de Agenda.

---

## 1. Evaluación del Jurado de Dirección de Arte

Se evaluaron tres propuestas independientes desarrolladas en la carpeta `preview/`:

| Propuesta | Concepto / Enfoque | Legibilidad Clínica | Calidad Estética | Rendimiento / Robustez | Dictamen del Jurado |
|---|---|:---:|:---:|:---:|---|
| **Propuesta 1** | *Minimalismo Clínico de Alta Densidad* | **9.5 / 10** | 8.0 / 10 | **9.8 / 10** | Excelente densidad y velocidad de lectura; diseño algo austero en modales complejos. |
| **Propuesta 2** | *Bento Grid Clínico Moderno* | 9.0 / 10 | **9.4 / 10** | 9.2 / 10 | Excelente jerarquía y organización modular por tarjetas; gran scannability. |
| **Propuesta 3** | *Spatial Frost Glass (WCAG AAA)* | 8.2 / 10 | 9.0 / 10 | 8.0 / 10 | Muy vistosa pero el desenfoque pesado exige apagarlo bajo `.perf` en PCs antiguos. |

### Veredicto del Sintetizador:
Se adopta una **Arquitectura Bento Híbrida de Alta Densidad**:
- La **organización modular y tarjetas Bento** de la Propuesta 2.
- La **máxima densidad, sobriedad y cero fricción** de la Propuesta 1.
- La **precisión de contraste WCAG AAA y paridad de tokens** de la Propuesta 3, asegurando que `.perf` degrade limpiamente a fondos sólidos sin pérdida de jerarquía.

---

## 2. Tokens del Sistema de Diseño Unificado

### 2.1 Paleta de Triaje Clínico Invariante (5 Colores)
```css
/* Triaje Clínico — Invariante en ambos temas */
--c-verde:  #10b981;  /* A tiempo / En sala */
--c-morado: #a855f7;  /* Pre-alerta (~1 min restante) */
--c-ambar:  #f59e0b;  /* Ausente / Sin presentarse >= gracia */
--c-rojo:   #ef4444;  /* Fraude / Atención extemporánea */
--c-azul:   #3b82f6;  /* Programado / Normal */
```

### 2.2 Tokens de Superficie (Tema Oscuro OLED vs Tema Claro)
```css
/* Modo Oscuro OLED (Predeterminado) */
[data-theme="dark"], :root {
  --bg: #07090e;
  --bg-surface: #0e131c;
  --bg-card: #141b27;
  --bg-card-hover: #1b2434;
  --fg: #f8fafc;
  --fg2: #94a3b8;
  --fg3: #64748b;
  --edge: rgba(255, 255, 255, 0.08);
  --edge-strong: rgba(255, 255, 255, 0.16);
}

/* Modo Claro */
[data-theme="light"] {
  --bg: #f8fafc;
  --bg-surface: #ffffff;
  --bg-card: #f1f5f9;
  --bg-card-hover: #e2e8f0;
  --fg: #0f172a;
  --fg2: #475569;
  --fg3: #64748b;
  --edge: rgba(0, 0, 0, 0.08);
  --edge-strong: rgba(0, 0, 0, 0.16);
}
```

### 2.3 Escala Tipográfica del Sistema
```css
--t-micro:  11px;  /* Metadatos, chips, subetiquetas */
--t-body:   13px;  /* Nombres de paciente, texto general */
--t-strong: 14px;  /* Horas de cita, encabezados de tarjeta, botones */
--t-title:  16px;  /* Títulos de sección y modales */
--t-hero:   22px;  /* Reloj HUD principal, métricas destacadas */
```

### 2.4 Radios de Esquina y Espaciado
```css
--r-sm: 4px;   /* Chips, botones compactos, inputs */
--r-md: 8px;   /* Tarjetas de cita, bloques farmacológicos */
--r-lg: 12px;  /* Contenedor del panel principal, modales */
```

---

## 3. Reglas de Implementación para las 8 Superficies

1. **Panel Principal (`#vgl-root`)**:
   - Cabecera fija con reloj de alta visibilidad (`font-variant-numeric: tabular-nums`).
   - Tira de triaje compacta con conteos numéricos instantáneos en los 5 colores.
   - Lista de citas con borde lateral indicador de 4px (`border-left-color: var(--c-*)`).
2. **Dock Flotante (`#vgl-dock`)**:
   - Píldora redondeada con indicador LED brillante y contador de sala. Altura mínima de toque 44px.
3. **Modales Clínicos (`#vgl-*-modal`)**:
   - Encabezado con título claro, cuerpo en rejilla Bento (labs y métricas), pie con botones primarios/secundarios contrastados.
4. **Capa Farmacológica (`vgl-mtr-*`)**:
   - `.vgl-mtr-crit`: Fondo sutil rojo con borde izquierdo `var(--c-rojo)` de 4px.
   - `.vgl-mtr-alto`: Fondo sutil ámbar con borde izquierdo `var(--c-ambar)` de 4px.
   - `.vgl-mtr-sinjuicio`: Texto ámbar de aviso ("No hay juicio clínico disponible").
   - `.vgl-mtr-limpio`: Texto secundario neutral ("Sin interacciones detectadas").
5. **Modo de Rendimiento (`.perf`)**:
   - Apaga `backdrop-filter`, `box-shadow` y transiciones animadas. Todos los fondos se vuelven opacos (`--bg-surface`).

---

## 4. Estado de Checkpoint de Preview

- **Archivos de Preview Generados**:
  - [`preview/index.html`](file:///E:/VA_ui_rediseno/preview/index.html) (Hub de vista previa interactivo navegable)
  - [`preview/propuesta_1_minimal_clinico.html`](file:///E:/VA_ui_rediseno/preview/propuesta_1_minimal_clinico.html)
  - [`preview/propuesta_2_bento_moderno.html`](file:///E:/VA_ui_rediseno/preview/propuesta_2_bento_moderno.html)
  - [`preview/propuesta_3_frost_glass_elevado.html`](file:///E:/VA_ui_rediseno/preview/propuesta_3_frost_glass_elevado.html)
- **Privacidad**: Cero PHI — 100% de datos sintéticos generados.
- **Pruebas de Regresión**: El archivo de producción `vigilante_agenda.user.js` **permanece intacto y 100% verde (1.398 comprobaciones)** a la espera de la aprobación del médico.
