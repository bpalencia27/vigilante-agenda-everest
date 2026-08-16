# Hallazgo Rojo 002: Ausencia de Guarda Kill-Switch en `apiLaboratorioAgendarAuto` y SMS de AppCita

## 1. Qué está mal en una frase
La función `apiLaboratorioAgendarAuto` (L10484) no verifica `state.killed`, permitiendo que se creen citas de toma de muestras en la API de AppCita y se envíen SMS reales a los pacientes aun cuando la pausa de seguridad remota del asistente está activa.

## 2. Cómo reproducirlo
### Comando Exacto
```bash
node tests/rojas/002-killswitch-agendar-laboratorio-sms.js
```

### Salida Verbatim del Fallo
```
FAIL: apiLaboratorioAgendarAuto disparó petición (https://appcita.viva1a.com.co:8051/apiLaboratorioV2/api/Agendamiento/AgendarCita?sedeId=378&Identificacion=12345678&AgendaId=100&NombrePaciente=%20&Telefono=3001234567&Correo=&Hora=07%3A00&FechaCita=2026-09-01&generaImpresion=false&LugarCreacion=Vigilante) con el Kill-Switch activo.
```
*(Código de salida: 1)*

## 3. Qué línea de producción la pondría verde
En `vigilante_agenda.user.js` (L10484), agregar la comprobación de `state.killed` al inicio de `apiLaboratorioAgendarAuto`:
```javascript
  async function apiLaboratorioAgendarAuto(docId, fechaIso, horaSeleccionada, celular) {
    if (state.killed) return false;
    try {
      const urlTurnos = ...
```

## 4. Consecuencia Clínica
Si se activa una pausa de seguridad remota por un incidente clínico crítico (ej. divergencia de identificadores o fallo en rangos biológicos), el asistente debe suspender el 100% de sus acciones de mutación. Al no comprobar `state.killed`, un clic o flujo de toma de muestras en el modal continuará creando citas en AppCita y enviando mensajes de texto SMS a teléfonos celulares reales de pacientes, violando la contención de seguridad.
