# Project: Vigilante de Agenda — Hardening to Production (RC v14.1.4)

## Architecture
- Single-file Tampermonkey Userscript (`vigilante_agenda.user.js`), single IIFE, zero bundler, zero external runtime dependencies.
- Test Suite (`tests/`): Pure Node.js runner (`node tests/runner.js` / `npm test`), suites matching `/^suite_.*\.js$/`.
- DOM Contracts: Integration points with Everest EHR (`injectLabsIntoCronicos`, `AsignarTurno`, `GuardarOrdenamiento`, `colorAndAlert`, Cockcroft-Gault / KDIGO).
- Security & Telemetry: Safe JSON parsing, XSS prevention, zero PHI logging, kill-switch / canary mechanism.

## Code Layout
- `vigilante_agenda.user.js`: Core production userscript (~14,158 lines, single IIFE).
- `tests/`: Test runners and suites (`runner.js`, `harness.js`, `suite_*.js`).
- `tests/mutantes/`: Mutation catalogs published per subsystem.
- `tests/fixtures/`: Frozen DOM fixtures (`dom_everest_*.html`).
- `docs/`: Audits, clinical specs, runbooks, architecture, PRR (`MAPA_v14.md`, `DEUDA_v14.md`, `ROLLBACK.md`, `RUNBOOK.md`, `PRODUCTION_READINESS_REVIEW.md`, etc.).
- `tools/`: Node.js utility scripts (`tools/inventario.js`, etc.).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Baseline & Safety Net (R0.0-R0.8, R5.1, R5.3, R5.4) | Record baseline, inventory high-risk functions, kill-switch, rollback doc, tools/inventario.js | M0 | ORIGINAL_REQUEST § R0 |
| 2 | Security & PHI (R1.1-R1.9) | Secret scan, XSS audit, connect cleanup, anti-PHI fuzzing, gitignore hardening, telemetry audit, integrity check | M1 | ORIGINAL_REQUEST § R1 |
| 3 | Clinical Correctness & DOM (R2.1-R2.10) | 13 lab whitelist matrix, CUPS verification, renal engine, holidays/timezones, agenda state machine, DOM contracts | M2 | ORIGINAL_REQUEST § R2 |
| 4 | Robustness & Network (R3.1-R3.9) | Error swallowing elimination, idempotency, memory leak guards, prefix isolation, network budget & circuit breaker | M3 | ORIGINAL_REQUEST § R3 |
| 5 | Real Coverage & Mutation (R4.1-R4.5) | 100% high-risk coverage, mutation catalog & execution, 0 surviving mutants in high risk, AST test audit | M4 | ORIGINAL_REQUEST § R4 |
| 6 | Medical UI & Accessibility (R6.1-R6.5) | Medical typography, zero tech jargon, WCAG AA contrast, keyboard/ARIA support, no overlap in clinical resolutions | M5 | ORIGINAL_REQUEST § R5 |
| 7 | Delivery & PRR (R5.2-R5.8) | Clinical changelog, runbook (10 common failures), branch cleanup analysis, PRR documentation | M6 | ORIGINAL_REQUEST § R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Identity, Baseline & Safety Net | R0.0-R0.8, R5.1, R5.3, R5.4 (tools/inventario.js, MAPA_v14.md, DEUDA_v14.md, BASELINE.md, rollback doc, kill-switch) | none | DONE |
| M1 | Security, Secrets & PHI | R1.1-R1.9 (secret scan, XSS audit, @connect, anti-PHI, gitignore, telemetry audit, SHA-256 self-check) | M0 | DONE |
| M2 | Clinical Correctness & DOM | R2.1-R2.10 (13 labs whitelist, CUPS docs, renal engine, holidays/timezones, agenda state machine, DOM contracts) | M0, M1 | DONE |
| M3 | Robustness & Network | R3.1-R3.9 (error handling, idempotency, memory leak tests, vgl_schema migration, network budget & circuit breaker) | M1, M2 | DONE |
| M4 | Real Coverage & Mutation | R4.1-R4.5 (100% high-risk coverage, mutation catalog & execution, 0 surviving mutants in high risk, AST test audit) | M2, M3 | DONE |
| M5 | Medical UI & Accessibility | R6.1-R6.5 (WCAG AA contrast, 14px typography, plain clinical language, ARIA/keyboard, layout safety) | M2 | DONE |
| M6 | Delivery & PRR | R5.2-R5.8, PRR (Changelog, Runbook, Branch audit, PRODUCTION_READINESS_REVIEW.md) | M0-M5 | IN_PROGRESS |

## Interface Contracts
### Medical UI & Notifications ↔ Everest DOM
- Prefix: `#vgl-root`, all injected classes prefixed with `vgl-`.
- Styles: `!important` on text colors outside `#vgl-root`.
- Non-destructive: Casilla del médico es sagrada — never overwrite non-empty fields without explicit user action.

### Laboratory Parsing ↔ Clinical Entry
- 13 Whitelisted labs: Exact match and conversion rules, strict boundary validation.
- Renal Engine: Cockcroft-Gault formula, KDIGO G1-G5, uncalculable on absurd inputs.
