# SANEAMIENTO — v18.3 (P12), 05-sep-2026

Pista A del prompt `06_saneamiento_rendimiento`. Fuente de verdad de esta pasada:
`vigilante_agenda.user.js` v18.3 (post-P13, 51.059 líneas físicas / 3.245 KB), banco
3.380 en verde antes de empezar. La lista del prompt (v18.0.143) venía **desfasada**:
cada nombre se re-verificó con grep propio contra producción Y tests antes de veredicto.

## Qué se hizo en esta pasada

1. **2 constantes borradas** (excepción "borrado inmediato": grep de uso = solo su
   definición). Sus comentarios históricos NO se borraron: quedaron re-hospedados junto
   a la función viva que documenta su dominio.
   - `PYM_SIN_ACT_MOTIVOS` (era ~L11718) — duplicaba en array los literales que
     `pymMotivoSinActividades` devuelve en línea. Los bloques v18.0.43 y v18.0.139
     (pedido del médico del 4-sep) ahora viven justo encima de esa función.
   - `MTR_SEVERIDAD_RIESGO` (era ~L41257) — mapa de severidad sin lector (el trinquete
     se implementó con la clasificación por pasos, no con este mapa). El comentario del
     trinquete ahora vive sobre `mtrClasificarRiesgoCv`, donde el orden existe de verdad.
2. **3 funciones en cuarentena** — primera línea `uxTrack("zombi.<nombre>")`
   (publicación ~2 semanas; si la telemetría no las reporta, el siguiente pase las borra):
   `mtrIaClickDelegado`, `mtrIrAPestanaPorNombre`, `_mtrPrimerCampoNumerico`.
3. **suite_84_saneamiento** fija estructuralmente A-D (constantes fuera, memoria
   re-hospedada, marcadores exactamente 3, lo protegido por F1 se queda).

## Tabla de veredictos — las 24 funciones

| # | Función | Veredicto | Razón (seis palabras) |
|---|---|---|---|
| 1 | `mtrIaClickDelegado` | CUARENTENA | listener nunca registrado en `boot()` |
| 2 | `mtrIrAPestanaPorNombre` | CUARENTENA | atajo de pestaña sin llamador |
| 3 | `_mtrPrimerCampoNumerico` | CUARENTENA | helper de TA sin consumidor |
| 4 | `_cancelPlantillaBorrar` | ES UN DEFECTO | la limpieza nunca se ejecuta |
| 5 | `_vglAvisoContextoFaltante` | SE QUEDA | suite_63 la ejercita ×4 |
| 6 | `mtrBotonOrdenarConducta` | SE QUEDA | suite_71 la ejercita ×6 |
| 7 | `mtrOcultarBotonOrdenarPendientes` | SE QUEDA | suite_71 la ejercita ×3 |
| 8 | `_vglDeshacerLoteInfo` | SE QUEDA | suite_74 la ejercita ×3 |
| 9 | `debounceVgl` | SE QUEDA | suite_01 la ejercita |
| 10 | `_procEscrituraFallida` | SE QUEDA | suite_19 la ejercita ×2 |
| 11 | `apiDigiturnoFinalizarTicket` | SE QUEDA | suite_13 + mutantes propias |
| 12 | `_signosVitalesInvalidar` | SE QUEDA | suite_29 la ejercita |
| 13 | `_pesoDeSignosVitales` | SE QUEDA | suites 29/34 + mutantes KDIGO |
| 14 | `_demograficosInvalidar` | SE QUEDA | suites 15/32/34 la llaman |
| 15 | `_smsVistaPrevia` | SE QUEDA | suite_61 la ejercita ×3 |
| 16 | `_noShowPrevia` | SE QUEDA | suites 04/68 — lista prompt desfasada |
| 17 | `mtrSumarDiasHabiles` | SE QUEDA | suite_43 + golden json |
| 18 | `mtrPrincipioEnTexto` | SE QUEDA | suite_39 la ejercita ×3 |
| 19 | `mtrSabadoFijarGrupoManual` | SE QUEDA | suite_46 la ejercita |
| 20 | `mtrInsertarSiVacia` | SE QUEDA | suite_58 la ejercita ×3 |
| 21 | `mtrRenderResumenClinicoHtml` | SE QUEDA | suite_47 la ejercita mucho |
| 22 | `mtrChipResumenTexto` | SE QUEDA | suite_47 la ejercita ×3 |
| 23 | `mtrItemSugeridoEnRango` | SE QUEDA | suite_50 la ejercita ×5 |
| 24 | `_deshacerOrdenesPyM` | SE QUEDA | suite_53 la ejercita (ver defecto 3) |

## Tabla de veredictos — las 5 constantes

| Constante | Veredicto | Razón (seis palabras) |
|---|---|---|
| `PYM_SIN_ACT_MOTIVOS` | **BORRADA** | sin lector; comentarios re-hospedados |
| `MTR_SEVERIDAD_RIESGO` | **BORRADA** | sin lector; trinquete vive en clasificación |
| `MTR_CORRECCIONES_NORMA` | SE QUEDA | documentación clínica ejecutable con fuentes |
| `CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO` | SE QUEDA | harness + suites 08/32 |
| `VGL_MODALES_ESCRITURA` | SE QUEDA | harness + suite_15 |

## Defectos reportados (NO arreglados: arreglarlos cambia comportamiento visible)

1. **Botón "Redactar con IA" muerto.** `mtrRenderResumenClinicoHtml` pinta
   `#vgl-ia-redactar` cuando `S.iaRedaccion === true`, pero `mtrIaClickDelegado`
   dejó de registrarse en `boot()` (v18.0.x, CHANGELOG:1964 retiró el registro y dejó
   la función). Hoy el botón sale y no hace nada. Arreglo propuesto (decisión del
   dueño): o registrar el listener, o dejar de pintar el botón. Mientras tanto la
   función está en cuarentena con marcador.
2. **`CANCEL_PLANTILLA_KEY` nunca se limpia.** Se escribe (`writeJSON`, L~23312) y se
   lee (`_cancelPlantillaLeer`), pero `_cancelPlantillaBorrar` — el único
   `localStorage.removeItem` de esa clave — no tiene llamador: la marca de plantilla
   cancelada vive para siempre y puede releerse tras recargar. Arreglo propuesto:
   llamar al borrar al consumir la marca.
3. **`_deshacerOrdenesPyM` sin camino de UI.** La acción existe y suite_53 la prueba,
   pero ningún botón la invoca en producción (ya documentado en
   `docs/AUDITORIA_EXPERIENCIA.md` §494): el "deshacer" de órdenes PyM no es
   alcanzable por el médico.

## Reglas respetadas

- Un cambio por vez, banco verde entre cambios, mutación verificada por cambio
  (ver `tests/INFORME_MUTACIONES.md`, filas de P12).
- Cero cambios de comportamiento visible: los 3 marcadores `uxTrack` son telemetría
  (ya existe, try/catch interno, respeta `S.uxTelemetria`); ninguna regla clínica tocada.
- La memoria del proyecto no se borra: 100 % de los comentarios de las piezas
  retiradas fue re-hospedado o convertido en nota de retirada con versión y motivo.
