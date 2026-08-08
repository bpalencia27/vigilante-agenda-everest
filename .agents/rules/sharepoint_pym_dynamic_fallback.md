# Regla: Respaldo Dinámico y Conmutación Eficiente de Base PyM desde SharePoint

## Principios Invariables:
1. **Eficiencia Extrema de CPU, RAM y Red:**
   - **Metadatos Ligeros:** El sondeo periódico de SharePoint NUNCA debe descargar archivos completos a menos que se confirme la existencia de un archivo nuevo con el nombre del día (`Agenda_Dia_CMB_YYYYMMDD.xlsx`). La verificación usa `$select=Name,ServerRelativeUrl,TimeLastModified&$top=60` (< 2 KB JSON).
   - **Sincronización Pestaña Única:** Utilizar la Web Locks API (`vgl_leader_lock`) para que sólo la pestaña líder realice las peticiones de red.
   - **Liberación de Memoria:** Los parseos de libros Excel se ejecutan en `Web Worker` dedicados que se destruyen inmediatamente tras completar la indexación (`worker.terminate()`), liberando búferes de memoria.

2. **Disponibilidad Continua de Datos (Sin Pantalla en Blanco):**
   - Si no existe el archivo del día, cargar la **Base Piloto de Respaldo** y establecer `state.pymFallback = true`.
   - Al detectar `Agenda_Dia_CMB_YYYYMMDD.xlsx`, conmutar automáticamente en segundo plano, actualizar la caché `vgl_pym`, establecer `state.pymFallback = false` y emitir una notificación Toast azul (`📋 Ya llegó el PyM real de hoy`).
