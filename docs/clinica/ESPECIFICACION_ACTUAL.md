# Especificación Clínica Actual del Vigilante de Agenda

> **Versión de Producción:** `v14.1.9`  
> **Hash SHA-256 (`vigilante_agenda.user.js`):** `b7517b11db69bacf2a580fba074c37d995c8c0d6727474fb32133f2c9f5f0a72`  
> **Fecha de Extracción:** 15 de agosto de 2026  
> **Líneas Totales:** 16.874 líneas

---

## 1. Matriz de los 13 Laboratorios de Crónicos (`WHITELIST_13_LABS`)

| Clave Interna | Nombres Reconocidos en LIS Athenea | Códigos LIS / CUPS | Input DOM Resultado | Input DOM Fecha | Superficie de Escritura Afectada |
|---|---|---|---|---|---|
| `COLESTEROL_TOTAL` | COLESTEROL TOTAL | `2009`, `903818` | `resultadoColesterolTotal` | `fechaResultColesterolTotal` | HC Crónicos (Everest) |
| `COLESTEROL_HDL` | COLESTEROL HDL, COLESTEROL DE ALTA DENSIDAD | `2015`, `903815` | `resultadoColesterolHDL` | `fechaResultColesterolHDL` | HC Crónicos (Everest) |
| `COLESTEROL_LDL` | COLESTEROL LDL, COLESTEROL DE BAJA DENSIDAD | `2014`, `903817`, `903816` | `resultadoColesterolLDL` | `fechaResultColesterolLDL` | HC Crónicos (Everest) |
| `TRIGLICERIDOS` | TRIGLICERIDOS, TRIGLICÉRIDOS | `2074`, `903868` | `resultadoTrigliceridos` | `fechaResultTrigliceridos` | HC Crónicos (Everest) |
| `UROANALISIS` | UROANALISIS, PARCIAL DE ORINA | `2095`, `907106` | `resultadoUroanalisis` | `fechaResultUroanalisis` | HC Crónicos (Radio SI/NO + 7 Sub-inputs) |
| `GLUCOSA` | GLUCOSA EN SUERO, GLICEMIA, GLICEMIA BASAL | `2013`, `903841` | `resultadoGlicemia` | `fechaResultGlicemia` | HC Crónicos (Everest) |
| `RAC` | RELACION MICROALBUMINURIA CREATININA, RELACION ALBUMINA/CREATININA | `8779` | `resultadoRelacionAlbuminaCreatinina` *(alt: `resultadoRAC`)* | `fechaResultRelacionAlbuminaCreatinina` | HC Crónicos (Everest) |
| `CREATININA` | CREATININA EN SUERO, CREATININA *(excluye: ORINA, CREATINURIA, DEPURAC)* | `2028`, `903895` | `resultadoCreatinina` | `fechaResultCreatinina` | HC Crónicos + Motor Renal |
| `HBA1C` | HBA1C, HEMOGLOBINA GLICOSILADA, HEMOGLOBINA GLICADA | `2035`, `903843` | `resultadoHBA1C` *(sin input en HC Crónicos)* | `fechaResultHBA1C` | Aviso Visual al Médico |
| `PTH` | PTH, HORMONA PARATIROIDEA, PARATOHORMONA | `2065`, `904921` | `resultadoPTH` | `fechaResultPTH` | HC Crónicos (Everest) |
| `FOSFORO` | FOSFORO EN SUERO, FOSFORO INORGANICO | `2031`, `903837` | `resultadoFosforo` | `fechaResultFosforo` | HC Crónicos (Everest) |
| `ALBUMINA` | ALBUMINA EN SUERO, ALBÚMINA EN SUERO | `2002`, `903801` | `resultadoAlbumina` | `fechaResultAlbumina` | HC Crónicos (Everest) |
| `HEMOGLOBINA` | HEMOGLOBINA | `2034`, `902207` | `resultadoHemoglobina` | `fechaResultHemoglobina` | HC Crónicos (Everest) |

---

## 2. Catálogo de Escritura y Ordenamiento Médico (CUPS)

| Analito Clínico | CUPS de Escritura | Texto Literal del Ítem (`<li>`) en Conducta | Fuente del Código |
|---|---|---|---|
| **HbA1c** | `903426` | `HEMOGLOBINA GLICOSILADA AUTOMATIZADA` | Orden real Everest `ObtenerOrdenamientoPorPacienteIdVigente` |
| **PTH** | `904921` | `HORMONA PARATIROIDEA MOLECULA INTACTA` | Catálogo Oficial de Laboratorio Everest |
| **Fósforo** | `903837` | `FOSFORO EN SUERO U OTROS FLUIDOS` | Catálogo Oficial de Laboratorio Everest |
| **Albúmina** | `903801` | `ALBUMINA EN SUERO U OTROS FLUIDOS` | Catálogo Oficial de Laboratorio Everest |
| **Hemoglobina** | `902213` | `HEMOGLOBINA` | Catálogo Oficial de Laboratorio Everest |

---

## 3. Motor Renal y Estadificación

### 3.1. Ecuaciones Implementadas
- **Cockcroft-Gault (CrCl en mL/min):**
  $$\text{CrCl} = \frac{(140 - \text{edad}) \times \text{peso}}{72 \times \text{creatinina}} \times (0.85 \text{ si mujer})$$
  *Unidades:* Edad [18–120 años], Peso real [20–300 kg], Creatinina sérica [0.1–20 mg/dL].
  *Rol:* Estadio administrativo ante la aseguradora (EPS) para fijar frecuencias y vigencias.
- **CKD-EPI 2021 (eGFR en mL/min/1.73 m²):**
  $$\text{eGFR} = 142 \times \min(\text{Scr}/\kappa, 1)^\alpha \times \max(\text{Scr}/\kappa, 1)^{-1.2} \times 0.9938^{\text{Edad}} \times (1.012 \text{ si mujer})$$
  *Rol:* Estadio clínico fisiológico.
- **Detección de Discordancia:** Se emite alerta visual si la diferencia entre Cockcroft-Gault y CKD-EPI supera **2 estadios KDIGO**.

### 3.2. Cortes de Estadio KDIGO
- **G1:** $\ge 90 \text{ mL/min/1.73m²}$
- **G2:** $60 - 89.9 \text{ mL/min/1.73m²}$
- **G3a:** $45 - 59.9 \text{ mL/min/1.73m²}$
- **G3b:** $30 - 44.9 \text{ mL/min/1.73m²}$
- **G4:** $15 - 29.9 \text{ mL/min/1.73m²}$
- **G5:** $< 15 \text{ mL/min/1.73m²}$

---

## 4. Tabla de Vigencias ERC por Estadio (Tabla 50 Everest RCV)

| Examen / Analito | G1 | G2 | G3a | G3b | G4 |
|---|:---:|:---:|:---:|:---:|:---:|
| **Creatinina Sérica** | 180 d | 180 d | 90–121 d | 90–121 d | 60–93 d |
| **Glicemia Basal** | 180 d | 180 d | 180 d | 180 d | 60 d |
| **Parcial de Orina** | 180 d | 180 d | 180 d | 180 d | 120 d |
| **Hemoglobina** | 365 d | 365 d | 365 d | 365 d | 180 d |
| **PTH** | BLOQUEADO | BLOQUEADO | 365 d | 365 d | 180 d |
| **Albúmina en Suero** | BLOQUEADO | BLOQUEADO | BLOQUEADO | 365 d | 365 d |
| **Fósforo en Suero** | BLOQUEADO | BLOQUEADO | BLOQUEADO | 365 d | 365 d |
| **Colesterol Total / Triglicéridos** | 180 d | 180 d | 180 d | 180 d | 120 d |
| **LDL** | 180 d | 180 d | 180 d | 180 d | 120 d |
| **HDL** | 180 d | 180 d | 180 d | 180 d | 180 d |
| **Microalbuminuria** | 180 d | 180 d | 180 d | 180 d | 180 d |
| **HbA1c (en Diabéticos)** | 180 d | 180 d | 180 d | 180 d | 120 d |

---

## 5. Reglas de Exclusión de Promoción y Mantenimiento (PyM)

- **Actividades Ocultas (Meta Cumplida en la IPS):** VDRL, Sífilis, Hepatitis B (`HBV`/`VHB`), Hepatitis C (`HVC`/`VHC`).
- **Invariante Clínico de Seguridad No Negociable:** **VIH NUNCA SE OCULTA** bajo ninguna circunstancia o configuración.
