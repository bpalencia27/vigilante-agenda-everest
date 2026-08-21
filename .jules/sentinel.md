## 2024-08-14 - XSS in dynamic string interpolation for innerHTML assignments
**Vulnerability:** User inputs and API data (`selectedDateInfo`, `selectedLabDateInfo`, `agrupadores.join`) were being interpolated directly into `innerHTML` strings without prior escaping.
**Learning:** Even though `escapeHtml()` is used widely, it's easy to miss edge cases when strings are built using template literals, especially nested properties (e.g. `.fmt`, `.lbl`) or array joins. XSS is a common pattern when migrating text to `innerHTML`.
**Prevention:** Ensure that ALL dynamic variables interpolated into `innerHTML` strings are strictly wrapped in `escapeHtml()`. Avoid raw interpolation of unvalidated external inputs.

## 2024-08-14 - Attribute-breakout XSS via dynamic URL and missing escapeHtml in innerHTML
**Vulnerability:** URLs injected directly into `href` attributes inside `innerHTML` template literals didn't use `encodeURIComponent` for dynamic parameters like `apt.doc_id`. This creates an attribute-breakout XSS risk. Furthermore, some variables like `c` and `col` were directly interpolated into `innerHTML` strings without `escapeHtml()`.
**Learning:** Even internal variables or object properties like `apt.doc_id` or color hex values `c` can be injection vectors if not properly escaped. When dynamically building URLs for `href`, use `encodeURIComponent()` for URL parameters. When dynamically building HTML for `innerHTML`, use `escapeHtml()` for all interpolated variables.
**Prevention:** Strictly enforce wrapping all interpolated variables within `innerHTML` template strings with `escapeHtml()`, and use `encodeURIComponent()` for any dynamic pieces of a URL inside an HTML attribute.
