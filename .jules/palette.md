## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2024-08-13 - Add Global Search Keyboard Shortcut
**Learning:** Adding a keyboard shortcut for a visually hinted action (like ⌘K for search) significantly improves power user navigation and overall experience. It is important to handle both Mac (Meta) and Windows/Linux (Ctrl) modifiers, ensure case-insensitivity, prevent default browser actions, and properly clean up event listeners to avoid memory leaks.
**Action:** Always verify if a visually hinted shortcut is actually implemented. If not, implement it using standard React hooks (`useEffect`, `useRef`) ensuring broad OS support and proper cleanup.
