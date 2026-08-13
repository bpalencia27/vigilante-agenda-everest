# Comparación de Propuestas Visuales (Fase 1)

Este documento sintetiza las decisiones de diseño tomadas para resolver la ambigüedad visual en el panel de agendamiento, de acuerdo a los requerimientos de la v13 (SUPERPROMPT_AGENDA_V13.md).

---

## Decisiones por Propuesta

### Propuesta 1: Densidad (B1)
**Concepto:** Maximizar la información visible mediante un calendario compacto (grid) y una zona de slots independiente.

*   **Día sugerido:** Chip central que resalta con `scale(1.05)`, fondo verde semitransparente, borde grueso `var(--c-verde)` y un pseudo-elemento de diana (`🎯`). Cumple la regla de usar más de un canal (color, escala, borde, ícono).
*   **Cupos adicionales (7:30, 9:30...):** Tienen borde punteado/dashed ámbar, y un pseudo-elemento de estrella (`★`).
*   **Franja recomendada:** Se agrupan visualmente bajo un `div` contenedor con fondo morado suave. Los slots individuales mantienen el diseño principal de botones, pero con colores temáticos morados. El slot sugerido dentro de la franja se invierte (`background: var(--c-morado)` con texto en contraste máximo).

**Debilidad reconocida:** El contenedor separado para la franja recomendada ocupa espacio extra. Un paciente con muchas citas dispersas puede ver la pantalla abarrotada, obligando a usar *scroll*.

### Propuesta 2: Línea de tiempo (B2)
**Concepto:** Enfoque temporal. Destaca la relación de proximidad entre días con una línea horizontal.

*   **Día sugerido:** El nodo (círculo) en el timeline crece de tamaño significativamente, cambia a color verde, y presenta un label extra debajo que dice "SUGERIDO".
*   **Cupos adicionales:** Tienen forma de *pill* (redondeada) en lugar del clásico *chip* cuadrado, borde dashed y un prefijo text-based ("★").
*   **Franja recomendada:** Contenedor lateral (con borde grueso izquierdo) estilo _ribbon_ (cinta). Agrupa firmemente todas las horas de la "primera mitad" y la hora sugerida tiene check ("✓") y colores invertidos.

**Debilidad reconocida:** Escalar una línea de tiempo horizontal en móviles o pantallas angostas requiere hacer scroll horizontal (`overflow-x: auto`), lo cual suele ser torpe en interfaces clínicas donde los médicos usan mouse. Además, los días sin agenda (`disabled`) no aportan mucha info y rompen un poco la continuidad visual.

### Propuesta 3: Tarjetas por Día (B3)
**Concepto:** Estructura *Bento Grid*. Cada día es su propio contenedor independiente que muestra el resumen, y se expande para revelar detalles.

*   **Día sugerido:** La tarjeta completa adopta estilos en verde, sombra sutil y una etiqueta (badge) superpuesta flotando en la esquina ("Recomendado").
*   **Cupos adicionales:** En la vista colapsada, se indica con una insignia global en la cabecera ("★ 4 adicionales"). En la vista de slots, se usan bordes `dashed`.
*   **Franja recomendada:** No usa contenedores nuevos que rompan la grilla. Simplemente separa los bloques usando subtítulos de texto y aplica un estilo sólido (background morado claro) a todos los slots que aplican.

**Debilidad reconocida:** Requiere clics o un estado "expandido/colapsado" claro. Si intentamos renderizar las 16 tarjetas (16 días) con todas sus citas simultáneamente sin colapsarlas, la altura del modal será enorme y el rendimiento caerá.

---

## Síntesis (Panel de Jueces)

### 🩺 Juez Clínico
> *"Necesito distinguir rápidamente el paciente que requiere una franja y el que requiere un cupo adicional, sin que compitan entre sí."*
*   **B1 (Densidad):** 8/10. Muy claro, todo está a la vista, pero la diana ("🎯") puede resultar infantil o poco seria en un contexto clínico.
*   **B2 (Línea de tiempo):** 7/10. Separar visualmente la franja con una barra lateral izquierda es muy claro, pero no me gusta arrastrar horizontalmente para ver días futuros.
*   **B3 (Tarjetas):** **9/10.** Ver la insignia de "Cupos adicionales habilitados" a nivel global de la tarjeta antes incluso de mirar la hora es excelente. El indicador "Recomendado" que solapa el borde también destaca lo suficiente.

### ♿ Juez de Accesibilidad
> *"El contraste debe ser alto (AA) y la información no debe depender sólo del color (pensando en médicos daltónicos o monitores con brillo alterado)."*
*   **B1 (Densidad):** 9/10. Usa bordes punteados, símbolos (★ y 🎯) y cambios de peso de fuente.
*   **B2 (Línea de tiempo):** 8/10. El uso de círculos pequeños en los días inactivos vs grandes en el sugerido es accesible.
*   **B3 (Tarjetas):** 9/10. La separación por encabezados textuales ("Franja recomendada", "Otras opciones") nunca falla por problemas de daltonismo porque es puramente textual.

### 💻 Juez de Implementación
> *"La solución debe ser fácil de injertar en el actual render(card.innerHTML) sin romper pruebas. Entre menos DOM se modifique, menor el riesgo de regresión."*
*   **B1 (Densidad):** 8/10. Es similar a cómo está implementado hoy (`renderDayChips` y el contenedor de horas). Sería una extensión natural del código actual.
*   **B2 (Línea de tiempo):** 5/10. Refactorizar el flex/grid a un timeline horizontal con líneas conectadas requeriría mucho CSS nuevo e incrementa la chance de romper el layout en monitores extraños.
*   **B3 (Tarjetas):** **9/10.** Inyectar la interfaz de slots dentro de un `.vgl-agm-card` iterativo es modular y funciona perfectamente en el arnés de pruebas simulado, ya que no depende de posiciones absolutas o dimensiones de pantalla.

### 🏆 Diseño Ganador y Siguientes Pasos
La **Propuesta 3 (Tarjetas por Día / Bento Grid)** tiene el mejor balance general. Sin embargo, para no romper la experiencia de usuario (donde se hacía click a un día compacto y las horas aparecían abajo), la propuesta final se implementará como una **mezcla entre B1 y B3**:

1.  Se mantendrá el selector superior de chips por días (estilo B1) ya que es denso y amigable para ver un periodo de dos semanas (14-16 días).
2.  Al hacer clic, el panel inferior donde aparecen las horas adoptará el **lenguaje visual de B3**, separando limpiamente la *"Franja Recomendada"* del resto de horas con *labels* textuales puros, eliminando la necesidad de cajas sombreadas (que B1 utilizaba y añadía mucho ruido).
3.  Los **Cupos Adicionales** utilizarán invariablemente el prefijo `★` y `border-style: dashed`, permitiendo que coexistan perfectamente con el fondo color morado de la franja recomendada sin colisionar los canales visuales.
4.  El **Día Sugerido** combinará escala (`transform: scale(1.05)`), borde sólido verde, y un rótulo "SUGERIDO" (texto + color), evitando iconografía ambigua ("🎯").