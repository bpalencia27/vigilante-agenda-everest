## 2024-08-15 - Missing Accessible Names on Floating Action Buttons
**Learning:** Found several missing `aria-label` attributes on floating action/overlay buttons (`vgl-dock-btn`, `vgl-pymb-toggle`, etc) across the interface. However, I learned that adding `aria-label` to buttons that already have visible text (like "Entendido") is an accessibility regression because it overrides their programmatic name, violating WCAG 2.5.3 (Label in Name). Voice command users wouldn't be able to activate them by saying the text they see on screen.
**Action:** Only add `aria-label` to truly icon-only buttons. Do not add `aria-label` to buttons that already have a textual name.
## 2026-08-21 - Missing Dynamic ARIA state on Toggle Buttons
**Learning:** Found that toggle buttons (like the dock toggle) had their ARIA attributes (like `aria-label`) and text set only on initialization. This means they become stale when clicked. Furthermore, `aria-expanded` was missing entirely.
**Action:** When implementing or fixing toggle buttons, ensure state-dependent ARIA attributes and UI text strings are dynamically updated within their `click` event listeners, and include `aria-expanded`.
