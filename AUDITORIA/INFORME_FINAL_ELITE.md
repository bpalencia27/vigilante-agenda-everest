# INFORME FINAL — Auditoría élite del Vigilante de Agenda v18.3.6 → v18.3.7

**Fecha:** 2026-09-06 · **Equipo:** SA-LOG (orquestación), SA-PROG, SA-DIS, SA-HCE (subagentes)
· **Encargo:** `SUPERPROMPT_AUDITORIA_ELITE.md` + orden del propietario: auditar 18.3.6
integralmente, clasificar por criticidad y ejecutar todas las correcciones derivadas.
· **Registro maestro de hallazgos:** `AUDITORIA/REGISTRO_ELITE.md` (AE-001…AE-020).

---

## 1. Alcance y baseline

| | Antes | Después |
|---|---|---|
| Versión auditada / entregada | 18.3.6 (`8aeff8f`, = `origin/HEAD`) | **18.3.7** (`6477423`, rama `claude/auditoria-elite-1836`) |
| sha256 userscript | `C332A89E…B43DBB5` | `E76E2BF1…FEE7207C` |
| Líneas / bytes | 51.287 / 3.388.806 | 51.291 / 3.389.669 |
| Banco | 3.400/0 (18.3.5, worktree principal) · 3.399/1 flake (18.3.6, wt-barrera) | **3.402 pasan / 0 fallan** (+2 casos nuevos exactos) |

Alcance del barrido: delta **v18.0.137 → 18.3.6** (+3.300/−495 líneas, ~80 hunks:
escalera z.ai P9, barrera P10, compuerta P11, saneamiento P12, observabilidad P13,
carpeta cifrada v18.0.144, fixes M2M) + re-verificación de TODAS las invariantes de
dominio y de los hallazgos de las auditorías previas (v18.0.137, cerradas).

## 2. Hallazgos por criticidad (20; detalle y evidencia en REGISTRO_ELITE.md)

**ALTO (S1) — 1, en verificación:** AE-012 capturas `captura_*.json` en la raíz de
wt-barrera con perfil completo de paciente; marcadores sintéticos (CC secuenciales,
@ejemplo.com) sugieren paciente de pruebas, pero NO es verificable desde el repo.
**REQUIERE CONFIRMACIÓN DEL AUTOR**: si fueran reales → S0 (PHI expuesta) y hay que
retirarlas de todo repo compartido.

**MEDIO (S2) — 4, todos resueltos:** AE-008 catch mudos en la barrera P10 (ARREGLADO,
fail-closed), AE-006 ancla de integridad inerte (ARREGLADO, 18.3.7+sha), AE-019
fantasma de edición paralela (ARREGLADO, protocolo secuencial), AE-020 bump evitado
a tiempo por la revisión cruzada (ARREGLADO, quíntuple 18.3.7).

**MEDIO-BAJO (S3) — 6:** AE-010 catch mudo de latidos (ARREGLADO), AE-007 CHANGELOG
6 parches atrás (ARREGLADO), AE-009 FNV-1a sin sal en obs* (EN COLA — decisión del
médico), AE-013 purga 12 m sin instalar (EN COLA), AE-014 fuentes normativas
pendientes (EN COLA — regla dura: nada de memoria), AE-017 hallazgos A/B disco
(SIGUEN en COLA_FUTURO, como la auditoría previa los dejó).

**BAJO (S4) / descartados:** AE-003 variantes optimized, AE-004 MAPA desfasado,
AE-005 cobertura 77,1%, AE-011 flake ANTIDUP (carga), AE-015 «Dra. Gloria»
(intencional), AE-016 comentario CI (ARREGLADO).

**DICTAMEN LIMPIO:** AE-018 — las 10 invariantes de dominio INTACTAS (eje de
puntualidad, apptKey+hora, diaNuevo, VIH nunca oculto, marcas antiduplicado con
confirmación real, anti-repintado, escapeHtml único, contratos de
mtrRecalcularConFactores). Cero S0 confirmados. Cero PHI en userscript y tests
(barrido por patrones, 0 reales).

## 3. Modificaciones realizadas (commit 6477423, diff 169+/11−, 10 archivos)

| Hallazgo | Cambio | Prueba | Mutación |
|---|---|---|---|
| AE-008 | D5/D6 de `mtrBarreraIdentificables` → fail-closed (`detector_error`) | suite_81 P10·7 (estructural + funcional vm) | M1/M2 muertas |
| AE-010 | `console.warn` en catch de `_instalarLatidosBase` | suite_82 P11·22 (estructural) | M3 muerta |
| AE-006+AE-020 | Ancla VersionCheck → 18.3.7 + sha `e76e2bf1…`; bump quíntuple | suites 23/30/74 (sincronía) | n/a (constantes) |
| AE-007 | CHANGELOG 18.3.1–18.3.7 + fechas reales | suite_36 (lint clínico) — cazó y corrigió una redacción mía | n/a (docs) |
| AE-016 | Comentario CI 266→MIN_COVERAGE | n/a (comentario) | n/a |

Cada mutación se restauró antes de la siguiente; filas al final de
`tests/INFORME_MUTACIONES.md` (formato intacto).

## 4. Pruebas de validación ejecutadas

- `node tests/runner.js` (banco completo, desacoplado): **3.402 pasan / 0 fallan**.
- Suites aisladas en cada ciclo: 81 (7/0), 82 (23/0), 36 (17/0), 15 (269/0).
- `node --check` en userscript y 5 suites/E2E tocados.
- El propio banco cazó 2 incidentes del proceso (lint CHANGELOG; sincronía de versión
  tras el fantasma de edición) — demostración de que las trampas siguen armadas.

## 5. Matriz normativa (SA-HCE; sin casillas inventadas)

| Marco | Estado |
|---|---|
| Ley 1581/2012 (habeas data) | Cumple (TERMINOS v1.1, derechos ARCO citados) |
| Resolución 1995/1999 (HC) | Cumple como estándar del redactor (4 citas en código) |
| Res. 2292/2021, 2808/2022, 2336/2023 (CUPS) | Cumple (inventario con jerarquía de confianza) |
| Ley 51/1983 (festivos) | Cumple |
| Consentimiento P11 (constancia {versión, ts, id}, fail-closed) | Cumple (verificado en código + suite_82) |
| Carpeta cifrada v18.0.144 (HMAC + AES-GCM) | Cumple (L32520-32563) |
| Barrera IA P10 (cero identificables) | Cumple (y AHORA fail-closed ante detector roto) |
| Decreto 1377/2013 · Ley 23/1981 · habilitación · vigencias Res. 3280 (VIH/SOMF) · purga 12 m | **PENDIENTE DE FUENTE** (AE-013/AE-014 — regla dura del proyecto) |

## 6. Dictamen de arquitectura (SA-DIS)

El IIFE único se sostiene: un solo punto de salida de IA (2 URLs dentro de
`MTR_PROVEEDORES_IA`), un saneador central, compuerta fail-closed con entrada única,
timers/listeners nuevos registrados y barridos. Deuda restante documentada:
288 funciones sin cubrir (77,1%), 2 nunca nombradas, hallazgos A/B del disco,
unificación de paleta vetada sin orden del médico.

## 7. Revisión cruzada (F5)

Dictamen del revisor independiente: 7 puntos, 1 objeción CRÍTICA (bump/ancla —
resuelta como AE-020 ANTES de publicar), 2 menores (fechas CHANGELOG, línea D6 —
resueltas), 2 nits informativos. Sin discrepancias abiertas.

## 8. Cola del médico (decisiones pendientes, con opciones)

1. **AE-012 (URGENTE)**: ¿los `captura_*.json` de la raíz son de un paciente de
   pruebas? SÍ → moverlos fuera de todo repo compartido; NO → retirarlos YA.
2. **AE-009**: sal para FNV-1a de obs* — Opción A: sal por equipo/día (cierra la
   re-identificación, no permite unir filas entre días) · Opción B: hash más largo
   con sal fija por equipo (une días, sigue fuerzabruteable offline) · Opción C:
   dejar como está (documentado el riesgo).
3. **AE-017 (heredada)**: hallazgos A/B del disco (COLA_FUTURO.md, opciones A-D ya
   escritas por la auditoría previa).
4. **AE-013**: instalar `docs/tablero_purga_12m.gs` en el tablero (la promesa de
   retención del aviso depende de esa tarea manual).
5. **AE-014**: completar fuentes normativas pendientes con asesoría (nada de memoria).
6. **Publicación (S6)**: la rama `claude/auditoria-elite-1836` queda lista para
   publicar 18.3.7 — pegar el archivo EXACTO en el Gist y re-verificar el raw
   (`grep '@version'`), luego actualizar el tablero si hace falta.

## 9. Certificación (condicionada, jamás optimista)

- **SA-PROG**: banco 3.402/0 post-cambio; 3 mutaciones muertas; 0 S0/S1 abiertos en
  producto. **Certifica** los criterios 1, 3, 5, 6, 9, 10, 11 de §4.
- **SA-DIS**: arquitectura íntegra, sin segundas fuentes de verdad nuevas; CHANGELOG
  y anexos veraces. **Certifica** 7, 8, 13. La deuda viva está inventariada, no negada.
- **SA-HCE**: 0 PHI confirmadas; barrera P10 reforzada; matriz normativa con 5 marcos
  cumplidos y 5 **pendientes de fuente** (AE-013/014). **Certifica** 2, 4, 12 con esa
  salvedad.
- **SA-LOG**: cadena hallazgo→tarea→commit→prueba→mutación→banco reconstruible leyendo
  REGISTRO_ELITE.md + 6477423 + INFORME_MUTACIONES.md. **Certifica** 14 (cola con
  opciones, cero decisión ajena) — a excepción de AE-012, que exige la voz del autor.

**La palabra final de despliegue es del médico, siempre.**
