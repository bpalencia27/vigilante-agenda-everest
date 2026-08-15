# Corpus de grounding — Everest / Athenea

Material de referencia sobre el sistema real, para orientar a otros modelos de IA que
trabajen en este proyecto sin tener acceso al consultorio.

Todo lo que hay aquí sale de **capturas hechas por el médico en Everest de verdad**, no de
documentación del proveedor ni de suposiciones. Esa es la razón de que exista: en un
proyecto que escribe en historias clínicas, la diferencia entre "el sistema hace esto" y
"el sistema debería hacer esto" es la diferencia entre un dato correcto y uno inventado.

---

## Antes de usar nada de esto: cuatro reglas

**1. La jerarquía de evidencia manda, y está anotada en cada artefacto.**
De más fiable a menos:

| Nivel | Qué es | Ejemplo |
|---|---|---|
| 1 | Una orden **ya guardada** en Everest | `EVIDENCIA_ORDENAMIENTO_CURADO.md` (agrupador 12260710549) |
| 2 | Una respuesta **capturada** del servidor | las capturas de `network[]` de este corpus |
| 3 | Un clic **observado** con el texto literal del `<li>` | los `clicks[]` de las capturas |
| 4 | El catálogo del propio script, con su comentario de origen | `WHITELIST_13_LABS`, `PYM_CATALOG` |
| — | **Prohibido** | dar por bueno un CUPS, un umbral o una fórmula porque "suena bien" |

Ese último renglón no es retórico. Este proyecto ya tuvo el CUPS `903866` asignado a
triglicéridos en un repositorio y a microalbuminuria en otro; en realidad es **TGP/ALT**.
Un código que suena plausible ordena el examen equivocado a un paciente real.

**2. Aquí se publica la FORMA, nunca el CONTENIDO.**
De cada respuesta salen los nombres de campo y los tipos. Los valores solo se conservan
cuando son catálogo (códigos, términos médicos, enumerados). Los campos de persona salen
marcados `[OCULTO]`. `grounding/` está barrido: cero cédulas, cero teléfonos, cero correos.

**3. Lo que no está capturado, no se sabe.**
Si un endpoint no aparece en `API_EVEREST.md`, este corpus no dice nada sobre él. No lo
deduzcas de los que sí están: los nombres de Everest no siguen un patrón fiable
(`BuscarPaciente` existe en `APIAcceso` **y** en `APIOrdenamientoHealth`, y no devuelven lo
mismo).

**4. Un identificador puede venir codificado.**
`GetValidacionExamenCronicos` recibe el `citaId` en **base64 sin relleno**
(`citaId=MTIyMTk3NA` es `btoa("1221974")` sin los `=`). Mandarlo en claro pide una cita que
no existe. Es un error que ya se cometió y que ninguna prueba habría cazado.

---

## Qué hay

### `API_EVEREST.md`
Los **23 endpoints** observados: método, ruta, parámetros de consulta, estados HTTP y en qué
captura aparece cada uno. Generado, no escrito a mano.

### `esquemas/`
Un JSON por endpoint con el esquema de su petición y su respuesta — nombres de campo y
tipos, con `[OCULTO]` donde iba un dato de persona. Es lo que hace falta para escribir
código contra esta API sin adivinar la forma de las respuestas.

### `catalogos/tabla_validacion_examenes_cronicos.json`
Las **28 filas** de la tabla de validación que la IPS publica para la Ruta de Crónicos:
`codigoExamen`, rango, **unidad** y si el examen es obligatorio (9 de 28 lo son).

Dos cosas de este archivo que conviene leer antes de usarlo:

> ⚠️ **Son rangos de PLAUSIBILIDAD, no de normalidad clínica.** La hemoglobina se declara
> plausible entre **3 y 30 g/dL**. Un 3,2 cae "dentro" y es una urgencia transfusional.
> Contestan *"¿este número puede ser un resultado de verdad, o es un dedazo o una unidad
> equivocada?"*, nunca *"¿este paciente está bien?"*. Pintar "dentro de rango" como "normal"
> sería tranquilizar al médico sobre un valor crítico.

> `codigoExamen` **no es un CUPS**: es el nombre interno del campo (`HEMOGLOBINA`, `HBA1C`,
> `RELACION_ALBUMINURIA_CREATININA`). Y contesta una pregunta que llevaba semanas abierta:
> la IPS declara la RAC en **mg/g**, no en mg/mmol.

### Fixtures de DOM — en `tests/fixtures/`
HTML congelado de las vistas reales, ya saneado:

| Archivo | Qué es |
|---|---|
| `dom_everest_agenda.html` | la agenda del día |
| `dom_everest_cronicos.html` | la Ruta de Crónicos |
| `dom_everest_cronicos_hombre.html` | Ruta de Crónicos, paciente masculino (**111 campos**) |
| `dom_everest_cronicos_mujer.html` | Ruta de Crónicos, paciente femenino (**160 campos**) |
| `dom_everest_ordenes.html` | la pantalla de ordenamiento |

La diferencia de 111 vs 160 campos no es un detalle de maquetación: el formulario **cambia
según el sexo** (49 campos ginecoobstétricos de más). Un contrato de DOM único para los dos
genera falsos positivos.

### Capturas de origen — en la raíz del repositorio
| Archivo | Qué demuestra |
|---|---|
| `captura_agendamiento_oficial_20260810.json` | la cadena completa de agendamiento, de buscar paciente a enviar el SMS |
| `captura_ordenamiento_nativo_20260810.json` | cómo ordena Everest de forma nativa |
| `captura_ordenamiento_paquete_HTA_20260812.json` | el paquete de HTA, con el texto literal de cada `<li>` |
| `captura_rutacronicos_borrado_rac_20260812.json` | **evidencia de un bug**: al editar la creatinina a mano, Everest borra sola la casilla de la RAC |

Esa última merece atención: no es una captura de "cómo funciona", es la prueba de un
comportamiento del sistema que obligó a escribir una guarda con reloj y con cupo
(`checkRacGuardia`). El sistema con el que se trabaja **borra casillas por su cuenta**.

---

## Lo que NO está aquí, y hace falta

- **La Ruta de Crónicos de un paciente de diabetes y de uno de ERC.** El formulario cambia
  por programa, igual que cambia por sexo, y solo hay capturas del programa general.
- **Los mapas completos de DOM+red** (`MAPA_EVEREST_*.json`) que se generaron el 14-ago: se
  compartieron por chat y nunca entraron al repositorio. Si se quieren como grounding, hay
  que añadirlos y pasarles el mismo saneo.
- **De dónde sale que un paciente es DM2.** Programa de inscripción, diagnóstico en la
  historia, o preguntárselo al médico: sin esa fuente, una regla que dependa de ello **no se
  aplica** en vez de suponer que sí.

---

## Cómo se regenera

```bash
node tools/generar_grounding.js
```

Lee las capturas de la raíz y rehace `API_EVEREST.md` y `esquemas/`. Es un generador y no un
volcado a mano a propósito: cuando llegue una captura nueva, el corpus se rehace igual, sin
que nadie tenga que acordarse de qué se podía copiar y qué no.
