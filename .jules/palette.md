## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2024-06-22 - Visual Keyboard Shortcut Hints
**Learning:** Adding a visual keyboard shortcut hint (like `⌘K`) to an input sets a strong user expectation. If it's not wired up, it leads to a frustrating experience where the promised functionality fails.
**Action:** When a keyboard shortcut is visually indicated, ensure it is fully functional (e.g., using a `keydown` listener and `ref` to focus the relevant element) and that duplicate `aria-labels` aren't inadvertently introduced alongside it.
