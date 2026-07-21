## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2024-07-21 - Typography Elements as Labels and Multi-input Field Accessibility
**Learning:** Typography components (like `<Overline>`) are often used to label form inputs visually but fail to associate programmatically, impacting screen reader users. Additionally, multi-input fields (like 6-digit TOTP codes) need iterating `aria-label`s to remain accessible.
**Action:** When a typography component acts as a form label, accept an `htmlFor` prop and conditionally render a semantic `<label>`. Use `React.useId()` for robust ID generation. For multi-input fields, apply an iterating `aria-label` (e.g., `aria-label={"Digit " + (i + 1)}`) to each individual input.
