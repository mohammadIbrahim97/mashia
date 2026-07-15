## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.

## 2025-02-24 - Semantic Form Labels and Multi-input ARIA
**Learning:** Extending typography components (like `Overline`) to conditionally render as `<label>` elements when given an `htmlFor` prop is a scalable way to associate labels with inputs across the app. For multi-input fields (like 6-digit TOTP codes), a single group label isn't enough; each individual input requires an iterating `aria-label` (e.g., `aria-label={"Digit " + (i + 1)}`) for screen readers.
**Action:** When creating or updating custom typography components that act as input headers, support `htmlFor` to render semantic labels. For TOTP or similar multi-field inputs, apply individual `aria-label`s to each sub-input.
