# Orden de Cambio 002 — Poda de Declaraciones Redundantes en Arrays `cubre`

> **Destinatario:** Tronco / Satélite S2 (Banco de Pruebas)  
> **Motivo:** Evitar inflación de cobertura y reportes falsos de funciones no ejercitadas directamente en cada suite.

---

## 1. Justificación

El análisis de Forma 5 e inventario de los 56 nombres identificó declaraciones redundantes en los arrays `cubre: [...]` de tres suites:

1. **`tests/suite_04_agenda_alertas.js`:** Declara 21 funciones de canales de notificación (`beep`, `playTone`, `startNag`, `stopNag`, `faviconUrl`, `setFavicon`, `startFlash`, `stopFlash`, `popupAlert`, `bigAlert`, `acknowledge`, `pymAlert`, `abandonoPESAlert`, `colorDot`, `osNotify`, `_renderToast`, `showToast`, `notify`, `updateBell`, `testNotifications`, `enableOsNotifications`). Todas ellas cuentan ya con su propia suite dedicada: `tests/suite_42_canales_de_aviso.js`. Mantenerlas en `suite_04` genera ruido en el Proxy de cobertura.
2. **`tests/suite_32_correccion_clinica_dom.js`:** Declara `_marcarUroanalisisSi`, `evaluarDiscordanciaTFG`, `elapsedMin`, `diaNuevo`, `_findLabField`, `_findUroInput` y `_conductaBuscarYAgregarExamen` sin invocarlas directamente en esta suite (están cubiertas en suites 08, 27, 02 y 34).
3. **`tests/suite_34_cobertura_alto_riesgo_mutantes.js`:** Declara `_marcarUroanalisisSi` sin llamarla directamente (cubierta en suite 08).

---

## 2. Diff Propuesto

### En `tests/suite_04_agenda_alertas.js`
```diff
   cubre: [
     "colorAndAlert", "muted", "muteFor", "unmute", "checkAbandonoPES",
     "crossTabDup", "avisoYaVisto", "avisoMarcarVisto", "nkey",
     "maybeNotify", "checkRecordatorioPym", "labsVencidosAlert",
     "checkLabsVencidos", "otroAvisoDePacienteAbierto",
     "_encolarAvisoPendiente", "_flushAvisosPendientes",
     "_dispararAvisoReal", "_siembraCompartidaLeer",
     "_siembraCompartidaGuardar", "_sembrarEstadoInicial"
-    // Retiradas las 21 funciones de canales de notificación (gestionadas en suite_42)
   ],
```

### En `tests/suite_32_correccion_clinica_dom.js`
```diff
   cubre: [
     "calcularEstadioRenal",
     "pymCubiertoPorOrdenVigente",
     "injectLabsIntoCronicos",
     "esFestivo"
-    // Retiradas: "_marcarUroanalisisSi", "_conductaBuscarYAgregarExamen", "evaluarDiscordanciaTFG", "elapsedMin", "diaNuevo", "_findLabField", "_findUroInput"
   ],
```

### En `tests/suite_34_cobertura_alto_riesgo_mutantes.js`
```diff
-    "_marcarUroanalisisSi",
```

---

## 3. Impacto y Verificación

- **Impacto:** Ningún cambio en el código de producción `vigilante_agenda.user.js`.
- **Porcentaje de Cobertura:** La cobertura real no disminuye, ya que todas las funciones legítimas continúan cubiertas en sus suites principales (`suite_42`, `suite_08`, `suite_27`, etc.).
- **Limpieza de Señal:** Elimina los 25 avisos del runner sobre funciones declaradas en `cubre` pero no invocadas en tiempo de ejecución.
