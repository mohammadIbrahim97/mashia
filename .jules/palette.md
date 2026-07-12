## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2026-07-12 - Accessible Form Input Labels & Multi-Inputs
**Learning:** Custom typography components like `Overline` used above inputs lack screen-reader association by default, and single labels cannot describe iterating digit inputs (like TOTP codes) properly.
**Action:** Update `Overline` to accept an `htmlFor` prop to render as a semantic `<label>` with matching `id` on inputs, and apply iterating `aria-label={"Digit " + (i + 1)}` to multiple disconnected inputs.
