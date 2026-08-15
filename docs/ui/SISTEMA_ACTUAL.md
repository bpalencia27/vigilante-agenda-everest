# Sistema de Diseño Actual — Vigilante de Agenda Everest

> **Fase 0 — Arqueología del Sistema Visual**
> Documentación técnica de los tokens, escalas, capas y reglas de blindaje que gobiernan la UI actual.

---

## 1. Tokens de Color y Código Clínico Invariante

El sistema visual del Vigilante distingue estrictamente entre **colores de triaje clínico** (invariables) y **colores de superficie/interfaz** (adaptables al tema).

### 1.1 Código de 5 Colores de Triaje Clínico
Definido en la constante `COLORS` en JS y mapeado a variables CSS:

| Token JS | Token CSS | Valor Hex / RGB | Significado Clínico Operativo |
|---|---|---|---|
| `VERDE` | `--c-verde` | `#10B981` / `rgba(16, 185, 129, 1)` | Paciente llegó a tiempo dentro de la tolerancia. |
| `MORADO` | `--c-morado` | `#9333EA` / `rgba(147, 51, 234, 1)` | Pre-alerta: ~1 minuto para confirmar llegada o pierde cita. |
| `AMBAR` | `--c-ambar` | `#D97706` / `rgba(217, 119, 6, 1)` | Paciente "Sin presentarse" $\ge$ tiempo de gracia (entra a watch). |
| `ROJO` | `--c-rojo` | `#E54D42` / `rgba(229, 77, 66, 1)` | Alerta de fraude o atención extemporánea. Sonido edge-triggered. |
| `AZUL` | `--c-azul` | `#2563EB` / `rgba(37, 99, 235, 1)` | Estado normal o cita agendada estándar. |

*Invariante clínico*: Ningún tema o rediseño puede alterar el significado de estos 5 colores ni degradar su contraste relativo (verificado por Suite 25, Regla F).

---

## 2. Paleta de Superficie y Temas (Oscuro OLED vs Claro)

### 2.1 Tema Oscuro OLED (Predeterminado para Consultorios)
- `--bg`: `rgba(9, 11, 17, 0.84)` (Vidrio frost sobre negro OLED)
- `--bg-sidebar`: `rgba(5, 7, 12, 0.66)`
- `--bg2`: `rgba(255, 255, 255, 0.055)`
- `--bg3`: `rgba(255, 255, 255, 0.095)`
- `--bg4`: `rgba(255, 255, 255, 0.17)`
- `--bg-solid`: `#0b0e15`
- `--fg`: `#f1f5f9` (Texto principal de alto contraste)
- `--fg2`: `#94a3b8` (Texto secundario / metadatos)
- `--fg3`: `#64748b` (Texto terciario / placeholders)
- `--edge`: `rgba(255, 255, 255, 0.08)` (Bordes sutiles)

### 2.2 Tema Claro
- `--bg`: `rgba(248, 250, 252, 0.92)`
- `--bg-sidebar`: `rgba(241, 245, 249, 0.85)`
- `--bg2`: `rgba(0, 0, 0, 0.035)`
- `--bg3`: `rgba(0, 0, 0, 0.065)`
- `--bg4`: `rgba(0, 0, 0, 0.12)`
- `--bg-solid`: `#ffffff`
- `--fg`: `#0f172a`
- `--fg2`: `#475569`
- `--fg3`: `#64748b`
- `--edge`: `rgba(0, 0, 0, 0.08)`

---

## 3. Escala Tipográfica del Sistema (`--t-*`)

Prohibido el uso de `font-size` literales en píxeles. Toda la tipografía debe consumir los tokens de escala (Suite 25, Reglas G, H, I):

| Token | Tamaño Computado | Uso Primario |
|---|---|---|
| `--t-micro` | `10px - 11px` | Badges, horas secundarias, metadatos de laboratorio, advertencias de pie |
| `--t-body` | `12px - 13px` | Texto general, nombres de pacientes, resultados de analitos |
| `--t-strong` | `13px - 14px` | Encabezados de tarjeta, valores resaltados, botones de acción |
| `--t-title` | `15px - 16px` | Títulos de sección, encabezados de modales |
| `--t-hero` | `18px - 20px` | Reloj principal del HUD, contadores de triaje destacados |

---

## 4. Escala de Capas y Elevación Z-Index (`--z-*`)

El userscript convive con los elementos flotantes y modales nativos de Everest. Los valores de `z-index` están normalizados en 5 tokens rígidos (Suite 25, Regla J):

| Token | Valor Exacto | Elementos Asignados |
|---|---|---|
| `--z-dock` | `99990` | Píldora de dock flotante `#vgl-dock` |
| `--z-panel` | `99995` | Panel principal `#vgl-root`, HUD espacial `#vgl-sp` |
| `--z-overlay` | `99998` | Telón de fondo / backdrop de modales |
| `--z-modal` | `100000` | Modales interactivos (`#vgl-modal`, `#vgl-labs-modal`, `#vgl-ordenar-modal`) |
| `--z-toast` | `100005` | Notificaciones toast prioritarias `#vgl-toasts` |

---

## 5. Modo de Rendimiento (`.perf`) y Accesibilidad (`prefers-reduced-motion`)

1. **Clase `.perf`**:
   - Apaga de raíz `backdrop-filter: blur(...)` y sustituye los fondos translúcidos por fondos sólidos (`var(--bg-solid)`).
   - Elimina sombras de caja complejas (`box-shadow` difusas) y filtros visuales pesados para garantizar 60 FPS en hardware antiguo de consultorio.
2. **`prefers-reduced-motion`**:
   - Reduce las duraciones de transición a 0ms en efectos decorativos.
   - **Excepción clínica**: El parpadeo de alerta de fraude en la pestaña/título NO se silencia, ya que es un canal de aviso crítico en terminales con notificaciones del SO bloqueadas (Suite 35, R6.5).

---

## 6. Las 15 Reglas de Blindaje de Cascada CSS (Suite 25)

| Regla | Nombre / Examen | Razón de Existencia en el Código |
|:---:|---|---|
| **A** | Sin colisión de clases hermanas | Evita que dos clases asignadas al mismo elemento compitan con especificidad idéntica causando parpadeo visual. |
| **B** | `!important` vs Inline Style | Asegura que ninguna regla de hoja de estilo pise inline styles programáticos. |
| **C** | Insignia SUGERIDO en tema claro | Previene que el chip de analito sugerido pierda contraste sobre fondo blanco. |
| **D** | Consumo de tokens declarados | Exige que toda variable `var(--X)` utilizada esté previamente definida en `:root` o el selector de contenedor. |
| **E** | `!important` fuera de `#vgl-root` | Todo elemento que cuelgue de `document.body` debe proteger su `color` con `!important` frente a las reglas globales de Everest. |
| **F** | Paridad de tokens claro/oscuro | Garantiza que todo token existente en modo oscuro tenga su contraparte en modo claro, incluyendo los 5 colores clínicos. |
| **G/H/I**| Escala tipográfica estricta | Prohíbe `font-size` hardcodeados en px/rem; todo debe heredar de `--t-*`. |
| **J** | Normalización de `z-index` | Exige el uso exclusivo de los 5 tokens de capas de la tabla. |
| **K** | Contador del banner PyM | Protege el color del contador numérico para que nunca se opaque ni se herede en azul. |
| **L** | Fondo opaco propio en body | Los modales que cuelgan del body deben tener fondo opaco propio (`--bg-solid`), no sólo un velo transparente. |
| **M** | Botones con reserva de token | Los botones interactivos consumen tokens con valores de reserva (*fallback*). |
| **N** | Cero backticks sueltos en CSS | Prohíbe caracteres backtick dentro del template string que causarían un syntax error fatal en tiempo de ejecución. |
| **O** | Contraste WCAG calculado | Exige ratio de contraste $\ge 4.5:1$ calculado con fórmula sRGB real y composición alpha en ambos temas, manteniendo la jerarquía `--fg3` < `--fg2`. |
