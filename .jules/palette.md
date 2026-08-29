## 2024-05-24 - Dynamic ARIA updates in Toggle Buttons
**Learning:** Initializing state-dependent ARIA attributes (e.g. `aria-label`, `aria-expanded`) only on render leads to stale screen reader announcements when UI state changes without re-rendering the whole component (like the widget dock toggle).
**Action:** Always update state-dependent ARIA attributes (like `aria-label`, `aria-expanded`) and strings dynamically within their `click` event listeners.

## 2024-05-24 - Dynamic ARIA updates in Toggle Buttons
**Learning:** Initializing state-dependent ARIA attributes (e.g. `aria-label`, `aria-expanded`) only on render leads to stale screen reader announcements when UI state changes without re-rendering the whole component (like the widget dock toggle).
**Action:** Always update state-dependent ARIA attributes (like `aria-label`, `aria-expanded`) and strings dynamically within their `click` event listeners.
