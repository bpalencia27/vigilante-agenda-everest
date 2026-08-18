## 2024-08-15 - Missing Accessible Names on Floating Action Buttons
**Learning:** Found several missing `aria-label` attributes on floating action/overlay buttons (`vgl-dock-btn`, `vgl-pymb-toggle`, etc) across the interface. However, I learned that adding `aria-label` to buttons that already have visible text (like "Entendido") is an accessibility regression because it overrides their programmatic name, violating WCAG 2.5.3 (Label in Name). Voice command users wouldn't be able to activate them by saying the text they see on screen.
**Action:** Only add `aria-label` to truly icon-only buttons. Do not add `aria-label` to buttons that already have a textual name.

## 2024-05-30 - Missing ARIA State Updates in Dock UI
**Learning:** Some toggle buttons (like the `btnToggle` in `createAccionesDockUI`) get their initial ARIA labels and text content set correctly on render, but fail to update them inside their `click` event listeners when the state changes. This leaves screen readers and visually impaired users with stale information about the state of the toggle.
**Action:** Always verify that state-dependent ARIA attributes (e.g. `aria-label`, `aria-expanded`) and UI text strings are dynamically updated within the event listeners handling the toggle action, rather than only on initial render.
