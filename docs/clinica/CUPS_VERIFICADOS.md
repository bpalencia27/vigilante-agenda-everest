# Estado de Verificación de Códigos CUPS y Laboratorios

> **Regla de Clasificación:**
> - `VERIFICADO`: Contrastado contra orden real guardada o captura literal en consultorio.
> - `DISCREPANTE`: Divergencia detectada entre catálogo de lectura y escritura o código previo erróneo corregido.
> - `SIN VERIFICAR`: Pendiente de contrastar contra Resolución oficial en `docs/fuentes/`.

---

## 1. Matriz de Laboratorios y CUPS

| Analito | Código en Script | Estado | Justificación / Fuente |
|---|:---:|:---:|---|
| **Colesterol Total** | `903818` / `2009` | **VERIFICADO** | Confirmado en telemetría de laboratorio Athenea y orden de Everest. |
| **Colesterol HDL** | `903815` / `2015` | **VERIFICADO** | Confirmado en telemetría de laboratorio Athenea. |
| **Colesterol LDL** | `903817`, `903816` / `2014` | **VERIFICADO** | Desambiguado entre enzimático y directo en LIS. |
| **Triglicéridos** | `903868` / `2074` | **VERIFICADO** | Corregido de `903866` (TGP/ALT) a `903868` confirmado en consultorio. |
| **Uroanálisis** | `907106` / `2095` | **VERIFICADO** | Confirmado en telemetría Athenea y radio SI/NO en DOM. |
| **Glucosa** | `903841` / `2013` | **VERIFICADO** | Confirmado en telemetría de laboratorio Athenea. |
| **Relación Albúmina/Creatinina (RAC)** | `8779` | **VERIFICADO** | Código interno LIS Athenea para relación en orina (mg/g). |
| **Creatinina** | `903895` / `2028` | **VERIFICADO** | Confirmado en telemetría sérica (con guardas contra orina). |
| **HbA1c (Escritura)** | `903426` | **VERIFICADO** | Orden real Everest `ObtenerOrdenamientoPorPacienteIdVigente` (Automatizada). |
| **HbA1c (Lectura LIS)** | `903843` / `2035` | **VERIFICADO** | Confirmado en telemetría Athenea. |
| **PTH** | `904921` / `2065` | **VERIFICADO** | Molécula intacta confirmada en catálogo Everest. |
| **Fósforo** | `903837` / `2031` | **VERIFICADO** | Fósforo inorgánico en suero confirmado en catálogo Everest. |
| **Albúmina** | `903801` / `2002` | **VERIFICADO** | Albúmina en suero u otros fluidos confirmada en catálogo Everest. |
| **Hemoglobina (Lectura)** | `902207` / `2034` | **VERIFICADO** | Lectura LIS Athenea. |
| **Hemoglobina (Escritura)** | `902213` | **VERIFICADO** | Ordenamiento en Everest. |
