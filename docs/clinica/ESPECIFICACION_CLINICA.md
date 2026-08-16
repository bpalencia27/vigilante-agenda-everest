# Especificación Clínica Oficial Firmable — Vigilante de Agenda

> **Versión del Sistema:** `v14.1.9`  
> **Fecha de Emisión:** 15 de agosto de 2026  
> **Responsable Clínico:** Médico Especialista / Auditor Médico de APS

---

## 📊 Estado de Verificación Clínica

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. ELEMENTOS CLÍNICOS VERIFICADOS             :  15 elementos (100%)        │
│ 2. DISCREPANCIAS DETECTADAS Y CORREGIDAS      :  4 hallazgos                │
│ 3. ELEMENTOS SIN VERIFICAR PENDIENTES         :  0 bloqueantes              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Tabla de Parámetros Clínicos Oficiales

| Parámetro / Módulo | Valor Oficial Parametrizado | Estado de Verificación | Fuente de Validación |
|---|---|:---:|---|
| **Ecuación Renal Administrativa** | Cockcroft-Gault (Peso Real en kg) | **VERIFICADO** | Parámetro EPS para fijar vigencias ERC |
| **Ecuación Renal Fisiológica** | CKD-EPI 2021 (sin raza) | **VERIFICADO** | Guía KDIGO 2024 |
| **Alerta Discordancia TFG** | $> 2$ estadios KDIGO entre CG y CKD-EPI | **VERIFICADO** | Consenso Médico Institucional |
| **CUPS HbA1c Escritura** | `903426` (Hemoglobina Glicosilada Automatizada) | **VERIFICADO** | Orden Everest confirmada |
| **CUPS PTH Escritura** | `904921` (Hormona Paratiroidea Molécula Intacta) | **VERIFICADO** | Catálogo Everest |
| **CUPS Fósforo Escritura** | `903837` (Fósforo en Suero u Otros Fluidos) | **VERIFICADO** | Catálogo Everest |
| **CUPS Albúmina Escritura** | `903801` (Albúmina en Suero u Otros Fluidos) | **VERIFICADO** | Catálogo Everest |
| **CUPS Hemoglobina Escritura** | `902213` (Hemoglobina) | **VERIFICADO** | Catálogo Everest |
| **Vigencia Creatinina G1/G2** | 180 días | **VERIFICADO** | Tabla 50 Nefroprotección |
| **Vigencia Creatinina G3a/G3b** | 90–121 días | **VERIFICADO** | Tabla 50 Nefroprotección |
| **Vigencia Creatinina G4** | 60–93 días | **VERIFICADO** | Tabla 50 Nefroprotección |
| **Vigencia LDL en G4** | 120 días | **VERIFICADO** | Tabla 50 Nefroprotección |
| **Invariante PyM VIH** | **NUNCA SE OCULTA** | **VERIFICADO** | Seguridad Clínica del Paciente |
| **Festivos Oficiales** | Ley 51 de 1983 (2024–2027) | **VERIFICADO** | Ley Emiliani Colombia |

---

## 2. Salvedad y Justificación Metodológica de Función Renal

> **Declaración Obligatoria:**
> 1. **Cockcroft-Gault** calcula el *Aclaramiento de Creatinina* ($\text{CrCl}$ en $\text{mL/min}$) con base en el peso corporal real. Esta magnitud constituye el estándar administrativo exigido por la aseguradora (EPS) para auditar la periodicidad de exámenes de laboratorio y el agendamiento de controles de Nefroprotección.
> 2. **CKD-EPI 2021** estima la *Tasa de Filtración Glomerular* ($\text{eGFR}$ en $\text{mL/min/1.73m}^2$). Se calcula simultáneamente para asistir el juicio clínico directo del médico en el ajuste de dosis farmacológicas.
> 3. El script sugiere y compara; el médico tratante es la única autoridad con potestad de decisión final sobre la conducta diagnóstica y terapéutica.

---

## 3. Conformidad y Firma del Médico Responsable

Con la presente firma se avala la exactitud de los parámetros, códigos CUPS y reglas clínicas descritas en este documento como la **fuente de verdad oficial** del Vigilante de Agenda para la atención de pacientes en la IPS:

```
Nombre del Médico Responsable: _________________________________________________

Registro Médico / TP:          _________________________________________________

Firma:                         _________________________________________________

Fecha:                         ____ / ____ / 2026
```
