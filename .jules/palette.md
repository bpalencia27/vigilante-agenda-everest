## 2024-08-15 - Missing Accessible Names on Floating Action Buttons
**Learning:** Found several missing `aria-label` attributes on floating action/overlay buttons (`vgl-dock-btn`, `vgl-pymb-toggle`, etc) across the interface. However, I learned that adding `aria-label` to buttons that already have visible text (like "Entendido") is an accessibility regression because it overrides their programmatic name, violating WCAG 2.5.3 (Label in Name). Voice command users wouldn't be able to activate them by saying the text they see on screen.
**Action:** Only add `aria-label` to truly icon-only buttons. Do not add `aria-label` to buttons that already have a textual name.

## 2024-11-20 - Adding context to "Understood" buttons while preserving visible text
**Learning:** When adding or fixing accessibility features like `aria-label` on elements with visible text (e.g., 'Entendido'), ensure the `aria-label` includes the exact visible text to comply with WCAG 2.5.3 (Label in Name). Instead of blindly replacing a descriptive label, update it to prepend the visible text (e.g., 'Entendido, cerrar advertencia') to preserve context for screen readers.
**Action:** When improving generic button labels like "Entendido" or "Cerrar", always start the `aria-label` with the visible text, then append the contextual information.
