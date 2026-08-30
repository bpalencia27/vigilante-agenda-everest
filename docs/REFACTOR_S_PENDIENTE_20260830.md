# Refactor S+ — Pendiente de terminar (30-ago-2026)

Registro de lo que quedó en pausa durante la tanda de refactorización S+ del
`vigilante_agenda.user.js`, para no perderlo al retomarlo.

---

## ⏸ EN PAUSA — Módulo «Próximo control» (ordenamiento de exámenes / «próximos laboratorios»)

El médico pidió dejarlo **en stand by** y retomarlo más adelante. Queda anotado aquí
con todo lo necesario para terminarlo sin re-investigar de cero.

### Qué ya está hecho (commiteado)

- El módulo completo existe y está restaurado: botón 📦 «Próximo control» en el dock
  (solo médicos autorizados), modal `#vgl-paquete-modal`, funciones `mtrPaqueteEstadoDe` /
  `mtrPaqueteProgramaHtml` / `openPaquetesModal`, CSS y tokens `--c-paquete`/`--rgb-paquete`.
- Revisión de solo lectura: usa el motor interno (`mtrTableroClinico`) para mostrar, por
  programa rector (ERC > DM > HTA), qué toca pedir y qué sigue vigente.
- Botón **«📋 Ordenar pendientes» dentro del propio modal** (commit `7f76137`): simula los
  botones nativos de Everest (busca y clica en la tabla de Conducta) pero agrega **solo los
  analitos que el motor ya calculó para la próxima visita** (`mtrItemsOrdenarConducta` sobre
  `d.ordenar`), nunca el paquete nativo completo (que arrastra el hemograma 902210, prohibido).
  Reutiliza `mtrConductaAgregarPendientes` y el candado `_cwoEnCurso`.

### Qué queda pendiente de terminar

1. **Vía de ordenamiento por CUPS directo vs. simulación por clics (decisión abierta).**
   El médico apuntó: *«ya tienes los CUPS, no sería difícil»*. Hoy el ordenamiento de la
   Ruta de Crónicos se hace por **simulación de clics** (`_conductaClicPaqueteHTA` /
   `_conductaBuscarYAgregarExamen`) porque es un flujo distinto del de PyM. Existe una vía
   de ordenamiento **directo por CUPS** (`apiOrdenamientoGuardar`, `POST GuardarOrdenamiento`,
   contrato verificado byte a byte contra el módulo nativo), pero esa corresponde al flujo
   **PyM / CIE-10** (tamizajes, VIH, citología…), con `SwHc:false` y `DiagnosticoId`.
   El comentario de la función lo advierte explícitamente: *«NO CONFUNDIR con el ordenamiento
   desde la Ruta de Crónicos: ese es OTRO flujo, con un cuerpo distinto (camelCase, el objeto
   completo del paciente, citaId real y swHC:true)»* — contrato **no capturado/verificado**.
   Para usar CUPS directo en Crónicos habría que capturar y verificar ese endpoint en una
   sesión real (no se puede fabricar). Mientras tanto, la simulación por clics es la vía
   verificada y segura.
2. **Decidir si la simulación actual es suficiente** (agrega solo lo calculado, sin hemograma)
   o si se prefiere intentar el camino directo por CUPS con evidencia real.
3. Actualizar el mockup del canvas (`paquetes-propuesta`) si se reactiva la página.

### Contexto clínico que no se debe perder

- Regla del médico (v17.37.0): **«jamás ordenar lo que no se debe»**. El paquete nativo
  «Paquetes → HTA» arrastra SIEMPRE el hemograma (902210), por eso `MTR_ANALITOS_PAQUETE_CONDUCTA`
  quedó vacía y la simulación agrega solo analitos sueltos permitidos.
- Evidencia: `captura_ordenamiento_paquete_HTA_20260812.json` y `EVIDENCIA_ORDENAMIENTO_CURADO.md`.

---

## ⏸ PENDIENTE (relacionado, sin empezar) — Sección «Laboratorios RCV» del aviso universal

**RESUELTO** (commit `6fe09b1`, 30-ago): gating por médico autorizado implementado y
probado. Solo los autorizados ven la sección «normal» (tabla por estadio + 50 % fuera de
meta); los no autorizados la ven solo si el paciente está en un programa de Ruta Crónicos
(programa rector presente) y tiene labs vencidos por su vigencia original SIN el 50 %.

---

## Pendiente general (fuera de «próximos laboratorios»)

- Refactor visual del **Redactor IA** (solo hecho el gating de acceso).
- Refactor visual del **Panel principal del Centinela** (incluye variante modo rendimiento).
- Refactor visual de **notificaciones de cambios de leyenda** (toasts en Citas/Agenda).
- Push de los commits locales desde Trae Code (este entorno no tiene credenciales de GitHub).
