## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2024-07-30 - Global Search Accessibility & Discoverability
**Learning:** The global search input in the admin header had redundant `aria-label`s and lacked functionality for the displayed `Cmd+K` keyboard hint. Changing the input type to `search` provides better native accessibility and semantic meaning, while adding the actual keyboard shortcut makes the UI honest and functional.
**Action:** Always verify that keyboard shortcut hints displayed in the UI are actually implemented. When adding `Cmd+K` listeners, normalize the event key with `.toLowerCase()` and handle both `metaKey` and `ctrlKey`.
