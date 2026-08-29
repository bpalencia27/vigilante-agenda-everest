# Decisiones pendientes del médico — auditoría de ambigüedades del 20-ago-2026

Este documento reúne las 18 decisiones que el código tomó por usted sin preguntarle, encontradas
en la auditoría exhaustiva que pidió, más el estado de la telemetría. Las 8 más urgentes se las
pregunto en la entrevista de hoy; las demás quedan aquí con mi recomendación para que las
responda cuando quiera — con responder en el chat "del documento, la 11: opción b" basta.

Las que ya respondió en la entrevista del 20-ago quedan marcadas.

---

## Bloque A — Criterio clínico (las que cambian conductas)

**1. [RESUELTA, v17.6.95] Dos varas para "vencido".** El aviso de entrada y el bloqueo "ya
cubierto por Athenea" juzgan con 180 días planos; Agendar y Riesgo usan la tabla por estadio +
su regla del 50%. Un renal G4 podía ser "ya cubierto" y "vencido" en la misma sesión.
*Estado real (verificado 28-ago contra el fuente): `_vigenciaDiasParaAnalito` (línea ~4001)
usa `mtrVigenciaDiasNorma` cuando hay contexto de estadio/programa — una sola vara en todos
los caminos, tal como recomendaba este documento. `vigenciaPorEstadio`/
`RCV_VIGENCIA_ESTADIO_TABLA` (la Tabla 50 transcrita) se conservan como documento de
referencia, con sus propias pruebas, sin ser el camino que usan los avisos.*

**2. [RESUELTA, v16.4.0] Meta de HbA1c fija en 7,0 para todos.** La individualización que el
código prometía era inalcanzable (nadie alimentaba la meta individual, y había dos claves
distintas que nunca se encontraban).
*Estado real (verificado 28-ago): una sola clave (`metaHba1c`) viaja desde la Ficha hasta
`mtrFueraDeMeta`/`mtrResumenClinico` (línea ~35699, comentario "v16.4.0 — una sola clave para
la meta de HbA1c"); sin dato guardado, usa `mtrMetaHba1cGeneral()` (7,0) de fábrica.*

**3. [RESUELTA, v17.0.0] La creatinina previa nunca se alimentaba.** Sospecha de IRA, "función
renal inestable" y remisión por caída de TFG estaban escritas, probadas… y apagadas de fábrica,
porque nadie entregaba la TFG anterior.
*Estado real (verificado 28-ago): `mtrResumenClinico` (línea ~35551) calcula `_egfrPrevioInfo`
vía `mtrEgfrPrevioDeSerie(c.seriesCreatinina, …)` cuando el llamador no trae `egfrPrevio`
explícito, y los dos llamadores reales (línea ~28114 y ~37076) sí pasan `seriesCreatinina` con
la serie real de Athenea (`mtrSeriesPorAnalito(labs, …).CREATININA`).*

**4. [RESUELTA, v16.4.0] "Fuera de meta" tenía dos definiciones.** Para acortar vigencia al
50%: estrictamente > meta. Para declarar falla terapéutica: > meta+15%. El paciente de la
franja intermedia recibía más viajes al laboratorio sin que ninguna pantalla declarara falla.
*Estado real (verificado 28-ago): `mtrFueraDeMeta` (línea ~32864, comentario "v16.4.0 — UN
SOLO UMBRAL con la falla terapéutica") usa el mismo margen (`MTR_FALLA_UMBRAL`, meta+15%) para
las dos cosas — exactamente la recomendación de este documento.*

**5. [RESUELTA, v16.9.0] La reducción ≥50% del LDL nunca se podía verificar.** El basal
ya se alimenta: `mtrLdlBasalDeSerie` toma el LDL más alto de los controles del último año y
lo inyecta a `mtrEvaluarMetaLdl`. Sin serie, la interfaz dice «reducción ≥X % no evaluable:
sin LDL previo del último año» en vez de castigar. Prueba en `suite_45`.

**6. [CERRADO, v17.15.0] El sábado tiene tres reglas distintas según el módulo.** Esta
entrada original (20-ago) recomendaba unificarlas. **Esa recomendación NO se siguió**: se
midió primero (`tools/medir_sabados.js`) y la medición la contradijo — ver «La #6 medida»
más abajo en este mismo documento. Lo que sí se cerró de la descripción original: el modelo
quincenal muerto se retiró y el 5.º sábado ya existe como «por confirmar» visible (ambos en
v16.9.0/v17.6.93). Lo que queda es DIVERGENCIA DOCUMENTADA, no deuda: no se toca.

**7. [RESUELTA, v16.9.0] La distancia toma→control era +4 días por un camino y +7 por
otro.** Objetivo único +7 en todos los caminos, ventana de toma 14–21. El "modo estable"
(citar lo más tarde posible) se retiró: con un objetivo único ya no tenía sentido.

**10. [RESUELTA, v16.9.0 / v17.0.2] El embarazo no se leía de ninguna parte.**
`mtrDebePreguntarEmbarazo` pregunta por el reconciliador (solo en mujer en edad fértil con
parcial sugestivo, como se recomendaba), con confirmación de 30 días de vigencia, consumida
por `mtrEvaluarUroanalisis`. Prueba en `suite_48`.

**12. [RESUELTA, v16.9.0] La discordancia entre las dos TFG solo alertaba con >2 estadios
de diferencia.** El umbral bajó a 2 estadios en `evaluarDiscrepanciaTFG`, con «REVISE EL
DATO» desde 3 (posible dato corrupto, no paciente). Prueba en `suite_27`.

**13. [PREGUNTADA HOY] Fuera de 40–79 años la escala ASCVD clasifica por extrapolación.** El
propio código lo declara "no validado"… y aun así la categoría (y la meta de LDL) sale de ahí.
Es el caso de sus pacientes añosos.
*Recomendación: fuera de rango, "sin clasificar por escala" y pedirle la categoría a usted.*

## Bloque B — Flujo de consulta

**9. [PREGUNTADA HOY] La toma de muestras nace preseleccionada a las 6:00 a. m.** (el primer
cupo del día) con el botón ya habilitado. La guarda "elija un horario" solo aplica tras un fallo.
*Recomendación: exigir elección explícita siempre.*

**11. [RESUELTA] La "cosecha" adelantaba un examen vigente a la misma toma solo con <25%
de vigencia restante.** El margen subió a 33 %, con prueba desde v17.7.x: en su población el
viaje pesa más que la vigencia.

**15. [RESUELTA] Sin datos del paciente, el plazo de control nacía en "1 mes".** Sin
datos, ningún chip activo: elegir es obligatorio, como se recomendaba.

**16. [PREGUNTADA HOY] Si el día elegido solo tiene agenda de otro médico, el script cambia
solo de día** para quedarse con la suya. Prioriza continuidad sobre oportunidad sin preguntar.
*Recomendación: preguntar en ese caso ("ese día atiende el Dr. X — ¿se lo asigno o busco un
día suyo?").*

## Bloque C — Configuración y mantenimiento

**8. [CERRADA, v17.15.0] La sede del laboratorio (378) estaba cableada en seis sitios.**
La v17.6.3 ya había sacado el literal de cinco URLs a la constante única `mtrSedeIdLab()`
(378 de fábrica); quedaba **una** sin migrar — la del SMS que le llega al celular del
paciente diciéndole a qué laboratorio ir. Ya no.

**14. [RESUELTA, v16.9.0] La tabla de festivos se agotaba el 31-dic-2027.** `mtrEsFestivoCO`
calcula por la regla de la Ley Emiliani (algoritmo, sin tabla, sin techo); la tabla `FESTIVOS`
queda solo de 2024-2027 como atajo y delega al algoritmo fuera de ese rango.

**17. [DECIDIDA por el médico, 27-ago] Dos decisiones clínicas viven escondidas en modo
programador:** la lista de tamizajes PyM que el panel oculta ("meta cumplida en la IPS") y la
hora del recordatorio de carga (07:30). La recomendación original era un rótulo visible de
cuántas actividades quedan ocultas. **El médico decidió: «dejarlo exactamente como está».**
No es un pendiente: es una decisión tomada, y se respeta.

**18. [RESUELTA, v17.6.0] Había cuatro relojes de frescura distintos** (medicamentos 5 min,
labs y órdenes 10, resumen 20, tabla oficial 30). Un solo TTL de 10 minutos rige hoy en
resumen, medicamentos, labs y tabla oficial, como se recomendaba.

---

## Telemetría — estado real (auditoría de punta a punta del 20-ago)

**Qué hay:** emisión bien construida (agregación por ventanas, saneo anti-PHI con pruebas, cola
con reintento y deduplicación por lote, diagnóstico puerta a puerta desde v15.7.0). Destino:
Hoja de Google vía Apps Script. SharePoint NO es salida de telemetría (solo entrada del Excel PyM).

**Por qué está muda desde el 11-08 (hipótesis en orden):** (1) el interruptor nació APAGADO ese
mismo día (`reporte:false`, `uxTelemetria:false`); (2) la versión que lo re-enciende (v14.2.0+)
y el diagnóstico (v15.7.0) posiblemente nunca llegaron a los PC — la última verificada en
consultorio fue v14.1.6 y hay ~30 versiones sin publicar en el Gist; (3) transporte roto con el
fallo anotado en un localStorage que nadie ha mirado; (4) [RESUELTA, v16.4.0 — con prueba
desde v17.16.1] rotación del token con acuse falso: el servidor dice "no" y el cliente lo
cuenta como entregado. `repPost` ya excluye del `ok` la respuesta `"no"`; el caso solo
estaba sin fijar en una prueba, y ahora lo está.

**Brechas frente a "nivel grandes":** sin alerta de silencio del lado servidor (los 9 días de
mudez sin que nadie se enterara son la prueba), sin id de sesión, sin esquema versionado, sin
reloj confiable, sin muestreo, receptor (`Codigo.gs`) fuera del repositorio, y la Hoja vive en
una cuenta de Google personal (pendiente #7 de siempre: ¿se queda, se retira, o se muda?).

**Sus pasos (en orden):** (1) la línea de consola que le mandé en el chat; (2) si la versión es
≥15.7.0, botón «Probar y diagnosticar» y foto; (3) publicar la versión vigente en el Gist y
«Buscar actualizaciones» en cada PC; (4) abrir la Hoja con su cuenta y mirar la fecha de la
última fila + que la implementación del Apps Script siga en "cualquier usuario, incluso anónimo"
y el token siga siendo el mismo; (5) encender los interruptores en cada PC (o decidir retirar
el canal). Del lado mío, cuando decida: [HECHO] el acuse real del servidor ya no cuenta el
"no" como éxito (v16.4.0, con prueba desde v17.16.1); quedan `Codigo.gs` de vuelta al repo y
el disparador de correo "si pasan 24 h sin filas".

---

# Estado real al 27-ago-2026 (revisión contra el código v17.15.0)

Este documento listaba como abiertas cosas que llevaban semanas cerradas. Un documento de
pendientes que miente hace que nadie lo lea. Revisado una por una contra el código de hoy:

| # | Estado | Evidencia |
|---|---|---|
| 1, 2, 3, 4, 9, 13, 16 | **RESUELTAS** — respondidas por el médico en la entrevista del 20-ago y cableadas | marcadas ya arriba |
| **5** LDL basal | **RESUELTA (v16.9.0)** | `mtrLdlBasalDeSerie` toma el LDL más alto de los controles del último año y lo inyecta a `mtrEvaluarMetaLdl`; sin serie, la interfaz dice «reducción ≥X % no evaluable: sin LDL previo del último año» en vez de castigar. Pruebas en `suite_45` |
| **6** El sábado | **MEDIDA, y la conclusión cambió** — ver abajo | `tools/medir_sabados.js` |
| **7** toma→control | **RESUELTA (v16.9.0)** | objetivo único +7, ventana 14–21 |
| **8** La sede 378 | **CERRADA (v17.15.0)** | la v17.6.3 sacó el literal de cinco URLs a `mtrSedeIdLab()` y dejó **una**: la del SMS al paciente. Ya no |
| **10** Embarazo | **RESUELTA (v16.9.0 / v17.0.2)** | `mtrDebePreguntarEmbarazo` + confirmación con vigencia de 30 días, consumida por `mtrEvaluarUroanalisis`. Prueba en `suite_48` |
| **11** Cosecha 25 % | **RESUELTA** | margen al 33 %, con prueba desde v17.7.x |
| **12** Discordancia de TFG | **RESUELTA (v16.9.0)** | umbral a 2 estadios en `evaluarDiscordanciaTFG`, «REVISE EL DATO» desde 3. Prueba en `suite_27` |
| **14** Festivos hasta 2027 | **RESUELTA (v16.9.0)** | `mtrEsFestivoCO` calcula por Ley Emiliani, sin techo; la tabla queda solo de 2024-2027 y delega fuera de rango |
| **15** Plazo por defecto | **RESUELTA** | sin datos, ningún chip activo |
| **17** Tamizajes ocultos | **DECIDIDA por el médico el 27-ago: «dejarlo exactamente como está»** | ni contador visible ni sacar el campo del modo programador. **No es un pendiente: es una decisión tomada** |
| **18** Cuatro relojes | **RESUELTA (v17.6.0)** | un solo TTL de 10 min en resumen, medicamentos, labs y tabla oficial |
| Telemetría: acuse falso | **RESUELTA (v16.4.0), y desde la v17.15.0 con prueba** | `repPost` excluye del `ok` la respuesta `"no"`; el caso quedaba sin fijar y una regresión habría sido muda |

## La #6 medida: la conclusión del 20-ago no se sostiene

El documento decía «el sábado tiene CUATRO reglas distintas» y recomendaba unificar. Medido
con `tools/medir_sabados.js` sobre un año de fechas × los seis plazos del modal:

- La regla de `calcBusinessTargetDate` («el sábado nunca es hábil») **actúa en 310 de 2.190
  casos (14,2 %)** … y le cuesta al médico **CERO sábados ofrecidos**. En un caso incluso le
  ofrece uno más. Mueve el centro del abanico de días, no lo que él puede elegir: los chips
  siguen mostrando los mismos sábados.
- La otra «divergencia» —los chips ofrecen los 52 sábados del año y el motor acepta 0, 28, 28
  o 52 según el estado del grupo— **no es un defecto: son dos preguntas distintas**. El chip
  ofrece marcado «por confirmar» (`confirmado: !esSabado`) y deja decidir al médico; el motor
  decide qué SUGERIR. Que difieran es el diseño.
- **Ninguna discrepancia deja vencer un examen**: un sábado rechazado empuja el control al
  lunes (+2 días) y eso vive dentro de la ventana clínica que `mtrFechaControlSugerida` ya
  respeta. CERO VENCIDOS (S0) no se toca.

**Recomendación, contraria a la del 20-ago: no unificar.** El cambio movería fechas reales a
cambio de cero sábados ganados, en un módulo que el médico usa en vivo. Queda documentado
como divergencia conocida y medida, no como deuda.
