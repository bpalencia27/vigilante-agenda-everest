# Bitácora Local de Escrituras y Protocolo de Recall Clínico

> **Documento Operativo de Trazabilidad y Seguridad del Paciente (G4).**  
> **Destinatarios:** Médico tratante, auditor de calidad y dirección médica.  
> **Objetivo:** Permitir la identificación retrospectiva exacta de pacientes afectados ante un error de inyección de datos, preservando estrictamente la privacidad (cero PHI en red).

---

## 1. Justificación y Alcance

Cuando se detecta una versión defectuosa del userscript que ha estado activa durante varios días en múltiples consultorios, la pregunta médica y legal indispensable es:  
**"¿A qué pacientes específicos, en qué fechas y en qué casillas exactas se escribió un valor incorrecto?"**

Dado que el userscript no transmite datos de pacientes a servidores externos (política Cero-PHI), la respuesta debe resolverse mediante una **Bitácora Local de Escrituras Efectivas** almacenada en el propio navegador.

---

## 2. Arquitectura de la Bitácora Local de Escrituras

La bitácora registra exclusivamente eventos en los que el script **escribe o modifica un dato** en Everest:
1. Inyección de resultados en la Ruta de Crónicos (`injectLabsIntoCronicos`).
2. Adición o guardado de órdenes CUPS en Conducta (`apiOrdenamientoGuardar`).
3. Asignación definitiva de citas en Agenda (`apiAccesoAsignarTurno`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ESTRUCTURA DEL REGISTRO EN BITÁCORA                      │
│                                                                             │
│  - timestamp_local: "2026-08-15T08:14:22.105-05:00"                        │
│  - version_script: "14.1.9"                                                │
│  - usuario_everest: "bpalencia"                                            │
│  - consultorio_id: "CONS_04"                                               │
│  - superficie: "cronicos_labs"                                              │
│  - caso_hash: "a8f9e12...b4c" (SHA-256 de Cédula + Sal Secreta Local)      │
│  - campo_destino: "resultadoCreatinina"                                    │
│  - valor_escrito: "1.05"                                                    │
│  - origen_valor: "Athenea_Solicitud_98412"                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Seguridad, Seudonimización y Sal Local

1. **Seudonimización Fuerte:**  
   El número de cédula del paciente **NUNCA se almacena en texto claro**. Se genera un hash:
   $$\text{caso\_hash} = \text{SHA-256}(\text{Cédula} \parallel \text{Sal\_Local})$$
2. **Aislamiento de la Sal:**  
   La sal criptográfica se genera aleatoriamente en el primer arranque (`crypto.getRandomValues`) y se almacena en `localStorage.getItem("vgl_audit_salt")`. 
3. **Resolución Local por el Médico:**  
   Si la dirección médica informa *"El hash `a8f9e12...` tuvo una inyección errónea"*, el médico puede pegar la cédula del paciente en la herramienta de resolución local de Ajustes para verificar en **0.1 ms** si el hash coincide, permitiendo contactar al paciente sin exponer la base completa.

---

## 4. Gestión de Almacenamiento y Ciclo de Vida

- **Capacidad Máxima:** 500 registros FIFO (aproximadamente 3 semanas de consultas intensivas en un consultorio).
- **Límite de Espacio:** $\le 250\text{ KB}$ en `localStorage`.
- **Caducidad Automática:** Los registros con antigüedad superior a **30 días calendario** se purgan automáticamente al inicio de cada jornada.
- **Exportación Segura:** Botón *"📥 Exportar Bitácora de Auditoría"* en el panel de Ajustes. Genera un archivo JSON con los hashes seudonimizados y muestra una advertencia visible en pantalla.

---

## 5. Procedimiento Operativo: Cómo Resolver un Incidente en 3 Pasos

Si se descubre un fallo en una versión:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. EXPORTAR BITÁCORAS                                                       │
│    El soporte técnico o el médico descarga el archivo JSON de auditoría     │
│    desde el panel de Ajustes en cada consultorio.                           │
│                                                                             │
│ 2. CRUZAR EN EL CONSOLIDADOR INSTITUCIONAL                                  │
│    Se filtran los registros coincidentes con la versión y campo afectado:   │
│    "Versión 14.1.2 + campo resultadoHemoglobina entre 10-ago y 12-ago".     │
│                                                                             │
│ 3. REIDENTIFICAR Y REVISAR HISTORIAS                                        │
│    En cada consultorio, la herramienta local resuelve los hashes a las      │
│    cédulas correspondientes para que el médico ejecute el Recall Clínico.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Orden de Cambio para el Tronco (Especificación Técnica)

Se emite la orden de cambio correspondiente en [`docs/cambios-pendientes/BITACORA_ESCRITURAS_LOCALES.md`](file:///e:/VA_reconciliacion/docs/cambios-pendientes/BITACORA_ESCRITURAS_LOCALES.md) con la especificación para integrar `_registrarEscrituraAuditoria(superficie, doc, campo, valor, origen)` en las tres funciones de escritura del userscript.
