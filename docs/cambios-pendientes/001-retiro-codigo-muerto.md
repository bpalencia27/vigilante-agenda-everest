# Orden de Cambio 001 — Retiro de Funciones Muertas en `vigilante_agenda.user.js`

> **Destinatario:** Tronco (`feat/motor-portado`)  
> **Motivo:** Código huérfano sin llamadores de producción, verificado por análisis AST y grafo BFS.

---

## 1. Justificación

La auditoría de Forma 2 (Código en Sombra) identificó 8 funciones de deuda muerta que no tienen ningún llamador de producción ni están encoladas para integración futura:

1. `_conductaBuscarYAgregarExamen` (L1239): Intento antiguo de búsqueda y clic en `<li>` de la conducta. Inerte.
2. `apiDigiturnoFinalizarTicket` (L10605): Endpoint de escritura hacia `ApiIntegracionEverestDigiturno`. No se llama desde ningún flujo.
3. `apiHcValidacionExamenCronicos` (L10690): Segunda vía de red abandonada; Everest ya obtiene la tabla por interceptor.
4. `_demograficosInvalidar` (L10855): Invalidador de caché demográfica huérfano.
5. `_atheneaIdPaciente` (L1575): Helper de extracción de ID sin llamadores.
6. `_pesoDeSignosVitales` (L10832): Extractor de peso sin llamadores en producción.
7. `migrarEsquemaVgl` (L4057): Migrador de esquemas legacy de versiones v11.
8. `debounceVgl` (L3888): Utilidad genérica de rebote sin llamadores.

---

## 2. Diff Propuesto

```diff
-  function _conductaBuscarYAgregarExamen(nombreAnalito) { ... }
-  function apiDigiturnoFinalizarTicket(ticketId) { ... }
-  function apiHcValidacionExamenCronicos(pacienteId) { ... }
-  function _demograficosInvalidar() { ... }
-  function _atheneaIdPaciente(texto) { ... }
-  function _pesoDeSignosVitales(signos) { ... }
-  function migrarEsquemaVgl() { ... }
-  function debounceVgl(fn, ms) { ... }
```

---

## 3. Riesgo y Mitigación

- **Riesgo:** Cero impacto en runtime (0 referencias en producción).
- **Pruebas existentes:** El runner y las suites seguirán completando al 100% de éxito.
- **Acción requerida:** El tronco debe eliminar estas declaraciones y actualizar `tests/harness.js` y las declaraciones correspondientes en arrays `cubre` si aplicaba.
