# INFORME — Mesa de Expertos: auditoría, refactorización y mejora integral

Encargo: `PROMPT_MESA_EXPERTOS_20260908.md`. Ejecutado como workflow (enjambre de
subagentes de solo lectura) en 2 tandas por límite de sesión — `wf_3200c15d-dca`,
90/90 agentes completados en la segunda, la primera reutilizada desde caché.
Cero PHI en este documento.

## 1. Resumen ejecutivo

- **91 hallazgos crudos** de 10 subsistemas × 4 roles (arqueóloga del código
  muerto, cartógrafa de flujos, simplificadora, experta en UX clínica).
- Los 11 candidatos a "código muerto" pasaron una **segunda ronda de
  verificación adversarial**: 2 refutadores independientes por candidato,
  instruidos a intentar demostrar que SÍ tenían uso real antes de aceptar el
  veredicto. 14 candidatos adicionales (de otro origen, ver `muertas
  descartadas` abajo) resultaron tener consumidor real y se descartan sin
  tocarlos.
- **Tanda 1, aplicada en esta entrega** (v18.12.0): 7 de los 11 "código muerto
  confirmado" + 1 mejora de accesibilidad (UX). 7 mutaciones verificadas.
  Banco completo en verde antes y después.
- **Quedan ~83 hallazgos triados por bucket A/B/C** (detalle en §3-6) para
  tandas siguientes — no se implementaron todos en esta entrega y este informe
  lo dice sin maquillar.

## 2. Metodología

10 subsistemas (arranque, tick, dock, historia_clinica, ordenamientos,
aviso_universal, agendar, labs, telemetria, teardown) × 4 roles = 40 agentes de
inventario (solo lectura, con pistas de búsqueda por subsistema, prohibido leer
el archivo completo — solo `Grep` + ventanas de `Read`). Para cada hallazgo de
tipo "código muerto", 2 agentes adicionales intentaron refutarlo buscando
cualquier invocación real (directa, indirecta por string/mapa de acciones,
desde `tests/*.js`); ante la duda, el refutador debía marcar "sigue vivo" (un
falso positivo — borrar algo que sí se usa — es peor que dejar código muerto
sin tocar). El triaje A/B/C y la implementación los hizo una sola mano (el
coordinador), como exige el encargo: los agentes entregan hallazgos, nunca
código.

**Criterio de triaje** aplicado de forma consistente:
- **A (aplicar ya)**: confianza alta + riesgo bajo + beneficio claro + no toca
  código clínico sensible (consentimiento, kill-switch, candado de versión,
  alertas ROJO, escritura en la historia).
- **B (aplicar con más trabajo)**: beneficio real pero exige más pruebas,
  toca un flujo con más superficie, o el esfuerzo de instrumentación es mayor
  que el de un fix de una línea.
- **C (documentar, no tocar)**: riesgo ≥ medio en código sensible para un
  beneficio que es solo de claridad/mantenibilidad, o requiere una decisión de
  producto/clínica que le corresponde al médico, no al coordinador.

## 3. Código muerto (11 hallazgos, verificado con doble refutación adversarial)

| # | Ubicación | Bucket | Estado |
|---|---|---|---|
| 1 | `verificarIntegridadArranque(fuenteOpcional)` — parámetro fantasma | A | **Aplicado** (v18.12.0) |
| 2 | `mtrCompuertaPerfil()` — valor de retorno detallado que su único llamador ignora | C | Documentado, no tocado — toca la compuerta de consentimiento; beneficio solo de claridad |
| 3 | `colorAndAlert()` — variable `callar` nunca se activa (comentario v18.0.4 desactualizado) | C | Documentado, no tocado — toca alertas ROJO; la protección real ya existe por otra vía (`!_conto`) |
| 4 | Comentarios de `tick()` que citan 4 funciones ya eliminadas | A | **Aplicado** (v18.12.0) |
| 5 | `rcvPendientesTick(doc)` — parámetro fantasma (usaba `document` global) | A | **Aplicado** (v18.12.0) |
| 6 | `mtrIrAPestanaPorNombre` — sin llamador | B (proceso existente) | En cuarentena P12 desde `docs/SANEAMIENTO.md` (05-sep, vence ~19-sep) — se respeta el plazo del propio proyecto |
| 7 | `_mtrPrimerCampoNumerico` — sin llamador | B (proceso existente) | Igual que #6 |
| 8 | CSS `.vgl-agm-c5`/`.vgl-agm-c7` — huérfanas | A | **Aplicado** (v18.12.0) |
| 9 | `_renderToast` — variable `tint` nunca leída | A | **Aplicado** (v18.12.0) |
| 10 | `EQUIPO_ID_KEY` — constante huérfana (migrada al módulo obs) | A | **Aplicado** (v18.12.0) |
| 11 | `restartPolling()` — variable `pollTimer` y su rama imposible | A | **Aplicado** (v18.12.0) |

### 3.1 Código muerto descartado por refutación (14 — SÍ tienen consumidor real, no tocar)

`#vgl-pym-banner`/`.vgl-pymb-*` (CSS, usado en teardown defensivo),
`mtrOcultarBotonOrdenarPendientes` (ejercitada por `suite_71`, consistente con
`docs/SANEAMIENTO.md` fila 7 — "SE QUEDA"), `_cwoDocPrevio` (uso parcial real),
`mtrRenderResumenClinicoHtml` + su clúster (candidato fuerte pero necesita una
segunda pasada — ver nota abajo), CSS `#vgl-riesgo-modal` (mismo clúster),
`_conductaClicPaqueteHTA` (rama que solo corre si `MTR_ANALITOS_PAQUETE_CONDUCTA`
deja de estar vacía — decisión clínica reversible, no muerto por accidente),
CSS `.vgl-ord-sexwarn` (reemplazado por filtro, con respaldo documental),
`citaId` en `apiCampos`/`apiParse` (inerte pero con nota propia del autor de
"se conserva porque el dato ya viene gratis"), `vigenciaPorEstadio` +
`RCV_VIGENCIA_ESTADIO_TABLA` (candidato fuerte, ver nota), `obsConsultaActiva`,
`obsConsultaElegible`, `obsConsultaMarcarModulo`, `obsAvisoCumplido`.

**Nota de calidad**: 3 de estos 14 (`mtrRenderResumenClinicoHtml`+clúster,
`#vgl-riesgo-modal` CSS, `vigenciaPorEstadio`+tabla) fueron marcados
"descartados" por los refutadores con un argumento débil o no concluyente
(evidencia de "podría reconectarse" en vez de "tiene un llamador real hoy").
Se recomienda una **tercera verificación dedicada** en la próxima tanda antes
de decidir sobre ellos — no se tocan en esta entrega precisamente porque la
evidencia no es lo bastante sólida ni para borrar ni para descartar con
confianza.

## 4. Callejones de flujo (21 hallazgos)

| # | Subsistema | Hallazgo (resumen) | Bucket |
|---|---|---|---|
| 1 | arranque | `boot()` tiene una puerta trasera (`vgl_override_kill`/`?vgl_bypass=1`) que anula el kill-switch remoto sin dejar rastro | **C — requiere decisión del médico**: ¿es un remanente de depuración a cerrar, o una vía de emergencia deliberada? No se toca sin su confirmación explícita (es el mecanismo de apagado remoto de seguridad) |
| 2 | arranque | `_terminosAlAceptar`/`_terminosAlRechazar`: `GM_setValue` sin su propio try/catch (el resto de la función sí lo tiene) | A — candidato para tanda 2, riesgo bajo |
| 3 | arranque | `verificarIntegridadArranque().catch(() => {})` es una guarda redundante (la función nunca rechaza) | A — candidato para tanda 2, riesgo bajo |
| 4 | tick | `_rumTramo` mide mal a `rcvPendientesTick` (única función async del grupo): el `finally` corre antes del `await` interno, subestimando su costo real en la telemetría RUM | B — requiere hacer `_rumTramo` consciente de promesas, o medir aparte; no es un cambio de una línea |
| 5 | tick | `_preconTick` envuelto en un `try/catch` redundante en `tick()` (la función ya no puede lanzar) | A — candidato para tanda 2, mismo patrón que #3 |
| 6 | dock | La pastilla de reapertura del panel RCV no se limpia fuera de la sección "historia" (incluido el modo oculto — hueco de privacidad) | A — candidato de buen beneficio (privacidad) para tanda 2 |
| 7 | dock | (duplicado de #4, mismo hallazgo visto desde el subsistema dock) | — (ver #4) |
| 8 | dock | `mtrBotonOrdenarConducta` sin llamador real (migrado a `mtrAnclaOrdenarPendientes` en v17.41.0) | B — verificar con una segunda pasada antes de tocar (nombre distinto al de la tabla de SANEAMIENTO.md) |
| 9 | dock | `mtrWidgetOrdenarConductaTick` no hace nada si el modo programador está apagado (¿pausa vigente o bug?) | C — es una pregunta para el médico, no una acción |
| 10 | historia_clinica | El mensaje al médico cuando el dead-man switch bloquea la escritura no distingue ese caso ("deadman") de los demás | B — mejora de claridad de mensaje; toca el flujo de escritura clínica, probar con cuidado |
| 11 | ordenamientos | Tras ordenar desde el modal de Paquetes, `repintar()` reutiliza datos viejos: la lista de "pendientes" no refleja lo que se acaba de agregar | B — bug de UI real, pero toca Conducta (área sensible); necesita pruebas dedicadas |
| 12 | aviso_universal | El candado de versión solo se evalúa UNA vez al arrancar; si la pestaña nace fuera de `/viva/HCHealth/` y navega ahí después, el bloqueo nunca se activa | **C — requiere decisión del médico**: toca el candado "irreversible" de actualización obligatoria, código de seguridad de máxima sensibilidad |
| 13 | agendar | `refrescarAgendaAhora` (rama 2) no verifica `API.enVuelo`: si el sondeo automático ya está leyendo, el botón manual reporta "falló" sin haber intentado nada | B — arreglable, pero exige probar bien el estado "en vuelo" compartido |
| 14 | agendar | `_procesarFuenteAgenda` nunca lee el campo `data.visible` que le pasan ambos llamadores | A — limpieza segura, candidato para tanda 2 |
| 15 | agendar | `refrescarAgendaAhora` (rama 1, "Citas del día") no tiene guarda contra clics repetidos (sí la tiene la rama 2) | B — relevante (evita clics duplicados sobre el botón REAL de Everest), pero probar con cuidado el flujo de clic nativo |
| 16 | labs | El reintento tras auto-login a Athenea no repite todos los avisos que sí da la rama principal | B — bajo impacto (escenario raro: sesión caída), esfuerzo moderado |
| 17 | labs | El mismo reintento tampoco abre el menú de interpretación de uroanálisis | B — misma área que #16, se resolverían juntos |
| 18 | telemetria | `obsConsultaElegible`/`obsConsultaMarcarModulo` (denominador/numerador de adopción por módulo) nunca se cablean desde ningún módulo clínico | C/B — requiere decisión de producto: dónde instrumentar cada módulo; alcance amplio, no es un fix puntual |
| 19 | telemetria | `obsAvisoCumplido` ("métrica de oro": el médico actuó después sin recordatorio) nunca se emite | C/B — misma naturaleza que #18 |
| 20 | telemetria | `obsConsultaCerrar` no se llama al ocultarse/cerrarse la pestaña (solo al reemplazar paciente) | B — mejora real de un dato analítico, riesgo bajo-medio |
| 21 | teardown | `emergencyTeardown()` no tiene guarda de reentrada (`if (state.killed) return`) — puede correr dos veces para el mismo apagado | A — candidato de buen beneficio (evita sobrescritura de pantalla/claves ya fijadas) para tanda 2 |

## 5. Simplificables (18 hallazgos)

Todos de bucket **A o B** (ninguno toca código sensible; son extracciones de
duplicados o aplanados de condicionales, verificables como neutras por el
banco). Resumen por subsistema — el detalle completo con ubicación exacta
está en la salida cruda del workflow (`journal.jsonl` de `wf_3200c15d-dca`,
disponible si se necesita re-verificar antes de aplicar):

1. **arranque**: `checkVersionMinimum` reimplementa inline la comparación de
   versiones que ya existe como función pura (`mtrVersionEsMasNueva`) — **A**.
2. **arranque**: el CSS del velo de la pantalla de consentimiento se repite
   carácter por carácter en 2 sitios — **A**.
3. **tick**: el umbral "hueco de lectura largo" está escrito como el mismo
   literal en 2 funciones que el propio código dice que deben coincidir — **A**.
4. **tick**: la escritura de `state.historical`/`historicalAt` se repite en
   2 caminos de `colorAndAlert` — **A**.
5-6. **dock**: cálculo geométrico del ancla del dock duplicado entre 2
   widgets (**A**); bloque de firma/severidad/badge duplicado entre 2
   widgets, más grande — **B** (más superficie, probar con cuidado).
7. **historia_clinica**: la clasificación de fallo de IA (cuota/saturado/no
   disponible) se repite 3 veces en `mtrGeminiRedactar` — **B** (toca el motor
   de IA, ya delicado por diseño).
8-9. **historia_clinica**: 9 búsquedas de columna idénticas en
   `makeAnexo5Indexer` (**A**, mecánico); la cadena if/else de `colsRem` — **A**.
10-11. **ordenamientos**: 2 duplicados entre `_cwoClic` y el modal de
   paquete/Conducta — **B** (área sensible, Conducta).
12-13. **aviso_universal**: `colorSlug` repetido 4 veces en `_renderToast`
   (**A**); guardas "una vez por día" repetidas en 4 sitios — **A**.
14. **agendar**: guarda "lectura ya no aplica" duplicada entre `tickApi` y
   `refrescarAgendaAhora` — **A**.
15. **labs**: ~35-45 líneas duplicadas entre la rama principal y la de
   reintento de `_ejecutarLlenadoExamenes` — **B** (ya se relaciona con los
   callejones #16/#17 de labs; conviene resolverlos juntos).
16. **telemetria**: 4 líneas idénticas entre `uxFlush` y `uxBootCheck` — **A**.
17. **telemetria**: `_detectarRageClick` con 6-7 niveles de anidamiento —
   **B** (extracción de función, más riesgoso de verificar bien que un
   simplificable típico).
18. **teardown**: ~20 líneas duplicadas entre `emergencyTeardown` y
   `_vglRetirarMonitorPorPerfil` — **A**.

## 6. UX clínica (27 hallazgos)

**Aplicado en esta entrega**: #vgl-refresh 24→28px (mínimo táctil WCAG 2.5.8).

El resto — **26 hallazgos, todos bucket A** (ninguno toca lógica clínica; son
tamaños táctiles, `aria-label`/`aria-expanded`, `:focus-visible`, y 2 casos de
`animation: infinite` sin límite). Es el bucket de mayor densidad de "A" de
toda la auditoría porque el propio proyecto ya tiene el patrón correcto
establecido en varios sitios (el panel RCV, `.vgl-rcvp-cerrar`/`.vgl-rcvp-min`
a 28px) — aplicar el resto es repetir un patrón ya validado, no inventar uno
nuevo:

- Pantalla de consentimiento: botón "ver términos" sin `aria-expanded` y con
  área táctil de ~17-20px.
- Aviso de instancia duplicada: botón "Entendido" en el límite de 28px.
- Reloj de cabecera "desactualizado": la señal es solo de color (sin texto ni
  `aria-live`).
- Dock: `#vgl-cw-examenes`/`#vgl-cw-farmaco` sin `role="button"`/`aria-label`
  (el panel RCV vecino sí los tiene); `.vgl-dock-toggle` a 22px de alto;
  `.vgl-cw-badge` con `animation: infinite` (el proyecto ya corrigió el mismo
  patrón en `#vgl-dot` a 3 pulsos); badge de fármacos sin alto mínimo; el
  alternador de apertura no distingue clic en badge vs. clic dentro del panel
  ya abierto.
- `hcAnexo5Render`: botón de cierre sin `aria-label`, sin `keydown` pese a
  `role="button"`, sin confirmación ni deshacer al cerrar una alerta de
  abandono de programa.
- `.vgl-agm-close` (Agendar/Ordenar) y `.vgl-agm-pbtn.vgl-sm` (chips de
  día/turno) por debajo de 28px.
- `openOrdenamientoModal`: la trampa de foco se activa ~300 líneas después de
  pintar el esqueleto — un médico con solo teclado no puede cerrar con Escape
  mientras Everest responde.
- Toasts: sin `:focus-visible` propio; separador "  |  " en avisos agrupados
  en vez de salto de línea (el CSS YA soporta `white-space:pre-line`); el "×"
  decorativo sin `aria-hidden`; `.vgl-toast-x` por debajo de 28px; 2 casos de
  cierre sin la animación de salida que sí usa el cierre manual.
- Rage-click: el aviso "Everest no responde" sale en AZUL con autodescarte a
  9 s (debería ser persistente: 2 frases que leer justo cuando el sistema
  puede estar lento).
- Bloqueo por versión (`_avisoBloqueoPintar`): no pasa por el gestor de
  accesibilidad universal del proyecto (sin `role="dialog"`, sin trampa de
  foco); instrucciones de recuperación como texto plano en vez de `<ol><li>`;
  el clic de "Actualizar ahora" no comprueba si `window.open` fue bloqueado
  por el navegador.

## 7. Verificación (esta entrega)

- Suite nueva: `tests/suite_112_mesa_expertos_muertas.js` (3 casos).
- Casos nuevos en `suite_09_ajustes.js`, `suite_31_seguridad_phi_xss.js`,
  `suite_102_widget_rcv.js`, `suite_105_boton_actualizar.js`.
- **7 mutaciones verificadas** (rojo con el mensaje exacto esperado →
  restaurado → verde), filas en `tests/INFORME_MUTACIONES.md` bajo
  "v18.12.0 (Mesa de Expertos: primera tanda)".
- Banco completo: **3770/3770 pasan, EXIT=0 real**, corrido antes y después
  de la tanda 1 (más una corrida adicional tras el commit paralelo `cbd151e`
  de otra sesión que tocó el mismo repositorio — sin conflicto, ver acta en
  `docs/REGISTRO_DECISIONES.md`).
- Navegadores: no aplica un recorrido cruzado real (sin entorno de
  navegador disponible en esta sesión); la verificación es sobre el arnés de
  pruebas (`tests/harness.js`, DOM simulado) y sobre las reglas CSS/atributos
  fuente, no sobre un render real en Chrome/Firefox/Safari.

## 8. Beneficios obtenidos

- **Mantenibilidad**: 7 piezas de código muerto (parámetros fantasma,
  variables nunca leídas, CSS huérfano, ramas imposibles) que confundían a
  cualquier futuro auditor quedaron retiradas; 2 comentarios que documentaban
  un mecanismo inexistente quedaron corregidos.
- **UX/accesibilidad**: el control de refresco más usado del panel
  (`#vgl-refresh`) alcanza el mínimo táctil que el propio proyecto ya adoptó
  en su control gemelo tras un reporte de campo real.
- **Higiene de auditoría**: 3 hallazgos de "código muerto descartado" quedaron
  marcados para una tercera verificación (evidencia no concluyente) en vez de
  aceptarse o rechazarse sin más — la disciplina de "evidencia sobre opinión"
  se aplicó también hacia adentro, sobre los propios agentes.

## 9. Próximos pasos

Prioridad sugerida para la(s) próxima(s) tanda(s), por beneficio/riesgo:
1. UX (26 restantes, todas bucket A, patrón ya validado) — el bucket de mayor
   volumen y menor riesgo.
2. Simplificables bucket A (checkVersionMinimum, velo de consentimiento,
   umbral del hueco, memorización de lectura, columnas del Anexo 5,
   colorSlug del toast, guardas "una vez al día", guarda de lectura vigente,
   duplicado de teardown) — mecánicos, verificables como neutros.
3. Callejones bucket A (try/catch redundantes, pastilla RCV huérfana,
   `data.visible` sin leer, guarda de reentrada de `emergencyTeardown`).
4. Los de bucket C (#1, #9, #12 de callejones; #2, #3 de código muerto)
   requieren una decisión explícita del médico antes de cualquier cambio —
   no se implementan por iniciativa propia.
5. Los 3 "código muerto descartado" con evidencia débil (§3.1) merecen una
   tercera pasada de verificación antes de decidir.
