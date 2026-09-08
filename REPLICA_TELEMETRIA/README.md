# REPLICA_TELEMETRIA — la telemetría fuera de Google Apps Script (ORDEN #7)

Réplica **contractual** del backend de telemetría del Vigilante de Agenda
(`TABLERO/Codigo.gs` + `TABLERO/VersionCheck.gs` del checkout principal) en
**Cloudflare Workers + D1**, gratis, sin cuota diaria de Apps Script y sin
dependencia del ecosistema Google.

Para el userscript **no hay ninguna diferencia visible**: misma URL de envío
con el mismo contrato de acuses. El cliente no necesita ningún cambio para
convivir con este backend — el cambio de apuntador (cableado) es lo único que
queda para el día en que el médico decida migrar (§4).

```
worker.js        → el backend completo en un archivo (doPost + listaAcceso + /vcheck)
schema.sql       → tablas D1 (espejo de las hojas del tablero + dedup de lotes)
wrangler.toml    → config de despliegue (rellenar database_id tras d1 create)
test_replica.mjs → banco local 51/51: SQLite real en memoria, sin red, sin cuenta
package.json     → { "type": "module" } para que node importe worker.js; npm test
```

## 1. El contrato replicado (verificado contra Codigo.gs, L224-364)

| Petición | Respuesta | Semántica para el cliente |
|---|---|---|
| POST con token y evento válidos | `ok` | fila escrita |
| POST con lote ya recibido | `dup` | **entrega buena** (el cliente deja de reintentar) |
| Token malo, evento desconocido, cuerpo ilegible, método raro | `no` | rechazo |
| Fallo interno de escritura | `err` | reintentable: **el lote no queda quemado** |

Los acuses son **texto plano exacto**: el userscript tiene una lista blanca
estricta (`ok`/`dup`/`no`/`err`) y una respuesta HTML no cuenta como recibido.

Eventos aceptados (los mismos 8): `ux`, `resumen`, `fraude`, `prueba`, `error`,
`entorno`, `acceso`, `acceso_deneg`. Cada uno escribe su tabla con las mismas
columnas que su hoja (`uso`, `uso_detalle`, `resumen`, `fraude`, `error`,
`entorno`, `acceso_uid`, `acceso_deneg`, `prueba`).

Saneos **idénticos** al GAS — el servidor jamás confía en el emisor:
- claves de `acciones` re-filtradas (lowercase, tiras de 6+ dígitos fuera,
  caracteres fuera de `[a-z0-9.:_-]`, tope 120 claves + `_recortadas`), valores
  forzados a número, **total recalculado en el servidor** (el `n` del cliente
  se ignora);
- `acceso_deneg` igual con tope 32 + `_recortadas`;
- barrera PHI `_sinDigitosLargos` en `error` (msg/donde/migas) y en el nombre
  del evento `acceso`: URL → `<url>`, toda tira de 6+ dígitos y toda cédula
  formateada **fuera**, comillas fuera;
- `acceso_uid.uid` y `fraude.min` se fuerzan a número; `hora`/`deDia`/`nav`/`so`/
  `zona`/`pantalla`/`gestor` quedan como texto (verificado campo por campo
  contra Codigo.gs L273-344);
- longitudes recortadas como en el GAS (p. ej. `acciones` a 4000, `cuentas` a
  400, `origen` a 12).

GETs:
- `?accion=listaAcceso&token=…` → texto plano con JSON `{ok, version: "v"+djb2,
  emitida, perfiles:{COMPLETO, LABORATORIOS}, blocklist}` — normaliza perfil a
  mayúsculas, salta `#…`, manda a blocklist los estados `bloqueado`/`inactivo`,
  caps en minúsculas separadas por coma, y deriva uid sintético
  `900000000 + djb2(nombre) % 99999999` cuando la fila no trae uid.
- `/vcheck` → réplica byte a byte del JSON de `VersionCheck.gs` (minVersion
  18.0.142, force, killSwitch, canary, expectedSha256). **Editar las
  constantes en `VCHECK` de worker.js** cuando haya que empujar una versión.

## 2. Mejoras deliberadas (documentadas, no silenciosas)

1. **Dedup PERMANENTE por lote.** El GAS deduplicaba con CacheService (TTL 6 h);
   la auditoría del 07-sep midió **54 % de filas duplicadas** por reenvíos
   dentro de la ventana de caché. Aquí el lote vive en una tabla con UNIQUE
   para siempre: el primer "dup" del cliente es el último. El lote es único por
   encolado en el cliente (jamás se reutiliza), así que un "dup" permanente no
   puede tragarse una fila legítima.
2. **Versiones y fechas como texto puro.** Sheets auto-convierte "18.6.1" en
   fecha (el defecto que obligó al apóstrofo `_celdaVersion`); D1 guarda lo que
   se le da. El apóstrofo del GAS desaparece por innecesario.
3. **`err` sin lote quemado con compensación activa**: si la escritura de la
   fila falla, el worker borra el registro del lote y responde `err` — el
   reintento del cliente entra limpio (verificado por mutación M2).

## 3. Pruebas locales (lo que se verificó antes de commitear)

```
cd REPLICA_TELEMETRIA
node test_replica.mjs        → 51/51, EXIT 0   (o: npm test)
```

El banco corre el worker REAL contra SQLite real en memoria (`node:sqlite`,
mismas restricciones UNIQUE que D1) y ejercita: acuses exactos, dedup por lote
(caso 1) y su no-falsedad con lotes distintos (caso 4), los 8 eventos con sus
saneos campo por campo, la barrera PHI sobre `error`, listaAcceso con
perfiles/blocklist/uid sintético/versión estable, `/vcheck`, y el caso más fino
del contrato: **fallo de escritura → `err` → el lote NO queda quemado → el
reintento del mismo lote entra `ok`** (caso 12, con DROP+CREATE de la tabla a
mitad de banco).

Mutaciones verificadas (mismo rigor que el repo): **M1** — quitar la
comprobación del dedup → el caso 1 se pone rojo; **M2** — quitar la
compensación del lote → el caso 12 se pone rojo. Ambas restauradas; el banco
sano vuelve a 51/51.

> El banco local NO entra en `node tests/runner.js` del repo (ese runner solo
> descubre `tests/suite_*.js`): es un entorno distinto (simula Cloudflare, no
> el userscript) y corre con su propio `npm test`.

## 4. Cómo se despliega y qué falta para la migración total

Despliegue (requiere la cuenta Cloudflare del médico — es el único paso que no
puedo hacer yo):
1. `wrangler login`
2. `wrangler d1 create vigilante-telemetria` → copiar el id a
   `database_id` en `wrangler.toml`
3. `wrangler d1 execute vigilante-telemetria --remote --file=schema.sql`
4. `wrangler deploy`
5. Probar con curl (acuse `ok` y luego `dup` en la misma URL) y rellenar la
   tabla `acceso` con el padrón (INSERTs, como la hoja del GAS) para que
   `listaAcceso` responda lo mismo que hoy.

**El cableado de la flota es post-despliegue y decisión del médico.** Cuando
toque, son 5 puntos en `vigilante_agenda.user.js`, todos localizados:
1. `TABLERO.url` (L~13203) → la URL del worker (`https://vigilante-telemetria.
   <subdominio>.workers.dev/` o dominio propio).
2. `repDiagnostico()` — valida la URL contra `/^https:\/\/script\.google\.com\//`;
   ampliar el regex al dominio del worker.
3. `versionCheckUrl` (L~10857) → `…/vcheck`.
4. Encabezado `// @connect` → añadir el dominio del worker junto a
   script.google.com.
5. Decidir el destino del tablero Google Sheets histórico (exportar D1 →
   Sheets, o dejar el GAS en paralelo un tiempo).

Hasta entonces: **el GAS sigue siendo el backend en vivo y la flota no nota
nada** — esta carpeta es la réplica probada, lista para desplegar.
