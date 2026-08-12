# Auditoría de compatibilidad — MOTOR RCV v68 → Vigilante de Agenda

**Pregunta del médico:** ¿cuánto de este motor se puede fusionar en el script sin romper lo que ya
funciona, y dónde debería vivir?

**Fecha:** 12 ago 2026 · script en `@version 12.8.1` · banco en 690 comprobaciones.

---

# 0. Veredicto en una frase

**No es una función nueva: es la pieza que el propio script dejó documentada y aparcada hace tres
versiones.** El motor se puede portar en su mayor parte, pero **no como está escrito** — es un
prompt para un LLM y el script no tiene LLM. Lo que se porta es su **lógica determinista**, que es
la mayoría; lo que decide clínicamente **no se automatiza nunca**.

---

# 1. El hallazgo que cambia el encuadre

El script tiene esto escrito en su propia cabecera desde **v12.5.6** (línea ~530):

> «**Pendiente (bloqueado, a la espera de que el médico entregue la fórmula de Cockcroft-Gault y
> confirme cómo se determina el "programa" del paciente en Everest):** estadificación renal para
> exigir/omitir PTH, Fósforo y Albúmina según estadio ERC, y contrastar la fecha más reciente
> contra la VIGENCIA administrativa por examen que el médico ya entregó (tablas de control
> DM2/HTA/ERC del manual de programas especiales).»

Y en **v12.5.7** (línea ~490):

> «AVISO ROJO DE LABORATORIOS RCV SIN RESULTADO EN 180 DÍAS (pedido explícito del médico,
> **simplifica el enfoque de estadificación renal por Cockcroft-Gault que se había planteado
> antes — queda pendiente para otra sesión si se retoma**).»

**El MOTOR RCV v68 entrega exactamente las dos cosas que faltaban:** la fórmula de Cockcroft-Gault
(y además CKD-EPI 2021) y la tabla de vigencias por estadio. Y el «programa del paciente» quedó
resuelto por separado con evidencia real: `programasPaciente[].descripcion` («Nefroprotección»,
«Hipertensión»).

**Esto reduce el riesgo enormemente.** No estamos metiendo un motor clínico ajeno en un script de
agenda: estamos terminando un diseño que ya estaba pensado, con la fuente que faltaba.

---

# 2. Lo que el script YA implementa (subconjunto del motor)

| Concepto del MOTOR | Estado en el script | Dónde |
|---|---|---|
| «CERO VENCIDOS» como misión | ✅ Implementado | `checkLabsVencidos`, `labsVencidosAlert` |
| Vigencia de analitos RCV | ⚠️ **Plana: 180 días para todos** | `RCV_VIGENCIA_DIAS = 180` (2566) |
| Los 6 drivers + RAC | ✅ Los 7 analitos exactos | `RCV_VIGENCIA_KEYS` (2567) |
| **OVERRIDE RAC ≥30 → vigencia más corta** | ✅ **Ya implementado** | `_vigenciaDiasParaAnalito` |
| «gana la fecha más reciente» | ✅ Implementado | `_ultimaFechaPorAnalito` (v12.5.6) |
| HbA1c solo si DM2 | ✅ Implementado (se excluye de la regla) | v12.5.7 |
| PTH/Fósforo/Albúmina | ⚠️ Se autocompletan, **sin regla de estadio** | pendiente v12.5.6 |
| Un valor `0` es un valor real, no ausencia | ✅ Implementado | `_valorCrudoLab` |
| Aviso una vez por paciente por día | ✅ Implementado | patrón `checkAbandonoPES` |
| Días hábiles | ⚠️ Solo fines de semana | `calcBusinessTargetDate` |
| **Festivos colombianos** | ❌ **No existen** (0 apariciones) | — |
| TFG / KDIGO / estadificación | ❌ No existe | — |
| Clasificación de riesgo, metas LDL | ❌ No existe | — |

**Traducción:** el eje «vigencias y aviso de vencidos» ya está montado y probado. El motor no lo
reemplaza — lo **afina** (de 180 plano a tabla por estadio) y lo **extiende**.

---

# 3. ¿Están los datos? Sí — verificado contra capturas reales

Requisito del motor: *«Falta edad/peso/sexo/creatinina → datos_completos:false, no calcules TFG»*.

| Dato | ¿Disponible? | Fuente real capturada |
|---|---|---|
| **Edad** | ✅ | `CargarDatosPacienteByCitaId` → `edad`, `edadAnos`, `fecha_Nacimiento` |
| **Sexo** | ✅ | mismo endpoint → `sexo` (`"F"` / `"M"`) |
| **Peso** | ✅ | `ObtenerHistoricoSignosVitales` → `peso` |
| **Talla / IMC** | ✅ | mismo → `talla`, `imc` (¡ya calculado por Everest!) |
| **Presión arterial** | ✅ | mismo → `presionSistolica`, `presionDiastolica` |
| **Creatinina sérica** | ✅ | Athenea, ya extraída (`CREATININA` está en `RCV_VIGENCIA_KEYS`) |
| **Perfil lipídico, glicemia, RAC, uroanálisis** | ✅ | Athenea, ya extraídos |
| **HbA1c** | ✅ | Athenea, ya extraída |
| **Programa del paciente** | ✅ | `CargarDatosPacienteByCitaId` → `programasPaciente[].descripcion` |
| **Órdenes ya vigentes** | ✅ | `ObtenerOrdenamientoPorPacienteIdVigente` (ver superprompt v14 §1.6) |
| Tabaquismo, sedentarismo, apnea, MASLD | ❌ | No hay campo estructurado conocido |
| Placa/ECV subclínica, calcio coronario, HF | ❌ | No hay campo estructurado conocido |
| ASCVD 10 años | ❌ | No hay campo estructurado conocido |

**Conclusión:** **TFG, estadificación KDIGO y toda la capa logística son calculables hoy.** La
clasificación de riesgo (S2) **no**, porque sus entradas viven en el texto libre de la historia, no
en campos. Y eso **está bien**: el propio motor manda `datos_completos:false` + `status PENDIENTE` en
ese caso, que es exactamente la regla «casilla vacía antes que dato inventado» del proyecto.
El script pedirá el dato al médico, no lo adivinará.

---

# 4. Clasificación por riesgo de portar

### 🟢 VERDE — Determinista, verificable, se porta tal cual

Son fórmulas y tablas. Se prueban con vectores conocidos y no deciden nada por el médico.

1. **Cockcroft-Gault** y **CKD-EPI 2021** (las dos, como exige el motor).
2. **Estadificación KDIGO** por cortes (G1…G5) y la distinción `estadio_admin` (C-G) vs
   `estadio_clinico` (CKD-EPI), incluida la marca de discordancia.
3. **cNoHDL = CT − HDL**, IMC, y las metas LDL/cNoHDL por categoría (tabla).
4. **Detección de falla** (`actual > meta+15%`) y su gradación (grave/leve).
5. **Tabla de vigencias por estadio** + la regla «2 vigencias → la más corta» + el override RAC≥30
   (este último **ya existe**).
6. **Bloqueos KDIGO** de PTH/Fósforo/Albúmina — cierra literalmente el pendiente de v12.5.6.
7. **Lista negra** (Ácido Úrico, Sodio, Potasio, Ionograma, Hematocrito aislado, EKG, Depuración
   24h) y la regla «lipídica nunca aislada: CT/HDL/LDL/TG juntos».
8. **Festivos Colombia 2026-2027** y el ajuste a día hábil. Hoy el script **solo** evita fines de
   semana: agenda sobre festivos. Es un arreglo pequeño y de valor inmediato, **independiente de
   todo lo demás**.
9. **Cálculo de FTL / fecha de control**, Cosecha, ANR. Es la parte más intrincada, pero es
   aritmética de fechas pura, 100 % testeable.

### 🟡 ÁMBAR — Se porta, pero solo COMO AVISO, nunca como acción

10. **Alertas de dosis renal** (metformina eGFR<30 contraindicada / 30-44 ajustar; rosuvastatina
    <30 máx 10). El motor ya dice «**no cambies meds**». El script **avisa** y punto. Requiere
    leer los medicamentos actuales — hay endpoint (`MedicamentoPorPaciente`) pero **su forma no
    está capturada**: hace falta diagnóstico antes.
11. **Sospecha de IRA** (ΔeGFR≥25 % o salto de estadio entre dos creatininas) → aviso «evaluar
    antes de rutina».
12. **Remisión a nefrología** (eGFR<30, RAC≥300, caída ≥25 % con cambio de estadio) → sugerencia
    visible, nunca una remisión automática.
13. **Uroanálisis / ITU**: el script puede mostrar los criterios objetivos (nitritos, esterasa,
    piuria, bacteriuria) y decir «requiere síntomas para clasificar». **Nunca** debe emitir
    «PROBABLE ITU» ni sugerir antibiótico: eso es juicio clínico y depende de síntomas que el
    script no tiene.

### 🔴 ROJO — No se automatiza. Se pide al médico.

14. **Clasificación de riesgo S2 (P1-P4).** Las entradas (ECV establecida, placa, HF, calcio
    coronario, tabaquismo, sedentarismo…) no están en campos estructurados. Portar el árbol y
    alimentarlo con suposiciones sería inventar una categoría de riesgo — y de ahí sale la meta
    de LDL, y de la meta sale «falla», y de «falla» salen órdenes y citas. **Un error aquí se
    propaga a todo.**
    **Diseño correcto:** el script calcula lo que puede, muestra un formulario corto con las
    casillas que faltan, el médico las marca **una vez**, y eso se persiste con el paciente.
15. **Cualquier orden o cita creada sin confirmación explícita del médico.** El motor produce
    `order_list` y fechas; en el script eso es **una propuesta** que se abre en el modal de
    ordenamiento ya existente, con todo marcado y listo — pero el clic final es del médico.

---

# 5. Dónde vive (y por qué encaja con el rediseño v14)

El médico propuso «cuando se ingrese a la historia clínica». Es exactamente el sitio, y **encaja
sin fricción con la arquitectura v14** que ya está encargada:

- El motor se ejecuta al abrir la historia — mismo disparador que `checkLabsVencidos`,
  `checkAbandonoPES` y `checkRecordatorioPym` (`_enModuloHCHealth()`, una vez por paciente por día).
- Su salida (el «PASO 2 / RESUMEN RCV») es **contenido natural del banner superior de T7**: en vez
  de listar solo actividades PyM pendientes, el banner muestra estadio renal, meta de LDL, foco
  prioritario y la fecha de laboratorios sugerida.
- Los avisos ámbar (dosis, IRA, remisión) son **nivel 3** de la jerarquía de intrusión (D5): modal
  con sonido, igual que Abandono RCV. Son hallazgos que no se pueden pasar por alto.
- La `order_list` alimenta el **widget de ordenamiento** (T5) con las casillas premarcadas.
- **En el panel de agenda no va nada de esto.** El panel es el vigía (D3); esto es asistencia
  clínica y vive en la historia.

**El aviso rojo de labs vencidos que ya existe se convierte en la versión afinada de sí mismo:** en
vez de «faltan estos 7 a 180 días», dirá «faltan estos, según su estadio G3a, y la fecha óptima de
toma es esta».

---

# 6. Plan por fases (cada una entrega valor sola)

| Fase | Qué | Riesgo | Depende de |
|---|---|---|---|
| **R0** | **Festivos colombianos** en el cálculo de días hábiles | 🟢 Bajo | Nada. **Se puede hacer ya.** |
| **R1** | TFG (ambas) + KDIGO + discordancia. **Solo mostrar**, no cambiar ninguna regla | 🟢 Bajo | R0 |
| **R2** | Vigencias por estadio + bloqueos PTH/Fósforo/Albúmina. **En modo sombra**: calcula y registra, pero el aviso sigue con los 180 planos hasta que el médico compare | 🟡 Medio | R1 |
| **R3** | Activar la tabla por estadio como fuente del aviso | 🟡 Medio | R2 + visto bueno del médico |
| **R4** | Metas LDL, cNoHDL, detección de falla | 🟡 Medio | R1 + formulario del paso 14 |
| **R5** | FTL / control / Cosecha / ANR | 🔴 Alto | R2-R4 |
| **R6** | Avisos ámbar (dosis, IRA, remisión) | 🟡 Medio | R1 + captura de medicamentos |

**R0 y R1 son independientes del rediseño visual v14** y se pueden hacer en paralelo sin
conflicto: no tocan `render()` ni el CSS.
**R2 en adelante conviene hacerlo DESPUÉS de T7** (el banner), porque ahí es donde se muestra.

⚠️ **R2/R3 es el punto delicado:** cambiar de 180 plano a tabla por estadio **cambia qué
laboratorios se marcan como vencidos**. En un paciente G4, glicemia pasa de 180 a 60 días — muchos
más avisos. En un paciente sin ERC no cambia nada. Por eso el modo sombra: primero se mide cuánto
cambiaría, el médico lo revisa, y solo entonces se activa.

---

# 7. Conflictos y cosas que hay que decidir antes

1. **`RCV_VIGENCIA_DIAS = 180` contra la tabla del motor.** No es contradicción: el motor dice
   «DM2 sin ERC o HTA sin ERC/DM = todo 180», que es justo el caso mayoritario. Los 180 planos de
   hoy son **el caso general del motor**, ya correcto. La tabla solo cambia las cosas en ERC.
2. **Rangos «90-121» y «60-93» en creatinina.** El motor da un rango y una regla («usa sup; si
   ΔTFG≥25 % o cambio KDIGO en 12 m → usa inf»). Implementable, pero necesita **dos creatininas con
   fecha** para detectar el ΔTFG. Si solo hay una, se usa el superior y se dice.
3. **«MODO ESTABLE (Ficha ≥2 controles estables)»** exige memoria entre consultas. El script hoy
   solo persiste el día en curso (`vgl_proc_today`). Requiere un almacén por paciente con
   histórico — decisión de arquitectura y de privacidad (**PHI en `localStorage`**: hay que
   decidir si se guarda por cédula, hasheada, o solo por `citaId`).
4. **Los festivos están escritos a mano para 2026-2027.** Habrá que actualizarlos cada año. Debe
   quedar visible en Ajustes con la fecha de caducidad, y avisar cuando se acabe la tabla, en vez
   de calcular en silencio con datos viejos.
5. **La FICHA de salida.** El motor la usa como memoria entre sesiones de LLM. En el script no hace
   falta: el estado se persiste directamente. **No la portes** — sería mantener dos verdades.

---

# 8. Lo que hay que pedirle al médico antes de empezar

1. **Confirmar el orden de mando** cuando el motor y el script discrepan. Propuesta: el motor manda
   en lo clínico, el script manda en lo operativo (agenda, cupos, duplicados).
2. **El formulario mínimo del paso 14**: qué casillas está dispuesto a marcar una vez por paciente
   (tabaquismo, sedentarismo, ECV establecida, HF…). Cuantas menos, más pacientes acabarán en
   «PENDIENTE» — y eso es preferible a inventar.
3. **Confirmar la conducta en R3**: cuando la tabla por estadio genere más avisos que los 180
   planos, ¿se activa igual?
4. **Decidir lo de la memoria entre consultas** (punto 3 de §7): sin ella no hay MODO ESTABLE ni
   «FTL previa CUMPLIDA/INCUMPLIDA».

---

# 9. La FTL dentro del modal de agendamiento (encargo del 12-08-2026)

**Lo que pidió el médico:** que el modal de asignación de cita de control **resalte** la fecha de
laboratorios (FTL) y la fecha de control que calcula el motor —conservando su libre albedrío—, que
los exámenes del siguiente control **aparezcan de forma prioritaria**, y que el script los ordene
solo «si es posible».

## 9.1 Evidencia nueva: cómo se ordena de verdad, a mano

Capturado en consultorio (`captura_ordenamiento_paquete_HTA_20260812.json`). El flujo real es:

`Conducta` → botón **Paquetes** → botón **HTA** → añadir a mano lo que falte.

Al pulsar «HTA», Everest llama a un endpoint que **el script no usa hoy**:

```
GET /apiviva/ApiOrdenamientoHealth/api/Combo/ObtenerPaqueteProgramasCupsByCitaId
    ?citaID=<citaId en base64>&paqueteProgramaId=1
```

Devuelve la definición **oficial** del paquete HTA, mantenida por la IPS:

| CUPS | Examen | ¿Lo conoce el script? |
|---|---|---|
| 903841 | Glucosa en suero | ✅ |
| 903818 | Colesterol total | ✅ |
| 903817 | LDL **automatizado** | ✅ |
| 903815 | HDL | ✅ |
| 903868 | Triglicéridos | ✅ |
| 907106 | Uroanálisis | ✅ |
| 903895 | Creatinina en suero | ✅ |
| **902210** | **Hemograma IV** | ❌ **no existe en el script** |
| **903876** | **Creatinina en orina parcial** | ❌ **no existe en el script** |
| **903028** | **Microalbuminuria semiautomatizada** | ❌ **no existe en el script** |

**`paqueteProgramaId=1` = HTA.** Los ids de los demás paquetes (DM2, ERC…) **no están capturados**.

### Hallazgo A — El script avisa de un examen que no sabe ordenar

`RAC` está en `RCV_VIGENCIA_KEYS`: el script avisa en rojo cuando vence. Pero **la relación
albuminuria/creatinina se produce con 903876 + 903028**, y **ninguno de los dos existe en el
archivo**. Es decir: el script sabe decir «el RAC está vencido» y su paquete de ordenamiento **no
puede pedirlo**. Por eso en la captura el médico lo añade a mano.

Lo mismo con el hemograma (902210), que el paquete oficial incluye y el script no.

### Hallazgo B — El paquete oficial CORROBORA una decisión ya tomada

El paquete HTA usa **903817 (LDL automatizado)**, no el 903816. Coincide exactamente con la regla
que el médico ya había fijado en v12.4.0: el 903816 es para tamizaje de **sanos** (Z108) y el
903817 para **crónicos** (HTA/DM2/ERC). La fuente oficial confirma la distinción.

### Hallazgo C — ⚠️ Everest tiene su propia compuerta antiduplicado, y la API la esquiva

En la captura, al añadir **Microalbuminuria** y **Hemoglobina glicosilada**, Everest interrumpió con
un diálogo **«¿Repetirlo?» → «Confirmar»**. Al añadir **Albúmina**, con un **«Entendido»**.

Eso es Everest avisando de que ese examen ya está ordenado o vigente, y **exigiendo una decisión
consciente del médico**.

**El script ordena por API (`apiOrdenamientoGuardar`), no por la interfaz — así que NO ve esos
diálogos y NO los responde.** Un ordenamiento automático desde el script **se saltaría la compuerta
antiduplicado del propio Everest**, en silencio.

> **Consecuencia de diseño, no negociable:** si el script va a proponer exámenes, **debe hacer él
> mismo la comprobación que hace ese diálogo** —cruzar contra
> `ObtenerOrdenamientoPorPacienteIdVigente` (§1.6 del superprompt v14)— y **mostrar al médico qué
> está repitiendo y por qué**, antes de que confirme. No basta con replicar los clics.

### Hallazgo D — Los «pasajeros» del motor son reales

Lo que el médico añadió a mano después del paquete fue: **PTH, Albúmina, Fósforo, Hemoglobina** y
**HbA1c**. Son exactamente los *pasajeros* del motor RCV (§S3) — los que no fijan la fecha pero se
anclan a ella. El modelo driver/pasajero **describe la práctica real**, no es teoría.

## 9.2 Decisión de diseño para el modal (tarea R7)

**Dos fechas, jerarquía visual clara, cero imposición:**

1. **La FTL y la fecha de control se marcan como sugeridas**, con el porqué a la vista
   («creatinina vence el 3 de octubre»). Se usa el realce de la cita sugerida que ya está
   encargado en C2 del brief de agendamiento — **no se inventa un segundo lenguaje visual**.
2. **El resto del calendario sigue disponible e igual de accesible.** La sugerencia se distingue;
   no se ocultan ni se degradan las demás opciones. Regla sagrada 4: el script sugiere, el médico
   decide.
3. **La lista de exámenes del siguiente control vive en el propio modal**, junto a la FTL, no en
   otra pantalla: es lo que justifica la fecha. Cada examen dice **por qué está ahí** (vencido,
   por vencer, o adelantado para no hacer volver al paciente).
4. **El paquete oficial es el PUNTO DE PARTIDA, no la autoridad.** (Corregido por el médico el
   12-08-2026 — la versión anterior de esta decisión estaba equivocada.)

   El paquete HTA que devuelve Everest **contiene exámenes mal escogidos para esta población**, y el
   médico los **quita** y **añade a mano** los que faltan. Lo que se ordena de verdad es esa lista
   curada, no la que llega del endpoint.

   Por tanto:
   - Se usa **`paqueteProgramaId=1` (HTA) como base única**. No hay que perseguir los ids de DM2 ni
     ERC: se parte de HTA y se cura.
   - La **lista curada del médico manda** sobre el paquete oficial. El endpoint sirve para dos cosas:
     resolver los ids internos de CUPS que Everest necesita, y **avisar cuando la IPS cambie el
     paquete** (si aparece o desaparece un código respecto a la lista curada, se registra y se dice).
   - **Qué se ordena de esa lista curada lo decide la VIGENCIA de cada analito**, no el paquete: un
     examen vigente no se pide otra vez salvo por la regla de Cosecha (§9.4).

   ⚠️ **Patrón detectado, pendiente de confirmar:** el paquete trae `903028 MICROALBUMINURIA
   SEMIAUTOMATIZADA` y en la captura el médico añade a mano «MICROALBUMINURIA **AUTOMATIZADA** EN
   ORINA PARCIAL» — una variante distinta. Es el mismo tipo de corrección que ya está documentada en
   v12.4.0 con el LDL (`903816` semiautomatizado para tamizaje de sanos frente a `903817`
   automatizado para crónicos). **Sospecha razonable, no confirmada:** el paquete oficial trae
   variantes *semi*automatizadas donde esta población necesita las *automatizadas*. No se implementa
   nada sobre esta sospecha hasta tener la lista curada real.
5. **Ordenar: premarcado, nunca automático.** El script deja el ordenamiento listo —paquete +
   pasajeros + lo que el motor añada— con **cada repetición señalada** (Hallazgo C), y el médico
   confirma con un clic. Se conserva `markOrdenesCreadasHoy` con su regla de agrupador real.

## 9.4 Cosecha — CERRADA por el médico (12-08-2026)

Se adelanta un examen **aún vigente** para que el paciente venga una sola vez, **solo si le queda
menos del 25 % de su vigencia** — el límite que trae el propio motor. Por encima de eso, el examen
se deja para su fecha y no se desperdicia.

## 9.5 Lo que falta capturar antes de implementar R7

1. **LA LISTA CURADA REAL — bloqueante.** Los CUPS finales que el médico ordena de verdad, después
   de quitar del paquete lo que sobra y añadir lo que falta. La captura muestra los NOMBRES de lo
   añadido (Microalbuminuria automatizada, PTH molécula intacta, Albúmina en suero, Fósforo en
   suero, Hemoglobina, HbA1c automatizada) pero **no sus códigos CUPS**, y **no muestra qué se
   quitó**. Sin esa lista no se implementa nada: sería inventar códigos clínicos.
2. **El contrato exacto del diálogo «Repetirlo»**: qué lo dispara y con qué criterio. Sin esto, el
   script puede señalar repeticiones donde Everest no las vería, o al revés.
3. ~~Los `paqueteProgramaId` de DM2 y ERC~~ — **descartado por el médico**: se parte de HTA y se cura.
