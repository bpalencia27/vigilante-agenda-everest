## 2024-08-14 - XSS in dynamic string interpolation for innerHTML assignments
**Vulnerability:** User inputs and API data (`selectedDateInfo`, `selectedLabDateInfo`, `agrupadores.join`) were being interpolated directly into `innerHTML` strings without prior escaping.
**Learning:** Even though `escapeHtml()` is used widely, it's easy to miss edge cases when strings are built using template literals, especially nested properties (e.g. `.fmt`, `.lbl`) or array joins. XSS is a common pattern when migrating text to `innerHTML`.
**Prevention:** Ensure that ALL dynamic variables interpolated into `innerHTML` strings are strictly wrapped in `escapeHtml()`. Avoid raw interpolation of unvalidated external inputs.

## 2024-08-18 - Defense in depth against XSS in innerHTML interpolations
**Vulnerability:** The strings `tip` and `txt` inside the `countdown` function were interpolated directly into the `innerHTML` of the element without escaping in `vigilante_agenda.user.js` line 14325. While currently harmless since they are derived from simple numerical logic (`Math.floor` and `Math.round`), future code changes could make them vulnerable.
**Learning:** Even variables derived locally that appear purely numerical or static should still be escaped when embedded in an `innerHTML` context as a best practice for defense-in-depth, preventing refactoring mistakes from becoming security vulnerabilities.
**Prevention:** Strictly enforce wrapping all dynamic strings embedded in `innerHTML` with `escapeHtml()`, except for strictly raw numbers.
