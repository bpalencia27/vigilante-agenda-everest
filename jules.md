# jules.md — Manual operativo de los agentes externos del proyecto

> **Para:** Brandon · **Repo:** `bpalencia27/vigilante-agenda-everest` (privado)
> **Última revisión:** 14-ago-2026

---

## ⚠️ 0. Estado de verificación de este documento — léelo primero

Este manual se redactó a partir de una extracción de `jules.google/docs` hecha en una
**sesión anterior** (fechada 14-ago-2026). En **esta** sesión se intentó re-verificar sus
12 afirmaciones estructurales contra la fuente primaria y **no fue posible**:

```
jules.google:443        → gateway answered 403 to CONNECT (policy denial)
jules.google.com:443    → 403
developers.google.com   → 403
```

El dominio está **bloqueado por la política de egreso de red** del entorno de trabajo. Se
lanzaron 14 agentes independientes; los 14 devolvieron `EGRESS_BLOCKED`. Ninguno intentó
rodear el bloqueo (mirrors, cachés, proxies) porque una denegación de política no se
sortea, se reporta.

**Consecuencia práctica, sin adornos:**

| | Estado |
|---|---|
| Las 12 afirmaciones de §15 | ⚠️ **Verificadas en la sesión anterior, NO re-verificadas hoy** |
| Fecha de la última entrada del changelog | ❌ **No comprobable hoy** |
| Modelo que usa cada plan hoy | ❌ **No comprobable hoy** |

**Regla que se aplicó y debe seguir aplicándose:** no se sustituyó la verificación
imposible por conocimiento previo del modelo. Es la misma regla del proyecto —
*casilla vacía antes que dato inventado*— aplicada a la documentación.

**Para cerrar esto** hace falta una de dos cosas: (a) habilitar `jules.google` en la
política de egreso del entorno, o (b) que Brandon pegue el texto de las páginas. Hasta
entonces, trata todo dato de fecha/límite/modelo de este archivo como **posiblemente
caducado**, y verifica en tu propia UI de Jules antes de depender de él.

---

## 1. El equipo: quién hace qué

| | **Jules** | **Claude Code** | **Gemini 3.7 Flash** |
|---|---|---|---|
| Dónde corre | VM efímera en la nube de Google | Este sandbox / tu máquina | API de Google AI |
| Modo | **Asíncrono** — lanzas y te vas | **Síncrono** — conversación | Llamada a modelo |
| Salida | Rama o PR en GitHub | Archivos editados + PR | Texto |
| Ve tu repo privado | ✅ con permiso de GitHub | ✅ | Solo lo que le pases |
| Concurrencia | 3/15/60 según plan ⚠️ | 1 hilo + subagentes + workflows | Según cuota |
| Fuerte en | Paralelismo barato | Criterio y contexto histórico | Volumen, multimodal, barato |

Son **complementarios, no sustitutos**. Jules es paralelismo; Claude es el criterio que
conoce las regresiones del proyecto; Gemini 3.7 Flash es el músculo barato para tareas
acotadas y de gran volumen.

### 1.1 Gemini 3.7 Flash — ficha técnica

> Ficha **suministrada por Brandon el 14-ago-2026** desde la documentación de Google AI.
> No re-verificada contra la fuente en esta sesión (mismo bloqueo de red de §0).

| Propiedad | Valor |
|---|---|
| Código de modelo | `gemini-3.7-flash` |
| Entradas | Texto, imagen, vídeo, audio y PDF |
| Salida | Texto |
| Límite de entrada | 1.048.576 tokens |
| Límite de salida | 65.536 tokens |
| Versión estable | `gemini-3.7-flash` |
| Última actualización | Agosto 2026 |

**Capacidades:** caching · ejecución de código · uso de computadora (preview) · búsqueda
de archivos · *function calling* · grounding con Google Maps · grounding con búsqueda ·
salidas estructuradas · **thinking (low, medium, high)** · contexto de URL.
**Consumo:** Batch API · Flex inference · Priority inference.

**No soporta:** generación de audio, generación de imagen, Live API.
⚠️ **`thinking: minimal` NO está soportado y devuelve error** — usa `low` como mínimo.

**Dónde encaja en ESTE proyecto:**

- ✅ **Sí**: lectura masiva del archivo de 853 KB por tramos (1 M de contexto le cabe
  entero), clasificación de analitos, normalización de nombres de exámenes, extracción de
  estructura desde capturas de pantalla del EHR (es multimodal), generación de fixtures
  sintéticos.
- ❌ **No**: nada que toque `scrubPII`, la telemetría ni decisiones clínicas. Su salida
  entra al repo **solo** revisada, igual que la de Jules.
- ⚠️ **Nunca** le pases una pantalla real de Everest con datos de paciente. Que sea
  multimodal es justo lo que lo hace peligroso aquí: una captura sin redactar es PHI.

---

## 2. `AGENTS.md` — la palanca de mayor rendimiento

Jules lee el `AGENTS.md` de la raíz del repo. Es un estándar abierto (`agents.md`), el
mismo que consumen Codex, Copilot y Cursor: **se escribe una vez y lo aprovechan todos**.

- Markdown plano, sin campos obligatorios.
- En monorepos: uno por subproyecto; **gana el más cercano** en el árbol.
- **Tu prompt siempre sobrescribe lo que diga `AGENTS.md`.**

👉 El de este repo ya existe y está mantenido: **`AGENTS.md` en la raíz**. No lo dupliques
ni lo reescribas desde cero — edítalo.

**Qué escribir que de verdad cambia resultados** — no describas el proyecto, *restringe el
comportamiento*:

```markdown
❌ "Este proyecto es un userscript para vigilar citas médicas."
✅ "TODO el código vive en un único archivo vigilante_agenda.user.js (853 KB).
   NUNCA lo dividas en módulos: Tampermonkey lo instala como archivo único."
```

Lo que un agente no puede adivinar y por tanto **debe** estar ahí: prohibiciones,
invariantes, comandos exactos, y **el motivo de las decisiones raras** — si no pones el
porqué, las "arregla".

---

## 3. Anatomía de un prompt que funciona

**Plantilla de 5 bloques** (es lo que separa una tarea de 1 intento de una de 4):

```
[OBJETIVO]      Una frase. Qué debe ser verdad al terminar.
[CONTEXTO]      Archivo(s) y función(es) exactas. Por qué está así hoy.
[RESTRICCIONES] Qué NO puede tocar. Invariantes. Compatibilidad.
[VERIFICACIÓN]  El comando exacto que debe pasar. "No termines hasta que
                `node tests/runner.js` pase."
[ENTREGA]       "Crea rama feat/xxx y abre PR" · "no hagas commit, solo el diff"
```

**Multiplicadores:**

- **Pide el criterio de aceptación de vuelta** antes de que escriba código: *"dime cómo
  vas a verificar que funciona"*. Si su respuesta es floja, tu prompt lo era.
- **Pídele que investigue** antes de implementar y que cite la fuente en el plan.
- **Deja que pregunte.** No rellenes el prompt de suposiciones defensivas.

---

## 4. Protocolo Brandon + Claude + Jules/Gemini

| Fase | Quién | Por qué |
|---|---|---|
| **Decidir qué hacer** | **Brandon** | Es tu producto, tu IPS, tu riesgo legal |
| **Diseñar la solución y escribir el prompt** | **Claude** | Tiene el contexto histórico y ve el disco |
| **Ejecutar en paralelo, tareas acotadas** | **Jules / Gemini** | Muchas VMs por el mismo precio |
| **Revisar el diff antes de fusionar** | **Claude** | Conoce las regresiones que los otros no |
| **Trabajo que necesita ver Everest real** | **Brandon + Claude** | Jules no tiene acceso ni debe tenerlo |
| **Merge y despliegue** | **Brandon** | Acciones sobre tus cuentas las haces tú |

**Qué NO delegar a un agente externo en este proyecto:**

- ❌ Cambios en `scrubPII` o en la telemetría → es la barrera anti-PHI.
- ❌ Refactors grandes del archivo único → hay regresiones documentadas; el riesgo de
  reintroducir una es alto.
- ❌ Nada que requiera probar contra Everest real.
- ❌ Decidir un código CUPS, una vigencia clínica o un festivo **sin fuente citada**.
- ✅ **Sí delegar:** tests, auditorías de solo lectura, documentación, fixtures
  sintéticos, actualización de dependencias, búsqueda de lógica duplicada.

---

## 5. 🔴 Seguridad — antes de dar acceso a cualquier agente

Un agente externo clona el repo **entero** en una VM **con internet**. Este repo acompaña
software que corre sobre historias clínicas reales.

```bash
# ¿Hay algo prohibido YA en el historial de git?
git log --all --name-only --pretty=format: | sort -u | grep -Ei '\.(har|xlsx|zip)$'
```

Si aparece algo: **no basta con borrarlo en un commit nuevo** — queda en el historial, y
el agente clona el historial. Hay que reescribirlo (`git filter-repo`) o crear un repo
limpio.

**`.gitignore` mínimo obligatorio:**

```gitignore
*.har
*.xlsx
*.xls
*.csv
*.zip
captura_*.json
```

**Lo que Google declara y lo que no** *(de la sesión anterior; ver §0 — no re-verificado)*:

- La FAQ afirmaba que Jules **no entrena con contenido de repositorios privados**.
- **No hay BAA de HIPAA** ni compromiso de residencia de datos publicado para Jules.
- La FAQ traslada la responsabilidad de seguridad al usuario.

**Conclusión operativa: código sí, datos de pacientes jamás.** Esa línea la sostienes tú,
porque el producto no la sostiene por ti.

---

## 6. Errores comunes y su causa real

| Síntoma | Causa | Arreglo |
|---|---|---|
| La tarea se cuelga y muere | Proceso que no termina en el setup (`npm run dev`) | Solo comandos discretos |
| `failed` repetido | Script de setup incompleto o roto | Validar el script con `node -v` incluido |
| "Arregla" algo que estaba bien a propósito | Falta el *por qué* en `AGENTS.md` | Documenta la invariante y su motivo |
| Hace algo distinto a lo pedido | Prompt vago, o el plan se autoaprobó | Plantilla de 5 bloques |
| Tarea lenta desde cero cada vez | No hay snapshot del entorno | Congela la imagen del entorno |
| PR muy por detrás de la punta | No rebasó antes de enviar | Ver `AGENTS.md` §"Antes de enviar" |

---

## 7. Datos de esta sección: PENDIENTES DE RE-VERIFICAR

Todo lo de abajo viene de la extracción anterior y **no pudo comprobarse hoy** (§0).
Trátalo como orientativo, no como especificación.

- **Límites por plan** (tareas/24 h y concurrentes): Free 15/3 · Pro 100/15 · Ultra 300/60,
  en ventana deslizante.
- **Disparador desde GitHub:** etiqueta `jules` en un issue.
- **Suggested Tasks / Proactivity:** máximo 5 repos.
- **CLI:** `npm install -g @google/jules`, con un flag de sesiones en paralelo.
- **API REST:** base `https://jules.googleapis.com/v1alpha/`, cabecera `X-Goog-Api-Key`,
  máximo 3 keys.
- **Imágenes:** PNG/JPEG, solo al crear la tarea, tope combinado de 5 MB.
- **Integraciones:** la doc solo afirmaba GitHub en positivo; nunca mencionaba GitLab ni
  Bitbucket (ausencia de mención ≠ ausencia de soporte).
- **Modelo por plan:** la página de límites y el changelog se contradecían entre sí. **El
  changelog manda; verifica en tu UI.**

---

## Fuentes

- `https://jules.google/docs/` y sus subpáginas — **inaccesibles desde este entorno**
  (bloqueo de egreso, §0).
- [AGENTS.md — especificación abierta](https://agents.md/)
- Ficha de `gemini-3.7-flash`: suministrada por Brandon, 14-ago-2026.
- `AGENTS.md` de este repo — la fuente de verdad operativa del proyecto.
