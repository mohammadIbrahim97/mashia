## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2026-06-30 - Reusable Global Focus State for Reusable Components
**Learning:** The application extensively uses a generic `Button` component across almost all tables, layout headers, and detail views. However, this base component lacked accessible `focus-visible` keyboard styling.
**Action:** Instead of hunting down individual instances of buttons throughout the application, explicitly adding the application's design system focus classes (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:ring-offset-2`) to the core `Button` component propagates the accessibility fix cleanly across the entire admin dashboard without affecting mouse interactions.
