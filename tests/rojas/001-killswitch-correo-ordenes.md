# Hallazgo Rojo 001: Ausencia de Guarda Kill-Switch en `apiEnviarOrdenPorCorreo`

## 1. Qué está mal en una frase
La función `apiEnviarOrdenPorCorreo` (L13307) no verifica `state.killed`, permitiendo que se envíen órdenes médicas por correo electrónico al exterior aun cuando la pausa de seguridad remota del asistente está activa.

## 2. Cómo reproducirlo
### Comando Exacto
```bash
node tests/rojas/001-killswitch-correo-ordenes.js
```

### Salida Verbatim del Fallo
```
FAIL: apiEnviarOrdenPorCorreo disparó petición HTTP con el Kill-Switch activo.
```
*(Código de salida: 1)*

## 3. Qué línea de producción la pondría verde
En `vigilante_agenda.user.js` (L13307), agregar la comprobación de `state.killed` al inicio de `apiEnviarOrdenPorCorreo`:
```javascript
  async function apiEnviarOrdenPorCorreo(agrupador, correo, usuarioId) {
    if (state.killed) return false;
    try {
      const f = FETCH0 || window.fetch;
      ...
```

## 4. Consecuencia Clínica
Si se activa una emergencia de seguridad (por ejemplo, detección de discrepancias en identificadores de pacientes, certificados comprometidos o fallos de integridad), la red remota pone en pausa el userscript (`state.killed = true`). Si el médico pulsa "Enviar" en el modal de órdenes, el script no aborta y despacha el correo a través de la API institucional `EnviarEmailOrdenamiento`. Esto rompe la garantía de contención total de la pausa de seguridad remota.
