# SUPER PROMPT — Simulación exhaustiva de interacciones y cableado entre módulos
## Vigilante de Agenda v18.3.x · «Caminar cada flujo como el usuario, antes de tocar una línea»

> Documento de encargo. Lo ejecuta **un agente por tarea** (Jules/Claude/Gemini bajo el
> protocolo de `jules.md`); **una tarea SF-## por sesión.**
> Complementa —no repite— a `SUPERPROMPT_AUDITORIA_ELITE.md` (auditoría estática, ya
> cerrada; ver `AUDITORIA/REGISTRO_ELITE.md`). Este encargo es **dinámico**: simula
> combinaciones de interacción del usuario contra el DOM real del arnés, documenta cada
> desviación y SOLO DESPUÉS corrige.
> Meta declarada por el médico: dejar el sistema en **nivel 1A — sin fallos ni
> comportamientos inesperados** en ningún flujo simulado (definición verificable en §2).

---

# 0. MODO DE EJECUCIÓN Y REGLAS DEL ENTORNO

Cada tarea se lanza así:

> «Lee `SUPERPROMPT_SIMULACION_FLUJOS.md` en la raíz del repo y ejecuta ÚNICAMENTE la
> tarea **SF-##**.»

Reglas heredadas (valen sin excepción; detalle completo en `AGENTS.md` y en el
superprompt de auditoría §0):

- **Un solo archivo.** `vigilante_agenda.user.js` es un IIFE único: jamás módulos ES,
  bundler, TypeScript ni dependencias nuevas.
- **PROHIBIDO REFORMATEAR** (Prettier, `--fix`, reordenar, normalizar comillas). El PR
  se descarta entero. Doble para un encargo que «corrige mucho»: cada fix es un diff
  mínimo con su prueba.
- **Cero PHI. Casilla vacía antes que dato inventado. El médico manda** (el script
  sugiere; nunca agenda/ordena/confirma solo; nunca sobreescribe lo que el médico
  escribió).
- **Ninguna petición real** a Everest/Athenea/AppCita: todo flujo corre contra el arnés
  (`tests/harness.js`) con sus mocks. Lo que exija Everest real se documenta, no se
  prueba en vivo.
- **Banco:** `node tests/runner.js`, sin instalar nada. Nunca por debajo de la baseline
  congelada en la FASE 0 de este encargo.
- **Todo cambio de comportamiento = prueba nueva + mutación verificada** (romper a
  propósito, ver el rojo, restaurar, ver el verde), fila nueva al FINAL de
  `tests/INFORME_MUTACIONES.md`, mismo formato de columnas.
- `t.caso` nuevo va como **HERMANO** del anterior (nunca anidado); `t.casoAsync`
  **siempre** con `await`. Verificar con `node -c tests/<suite>.js` y que el contador de
  la suite suba exactamente lo añadido.
- Comentarios en español explicando el POR QUÉ; código y variables en inglés.
- Si el cambio toca CSS/aspecto computado: verificar con Playwright + `getComputedStyle`
  sobre el HTML+CSS real del arnés (regla dura del proyecto; una prueba que solo hace
  `innerHTML.includes(...)` no demuestra nada visual).
- **Punto de partida de rama:** el que registre la FASE 0 de este encargo sobre la punta
  vigente del repo. Si las ramas volvieran a divergir como en AE-001, se rebase, se
  vuelve a correr el banco DESPUÉS del rebase y se anota en el registro.

---

# 1. OBJETIVO

Simular **todas las combinaciones lógicamente válidas de interacción** de cada módulo
interactivo del script — selecciones, modificaciones a mitad de flujo, retrocesos,
cancelaciones, confirmaciones, reaperturas — para verificar tres cosas:

1. **Cableado:** cada control dispara lo que debe y nada más.
2. **Sincronización:** un cambio de selección a mitad de flujo se propiga a todos los
   módulos relacionados, **sin datos residuales** de selecciones anteriores, con el
   estado global consistente en todo momento.
3. **Respuestas ante cambio de entradas:** cada función reacciona correctamente a
   cualquier variación de sus entradas (incluidas las válidas pero inusuales).

Y solo tras documentar TODOS los fallos (§7): corregirlos, re-simular TODO y certificar
el nivel 1A.

---

# 2. NIVEL 1A — DEFINICIÓN VERIFICABLE (NADA DE «SE VE BIEN»)

El sistema alcanza **nivel 1A** cuando, en una corrida completa y post-corrección:

| # | Criterio | Medición |
|---|---|---|
| 1 | **0 desviaciones** en todas las combinaciones generadas (§5) | Registro de simulaciones: todas las filas `OK` |
| 2 | **0 estados residuales** tras retroceso/cancelación/cierre | Aserciones de estado final por flujo (§5, F6) |
| 3 | **0 invariantes de marca rota** (a lo sumo UN activo por eje de selección) | Mismo método que suite_73, aplicado a cada módulo |
| 4 | Banco completo **≥ baseline FASE 0**, verde | `node tests/runner.js` |
| 5 | Cada corrección con prueba nueva + mutación muerta | `INFORME_MUTACIONES.md` |
| 6 | Re-simulación completa post-corrección sin nuevas desviaciones | Segunda corrida íntegra registrada |
| 7 | Cero cambios fuera de alcance, cero reformateo, invariantes de dominio intactas | Revisión del diff |

**1A total** = todos los criterios en verde. **1A condicionada** = verde salvo ítems que
requieren decisión del médico (van a su cola, §8.3, y se declara exactamente cuáles).
La certificación nunca es optimista: lo que no se ejecutó, no se certifica.

---

# 3. INFRAESTRUCTURA OBLIGATORIA — no se re-inventa nada

1. **Arnés:** `tests/harness.js` carga el userscript real. Para leer lo pintado se usa
   `.innerHTML` (regla dura: `textContent` del arnés es estático y miente).
2. **Enriquecedor DOM de suite_73:** el modal se construye con `innerHTML` y se consulta
   con `querySelector`; suite_73 ya parcha el `document` del arnés con parser HTML,
   motor de selectores, `dataset` y `classList` reales. **Ese enriquecedor se reutiliza
   y, si hace falta, se extrae a un módulo compartido del arnés** (una sola fuente de
   verdad para todas las suites de simulación). Nunca se escribe un segundo enriquecedor
   paralelo.
3. **Fechas dinámicas:** nada de fechas hardcodeadas. Todo recorrido parte de HOY y usa
   las funciones de negocio de producción (`calcBusinessTargetDate`,
   `calcRangoSondeoIso`, `calcDateRangeAroundIso`, `mtrPlazoMasCercano`…) para calcular
   lo que el modal DEBE mostrar. La suite debe ser válida cualquier día que corra.
4. **Guard de acceso:** los `open*Modal` exigen perfil (v18.1.0, B3.3). Todo contexto de
   simulación siembra `vgl_acceso_lista` e identidad (patrón del wrapper de suite_73).
5. **Reloj/timers:** los flujos con esperas usan los controles del arnés (`apiEspera`);
   nunca `setTimeout` suelto que produzca flakes bajo carga (precedente: ANTIDUP
   v18.0.98, descartado como flake en AE-011 — no se reintroduce su patrón).
6. **Visual (solo si una corrección toca CSS):** Playwright + `getComputedStyle` sobre
   el HTML+CSS real (AGENTS.md). Herramientas de medición en `tools/`.

---

# 4. CATÁLOGO DE MÓDULOS INTERACTIVOS A SIMULAR

La FASE 0 puede ampliar esta tabla, pero **jamás reducirla**. Cada módulo declara sus
**ejes de selección** (variables de estado que el usuario toca) — son la materia prima
de la combinatoria de §5. Verificar los nombres contra el código del árbol vigente antes
de simular (los rótulos exactos de UI se confirman al ejecutar; si difieren, se registra).

| # | Módulo | Entrada | Ejes de selección (verificar al ejecutar) | Precedente |
|---|---|---|---|---|
| M1 | **Modal de agendamiento** | `openAgendamientoModal` | tipo de cita (control/labs/examen) · plazos (meses) · chips de toma de muestras · días del calendario · turnos · especialidad · fecha manual · pasos (`irAPaso`) · MODO MANUAL | suite_73 |
| M2 | **Modal de ordenamiento PyM** | `openOrdenamientoModal` | paquetes/actividades · CUPS por actividad · dx · cantidades · confirmación con agrupador real | suite_34 |
| M3 | **Modal de laboratorios / toma de muestras** | `openLaboratoriosModal` / `openLabSoloModal` / `renderLabDayChips` | sede · día · franja · examen | suite_08, suite_73 |
| M4 | **Panel del paciente / hojas** | `openPanelPacienteModal` / `toggleSheet` / `closeSheet` | pestañas · secciones · minimizar/restaurar (`vglMin*`) | suite_65, suite_67 |
| M5 | **Ajustes** | `renderSettings` / `_ajustesGuardar` / `_ajustesDescartar` | cada interruptor · Guardar vs Descartar · borrador sucio (`_ajustesSucio`) | suite_09 |
| M6 | **Redactor IA / barrera de identificables** | `mtrAbrirPanelRedaccion` / `mtrBarreraIdentificables` | modo · modelo (z.ai/Gemini) · inserción solo-casilla-vacía · rechazo/edición del borrador | suite_57, suite_58, suite_81 |
| M7 | **Compuerta de acceso y consentimiento** | `mtrTerminosPantalla` / `mtrCompuertaArranque` | aceptar · rechazar · gracia de identidad · perfil por médico | suite_78, suite_80, suite_82 |
| M8 | **Carpeta local cifrada / disco** | `vglCarpetaElegir` / banner de disco | elegir carpeta · aceptar/rechazar banner · purga · borrado total | suite_69, suite_75, suite_76 |
| M9 | **Modal de paquetes / chooser / toasts / dock** | `openPaquetesModal` / `_vglChooserModal` / `createAccionesDockUI` | abrir/cerrar · colapsar · descartar · reabrir por paciente | suite_50, suite_59, suite_64 |
| M10 | **Post-cita y cierre** | `mostrarPanelPostCita` / `_checklistCierreMsg` | acciones post-cita · checklist · no volver a mostrar | suite_62 |
| M11 | **Tablero remoto (Apps Script)** | `TABLERO/Codigo.gs` + `TABLERO/simulacion_local.js` | hojas · perfiles · purga 12m (`docs/tablero_purga_12m.gs`) | AE-013 |

---

# 5. ESTRATEGIA DE EXHAUSTIVIDAD — «todas las combinaciones lógicamente válidas»

### 5.1 Clases de flujo (se aplican a TODOS los ejes de TODOS los módulos)

| Clase | Qué simula | Qué exige |
|---|---|---|
| **F1 · Línea base** | Flujo directo mínimo → confirmar | Resultado correcto y único |
| **F2 · Modificación** | Cambiar una selección a mitad de flujo | El estado anterior DESAPARECE; los módulos relacionados se re-sincronizan |
| **F3 · Retroceso** | Volver atrás (pasos, pestañas, calendar) sin confirmar | Cero residuos; las marcas previas se recalculan |
| **F4 · Cancelación** | Cerrar/Esc/clic-fuera en cada punto de avance | Estado global idéntico al de apertura; sin timers ni listeners huérfanos |
| **F5 · Confirmación** | Aceptar con cada combinación válida de ejes | La acción ocurre UNA sola vez; la marca antiduplicado solo se pone con confirmación real de Everest (mock con `radicado > 0` / agrupador / 2xx) |
| **F6 · Reapertura** | Reabrir tras F4/F5, con el mismo y otro paciente | Idempotencia por id; sin duplicados en DOM; preferencias recordadas donde corresponda |
| **F7 · Degradación** | Red lenta/fallida, respuesta vacía, sobre-error 200, cuota agotada | Fail-safe: nunca marca como hecha una acción que no ocurrió; el aviso honesto | 
| **F8 · Carrera** | Doble clic en confirmar; cambio de paciente con petición en vuelo | Ningún duplicado; aborta limpio (patrón «paciente cambió mientras Athenea respondía») |

### 5.2 Generación de combinaciones por módulo (auditable, no a mano alzada)

Para cada módulo, la FASE 1 produce y registra en el registro de simulaciones una
**tabla de combinatoria**:

1. Enumerar los ejes (§4) y sus valores válidos (de las funciones de negocio, no de
   memoria).
2. **Ejes dependientes** (los que se condicionan entre sí, p. ej. plazo ↔ días
   mostrados ↔ turnos): se enumeran **TODAS** las combinaciones válidas del conjunto
   cerrado.
3. **Ejes independientes de producto grande** (> ~200 combinaciones tras el filtro de
   validez): enumeración completa si es viable; si no, **todas las parejas (pairwise)** +
   todos los valores límite + todas las clases F1-F8 sobre cada eje. La reducción se
   declara en la tabla con el número resultante — «exhaustivo» tiene que poder
   contarse.
4. Cada combinación se ejecuta como flujo con las clases F1-F8 que le apliquen.

### 5.3 Aserciones transversales de sincronización (en CADA transición, no solo al final)

- **Marca única:** a lo sumo UN plazo activo, UN día, UNA especialidad, UN tipo de cita,
  a lo sumo UN turno (invariante de suite_73, generalizada a cada módulo: un estado
  doble no es cosmético, es una cita/orden en el día equivocado).
- **Cero residuos:** atributos `data-*`, `class` de activo, chips, campos de texto,
  borradores de ajustes y cachés (`_agmPref*`, `isAgendamientoPendiente`,
  `mark*Hoy`…) reflejan EXACTAMENTE la última selección.
- **Estado global:** un solo modal abierto; el dock/banner/coherencia PyM
  (`pymPendientesRestantes`, banner apagado por órdenes vigentes reales) consistente;
  telemetría `uxTrack` con la clave esperada (las claves renombradas se documentan).
- **Teclado y accesibilidad:** cierre con Esc y foco en los modales que ya lo declaran
  (`_activarAccesibilidadModal`).

---

# 6. R0 — EL ESCENARIO SEMILLA DEL MÉDICO (caso obligatorio, palabra por palabra)

> «accede al modal [de agendamiento], selecciona inicialmente las opciones "control
> médico + labs", elige un plazo de 1 mes en el calendario, luego retrocede en sus
> acciones, modifica su selección para elegir solo "control médico", actualiza el plazo
> a 3 meses, selecciona una fecha concreta y confirma la acción haciendo clic en el
> botón de aceptar.»

Formalización ejecutable (M1, clases F2+F3+F5 encadenadas):

| Paso | Acción | Lo que DEBE ser cierto al terminar el paso |
|---|---|---|
| 1 | Abrir el modal | Montado una sola vez; perfil COMPLETO; sin selección previa residual |
| 2 | Marcar «control médico» + «labs» (tipo de cita / chips de toma de muestras) | Ambos activos; turno/especialidad/plazo sin elegir |
| 3 | Plazo 1 mes | Calendario/rango recalculado por las funciones de negocio desde HOY; marca única de plazo |
| 4 | **Retroceder** (volver al paso/selección anterior sin confirmar) | El estado de pasos 2-3 queda coherente con lo que la UI realmente conserva; si algo se descarta, se descarta COMPLETO y se registra cuál era el contrato |
| 5 | Desmarcar «labs» → queda SOLO «control médico» | El eje labs desaparece de TODO el estado (chips, resumen, preferencias, telemetría) — cero residuo del paso 2 |
| 6 | Plazo → 3 meses | Recálculo total; la marca de «1 mes» NO coexiste con la de «3 meses» |
| 7 | Seleccionar fecha concreta (del rango válido de 3 meses) | Un solo día activo; la fecha pertenece al rango recalculado, no al viejo |
| 8 | Clic en aceptar | UNA sola petición (mock con confirmación real); marca antiduplicado SOLO tras la confirmación; cierre limpio; reabrir muestra el candado/aviso correspondiente |

R0 es el primer caso que se escribe (suite nueva, ver §7.1) y el primero que se re-ejecuta
en la validación post-corrección. Si el rótulo real de un control difiere de la palabra
del médico, se registra la discrepancia y se simula contra el rótulo REAL (casilla
vacía: no se adivina la intención de la UI).

---

# 7. FASES, REGISTRO DE PRUEBAS Y FORMATO

### 7.1 Fases y tareas (una tarea = un PR; orden obligatorio)

| Fase | Tarea | Entrega |
|---|---|---|
| 0 | **SF-00** Congelar baseline (versión, sha256, banco completo, rama) y crear `AUDITORIA/REGISTRO_SIMULACIONES.md` | Registro inicial |
| 1 | **SF-01** Extraer/compartir el enriquecedor DOM de suite_73 al arnés (sin cambiar SU comportamiento; suite_73 sigue verde) | Infraestructura común |
| 2 | **SF-02** R0 + tabla de combinatoria de M1; ejecutar todas las combinaciones de M1 | Filas de simulación M1 |
| 3 | **SF-03…SF-12** Un módulo por tarea (M2…M11): tabla de combinatoria + simulación completa | Filas por módulo |
| 4 | **SF-20** Cruce de módulos: flujos que atraviesan dos o más (agendar→post-cita→panel; ordenar→banner PyM→dock; ajustes→todo) | Filas de cruce |
| 5 | **SF-30** Informe estructurado de errores (§7.2) — SOLO LECTURA hasta aquí | Informe pre-corrección |
| 6 | **SF-31…** Una corrección por tarea (§8) | Diffs + pruebas + mutaciones |
| 7 | **SF-90** Re-simulación COMPLETA post-corrección + banco + certificación 1A (§9) | Informe final |

Ninguna corrección (fase 6) empieza antes de que SF-30 cierre el informe de errores.

### 7.2 Registro de simulaciones (`AUDITORIA/REGISTRO_SIMULACIONES.md`, dueño: la fase que lo crea)

Formato fijo, solo append:

```
| ID | Módulo | Clase (F1-F8) | Secuencia (pasos abreviados) | Esperado | Observado | Veredicto (OK/DESV/BUG) | Ref (hallazgo SF-###) |
```

- ID único `S-####`; cada fila = una combinación EJECUTADA (las generadas y no corridas
  no cuentan para 1A).
- `DESV` = desviación tolerable documentada; `BUG` = fallo que exige corrección.
- Conflictos entre sesiones paralelas: se conservan AMBAS filas.

### 7.3 Informe estructurado de errores (SF-30)

Por cada BUG: módulo · secuencia mínima que lo reproduce · esperado vs observado (con
línea de aserción) · hipótesis de causa con línea del código · eje de sincronización
afectado · severidad (escala S0-S4 de la auditoría élite; S3+ con decisión clínica va a
la cola del médico) · corrección propuesta (sin aplicar).

---

# 8. CORRECCIÓN GUIADA — solo después de documentar

1. **Orden:** S0 → S1 → S2; las S3/S4 de estilo no se tocan en este encargo.
2. **Cada corrección:** diff mínimo · prueba nueva que falla sin el fix · mutación
   transcrita · banco ≥ baseline · rebase verificado. La prueba nueva NACE del caso de
   simulación que lo cazó (la secuencia del registro se convierte en `t.caso`).
3. **Prohibido:** tocar invariantes de dominio (eje de puntualidad, `apptKey`,
   `diaNuevo`, VIH en `S.excluir`, marcas antiduplicado solo con confirmación real,
   edge-trigger del ROJO) · «optimizar» de paso · debilitar una prueba para que entre ·
   decidir por el médico nada que cambie comportamiento clínico (va a su cola con
   opciones y riesgo).
4. Si una corrección obliga a tocar algo fuera de alcance: se detiene y se explica en
   el registro, sin tocarlo.
5. Si un BUG no se puede corregir sin romper una invariante o sin decisión clínica: se
   certifica 1A **condicionada** declarando exactamente qué quedó fuera y por qué.

---

# 9. VALIDACIÓN POST-CORRECCIÓN Y CERTIFICACIÓN 1A

1. Re-ejecutar **la totalidad** de las combinaciones registradas (no solo las que
   fallaron): cada fila `BUG`/`DESV` debe pasar a `OK` o quedar explícitamente en cola
   del médico.
2. Correr el banco completo; contador ≥ baseline; rebase previo verificado.
3. Ejecutar de nuevo R0, primero, en sesión limpia.
4. Emitir `AUDITORIA/INFORME_SIMULACIONES.md`: alcance · tabla de combinatoria por
   módulo con números generados/ejecutados · total de combinaciones y veredictos ·
   informe de errores pre-corrección (SF-30, intacto) · correcciones aplicadas con sus
   mutaciones · corrida post-corrección · certificación **1A total o condicionada**
   según §2, con la lista exacta de exclusiones.
5. La palabra final de despliegue es del médico, siempre.

---

# 10. PROTOCOLO ANTE LA DUDA

1. **¿Falta evidencia del rótulo/comportamiento real de un control?** No se adivina: se
   simula contra lo verificable, la duda se registra y, si hace falta, se entrega un
   script de diagnóstico para capturarla en consultorio.
2. **¿Chocan dos instrucciones?** Gana la seguridad clínica, después la voluntad del
   médico, después la consistencia de estado, después la estética.
3. **¿La prueba flanea bajo carga?** Se estabiliza el caso (esperas del arnés), jamás se
   relaja la aserción (precedente AE-011: el flake se documenta, no se tapa).
4. **¿Un fallo repite un hallazgo AE-### de la auditoría?** Se referencia; no se
   re-describe ni se contradice en silencio.
5. **¿La corrección cambia lo que el médico ve o decide?** A la cola, con opciones.
