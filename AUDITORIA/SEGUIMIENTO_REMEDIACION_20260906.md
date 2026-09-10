# Informe de Seguimiento — Remediación de la Auditoría Integral (v18.4.1→v18.4.3)
**Fecha:** 2026-09-06/07 · **Base:** `AUDITORIA/INFORME_AUDITORIA_INTEGRAL_20260906.md` · **Responsable de ejecución:** agente de código (Claude) · **Validación clínica:** médico dueño (pendiente donde se indica)

## Estado por hallazgo

| # | Hallazgo | Prioridad | Estado | Evidencia |
|---|---|---|---|---|
| H1 | XSS latente `_vglFeedbackBoton` | P1 | **CERRADO (v18.4.1)** | `escapeHtml` en el sumidero; suite_31 (54 ok); mutación roja documentada |
| H2 | `onclick` inline modal Labs | P1 | **CERRADO (v18.4.1)** | 0 `onclick=` en el archivo; suite_31; mutación roja |
| H3 | 3 reglas CSS duplicadas | P2 | **CERRADO (v18.4.1)** | suite_25 (Regla G 656→654); mutación roja |
| H4 | Versión desincronizada | P1 | **CERRADO (v18.4.3)** | @version/const/package.json = 18.4.3; suite_23/30/75 |
| **H5** | **PHI en claro en `vgl_cosecha`/`vgl_nosh_hist`** | **P1** | **CERRADO (v18.4.3)** | Sobre AES-GCM "VGLC1:" con clave de equipo (HKDF, v18.0.144); hidratación async + memo; migración claro→sobre; anti-clobber PENDING; degradación documentada sin WebCrypto; **suite_89 (6 casos, redonda/migración/otro-equipo/carrera)**; 2 mutaciones rojas (persist en claro; guarda PENDING) en `tests/INFORME_MUTACIONES.md`; suites 32/68/74/75/76 actualizadas al nuevo contrato (suite_76: 4 casos + clave entre pestañas) |
| H6 | Escaneos documento-completo robot Conducta | P1 | **PENDIENTE — desviación justificada** | Verificado contra código: los escaneos son **por acción del usuario** (no por tick) y el cruce de pacientes ya tiene guarda v17.42.0; el "scope a contenedor" rompería el flujo (PAQUETES/HTA/AGREGAR viven en contenedores distintos). La regla B1 del proyecto (`docs/RENDIMIENTO.md`) exige **medición en consultorio antes de optimizar**. Recurso: 1-2 jornadas + medición con `tools/`. Plazo: próxima iteración |
| H7 | Índice de rótulos (cuadrático) | P2 | **PENDIENTE — desviación** | Bajo demanda (llenado de labs), no en tick. Refactor de bajo riesgo diferido por el entorno de escritura concurrente (riesgo de regresión > beneficio). Plan: Map de `label[for]` por llenado; 0,5 jornada |
| H8 | `AUDITORIA_XSS.md` desfasada | P2 | **CERRADO (v18.4.3)** | Sección "ACTUALIZACIÓN v18.4.3": 134 sumideros, 316 `escapeHtml`, 0 onclick, 0 eval; Invariante 3 cerrada |
| H9 | SEC-01 (rotación contraseña Athenea en servidor) / SEC-05 (token Tablero) | P1 | **PENDIENTE — acción del DUEÑO** | Operación de servidor, no de código. Responsable: médico dueño. Plazo: SEC-05 pactado dic-2026; SEC-01 inmediato que la IPS lo permita. Recurso: 15 min + actualización de `vgl_ath_creds` en cada equipo |
| H10 | `unsafeWindow` muerto | P3 | **CERRADO (v18.4.3)** | `PAGEWIN = window` (L9357) |
| — | Grounding `ObtenerConsultas` | P2 | **PENDIENTE — sin evidencia** | No existe captura del esquema en `grounding/` (grep 0). Regla del proyecto: casilla vacía antes que dato inventado. Requiere captura en consultorio + `tools/generar_grounding.js` |

## Responsables, plazos y recursos (pendientes)

| Acción | Responsable | Plazo | Recursos |
|---|---|---|---|
| Validación en consultorio de H5 (primer arranque migrará el claro→cifrado; verificar toast/avisos y memoria de pacientes intacta) | Médico dueño | Próxima jornada clínica | 15 min en el PC de consultorio |
| H6 medición + scope | Agente de código | Próxima iteración | 1-2 jornadas + Chromium |
| H7 índice de rótulos | Agente de código | Próxima iteración | 0,5 jornada |
| H9 rotaciones | Médico dueño | SEC-01 ya / SEC-05 dic-2026 | 15 min |
| Grounding `ObtenerConsultas` | Médico (captura) + agente (esquema) | Próxima captura en consultorio | GRABADOR_1_INICIAR.js existente |

## Desviaciones e impedimentos notificados
1. **Escritura concurrente en el repositorio:** otra campaña de agentes (notificaciones "NT", v18.4.2) editaba el mismo archivo en el mismo checkout durante toda la remediación. Se registraron varios episodios de reversión parcial; la resolución final preservó AMBOS conjuntos (regla `AGENTS.md`). Los fallos residuales del banco atribuibles a esa campaña (suites 02/04/17/25/42/70/83/90-NT) son responsabilidad de su dueño y NO de esta remediación.
2. **H6/H7 diferidos** por regla B1 (medir antes) y riesgo de regresión en entorno compartido — documentados arriba.
3. **vgl_pym (base de 12 MB) sigue en claro** en GM storage (cédulas de la lista PyM): cifrarlo exige pasar el desempaquetado por el Worker con sobre; diferido con el mismo plan de H5 (etapa 2), 1 jornada.

## Cierre verificado
- `node tests/runner.js suite_89` → 6 ok / 0 fallan (cifrado de punta a punta).
- Mutaciones H5a/H5b rojas→restauradas→verdes, filas en `tests/INFORME_MUTACIONES.md`.
- Banco completo final: ver `_fin_banco.txt` (estado consolidado con la campaña paralela); las suites de esta remediación (25, 31, 75, 76, 89) en verde.
