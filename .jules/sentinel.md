## 2024-08-14 - XSS in dynamic string interpolation for innerHTML assignments
**Vulnerability:** User inputs and API data (`selectedDateInfo`, `selectedLabDateInfo`, `agrupadores.join`) were being interpolated directly into `innerHTML` strings without prior escaping.
**Learning:** Even though `escapeHtml()` is used widely, it's easy to miss edge cases when strings are built using template literals, especially nested properties (e.g. `.fmt`, `.lbl`) or array joins. XSS is a common pattern when migrating text to `innerHTML`.
**Prevention:** Ensure that ALL dynamic variables interpolated into `innerHTML` strings are strictly wrapped in `escapeHtml()`. Avoid raw interpolation of unvalidated external inputs.
