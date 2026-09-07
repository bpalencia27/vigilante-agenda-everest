# EMPAQUETADO — v18.3 (P12), 05-sep-2026

Propuesta del prompt `06_saneamiento_rendimiento`. **Nada de esto se aplicó a la
fuente**: la regla del proyecto es que la fuente ES la memoria (34 % de comentarios;
regla P12 "los comentarios no se borran"). Esto es un paso de BUILD opcional, jamás un
cambio al repositorio.

## Por qué (mapa de origen del peso)

| Capa | Hoy (v18.3) | Nota |
|---|---|---|
| Líneas físicas | 51.059 | 3.245 KB con UTF-8 |
| Código | 31.850 (62,4 %) | lo que ejecuta el navegador |
| Comentario completo | 17.348 (34,0 %) | memoria del proyecto: bugs reales, decisiones del médico, fuentes clínicas |
| Vacías | 1.861 (3,6 %) | separadores de sección |

Un build que quite comentarios+vacías entrega ~62 % del peso bruto en líneas. En BYTES
el ahorro real es menor: buena parte del peso son las cadenas de datos clínicos
(catálogos, motivos, plantillas), que no son comentarios. Estimación honesta: **~25-30 %
del archivo** — no los "2/3" que sugiere la proporción de líneas.

## Propuesta de pipeline (sin bundler, sin dependencias — regla del repo)

```
vigilante_agenda.user.js (fuente, LA única verdad)
  └─ tools/empaquetar.mjs (node puro, regex conservadora):
       1. Copiar el archivo.
       2. Quitar SOLO líneas completas que casan ^\s*// y ^\s*$.
          - NUNCA un // que cuelga de código (riesgo de romper URLs y strings).
          - NUNCA dentro de plantillas `<script>`/HTML string.
       3. Re-escribir la cabecera @version con el sufijo de build (ej. -min).
       4. node --check del resultado + diff de conteo de funciones públicas
          (debe ser idéntico; si cambia una, el build aborta).
  └─ dist/vigilante_agenda.min.user.js (artefacto de publicación)
```

La regex conservadora deja pasar comentarios inline y de bloque dentro de código: el
ahorro baja pero el riesgo baja mucho más. El paso 4 (conteo de funciones públicas
idéntico + `node --check`) es la barrera anti-regresión, misma filosofía del runner.

## Lo que NO se hará

- No dividir en módulos ES ni bundler (rompe Tampermonkey).
- No minificar identificadores: los stack traces en consultorio tienen que seguir
  diciendo `mtrClasificarRiesgoCv`, no `a1b2`.
- No tocar la fuente para "ahorrar": cada comentario retirado hoy fue re-hospedado
  (ver SANEAMIENTO.md) — la fuente sigue siendo el documento clínico-operativo.

## Decisión pendiente del dueño

¿Publicar por gist el artefacto minificado (P6) o seguir publicando la fuente tal
cual? Recomendación de esta pasada: **fuente tal cual** — 3,2 MB es un costo de
descarga una vez por actualización, y la transparencia total del archivo instalado en
el navegador del médico vale más que el ahorro.
