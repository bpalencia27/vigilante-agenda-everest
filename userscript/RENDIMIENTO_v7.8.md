# Vigilante de Agenda v7.8.0 — informe de rendimiento

## El problema

En los equipos lentos de la sede, el navegador se congelaba (todas las pestañas) mientras
cargaba Everest con el Vigilante instalado. La vigilancia en sí es ligera; el peso estaba
en la **tubería del PyM**, que corría entera en el hilo principal de la página.

## Medición (banco de pruebas con réplicas exactas)

Se construyeron réplicas sintéticas con el esquema real del `Agenda_Dia_CMB` (38 columnas,
vocabulario "Susceptible / No aplica / Tamizado / Tamizar con…"): una de 2,0 MB (agenda del
día, 13.000 filas) y una de 13,7 MB (base piloto, 90.000 filas — la hoja infla a **110 MB de
XML** al descomprimirse). Las funciones del script se ejecutaron tal cual en Node 22 (mismo
motor V8 de Chrome/Edge). Cifras en CPU de servidor; un PC de consultorio es 4–8× peor.

| Métrica (base piloto 13,7 MB) | v7.7.1 | v7.8.0 |
|---|---|---|
| Peor bloqueo único del hilo | **2.830 ms** | **162 ms** |
| Tiempo total con el hilo bloqueado | **6,0 s** | **0,38 s** |
| Pico de memoria (RSS) | **511 MB** | **244 MB** |
| Tamaño de la caché diaria | **10,8 MB** (a 1 MB del tope que la descartaba en silencio) | **2,8 MB** |
| Boot de cada pestaña (leer caché) | 340 ms síncronos en plena carga | por tandas, en tiempo libre del navegador |
| Resultado del indexado | — | **idéntico byte a byte** al anterior |

Además existía un **acantilado silencioso**: si la caché serializada superaba 12 MB se
descartaba sin avisar (`telError` es un tapón vacío) y el equipo re-descargaba y re-procesaba
los ~14 MB **en cada recarga**, todo el día — el peor caso de congelamiento repetido.

## Qué cambió (v7.8.0)

1. **Streaming + fusión de parseo e indexado** (`readPymWorkbookStream`): la hoja se
   descomprime por trozos y cada fila se parsea, se indexa y se descarta. Nunca existen el
   string de 110 MB ni el arreglo de 90.000 filas. `sharedStrings` también va en streaming.
2. **Cesión del hilo por presupuesto de tiempo** (`makeYielder`): cada ~15 ms medidos se
   devuelve el control al navegador vía `MessageChannel` (sin el recorte de 4 ms de
   `setTimeout`). Autoadaptativo: un PC lento cede más seguido él solo.
3. **Caché compacta v3 con diccionario de etiquetas** (`packPym`/`unpackPym`): ~4× más
   pequeña. El tope de 12 MB queda lejísimos y, si algún día se alcanzara, **avisa**.
4. **Boot diferido**: la caché se desempaqueta con `requestIdleCallback`, por tandas —
   la página de Everest termina de cargar primero.
5. **Conexión SharePoint reparada**: la sesión vencida redirige a
   `login.microsoftonline.com`/`*.svc.ms`, dominios que no estaban en `@connect`;
   Tampermonkey cortaba ahí con el mensaje engañoso "no dejó salir la conexión". Se
   añadieron los dominios, el diagnóstico ahora es veraz y hay botón **«Abrir SharePoint»**
   en Ajustes (el captador de esa pestaña baja el PyM con la sesión propia y lo comparte).

## Qué NO cambió (garantías)

- El flujo del PyM es el mismo: **primero el PyM real de HOY en SharePoint** (solo acepta
  archivo con la fecha de hoy en el nombre — uno de ayer jamás se carga), re-chequeo cada
  10 minutos, **base piloto como respaldo** mientras tanto, y «Abrir PyM» manual siempre
  puede reemplazar. Alertas, fraude, tablero, recordatorios: intactos.
- Verificación de equivalencia automatizada: el índice que produce el lector nuevo es
  **idéntico** al del viejo en todos los casos de prueba (libro multi-hoja con hoja señuelo,
  encabezado en fila 4, celdas `inlineStr`, huecos de celdas, cédulas con ceros a la
  izquierda y en notación científica, exclusiones VDRL/hepatitis con VIH conservado, CSV).

## Publicación

Pegar `userscript/vigilante_agenda.user.js` completo en el Gist
(https://gist.github.com/bpalencia27/d231aab6f54de51a5c472b392aac1b91), "Update secret
gist". Tampermonkey actualizará cada equipo solo (@version 7.8.0 > 7.7.1).
