# ACCESO · 01 — ENTREVISTA AL DUEÑO (Misión B)
Una sola tanda. Responde estilo «1B, 2A, 3A, …». Si no respondes una, NO se inventa:
esa decisión queda como bloqueante para esa parte del diseño. Sin respuestas NO se escribe código.

---

**1. Psicología/Odontología y PyM — hoy los ve cualquier médico no autorizado. ¿Qué pasa con esos módulos?**

- A) **(RECOMENDADA)** Fuera para todos: quien no está en el padrón no ve nada, y esos módulos tampoco se montan para el perfil LABORATORIOS (su lista de permitidos es cerrada y no los incluye). Si mañana hacen falta, se activan por lista remota SIN publicar versión nueva.
  *Por qué: es exactamente lo que dice tu especificación (LABORATORIOS = lista cerrada; desconocido = nada y en silencio), y reduce superficie que mantener.*
- B) Mantenerlos para LABORATORIOS además de su lista actual.
- C) Mantenerlos para cualquier médico de Everest salvo blocklist (parecido a hoy).
- D) Crear un tercer perfil PSICODONTO con esas capacidades.

**2. Órdenes de PyM para los restringidos (¿Maryuris/Daniela/Moisés pueden GENERAR órdenes de PyM?)**

- A) **(RECOMENDADA)** No: emitir/generar órdenes queda solo para PERFIL COMPLETO. LABORATORIOS agenda y consulta, no emite órdenes.
  *Por qué: la orden viaja por correo/red con datos del paciente; quien agenda laboratorios no necesita emitir órdenes. Si un día hace falta, se habilita por lista remota sin publicar versión.*
- B) Sí, LABORATORIOS también genera órdenes PyM.
- C) Sí, pero solo imprimir/PDF, sin envío por correo.
- D) Decidirlo más adelante con telemetría de uso.

**3. ¿El acceso se ata al MÉDICO o al EQUIPO?**

- A) **(RECOMENDADA)** Al médico: identidad = `UsuarioId` de la sesión de Everest; en un PC compartido cada quien inicia sesión y recibe SU perfil.
  *Por qué: es tu decisión D1; los permisos siguen a la persona, no a la máquina; evita que un perfil quede "instalado" en un equipo que hoy usa otro.*
- B) Al equipo: identidad recordada en el navegador/PC.
- C) Híbrido: el médico manda, pero en equipos de un solo usuario se recuerda al último.
- D) Por sede/IP del consultorio.

**4. Aviso de paciente nuevo en el turno: ¿interrumpe o marca discreta?**

- A) **(RECOMENDADA)** Discreta: toast NO bloqueante que se auto-cierra + un contador en el dock; jamás un modal.
  *Por qué: tu propio requisito de «presupuesto de interrupciones» apunta a no secuestrar la pantalla; en un turno de laboratorio con muchos pacientes nuevos, un modal por paciente sería castigo.*
- B) Modal bloqueante la primera vez de cada paciente, toast las demás.
- C) Solo marca/badge en el dock, sin toast.
- D) Toast + sonido.

**5. ¿Quién agrega gente al padrón y cómo?**

- A) **(RECOMENDADA)** Solo tú: editas la lista remota en el Apps Script (lista versionada con fecha; el script la valida antes de aplicar y conserva la anterior si viene corrupta).
  *Por qué: una sola fuente de verdad, auditable por versión de lista en la telemetría, y cambiar permisos NO obliga a publicar versión del userscript.*
- B) Tú + una persona delegada con su propia clave.
- C) Automático: un `UsuarioId` nuevo pide aprobación desde el tablero.
- D) Cualquier PERFIL COMPLETO puede proponer y tú apruebas.

**6. Cuando la blocklist gana, ¿el bloqueado ve algo?**

- A) **(RECOMENDADA)** Silencio total: mismo comportamiento que un desconocido — el script no monta nada, SIN cartel de "no autorizado"; la tentativa queda solo en la telemetría de acceso.
  *Por qué: tu regla nueva lo pide así para desconocidos; un cartel distinto para bloqueados le informa exactamente a quien está sondeando; la telemetría te da el registro sin alertarlo.*
- B) Mensaje discreto: «servicios del consultorio no disponibles».
- C) Cartel explicativo con el motivo.
- D) Silencio local pero aviso inmediato al tablero en tiempo real.

**7. ¿Los nombres completos de los médicos salen del archivo distribuido?**

- A) **(RECOMENDADA)** Sí: el padrón con nombres vive SOLO en la lista remota (Apps Script) con caché local de respaldo versionada con fecha; el userscript distribuido lleva únicamente la lógica.
  *Por qué: menos nombres personales en el Gist y en las máquinas; cambiar el padrón no exige publicar versión; la gracia de 12 h (D2) cubre cuando la lista remota no responde.*
- B) No: mantener los nombres embebidos y la lista remota como extra.
- C) Solo `UsuarioId` numéricos embebidos; los nombres solo en remota.
- D) Blocklist remota pero padrón embebido.

---

## Recordatorios que ya están decididos (NO se preguntan de nuevo)

- Los NO autorizados usan Everest con total normalidad; el script jamás interfiere la web para ellos.
- Desconocido = script no monta nada, SILENCIOSO (sin cartel).
- Blocklist gana SIEMPRE sobre cualquier lista.
- Gracia de 12 h cuando no hay identidad (D2); lista corrupta = se conserva la anterior (D3).
- Telemetría de acceso SIN datos de paciente: perfil aplicado, motivo, versión de lista, intentos bloqueados, uso de gracia.
- Userscript = control operativo, NO seguridad; proponer al Apps Script rechazar identificadores fuera del padrón.

---

## RESPUESTAS DEL DUEÑO — REGISTRADAS 2026-09-04

`1C · 2B · 3A · 4A · 5A · 6A · 7A` (recibidas como comentarios sobre este archivo)

| # | Resp. | Decisión vigente |
|---|---|---|
| 1 | **C** | Psicología/Odontología y PyM se mantienen para CUALQUIER médico de Everest salvo blocklist (como hoy). REFINA «desconocido no ve nada»: el desconocido no ve Centinela/agendamiento/laboratorios/RCV/redactor, pero SÍ ve psic-odonto y PyM |
| 2 | **B** | LABORATORIOS (Maryuris/Daniela/Moisés) SÍ puede GENERAR órdenes de PyM |
| 3 | **A** | Identidad atada al MÉDICO: `UsuarioId` de la sesión (D1); en PC compartido cada sesión recibe SU perfil |
| 4 | **A** | Aviso paciente nuevo DISCRETO: toast no bloqueante auto-cerrado + contador en dock; jamás modal |
| 5 | **A** | Padrón solo lo edita el dueño en la lista remota del Apps Script (versionada con fecha, validada antes de aplicar) |
| 6 | **A** | Blocklist = silencio total idéntico al desconocido; la tentativa queda solo en telemetría de acceso |
| 7 | **A** | Nombres completos SOLO en la lista remota + caché local de respaldo versionada; el userscript distribuido lleva únicamente lógica |

Consecuencia 1C+2B: `psic_odonto` y `pym` (módulo Y generación de órdenes) son capacidades
PÚBLICAS (todo médico de Everest no bloqueado); el resto del gating sigue al padrón.
`ordenamiento` (30103) — RESUELTO EN IMPLEMENTACIÓN (2026-09-04, mapeo con grep pegado):
«generar orden PyM» y «ordenamiento L30103» son LA MISMA superficie (bOrd L8192 →
`openOrdenamientoModal` L30103 → `apiOrdenamientoGuardar` L29900, único llamador L30601 dentro
del mismo modal; el botón de Conducta simula Paquetes sin POST desde v17.35.0, L30828-30864).
La capacidad se FUSIONA en `pym` (PÚBLICA): LABORATORIOS y cualquier médico no bloqueado
pueden generar órdenes PyM, tal como aprobó 2B. Declarado, vetable sin costo.

Interpretación declarada (ajustable sin costo, no bloquea el trabajo): las capacidades
públicas se montan aunque la sesión no tenga identidad, como hoy; y el blocklist solo se puede
aplicar cuando HAY identidad. Si esta lectura no es la querida, se corrige en la lista remota
(declarar `psic_odonto`/`pym` como capacidad con perfil) sin publicar versión nueva.
