# TAREA R2 — Vigencias por estadio renal (MODO SOMBRA, no cambia ningún aviso todavía)

> **Cómo se usa:** copia este archivo ENTERO y pégalo como única instrucción en Jules.
> **REQUISITO DURO: no envíes esta tarea hasta que R1 (TFG + KDIGO) esté FUSIONADO** en
> `claude/pym-agenda-blindaje-v12-4`. Esta tarea importa y usa las funciones que R1 crea
> (`cockcroftGault`, `estadioKDIGO`). Si R1 no está fusionado, Jules no tiene de dónde partir.

---

## 0. TU PAPEL Y EL LÍMITE DE TU TRABAJO

Eres un ingeniero que hace **una sola tarea acotada**. Esta tarea es **MODO SOMBRA**: calcula
y registra la vigencia por estadio, pero **el aviso real de "laboratorio vencido" sigue
funcionando exactamente como hoy** (180 días planos). No la actives. Activarla es la tarea R3,
que requiere que el médico compare ambos resultados primero y dé el visto bueno explícito.
Si actualizas la vigencia real en esta tarea, el PR se rechaza aunque el cálculo esté perfecto.

---

## 1. CONTEXTO

- Repositorio: `vigilante-agenda-everest`, archivo `vigilante_agenda.user.js`.
- Rama base: `claude/pym-agenda-blindaje-v12-4`. Banco: `node tests/runner.js`.
- Depende de R1 ya fusionado: usa `cockcroftGault(edad, peso, creatinina, sexo)` y
  `estadioKDIGO(tfg)` tal cual R1 las dejó — no las reimplementes ni las copies, impórtalas
  (son funciones de nivel superior del mismo IIFE, ya están en el ámbito).
- **Para vigencias se usa el estadio de Cockcroft-Gault, NUNCA el de CKD-EPI.** Es una decisión
  clínica ya tomada en el proyecto hermano (`everest-rcv-copiloto`, comentario en
  `servidor_rcv.py:4746-4750`): Cockcroft-Gault es el "estadio administrativo" — el que rige
  vigencias, bloqueos y dispensación ante la EPS. CKD-EPI es el "estadio clínico", para razonar
  función renal, no para esto. No mezcles los dos.

---

## 2. LA TABLA — transcripción EXACTA, no la recalcules ni la ajustes

Fuente: `everest-rcv-copiloto/motor_vigencias.py` líneas 30-84, ya verificada y en producción
en el proyecto hermano contra el protocolo real de la EPS. `BLOQ` = el analito no se pide en
ese estadio (no calcula vigencia, se omite). Vigencia en DÍAS. Estadios en orden G1/G2/G3a/G3b/G4.

**Programa ERC** (aplica cuando el paciente tiene Nefroprotección — confirmado, ver §3):

| Analito | G1 | G2 | G3a | G3b | G4 |
|---|---|---|---|---|---|
| creatinina | 180 | 180 | 90–121 (rango) | 90–121 (rango) | 60–93 (rango) |
| glicemia | 180 | 180 | 180 | 180 | 60 |
| parcial_orina (uroanálisis) | 180 | 180 | 180 | 180 | 120 |
| hemoglobina | 365 | 365 | 365 | 365 | 180 |
| pth | BLOQ | BLOQ | 365 | 365 | 180 |
| albumina | BLOQ | BLOQ | BLOQ | 365 | 365 |
| fosforo | BLOQ | BLOQ | BLOQ | 365 | 365 |
| colesterol_total | 180 | 180 | 180 | 180 | 120 |
| trigliceridos | 180 | 180 | 180 | 180 | 120 |
| ldl | 180 | 180 | 180 | 180 | 180 |
| hdl | 180 | 180 | 180 | 180 | 180 |
| rac | 180 | 180 | 180 | 180 | 180 |
| hba1c | BLOQ | BLOQ | 180 | 180 | 120 | *(solo si el paciente además es DM2)* |

**Programa DM2** (sin ERC activa, o ERC en G1/G2): hba1c 180, glicemia 180, creatinina 180,
rac 180, parcial_orina 180, colesterol_total/ldl/hdl/trigliceridos 180, ecg 365 *(solo si
edad≥45)*. No exige PTH/Albúmina/Fósforo.

**Programa HTA** (sin ERC activa, o ERC en G1/G2): glicemia 180, creatinina 180, rac 180,
parcial_orina 180, colesterol_total/ldl/hdl/trigliceridos 180, ecg 365, ecocardiograma 365,
**acido_urico: BLOQ siempre** (no se pide en este programa).

**Rangos `(min, max)`:** para creatinina en G3a/G3b/G4 la fuente da un RANGO, no un número
único. NO lo colapses a un solo valor: eso sería inventar una política que la tabla no fija.
Guárdalo y regístralo como rango; quien decida qué extremo usar es una decisión de R3, no tuya.

---

## 3. CÓMO DETERMINAR EL "PROGRAMA" DEL PACIENTE — con lo que hay evidencia, nada más

Fuente real confirmada (`INFORME_ETIQUETAS.md`, ya en el repo, Tarea T1 de Jules):
`programasPaciente[].descripcion` del mismo `BuscarPacienteDetallado` que R1 ya usa. Cadenas
**confirmadas** hasta hoy: `"Nefroprotección"` → programa ERC; `"Hipertensión"` → programa HTA.

**Las cadenas para Diabetes/DM2 y HTA+DM NO están confirmadas todavía** (`INFORME_ETIQUETAS.md`
lo marca explícitamente como pendiente de una captura real). Por eso:

- Si `programasPaciente[]` contiene `"Nefroprotección"` → programa = ERC.
- Si contiene `"Hipertensión"` y NO `"Nefroprotección"` → programa = HTA.
- Si no contiene ninguna de esas dos cadenas confirmadas → programa = **`"NO_CONFIRMADO"`**, y
  el cálculo de vigencia por estadio para ese paciente **NO se hace** (se registra en consola
  que falta el dato, no se adivina con qué programa tratarlo). Esto incluye a los pacientes que
  SÍ son diabéticos: hasta que llegue la cadena real, quedan sin cálculo de sombra, nunca con
  uno adivinado.
- **NO inventes ni intentes deducir por texto libre** ("Diabetes", "DM2", "HTA+DM", "HTA + DM"…)
  ninguna variante de cadena para el programa DM2. Si tu propia ejecución encuentra una
  `descripcion` que NO es "Nefroprotección" ni "Hipertensión" y sospechas que podría ser la
  diabética, regístrala tal cual en el PR (§ hallazgos) para que el médico la confirme — no la
  uses para clasificar.

---

## 4. QUÉ HAY QUE HACER, EXACTAMENTE

Dentro de la misma función `checkFuncionRenal()` que creó R1 (o inmediatamente después de que
calcule `estadioKDIGO(cockcroftGault(...))` — verifica el nombre exacto que R1 dejó, no lo
adivines, léelo del código fusionado):

1. Determina el programa (§3). Si es `NO_CONFIRMADO`, registra por qué y termina ahí para ese
   paciente — no hay nada más que calcular esta vez.
2. Con el programa y el estadio de Cockcroft-Gault, busca en la tabla (§2) la vigencia de cada
   analito que el script YA vigila (`RCV_VIGENCIA_KEYS`, línea ~2567 — busca el nombre exacto
   actual, pudo moverse).
3. Registra en consola, en un solo bloque legible, la vigencia POR ESTADIO calculada junto a la
   vigencia PLANA actual (180 días) para cada analito, de forma que se pueda comparar a simple
   vista. Incluye el override de RAC≥30 si ya existe en el archivo (`_vigenciaDiasParaAnalito`)
   para que la comparación sea justa.
4. **No toques `RCV_VIGENCIA_DIAS`, `_vigenciaDiasParaAnalito`, ni ningún aviso visible.** El
   médico sigue viendo exactamente lo de siempre hasta R3.

---

## 5. LO QUE NO DEBES HACER

1. **NO actives la vigencia por estadio como fuente real del aviso.** Eso es R3, con visto
   bueno explícito del médico.
2. **NO inventes ni adivines la cadena de "Diabetes"/"HTA+DM".** Ver §3.
3. **NO uses el estadio de CKD-EPI para esto** — es Cockcroft-Gault, siempre.
4. **NO colapses los rangos `(min, max)` a un solo número.**
5. **NO reformatees, no añadas dependencias, no toques otro archivo** salvo
   `vigilante_agenda.user.js`, tests, y `tests/INFORME_MUTACIONES.md`.
6. **NO borres ni debilites pruebas existentes.**
7. **NO incluyas datos reales de paciente.**

---

## 6. PRUEBAS (obligatorio)

1. Programa ERC, estadio G3b: creatinina cae en rango (90,121), pth=365, albumina=365 — un
   caso por cada fila relevante de la tabla ERC.
2. Programa DM2 sin ERC: hba1c=180, ecg=365 solo si edad≥45, BLOQ correcto donde corresponde
   (no exige PTH/Albúmina/Fósforo).
3. Programa HTA: acido_urico siempre BLOQ, sin importar estadio.
4. `programasPaciente` sin "Nefroprotección" ni "Hipertensión" → programa `NO_CONFIRMADO`, cero
   cálculo, mensaje claro en consola de qué falta.
5. HbA1c en programa ERC solo aplica si el paciente es también DM2 — un caso que NO lo es debe
   dar BLOQ para hba1c aunque el estadio sea G3a/G3b.

### Mutación (obligatoria)
Rompe una fila de la tabla (p. ej. invierte BLOQ↔365 en pth de G3a) y confirma que una prueba
tuya cae. Restaura, confirma verde, documenta en `tests/INFORME_MUTACIONES.md`.

---

## 7. FORMATO DEL PR — igual que las tareas anteriores

```markdown
## 1. Qué cambié
## 2. Salida COMPLETA del runner
## 3. Pruebas nuevas
## 4. Mutación aplicada
## 5. Verificación de alcance (confirma: ningún aviso visible cambió, solo console.log)
## 6. Hallazgos NO tocados (incluye aquí cualquier descripcion de programasPaciente que
      sospeches sea la diabética, SIN haberla usado para clasificar)
```

**Regla final:** ante cualquier duda, el cambio más pequeño que compara sin decidir es el correcto.
