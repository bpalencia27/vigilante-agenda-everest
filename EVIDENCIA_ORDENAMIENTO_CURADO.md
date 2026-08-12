# Evidencia — lista curada de ordenamiento y paquetes oficiales

Capturas de consultorio del 12-08-2026. Sin PHI: solo códigos CUPS y estructura.

## 1. Los paquetes de Everest tienen id

| `paqueteProgramaId` | Botón | Confirmado |
|---|---|---|
| **1** | HTA | ✅ capturado |
| **2** | DM | ✅ capturado |
| ? | NEFRO | ❌ solo se vio el rótulo «HTA DM NEFRO» |

**DM (id 2) = HTA (id 1) + `903426` HEMOGLOBINA GLICOSILADA AUTOMATIZADA.** Nada más cambia.

## 2. LA LISTA CURADA REAL (lo que el médico ordena de verdad)

De `ObtenerOrdenamientoPorPacienteIdVigente` — un ordenamiento real ya guardado
(agrupador `12260710549`, dx **N189 Insuficiencia renal crónica**):

| CUPS | Examen |
|---|---|
| **903026** | MICROALBUMINURIA **AUTOMATIZADA** EN ORINA PARCIAL |
| 903426 | HEMOGLOBINA GLICOSILADA AUTOMATIZADA |
| 903815 | COLESTEROL HDL |
| 903818 | COLESTEROL TOTAL |
| 903841 | GLUCOSA EN SUERO |
| 903868 | TRIGLICÉRIDOS |
| 903876 | CREATININA EN ORINA PARCIAL |
| 903895 | CREATININA EN SUERO |
| 907106 | UROANÁLISIS |

## 3. La sospecha del semi/automatizado: CONFIRMADA

El paquete oficial ofrece **`903028` MICROALBUMINURIA SEMIAUTOMATIZADA**.
El médico ordena **`903026` MICROALBUMINURIA AUTOMATIZADA EN ORINA PARCIAL**.

Es el mismo patrón ya documentado con el LDL (`903816` semi para sanos vs `903817`
automatizado para crónicos): **el paquete trae la variante SEMI donde esta población
necesita la AUTOMATIZADA**. Ya no es sospecha.

## 4. Qué QUITA del paquete

- **`902210` HEMOGRAMA IV** → lo cambia por **`902213` HEMOGLOBINA** sola
  (visto en los clics: `li "HEMOGLOBINA"` → `input "902213"`).
- **`903817` LDL** → no aparece en el ordenamiento guardado.

## 5. Códigos que el script NO conoce (0 apariciones en el archivo)

`902210` · `902213` · `903026` · `903028` · `903426` · `903876`

De esos, **cuatro están en la lista curada** (`903026`, `903426`, `903876`, `902213`).
El script no puede ordenar lo que el médico ordena de verdad.

## 6. Bug del RAC — reproducido por segunda vez, mismo disparador

```
23:56:11  Auto-Labs (el script llena las casillas)
23:56:31  input#resultadoCreatinina      ← el médico edita a mano
23:56:33  input#resultadoRelacionAlbuminaCreatinina = ""   ← BORRADO por Everest
```
Idéntico a la captura de las 23:46. Es reproducible y no depende del paciente.

## 7. Fecha del uroanálisis — la casilla SÍ existe

`input#fechaResultUroanalisis` existe y es el mismo `dateId` que el script ya tiene
en su lista para UROANALISIS. El id es correcto; lo que falla es que el camino del
uroanálisis (`inyectarComponenteOrina`) nunca lo usa. El médico la llenó a mano.

## 8. Pendiente

- El `paqueteProgramaId` de NEFRO.
- Confirmar con el médico si la lista de §2 es la definitiva para ERC, y si cambia
  según el programa (HTA / DM / NEFRO).
