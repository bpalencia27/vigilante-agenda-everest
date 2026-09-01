# Reglas fijadas por el médico — 1-sep-2026

Decisiones tomadas por él en la entrevista de esa tarde. **Son datos clínicos suyos, no
criterios técnicos**: si alguna cambia, se cambia aquí y en el único sitio del código que la
implementa, nunca por deducción de otro sitio.

---

## 1. Repetición de exámenes por FUERA DE METAS

> *«Cuando un paciente se encuentra fuera de metas al momento de calcular los exámenes que se
> ordenarán en el siguiente control se le debe preguntar al médico que si en ese paciente X o Y
> específico desea repetir los exámenes fuera de metas sí o no.»*

| | regla |
|---|---|
| **Cuándo se pregunta** | al calcular los exámenes del siguiente control, si hay alguno fuera de meta |
| **Granularidad** | **UNA pregunta por paciente**, con la lista de exámenes fuera de meta delante |
| **Respuesta SÍ** | se repiten al **50 % de la vigencia original** |
| **Respuesta NO** | se repiten en su **vigencia normal, sin adelantar** |
| **Vigencia de la respuesta** | **solo esta consulta** — se pregunta en cada control |

### Se repiten SIEMPRE, sin preguntar

- **Creatinina en suero** si la **TFG por Cockcroft-Gault < 60**.
- **RAC** (microalbuminuria en orina parcial + creatinina en orina parcial) si el resultado es
  **> 30 mg/g**.

### Colisiones resueltas

**a) KDIGO (D11, v18.0.7) manda sobre la respuesta.** Con TFG < 60 el perfil lipídico **nunca**
se adelanta al 50 %, aunque él responda que sí. No se le pregunta por los lípidos en ese caso, y
la pantalla dice por qué. *(Decisión suya: «Manda KDIGO».)*

**b) La fórmula de la creatinina obligatoria es Cockcroft-Gault**, tal como él la dictó — aunque
la regla vecina (KDIGO) use CKD-EPI 2021. Son fórmulas distintas y un mismo paciente puede
quedar a un lado u otro del 60: la pantalla debe decir **cuál se aplicó**. *(Decisión suya.)*

---

## 2. Disponibilidad de laboratorio ANTES de sugerir una fecha

> *«El módulo debe consultar la disponibilidad de agendas de laboratorios antes de sugerir una
> fecha, porque hoy 01/09 me está sugiriendo un examen para mañana 02/09 y para mañana ya no hay
> citas de laboratorio.»*

| situación | regla |
|---|---|
| la fecha ideal no tiene cupo | buscar el primer día con cupo **hacia atrás, nunca después** |
| cuánto puede alejarse solo | hasta **5 días hábiles**; más allá se detiene y le muestra los días con cupo |
| no hay cupo 5 días hábiles antes del control | se mueve **solo la toma**; el control no se toca |
| AppCita no responde | **sugerir la fecha clínica y decir en pantalla que no se pudo verificar** — nunca inventar disponibilidad |

Razón de «hacia atrás»: tomar el examen antes no le quita validez; tomarlo después alarga el
tiempo que lleva vencido.

Razón de «solo la toma»: el control ya quedó hablado con el paciente.

**Implementado en v18.0.69**, en el sitio exacto de su reporte (la toma forzada por un examen
vencido, `_afinarLabsPrimeroConCupos`): `mtrBuscarCupoLaboratorio` + `mtrVerificarCupoLab`
(motor puro, probado) + `mtrNotaDisponibilidadLab` (el aviso de una línea). Cerró de paso un
defecto real en la sonda que ya existía: comprometía un día como bueno sin haberlo consultado
nunca (el bucle viejo se rendía a los 8 intentos y tomaba el noveno sin verificar), y su
extracción de la respuesta de AppCita solo reconocía dos de las seis formas reales en que esa
API envuelve la lista de turnos.

**Los otros dos sitios, conectados en v18.0.78** (pedido explícito suyo — «hazlo»): mismo motor
(`mtrBuscarCupoLaboratorio` + `mtrVerificarCupoLab` + `mtrNotaDisponibilidadLab`), pintado
primero sin verificar (no bloquea la interfaz) y afinado en segundo plano, sin pisar nunca una
fecha de toma que usted ya haya elegido a mano:

- `cargarHoras` (control-primero): la fecha de toma sugerida es 5 días hábiles antes del
  control ya elegido — el control nunca se toca (regla 3).
- El modal de «toma sola», en el caso exacto de su reporte: cuando ya hay una cita de control
  agendada y se sugiere la toma 5 días hábiles antes. El modo libre (sin cita de control) usa
  otra lógica —el próximo día hábil, no «antes de un control»— y queda fuera de esta regla.

---

## 3. Jornada del médico

- **No trabaja domingos ni festivos.** Nunca. *(«ESO JAMÁS PASARÁ… YO NO TRABAJO NI DOMINGOS NI
  FESTIVOS».)*
- **Sábados: cada dos semanas.** Ancla predeterminada: **sábado 5-sep-2026** — le sirve a él, a
  María Edineth Pino y a Sinaí Mijares. Validado contra su propia telemetría — trabajó el
  22-ago (1.534 eventos) y no el 29-ago (ninguno).
  **Corrección suya, misma tarde (v18.0.68):** el turno no es igual para todos los médicos, así
  que el ancla es un ajuste (`S.sabadoAncla`, campo de fecha en Ajustes) y no una constante del
  script. Vacío = ese médico no trabaja sábados.
- Meta 18 de lunes a viernes, 24 el sábado, +3 de sobreagenda.

---

## 4. Sobre los textos del módulo de agendamiento

> *«Solo quiero simplificar lo más posible el módulo ya que muy poco lo usan y si lo abarrotamos
> de texto menos lo usarían.»*

Criterio permanente para todo texto nuevo de ese módulo: **un hecho por mensaje, sin repetir lo
que otro elemento de la misma pantalla ya dice**. En su captura la fecha sugerida aparecía tres
veces en el mismo cuadro (recuadro, cuerpo del aviso y botón) y con dos fechas de toma
distintas a la vista, que él leyó —con razón— como una contradicción.
