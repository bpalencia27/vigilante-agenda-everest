# Auditoría de Historial Git y Plan de Limpieza de Ramas (R5.6)

**Fecha de Auditoría:** 2026-08-14  
**Hito:** M6 — Entrega, Reversión y Limpieza  
**Rama Base de Congelamiento:** `claude/pym-agenda-blindaje-v12-4` (HEAD `be6d75a`)  
**Rama de Producción Final:** `main`  
**Rama de Continuación Humana:** `claude/v14-continuacion`

---

## 1. Clasificación Taxonómica de Ramas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INVENTARIO Y CLASIFICACIÓN DE RAMAS                  │
├────────────────────────────────┬────────┬───────────────────────────────┤
│ CATEGORÍA                      │ TOTAL  │ ACCIÓN RECOMENDADA            │
├────────────────────────────────┼────────┼───────────────────────────────┤
│ 1. Ramas Activas / Producción  │   3    │ Conservar y Proteger          │
│ 2. Ramas Fusionadas / Cerradas │  14    │ Conservar como Referencia     │
│ 3. Ramas Inactivas / Históricas│  11    │ Archivar                      │
│ 4. Ramas Efímeras de Agentes   │  22    │ Seguras para Purgar (Prune)   │
└────────────────────────────────┴────────┴───────────────────────────────┘
```

---

## 2. Inventario Detallado y Justificación por Rama

### 2.1 Ramas Activas y de Producción (3 ramas) — NO TOCAR
| Nombre de la Rama | Último Commit | Rol / Propósito | Estado |
|---|---|---|---|
| `claude/pym-agenda-blindaje-v12-4` | `be6d75a` | Rama base oficial del endurecimiento a producción (v14.1.6, 1106 tests ok). | **CONGELADA / HEAD INMUTABLE** |
| `main` | `d528158` | Tronco principal del repositorio. Recibirá el merge final tras el Victory Audit. | **ACTIVA / PRODUCCIÓN** |
| `claude/v14-continuacion` | `37f8d44` | Rama de trabajo posterior reservada para nuevos desarrollos del equipo humano. | **ACTIVA / DESARROLLO** |

---

### 2.2 Ramas Fusionadas e Integradas (14 ramas) — CONSERVAR EN REMOTO
Estas ramas contienen hitos de funcionalidad que ya forman parte del userscript o de las suites de prueba:
1. `feature/v8.2.0-rcv-copilot-playwright-e2e` (`bea69e6`): Asistente Clínico v8.2.0 y suites E2E Playwright.
2. `feature/fast-order-clipboard` (`7fa9055`): Corrección de inyección de uroanálisis por sub-analitos acumulados.
3. `feat/guardas-plausibilidad-labs-18251536352912900046` (`f55a441`): Guardas de rangos biológicos en los 11 analitos séricos.
4. `feat/design-tokens-v14-t3-7157743991741318371` (`bb7a017`): Tokens de diseño Fase 3 (tipografía, superficies y contraste AA).
5. `feat/boton-conducta-14424814438687917933` (`44c9ced`): Botones de conducta para solicitar paraclínicos renales vencidos.
6. `feat/signos-vitales-pas-pad-imc-12831725100307144614` (`d135832`): Visualización de signos vitales en modal de estadio renal.
7. `sentinel/fix-xss-innerhtml-9907423180579880772` (`f9dafcb`): Auditoría inicial de sumideros DOM y escape de variables.
8. `palette/add-aria-labels-icon-buttons-4581138381174715051` (`c0d6411`): Incorporación de etiquetas ARIA y accesibilidad en botones.
9. `fix/phi-redaccion-capturas` (`6fa8eb8`): Purga de datos ficticios/PHI en capturas versionadas.
10. `jules/auditoria-mutaciones-8022649020939938505` (`02d77a8`): Informe basal de mutaciones y runner de pruebas.
11. `jules/ci-endurecido-12822376298166160329` (`fdd2c8b`): Integración continua con detección de muerte silenciosa.
12. `claude/reconciliacion-final` (`fd6ef8f`): Suite 20 del envío de órdenes por correo.
13. `claude/tests-reconciliacion-real` (`0cdc335`): Suites 09 a 17 completadas.
14. `claude/unificacion-v12` (`b213474`): Unificación del userscript y banco de pruebas Node.

---

### 2.3 Ramas Inactivas o Históricas (11 ramas) — ARCHIVAR
Ramas de etapas previas de desarrollo superadas por la arquitectura actual:
1. `TA-atendido-vs-en-sala-16610749498711615314`: Pruebas preliminares de la máquina de estados de agenda.
2. `auditoria-vigilante-18413085853632595378`: Auditoría de código anterior a v12.
3. `bolt-performance-fuzzymatch-16304275952334768464`: Prototipo de búsqueda difusa.
4. `chore/panel-activities-8151824262821374282`: Tareas previas del panel PyM.
5. `claude/auditoria-telemetria-v11.0.1`: Análisis de telemetría de versión 11.
6. `claude/vigilante-agenda-everest-a51121`: 37 correcciones de telemetría en v11.
7. `claude/vigilante-performance-diagnosis-x5bxeu`: Diagnóstico de etiquetas en v7.8.4.
8. `t4-panel-amputacion`: Boceto de panel independiente T4.
9. `t5-dock-widgets`: Boceto de widgets desacoplados T5.
10. `t7-banner-pym`: Boceto de banner preventivo T7.
11. `feat/userscript-vigilante`: Correcciones de visualización en iframe.

---

### 2.4 Ramas Efímeras de Agentes — SEGURAS PARA PURGAR (22 ramas)
Estas ramas fueron creadas por herramientas automatizadas de agentes (Jules, réplicas de Claude, tests aislados). Todo su código útil ya fue integrado en `claude/pym-agenda-blindaje-v12-4` (verificado con 1106 pruebas pasando):

- `origin/jules-1182130532967651698-8bf01a69`
- `origin/jules-12505086896811818475-53dbace6`
- `origin/jules-3352231057006098125-b81bf3a8`
- `origin/jules-4338662505867832380-f8f64f4d`
- `origin/jules-6765660019975627443-2ee542c0`
- `origin/jules-7139228688149242088-1dd48dbd`
- `origin/jules-T1-render-css-classes-14361398469204543134`
- `origin/jules-audit-rcv-pym-11433043872825511042`
- `origin/jules-diagnostico-etiquetas-t1-13674093026209210658`
- `origin/jules/boot-jsdom-8098678096466933191`
- `origin/claude/pym-agenda-blindaje-v12-4-*` (11 ramas de réplica temporal generadas por subagentes)
- `origin/tests/instalar-caza-errores-16520404410538748181`
- `origin/tests/open-lab-solo-modal-8722515388218816465`
- `origin/tests_suite_08_canon_hba1c-7846263174818044501`
- `origin/tests_suites-15037959922065746445`
- `origin/test/antiduplicado-ordenes-18376406447358373563`
- `origin/test/cobertura-honesta-8969698513126564225`
- `origin/test/pruebas-que-si-fallan-895399512114377463`

---

## 3. Comandos Seguros para Poda de Ramas (Post-Release)

Una vez completada la fusión final de `claude/pym-agenda-blindaje-v12-4` a `main`, el administrador del repositorio puede ejecutar:

```bash
# 1. Purgar referencias remotas que ya no existen
git fetch --prune origin

# 2. Eliminar ramas efímeras de agentes en el servidor remoto (ejemplo por prefijo)
git push origin --delete $(git branch -r | grep 'origin/jules-' | sed 's/origin\///')
git push origin --delete $(git branch -r | grep 'origin/test/' | sed 's/origin\///')
git push origin --delete $(git branch -r | grep 'origin/tests/' | sed 's/origin\///')

# 3. Eliminar ramas locales de trabajo ya integradas
git branch -d pr-12
git branch -d pr10-jules
git branch -d fix-panel
```
