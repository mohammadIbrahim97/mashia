## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.

## 2024-08-04 - Global Search Shortcut
**Learning:** Adding a keyboard shortcut listener to an input field (e.g. Cmd+K) requires capturing both `metaKey` (Mac) and `ctrlKey` (Windows/Linux) and normalizing `e.key` to lowercase (e.g. `e.key.toLowerCase() === 'k'`) to handle Caps Lock gracefully. Also, duplicate `aria-label` attributes cause accessibility errors in React/Next.js and should be avoided.
**Action:** When adding global search shortcuts, use a `useRef` to target the input, attach a global `keydown` event listener in `useEffect` that checks for both meta/ctrl keys and the specific letter, and ensure the target input has a single, descriptive `aria-label`.
