# Banco de pruebas del Vigilante

Estado actual: **1 suite escrita de 6**. La infraestructura está terminada y probada.

## Cómo ejecutarlo

Solo hace falta Node (ya lo tienes instalado). Desde la carpeta del proyecto:

```
node tests/runner.js
```

Para ejecutar una sola suite:

```
node tests/runner.js texto
```

El ejecutor imprime cuántas comprobaciones pasan, cuáles fallan y **qué funciones siguen sin cubrir**. Devuelve código de salida 1 si algo falla, así que sirve tal cual para un hook de git o para CI.

## Qué hay hecho

| Archivo | Qué es | Estado |
|---|---|---|
| `harness.js` | Cargador: simula el navegador y publica las funciones internas | ✅ terminado |
| `runner.js` | Ejecutor y reporte de cobertura | ✅ terminado |
| `suite_01_texto_datos.js` | Normalización de texto y datos del paciente | ✅ 41 comprobaciones |
| `suite_02_tiempo_fechas.js` | Horas, fechas hábiles, bitácora | ✅ 17 comprobaciones |
| `suite_03_excel_pym.js` | Lector de Excel, caché, SharePoint | ✅ 16 comprobaciones |
| `suite_04_agenda_alertas.js` | Colores, extemporáneas, notificaciones | ✅ 9 comprobaciones |
| `suite_05_api_everest.js` | Llamadas a Everest, laboratorios, órdenes | ⬜ pendiente |
| `suite_06_interfaz.js` | Panel, ajustes, modales | ⬜ pendiente |


## Lo importante del cargador

El userscript es un único IIFE: sus 273 funciones son privadas. `harness.js` **no modifica el archivo de producción**; lo lee, le añade en memoria una línea que publica las funciones, y lo ejecuta en un navegador simulado.

Para que la carga llegue al final sin efectos secundarios:

- `window.top === window.self` → no sale por el guard de los frames
- `hostname = neps.everestintelligent.com` → no entra en la rama de Athenea ni en la de SharePoint
- `document.readyState = "loading"` → `boot()` queda registrado en `DOMContentLoaded` y **nunca se ejecuta**, así no se construye la interfaz

Alcanzables: **239 de 273**. Las no alcanzables están anidadas dentro de otras funciones (por ejemplo `cargarHoras` y `renderDayChips`, dentro del modal de agendamiento) y solo se pueden probar a través de su función madre.

## Cómo escribir una suite nueva

Copia la estructura de `suite_01_texto_datos.js`:

```js
module.exports = {
  nombre: "Lo que cubre esta suite",
  cubre: ["funcionA", "funcionB"],        // para el cálculo de cobertura
  pruebas(t, api, env, cargar) {
    t.caso("descripción de lo que se espera", () => {
      t.igual(api.funcionA("entrada"), "salida esperada");
    });
  },
};
```

Ayudas disponibles en `t`: `caso`, `casoAsync`, `igual`, `cierto`, `falso`, `lanza`, `noLanza`.

Argumentos que recibes:

- `api` — las funciones del userscript, más las constantes `__S` (ajustes), `__CONFIG`, `__state`, `__WHITELIST`, `__PYM_CATALOG`, `__COLORS`, `__FRIENDLY`
- `env` — el entorno simulado: `env.storage` (localStorage), `env.gm` (almacén de Tampermonkey), `env.doc`, `env.win`
- `cargar` — para crear un entorno **limpio** cuando una prueba necesite aislamiento, o inyectar respuestas de red:

```js
const otro = cargar({ fetch: async () => ({ ok: true, status: 200, json: async () => ({ data: { radicado: 123 } }) }) });
```

## Regla de oro

Los casos se construyen **a partir de las capturas reales**, no inventando datos. En la carpeta del proyecto están:

- `captura_agendamiento_oficial_20260810.json` — flujo de agendar una cita
- `captura_ordenamiento_nativo_20260810.json` — flujo de crear una orden
- `campos_cronicos_verificados_20260810.txt` — los 64 campos de la Ruta de Crónicos
- `everest_telemetry_PRO_*.json` — 26 sesiones anteriores

Una prueba que use una respuesta real detecta cambios en Everest; una con datos inventados solo confirma lo que ya creíamos.

## Prioridad sugerida

Si hay que elegir por dónde seguir, estas son las funciones donde un fallo tiene consecuencia clínica directa:

1. `parseHoraMin` y `elapsedMin` — detección de atenciones extemporáneas
2. `colorAndAlert` — el semáforo de la agenda
3. `_matchLabInWhitelist` — aquí estaba el cruce triglicéridos/RAC
4. `extractPatientId` — identidad del paciente
5. `makeIndexer` — cruce del PyM con la agenda
6. `apiOrdenamientoGuardar` y `apiAccesoAsignarTurno` — las dos escrituras clínicas
