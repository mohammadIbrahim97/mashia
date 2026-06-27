## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.

## 2024-06-27 - ConfirmDialog Accessibility
**Learning:** The ConfirmDialog lacked standard dialog ARIA attributes (`role="dialog"`, `aria-modal="true"`), making it unclear to screen readers when a modal had opened. The 'reason' textarea lacked an explicit `<label>` association and clear focus visible styles for keyboard users, and the dialog could not be closed with the 'Escape' key.
**Action:** Add `role="dialog"`, `aria-modal="true"`, and link the title via `aria-labelledby`. Explicitly associate labels with input fields using `id` and `htmlFor`. Ensure keyboard accessibility by adding a `keydown` event listener for the 'Escape' key to close the dialog, and add `focus-visible:ring-2` for clear keyboard focus states.
