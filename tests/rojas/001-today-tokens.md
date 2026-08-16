# Prueba Roja 001 — `todayTokens` sin aserciones directas en `suite_03`

- **Qué está mal:** `suite_03_excel_pym.js` declara `todayTokens` en su array `cubre: [...]`, pero ninguna prueba de la suite invoca `c.api.todayTokens()` ni comprueba el contenido de los tokens generados. Si `todayTokens()` se muta para devolver `[]` incondicionalmente, `suite_03` permanece completamente en verde (sobrevive a la mutación).
- **Cómo reproducirlo:**
  ```bash
  node -e "const { cargar } = require('./tests/harness.js'); const c = cargar({ silencioso: true, scriptSource: require('fs').readFileSync('vigilante_agenda.user.js', 'utf8').replace('function todayTokens() {', 'function todayTokens() { return [];') }); const s03 = require('./tests/suite_03_excel_pym.js'); s03.pruebas({ caso(d,fn){ fn(); }, casoAsync(d,fn){ return fn(); }, cierto(v,m){ if(!v) throw new Error(m); }, igual(a,b,m){ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(m); }, falso(){}, lanza(){}, noLanza(){} }, c.api, c.env, () => c).then(() => console.log('SUITE 03 SIGUE VERDE TRAS MUTAR todayTokens A []'));"
  ```
  Salida:
  ```
  SUITE 03 SIGUE VERDE TRAS MUTAR todayTokens A []
  ```
- **Qué línea de producción la pone verde:** La función de producción `todayTokens` en `vigilante_agenda.user.js` (línea 5746) ya genera los tokens; lo que faltaba era la prueba que ejerce y aserta la función directamente. La prueba roja `tests/rojas/001-today-tokens.js` pasa de inmediato contra el código correcto y falla si `todayTokens()` no genera tokens.
- **Consecuencia clínica:** Bajo riesgo inmediato directo ya que `esNombreDeHoy` valida nombres con formato estándar, pero si una actualización desconfigura los formatos de nombres de SharePoint del día ("15 de agosto", etc.), el robot no cargaría la base PyM diaria sin alertar del fallo específico de tokenización. Triage: Backlog de mejoras.
