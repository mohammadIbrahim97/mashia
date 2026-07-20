## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2024-07-20 - Semantic Multi-Input & Custom Typography Label
**Learning:** Custom typography components used as form labels (like Overline) lack semantic `<label>` rendering by default. Also, multi-input fields (e.g., 6-digit TOTP) are problematic for screen readers as a single label cannot effectively associate with multiple separate inputs.
**Action:** Extend custom typography components with an `htmlFor` prop to conditionally render as a semantic `<label>`. For multi-input fields, apply an iterating `aria-label` (e.g., `aria-label={"Digit " + (i + 1)}`) to each individual input to maintain screen reader accessibility.
