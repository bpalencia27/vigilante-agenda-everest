## 2024-08-15 - Missing Accessible Names on Floating Action Buttons
**Learning:** Found several missing `aria-label` attributes on floating action/overlay buttons (`vgl-dock-btn`, `vgl-pymb-toggle`, etc) across the interface. However, I learned that adding `aria-label` to buttons that already have visible text (like "Entendido") is an accessibility regression because it overrides their programmatic name, violating WCAG 2.5.3 (Label in Name). Voice command users wouldn't be able to activate them by saying the text they see on screen.
**Action:** Only add `aria-label` to truly icon-only buttons. Do not add `aria-label` to buttons that already have a textual name.

## 2024-05-18 - Missing Accessible Names on PDF View Buttons
**Learning:** Found an icon-only button (📄) for viewing PDF reports (`.vgl-labs-pdf`) in `vigilante_agenda.user.js` that only provided context via a `title` attribute. Adding an `aria-label` provides explicit context for screen readers and fulfills accessibility requirements for icon-only buttons.
**Action:** Always add `aria-label` to icon-only buttons like this to ensure they have an accessible name, keeping it consistent with the visible `title`.
