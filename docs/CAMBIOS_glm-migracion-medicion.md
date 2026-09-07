# Cambios — claude/glm-migracion-medicion (P9: GLM-5.3 en z.ai + medición)

Base: 18.1.0 (`main` 5042294). Sin bump de versión (lo hace S6 al publicar).

## Qué cambia para el médico

El redactor de notas ya no depende de un solo proveedor: GLM-5.3 (z.ai) es el
primero y Gemini queda de respaldo en una escalera automática.

1. **Escalera de proveedores** — cada intento elige proveedor por slot
   (z.ai → Gemini). Cuota rota, saturación o «modelo no disponible» rotan al
   siguiente; el código 1211 de z.ai cuenta como modelo inexistente, no como
   error fatal.
2. **Parseo por proveedor** — la respuesta se lee con el decodificador que
   corresponde (OpenAI para z.ai, Gemini para Gemini); antes todo se leía con
   ojos de Gemini.
3. **Petición z.ai** — `https://api.z.ai/api/paas/v4/chat/completions`,
   GLM-5.3, `system` pegado al `user`, temperature 0.2, max_tokens 8192, sin
   campos de razonamiento. `@connect api.z.ai` declarado en la cabecera.
4. **Medición 30 días** — telemetría `ia.prov.<id>`, `ia.ok`, `ia.fallo`,
   `ia.cuota.rota`, `ia.saturado.rota`, `ia.nodisponible.rota` y latencias
   (<2 s / 2-5 s / 5-10 s / >10 s).
5. **Banda B1** — similitud >0,8 y <0,85 → `edicion_fuerte`; 0,80 exacto
   sigue siendo `edicion_leve`.
6. **FUENTES** — la sección FUENTES del prompt se recorta en el conector para
   no inflar la petición.
7. **Clave IA** — guardado/lectura de clave y `mtrHayClaveIA()` como gate;
   canario cero-identificables (MURILLO CAMARGO) en 0 eventos de red.

Línea base 14 días con Gemini (para comparar en 30 días): 246 generaciones ·
156 insertadas (63,4 %) · 155 intactas · 9 edición leve · `ia.ok` 187 ·
`ia.fallo` 143 (135 timeout) · latencias <2 s 5 / 2-5 s 23 / 5-10 s 79 / >10 s 80.

## Archivos

- `vigilante_agenda.user.js` — `MTR_PROVEEDORES_IA`, escalera, parseo z.ai,
  clasificador 1211, banda B1, telemetría de latencia y `@connect api.z.ai`.
- `tests/suite_70_v18_glm_medicion.js` — NUEVA: 18 casos (P9·1…P9·extra·2).
- `tests/INFORME_MUTACIONES.md` — filas 545-548 (4 mutaciones verificadas).

## Banco

Ver resultado final en la última línea de `tests/INFORME_MUTACIONES.md` (0 fallan).
