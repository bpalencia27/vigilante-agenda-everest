/*
  VIGILANTE Version Check — Endpoint de versión mínima requerida (v7.8.1)
  Devuelve JSON con minVersion que empuja el auto-update en los equipos.

  QUÉ HACE DE VERDAD (para no confundirlo con el propio auto-update de
  Tampermonkey): este endpoint NO descarga ni instala nada. El userscript lo
  consulta cada 5 minutos (checkVersionMinimum en vigilante_agenda.user.js) y
  compara SU VERSION contra minVersion de aquí. Si está atrasado (o force=true),
  y no hay una historia clínica abierta, hace location.reload() — eso solo
  vuelve a ejecutar lo que Tampermonkey YA tenga descargado del Gist en ese
  equipo. La descarga real del código nuevo sigue siendo cosa de Tampermonkey
  (su propio chequeo en segundo plano contra @updateURL/@downloadURL, o
  "Check for userscript updates" a mano). Este endpoint solo sirve para dos
  cosas: (1) apurar que una pestaña ya actualizada por Tampermonkey recargue
  pronto en vez de seguir corriendo la versión vieja en memoria, y (2)
  mostrar un aviso pidiendo el chequeo manual cuando no puede recargar sola
  (bucle anti-recarga ya cubierto en el propio userscript).

  Súbelo (MIN_VERSION) cada vez que quieras empujar una actualización real a
  toda la flota en vez de esperar el ciclo propio de cada Tampermonkey.
*/

const MIN_VERSION = "12.5.9";  // ← CAMBIA ESTO para futuras actualizaciones críticas
const FORCE = false;           // ← true = todos auto-reload incluso si están al día

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      minVersion: MIN_VERSION,
      force: FORCE,
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
