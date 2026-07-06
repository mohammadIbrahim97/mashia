## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2024-08-09 - Multi-Input Field Association
**Learning:** For multi-input fields like a 6-digit TOTP code, a single visual label cannot be naturally associated with multiple separate `<input>` elements using `htmlFor` and `id` in a way that screen readers will correctly announce for each field.
**Action:** When implementing multi-input fields, apply an iterating `aria-label` (e.g., `aria-label={"Digit " + (i + 1)}`) to each individual input to maintain screen reader accessibility. Also, wrap the input group in a `role="group"` with an `aria-label` describing the collective purpose.
