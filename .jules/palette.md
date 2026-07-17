## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.

## 2024-05-22 - Screen Reader and Keyboard Nav Gaps
**Learning:** The application uses custom modals for important confirmation actions (like ConfirmDialog) but misses essential ARIA roles like `role="dialog"`, `aria-modal`, and `aria-labelledby`, leaving screen readers unaware of the modal context. Additionally, core interaction primitives like `Button` lacked `focus-visible` styling, harming keyboard accessibility.
**Action:** When implementing or updating custom modal components, explicitly add `role="dialog"`, `aria-modal="true"`, and link the title via `aria-labelledby`. Always verify that interactive elements like buttons have distinct `focus-visible` states to support keyboard navigation without affecting mouse users.
