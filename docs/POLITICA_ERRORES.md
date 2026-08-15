# Política de Manejo de Errores y Falla Segura (R3.1 / R1.8)

**Versión:** 1.0.0 (RC v14.1.6)  
**Fecha:** 2026-08-14  
**Hito:** M3 — Robustez, Concurrencia, Estado y Red  
**Alcance:** Userscript `vigilante_agenda.user.js`, Telemetría de Errores y Banco de Pruebas  
**Cumplimiento Normativo y Clínico:** Habeas Data (Ley 1581/2012), Confidencialidad de Historia Clínica (Res. 1995/1999), Invariantes de Dominio de `AGENTS.md`.

---

## 1. Declaración de Principios

El **Vigilante de Agenda** opera en tiempo real en consultorios médicos durante la atención de pacientes reales en el EHR ("Everest" / Athenea Soluciones). Una excepción no controlada o un error tragado silenciosamente puede:
1. Producir cálculos clínicos erróneos (TFG/KDIGO, riesgo cardiovascular, metas PyM).
2. Introducir estados inconsistentes o corrupción en la interfaz del EHR.
3. Sobrescribir en silencio decisiones clínicas del médico tratante.
4. Ocultar fallas estructurales de integración o cambios en la API del EHR.

Por tanto, el proyecto adopta una **política de tolerancia cero al tragado silencioso de errores**, estructurada en tres niveles obligatorios y guiada por el principio de **Falla Segura y Cerrada (Fail-Closed)**.

---

## 2. Taxonomía de Niveles de Error (Error Handling Tiers)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MATRIZ DE ERRORES                             │
├──────────────────┬──────────────────────┬───────────────────────────────┤
│ TIER / NIVEL     │ NATURALEZA           │ COMPORTAMIENTO EXIGIDO        │
├──────────────────┼──────────────────────┼───────────────────────────────┤
│ TIER 1: CRÍTICO  │ Datos clínicos, TFG, │ • Falla cerrada (Fail-Closed) │
│ CLINICO          │ RCV, PyM, Auto-Labs, │ • Cero invención o corrupción │
│                  │ Ordenamiento, Agenda │ • Reportar a telemetría + miga│
│                  │ y Fraude, RAC.       │ • Aviso visual no invasivo    │
├──────────────────┼──────────────────────┼───────────────────────────────┤
│ TIER 2: AMBIENTE │ APIs del navegador   │ • Degradación elegante segura │
│ ESPERADO         │ opcionales, polling  │ • Fallback predecible         │
│                  │ DOM, audio, clipboard│ • Miga en bitácora local      │
│                  │ cuota storage.       │ • Cero spam en telemetría     │
├──────────────────┼──────────────────────┼───────────────────────────────┤
│ TIER 3: UTILIDAD │ Almacén local, JSON, │ • Prohibido `catch(e){}` bare │
│ Y PERSISTENCIA   │ UI general, modales, │ • Registro de depuración      │
│                  │ parseo de strings.   │ • Retorno seguro por defecto  │
└──────────────────┴──────────────────────┴───────────────────────────────┘
```

---

### 2.1 Tier 1: CRITICAL_CLINICAL (Falla Crítica Clínica)

#### Ámbitos Aplicables
- **Función Renal y Laboratorios:** `calcularTFG`, `tfgEstadioKDIGO`, `_calcularEstadioKDIGO`, `interpretarTFG`, `_leerExamenesCronicos`.
- **Riesgo Cardiovascular (RCV):** `rcvCalcularScore`, `rcvClasificarRiesgo`, `_rcvEstimar`, `_rcvGenerarSugerencias`.
- **Protección y Detección PyM:** `pymEvaluarPaciente`, `_pymMetas`, `_bannerPymActualizar`.
- **Auto-Labs e Inyección de Paraclínicos:** `injectLabsIntoCronicos`, `_inyectarLaboratorios`, `_pacienteSigueAbierto`.
- **Generación de Órdenes y CUPS:** `_conductaBuscarYAgregarExamen`, `_agregarOrdenamientoCUPS`, `guardarOrdenamiento`.
- **Agenda, Turnos y Fraude:** `colorAndAlert`, `fraudWatch`, `alertedFraud`, `asignarTurno`, `diaNuevo`.
- **Guardia de Notas Clínicas:** `checkRacGuardia`, `_racRestaurarNota`.
- **Trazabilidad y Recall:** Registro local de acciones clínicas para auditoría (`markCitaAgendadaHoy`, `markOrdenesCreadasHoy`, `markLabsInyectadosHoy`).

#### Reglas Obligatorias de Falla
1. **Falla Cerrada Inmediata (Fail-Closed):** Si ocurre una excepción en cualquier paso de cálculo o inyección clínica, el proceso DEBE abortar inmediatamente sin modificar el DOM del EHR.
2. **Casilla vacía antes que dato inventado:** Jamás sustituir un dato fallido con un valor aproximado, predeterminado no clínico o adivinado.
3. **Invarianza del Médico:** Si el médico ya escribió un valor en una casilla, la excepción jamás debe borrarlo ni pisarlo.
4. **Verificación de Identidad (`_pacienteSigueAbierto`):** Si la identidad del paciente cambia durante una llamada asíncrona, abortar de inmediato con log y sin tocar casillas.
5. **Observabilidad Completa:**
   - Emitir `reportarError(origen, sanitizedMsg, location)`.
   - Registrar la acción previa y el fallo en las migas del Flight Recorder (`_migaPush`).
   - Si la acción fue solicitada interactivamente por el médico (ej. pulsar «Auto-Labs» o «Guardar Orden»), mostrar un mensaje claro y comprensible (ej. toast/alerta) indicando que la acción no pudo completarse y que debe realizarse manualmente.

#### Patrón Canónico de Código Tier 1
```javascript
// ✅ PATRÓN CANÓNICO TIER 1 (CRITICAL_CLINICAL)
try {
  if (!_pacienteSigueAbierto(docIdEsperado)) {
    console.warn("[Vigilante] Operación abortada: el paciente en pantalla cambió.");
    return { status: "aborted", reason: "patient_changed" };
  }
  // ... lógica clínica ...
} catch (err) {
  const errMsg = _sanearMensajeError(err && err.message ? err.message : String(err));
  reportarError("js", errMsg, "modulo_clinico:linea");
  _migaPush("err.clinico:" + errMsg.slice(0, 30));
  console.error("[Vigilante Clínico] Falla crítica contenida:", errMsg);
  // Falla cerrada: no tocar DOM, retornar estado seguro
  return { status: "error", error: errMsg, seguro: true };
}
```

---

### 2.2 Tier 2: EXPECTED_ENVIRONMENTAL (Falla Ambiental Esperada)

#### Ámbitos Aplicables
- **Consultas de Tema del Navegador:** `PAGEWIN.matchMedia("(prefers-color-scheme: dark)")`.
- **Planificación Diferida:** `requestIdleCallback` (con fallback transparente a `setTimeout`).
- **Permisos de Notificación del SO:** `Notification.permission` / `Notification.requestPermission`.
- **Audio de Alerta:** `AudioContext` o `HTMLAudioElement.play()` bloqueados por directivas de autoplay del navegador.
- **Portapapeles:** `navigator.clipboard.writeText` bloqueado por falta de foco o permisos de iframe.
- **Decodificación de URLs Externas:** `decodeURIComponent` sobre parámetros crudos de navegación.
- **Límites de Cuota de Almacén:** `localStorage.setItem` que dispara `QuotaExceededError` y activa purga de emergencia (`purgaPorCuota`).
- **Desconexión de Observadores:** Desconexión o limpieza de `MutationObserver` y `addEventListener` en elementos desmontados del DOM.

#### Reglas Obligatorias de Falla
1. **Degradación Transparente:** La falla ambiental no debe bloquear el flujo de trabajo del usuario ni lanzar errores no capturados.
2. **Cero Polución de Telemetría Remota:** NO llamar a `reportarError` para fallos esperados del entorno del navegador para evitar agotar la cuota de 5 errores/día.
3. **Registro Local:** Registrar mediante `console.debug` o `_migaPush("env.fallback:audio")` en la bitácora interna.

#### Patrón Canónico de Código Tier 2
```javascript
// ✅ PATRÓN CANÓNICO TIER 2 (EXPECTED_ENVIRONMENTAL)
function reproducirAlertaAudio() {
  try {
    const audio = new Audio(SONIDO_ALERTA_B64);
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => { _migaPush("audio.autoplay_blocked"); });
    }
  } catch (e) {
    _migaPush("audio.init_failed");
  }
}
```

---

### 2.3 Tier 3: ELIMINATION_SILENT_SWALLOW (Eliminación de Tragado Silencioso)

#### Ámbitos Aplicables
- Deserialización de JSON (`safeReadJSON`, `readJSON`, `JSON.parse`).
- Persistencia de configuración (`safeWriteJSON`, `writeJSON`, `SETTINGS_KEY`, `GM_setValue`).
- Renderizado de componentes de interfaz (pestañas del dock, modales de ajustes, tooltips).
- Parseo de cadenas de texto y utilidades auxiliares.

#### Reglas Obligatorias
1. **Prohibido `catch(e) {}` Vacío:** Todo bloque `catch` debe contener al menos un registro forense en la bitácora local (`_migaPush`) o `console.warn` saneado.
2. **Retorno Seguro Tipado:** Si una función de utilidad falla, debe retornar un valor por defecto explícito y seguro (`null`, `[]`, `{}` o `def`), documentando la razón en el log.

#### Patrón Canónico de Código Tier 3
```javascript
// ❌ PROHIBIDO (Tragado silencioso)
function readJSON(k, def) {
  try {
    const r = localStorage.getItem(k);
    return r ? JSON.parse(r) : def;
  } catch (e) {
    return def;
  }
}

// ✅ CORRECTO (Observabilidad y Falla Segura)
function safeReadJSON(k, def) {
  try {
    const r = localStorage.getItem(k);
    if (!r) return def;
    return JSON.parse(r);
  } catch (e) {
    _migaPush("storage.parse_err:" + String(k).slice(0, 15));
    console.warn("[Vigilante Storage] Error al leer clave " + k + ":", e);
    // Cuarentena de payload corrupto si no es vacío
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const qKey = "vgl_quarantine_" + k + "_" + Date.now();
        localStorage.setItem(qKey, raw);
        _migaPush("storage.quarantined:" + qKey.slice(0, 25));
      }
    } catch (_qErr) {}
    return def;
  }
}
```

---

## 3. Protocolo de Saneamiento y Cero PHI (`_sanearMensajeError`)

Para garantizar el cumplimiento estricto de Habeas Data y confidencialidad médica:

1. **Purga Numérica de Cédulas e IDs:** Toda secuencia continua de 6 o más dígitos (`\d{6,}`) es eliminada automáticamente.
2. **Ocultamiento de URLs:** Cualquier URL (`https?://...`) es reemplazada por el marcador genérico `<url>`.
3. **Eliminación de Caracteres de Inyección:** Comillas simples, dobles y backticks se sustituyen por espacios.
4. **Acotamiento de Longitud:** Los mensajes de error se truncan estrictamente a un máximo de 180 caracteres.
5. **Cero Datos Clínicos en Payloads:** Prohibido concatenar nombres de pacientes, resultados de analitos, números de historia clínica o diagnósticos en los mensajes de excepción enviados a telemetría.

---

## 4. Gobernanza de Telemetría de Errores (R1.8 / R3.1)

### 4.1 Canal de Telemetría y Límites
- **Presupuesto Máximo:** 5 reportes de error detallados por día por estación de trabajo (`ERR_MAX_DIA = 5`).
- **Deduplicación Local:** Registro de huellas únicas (`origen|donde|msg`) mediante `_errVistos = new Set()`. Errores repetitivos incrementan únicamente el contador agregado `error.distintos` en la ventana de uso de 30 minutos (`uxTrack`).
- **Contexto Forense (Breadcrumbs):** Cada reporte de error detallado adjunta las últimas 8 migas de pan registradas (`migasAntes.join(">")`) sin PHI.

### 4.2 Robustez del Cazador de Errores Global (`_instalarCazaErrores`)
El userscript se ejecuta inyectado en la página del EHR bajo diversos motores de userscripts (Tampermonkey, Violentmonkey) y contextos (`userscript.html`, `blob:`, extensiones Chrome/Edge).
- El filtro de origen DEBE reconocer el userscript sin importar el esquema URI del motor (`/userscript|vigilante|blob:|chrome-extension:/i`).
- Debe ignorar excepciones nativas generadas por scripts propios de Everest o Athenea para no saturar la cuota de errores con fallas ajenas a nuestra extensión.

---

## 5. Verificación Automatizada (Suite 33)

El cumplimiento de esta política se verifica en el pipeline de CI mediante `tests/suite_33_robustez_concurrencia_red.js`, con aserciones que comprueban:
1. **Auditoría de Observabilidad:** Cero bloques `catch(e){}` o `catch(e){return null}` sin observabilidad en funciones de riesgo clínico ALTO.
2. **Saneamiento PHI:** Validación de que `_sanearMensajeError` purga cédulas (ej. `1020304050`), teléfonos y URLs en 100% de los casos.
3. **Tope de Telemetría:** Validación de que el sexto error del día no emite petición de red y solo incrementa métricas agregadas.
4. **Falla Cerrada:** Simulación de excepciones en `injectLabsIntoCronicos`, `calcularTFG` y `rcvCalcularScore` verificando que el DOM y el estado quedan 100% intactos.
