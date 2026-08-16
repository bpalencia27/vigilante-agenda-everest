# Contrato para Generación de Pruebas de Conformidad Clínica

> **Destinatarios:** Satélite S2 (Banco de Pruebas) y Tronco.  
> **Objetivo:** Reglas formales para transformar la especificación clínica (`ESPECIFICACION_CLINICA.json` y `DISCREPANCIAS.json`) en aserciones automatizadas ejecutables en Node.js.

---

## 1. Reglas de Generación de Pruebas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. ELEMENTO VERIFICADO  ──> Genera prueba de conformidad (ASERCION VERDE)    │
│ 2. ELEMENTO DISCREPANTE ──> Genera prueba roja en tests/rojas/ (FALLO ROJO) │
│ 3. ELEMENTO SIN VERIFICAR ──> PROHIBIDO GENERAR PRUEBA                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Elementos `VERIFICADO`:**
   - Se crea una aserción estricta (`t.igual(api.cupsEscritura("HBA1C"), "903426")`).
   - El objetivo es actuar como una red inmutable: si una futura edición altera un solo dígito de un código CUPS verificado, el banco de pruebas cae de inmediato.
2. **Elementos `DISCREPANTE`:**
   - Se deposita una prueba ejecutable en `tests/rojas/NNN-discrepancia.js`.
   - La prueba debe fallar con código 1 hoy, documentando la discrepancia, y pasar a verde únicamente cuando el tronco integre la corrección aprobada.
3. **Elementos `SIN VERIFICAR`:**
   - Está terminantemente prohibido escribir aserciones sobre supuestos no validados. Casilla vacía antes que aserción inventada.

---

## 2. Protocolo de Detección de Divergencias

Si en una ejecución futura el userscript `vigilante_agenda.user.js` diverge de los valores fijados en `ESPECIFICACION_CLINICA.json`:
1. `suite_43_conformidad_cruzada.js` y las suites clínicas (`suite_27`, `suite_28`, `suite_30b`) fallarán con mensaje explícito:
   ```
   FALLO DE CONFORMIDAD CLÍNICA: Se esperaba CUPS 903426 para HbA1c y se obtuvo 904426.
   ```
2. La compuerta de CI bloqueará el despliegue a producción hasta que:
   - (a) Se restaure el valor conforme a la especificación firmada, o
   - (b) El médico responsable firme una nueva adenda a `ESPECIFICACION_CLINICA.md`.
