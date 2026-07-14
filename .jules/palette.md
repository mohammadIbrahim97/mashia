## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.

## 2024-07-25 - Form Accessibility: Labels and Multi-Inputs
**Learning:** Typography components acting as input labels (like `Overline`) fail to associate with inputs for screen readers if they are rendered as `div` elements without `htmlFor`. Multi-input components like TOTP codes lack individual names, confusing screen readers.
**Action:** Enhance reusable typography components with an `htmlFor` prop that conditionally renders a semantic `<label>`. For multi-input arrays like 6-digit codes, apply an iterating `aria-label` (e.g., `aria-label={"Digit " + (i + 1)}`) to each field.
