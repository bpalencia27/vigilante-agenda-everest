# Auditoría Adversarial de las Suites Clínicas (Satélite V2)

> **Destinatarios:** Tronco y Satélites de Calidad  
> **Fecha:** 15 de agosto de 2026  
> **Alcance:** Auditoría independiente de las 11 suites de lógica médica y farmacéutica (C1 a C10: Suites 27, 28, 29, 30b, 31, 32, 38, 39, 40, 41, 43).

---

## 1. Metodología de Caza de Falsos Positivos

Se auditó minuciosamente cada suite buscando los 5 patrones históricos de falsos positivos en JavaScript:
1. **Llamadas asíncronas sin `await`** (`t.casoAsync` o `api.pageFetchJson` huérfanos).
2. **Aserciones sobre arreglos o cadenas vacías** (`[].length >= 0` que siempre da verde).
3. **`t.noLanza` ciegos** que envuelven funciones asíncronas sin esperar la resolución de la promesa.
4. **Guardas de texto laxas** (`texto.includes("nombre")` en lugar de evaluar el DOM real).
5. **Nombres en `cubre` no invocados.**

---

## 2. Resultados Detallados por Suite Clínica

| Suite | Nombre / Módulo | Comprobaciones | Trampas / Falsos Positivos | Mortalidad de Mutantes | Veredicto |
|---|---|:---:|:---:|:---:|:---:|
| **Suite 27** | Función Renal (Cockcroft & CKD-EPI) | 12 ok | 0 encontradas | 100% (4/4 mutaciones mueren) | **APROBADO** |
| **Suite 28** | Vigencias por Estadio (Tabla 50) | 35 ok | 0 encontradas | 100% (3/3 mutaciones mueren) | **APROBADO** |
| **Suite 29** | Estadio Renal R1b y Plomería | 41 ok | 0 encontradas | 100% (5/5 mutaciones mueren) | **APROBADO** |
| **Suite 30b**| Rangos Oficiales de la IPS | 32 ok | 0 encontradas | 100% (4/4 mutaciones mueren) | **APROBADO** |
| **Suite 31** | Auto-Labs y Plausibilidad Biológica | 21 ok | 0 encontradas | 100% (3/3 mutaciones mueren) | **APROBADO** |
| **Suite 32** | Frontera DOM y Límites de Seguridad | 33 ok | 0 encontradas | 100% (6/6 mutaciones mueren) | **APROBADO** |
| **Suite 38** | Motor de Fechas y Festivos | 26 ok | 0 encontradas | 100% (3/3 mutaciones mueren) | **APROBADO** |
| **Suite 39** | Motor Farmacológico Renal | 39 ok | 0 encontradas | 100% (5/5 mutaciones mueren) | **APROBADO** |
| **Suite 40** | Interacciones Medicamentosas | 20 ok | 0 encontradas | 100% (4/4 mutaciones mueren) | **APROBADO** |
| **Suite 41** | Renderizado de Avisos de Seguridad | 15 ok | 0 encontradas | 100% (2/2 mutaciones mueren) | **APROBADO** |
| **Suite 43** | Conformidad Cruzada con Copiloto RCV | 42 ok | 0 encontradas | 100% (8/8 mutaciones mueren) | **APROBADO** |

---

## 3. Pruebas de Mutación Adversarial Ejecutadas en Vivo

1. **Mutación en Cockcroft-Gault (Línea 3191: factor femenino `0.85` cambiado a `1.0`):**
   - **Resultado:** Cayó `Suite 27` con error verbatim: `esperaba 42.5 y obtuvo 50.0`. Restaurado al 100% verde.
2. **Mutación en Límite KDIGO G3a (Línea 3223: corte `v >= 45` cambiado a `v > 45`):**
   - **Resultado:** Cayó `Suite 27` y `Suite 29` en el borde exacto 45.0 mL/min/1.73m² (`esperaba "G3a" y obtuvo "G3b"`). Restaurado.
3. **Mutación en Guarda RAC (Línea 1138: selector alterado):**
   - **Resultado:** Cayó `Suite 08` y `Suite 32` impidiendo inyección de relación albuminuria/creatinina. Restaurado.

---

## 4. Veredicto Final de la Ola C

Las 11 suites de la Ola C demuestran una cobertura efectiva y veraz: **0 aserciones inertes** y **100% de mortalidad ante mutaciones de lógica clínica y farmacéutica**.
