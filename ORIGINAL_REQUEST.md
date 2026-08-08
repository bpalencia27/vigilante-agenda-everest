# Original User Request

## Initial Request — 2026-08-07T23:07:16Z

Rediseñar y reescribir los textos, tipografías y CSS del script "Vigilante de Agenda v8.2.0" para adaptarlo a médicos sin experiencia técnica, sin modificar la lógica de programación.

Working directory: `E:\Vigilante_Agenda`
Target file: `vigilante_agenda.user.js`
Integrity mode: demo (El equipo puede leer el código fuente para entender el contexto).

## Requirements

### R1. Auditoría visual y CSS
Reformatear el bloque `<style>` inyectado para mejorar la ergonomía visual:
- Aumentar tamaños de fuente (mínimo 12px, base 14px, títulos 16px+).
- Cambiar a una tipografía moderna y redonda (ej. system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif).
- Suavizar colores de alerta (evitar #FF453A intenso, usar tonos menos estresantes con contraste WCAG).
- Aumentar interlineado (1.4-1.5) y padding en modales y notificaciones.

### R2. Copywriting Médico
Reescribir errores, tooltips, modales y ajustes a un lenguaje empático y clínico:
- Eliminar jerga técnica ("WORKER_PANIC", "API", "JSON", "DOM", "GM_xmlhttpRequest").
- Hacer los mensajes de error útiles y orientados a la acción.
- Simplificar descripciones en el menú de ajustes.

### R3. Preservar Lógica de Negocio
ESTÁ ESTRICTAMENTE PROHIBIDO modificar la lógica de programación subyacente (Promesas, Fetch, Web Workers, IndexedDB, condicionales). Solo modificar strings, `innerHTML`, tooltips y CSS.

### R4. Formato de Salida
El equipo debe generar un reporte final que contenga strictly:
1. Auditoría visual y reformateo CSS.
2. Diccionario de traducción (Tabla: Ubicación | Texto Original | Nuevo Texto).
3. Código JavaScript actualizado (Solo bloques modificados, marcados con `// [COPY-UX]` o `// [UI-CSS]`).
4. Dictamen de confort clínico.

## Acceptance Criteria

El equipo utilizará un esquema de validación independiente (agent-as-judge). Un subagente independiente debe revisar los diffs del código para garantizar que:

### Integridad de Lógica
- [ ] Ningún cambio en las llamadas a API (Fetch, GM_xmlhttpRequest), Promesas, Web Workers o IndexedDB.
- [ ] Ningún cambio en la lógica condicional (`if/else`, iteraciones).

### UI/UX y Textos
- [ ] Todo el texto inyectado en el DOM tiene un `font-size` igual o mayor a 12px.
- [ ] No existen palabras de jerga técnica ("API", "JSON", "WORKER_PANIC", etc.) en los strings modificados.
- [ ] Los colores de alerta han sido suavizados y cumplen con WCAG.

### Formato de Entrega
- [ ] El reporte final incluye las 4 secciones solicitadas por el usuario.
- [ ] Los bloques de código JS proporcionados en el reporte están aislados y debidamente comentados.
