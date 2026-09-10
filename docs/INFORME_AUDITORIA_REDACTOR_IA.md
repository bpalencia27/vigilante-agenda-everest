# Auditoría del módulo de redacción con IA — informe + plan de grounding

**Fecha:** 2026-09-07 · **Alcance:** pedido 2 del médico ("auditoría exhaustiva del
módulo de redacción") + pedido 1 (trazabilidad de versiones del grounding).
**Método:** lectura completa del módulo en `vigilante_agenda.user.js` v18.6.1
(solo lectura, sin cambios). Cero PHI: ningún nombre ni documento de paciente.

## 1. Qué es realmente el redactor

Panel "Redactar con IA" que arma un prompt (system + user) con el contexto
clínico del paciente extraído del DOM de Everest y lo envía a un proveedor LLM.
**Proveedor real: z.ai GLM-5.3 como primario + Google Gemini como respaldo**
(escalera `mtrGeminiRedactar`, un solo punto de red). Cuatro modos vivos
(enfermedad_actual, analisis_plan, recomendaciones, consulta) más el motivo de
consulta de los inyectores de casilla. La salida siempre la revisa el médico;
la inserción solo va a casillas vacías o con reemplazo explícito y Deshacer.

## 2. Arquitectura de grounding (cómo llega el contexto al modelo)

Ocho canales rotulados en el user, ensamblados por una sola función
(`mtrRedaccionPrompt`): JSON del motor RCV v68 (solo análisis/plan), hoja de
hechos extraída del resumen clínico, ancla del control anterior, texto ya
registrado hoy, datos aportados por el médico, texto pegado (datos vs
instrucciones), ejemplos de estilo, y la tarea al final con recordatorio
anti-invención. Es modular y con inyección dinámica de contexto — la auditoría
lo confirma. Antes de la red: saneo por nombre efectivo del paciente, scrubPII
de la pregunta y barrera final de identificables sobre el mensaje ensamblado.

## 3. Deficiencias verificadas (todas con evidencia en código)

1. **La frescura se calcula y se tira**: `mtrIaResumenVigente` produce
   `refrescado`/`edadMin` y el clic de Generar las descarta. El prompt nunca
   recibe una marca de cuándo se leyó la pantalla ni de que es una "foto".
2. **Fechas de calendario crudas por un canal**: la hoja en texto imprime
   fechas exactas del plan mientras el JSON v68 las relativiza a propósito
   (diseño anti-cuasi-identificador aplicado a medias).
3. **Validación de salida heurística**: sin JSON estructurado pedido al
   modelo; no hay saneador de preámbulos/saludos para los modos cortos;
   `mtrLimpiarNotaIA` solo corre en análisis/plan.
4. **Verificador de afirmaciones sin telemetría propia**: `mtrVerificarFuentesIA`
   avisa localmente pero no emite contador; si el modelo omite la línea
   FUENTES, se tolera en silencio.
5. Menores: gate distinto en los inyectores (exige Gemini aunque z.ai sea el
   primario), texto de ayuda que menciona solo a Gemini, modo consulta sin
   few-shot, botón de Riesgo renderizado sin handler vivo (cuarentena).

## 4. Qué se implementará (y por qué es el plan correcto)

- **Sello de trazabilidad en el prompt** (pedido 1 del médico): una línea en el
  canal de hechos con hora local de generación y edad del resumen — "foto
  tomada a las HH:MM · leído de la pantalla hace N min". Regla "nunca usar
  versión anterior a la más reciente": el clic ya recalcula la hoja siempre;
  el sello solo DECLARA la foto que viaja. Prueba + mutación verificada.
- **Saneador de preámbulos** para todos los modos (quita "Claro, aquí
  tiene…", "Por supuesto…" al inicio de la respuesta). Prueba + mutación.
- **Telemetría del verificador** (pedido 3, monitoreo continuo): contadores
  anónimos `ia.fuentes.flag` y `ia.fuentes.sin_linea` vía uxTrack — jamás
  texto clínico (política cero-PHI intacta).

**Estado (2026-09-07, v18.6.2): IMPLEMENTADO.** Las tres piezas viven en el
script con prueba de banco (`tests/suite_96_grounding.js`, 4/4) y mutación
verificada (M3 sello, M4 saneador, M5 telemetría en `tests/INFORME_MUTACIONES.md`):
`mtrSelloContextoTexto` (edad de la foto + hora local, reloj inyectable) viaja
como bloque propio del prompt después de los datos y antes de la tarea final;
`mtrQuitarPreambuloIA` se aplica a la respuesta en todos los modos (conservador:
máximo 2 líneas cortas sin dígitos al inicio); `mtrTrackFuentesIA` emite
`ia.fuentes.flag.N` (techo 3+) o `ia.fuentes.sin_linea` por cada generación.

## 5. Qué NO se implementa (rechazo razonado, con evidencia)

- **Cambiar el proveedor a "deepseek v4 flash 0731"**: ese modelo no existe
  en el repo ni en la configuración real del médico. El primario real es z.ai
  GLM-5.3 (clave configurada por el médico en Ajustes) con Gemini de respaldo.
  Reemplazarlo a ciegas rompería la redacción en consulta real sin ganancia
  verificable. Si el médico quiere otro proveedor, se configura en Ajustes
  (la escalera ya soporta cambiar el modelo por configuración).
- **Certificar nivel "top tier S+" con benchmarks**: el banco mide
  comportamiento, no calidad de redacción clínica. Publicar un benchmark S+
  sería fabricar evidencia — viola la regla del proyecto "casilla vacía antes
  que dato inventado". Lo que sí existe y se mantiene: telemetría de adopción
  del médico (intacta/edición/descarte por borrador), feedback diario
  bien/mal, cifras sin respaldo detectadas, latencia y fallos por modelo.
