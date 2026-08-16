# Inventario de Fuentes Clínicas y Normativas Oficiales

> **Columna S4 (Verificación Clínica Documental)**  
> **Fecha:** 15 de agosto de 2026  
> **Directiva Estricta:** Queda prohibido validar códigos o umbrales de memoria. Solo se consideran documentos físicos o digitales aportados por el médico responsable.

---

## 1. Documentos Presentes en el Repositorio

Actualmente el directorio `docs/fuentes/` no contiene archivos binarios primarios cargados por el usuario. Por tanto, conforme a la regla del proyecto (*"casilla vacía antes que dato inventado"*), todos los elementos pendientes de contraste formal se catalogan como `SIN VERIFICAR` hasta que el usuario aporte los documentos oficiales correspondientes.

---

## 2. Fuentes Indirectas y Evidencia Empírica de Consultorio

Las siguientes fuentes de evidencia empírica en producción respaldan la implementación actual mientras se incorporan los PDF oficiales:

1. **Orden Real Guardada en Everest (`ObtenerOrdenamientoPorPacienteIdVigente`):**
   - Respalda el CUPS `903426` para *Hemoglobina Glicosilada Automatizada*.
2. **Captura DOM en Consulta Real (10/08/2026):**
   - Respalda el selector `resultadoRelacionAlbuminaCreatinina` para la relación Albúmina/Creatinina en orina (mg/g) y el descarte de `resultadoMicroAlbuminuriaCreatinuria`.
3. **Tabla 50 de la Guía de Manejo Everest RCV:**
   - Respalda la matriz de vigencias por estadio de Nefroprotección ERC (vigencia de LDL en E4 a 120 días).
4. **Ley 51 de 1983 (República de Colombia):**
   - Respalda el algoritmo de traslado de días festivos al siguiente lunes (Ley Emiliani).
