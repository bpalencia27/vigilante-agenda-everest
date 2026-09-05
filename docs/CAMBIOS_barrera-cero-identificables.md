# Cambios — claude/barrera-cero-identificables (P10: barrera de identificables antes de la red)

Base: `claude/m2m-fixes-30` 76128d1 (contiene P9 e4ee2b4 + los 3 fixes M2M).
Sin bump de versión (lo hace S6 al publicar).

## Qué cambia para el médico

Antes de que cualquier texto viaje a la IA (z.ai o Gemini), una barrera local
examina el prompt YA ensamblado — system y user de todos los canales, incluido
el JSON v68 crudo — y si encuentra un posible identificador, **no se envía nada**
y el motivo le dice qué se detectó y en qué mitad del prompt.

1. **Punto único de salida** — la guarda vive dentro de `mtrGeminiRedactar`,
   después de ensamblar el prompt y ANTES de cualquier disparo de red: lo
   bloqueado ni se genera ni cuenta como `ia.gen`.
2. **Detectores** (sobre el texto final, no sobre intenciones):
   D1 número largo (≥6 dígitos, cédulas), D2 teléfono móvil colombiano
   (opcional +57), D3 correo, D4 dirección (calle/carrera/avenida… + #),
   D5 tokens del nombre real del paciente (con y sin tildes, insensible a
   caja, con guardas de borde de palabra), D6 honorífico + nombre
   capitalizado («Paciente María», «Acompañante: Jose», «Sr. Pérez», «DR. Gómez»).
3. **D6 de dos ramas** — un punto tras el honorífico significa cosas opuestas
   según la palabra: «Sr. Pérez» usa el punto COMO abreviatura; «…del paciente.
   Prohibido…» es fin de oración (falso positivo hallado contra los prompts
   REALES de los 5 modos). Regla: completos solo con espacio/`:`/`,`; abreviaturas
   (sr, sra, dr, dra) SOLO con punto; y la palabra capitalizada debe pasar el
   filtro de palabra de función del saneador (mata «paciente: Sé preciso»).
4. **Telemetría en conteos** — `ia.barrera.bloqueo` y `ia.barrera.tipo.<tipo>`;
   cero PHI en logs: las muestras se acotan a 24 caracteres y a 6 hallazgos.
5. **Límite aceptado** — un nombre propio DESCONOCIDO en MAYÚSCULAS sostenidas
   sin honorífico delante no dispara D6 (documentado en el código).

## Archivos

- `vigilante_agenda.user.js` — función `mtrBarreraIdentificables` (tras
  `mtrProveedorIA`) + guarda en `mtrGeminiRedactar`.
- `tests/suite_81_barrera_ia.js` — NUEVA: 6 casos (P10·1…P10·6).
- `tests/INFORME_MUTACIONES.md` — 4 mutaciones verificadas (filas al final).

## Diferido (fuera de alcance de este PR)

- Terceros capturados del DOM (punto 3 del prompt): hoy solo se barre al
  paciente titular.
- Detector de nombre propio vs. diccionario (punto 4).
- Vista previa «Enviar así / Corregir» (punto 5): hoy bloquea con motivo.
- Campos tipados por casilla (punto 6).

## Banco

Ver resultado final en la última línea de `tests/INFORME_MUTACIONES.md` (0 fallan).
