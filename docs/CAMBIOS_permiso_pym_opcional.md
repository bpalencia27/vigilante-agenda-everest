# CAMBIOS — Permiso `pym_opcional` (programa especial/PyM no obligatorio por médico)

- **Fecha:** 2026-09-07
- **Responsable del desarrollo:** enjambre de implementación (SA-DEV) sobre requerimiento
  expreso del dueño del proyecto.
- **Versión:** userscript v18.4.4 · TABLERO (Apps Script) v12.10.15

## Alcance EXCLUSIVO

Un único permiso individual, concedido **fila por fila** en el padrón (hoja "acceso"
del tablero), 6ª columna "caps extra":

- `pym_opcional` → el modal **Agendar** NO exige elegir programa especial/PyM
  (HTA, HTA+DM, Nefroprotección…) antes de confirmar la cita.

Sembrado de fábrica para **un solo perfil**: Dra. Gloria Alejandra Jaramillo Montoya
(Medicina General — no Riesgo Cardiovascular; autorizada al padrón en v12.10.14).
**Ningún otro médico cambia**: sin la columna o sin el valor, la obligatoriedad de
v18.0.126 queda intacta (verificado por prueba de regresión en suite_78).

## Por qué esta forma (y no un flag local)

- El padrón del **servidor** es la única fuente de verdad (v18.1.0, B2): la caché
  local `vgl_acceso_lista` es un espejo que el refresco de 4 h corrige. La exención
  **no** es un toggle de consola ni de Ajustes.
- La exención se re-resuelve en la **capa c** (justo antes de escribir, dentro de
  `_confirmarCita`): forzar el DOM no basta, el padrón manda. Es la validación
  «de servidor» disponible en esta arquitectura: el backend real del agendamiento
  es Everest (ajeno, no modificable).
- Blocklist gana SIEMPRE sobre las caps (prueba en suite_78).
- Cero PHI en el userscript: el nombre de la beneficiaria vive solo en la Hoja.

## Piezas

| Pieza | Cambio |
|---|---|
| `TABLERO/Codigo.gs` (v12.10.15) | Hoja "acceso" +6ª columna; semilla con `pym_opcional` para la Dra.; `_listaAccesoRespuesta` publica `caps` por entrada |
| `vigilante_agenda.user.js` (v18.4.4) | `accesoCapExtra(cap)`; guarda de `_confirmarCita` consulta la exención; placeholder/tooltip «(opcional para su perfil)» |
| `tests/suite_78_acceso.js` | +2 casos (cap leída del padrón; blocklist gana) — fixtures SIMULADOS |
| `tests/suite_89_nt_mejoras.js` | +1 caso de contrato (la guarda consulta la exención) |

## Validación

- Mutación A (guarda sin exención) → suite_89 roja exacta; restaurada → verde.
- Mutación B (`accesoCapExtra` siempre false) → suite_78 roja exacta; restaurada → verde.
- Banco completo: ver `AUDITORIA/cierre_v1844_raw.txt`.
- Regresión RCV: un médico SIN la cap (Brandon, uid 101) no se exime (suite_78).

## Para desconfigurar/revertir

Borrar `pym_opcional` de la celda de esa fila en la hoja "acceso" (o poner estado
`bloqueado`/`inactivo`). El refresco del padrón (≤4 h, o al guardar Ajustes) revierte
la exención. No requiere tocar el userscript.
