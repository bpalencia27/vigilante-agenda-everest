---
name: tampermonkey_angular_injection
description: Cheatsheet on how to automatically inject data into Angular Single Page Applications (SPA) using Tampermonkey by simulating user events.
---

# Tampermonkey Angular Injection

Cuando necesites auto-llenar campos en una aplicación Angular (como Everest) usando Tampermonkey, ten en cuenta las siguientes reglas:

1. **No uses solo `.value`**:
   Hacer `input.value = "texto";` cambiará el valor visualmente en el navegador, pero no actualizará el modelo interno de Angular (`ngModel` o `formControl`). Si el usuario guarda el formulario, tus datos se perderán.

2. **Despacha Eventos `input` y `change`**:
   Debes despachar estos eventos manualmente justo después de establecer el valor, para forzar a Angular a detectar el cambio y actualizar su estado interno:
   ```javascript
   function setNgValue(inputEl, value) {
       if (!inputEl) return;
       inputEl.value = value;
       inputEl.dispatchEvent(new Event('input', { bubbles: true }));
       inputEl.dispatchEvent(new Event('change', { bubbles: true }));
   }
   ```

3. **Peticiones Cross-Origin (CORS)**:
   Si tu script necesita traer datos de otro dominio (por ejemplo, extraer datos de un portal de laboratorios e inyectarlos en el EHR), la API `fetch` estándar fallará por CORS.
   En su lugar, usa `GM_xmlhttpRequest`, la cual bypassa las políticas de CORS. Asegúrate de declarar los dominios y permisos en las cabeceras de Tampermonkey:
   ```javascript
   // @match        *://dominio-destino.com/*
   // @connect      dominio-origen.com
   // @grant        GM_xmlhttpRequest
   ```
