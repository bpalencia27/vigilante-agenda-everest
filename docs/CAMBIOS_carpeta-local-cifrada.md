# Cambios — claude/carpeta-local-cifrada (P8: carpeta local como caché cifrado)

Base: 18.1.0 (`origin/main` 2100035). Sin bump de versión (lo hace S6 al publicar).

## Qué cambia para el médico

La carpeta local dejaba, por cada control, un `<cédula>.json` EN CLARO con laboratorios
y series completas — el número de documento como nombre de archivo y también dentro.
Ahora es un caché derivado, cifrado y sin identidad:

1. El nombre del archivo ya no es la cédula: es un hash con una clave de equipo que
   vive solo en el asistente (jamás en la carpeta).
2. El contenido viaja cifrado (AES-GCM, sello nuevo en cada escritura); la cabecera
   en claro solo dice que es «caché derivado, no historia clínica».
3. Las carpetas sincronizadas (OneDrive/Drive/Dropbox) ya no se advierten: se
   RECHAZAN con explicación en lenguaje llano.
4. Purga diaria: lo guardado caduca a 365 días.
5. Ajustes muestra cuántos pacientes y controles hay guardados y trae un
   «Borrar todo lo guardado» con confirmación que borra de verdad.
6. Migración del formato viejo: leer, podar, cifrar, escribir con nombre nuevo y
   BORRAR el original; si el borrado falla, se le muestra el archivo exacto y la
   migración no se da por terminada.

La ancla de Enfermedad Actual no cambia ni una coma: hay prueba que compara byte a
byte contra el formato viejo.

## Archivos

- `vigilante_agenda.user.js` — módulo de carpeta cifrada, purga, Ajustes y migración;
  se conserva íntegro el módulo v18.0.136 de memoria en disco y se engancha su arranque.
- `tests/suite_69_v18_carpeta_cifrada.js` — NUEVA: 9 casos / 47 comprobaciones.
- `tests/harness.js` — mock de `TextDecoder` + `crypto.webcrypto` de Node.
- `tests/suite_12…`, `suite_34…`, `suite_68…` — casos hermanos de los cambios.
- `tests/INFORME_MUTACIONES.md` — filas 537-544 (8 mutaciones verificadas).

## Banco

Ver resultado final en la última línea de `tests/INFORME_MUTACIONES.md` (0 fallan).
