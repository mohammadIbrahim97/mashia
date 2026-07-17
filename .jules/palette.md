## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2024-05-18 - Semantic labels using custom typography components
**Learning:** Custom typography components like Overline are often used visually as labels for form inputs, but they lack semantic association by default, making them inaccessible to screen readers.
**Action:** When using custom typography components (like Overline) above form inputs, conditionally render them as semantic `<label>` tags by adding an `htmlFor` prop and ensuring the input has a matching `id`.
