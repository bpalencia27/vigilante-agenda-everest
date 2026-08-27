# Decisiones pendientes del médico — auditoría de ambigüedades del 20-ago-2026

Este documento reúne las 18 decisiones que el código tomó por usted sin preguntarle, encontradas
en la auditoría exhaustiva que pidió, más el estado de la telemetría. Las 8 más urgentes se las
pregunto en la entrevista de hoy; las demás quedan aquí con mi recomendación para que las
responda cuando quiera — con responder en el chat "del documento, la 11: opción b" basta.

Las que ya respondió en la entrevista del 20-ago quedan marcadas.

---

## Bloque A — Criterio clínico (las que cambian conductas)

**1. [PREGUNTADA HOY] Dos varas para "vencido".** El aviso de entrada y el bloqueo "ya cubierto
por Athenea" juzgan con 180 días planos; Agendar y Riesgo usan la tabla por estadio + su regla
del 50%. Un renal G4 puede ser "ya cubierto" y "vencido" en la misma sesión.
*Recomendación: una sola vara — la tabla por estadio + 50% en todos los caminos.*

**2. [PREGUNTADA HOY] Meta de HbA1c fija en 7,0 para todos.** La individualización que el código
promete es inalcanzable (nadie alimenta la meta individual, y además hay dos claves distintas
que nunca se encuentran). A un paciente de 85 años con 7,6 se le acorta la vigencia y se le
rotula falla.
*Recomendación: campo por paciente en la Ficha, con 7,0 de fábrica.*

**3. [PREGUNTADA HOY] La creatinina previa nunca se alimenta.** Sospecha de IRA, "función renal
inestable" (que colapsaría las vigencias al mínimo del rango) y remisión por caída de TFG están
escritas, probadas… y apagadas de fábrica, porque nadie entrega la TFG anterior. El dato ya
viaja en la respuesta de Athenea (365 días de creatininas).
*Recomendación: cablear la penúltima creatinina de Athenea.*

**4. [PREGUNTADA HOY] "Fuera de meta" tiene dos definiciones.** Para acortar vigencia al 50%:
estrictamente > meta. Para declarar falla terapéutica: > meta+15%. El paciente de la franja
intermedia recibe más viajes al laboratorio sin que ninguna pantalla declare falla.
*Recomendación: un solo umbral (meta+15%) para ambas cosas.*

**5. La reducción ≥50% del LDL nunca se puede verificar.** En riesgo alto/muy alto la norma
exige meta absoluta Y reducción desde el basal; como el basal jamás se alimenta, todo paciente
alto/muy alto en meta queda en "meta parcial" perpetuo.
*Recomendación: declarar la reducción como "no evaluable" ya (que la meta absoluta clasifique
sola), y como mejora tomar de basal el LDL más alto del histórico de Athenea.*

**6. El sábado tiene CUATRO reglas distintas según el módulo.** Hábil en un cálculo, no hábil
en otro, "solo el sábado de su grupo 1-3/2-4" en el control clásico, "cualquier sábado" en
labs-primero — y el 5.º sábado del mes no existe para nadie. Sobrevive además un modelo
quincenal muerto anclado a una fecha fija.
*Recomendación: regla única — solo los sábados de su grupo, el 5.º sábado como "por confirmar"
visible, y borrar el modelo muerto.*

**7. La distancia toma→control es +4 días por un camino y +7 por otro.** Y la ventana de toma
es 14–22 días en el motor pero 14–21 en labs-primero. Además el "modo estable" (citar lo más
tarde posible para maximizar vigencia) existe, está probado y nadie puede activarlo.
*Recomendación: unificar en toma 14–21 y control a +7 (el número que usted ya dictó el 19-ago).*

**10. El embarazo no se lee de ninguna parte.** La conducta "en embarazo la bacteriuria se
trata siempre" es inalcanzable; a toda paciente se le asume no gestante sin decirlo.
*Recomendación: añadirlo a las confirmaciones del reconciliador (el mecanismo ya existe desde
v16.3.2), solo en mujer en edad fértil con parcial sugestivo.*

**12. La discordancia entre las dos TFG solo alerta con >2 estadios de diferencia.** G2 contra
G4 (frontera de metformina, albúmina y fósforo) pasa como nota discreta.
*Recomendación: alerta fuerte desde ≥2 estadios; ≥3 es casi siempre dato corrupto, no paciente.*

**13. [PREGUNTADA HOY] Fuera de 40–79 años la escala ASCVD clasifica por extrapolación.** El
propio código lo declara "no validado"… y aun así la categoría (y la meta de LDL) sale de ahí.
Es el caso de sus pacientes añosos.
*Recomendación: fuera de rango, "sin clasificar por escala" y pedirle la categoría a usted.*

## Bloque B — Flujo de consulta

**9. [PREGUNTADA HOY] La toma de muestras nace preseleccionada a las 6:00 a. m.** (el primer
cupo del día) con el botón ya habilitado. La guarda "elija un horario" solo aplica tras un fallo.
*Recomendación: exigir elección explícita siempre.*

**11. La "cosecha" adelanta un examen vigente a la misma toma solo si le queda <25% de
vigencia.** Con más margen, el paciente hace un segundo viaje meses después.
*Recomendación: subir el corte a 33% — en su población el viaje pesa más que la vigencia.*

**15. Sin datos del paciente, el plazo de control nace en "1 mes".** En un programa cuyas
vigencias base son de 180 días, el defecto ciego acerca controles sin razón clínica.
*Recomendación: sin datos, ningún chip activo — elegir es obligatorio.*

**16. [PREGUNTADA HOY] Si el día elegido solo tiene agenda de otro médico, el script cambia
solo de día** para quedarse con la suya. Prioriza continuidad sobre oportunidad sin preguntar.
*Recomendación: preguntar en ese caso ("ese día atiende el Dr. X — ¿se lo asigno o busco un
día suyo?").*

## Bloque C — Configuración y mantenimiento

**8. La sede del laboratorio (378) está cableada en seis sitios.** Si un colega de otra sede
instala el script, sus pacientes quedan citados al laboratorio equivocado.
*Recomendación: constante de instalación por equipo, con 378 de fábrica.*

**14. La tabla de festivos se agota el 31-dic-2027** y desde ahí los festivos cuentan como
hábiles, con aviso solo en consola (o sin aviso en el camino del motor).
*Recomendación: calcular por la regla de la Ley Emiliani (algoritmo, sin tabla) con aviso
visible de respaldo.*

**17. Dos decisiones clínicas viven escondidas en modo programador:** la lista de tamizajes
PyM que el panel oculta ("meta cumplida en la IPS") y la hora del recordatorio de carga (07:30).
Si la meta de sífilis/hepatitis deja de estar cumplida, usted no tiene cómo enterarse.
*Recomendación: rótulo visible "N actividades ocultas por configuración" sin recargar el menú.*

**18. Cuatro relojes de frescura distintos** (medicamentos 5 min, labs y órdenes 10, resumen
20, tabla oficial 30): la fecha de control puede salir de un resumen que se apoya en insumos
que el propio script ya declaró caducos.
*Recomendación: un solo reloj de 10 minutos para todo.*

---

## Telemetría — estado real (auditoría de punta a punta del 20-ago)

**Qué hay:** emisión bien construida (agregación por ventanas, saneo anti-PHI con pruebas, cola
con reintento y deduplicación por lote, diagnóstico puerta a puerta desde v15.7.0). Destino:
Hoja de Google vía Apps Script. SharePoint NO es salida de telemetría (solo entrada del Excel PyM).

**Por qué está muda desde el 11-08 (hipótesis en orden):** (1) el interruptor nació APAGADO ese
mismo día (`reporte:false`, `uxTelemetria:false`); (2) la versión que lo re-enciende (v14.2.0+)
y el diagnóstico (v15.7.0) posiblemente nunca llegaron a los PC — la última verificada en
consultorio fue v14.1.6 y hay ~30 versiones sin publicar en el Gist; (3) transporte roto con el
fallo anotado en un localStorage que nadie ha mirado; (4) rotación del token con acuse falso
(el servidor dice "no" y el cliente lo cuenta como entregado — defecto real por corregir).

**Brechas frente a "nivel grandes":** sin alerta de silencio del lado servidor (los 9 días de
mudez sin que nadie se enterara son la prueba), sin id de sesión, sin esquema versionado, sin
reloj confiable, sin muestreo, receptor (`Codigo.gs`) fuera del repositorio, y la Hoja vive en
una cuenta de Google personal (pendiente #7 de siempre: ¿se queda, se retira, o se muda?).

**Sus pasos (en orden):** (1) la línea de consola que le mandé en el chat; (2) si la versión es
≥15.7.0, botón «Probar y diagnosticar» y foto; (3) publicar la versión vigente en el Gist y
«Buscar actualizaciones» en cada PC; (4) abrir la Hoja con su cuenta y mirar la fecha de la
última fila + que la implementación del Apps Script siga en "cualquier usuario, incluso anónimo"
y el token siga siendo el mismo; (5) encender los interruptores en cada PC (o decidir retirar
el canal). Del lado mío, cuando decida: acuse real del servidor (corregir el "no" contado como
éxito), `Codigo.gs` de vuelta al repo, y el disparador de correo "si pasan 24 h sin filas".

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
